/**
 * Regression test for the @HHR2009 / rsvpeviteopen.org fix:
 * 1. registerDomain() with nsChoice='cloudflare' that fails CF zone creation
 *    must NOT silently downgrade to provider_default — it must retry once,
 *    and if still failing, return an error (not register the domain).
 * 2. The retry must succeed on transient failure.
 *
 * Uses module._load hooks to stub CF + registrar services.
 */
'use strict'
const assert = require('assert')
const Module = require('module')

const origLoad = Module._load
let cfBehavior = 'always_fail' // 'always_fail' | 'transient_fail_then_succeed' | 'always_succeed'
let cfCallCount = 0
let opCallCount = 0

Module._load = function (request, parent, isMain) {
  if (request === './cf-service' || /\/cf-service$/.test(request) || /cf-service\.js$/.test(request)) {
    return {
      createZone: async (_domain) => {
        cfCallCount++
        if (cfBehavior === 'always_fail') {
          return { success: false, errors: [{ code: 1107, message: 'transient' }] }
        }
        if (cfBehavior === 'transient_fail_then_succeed') {
          if (cfCallCount === 1) return { success: false, errors: [{ code: 1107, message: 'transient' }] }
          return { success: true, zoneId: 'zone_abc', nameservers: ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'], status: 'pending' }
        }
        return { success: true, zoneId: 'zone_xyz', nameservers: ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'], status: 'pending' }
      },
      getZoneByName: async () => null,
      listDNSRecords: async () => [],
    }
  }
  if (request === './op-service' || /\/op-service$/.test(request) || /op-service\.js$/.test(request)) {
    return {
      registerDomain: async (_domain, _ns) => {
        opCallCount++
        return { success: true, domainId: 999 }
      },
      checkDomainAvailability: async () => ({ available: true, price: 12 }),
      updateNameservers: async () => ({ success: true }),
      registerDomainOnSite: async () => ({ success: true, domainId: 999 }),
    }
  }
  return origLoad.apply(this, arguments)
}

// Stub MongoDB collection
const fakeDb = {
  collection: () => ({
    updateOne: async () => ({}),
    findOne: async () => null,
  }),
}

;(async () => {
  // Reload domain-service (purge cache to pick up the stubs)
  delete require.cache[require.resolve('/app/js/domain-service.js')]
  const ds = require('/app/js/domain-service.js')

  // TEST 1: nsChoice=cloudflare, CF always fails → MUST return error, MUST NOT downgrade
  cfBehavior = 'always_fail'
  cfCallCount = 0
  opCallCount = 0
  let res = await ds.registerDomain('test1.com', 'OpenProvider', 'cloudflare', fakeDb, '12345', null)
  assert(res.error, `TEST 1: expected error, got ${JSON.stringify(res)}`)
  assert(/cloudflare/i.test(res.error), `TEST 1: error should mention cloudflare: ${res.error}`)
  assert.strictEqual(cfCallCount, 2, `TEST 1: expected 2 CF attempts (1 + retry), got ${cfCallCount}`)
  assert.strictEqual(opCallCount, 0, `TEST 1: OP must NOT be called when CF fails — got ${opCallCount}`)
  console.log('✓ TEST 1: CF persistent fail → error returned, OP never invoked (no silent downgrade)')

  // TEST 2: nsChoice=cloudflare, CF fails once then succeeds → MUST proceed normally
  cfBehavior = 'transient_fail_then_succeed'
  cfCallCount = 0
  opCallCount = 0
  res = await ds.registerDomain('test2.com', 'OpenProvider', 'cloudflare', fakeDb, '67890', null)
  assert(res.success, `TEST 2: expected success after retry, got ${JSON.stringify(res)}`)
  assert.strictEqual(res.cfZoneId, 'zone_abc', `TEST 2: zone id wrong`)
  assert.deepStrictEqual(res.nameservers, ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'], 'TEST 2: nameservers wrong')
  assert.strictEqual(cfCallCount, 2, `TEST 2: expected 2 CF attempts, got ${cfCallCount}`)
  assert.strictEqual(opCallCount, 1, `TEST 2: OP must be called once, got ${opCallCount}`)
  console.log('✓ TEST 2: CF transient fail → retry succeeds → OP registered with CF NS')

  // TEST 3: nsChoice=cloudflare, CF succeeds first try → no retry
  cfBehavior = 'always_succeed'
  cfCallCount = 0
  opCallCount = 0
  res = await ds.registerDomain('test3.com', 'OpenProvider', 'cloudflare', fakeDb, '54321', null)
  assert(res.success, `TEST 3: expected success, got ${JSON.stringify(res)}`)
  assert.strictEqual(res.cfZoneId, 'zone_xyz', `TEST 3: zone id wrong`)
  assert.strictEqual(cfCallCount, 1, `TEST 3: expected 1 CF attempt (no retry on success), got ${cfCallCount}`)
  assert.strictEqual(opCallCount, 1, `TEST 3: OP must be called once, got ${opCallCount}`)
  console.log('✓ TEST 3: CF first-try success → OP registered (no wasted retry)')

  console.log('\n✅ All 3 tests passed — no silent CF downgrade.')
})().catch(e => { console.error('❌ Test FAILED:', e.message, e.stack); process.exit(1) })
