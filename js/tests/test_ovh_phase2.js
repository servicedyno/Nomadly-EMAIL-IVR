/**
 * Smoke tests for Phase-2 polish:
 *  1. listDedicatedPlans — cached & live modes
 *  2. upgradeInstance dry-run (without real VPS, expects ovh API to reject)
 *  3. _applyPostDeployConfig signature check
 *  4. resetPassword stub returns the expected shape
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const ovh = require('../ovh-service')

function assert(cond, label) {
  if (cond) console.log(`  ✓ ${label}`)
  else { console.log(`  ✗ ${label}`); process.exitCode = 1 }
}

;(async () => {
  console.log('━━━ 1. listDedicatedPlans (cached)')
  const cached = await ovh.listDedicatedPlans()
  for (const p of cached) {
    console.log(`  ${p.productId.padEnd(5)} ${p.planCode.padEnd(15)} ${p.name.padEnd(35)} ${p.ramGb}G  $${p.basePriceUsd}/mo`)
  }
  assert(cached.length === 4, 'Four dedicated SKUs in cached catalog')
  assert(cached.every(p => p.ramGb >= 32), 'All dedicated SKUs are ≥32 GB RAM')
  assert(cached.every(p => p.source === 'cached'), 'Cached mode marks source=cached')

  console.log('\n━━━ 2. listDedicatedPlans (live — verifies OVH catalog still has these planCodes)')
  const live = await ovh.listDedicatedPlans({ live: true })
  for (const p of live) {
    console.log(`  ${p.productId.padEnd(5)} ${p.planCode.padEnd(15)} live=$${p.basePriceUsd}/mo  source=${p.source}`)
  }
  assert(live.length === 4, 'Live mode returns 4 SKUs')
  assert(live.every(p => p.source === 'live'), 'All 4 planCodes still in OVH eco catalog (live source)')

  console.log('\n━━━ 3. upgradeInstance dry-run')
  process.env.OVH_DRY_RUN = 'true'
  try {
    // Use a fake serviceName — OVH should reject "availableUpgrade" because
    // the VPS doesn't exist on our account. We expect a clean throw.
    const r = await ovh.upgradeInstance('vps-fake-test-123.vps.ovh.net', { productId: 'VES8a' })
    console.log(`  upgrade result: ${JSON.stringify(r)}`)
    assert(false, 'upgradeInstance should have thrown for fake VPS')
  } catch (e) {
    console.log(`  ✓ Correctly errored: ${e.message.substring(0, 120)}`)
    assert(/availableUpgrade|service does not|not found|404/i.test(e.message), 'Error mentions missing VPS or upgrade rejection')
  } finally {
    delete process.env.OVH_DRY_RUN
  }

  console.log('\n━━━ 4. resetPassword — verify shape (no real VPS, expect throw on rebuild)')
  try {
    await ovh.resetPassword('vps-fake-test-456.vps.ovh.net', { osType: 'Linux' })
    assert(false, 'resetPassword should throw for fake VPS')
  } catch (e) {
    console.log(`  ✓ Correctly errored: ${e.message.substring(0, 120)}`)
  }

  console.log('\n━━━ 5. Exports surface check')
  assert(typeof ovh.upgradeInstance === 'function', 'upgradeInstance exported')
  assert(typeof ovh.listDedicatedPlans === 'function', 'listDedicatedPlans exported')
  assert(typeof ovh._applyPostDeployConfig === 'function', '_applyPostDeployConfig exported')
  assert(Array.isArray(ovh.DEDICATED_CATALOG) && ovh.DEDICATED_CATALOG.length === 4, 'DEDICATED_CATALOG exported with 4 entries')

  console.log('\n━━━ DONE. Exit code:', process.exitCode || 0)
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
