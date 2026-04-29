/**
 * Regression tests for the 2026-04-27 "phone settings resetting" RCA (@Scoreboard44).
 *
 * Covers the 4 fixes:
 *  #1  hasVoice ReferenceError in buildManageMenu — verify `hasVoice` is defined
 *  #2  num.features undefined guards — verify `info?.cpActiveNumber` load sites normalize features
 *  #3  Forward-to number E.164 normalization — 10-digit / 11-digit / already-+ inputs
 *  #4  Atomic $push / $set patterns — verify whole-val `set(phoneNumbersOf, chatId, userData)`
 *      racy pattern is gone from purchase / QuickIVR-token / SIP-reset / cacheTwilioAddress flows
 *
 * Run: `node js/tests/test_phone_settings_reset_fix.js`
 */

const fs = require('fs')
const path = require('path')

const src = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')
let fails = 0
const assert = (cond, msg) => { if (cond) { console.log(`  ✅ ${msg}`) } else { console.log(`  ❌ ${msg}`); fails++ } }

console.log('─── Fix #1: hasVoice defined in buildManageMenu ───')
// Widened window from 2000 → 5000 to accommodate later additions (skipped/dormant badge logic).
const buildManageMenuMatch = src.match(/function buildManageMenu\(num[\s\S]{0,5000}?\n  \}/m)
assert(buildManageMenuMatch, 'buildManageMenu fn located')
if (buildManageMenuMatch) {
  const body = buildManageMenuMatch[0]
  assert(/const hasVoice\s*=\s*num\.capabilities\?\.voice\s*!==\s*false/.test(body), 'hasVoice is declared before use')
  assert(/if \(hasVoice && num\.status === 'active'\)/.test(body), 'hasVoice gate on testMyNumber button still in place')
}

console.log('\n─── Fix #2: num.features guard on cpActiveNumber loads ───')
const loadSiteCount = (src.match(/const num = info\?\.cpActiveNumber/g) || []).length
const guardCount = (src.match(/if \(num && \(!num\.features \|\| typeof num\.features !== 'object'\)\) num\.features = \{\}/g) || []).length
assert(loadSiteCount > 20, `cpActiveNumber load sites found (${loadSiteCount})`)
assert(guardCount >= loadSiteCount, `guard lines (${guardCount}) ≥ load sites (${loadSiteCount})`)
// Also check the primary entry site (numbers[idx]) has the guard too
assert(/const num = numbers\[idx\]\s*\n\s*\/\/ Defensive[\s\S]{0,400}num\.features = \{\}/.test(src),
  'primary "numbers[idx]" load site normalizes features + capabilities')

console.log('\n─── Fix #3: Forward-to number E.164 normalization ───')
// Call forwarding handler — auto-prepend +1 / +
const cfBlock = src.match(/forwardTo = message\.replace\(\/\[\^\+\\d\]\/g[\s\S]{0,500}enterValidPhone\)/)
assert(cfBlock, 'cpEnterForwardNumber block located')
if (cfBlock) {
  const b = cfBlock[0]
  assert(/\/\^\\d\{10\}\$\/\.test\(forwardTo\)[\s\S]{0,100}'\+1' \+ forwardTo/.test(b), 'CF: 10-digit → +1 auto-correct')
  assert(/\/\^1\\d\{10\}\$\/\.test\(forwardTo\)/.test(b), 'CF: 11-digit starting with 1 → + auto-correct')
  assert(/startsWith\('\+'\)/.test(b), 'CF: rejects non-+ after normalization')
}
// IVR forward-menu handler — same pattern. Widened from 1000 → 3000 chars to accommodate
// self-call-loop detection + the new scope-clarifying tip that was added in Feb 2026.
const ivrBlock = src.match(/if \(draft\.action === 'forward'\)[\s\S]{0,3000}draft\.forwardTo = phone/)
assert(ivrBlock, 'IVR forward-menu block located')
if (ivrBlock) {
  const b = ivrBlock[0]
  assert(/\/\^\\d\{10\}\$\/\.test\(phone\)[\s\S]{0,100}'\+1' \+ phone/.test(b), 'IVR: 10-digit → +1 auto-correct')
  assert(/startsWith\('\+'\)/.test(b), 'IVR: rejects non-+ after normalization')
}

console.log('\n─── Fix #4: Atomic $push / $set on phoneNumbersOf ───')
// The unsafe pattern `set(phoneNumbersOf, chatId, userData/existing)` must be gone
const unsafePatterns = [
  /set\(phoneNumbersOf,\s*chatId,\s*userData\)/,
  /set\(phoneNumbersOf,\s*chatId,\s*existing\)/,
  /existing\.numbers\.push\(numberDoc\);\s*await set\(phoneNumbersOf/,
]
for (const rx of unsafePatterns) {
  assert(!rx.test(src), `unsafe pattern gone: ${rx.source}`)
}
// Remaining safe sets: only the first-time empty-doc creation
const remainingSets = (src.match(/set\(phoneNumbersOf,\s*chatId,/g) || []).length
assert(remainingSets <= 1, `only first-time new-doc set remains (found ${remainingSets})`)

// Atomic $push for numbers array on purchase paths
const pushCount = (src.match(/\$push:\s*\{\s*'val\.numbers':\s*numberDoc\s*\}/g) || []).length
assert(pushCount >= 4, `atomic $push on numbers array used in all 4+ purchase paths (found ${pushCount})`)

// Atomic positional $set for QuickIVR token cache
assert(/'val\.numbers\.\$\.twilioSubAccountToken':\s*subAccountToken/.test(src),
  'QuickIVR token cache uses atomic positional $set')

// Atomic positional $set for SIP credentials reset
assert(/'val\.numbers\.\$\.sipUsername'[\s\S]{0,500}'val\.numbers\.\$\.telnyxCredentialId'/.test(src),
  'SIP credential reset uses atomic positional $set on all 5 fields')

// Atomic field-level $set for cacheTwilioAddress
assert(/`val\.twilioAddresses\.\$\{countryCode\}`/.test(src) || /val\.twilioAddresses\.\${countryCode}/.test(src),
  'cacheTwilioAddress uses atomic field-level $set')

// Atomic field-level $set for sub-account cred save
assert(/'val\.twilioSubAccountSid':\s*subSid,\s*'val\.twilioSubAccountToken':\s*subToken/.test(src),
  'Sub-account creds saved via atomic field-level $set')

console.log('\n─── Summary ───')
if (fails === 0) {
  console.log(`\n✅ All regression assertions passed.`)
  process.exit(0)
} else {
  console.log(`\n❌ ${fails} assertions failed.`)
  process.exit(1)
}
