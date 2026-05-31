// Validates the DnsHealer fixes (2026-02):
//   1) Attempts counter is NOT reset by a single healthy probe — only when
//      the domain is truly "stable" (consecutiveHealthy >= STABLE_THRESHOLD).
//      Previously a flapping domain logged "attempt 1/3" forever and never
//      escalated.
//   2) Once `status === 'escalated'`, the worker NEVER re-enters attemptHeal()
//      from the regular tick path, even if attempts somehow drifts back below
//      MAX_ATTEMPTS.
//
// Run with:  node tests/test_dns_healer_fixes.js
//
// We don't boot Mongo / OP service. Instead we monkey-patch dns-checker +
// op-service modules in the require cache so the healer's probe + heal
// calls are fully synthetic.

'use strict'

const path = require('path')

// ── Stub dns-checker and op-service BEFORE requiring dns-healer ──
const dnsCheckerPath = require.resolve('../js/dns-checker')
const opServicePath = require.resolve('../js/op-service')

let nextProbe = { healthy: false, ns: [], a: [] }  // controllable test state
let healCallsThisTick = 0

require.cache[dnsCheckerPath] = {
  id: dnsCheckerPath,
  filename: dnsCheckerPath,
  loaded: true,
  exports: {
    resolve: async (_domain, type) => {
      if (type === 'NS') return { answers: nextProbe.ns.map((d) => ({ data: d })) }
      if (type === 'A') return { answers: nextProbe.a.map((d) => ({ data: d })) }
      return { answers: [] }
    },
  },
}

require.cache[opServicePath] = {
  id: opServicePath,
  filename: opServicePath,
  loaded: true,
  exports: {
    disableDnssec: async () => true,
    updateNameservers: async () => {
      healCallsThisTick += 1
      return { ok: true }
    },
  },
}

const healer = require('../js/dns-healer')

// ── Tiny in-memory Mongo stub ──
function makeCol() {
  const docs = new Map()
  return {
    findOne: async (q) => docs.get(q._id) || null,
    updateOne: async (q, upd) => {
      const cur = docs.get(q._id) || { _id: q._id }
      Object.assign(cur, upd.$set || {})
      docs.set(q._id, cur)
      return { acknowledged: true }
    },
    find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => [...docs.values()] }) }) }),
    _all: () => [...docs.values()],
    _set: (id, doc) => docs.set(id, { _id: id, ...doc }),
  }
}

function makeDb(reg) {
  const stateCol = makeCol()
  const regCol = makeCol()
  for (const [id, val] of Object.entries(reg)) regCol._set(id, val)
  return {
    collection: (n) => (n === 'dnsHealState' ? stateCol : regCol),
    _stateCol: stateCol,
    _regCol: regCol,
  }
}

const DOMAIN = 'example.com'   // .com → NOT a pre-delegation TLD
const CF_NS = ['kim.ns.cloudflare.com', 'walt.ns.cloudflare.com']

const reg = {
  [DOMAIN]: {
    _id: DOMAIN,
    val: {
      nameserverType: 'cloudflare',
      nameservers: CF_NS,
      status: 'registered',
      ownerChatId: 12345,
      registeredAt: new Date(),
    },
  },
}

let passed = 0
let failed = 0
const assert = (cond, name) => {
  if (cond) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}`); failed++ }
}

async function run() {
  const db = makeDb(reg)
  const stateCol = db._stateCol
  const regCol = db._regCol
  const { processDomain } = healer._internals

  // ── Test 1: flapping domain MUST eventually escalate ───────────────────
  console.log('\nTest 1: flapping domain advances attempts (does not reset on each healthy blip)')

  // Tick 1: healthy → status='healthy', consecutiveHealthy=1, attempts=0
  nextProbe = { healthy: true, ns: CF_NS.map((n) => n.toLowerCase()), a: ['1.2.3.4'] }
  await processDomain(db, { _id: DOMAIN, status: 'unknown', attempts: 0, consecutiveHealthy: 0 }, regCol, stateCol)
  let s = await stateCol.findOne({ _id: DOMAIN })
  assert(s.status === 'healthy', `T1.1 status=healthy after first healthy probe (got ${s.status})`)
  assert((s.attempts || 0) === 0, `T1.1 attempts=0 (got ${s.attempts})`)

  // Tick 2: unhealthy (first time after healthy) → grace path → status='unhealthy', attempts still 0
  nextProbe = { healthy: false, ns: [], a: ['9.9.9.9'] }
  await processDomain(db, s, regCol, stateCol)
  s = await stateCol.findOne({ _id: DOMAIN })
  assert(s.status === 'unhealthy', `T1.2 grace path → unhealthy (got ${s.status})`)
  assert((s.attempts || 0) === 0, `T1.2 attempts not bumped in grace (got ${s.attempts})`)

  // Tick 3: unhealthy again → heal called → attempts=1, status='healing'
  healCallsThisTick = 0
  await processDomain(db, s, regCol, stateCol)
  s = await stateCol.findOne({ _id: DOMAIN })
  assert(s.attempts === 1, `T1.3 attempts=1 after first heal (got ${s.attempts})`)
  assert(healCallsThisTick === 1, `T1.3 attemptHeal called once`)

  // Tick 4: SUDDEN healthy blip → with fix, attempts MUST stay at 1 (not reset)
  nextProbe = { healthy: true, ns: CF_NS.map((n) => n.toLowerCase()), a: ['1.2.3.4'] }
  await processDomain(db, s, regCol, stateCol)
  s = await stateCol.findOne({ _id: DOMAIN })
  assert(s.attempts === 1, `T1.4 attempts preserved across single healthy probe (got ${s.attempts}) — THE BUG FIX`)
  assert(s.status === 'healthy', `T1.4 status=healthy`)

  // Tick 5: unhealthy again → grace? NO, isFirstUnhealthy=true since status=healthy, so grace fires
  nextProbe = { healthy: false, ns: [], a: ['9.9.9.9'] }
  await processDomain(db, s, regCol, stateCol)
  s = await stateCol.findOne({ _id: DOMAIN })
  assert(s.status === 'unhealthy', `T1.5 status=unhealthy after flip back to unhealthy`)
  assert(s.attempts === 1, `T1.5 attempts still 1 (grace doesn't bump) (got ${s.attempts})`)

  // Tick 6: unhealthy again → heal → attempts=2
  healCallsThisTick = 0
  await processDomain(db, s, regCol, stateCol)
  s = await stateCol.findOne({ _id: DOMAIN })
  assert(s.attempts === 2, `T1.6 attempts=2 after 2nd heal (got ${s.attempts})`)

  // Tick 7: unhealthy → heal → attempts=3, status=healing (heal.ok=true so not escalated yet)
  healCallsThisTick = 0
  await processDomain(db, s, regCol, stateCol)
  s = await stateCol.findOne({ _id: DOMAIN })
  assert(s.attempts === 3, `T1.7 attempts=3 (got ${s.attempts})`)

  // Tick 8: now attempts=3 >= MAX_ATTEMPTS → escalated, no heal call
  healCallsThisTick = 0
  await processDomain(db, s, regCol, stateCol)
  s = await stateCol.findOne({ _id: DOMAIN })
  assert(s.status === 'escalated', `T1.8 status=escalated when attempts=3 (got ${s.status})`)
  assert(healCallsThisTick === 0, `T1.8 attemptHeal NOT called once escalated (got ${healCallsThisTick})`)

  // ── Test 2: once escalated, even a manual drift back below MAX cannot
  // re-enter the heal path because status==='escalated' clamps it. ──────
  console.log('\nTest 2: escalated state is sticky (no re-heal even with low attempts)')
  await stateCol.updateOne({ _id: DOMAIN }, { $set: { attempts: 1, status: 'escalated' } })
  s = await stateCol.findOne({ _id: DOMAIN })
  nextProbe = { healthy: false, ns: [], a: ['9.9.9.9'] }
  healCallsThisTick = 0
  await processDomain(db, s, regCol, stateCol)
  s = await stateCol.findOne({ _id: DOMAIN })
  assert(s.status === 'escalated', `T2 status remains escalated (got ${s.status})`)
  assert(healCallsThisTick === 0, `T2 attemptHeal NOT called (got ${healCallsThisTick})`)

  // ── Test 3: stable threshold DOES reset attempts (3 consecutive healthy) ─
  console.log('\nTest 3: stable status (3 consecutive healthy) resets attempts to 0')
  await stateCol.updateOne({ _id: DOMAIN }, { $set: { attempts: 2, status: 'healing', consecutiveHealthy: 0 } })
  nextProbe = { healthy: true, ns: CF_NS.map((n) => n.toLowerCase()), a: ['1.2.3.4'] }
  for (let i = 0; i < 3; i++) {
    s = await stateCol.findOne({ _id: DOMAIN })
    await processDomain(db, s, regCol, stateCol)
  }
  s = await stateCol.findOne({ _id: DOMAIN })
  assert(s.status === 'stable', `T3 status=stable after 3 healthy probes (got ${s.status})`)
  assert(s.attempts === 0, `T3 attempts reset to 0 once stable (got ${s.attempts})`)

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((e) => { console.error('Test runner crashed:', e); process.exit(2) })
