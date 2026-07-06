#!/usr/bin/env node
/**
 * Quick smoke test for the new Contabo circuit breaker.
 * Calls createInstance() repeatedly with the known-failing payload and
 * verifies:
 *   1. After 2 consecutive 500s, the breaker opens.
 *   2. Subsequent calls fail with code=VPS_PROVISIONING_PAUSED (no HTTP call).
 *   3. isProvisioningHealthy() returns healthy=false with the right reason.
 *   4. resetProvisioningCircuit() closes the breaker.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const contabo = require('/app/js/contabo-service.js')

;(async () => {
  console.log('=== State at start ===')
  console.log(' health:', contabo.isProvisioningHealthy())
  console.log(' circuit:', contabo.getCircuitState())

  const opts = {
    productId: 'V91',
    region: 'EU',
    imageId: '1a5471c8-06f6-40cd-aff1-e946f72235a8',
    displayName: `circuit-test-${Date.now()}`,
    period: 1,
  }

  let onOpenFired = false
  contabo.onProvisioningCircuitOpen((state) => {
    onOpenFired = true
    console.log(' >>> onOpen callback fired! state:', JSON.stringify(state))
  })

  for (let i = 1; i <= 4; i++) {
    console.log(`\n=== Attempt ${i} ===`)
    const t0 = Date.now()
    try {
      const r = await contabo.createInstance(opts)
      console.log(`  ✓ unexpected success: instanceId=${r?.instanceId}`)
    } catch (e) {
      const dur = Date.now() - t0
      console.log(`  ✗ failed in ${dur}ms: code=${e.code || 'n/a'}  status=${e.status || 'n/a'}  msg=${e.message?.slice(0, 120)}`)
    }
    console.log(' health:', contabo.isProvisioningHealthy())
    console.log(' circuit:', contabo.getCircuitState())
  }

  console.log(`\n=== onOpen callback fired? ${onOpenFired} ===`)
  console.log('\n=== Reset breaker ===')
  console.log(contabo.resetProvisioningCircuit())
  console.log(' health after reset:', contabo.isProvisioningHealthy())
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
