/**
 * tests/test_protection_heartbeat_fix.js
 *
 * Smoke test for the protection-heartbeat.js audit fixes:
 *   1. runHeartbeat now filters out `deleted: true` accounts.
 *   2. summary.skipped is a separate bucket from summary.errors.
 *   3. checkAndRepair auto-marks `deleted: true` when WHM says "No such user".
 *
 * No live WHM, no live DB. Mocks only.
 */

const Module = require('module')
const path = require('path')

// ── Mock axios so heartbeat's whmApi never actually leaves the box ──
const axiosCalls = []
let nextWhmResponse = null  // override per-test
const origRequire = Module.prototype.require
Module.prototype.require = function (req) {
  if (req === 'axios') {
    return {
      create: () => ({
        get: async (url, opts) => {
          axiosCalls.push({ url, params: opts?.params })
          if (typeof nextWhmResponse === 'function') return nextWhmResponse(opts)
          return nextWhmResponse || { data: { result: { data: { content: '' } } } }
        },
      }),
    }
  }
  if (req === './anti-red-service' || req === path.join(__dirname, '../anti-red-service')) {
    return { deployCFIPFix: async () => ({ ok: true }) }
  }
  return origRequire.apply(this, arguments)
}

// Force WHM env so whmApi is created
process.env.WHM_HOST = 'fake-whm.example.com'
process.env.WHM_TOKEN = 'fake'

const heartbeat = require('../protection-heartbeat.js')

// ── Mock cpanelAccounts collection ──
let dbDocs = []
const fakeUpdates = []
const fakeCol = {
  find: (query) => {
    let docs = dbDocs.slice()
    if (query && query.deleted) {
      docs = docs.filter(d => !d.deleted)
    }
    return { toArray: async () => docs }
  },
  updateOne: async (filter, update) => {
    fakeUpdates.push({ filter, update })
    const doc = dbDocs.find(d => d._id === filter._id)
    if (doc) Object.assign(doc, update.$set || {})
    return { matchedCount: doc ? 1 : 0 }
  },
}
heartbeat.init({ collection: () => fakeCol })

;(async () => {
  let allOk = true

  // ── TEST 1: runHeartbeat excludes deleted=true accounts ──
  dbDocs = [
    { _id: 'acct1', deleted: false },
    { _id: 'acct2', deleted: true },
    { _id: 'acct3', deleted: false },
  ]
  axiosCalls.length = 0
  // Make every WHM call return intact files for acct1 and acct3
  nextWhmResponse = (opts) => {
    const u = opts.params.cpanel_jsonapi_user
    const f = opts.params.file
    if (f === '.user.ini') {
      return { data: { result: { data: { content: `auto_prepend_file = /home/${u}/public_html/.antired-challenge.php` } } } }
    }
    return { data: { result: { data: { content: 'ANTIRED_IP_FIXED CF_CONNECTING_IP FIL212sD' } } } }
  }
  const s1 = await heartbeat.runHeartbeat()
  console.log('TEST 1 — deleted accounts excluded:')
  console.log('  summary:', JSON.stringify(s1))
  console.log('  axios calls:', axiosCalls.length, '(2 accts × 2 files = 4 expected)')
  const ok1 = s1.total === 2 && s1.ok === 2 && s1.errors === 0 && axiosCalls.length === 4
  console.log('  →', ok1 ? '✅ PASS' : '❌ FAIL'); if (!ok1) allOk = false

  // ── TEST 2: summary.skipped is separate from summary.errors ──
  dbDocs = [{ _id: 'acctStuck', deleted: false }]
  axiosCalls.length = 0
  // First 3 calls return MISSING (forces 3 repairs → counter hits MAX)
  let callCount = 0
  nextWhmResponse = (opts) => {
    callCount++
    return { data: { result: { data: { content: '' } } } }  // empty → triggers repair
  }
  await heartbeat.runHeartbeat()
  await heartbeat.runHeartbeat()
  await heartbeat.runHeartbeat()
  // 4th run — should now be SKIPPED, not error
  const s2 = await heartbeat.runHeartbeat()
  console.log('\nTEST 2 — stuck-loop counts as skipped, not error:')
  console.log('  summary:', JSON.stringify(s2))
  const ok2 = s2.total === 1 && s2.skipped === 1 && s2.errors === 0
  console.log('  →', ok2 ? '✅ PASS' : '❌ FAIL'); if (!ok2) allOk = false

  // ── TEST 3: WHM "No such user" → auto-mark deleted in DB ──
  dbDocs = [{ _id: 'acctGone', deleted: false }]
  fakeUpdates.length = 0
  axiosCalls.length = 0
  nextWhmResponse = () => ({
    data: { result: { errors: ['No such user "acctGone"'], data: null } },
  })
  const s3 = await heartbeat.runHeartbeat()
  console.log('\nTEST 3 — "No such user" → auto-mark deleted:')
  console.log('  summary:', JSON.stringify(s3))
  console.log('  fake updates:', JSON.stringify(fakeUpdates).slice(0, 200))
  const updatedDoc = dbDocs.find(d => d._id === 'acctGone')
  console.log('  doc after:', JSON.stringify(updatedDoc))
  const ok3 = s3.total === 1 && s3.skipped === 1 && updatedDoc.deleted === true && updatedDoc.deletedReason === 'auto: not_on_whm'
  console.log('  →', ok3 ? '✅ PASS' : '❌ FAIL'); if (!ok3) allOk = false

  console.log('\n══ FINAL: ' + (allOk ? '✅ ALL TESTS PASS' : '❌ SOMETHING FAILED'))
  process.exit(allOk ? 0 : 1)
})()
