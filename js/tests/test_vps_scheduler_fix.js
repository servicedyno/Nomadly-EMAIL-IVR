/**
 * tests/test_vps_scheduler_fix.js
 *
 * Smoke test for the BUG-A and BUG-B fixes applied to
 * `checkVPSPlansExpiryandPayment()` and `changeVpsAutoRenewal()`.
 *
 * Strategy (no live Contabo / no live DB writes):
 *  1. Stub `contabo-service` so cancelInstance/getInstance return canned data.
 *  2. Stub `vm-instance-setup._vpsPlansOf` via a tiny in-memory collection.
 *  3. Call changeVpsAutoRenewal({autoRenewable:true}) → expect Contabo cancel
 *     called and DB update includes _contaboCancelledEarly + contaboCancelDate.
 *  4. Call changeVpsAutoRenewal again with the post-state (autoRenewable:false)
 *     → toggling back ON: expect NO cancel call.
 *  5. Confirm `trans` references are gone from the scheduler source.
 */

const Module = require('module')
const origResolve = Module._resolve_filename || Module._resolveFilename

// ── Mocks ────────────────────────────────────────────────────────────
const cancelCalls = []
const getCalls = []
let getInstanceMode = 'fresh' // 'fresh' = no cancelDate first, set after cancel
const stubContabo = {
  cancelInstance: async (id) => { cancelCalls.push(id); return { instanceId: id } },
  getInstance: async (id) => {
    getCalls.push(id)
    // First call (mode=fresh, before cancel): no cancelDate
    // After cancelInstance has been invoked once, return with cancelDate
    if (getInstanceMode === 'already' || cancelCalls.length > 0) {
      return { instanceId: id, cancelDate: '2026-06-09T00:00:00Z' }
    }
    return { instanceId: id, cancelDate: null }
  },
}

// Hijack require('./contabo-service') / require('./contabo-service.js')
const origRequire = Module.prototype.require
Module.prototype.require = function (req) {
  if (req === './contabo-service' || req === './contabo-service.js') return stubContabo
  return origRequire.apply(this, arguments)
}

// Now load the module under test
const vmSetup = require('../vm-instance-setup.js')

// In-memory "vpsPlansOf" collection
const inMem = []
const fakeCol = {
  updateOne: async (filter, update) => {
    let doc = inMem.find(d => d.chatId === filter.chatId && d.vpsId === filter.vpsId)
    if (!doc) { doc = { ...filter }; inMem.push(doc) }
    Object.assign(doc, update.$set || {})
    return { matchedCount: 1, modifiedCount: 1 }
  },
  findOne: async (filter) => inMem.find(d => Object.keys(filter).every(k => d[k] === filter[k])) || null,
  createIndex: async () => null,
  find: () => ({ toArray: async () => inMem.slice() }),
}
const fakeDb = { collection: (name) => fakeCol }
vmSetup.initVpsDb(fakeDb)

;(async () => {
  // ── Test 1: toggle OFF on instance NOT yet cancelled at Contabo ──
  cancelCalls.length = 0
  getCalls.length = 0
  inMem.length = 0
  getInstanceMode = 'fresh'
  const r1 = await vmSetup.changeVpsAutoRenewal('123', {
    _id: 'vps-abc',
    vpsId: 'vps-abc',
    autoRenewable: true,           // current state — toggle will flip to false
    contaboInstanceId: 999111,
  })
  console.log('TEST 1 — toggle OFF (fresh cancel):')
  console.log('  cancelInstance calls:', cancelCalls.length, '(expect 1)')
  console.log('  getInstance calls:', getCalls.length, '(expect ≥2)')
  console.log('  result:', JSON.stringify(r1))
  console.log('  DB doc:', JSON.stringify(inMem[0]))
  const ok1 = cancelCalls.length === 1
    && r1 && r1.autoRenewable === false
    && r1.contaboCancelDate === '2026-06-09T00:00:00Z'
    && inMem[0]._contaboCancelledEarly === true
    && inMem[0].contaboCancelDate === '2026-06-09T00:00:00Z'
    && inMem[0].cancelReason === 'auto_renew_disabled_by_user'
  console.log('  →', ok1 ? '✅ PASS' : '❌ FAIL')

  // ── Test 1b: toggle OFF on instance ALREADY cancelled at Contabo ──
  cancelCalls.length = 0
  getCalls.length = 0
  inMem.length = 0
  getInstanceMode = 'already'
  const r1b = await vmSetup.changeVpsAutoRenewal('456', {
    _id: 'vps-xyz',
    vpsId: 'vps-xyz',
    autoRenewable: true,
    contaboInstanceId: 999222,
  })
  console.log('\nTEST 1b — toggle OFF (already cancelled at Contabo):')
  console.log('  cancelInstance calls:', cancelCalls.length, '(expect 0 — should NOT double-cancel)')
  console.log('  result:', JSON.stringify(r1b))
  console.log('  DB doc:', JSON.stringify(inMem[0]))
  const ok1b = cancelCalls.length === 0
    && r1b && r1b.autoRenewable === false
    && inMem[0]._contaboCancelledEarly === true
    && inMem[0].contaboCancelDate === '2026-06-09T00:00:00Z'
  console.log('  →', ok1b ? '✅ PASS' : '❌ FAIL')

  // ── Test 2: toggle BACK ON → expect NO cancel ──
  cancelCalls.length = 0
  const r2 = await vmSetup.changeVpsAutoRenewal('123', {
    _id: 'vps-abc',
    vpsId: 'vps-abc',
    autoRenewable: false,           // current state — toggle will flip to true
    contaboInstanceId: 999111,
  })
  console.log('\nTEST 2 — toggle ON (no cancel expected):')
  console.log('  cancelInstance calls:', cancelCalls.length, '(expect 0)')
  console.log('  result:', JSON.stringify(r2))
  const ok2 = cancelCalls.length === 0 && r2 && r2.autoRenewable === true
  console.log('  →', ok2 ? '✅ PASS' : '❌ FAIL')

  // ── Test 3: scheduler source no longer has trans() references ──
  const fs = require('fs')
  const src = fs.readFileSync(require.resolve('../_index.js'), 'utf8')
  const start = src.indexOf('async function checkVPSPlansExpiryandPayment')
  const end = src.indexOf('const buyVPSPlanFullProcess')
  const fnSrc = src.slice(start, end)
  const transMatches = (fnSrc.match(/\btrans\(/g) || [])
  const ngnMatches = (fnSrc.match(/\bngn\.toFixed/g) || [])
  console.log('\nTEST 3 — scheduler no longer uses undefined `trans`/`ngn`:')
  console.log('  trans( occurrences:', transMatches.length, '(expect 0)')
  console.log('  ngn.toFixed occurrences:', ngnMatches.length, '(expect 0)')
  const ok3 = transMatches.length === 0 && ngnMatches.length === 0
  console.log('  →', ok3 ? '✅ PASS' : '❌ FAIL')

  console.log('\n══ FINAL: ' + (ok1 && ok1b && ok2 && ok3 ? '✅ ALL TESTS PASS' : '❌ SOMETHING FAILED'))
  process.exit(ok1 && ok1b && ok2 && ok3 ? 0 : 1)
})()
