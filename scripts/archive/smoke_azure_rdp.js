#!/usr/bin/env node
/**
 * Live Azure smoke test — provisions a real Standard_B1ms Windows VM in
 * the `nomadly-vps` resource group, polls until it has a public IP, then
 * tears it down.
 *
 * Cost: B1ms ≈ $0.0156/hr × ~5 min of runtime = ~$0.001 (less than a cent).
 *
 * USAGE:
 *   node scripts/smoke_azure_rdp.js          # full create + IP poll + cleanup
 *   KEEP_ALIVE=1 node scripts/smoke_azure_rdp.js   # leave the VM running (for manual RDP test)
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })

const azure = require('/app/js/azure-service')
const vpsProvider = require('/app/js/vps-provider')

const KEEP_ALIVE = String(process.env.KEEP_ALIVE || '').toLowerCase() === '1' ||
                   String(process.env.KEEP_ALIVE || '').toLowerCase() === 'true'

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('═══ Azure RDP Smoke Test ═══')
  console.log(`Resource group:  ${process.env.AZURE_RESOURCE_GROUP}`)
  console.log(`Subscription:    ${process.env.AZURE_SUBSCRIPTION_ID?.slice(0, 8)}…`)
  console.log(`Default region:  ${process.env.AZURE_DEFAULT_LOCATION}`)
  console.log(`Smart proxy provider for isRDP=true: ${vpsProvider.pickProviderForOs(true).PROVIDER}`)
  console.log(`Smart proxy provider for isRDP=false: ${vpsProvider.pickProviderForOs(false).PROVIDER}`)
  console.log('')

  // ── Step 1: Auth check
  console.log('[1/5] Verifying Azure auth (token + RBAC)...')
  try {
    await azure._getToken()
    console.log('      ✅ OAuth token acquired')
  } catch (e) {
    console.error('      ❌ Auth failed:', e.message)
    process.exit(1)
  }

  // ── Step 2: Verify catalog
  console.log('[2/5] Verifying catalog...')
  const products = azure.listProducts('US-east', true)
  console.log(`      ✅ ${products.length} B-tier SKUs available:`,
              products.map(p => `${p.name}=$${p.pricing.totalWithMarkup}`).join(', '))
  const b1ms = azure.getProduct('Standard_B2als_v2')
  if (!b1ms) { console.error('      ❌ Cloud VPS 10 (B2als_v2) not found in catalog'); process.exit(1) }

  // ── Step 3: Create — try the available SKUs first
  console.log('[3/5] Provisioning (testing live integration: D2s_v6 in EU, where quota exists)...')
  azure.resetProvisioningCircuit()
  const attempts = process.env.SMOKE_REGION
    ? [{ sku: 'Standard_D2s_v6', region: process.env.SMOKE_REGION }]
    : [
        // D-series in EU has standardDsv6Family quota=10
        { sku: 'Standard_D2s_v6', region: 'EU' },
        { sku: 'Standard_D2s_v7', region: 'US-east' },
        { sku: 'Standard_D2lds_v7', region: 'US-east' },
      ]
  let inst = null, lastErr = null
  for (const a of attempts) {
    try {
      console.log(`      → trying ${a.sku} in ${a.region}…`)
      // Reset circuit between attempts so SkuNotAvailable doesn't open it
      azure.resetProvisioningCircuit()
      inst = await azure.createInstance({
        productId:  a.sku,
        regionSlug: a.region,
        osId:       'win2022-datacenter-g2',
        label:      'smoketest',
        chatId:     'smoke-test',
        vpsId:      'smoke-' + Date.now(),
      })
      console.log(`      ✅ Provisioned ${a.sku} in ${a.region}`)
      break
    } catch (e) {
      lastErr = e
      const code = e.code || 'unknown'
      console.log(`         ✕ ${code}: ${(e.message || '').slice(0, 120)}`)
      if (code !== 'SkuNotAvailable' && code !== 'OperationNotAllowed') break
    }
  }
  if (!inst) {
    console.error('      ❌ All attempts failed. Last:', lastErr?.message)
    if (lastErr?.responseBody) console.error('      Body:', JSON.stringify(lastErr.responseBody).slice(0, 500))
    process.exit(1)
  }
  console.log(`         instanceId:      ${inst.instanceId}`)
  console.log(`         mainIp:          ${inst.mainIp || '(allocating…)'}`)
  console.log(`         defaultUser:     ${inst.defaultUser}`)
  console.log(`         defaultPassword: ${inst.defaultPassword}`)
  console.log(`         passwordSecret:  ${inst.passwordSecretId}`)
  console.log(`         status:          ${inst.status}`)

  // ── Step 4: Poll for IP + Running power state
  console.log('[4/5] Polling for IP allocation + power=running (up to 8 min)...')
  let live = null
  const startedAt = Date.now()
  for (let attempt = 1; attempt <= 32; attempt++) { // 32 × 15s = 8 min
    await sleep(15_000)
    try {
      live = await azure.getInstance(inst.instanceId)
      const elapsed = Math.round((Date.now() - startedAt) / 1000)
      console.log(`         [+${elapsed}s] power=${live.powerStatus} provision=${live.serverStatus} ip=${live.mainIp || '—'}`)
      if (live.mainIp && live.powerStatus === 'running') break
    } catch (e) {
      console.log(`         [poll ${attempt}] getInstance error: ${e.message}`)
    }
  }
  if (!live?.mainIp || live.powerStatus !== 'running') {
    console.log('      ⚠️  VM did not reach (running, has-IP) within 8 min — continuing to cleanup anyway.')
  } else {
    console.log(`      ✅ VM is RUNNING with public IP ${live.mainIp}`)
    console.log(`         RDP connect: mstsc /v:${live.mainIp}`)
    console.log(`         Username:    ${inst.defaultUser}`)
    console.log(`         Password:    ${inst.defaultPassword}`)
  }

  if (KEEP_ALIVE) {
    console.log('')
    console.log('═══ KEEP_ALIVE=1 — VM left running for manual RDP test. ═══')
    console.log(`   To clean up later: node -e "require('/app/js/azure-service').cancelInstance('${inst.instanceId}').then(r=>console.log(r))"`)
    return
  }

  // ── Step 5: Tear down
  console.log('[5/5] Tearing down (deleting VM + NIC + IP + NSG + VNet + OS disk)...')
  try {
    const r = await azure.cancelInstance(inst.instanceId)
    for (const x of r.results) {
      console.log(`      ${x.deleted ? '✅' : '⚠️ '} ${x.type}/${x.name} ${x.deleted ? 'deleted' : '(' + (x.err || 'skipped') + ')'}`)
    }
  } catch (e) {
    console.error('      ❌ cancelInstance failed:', e.message)
    process.exit(1)
  }

  console.log('')
  console.log('═══ Smoke test PASSED ═══')
}

main().catch(e => {
  console.error('Smoke test FAILED:', e)
  process.exit(1)
})
