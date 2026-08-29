/* eslint-disable no-console */
/**
 * FIX 2 — WHM userdata self-heal test suite.
 *
 * Uses an in-process fake Mongo collection (no real DB, no network, no WHM).
 * Run with: node js/tests/test_whm_userdata_heal.js
 */

const fs = require('fs')
const path = require('path')
const heal = require('../whm-userdata-heal')

let pass = 0, fail = 0
function ok(name, cond, note = '') {
  if (cond) { pass++; console.log(`  \u2713 ${name}`) }
  else { fail++; console.log(`  \u2717 ${name} — ${note}`) }
}

// ── tiny Mongo-ish query matcher (supports $or,$ne,$exists,$lte, array eq) ──
function matchDoc(doc, query) {
  for (const [k, cond] of Object.entries(query)) {
    if (k === '$or') {
      if (!cond.some(sub => matchDoc(doc, sub))) return false
      continue
    }
    const val = doc[k]
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      for (const [op, opv] of Object.entries(cond)) {
        if (op === '$ne') { if (val === opv) return false }
        else if (op === '$exists') { if ((val !== undefined) !== opv) return false }
        else if (op === '$lte') { if (!(val <= opv)) return false }
        else if (op === '$gt') { if (!(val > opv)) return false }
        else return false
      }
    } else if (Array.isArray(val)) {
      if (!val.includes(cond)) return false
    } else if (val !== cond) {
      return false
    }
  }
  return true
}

class FakeCol {
  constructor(docs = []) { this.docs = docs.map(d => ({ ...d })) }
  async findOne(q) { return this.docs.find(d => matchDoc(d, q)) || null }
  find(q) {
    const res = this.docs.filter(d => matchDoc(d, q))
    return { limit: (n) => ({ toArray: async () => res.slice(0, n) }), toArray: async () => res }
  }
  async updateOne(filter, update) {
    const d = this.docs.find(x => matchDoc(x, filter))
    if (!d) return { matchedCount: 0 }
    if (update.$set) Object.assign(d, update.$set)
    if (update.$unset) for (const key of Object.keys(update.$unset)) delete d[key]
    if (update.$inc) for (const [key, v] of Object.entries(update.$inc)) d[key] = (d[key] || 0) + v
    return { matchedCount: 1 }
  }
}
const fakeDb = (cols) => ({ collection: (name) => cols[name] })

// whmService stub: `behavior` maps cpUser → bool (or throws). Tracks calls.
function makeWhm(behavior) {
  const calls = []
  return {
    calls,
    terminateAccount: async (cpUser) => {
      calls.push(cpUser)
      const b = typeof behavior === 'function' ? behavior(cpUser) : behavior[cpUser]
      if (b === 'throw') throw new Error('WHM boom')
      return !!b
    },
  }
}

;(async () => {
  // ── 1. isStaleUserdataError ──
  console.log('\n1. isStaleUserdataError')
  ok('positive: raw cPanel userdata msg', heal.isStaleUserdataError('The domain "x.com" already exists in the userdata'))
  ok('positive: lowercase userdata msg', heal.isStaleUserdataError('domain already exists in the userdata'))
  ok('positive: bare "already exists"', heal.isStaleUserdataError('Domain "x.com" already exists'))
  ok('negative: unrelated error', !heal.isStaleUserdataError('Some unrelated failure'))
  ok('negative: empty string', !heal.isStaleUserdataError(''))
  ok('negative: null', !heal.isStaleUserdataError(null))
  ok('negative: undefined', !heal.isStaleUserdataError(undefined))

  // ── 2. attemptStaleTerminate ──
  console.log('\n2. attemptStaleTerminate')
  // A. success
  {
    const col = new FakeCol([{ _id: 1, cpUser: 'u1', deleted: true, whmTerminatePending: true, whmTerminateRetryCount: 2 }])
    const whm = makeWhm({ u1: true })
    const r = await heal.attemptStaleTerminate({ db: fakeDb({ cpanelAccounts: col }), whmService: whm, account: col.docs[0] })
    ok('A: ok=true', r.ok === true)
    ok('A: cleared=true', r.cleared === true)
    ok('A: terminatedOnWhm set', col.docs[0].terminatedOnWhm === true)
    ok('A: whmTerminatePending unset', col.docs[0].whmTerminatePending === undefined)
    ok('A: whmTerminateRetryCount cleared', col.docs[0].whmTerminateRetryCount === undefined)
  }
  // B. failure → still pending, retry count +1
  {
    const col = new FakeCol([{ _id: 2, cpUser: 'u2', deleted: true }])
    const whm = makeWhm({ u2: false })
    const r = await heal.attemptStaleTerminate({ db: fakeDb({ cpanelAccounts: col }), whmService: whm, account: col.docs[0] })
    ok('B: ok=false', r.ok === false)
    ok('B: retriesUsed=1', r.retriesUsed === 1)
    ok('B: whmTerminatePending=true', col.docs[0].whmTerminatePending === true)
    ok('B: whmTerminateRetryCount incremented to 1', col.docs[0].whmTerminateRetryCount === 1)
  }
  // C. deleted:false → refuses, never calls WHM
  {
    const col = new FakeCol([{ _id: 3, cpUser: 'u3', deleted: false }])
    const whm = makeWhm({ u3: true })
    const r = await heal.attemptStaleTerminate({ db: fakeDb({ cpanelAccounts: col }), whmService: whm, account: col.docs[0] })
    ok('C: ok=false', r.ok === false)
    ok('C: reason=not-deleted', r.reason === 'not-deleted')
    ok('C: WHM never called', whm.calls.length === 0)
  }
  // D. historical stuck row (deleted:true, NO pending flag) → retried + cleared
  {
    const col = new FakeCol([{ _id: 4, cpUser: 'u4', deleted: true }]) // no whmTerminatePending
    const whm = makeWhm({ u4: true })
    const r = await heal.attemptStaleTerminate({ db: fakeDb({ cpanelAccounts: col }), whmService: whm, account: col.docs[0] })
    ok('D: historical row IS retried (WHM called)', whm.calls.length === 1)
    ok('D: cleared=true', r.cleared === true)
  }
  // D2. terminatedOnWhm:true → short-circuits, never calls WHM
  {
    const col = new FakeCol([{ _id: 5, cpUser: 'u5', deleted: true, terminatedOnWhm: true }])
    const whm = makeWhm({ u5: true })
    const r = await heal.attemptStaleTerminate({ db: fakeDb({ cpanelAccounts: col }), whmService: whm, account: col.docs[0] })
    ok('D2: cleared=false (short-circuit)', r.cleared === false)
    ok('D2: reason=already-terminated', r.reason === 'already-terminated')
    ok('D2: WHM never called', whm.calls.length === 0)
  }
  // throw → treated as failure
  {
    const col = new FakeCol([{ _id: 6, cpUser: 'u6', deleted: true }])
    const whm = makeWhm({ u6: 'throw' })
    const r = await heal.attemptStaleTerminate({ db: fakeDb({ cpanelAccounts: col }), whmService: whm, account: col.docs[0] })
    ok('throw handled as failure (ok=false)', r.ok === false && col.docs[0].whmTerminatePending === true)
  }

  // ── 3. attemptUserdataRelease ──
  console.log('\n3. attemptUserdataRelease')
  // E. same-chatId, primary-domain match → released
  {
    const col = new FakeCol([{ _id: 10, cpUser: 'stale1', chatId: '123', deleted: true, domain: 'x.com' }])
    const whm = makeWhm({ stale1: true })
    const r = await heal.attemptUserdataRelease({ db: fakeDb({ cpanelAccounts: col }), whmService: whm, domain: 'X.com', chatId: 123 })
    ok('E: released=true', r.released === true)
    ok('E: staleCpUser=stale1', r.staleCpUser === 'stale1')
  }
  // E2. same-chatId, addonDomains array match → released
  {
    const col = new FakeCol([{ _id: 11, cpUser: 'stale2', chatId: '123', deleted: true, domain: 'main.com', addonDomains: ['y.com'] }])
    const whm = makeWhm({ stale2: true })
    const r = await heal.attemptUserdataRelease({ db: fakeDb({ cpanelAccounts: col }), whmService: whm, domain: 'y.com', chatId: '123' })
    ok('E2: addonDomains array match released', r.released === true && r.staleCpUser === 'stale2')
  }
  // F. DIFFERENT chatId → released:false, WHM NEVER called (cross-user leak guard)
  {
    const col = new FakeCol([{ _id: 12, cpUser: 'other', chatId: '999', deleted: true, domain: 'x.com' }])
    const whm = makeWhm({ other: true })
    const r = await heal.attemptUserdataRelease({ db: fakeDb({ cpanelAccounts: col }), whmService: whm, domain: 'x.com', chatId: '123' })
    ok('F: released=false', r.released === false)
    ok('F: reason=no-stale-owner-under-same-chatid', r.reason === 'no-stale-owner-under-same-chatid')
    ok('F: CROSS-USER GUARD — WHM never called', whm.calls.length === 0)
  }
  // G. no stale row
  {
    const col = new FakeCol([])
    const whm = makeWhm({})
    const r = await heal.attemptUserdataRelease({ db: fakeDb({ cpanelAccounts: col }), whmService: whm, domain: 'x.com', chatId: '123' })
    ok('G: released=false', r.released === false)
    ok('G: reason=no-stale-owner-under-same-chatid', r.reason === 'no-stale-owner-under-same-chatid')
  }
  // H. missing args
  {
    const col = new FakeCol([])
    const whm = makeWhm({})
    const r = await heal.attemptUserdataRelease({ db: fakeDb({ cpanelAccounts: col }), whmService: whm, domain: undefined, chatId: '123' })
    ok('H: released=false', r.released === false)
    ok('H: reason=missing-args', r.reason === 'missing-args')
  }

  // ── 4. runSelfHealSweep ──
  console.log('\n4. runSelfHealSweep')
  {
    const col = new FakeCol([
      { _id: 20, cpUser: 'a', deleted: true, whmTerminatePending: true },                       // clears
      { _id: 21, cpUser: 'b', deleted: true, whmTerminatePending: true },                       // still fails
      { _id: 22, cpUser: 'c', deleted: true, whmTerminatePending: true, terminatedOnWhm: true },// excluded by query
    ])
    const whm = makeWhm({ a: true, b: false, c: true })
    const r = await heal.runSelfHealSweep({ db: fakeDb({ cpanelAccounts: col }), whmService: whm })
    ok('sweep scanned=2 (terminatedOnWhm row excluded)', r.scanned === 2)
    ok('sweep cleared=1', r.cleared === 1)
    ok('sweep stillPending=1', r.stillPending === 1)
    ok('sweep cleared row now terminatedOnWhm', col.docs[0].terminatedOnWhm === true)
    ok('sweep failed row retry count incremented', col.docs[1].whmTerminateRetryCount === 1)
    ok('sweep never touched the terminatedOnWhm row', whm.calls.indexOf('c') === -1)
  }

  // ── 5. Static wiring guards ──
  console.log('\n5. Static wiring guards')
  const sched = fs.readFileSync(path.join(__dirname, '..', 'hosting-scheduler.js'), 'utf8')
  const addon = fs.readFileSync(path.join(__dirname, '..', 'addon-domain-flow.js'), 'utf8')
  const idx = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

  ok('scheduler grace path flags whmTerminatePending on !terminated',
    /if \(!terminated\) \{[\s\S]*?updateFields\.whmTerminatePending = true/.test(sched))
  ok('scheduler startup path flags whmTerminatePending on !terminated',
    /if \(!terminated\) \{[\s\S]*?updateFields2\.whmTerminatePending = true/.test(sched))
  ok('scheduler registers runSelfHealSweep', /runSelfHealSweep/.test(sched))
  ok('scheduler gates sweep on BOT_ENVIRONMENT === production',
    /BOT_ENVIRONMENT[^\n]*toLowerCase\(\) === 'production'/.test(sched))
  ok('scheduler logs a SKIP when not production', /whm-userdata-heal sweep SKIPPED/.test(sched))
  ok('notifyAdmin helper reads TELEGRAM_ADMIN_CHAT_ID', /process\.env\.TELEGRAM_ADMIN_CHAT_ID/.test(sched))

  ok('addon-flow imports the heal module', /require\('\.\/whm-userdata-heal'\)/.test(addon))
  ok('addon-flow uses isStaleUserdataError', /isStaleUserdataError/.test(addon))
  ok('addon-flow passes chatId: account.chatId (not a constant)', /chatId: account\.chatId/.test(addon))
  ok('addon-flow retries cpProxy.addAddonDomain after release',
    /release\.released[\s\S]*?result = await cpProxy\.addAddonDomain/.test(addon))

  ok('change-primary imports the heal module', /require\('\.\/whm-userdata-heal'\)/.test(idx))
  ok('change-primary passes String(chatId)', /attemptUserdataRelease\(\{[\s\S]*?chatId: String\(chatId\)/.test(idx))
  ok('change-primary retries whmService.changePrimaryDomain after release',
    /release\.released[\s\S]*?result = await whmService\.changePrimaryDomain/.test(idx))

  console.log(`\nFIX 2 self-heal suite: ${pass} passed, ${fail} failed (total ${pass + fail})`)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('SUITE CRASH:', e); process.exit(1) })
