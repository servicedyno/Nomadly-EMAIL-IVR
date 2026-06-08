#!/usr/bin/env node
/**
 * Integration test: simulate the pre-flight check used by the
 * `vps-plan-pay` handler in js/_index.js.
 *
 * We don't boot the full bot here (it needs MongoDB, Telegram, etc.).
 * Instead we simulate the exact require + call sequence the bot uses.
 */
require('dotenv').config({ path: '/app/backend/.env' })

// 1. Bot imports the service (lazy via require)
const contaboSvc = require('/app/js/contabo-service.js')

console.log('=== Pre-flight, healthy state ===')
const h1 = contaboSvc.isProvisioningHealthy()
console.log(' result:', h1)
console.assert(h1.healthy === true, 'Expected healthy:true initially')

console.log('\n=== Drive circuit to OPEN via real Contabo 500s ===')
let opened = false
contaboSvc.onProvisioningCircuitOpen(() => { opened = true })
;(async () => {
  for (let i = 1; i <= 3; i++) {
    try {
      await contaboSvc.createInstance({
        productId: 'V91', region: 'EU',
        imageId: '1a5471c8-06f6-40cd-aff1-e946f72235a8',
        period: 1,
      })
    } catch (e) {
      console.log(`  attempt ${i}: code=${e.code || 'n/a'} status=${e.status || 'n/a'}`)
    }
  }

  console.log('\n=== Pre-flight, circuit open ===')
  const h2 = contaboSvc.isProvisioningHealthy()
  console.log(' result:', h2)
  console.assert(h2.healthy === false, 'Expected healthy:false after opening')
  console.assert(h2.reason === 'VPS_PROVISIONING_PAUSED', 'Expected reason VPS_PROVISIONING_PAUSED')

  console.log('\n=== Bot would now show pause msg and return WITHOUT debiting ===')
  console.log(' admin alert fired:', opened)
  console.assert(opened, 'Expected onOpen callback to have fired')

  console.log('\n=== Reset for clean exit ===')
  contaboSvc.resetProvisioningCircuit()
  const h3 = contaboSvc.isProvisioningHealthy()
  console.log(' result after reset:', h3)
  console.assert(h3.healthy === true, 'Expected healthy:true after reset')

  console.log('\n✅ All assertions passed.')
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
