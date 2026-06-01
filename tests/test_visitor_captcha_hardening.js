// Validates the 3 Visitor-Captcha hardening fixes shipped 2026-02 in response
// to the Railway log analysis of verify-navy.com (user @Night_ismine).
//
//   Fix #1 — Honest toast text in lang/en|fr|hi|zh.js. Old text falsely
//            claimed "Other security layers (IP cloaking, UA blocking) remain
//            active" after disabling.
//   Fix #2 — Typed `DISABLE` confirm. The "Turn OFF" button must NOT
//            immediately tear down protection.
//   Fix #3 — 24h auto re-enable sweep in protection-enforcer.js. Domains
//            where `val.antiRedOff=true AND val.antiRedOffAt <= now-24h`
//            must be auto-re-enabled.
//
// Run with:  node tests/test_visitor_captcha_hardening.js
//
// We don't boot the real bot. We stub anti-red-service so deploySharedWorkerRoute
// is a no-op that just reports success.

'use strict'

const fs = require('fs')
const path = require('path')

let passed = 0
let failed = 0
const assert = (cond, name) => {
  if (cond) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}`); failed++ }
}

// ── Fix #1: honest toast text in all 4 languages ─────────────────────────
console.log('\nTest A: honest toast text in lang/{en,fr,hi,zh}.js')

const langs = ['en', 'fr', 'hi', 'zh']
const oldFalseClaims = [
  /Other security layers \(IP cloaking, UA blocking\) remain active/i,
  /Les autres couches de sécurité.*restent actives/i,
  /अन्य सुरक्षा परतें.*सक्रिय रहेंगी/,
  /其他安全层.*仍然有效/,
]

for (const lang of langs) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'lang', `${lang}.js`), 'utf8')
  // None of the old false claims should be present any more
  const falsePresent = oldFalseClaims.find((rx) => rx.test(src))
  assert(!falsePresent,
    `A.${lang}: old "other security layers remain active" claim removed`)
  // New strings present
  assert(src.indexOf('antiRedDisableConfirm') >= 0,
    `A.${lang}: antiRedDisableConfirm prompt added`)
  assert(src.indexOf('antiRedDisableConfirmWrong') >= 0,
    `A.${lang}: antiRedDisableConfirmWrong message added`)
  assert(src.indexOf('antiRedAutoReenabled') >= 0,
    `A.${lang}: antiRedAutoReenabled message added`)
  assert(/24\s*h|24 घंटे|24 小时|24 heures/i.test(src),
    `A.${lang}: 24h grace period mentioned`)
}

// ── Fix #2: typed-DISABLE confirm wiring in _index.js ────────────────────
console.log('\nTest B: _index.js requires typed `DISABLE` to disable Visitor Captcha')

const idx = fs.readFileSync(path.join(__dirname, '..', 'js', '_index.js'), 'utf8')

assert(idx.indexOf("'anti-red-disable-confirm'") >= 0,
  'B.1 new state `anti-red-disable-confirm` added')
assert(/if \(message !== 'DISABLE'\)/.test(idx),
  'B.2 handler checks message !== \'DISABLE\' (capitals required)')
assert(idx.indexOf("'val.antiRedOffAt': new Date()") >= 0,
  'B.3 disable path writes `val.antiRedOffAt` timestamp')
// Verify the OLD immediate-disable handler is gone (no `removeWorkerRoutes`
// call directly under `if (message === t.antiRedTurnOff)`).
{
  const idxOff = idx.indexOf('if (message === t.antiRedTurnOff)')
  const slice = idx.slice(idxOff, idxOff + 600)
  assert(!/removeWorkerRoutes/.test(slice),
    'B.4 `Turn OFF` button no longer calls removeWorkerRoutes directly (goes via confirm step)')
  assert(/anti-red-disable-confirm/.test(slice),
    'B.5 `Turn OFF` button now routes to `anti-red-disable-confirm` state')
}

// ── Fix #2 alt: cpanel-routes.js also writes the timestamp ──────────────
const routes = fs.readFileSync(path.join(__dirname, '..', 'js', 'cpanel-routes.js'), 'utf8')
assert(routes.indexOf("'val.antiRedOffAt': new Date()") >= 0,
  'B.6 cpanel-routes.js disable path also writes `val.antiRedOffAt`')
assert(routes.indexOf("'val.antiRedOffAt': ''") >= 0,
  'B.7 cpanel-routes.js enable path clears both `antiRedOff` AND `antiRedOffAt`')

// ── Fix #3: 24h auto re-enable sweep ─────────────────────────────────────
console.log('\nTest C: protection-enforcer.js exposes runAntiRedAutoReenable')

const enforcer = require('../js/protection-enforcer')
assert(typeof enforcer.runAntiRedAutoReenable === 'function',
  'C.1 runAntiRedAutoReenable exported')

// Stub anti-red-service so deploySharedWorkerRoute is a no-op
const antiRedPath = require.resolve('../js/anti-red-service')
require.cache[antiRedPath] = {
  id: antiRedPath, filename: antiRedPath, loaded: true,
  exports: {
    deploySharedWorkerRoute: async () => ({ success: true }),
    setDomainChallengeBypass: async () => true,
  },
}
// Force the cached enforcer's `antiRed` require to pick up the stub
delete require.cache[require.resolve('../js/protection-enforcer')]
const enforcer2 = require('../js/protection-enforcer')

// In-memory Mongo with three test docs
function makeDb(docs) {
  const map = new Map(docs.map((d) => [d._id, d]))
  return {
    collection: (n) => ({
      find: (q) => ({
        toArray: async () => {
          const out = []
          for (const d of map.values()) {
            // Naïve evaluator for the exact query used by runAntiRedAutoReenable
            if (n !== 'registeredDomains') continue
            if (d.val?.antiRedOff !== true) continue
            const cutoff = q['val.antiRedOffAt']?.$lte
            if (cutoff && d.val?.antiRedOffAt && d.val.antiRedOffAt > cutoff) continue
            out.push(d)
          }
          return out
        },
      }),
      findOne: async (q) => {
        if (n === 'users') return null  // no telegram notify in test
        return map.get(q._id) || null
      },
      updateOne: async (q, upd) => {
        const cur = map.get(q._id)
        if (!cur) return { acknowledged: true }
        if (upd.$unset) {
          for (const k of Object.keys(upd.$unset)) {
            // Support dotted path like 'val.antiRedOff'
            const parts = k.split('.')
            let obj = cur
            for (let i = 0; i < parts.length - 1; i++) obj = obj?.[parts[i]]
            if (obj) delete obj[parts[parts.length - 1]]
          }
        }
        return { acknowledged: true }
      },
    }),
    _docs: map,
  }
}

;(async () => {
  // Build 3 docs:
  //   A: antiRedOff=true, offAt = 30h ago → must be re-enabled
  //   B: antiRedOff=true, offAt = 1h ago → MUST NOT be re-enabled (still in grace)
  //   C: antiRedOff=false → never touched
  const HOUR = 60 * 60 * 1000
  const docs = [
    { _id: 'old.com',    val: { antiRedOff: true,  antiRedOffAt: new Date(Date.now() - 30 * HOUR), cfZoneId: 'zoneA', ownerChatId: 111 } },
    { _id: 'fresh.com',  val: { antiRedOff: true,  antiRedOffAt: new Date(Date.now() - 1  * HOUR), cfZoneId: 'zoneB', ownerChatId: 222 } },
    { _id: 'never.com',  val: { antiRedOff: false, cfZoneId: 'zoneC', ownerChatId: 333 } },
  ]
  const db = makeDb(docs)
  enforcer2.init(db)

  const r = await enforcer2.runAntiRedAutoReenable()
  assert(r.processed === 1, `C.2 only 1 domain processed (old.com) — got ${r.processed}`)
  assert(r.reenabled === 1, `C.3 1 domain re-enabled — got ${r.reenabled}`)
  assert(r.errors === 0,    `C.4 no errors — got ${r.errors}`)
  assert(r.domains.includes('old.com'), `C.5 old.com is in re-enabled list`)
  assert(!r.domains.includes('fresh.com'), `C.6 fresh.com NOT re-enabled (still in grace)`)

  // After re-enable, old.com's antiRedOff/antiRedOffAt flags must be gone
  const oldDoc = db._docs.get('old.com')
  assert(oldDoc.val.antiRedOff === undefined, `C.7 old.com.val.antiRedOff cleared`)
  assert(oldDoc.val.antiRedOffAt === undefined, `C.8 old.com.val.antiRedOffAt cleared`)
  // fresh.com still has both
  const freshDoc = db._docs.get('fresh.com')
  assert(freshDoc.val.antiRedOff === true, `C.9 fresh.com still has antiRedOff=true`)

  // Empty re-run should not throw and processed=0
  const r2 = await enforcer2.runAntiRedAutoReenable()
  assert(r2.processed === 0, `C.10 idempotent — second sweep finds 0 candidates`)

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => { console.error('runner crash:', e); process.exit(2) })
