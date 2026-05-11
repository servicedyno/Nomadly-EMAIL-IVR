/**
 * tests/test_cancellation_flows.js
 *
 * Comprehensive unit test for the VPS cancellation state machine.
 * Mocks Contabo + MongoDB; never touches the network or the live DB.
 *
 * Covers every entry into and exit from the early-cancel state:
 *   1. createVPSInstance with autoRenewable=false → cancel-on-create
 *   2. createVPSInstance when Contabo cancel call fails → degrade gracefully
 *   3. changeVpsAutoRenewal ON → OFF (Bug-B fix, regression)
 *   4. changeVpsAutoRenewal ON → OFF when Contabo already cancelled (no double-call)
 *   5. changeVpsAutoRenewal OFF → ON on an early-cancelled plan
 *          → clears _contaboCancelledEarly, sets _uncancelPending,
 *            returns needsContaboUncancel=true
 *   6. changeVpsAutoRenewal OFF → ON on a fresh plan
 *          → no needsContaboUncancel flag
 *   7. renewVPSPlan after wallet top-up on an early-cancelled plan
 *          → clears flags, sets _uncancelPending, returns needsContaboUncancel=true
 *   8. renewVPSPlan on a never-cancelled plan
 *          → standard renewal, no admin alert
 *
 * Strategy:
 *   - Stub require('./contabo-service') to record cancelInstance / getInstance /
 *     createInstance / createSecret calls and return scripted responses.
 *   - Stub _vpsPlansOf via a tiny in-memory collection that supports the
 *     subset of MongoDB API used by the modules under test.
 *   - Inspect return values and recorded calls; assert with PASS/FAIL.
 */

const Module = require('module')

// ── Contabo stub ────────────────────────────────────────────────────────
const calls = {
  cancelInstance: [],
  getInstance: [],
  createInstance: [],
  createSecret: [],
}
let stubScript = {
  cancelInstanceShouldThrow: false,
  getInstanceFirstHasCancelDate: false,
  getInstancePostCancelHasCancelDate: true,
  createInstanceReturn: { instanceId: 999111, name: 'mock', status: 'provisioning' },
}

const stubContabo = {
  cancelInstance: async (id) => {
    calls.cancelInstance.push(id)
    if (stubScript.cancelInstanceShouldThrow) throw new Error('mock cancel failed')
    return { instanceId: id }
  },
  getInstance: async (id) => {
    calls.getInstance.push(id)
    // Sequential responses: first call reflects initial state, later calls reflect post-cancel state
    const callIdx = calls.getInstance.filter(x => x === id).length
    if (callIdx === 1 && stubScript.getInstanceFirstHasCancelDate) {
      return { instanceId: id, cancelDate: '2026-06-09', status: 'running', osType: 'Linux', defaultUser: 'root' }
    }
    if (callIdx > 1 && stubScript.getInstancePostCancelHasCancelDate) {
      return { instanceId: id, cancelDate: '2026-06-09', status: 'running', osType: 'Linux', defaultUser: 'root' }
    }
    return { instanceId: id, cancelDate: null, status: 'running', osType: 'Linux', defaultUser: 'root' }
  },
  createInstance: async (opts) => {
    calls.createInstance.push(opts)
    return stubScript.createInstanceReturn
  },
  createSecret: async (name, value, type) => {
    calls.createSecret.push({ name, valueLen: value.length, type })
    return { secretId: 12345 }
  },
  getDefaultWindowsImageId: async () => 'mock-image',
  getProduct: () => ({ basePriceUsd: 7.95, tier: 2 }),
  REGION_SURCHARGE: { 'EU': [0, 0, 0, 0, 0, 0], 'US-east': [1.8, 2.8, 5.5, 9.7, 14.3, 18.9] },
  WINDOWS_LICENSE_BY_TIER: { 1: 9.30, 2: 19.10 },
}

const origRequire = Module.prototype.require
Module.prototype.require = function (req) {
  if (req === './contabo-service' || req === './contabo-service.js') return stubContabo
  return origRequire.apply(this, arguments)
}

const vmSetup = require('../vm-instance-setup.js')

// ── In-memory MongoDB collection stub ───────────────────────────────────
const docs = []
function matches(doc, filter) {
  return Object.keys(filter).every(k => {
    const v = filter[k]
    if (v && typeof v === 'object' && '$in' in v) return v.$in.includes(doc[k])
    if (v && typeof v === 'object' && '$ne' in v) return doc[k] !== v.$ne
    return doc[k] === v
  })
}
const fakeCol = {
  insertOne: async (doc) => { docs.push({ ...doc }); return { insertedId: doc._id || 'mock' } },
  updateOne: async (filter, update) => {
    const doc = docs.find(d => matches(d, filter))
    if (!doc) return { matchedCount: 0 }
    if (update.$set) Object.assign(doc, update.$set)
    if (update.$unset) for (const k of Object.keys(update.$unset)) delete doc[k]
    return { matchedCount: 1, modifiedCount: 1 }
  },
  findOne: async (filter) => docs.find(d => matches(d, filter)) || null,
  find: () => ({ toArray: async () => docs.slice() }),
  createIndex: async () => null,
  deleteOne: async (filter) => {
    const i = docs.findIndex(d => matches(d, filter))
    if (i < 0) return { deletedCount: 0 }
    docs.splice(i, 1)
    return { deletedCount: 1 }
  },
}
const fakeDb = { collection: () => fakeCol }
vmSetup.initVpsDb(fakeDb)

// ── Test helpers ────────────────────────────────────────────────────────
function resetState() {
  calls.cancelInstance.length = 0
  calls.getInstance.length = 0
  calls.createInstance.length = 0
  calls.createSecret.length = 0
  docs.length = 0
  stubScript = {
    cancelInstanceShouldThrow: false,
    getInstanceFirstHasCancelDate: false,
    getInstancePostCancelHasCancelDate: true,
    createInstanceReturn: { instanceId: 999111, name: 'mock', status: 'provisioning' },
  }
}

let pass = 0, fail = 0
function assert(name, cond, detail) {
  if (cond) { console.log(`  ✅ ${name}`); pass++ }
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); fail++ }
}

// ═══════════════════════════════════════════════════════════════════════
;(async () => {
  // ── TEST 1: createVPSInstance with autoRenewable=false → cancel-on-create
  console.log('\nTEST 1 — createVPSInstance triggers cancel-on-create')
  resetState()
  const r1 = await vmSetup.createVPSInstance('123', {
    productId: 'V94',
    region: 'EU',
    os: { id: 'mock-image', isRDP: false },
    plantotalPrice: 7.95,
  })
  assert('createInstance was called', calls.createInstance.length === 1)
  assert('returned success', r1 && r1.success === true)
  assert('DB record inserted', docs.length === 1)
  assert('DB record has autoRenewable=false', docs[0] && docs[0].autoRenewable === false)
  assert('cancelInstance was called', calls.cancelInstance.length === 1, `got ${calls.cancelInstance.length}`)
  assert('cancelInstance with correct instanceId', calls.cancelInstance[0] === 999111)
  assert('DB record stamped _contaboCancelledEarly=true', docs[0] && docs[0]._contaboCancelledEarly === true)
  assert('DB record has contaboCancelDate', docs[0] && docs[0].contaboCancelDate === '2026-06-09')
  assert('cancelReason=created_with_auto_renew_off', docs[0] && docs[0].cancelReason === 'created_with_auto_renew_off')

  // ── TEST 2: createVPSInstance when Contabo cancel call fails → degrade
  console.log('\nTEST 2 — Contabo cancel fails during create → degrade gracefully')
  resetState()
  stubScript.cancelInstanceShouldThrow = true
  const r2 = await vmSetup.createVPSInstance('456', {
    productId: 'V94', region: 'EU', os: { id: 'mock-image', isRDP: false }
  })
  assert('createVPSInstance still returns success', r2 && r2.success === true)
  assert('DB record exists despite cancel failure', docs.length === 1)
  assert('_contaboCancelledEarly NOT set (scheduler/self-heal will retry)', !docs[0]._contaboCancelledEarly)

  // ── TEST 3: changeVpsAutoRenewal ON → OFF (regression of Bug-B fix)
  console.log('\nTEST 3 — toggle ON→OFF triggers Contabo cancel')
  resetState()
  docs.push({ chatId: '789', vpsId: 'vps-789', _id: 'vps-789' })
  const r3 = await vmSetup.changeVpsAutoRenewal('789', {
    _id: 'vps-789', vpsId: 'vps-789', autoRenewable: true, contaboInstanceId: 999111
  })
  assert('cancelInstance called once', calls.cancelInstance.length === 1)
  assert('result.autoRenewable=false', r3 && r3.autoRenewable === false)
  assert('result.contaboCancelDate set', r3 && r3.contaboCancelDate === '2026-06-09')
  assert('DB record _contaboCancelledEarly=true', docs[0]._contaboCancelledEarly === true)
  assert('DB cancelReason=auto_renew_disabled_by_user', docs[0].cancelReason === 'auto_renew_disabled_by_user')
  assert('result.needsContaboUncancel=false (going OFF, not ON)', r3.needsContaboUncancel === false)

  // ── TEST 4: changeVpsAutoRenewal when Contabo already cancelled → no double-call
  console.log('\nTEST 4 — toggle ON→OFF when Contabo already cancelled → no double-call')
  resetState()
  docs.push({ chatId: '789b', vpsId: 'vps-789b', _id: 'vps-789b' })
  stubScript.getInstanceFirstHasCancelDate = true
  const r4 = await vmSetup.changeVpsAutoRenewal('789b', {
    _id: 'vps-789b', vpsId: 'vps-789b', autoRenewable: true, contaboInstanceId: 999222
  })
  assert('cancelInstance NOT called (already cancelled)', calls.cancelInstance.length === 0)
  assert('DB still stamped _contaboCancelledEarly=true', docs[0]._contaboCancelledEarly === true)
  assert('result.autoRenewable=false', r4.autoRenewable === false)

  // ── TEST 5: changeVpsAutoRenewal OFF → ON on an early-cancelled plan
  console.log('\nTEST 5 — toggle OFF→ON on early-cancelled plan')
  resetState()
  docs.push({
    chatId: '321', vpsId: 'vps-321', _id: 'vps-321',
    autoRenewable: false,
    _contaboCancelledEarly: true,
    contaboCancelDate: '2026-06-09',
    cancelReason: 'auto_renew_disabled_by_user',
    cancelledAt: new Date(),
  })
  const r5 = await vmSetup.changeVpsAutoRenewal('321', {
    _id: 'vps-321', vpsId: 'vps-321',
    autoRenewable: false,                // current state — toggle flips to true
    _contaboCancelledEarly: true,
    contaboInstanceId: 999111,
  })
  assert('result.autoRenewable=true', r5 && r5.autoRenewable === true)
  assert('result.needsContaboUncancel=true', r5.needsContaboUncancel === true)
  assert('result.contaboInstanceId returned', r5.contaboInstanceId === 999111)
  assert('cancelInstance NOT called', calls.cancelInstance.length === 0)
  assert('DB _contaboCancelledEarly flipped to false', docs[0]._contaboCancelledEarly === false)
  assert('DB _uncancelPending=true', docs[0]._uncancelPending === true)
  assert('DB _uncancelPendingSince set', docs[0]._uncancelPendingSince instanceof Date)
  assert('DB cancelledAt cleared (null)', docs[0].cancelledAt === null)
  assert('DB cancelReason cleared (null)', docs[0].cancelReason === null)

  // ── TEST 6: changeVpsAutoRenewal OFF → ON on a plan that was NOT early-cancelled
  console.log('\nTEST 6 — toggle OFF→ON on never-cancelled plan')
  resetState()
  docs.push({ chatId: '654', vpsId: 'vps-654', _id: 'vps-654', autoRenewable: false })
  const r6 = await vmSetup.changeVpsAutoRenewal('654', {
    _id: 'vps-654', vpsId: 'vps-654',
    autoRenewable: false, contaboInstanceId: 999333
    // no _contaboCancelledEarly
  })
  assert('result.autoRenewable=true', r6 && r6.autoRenewable === true)
  assert('result.needsContaboUncancel=false', r6.needsContaboUncancel === false)
  assert('DB has no _uncancelPending', !docs[0]._uncancelPending)
  assert('cancelInstance NOT called', calls.cancelInstance.length === 0)

  // ── TEST 7: renewVPSPlan on an early-cancelled plan
  console.log('\nTEST 7 — manual renewVPSPlan on early-cancelled plan clears flags')
  resetState()
  const originalEnd = new Date('2026-05-12T19:06:39Z')
  docs.push({
    chatId: '111', vpsId: 'vps-renew-1', _id: 'vps-renew-1',
    end_time: originalEnd,
    autoRenewable: false,
    _contaboCancelledEarly: true,
    contaboCancelDate: '2026-06-12',
    cancelReason: 'wallet_deduct_failed',
    cancelledAt: new Date('2026-05-11T08:00:00Z'),
    _selfHealAttemptedAt: new Date(),
    _selfHealReason: 'autoRenewOff_backfill_cancel',
    contaboInstanceId: 999444,
    plan: 'Monthly', planPrice: 23.97,
  })
  const r7 = await vmSetup.renewVPSPlan('111', 'vps-renew-1')
  assert('renewVPSPlan returned success', r7 && r7.success === true)
  assert('result.needsContaboUncancel=true', r7.needsContaboUncancel === true)
  assert('result.contaboInstanceId returned', r7.contaboInstanceId === 999444)
  assert('end_time extended by ~1 month', docs[0].end_time.getTime() > originalEnd.getTime())
  const monthsDiff = (docs[0].end_time.getMonth() - originalEnd.getMonth() + 12) % 12
  assert('end_time delta is 1 month', monthsDiff === 1, `got ${monthsDiff}`)
  assert('DB _contaboCancelledEarly cleared ($unset)', !('_contaboCancelledEarly' in docs[0]))
  assert('DB cancelReason cleared', !('cancelReason' in docs[0]))
  assert('DB cancelledAt cleared', !('cancelledAt' in docs[0]))
  assert('DB _selfHealAttemptedAt cleared', !('_selfHealAttemptedAt' in docs[0]))
  assert('DB _selfHealReason cleared', !('_selfHealReason' in docs[0]))
  assert('DB _uncancelPending=true', docs[0]._uncancelPending === true)
  assert('DB _uncancelPendingSince set', docs[0]._uncancelPendingSince instanceof Date)
  assert('DB status=RUNNING', docs[0].status === 'RUNNING')

  // ── TEST 8: renewVPSPlan on a plan that was NOT early-cancelled
  console.log('\nTEST 8 — manual renewVPSPlan on never-cancelled plan')
  resetState()
  docs.push({
    chatId: '222', vpsId: 'vps-renew-2', _id: 'vps-renew-2',
    end_time: new Date('2026-05-22T10:38:44Z'),
    autoRenewable: true,
    plan: 'Monthly', planPrice: 23.97,
    contaboInstanceId: 999555,
  })
  const r8 = await vmSetup.renewVPSPlan('222', 'vps-renew-2')
  assert('renewVPSPlan returned success', r8 && r8.success === true)
  assert('result.needsContaboUncancel=false', r8.needsContaboUncancel === false)
  assert('DB has no _uncancelPending', !docs[0]._uncancelPending)

  // ── TEST 9: Source-level sanity checks
  console.log('\nTEST 9 — source-level checks')
  const fs = require('fs')
  const path = require('path')
  const indexSrc = fs.readFileSync(path.resolve(__dirname, '../_index.js'), 'utf8')
  // 9a. Phase 1 wallet-deduct-fail branch must now call deleteVPSinstance
  const walletFailBlockStart = indexSrc.indexOf('Both USD and NGN failed')
  // Slice to the Phase 1.5 ASCII art header, not the inline comment mention
  const walletFailBlockEnd = indexSrc.indexOf('// Phase 1.5: PRE-EMPTIVE', walletFailBlockStart)
  const walletFailBlock = indexSrc.slice(walletFailBlockStart, walletFailBlockEnd)
  assert('Phase 1 wallet-fail calls deleteVPSinstance', walletFailBlock.includes('deleteVPSinstance(chatId, vpsId)'))
  assert('Phase 1 wallet-fail stamps cancelReason=wallet_deduct_failed', walletFailBlock.includes('wallet_deduct_failed'))
  // 9b. Daily drift reconcile scheduled
  assert('reconcileContaboBillingDrift scheduled', indexSrc.includes("schedule.scheduleJob('0 8 * * *'"))
  assert('reconcileContaboBillingDrift function exists', indexSrc.includes('async function reconcileContaboBillingDrift'))
  // 9c. Self-heal bucket B for autoRenewable=false exists
  assert('Self-heal Bucket B (autoRenewOff backfill) exists', indexSrc.includes('autoRenewOffNoCancel'))
  // 9d. Admin alert wiring for needsContaboUncancel
  assert('Admin alert wired for needsContaboUncancel (toggle path)', indexSrc.includes('needsContaboUncancel'))

  console.log(`\n══ FINAL: ${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('FATAL', e); process.exit(2) })
