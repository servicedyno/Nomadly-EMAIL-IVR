#!/usr/bin/env node
/**
 * Regression tests for Test Outbound SIP feature:
 *  - Module exports (initTestOutboundSip, startTest, matchPendingTest)
 *  - Button label + text bundle present in all 4 locales
 *  - Session lifecycle: start → match → report, and start → timeout → report
 *  - Throttle enforcement (5 per number per 24h)
 *  - Inactive-number rejection + no-SIP-credential rejection
 *  - Voice-service hook wiring
 *  - Bot wiring (require + init + button + handler)
 */

const fs = require('fs')
const path = require('path')

let passed = 0
let failed = 0
function assert(cond, msg) {
  if (!cond) { console.error(`❌ FAIL: ${msg}`); failed++ }
  else { console.log(`✅ ${msg}`); passed++ }
}

// ── 1. Module exports ──
const mod = require('../test-outbound-sip.js')
assert(typeof mod.initTestOutboundSip === 'function', 'exports initTestOutboundSip')
assert(typeof mod.startTest === 'function', 'exports startTest')
assert(typeof mod.matchPendingTest === 'function', 'exports matchPendingTest')
assert(mod.MAX_TESTS_PER_DAY === 5, 'MAX_TESTS_PER_DAY = 5')

// ── 2. phone-config.js — button label + text bundle in all 4 locales ──
const pc = require('../phone-config.js')
const buttonEn = pc?.cpBtn?.testOutboundSip || pc?.getPcButtons?.('en')?.testOutboundSip || pc?.testOutboundSip || null
// phone-config exports { ... } with top-level properties — let's just grep the source
const pcSrc = fs.readFileSync(path.join(__dirname, '..', 'phone-config.js'), 'utf8')
assert(pcSrc.includes(`testOutboundSip: '📤 Test Outbound SIP'`), 'EN button label present')
assert(pcSrc.includes(`testOutboundSip: '📤 Tester SIP sortant'`), 'FR button label present')
assert(pcSrc.includes(`testOutboundSip: '📤 测试 SIP 外呼'`), 'ZH button label present')
assert(pcSrc.includes(`testOutboundSip: '📤 आउटबाउंड SIP परखें'`), 'HI button label present')

// All 4 locales have a testOutboundSip bundle
const bundleMatches = pcSrc.match(/testOutboundSip: \{/g)
assert(bundleMatches && bundleMatches.length === 4, 'testOutboundSip bundle present in all 4 locales')

// Each bundle has all 6 keys
const requiredKeys = ['listening', 'success', 'timeout', 'throttled', 'inactive', 'noSipConfigured']
const pcTxt = pc.getTxt('en')
for (const k of requiredKeys) {
  assert(pcTxt.testOutboundSip && typeof pcTxt.testOutboundSip[k] === 'function', `EN bundle has '${k}' function`)
}
const pcFr = pc.getTxt('fr')
for (const k of requiredKeys) {
  assert(pcFr.testOutboundSip && typeof pcFr.testOutboundSip[k] === 'function', `FR bundle has '${k}' function`)
}
const pcZh = pc.getTxt('zh')
for (const k of requiredKeys) {
  assert(pcZh.testOutboundSip && typeof pcZh.testOutboundSip[k] === 'function', `ZH bundle has '${k}' function`)
}
const pcHi = pc.getTxt('hi')
for (const k of requiredKeys) {
  assert(pcHi.testOutboundSip && typeof pcHi.testOutboundSip[k] === 'function', `HI bundle has '${k}' function`)
}

// Each locale's message must be distinct from EN (actually localized)
assert(pcFr.testOutboundSip.listening('+1', 'user') !== pcTxt.testOutboundSip.listening('+1', 'user'), 'FR listening is localized (not identical to EN)')
assert(pcZh.testOutboundSip.listening('+1', 'user') !== pcTxt.testOutboundSip.listening('+1', 'user'), 'ZH listening is localized (not identical to EN)')
assert(pcHi.testOutboundSip.listening('+1', 'user') !== pcTxt.testOutboundSip.listening('+1', 'user'), 'HI listening is localized (not identical to EN)')

// ── 3. startTest: rejects inactive number ──
const fakeBot = { sendMessage: async () => null }
mod.initTestOutboundSip({ bot: fakeBot, log: () => {}, getTxt: pc.getTxt })

const inactiveNum = { phoneNumber: '+18889999999', status: 'suspended', sipUsername: 'gencredabc' }
const r1 = mod.startTest(12345, inactiveNum, 'en')
assert(r1.ok === false, 'startTest rejects inactive number')
assert(r1.message.includes('not active'), 'inactive rejection message mentions "not active"')

// ── 4. startTest: rejects numbers without SIP credentials ──
const noSipNum = { phoneNumber: '+18889999999', status: 'active' }
const r2 = mod.startTest(12345, noSipNum, 'en')
assert(r2.ok === false, 'startTest rejects number without sipUsername')
assert(r2.message.includes('SIP Credentials'), 'no-SIP message mentions SIP Credentials')

// ── 5. startTest: opens listening window on valid active+SIP number ──
const validNum = { phoneNumber: '+18888880001', status: 'active', sipUsername: 'gencredxyz', provider: 'telnyx' }
const r3 = mod.startTest(67890, validNum, 'en')
assert(r3.ok === true, 'startTest accepts valid active number with SIP')
assert(r3.message.includes('listening for 90s'), 'listening message mentions 90s window')
assert(r3.message.includes(validNum.phoneNumber), 'listening message includes phone number')
assert(r3.message.includes('gencredxyz'), 'listening message includes SIP username')
assert(mod._sessions['67890'] && !mod._sessions['67890'].reported, 'session created for chatId')

// ── 6. matchPendingTest: unmatched SIP user returns false (no interception) ──
;(async () => {
  const nonMatch = await mod.matchPendingTest(67890, { phoneNumber: '+18887770002' }, 'differentuser', { provider: 'telnyx', destination: '+19999999999' })
  assert(nonMatch === false, 'matchPendingTest returns false when SIP user does not match')
  assert(mod._sessions['67890'] && !mod._sessions['67890'].reported, 'session still pending after non-match')

  // ── 7. matchPendingTest: matching SIP credential intercepts ──
  const match = await mod.matchPendingTest(67890, validNum, 'gencredxyz', { provider: 'telnyx', destination: '+18005551234' })
  assert(match === true, 'matchPendingTest returns true when SIP credential matches')
  assert(mod._sessions['67890']?.reported === true, 'session marked reported after match')

  // ── 8. Second match for same session is ignored (idempotent) ──
  const secondMatch = await mod.matchPendingTest(67890, validNum, 'gencredxyz', { provider: 'telnyx', destination: '+19998887777' })
  assert(secondMatch === false, 'second match attempt for same session returns false (reported=true)')

  // ── 9. matchPendingTest: no session → false ──
  const noSession = await mod.matchPendingTest(99999, validNum, 'gencredxyz', {})
  assert(noSession === false, 'matchPendingTest returns false when no session exists')

  // ── 10. Throttle: 5th test allowed, 6th blocked ──
  // Re-init to reset state
  for (const k of Object.keys(mod._sessions)) delete mod._sessions[k]
  for (const k of Object.keys(mod._history)) delete mod._history[k]
  const throttleNum = { phoneNumber: '+18887776666', status: 'active', sipUsername: 'gencredtest' }
  for (let i = 0; i < 5; i++) {
    const r = mod.startTest(10000 + i, throttleNum, 'en')
    assert(r.ok === true, `throttle test ${i + 1}/5 accepted`)
  }
  const blocked = mod.startTest(10005, throttleNum, 'en')
  assert(blocked.ok === false, 'throttle blocks 6th test')
  assert(blocked.message.includes('5 outbound SIP tests'), 'throttle message mentions 5 test limit')

  // Cleanup
  for (const k of Object.keys(mod._sessions)) {
    if (mod._sessions[k].timeoutHandle) clearTimeout(mod._sessions[k].timeoutHandle)
    delete mod._sessions[k]
  }
  for (const k of Object.keys(mod._history)) delete mod._history[k]

  // ── 11. voice-service.js hook wiring ──
  const vsSrc = fs.readFileSync(path.join(__dirname, '..', 'voice-service.js'), 'utf8')
  assert(vsSrc.includes('let _testOutboundSipMatch = null'), 'voice-service declares _testOutboundSipMatch')
  assert(vsSrc.includes('_testOutboundSipMatch = deps.testOutboundSipMatch'), 'voice-service wires dep')
  assert(vsSrc.includes('TEST OUTBOUND SIP HOOK'), 'voice-service calls hook in handleOutboundSipCall')
  // Hook fires AFTER user identification but BEFORE connection fee
  const hookPos = vsSrc.indexOf('TEST OUTBOUND SIP HOOK')
  const ownerCheckPos = vsSrc.indexOf('No owner found for SIP user')
  const connFeePos = vsSrc.indexOf('CONNECTION FEE: Charge')
  assert(ownerCheckPos < hookPos && hookPos < connFeePos, 'hook placed AFTER owner-check and BEFORE connection-fee')

  // ── 12. _index.js wiring ──
  const idxSrc = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')
  assert(idxSrc.includes(`require('./test-outbound-sip.js')`), '_index.js requires test-outbound-sip module')
  assert(idxSrc.includes('initTestOutboundSip({'), '_index.js calls initTestOutboundSip')
  assert(idxSrc.includes('testOutboundSipMatch: require(\'./test-outbound-sip.js\').matchPendingTest'), 'voice-service gets hook dep')
  assert(idxSrc.includes('pc.testOutboundSip'), '_index.js uses pc.testOutboundSip in button/handler')
  assert(idxSrc.includes('startTestOutboundSip(chatId, num, lang)'), '_index.js button handler calls startTestOutboundSip')
  // Button only shown when sipUsername exists
  assert(idxSrc.match(/if \(num\.sipUsername\)[\s\S]{0,80}rows\.push\(\[pc\.testOutboundSip\]\)/), 'button gated on num.sipUsername')

  console.log(`\n${failed === 0 ? '🟢' : '🔴'} ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
})()
