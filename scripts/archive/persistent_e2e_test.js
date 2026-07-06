#!/usr/bin/env node
/**
 * Persistent end-to-end test — provisions a real Linux VPS via DigitalOcean
 * AND a real Windows RDP via Azure, then prints connection credentials.
 *
 * Both are left RUNNING. Run `scripts/cleanup_persistent_test.js` (or just
 * delete via provider dashboards) when you're done testing.
 *
 * Cost while running:
 *   • DO Cloud VPS 10 (s-1vcpu-1gb): $0.009/hr = ~$0.21/day
 *   • Azure D2s_v6 Windows:         ~$0.165/hr = ~$3.96/day
 *
 * USAGE: node scripts/persistent_e2e_test.js
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })

const azure = require('/app/js/azure-service')
const digitalocean = require('/app/js/digitalocean-service')

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function provisionDOVPS() {
  console.log('\n══════════════════════════════════════════════════════════')
  console.log('║  Part 1: DigitalOcean Linux VPS                          ║')
  console.log('══════════════════════════════════════════════════════════')
  console.log('[DO/1] Provisioning Cloud VPS 10 (1vCPU/1GB/25GB) in EU…')

  const rootPassword = require('crypto').randomBytes(16).toString('base64')
    .replace(/[+/=]/g, '').slice(0, 20) + 'Aa1!'
  const secret = await digitalocean.createSecret(
    `e2e-vps-${Date.now()}`, rootPassword, 'password'
  )

  let inst
  try {
    inst = await digitalocean.createInstance({
      productId:  's-1vcpu-1gb',
      regionSlug: 'EU',
      osId:       'ubuntu-24-04-x64',
      label:      'e2e-vps-test',
      chatId:     'persistent-test',
      vpsId:      'e2e-vps-' + Date.now(),
      rootPassword,
      passwordSecretId: secret.secretId,
    })
  } catch (e) {
    console.error('   ❌ DO create failed:', e.message)
    throw e
  }
  console.log('   ✅ Droplet created:')
  console.log(`      instanceId:  ${inst.instanceId}`)
  console.log(`      ip:          ${inst.mainIp || '(allocating…)'}`)
  console.log(`      defaultUser: ${inst.defaultUser || 'root'}`)
  console.log(`      password:    ${rootPassword}`)
  console.log(`      status:      ${inst.status}`)

  // Poll for IP if not allocated yet
  if (!inst.mainIp) {
    console.log('[DO/2] Polling for IP allocation (up to 90s)…')
    for (let i = 0; i < 9; i++) {
      await sleep(10_000)
      try {
        const live = await digitalocean.getInstance(inst.instanceId)
        if (live.mainIp) {
          inst.mainIp = live.mainIp
          console.log(`   ✅ IP allocated: ${live.mainIp}`)
          break
        }
        console.log(`   [+${(i + 1) * 10}s] status=${live.powerStatus || live.status} ip=${live.mainIp || '—'}`)
      } catch (e) {
        console.log(`   [poll ${i + 1}] err: ${e.message}`)
      }
    }
  }

  return { ...inst, rootPassword }
}

async function provisionAzureRDP() {
  console.log('\n══════════════════════════════════════════════════════════')
  console.log('║  Part 2: Azure Windows RDP                               ║')
  console.log('══════════════════════════════════════════════════════════')
  console.log('[AZ/1] Provisioning Standard_D2s_v6 (2vCPU/8GB) in EU (westeurope)…')
  azure.resetProvisioningCircuit()

  let inst
  try {
    inst = await azure.createInstance({
      productId:  'Standard_D2s_v6',
      regionSlug: 'EU',
      osId:       'win2022-datacenter-g2',
      label:      'e2e-rdp-test',
      chatId:     'persistent-test',
      vpsId:      'e2e-rdp-' + Date.now(),
    })
  } catch (e) {
    console.error('   ❌ Azure create failed:', e.message)
    if (e.responseBody) console.error('   Body:', JSON.stringify(e.responseBody).slice(0, 400))
    throw e
  }

  // Poll until running + IP allocated
  console.log('[AZ/2] Polling for IP + Running state (up to 5 min)…')
  let live = inst
  for (let i = 0; i < 20; i++) {
    await sleep(15_000)
    try {
      live = await azure.getInstance(inst.instanceId)
      console.log(`   [+${(i + 1) * 15}s] power=${live.powerStatus} provision=${live.serverStatus} ip=${live.mainIp || '—'}`)
      if (live.mainIp && live.powerStatus === 'running') break
    } catch (e) {
      console.log(`   [poll ${i + 1}] err: ${e.message}`)
    }
  }
  return { ...inst, mainIp: live.mainIp }
}

;(async () => {
  const startedAt = Date.now()
  let doInst = null
  let azInst = null

  try {
    doInst = await provisionDOVPS()
  } catch (e) {
    console.error('\n‼️  DO provisioning failed:', e.message)
  }

  try {
    azInst = await provisionAzureRDP()
  } catch (e) {
    console.error('\n‼️  Azure provisioning failed:', e.message)
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000)
  console.log('\n══════════════════════════════════════════════════════════')
  console.log(`║  E2E TEST RESULTS  (${elapsed}s elapsed)                       ║`)
  console.log('══════════════════════════════════════════════════════════')

  if (doInst) {
    console.log('\n🟢 DigitalOcean Linux VPS  — Cloud VPS 10 (1vCPU/1GB)')
    console.log(`   IP:       ${doInst.mainIp}`)
    console.log(`   SSH:      ssh ${doInst.defaultUser || 'root'}@${doInst.mainIp}`)
    console.log(`   User:     ${doInst.defaultUser || 'root'}`)
    console.log(`   Password: ${doInst.rootPassword}`)
    console.log(`   To delete: node -e "require('/app/js/digitalocean-service').cancelInstance('${doInst.instanceId}').then(r=>console.log(r))"`)
  } else {
    console.log('\n🔴 DigitalOcean — FAILED to provision (see error above)')
  }

  if (azInst) {
    console.log('\n🟢 Azure Windows RDP  — D2s_v6 (2vCPU/8GB)')
    console.log(`   IP:       ${azInst.mainIp}`)
    console.log(`   RDP cmd:  mstsc /v:${azInst.mainIp}`)
    console.log(`   User:     ${azInst.defaultUser}`)
    console.log(`   Password: ${azInst.defaultPassword}`)
    console.log(`   To delete: node -e "require('/app/js/azure-service').cancelInstance('${azInst.instanceId}').then(r=>console.log(r))"`)
  } else {
    console.log('\n🔴 Azure RDP — FAILED to provision (see error above)')
  }

  console.log('\n──────────────────────────────────────────────────────────')
  console.log('⚠️  Both VMs are LEFT RUNNING. Cost: DO ~$0.21/day + Azure ~$3.96/day.')
  console.log('    Remember to deprovision when done testing.')
  console.log('──────────────────────────────────────────────────────────')
})().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
