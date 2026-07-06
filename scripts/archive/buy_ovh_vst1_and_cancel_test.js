/**
 * Real $4.20 OVH buy test + end-to-end validation of the patched
 * cancelInstance flow.
 *
 * Flow:
 *   1. Flip OVH_DRY_RUN=false in-process (does NOT touch .env file)
 *   2. createInstance(VST1, BHS, ubuntu-24.04) — places real order via auto-pay
 *   3. Wait for delivery + capture new serviceName
 *   4. Verify VPS appears in /vps/ list with state=running
 *   5. Call patched cancelInstance() on the new VPS
 *   6. Verify renew.mode flipped to 'manual' on /services/{sid}
 *   7. Done — VPS stays running for the rest of its paid month, no further charge
 *
 * Cost: $4.20 (one month of VST1 Nano). VPS auto-deletes on its expiration date.
 */
require('dotenv').config({ path: '/app/.env' })
process.env.OVH_DRY_RUN = 'false' // in-process only; .env unchanged

const ovh = require('/app/js/ovh-service.js')
const axios = require('axios')
const crypto = require('crypto')

// Helper for direct ovhRequest calls (for the post-buy verification)
const AK = process.env.OVH_APP_KEY
const AS = process.env.OVH_APP_SECRET
const CK = process.env.OVH_CONSUMER_KEY
const BASE = process.env.OVH_ENDPOINT
let _d = null
async function rq(method, path, body = null) {
  if (_d == null) {
    const r = await axios.get(BASE + '/auth/time')
    _d = r.data - Math.round(Date.now() / 1000)
  }
  const ts = Math.round(Date.now() / 1000) + _d
  const url = BASE + path
  const bs = body ? JSON.stringify(body) : ''
  const sig = '$1$' + crypto.createHash('sha1').update([AS, CK, method, url, bs, ts].join('+')).digest('hex')
  const r = await axios({ method, url, data: body || undefined, headers: {
    'X-Ovh-Application': AK,
    'X-Ovh-Consumer': CK,
    'X-Ovh-Timestamp': String(ts),
    'X-Ovh-Signature': sig,
    'Content-Type': 'application/json',
  }, validateStatus: () => true })
  return r
}

;(async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  OVH REAL BUY TEST + cancelInstance verification')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`OVH_DRY_RUN (effective): ${process.env.OVH_DRY_RUN}\n`)

  // ── 1. Pre-buy: snapshot existing VPSs ─────────────────────────────────
  const beforeList = (await rq('GET', '/vps')).data || []
  console.log(`[Pre-buy] /vps list: ${beforeList.length} services (${JSON.stringify(beforeList)})\n`)

  // ── 2. Place real order ────────────────────────────────────────────────
  console.log('[Buy] Placing real order: VST1 / BHS / Ubuntu 24.04 / $4.20')
  const t0 = Date.now()
  let result
  try {
    result = await ovh.createInstance({
      productId:   'VST1',
      region:      'BHS',
      imageId:     'ubuntu-24.04',
      displayName: `nomadly-test-${Date.now()}`,
      period:      1,
    })
  } catch (e) {
    console.log(`❌ createInstance FAILED after ${Math.round((Date.now() - t0) / 1000)}s`)
    console.log(`   ${e.message}`)
    if (e.response?.data) console.log(`   body: ${JSON.stringify(e.response.data).slice(0, 800)}`)
    process.exit(1)
  }
  console.log(`✅ createInstance returned in ${Math.round((Date.now() - t0) / 1000)}s`)
  console.log('   Result keys:', Object.keys(result).join(', '))
  console.log('   Result (truncated):', JSON.stringify(result, null, 2).slice(0, 1500))

  const newSn = result._ovhServiceName || result.instanceId || result.serviceName
  if (!newSn || !newSn.startsWith('vps-')) {
    console.log('❌ No new VPS serviceName in result — aborting verification')
    process.exit(1)
  }
  console.log(`\nNew VPS: ${newSn}`)

  // ── 3. Verify VPS appears in /vps/ list ────────────────────────────────
  console.log(`\n[Verify-1] GET /vps → should now contain ${newSn}`)
  const afterList = (await rq('GET', '/vps')).data || []
  const present = afterList.includes(newSn)
  console.log(`   list length: ${afterList.length} (was ${beforeList.length})`)
  console.log(`   ${present ? '✅' : '❌'} new VPS ${present ? 'present' : 'MISSING'} in list`)

  // ── 4. Read VPS state + numeric serviceId ──────────────────────────────
  console.log(`\n[Verify-2] GET /vps/${newSn} + serviceInfos`)
  const vpsDetail = (await rq('GET', `/vps/${newSn}`)).data
  const svcInfo = (await rq('GET', `/vps/${newSn}/serviceInfos`)).data
  console.log(`   state=${vpsDetail.state}  offer=${vpsDetail.offerType || vpsDetail.model?.name}  expiration=${svcInfo.expiration}`)
  console.log(`   numeric serviceId = ${svcInfo.serviceId}`)
  console.log(`   renew (legacy view): ${JSON.stringify(svcInfo.renew)}`)

  // ── 5. Call PATCHED cancelInstance() ───────────────────────────────────
  console.log(`\n[Patch test] Calling cancelInstance(${newSn})`)
  const cancelResult = await ovh.cancelInstance(newSn)
  console.log('   Result:', JSON.stringify(cancelResult, null, 2))

  // ── 6. Verify renew.mode actually flipped on /services/{sid} ───────────
  console.log(`\n[Verify-3] GET /services/${svcInfo.serviceId} → renew.current.mode should be 'manual'`)
  const svc = (await rq('GET', `/services/${svcInfo.serviceId}`)).data
  const mode = svc.billing?.renew?.current?.mode
  console.log(`   renew.current.mode = ${mode}`)
  console.log(`   nextBillingDate    = ${svc.billing?.nextBillingDate}`)
  console.log(`   ${mode === 'manual' ? '✅ PATCHED CANCEL WORKS — renew.mode is now manual' : '❌ FAIL — still ' + mode}`)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Real order placed:           ${result._ovhOrderId ? '✅ orderId=' + result._ovhOrderId : '(no orderId returned)'}`)
  console.log(`VPS provisioned:             ${present ? '✅ ' + newSn : '❌'}`)
  console.log(`VPS state:                   ${vpsDetail.state}`)
  console.log(`Numeric serviceId:           ${svcInfo.serviceId}`)
  console.log(`Cancel via patched code:     ${cancelResult.method === 'renew-mode-manual' ? '✅' : '❌'} (${cancelResult.method})`)
  console.log(`Final renew.current.mode:    ${mode === 'manual' ? '✅ manual' : '❌ ' + mode}`)
  console.log(`Service ends:                ${cancelResult.nextBillingDate || cancelResult.expirationDate} (no further charge after this)`)
  process.exit(0)
})().catch(e => {
  console.error('\n❌ FATAL', e.response?.data || e.message)
  if (e.response?.status) console.error('   HTTP', e.response.status)
  if (e.stack) console.error('   stack:\n', e.stack.split('\n').slice(0, 6).join('\n'))
  process.exit(1)
})
