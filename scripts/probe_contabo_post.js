/**
 * Safe probe: attempt POST /compute/instances with a DELIBERATELY INVALID
 * productId. This forces Contabo's validation layer to respond — NO billing
 * occurs because the body is rejected before any provisioning.
 *
 *   - HTTP 400/422 → POST endpoint works, vendor block is LIFTED
 *   - HTTP 500     → POST endpoint still globally blocked
 *   - HTTP 401/403 → auth issue (different problem)
 *
 * This is safer than calling with a real productId because Contabo will
 * NOT charge for a malformed request that fails validation.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const contabo = require('/app/js/contabo-service.js')

;(async () => {
  // First, get a valid auth token
  console.log('Step 1: Auth check (listInstances) ...')
  try {
    const inst = await contabo.listInstances()
    console.log(`  ✓ Auth OK, ${inst.length} existing instances`)
  } catch (e) {
    console.error('  ✗ Auth failed:', e.message)
    process.exit(1)
  }

  // Probe: POST with invalid productId. Contabo *should* reject with 400
  // before any billing event. If it still returns 500, the block is intact.
  console.log('\nStep 2: POST /compute/instances with INVALID productId (PROBE-INVALID-DO-NOT-BILL)')
  try {
    const r = await contabo.createInstance({
      productId: 'PROBE-INVALID-DO-NOT-BILL',
      imageId:   '00000000-0000-0000-0000-000000000000',
      region:    'INVALID',
      period:    1,
      displayName: 'probe-block-test',
    })
    console.log('  UNEXPECTED SUCCESS:', JSON.stringify(r).substring(0, 200))
  } catch (e) {
    const status = e.status || e.response?.status || e.raw?.status || 'unknown'
    const code = e.code || ''
    const msg = e.message || ''
    console.log(`  ↪ status=${status} code=${code}`)
    console.log(`  ↪ msg: ${msg.substring(0, 300)}`)
    if (status === 400 || status === 422) {
      console.log('\n✅ DIAGNOSIS: POST is reaching Contabo validation. VENDOR BLOCK IS LIFTED.')
      console.log('   You can now create real VPS instances for @davion419.')
    } else if (status === 500) {
      console.log('\n❌ DIAGNOSIS: POST still 500-ing. VENDOR BLOCK STILL ACTIVE.')
    } else if (code === 'VPS_PROVISIONING_PAUSED') {
      console.log('\n⚠️ DIAGNOSIS: Local circuit breaker is OPEN — need to reset before probing.')
    } else {
      console.log(`\n? DIAGNOSIS: unexpected status ${status}`)
    }
  }
})().catch(e => { console.error('Fatal:', e); process.exit(1) })
