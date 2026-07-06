/**
 * Regression test — @HHR2009 "credentials never delivered but bot said they were"
 * fix (2026-07-06). Prod incident: Railway deploy e548e95d, chatId 1960615421,
 * domain paperlesseviteguestreview.com. cPanel license expired mid-flight →
 * WHM createAccount returned CPANEL_DOWN → provisioning function re-enqueued
 * the job and returned `{ success: true, queued: true }` → queue handler
 * treated that as success → marked job DONE and DM'd the user
 * "🎉 Login details have been delivered above" — a lie, since no cPanel
 * account was created and no credentials were sent. Job stayed done forever;
 * on manual reset, the exact same false-success chain fired again.
 *
 * This suite pins the fixed contract:
 *   1. registerDomainAndCreateCpanel's mid-flight WHM-DOWN path returns
 *      { success: false, queued: true, deferred: true, code: 'CPANEL_DOWN' }
 *      instead of the historic { success: true, queued: true }.
 *   2. The provision handler in cpanel-job-handlers.js classifies
 *      queued+deferred as `{ ok: false, deferred: true }` (retry later,
 *      keep job pending) — NOT `{ ok: true }`.
 *   3. The handler does NOT send the "🎉 delivered above" confirmation on
 *      the deferred path.
 *   4. Regression sanity for the /files/mkdir @hellpeaces fix from the
 *      previous session — its wiring is still intact (untouched by this
 *      change).
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')

let failures = 0
function check(name, cond, detail) {
  if (cond) console.log(`  ✅ ${name}`)
  else { failures++; console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}

// ─── 1. Static assertion on cr-register-domain-&-create-cpanel.js ───
console.log('\n[1] cr-register-domain-&-create-cpanel.js mid-flight return value')
const crSrc = fs.readFileSync(path.join(__dirname, '..', 'cr-register-domain-&-create-cpanel.js'), 'utf8')

// The historic buggy return literal MUST be gone.
const buggyRxMidflight = /if \(!result\.success && result\.code === 'CPANEL_DOWN'\)[\s\S]{0,2000}?return\s*\{\s*success:\s*true,\s*queued:\s*true\s*\}/
check('OLD buggy mid-flight `return { success: true, queued: true }` is gone',
  !buggyRxMidflight.test(crSrc))

// New return value must include success:false + queued:true + deferred:true + code:CPANEL_DOWN
const fixedRx = /if \(!result\.success && result\.code === 'CPANEL_DOWN'\)[\s\S]{0,2500}?return\s*\{[\s\S]{0,200}?success:\s*false[\s\S]{0,200}?queued:\s*true[\s\S]{0,200}?deferred:\s*true[\s\S]{0,200}?code:\s*['"]CPANEL_DOWN['"]/
check('NEW mid-flight return contains success:false + queued:true + deferred:true + code:CPANEL_DOWN',
  fixedRx.test(crSrc))

// The @HHR2009 attribution anchor should be present so future readers know why this shape matters
check('mid-flight fix references @HHR2009 attribution', /HHR2009/i.test(crSrc))

// Preflight (info._fromQueue === false) return is deliberately still {success:true,queued:true}
// because the interactive purchase caller uses it and never re-enters via the queue worker.
// We assert the guard `if (!info._fromQueue)` still wraps that path.
check('preflight enqueue is still guarded by !info._fromQueue',
  /if \(!info\._fromQueue\)[\s\S]{0,3000}?enqueue\s*\(/.test(crSrc))

// The mid-flight branch must NOT resend the "your hosting is being prepared"
// message when re-entered from the queue worker (info._fromQueue === true) —
// prevents the noisy loop that would otherwise spam the user every 30s.
const guardRx = /if \(!info\._fromQueue\)\s*\{\s*const queuedMsg = \(QUEUED_PROVISIONING_MSG/
check('mid-flight suppresses the "preparing" DM on re-entry (`!info._fromQueue` guard)',
  guardRx.test(crSrc))

// ─── 2. Static assertion on cpanel-job-handlers.js ───
console.log('\n[2] cpanel-job-handlers.js provision handler deferred branch')
const hSrc = fs.readFileSync(path.join(__dirname, '..', 'cpanel-job-handlers.js'), 'utf8')

check('handler contains explicit `result.queued === true` classifier',
  /result\?\.queued\s*===\s*true/.test(hSrc))
check('handler classifies deferred as { ok: false, deferred: true, reason: ... }',
  /return\s*\{\s*ok:\s*false,\s*deferred:\s*true,\s*reason:\s*result\.code[\s\S]{0,100}\}/.test(hSrc))
check('handler references @HHR2009 attribution',
  /HHR2009/i.test(hSrc))

// Critical: the "🎉 delivered above" confirmation (COPY.provisionDone) MUST
// only fire on the true-success path, AFTER the deferred check.
const provisionDoneIdx = hSrc.indexOf('msg(COPY.provisionDone')
const deferredCheckIdx = hSrc.search(/result\?\.queued\s*===\s*true/)
check('deferred check is BEFORE the provisionDone DM (no false "delivered above")',
  deferredCheckIdx > -1 && provisionDoneIdx > -1 && deferredCheckIdx < provisionDoneIdx)

// ─── 3. Behavioural: load-and-invoke the handler with a mock ───
console.log('\n[3] Behavioural: handler classifies queued+deferred as deferred')

// Fake deps + fake `registerDomainAndCreateCpanel` via require.cache injection.
// We poke the cache before requiring the handlers module so its lazy require
// picks up the mock.
const registerModulePath = require.resolve('../cr-register-domain-&-create-cpanel')
const originalCache = require.cache[registerModulePath]
let sentMessages = []
function fakeSend(chatId, message) { sentMessages.push({ chatId, message: String(message).slice(0, 200) }) }

// Mock returns the exact new-shape response — the historic buggy shape
// used success:true, this new shape uses success:false.
require.cache[registerModulePath] = {
  id: registerModulePath,
  filename: registerModulePath,
  loaded: true,
  exports: {
    registerDomainAndCreateCpanel: async () => ({
      success: false,
      queued: true,
      deferred: true,
      code: 'CPANEL_DOWN',
      domainRegistered: true,
    }),
  },
}

// Isolate the queue module so `registerHandler` captures our handler cleanly.
delete require.cache[require.resolve('../cpanel-job-queue')]
const q = require('../cpanel-job-queue')
delete require.cache[require.resolve('../cpanel-job-handlers')]
require('../cpanel-job-handlers') // registers 'provision' handler via side-effect

// Reach into the queue module to get the handler map. Not public API, but
// this test is regression-scoped.
// Cheapest hook: emulate what drain does — pull the handler by monkey-poking
// the registerHandler behaviour. Since we can't easily peek the private
// map, we instead call registerHandler ourselves to capture it.
let capturedHandler = null
const origRegister = q.registerHandler
q.registerHandler = (type, fn) => {
  if (type === 'provision') capturedHandler = fn
  return origRegister.call(q, type, fn)
}
// Re-load handlers so registerHandler is captured this time
delete require.cache[require.resolve('../cpanel-job-handlers')]
require('../cpanel-job-handlers')

;(async () => {
  const fakeDb = { collection: () => ({}) }
  const fakeJob = {
    _id: 'test-job-1',
    chatId: '1960615421',
    lang: 'en',
    domain: 'paperlesseviteguestreview.com',
    params: { info: { _id: '1960615421', website_name: 'paperlesseviteguestreview.com', _fromQueue: true, plan: 'Premium Anti-Red (1-Week)' } },
  }
  const fakeDeps = { db: fakeDb, send: fakeSend, notifyAdmin: () => {}, rem: {} }

  const res = await capturedHandler({ job: fakeJob, deps: fakeDeps })
  check('handler returned { ok: false } on queued+deferred', res && res.ok === false)
  check('handler returned deferred: true', res && res.deferred === true)
  check('handler reason contains CPANEL_DOWN', res && /CPANEL_DOWN/.test(String(res.reason || '')))
  check('handler did NOT DM the user any "delivered above" message',
    !sentMessages.some(m => /delivered above|delivered_above|hosting.*ready|Login details/i.test(m.message || '')))

  // Also verify the OLD buggy shape (success:true, queued:true) still classifies
  // as deferred — defence in depth: even if a caller regresses to the old
  // literal, the handler should refuse to mark the job done.
  require.cache[registerModulePath].exports = {
    registerDomainAndCreateCpanel: async () => ({ success: true, queued: true }),
  }
  sentMessages = []
  const res2 = await capturedHandler({ job: fakeJob, deps: fakeDeps })
  check('handler still classifies { success:true, queued:true } as deferred (defense-in-depth)',
    res2 && res2.ok === false && res2.deferred === true)
  check('handler did NOT DM "delivered above" for the legacy buggy shape either',
    !sentMessages.some(m => /delivered above|delivered_above|hosting.*ready|Login details/i.test(m.message || '')))

  // True-success path still returns { ok: true } and DMs the confirmation.
  require.cache[registerModulePath].exports = {
    registerDomainAndCreateCpanel: async () => ({ success: true }),
  }
  sentMessages = []
  const res3 = await capturedHandler({ job: fakeJob, deps: fakeDeps })
  check('handler still returns { ok: true } on true success',
    res3 && res3.ok === true)
  check('handler DOES DM the "🎉 ready / delivered above" confirmation on true success',
    sentMessages.some(m => /delivered above|hosting.*ready|Login details/i.test(m.message || '')))

  // Restore cache
  if (originalCache) require.cache[registerModulePath] = originalCache
  else delete require.cache[registerModulePath]

  // ─── 4. Regression sanity: @hellpeaces mkdir fix still in place ───
  console.log('\n[4] Regression sanity — @hellpeaces mkdir WHM fallback still wired')
  const cpProxy = require('../cpanel-proxy')
  check('cpanel-proxy.extractCpanelErrorFromResponse still exported',
    typeof cpProxy.extractCpanelErrorFromResponse === 'function')
  check('cpanel-proxy.looksLikeUapiPermFailure still exported',
    typeof cpProxy.looksLikeUapiPermFailure === 'function')
  const routesSrc = fs.readFileSync(path.join(__dirname, '..', 'cpanel-routes.js'), 'utf8')
  check('/files/mkdir WHM fallback still wired (via:\'whm-fallback\')',
    /via:\s*['"]whm-fallback['"]/.test(routesSrc))

  console.log(`\n${failures === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures} test(s) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
})().catch(err => {
  console.error('Async block threw:', err.stack || err)
  process.exit(1)
})
