// Validates the ProtectionHeartbeat fixes (2026-02):
//   1) `consecutiveRepairs` counter is persisted to MongoDB on
//      `cpanelAccounts.protectionRepairCount`, so the 3x-skip guard survives
//      container restarts (previously the in-memory map reset every boot).
//   2) Once an account hits MAX_CONSECUTIVE_REPAIRS, checkAndRepair returns
//      action='skipped' reason='stuck_repair_loop' WITHOUT calling WHM.
//
// Run with:  node tests/test_protection_heartbeat_fixes.js

'use strict'

// Stub WHM/axios + anti-red-service BEFORE requiring the module
const axiosPath = require.resolve('axios')
const antiRedPath = require.resolve('../js/anti-red-service')

const calls = { whm: 0, deployCFIPFix: 0, saveFile: 0 }

require.cache[axiosPath] = {
  id: axiosPath,
  filename: axiosPath,
  loaded: true,
  exports: {
    create: () => ({
      get: async (_url, opts) => {
        calls.whm += 1
        const func = opts?.params?.cpanel_jsonapi_func
        if (func === 'save_file_content') { calls.saveFile += 1; return { data: { result: { data: { ok: 1 } } } } }
        // Return content that will fail the integrity check so a repair fires
        return { data: { result: { data: { content: '' } } } }
      },
    }),
  },
}

require.cache[antiRedPath] = {
  id: antiRedPath,
  filename: antiRedPath,
  loaded: true,
  exports: {
    deployCFIPFix: async () => { calls.deployCFIPFix += 1; return { ok: true } },
  },
}

// Need WHM_HOST + WHM_TOKEN env so the axios client is built
process.env.WHM_HOST = 'test-whm.example.com'
process.env.WHM_TOKEN = 'fake-token'

const heartbeat = require('../js/protection-heartbeat')

// In-memory cpanelAccounts collection
function makeDb() {
  const docs = new Map()
  return {
    collection: () => ({
      findOne: async (q, opts) => {
        const d = docs.get(q._id)
        if (!d) return null
        if (opts && opts.projection) {
          const out = { _id: d._id }
          for (const k of Object.keys(opts.projection)) if (opts.projection[k]) out[k] = d[k]
          return out
        }
        return d
      },
      updateOne: async (q, upd) => {
        const cur = docs.get(q._id) || { _id: q._id }
        Object.assign(cur, upd.$set || {})
        docs.set(q._id, cur)
        return { acknowledged: true }
      },
    }),
    _docs: docs,
  }
}

let passed = 0
let failed = 0
const assert = (cond, name) => {
  if (cond) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}`); failed++ }
}

async function run() {
  // Test 1: persisted counter on first repair
  console.log('\nTest 1: repair increments persisted counter in Mongo')
  const db = makeDb()
  heartbeat.init(db)

  const r1 = await heartbeat.checkAndRepair('cpuser1')
  assert(r1.action === 'repaired', `T1 action=repaired (got ${r1.action})`)
  const doc1 = db._docs.get('cpuser1')
  assert(doc1 && doc1.protectionRepairCount === 1, `T1 persisted count=1 (got ${doc1 && doc1.protectionRepairCount})`)

  // Test 2: counter survives "restart" — simulate by clearing the in-memory cache
  console.log('\nTest 2: counter is read from Mongo after restart (in-memory wipe)')
  // Inject a doc with count=3 (already maxed)
  db._docs.set('cpuser_stuck', {
    _id: 'cpuser_stuck',
    protectionRepairCount: heartbeat.MAX_CONSECUTIVE_REPAIRS,
  })
  // Reload module to wipe in-memory map
  delete require.cache[require.resolve('../js/protection-heartbeat')]
  const heartbeat2 = require('../js/protection-heartbeat')
  heartbeat2.init(db)

  const callsBefore = calls.whm
  const r2 = await heartbeat2.checkAndRepair('cpuser_stuck')
  assert(r2.action === 'skipped', `T2 action=skipped (got ${r2.action})`)
  assert(r2.reason === 'stuck_repair_loop', `T2 reason=stuck_repair_loop (got ${r2.reason})`)
  // No WHM call should have been made — the in-memory cache was wiped, so the
  // ONLY way the guard fires is by reading the persisted counter from Mongo.
  // (We accept that getRepairCount itself doesn't call WHM, so callsBefore == callsAfter.)
  assert(calls.whm === callsBefore, `T2 NO WHM calls for stuck account (got ${calls.whm - callsBefore} extra)`)

  // Test 3: getRepairCount + setRepairCount helpers persist correctly
  console.log('\nTest 3: getRepairCount / setRepairCount round-trip')
  await heartbeat2.setRepairCount('cpuser_manual', 2)
  const c = await heartbeat2.getRepairCount('cpuser_manual')
  assert(c === 2, `T3 round-trip persisted count=2 (got ${c})`)
  const doc3 = db._docs.get('cpuser_manual')
  assert(doc3.protectionRepairCount === 2, `T3 DB has count=2`)

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((e) => { console.error('Test runner crashed:', e); process.exit(2) })
