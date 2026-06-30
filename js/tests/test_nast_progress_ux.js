/**
 * Smoke test for the NAST pre-flight progress UX in domain-service.js
 *
 * Asserts:
 *   1. registerDomain() now accepts an optional onProgress callback.
 *   2. For pre-delegation TLDs (.de), onProgress is invoked with stage="verifying"
 *      BEFORE the OP register call, and stage="verified" AFTER NAST passes.
 *   3. For non-pre-delegation TLDs (.com), onProgress is NEVER invoked at the
 *      NAST stage (gate doesn't trigger).
 *   4. onProgress callback errors NEVER break the registration flow.
 *   5. Translation keys nsVerifying & nsVerifiedOk exist in all 4 languages.
 */
'use strict'

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'backend', '.env') })

let pass = 0
let fail = 0
const it = (label, cond, detail = '') => {
  if (cond) { console.log(`  ✅ ${label}`); pass++ }
  else      { console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`); fail++ }
}

console.log('\n=== NAST pre-flight progress UX tests ===')

// T1+T5 — translation keys present in all locales
const { translation } = require('../translation')
const langs = ['en', 'fr', 'hi', 'zh']
for (const l of langs) {
  const r = translation('t.nsVerifying', l, 'de')
  it(`[${l}] nsVerifying(de) returns a non-empty string`, typeof r === 'string' && r.length > 5 && r !== 't.nsVerifying', `got: ${r}`)
  const r2 = translation('t.nsVerifiedOk', l)
  it(`[${l}] nsVerifiedOk returns a non-empty string`, typeof r2 === 'string' && r2.length > 5 && r2 !== 't.nsVerifiedOk', `got: ${r2}`)
}

// T2+T3+T4 — exercise registerDomain via opService mock. We need to mock CF
// + OP to avoid hitting prod. The cleanest way is to stub require cache.
//
// Strategy: replace cf-service.createZone() to return success with a CF NS
// pair that ARE actually authoritative for an existing domain
// (rsvpcrumelbell.de), then call registerDomain with a fake .de string and
// verify onProgress fires twice for .de and zero times for .com. We swap OP
// register to a synchronous mock that just records the call.

const opService = require('../op-service')
const cfService = require('../cf-service')

const origCreateZone = cfService.createZone
const origCheckNs = opService.checkNsAuthoritative
const origRegister = opService.registerDomain

let progressCalls = []

const fakeOnProgress = (stage, ctx) => { progressCalls.push({ stage, ctx }) }

// Make CF zone create succeed with real CF NS (which we'll later mock NAST to
// pass for)
cfService.createZone = async () => ({
  success: true,
  zoneId: 'fake-zone-id',
  nameservers: ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'],
})

// Make NAST always pass quickly (we test the *wiring*, not the real check —
// that's covered by test_op_de_dns_preflight.js)
opService.checkNsAuthoritative = async (_dom, ns) => ({
  ready: true,
  authoritativeCount: ns.length,
  elapsedMs: 12,
  perNs: ns.map((n) => ({ ns: n, ip: '1.2.3.4', aa: true, ancount: 1, error: null })),
})

// Stub OP register so we don't hit prod
opService.registerDomain = async () => ({ success: true, registrar: 'OpenProvider' })

// Now clear require cache for domain-service so it picks up the stubs
delete require.cache[require.resolve('../domain-service')]
const domainService = require('../domain-service')

async function runTests() {
  // T2: .de should trigger TWO progress callbacks
  progressCalls = []
  const r1 = await domainService.registerDomain(
    'fake-de-test-12345.de', 'OpenProvider', 'cloudflare', null, 12345, null, fakeOnProgress
  )
  it('.de registration returns success', r1 && r1.success === true, `got: ${JSON.stringify(r1)}`)
  it('.de onProgress called exactly 2x (verifying + verified)', progressCalls.length === 2, `got: ${JSON.stringify(progressCalls)}`)
  it('.de first stage is "verifying"', progressCalls[0]?.stage === 'verifying', `got: ${progressCalls[0]?.stage}`)
  it('.de second stage is "verified"', progressCalls[1]?.stage === 'verified', `got: ${progressCalls[1]?.stage}`)
  it('.de verifying ctx includes tld="de"', progressCalls[0]?.ctx?.tld === 'de')

  // T3: .com should NOT trigger any progress callbacks (gate doesn't fire)
  progressCalls = []
  const r2 = await domainService.registerDomain(
    'fake-com-test-12345.com', 'OpenProvider', 'cloudflare', null, 12345, null, fakeOnProgress
  )
  it('.com registration returns success', r2 && r2.success === true)
  it('.com onProgress NOT called at NAST stage', progressCalls.length === 0, `got: ${JSON.stringify(progressCalls)}`)

  // T4: A throwing onProgress must not break registration
  progressCalls = []
  const throwingProgress = () => { throw new Error('boom') }
  const r3 = await domainService.registerDomain(
    'fake-de-throwing-12345.de', 'OpenProvider', 'cloudflare', null, 12345, null, throwingProgress
  )
  it('throwing onProgress does NOT break .de registration', r3 && r3.success === true, `got: ${JSON.stringify(r3)}`)

  // Restore
  cfService.createZone = origCreateZone
  opService.checkNsAuthoritative = origCheckNs
  opService.registerDomain = origRegister

  console.log(`\n═══ ${pass} passed, ${fail} failed ═══`)
  process.exit(fail === 0 ? 0 : 1)
}

runTests().catch((e) => { console.error('FATAL:', e?.stack || e); process.exit(2) })
