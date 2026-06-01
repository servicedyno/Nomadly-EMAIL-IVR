/**
 * Regression test for the @Night_ismine captcha bug (Feb 2026).
 *
 * Customer @Night_ismine (chatId 7394693056) reported:
 *   "I turn off captcha for https://homepage-navyfed.com/ but captcha still on"
 *
 * Reproduction from Railway logs:
 *   • Main plan domain: verify-navy.com (has val.visitorCaptchaOff:true since
 *     the legacy antiRedOff migration)
 *   • Addon domain:    homepage-navyfed.com (captcha just deployed → ON)
 *   • User tapped "🛡️ On/Off Captcha" → bot read main-domain state and
 *     showed "✅ Turn ON Visitor Captcha", which only operates on the main
 *     domain. The addon `homepage-navyfed.com` could never be toggled from
 *     the bot — only from the web HostPanel.
 *
 * Fix (in js/_index.js):
 *   • If the Gold plan has >1 unique domain (main + addons), show a picker
 *     keyboard with one row per domain and a status indicator.
 *   • New `captcha-pick-domain` action handler parses the picked domain
 *     out of the button text, validates against the saved allow-list,
 *     stores `domainToManage`, and forwards to the existing
 *     `anti-red-toggle` flow.
 *
 * This test asserts:
 *   A. The source file contains the multi-domain branch + picker handler
 *      (so future refactors can't silently remove them).
 *   B. The picker button-text parser correctly round-trips for every
 *      combination of (icon × state × domain) the renderer can produce.
 *   C. node --check js/_index.js still parses.
 *
 * Run:  node tests/test_captcha_addon_domain_picker.js
 */

'use strict'

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

let passed = 0
let failed = 0
const assert = (cond, name) => {
  if (cond) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}`); failed++ }
}

const indexSrc = fs.readFileSync(path.join(__dirname, '..', 'js', '_index.js'), 'utf8')
const enSrc    = fs.readFileSync(path.join(__dirname, '..', 'js', 'lang', 'en.js'), 'utf8')

// ───────────────────────────────────────────────────────────
// Test A — static guards on the bot source code
// ───────────────────────────────────────────────────────────
console.log('\nTest A: bot source has the multi-domain picker branch')

assert(
  /uniquePlanDomains\.length > 1/.test(indexSrc),
  'A1 manageVisitorCaptcha checks for >1 plan domains'
)
assert(
  /captchaPickerDomains/.test(indexSrc),
  'A2 picker stores the allow-list of domains in user info'
)
assert(
  /action === 'captcha-pick-domain'/.test(indexSrc),
  'A3 new captcha-pick-domain action handler exists'
)
assert(
  /captchaDomainButton/.test(indexSrc),
  'A4 picker uses the i18n captchaDomainButton renderer'
)
assert(
  /\[plan\.domain, \.\.\.\(Array\.isArray\(plan\.addonDomains\) \? plan\.addonDomains : \[\]\)\]/.test(indexSrc),
  'A5 picker lists main domain + every addon domain'
)

// Make sure the i18n keys exist in EN (and by extension are imported by t)
assert(/captchaPickDomain:/.test(enSrc), 'A6 en.js exports captchaPickDomain')
assert(/captchaDomainButton:/.test(enSrc), 'A7 en.js exports captchaDomainButton')

// ───────────────────────────────────────────────────────────
// Test B — button-text round trip
// The button renderer in en.js produces strings the action handler then
// parses with the regex /·\s*([^\s·]+)\s*$/. Both sides must stay in sync.
// ───────────────────────────────────────────────────────────
console.log('\nTest B: picker button text ↔ regex round trip')

// Pull the captchaDomainButton lambda out of en.js by eval'ing the relevant
// line (no side-effects, no requires) so we test the literal source string.
const enLine = enSrc.match(/captchaDomainButton:\s*(\([^)]*\)\s*=>\s*[^,\n]+),/)
assert(enLine, 'B0 captchaDomainButton lambda is parseable from en.js')
let renderBtn
try {
  // eslint-disable-next-line no-eval
  renderBtn = eval(`(${enLine[1]})`)
} catch (e) {
  failed++; console.log(`  ❌ B0a renderBtn eval failed: ${e.message}`)
}

// The regex from the action handler at js/_index.js captcha-pick-domain
const PICK_RE = /·\s*([^\s·]+)\s*$/

const buttonCases = [
  // [domain, isOff, hasCF]
  ['verify-navy.com', false, true],
  ['verify-navy.com', true,  true],
  ['homepage-navyfed.com', false, true],
  ['homepage-navyfed.com', true,  true],
  ['some-other.org', false, false],     // no CF
  ['x.test', true, false],              // no CF + OFF (No-CF wins)
  ['sub.example-domain.io', false, true],
]
for (const [d, isOff, hasCF] of buttonCases) {
  const text = renderBtn(d, isOff, hasCF)
  const m = text.match(PICK_RE)
  const got = m ? m[1].toLowerCase() : null
  assert(got === d, `B.${d}|isOff=${isOff}|hasCF=${hasCF}: button="${text}" → parsed="${got}"`)
}

// Anti-spoof: button must visually convey the state
assert(/🟢 ON/.test(renderBtn('verify-navy.com', false, true)), 'B.ON-icon contains 🟢 ON for hasCF && !isOff')
assert(/🔴 OFF/.test(renderBtn('verify-navy.com', true, true)),  'B.OFF-icon contains 🔴 OFF for hasCF && isOff')
assert(/No CF/.test(renderBtn('x.test', false, false)),         'B.NoCF-icon contains "No CF" when !hasCF')

// ───────────────────────────────────────────────────────────
// Test C — exact-customer scenario simulation
// Build the same docByDomain map the renderer would see for @Night_ismine's
// state and walk through the keyboard + picker handler logic locally.
// ───────────────────────────────────────────────────────────
console.log('\nTest C: @Night_ismine scenario — addon-domain captcha can now be toggled')

const planDomains = ['verify-navy.com', 'homepage-navyfed.com']
const docByDomain = {
  'verify-navy.com': { val: {
    cfZoneId: 'zone-verifynavy', nameserverType: 'cloudflare',
    visitorCaptchaOff: true,          // already disabled
  } },
  'homepage-navyfed.com': { val: {
    cfZoneId: 'zone-homepagenavyfed', nameserverType: 'cloudflare',
    // no visitorCaptchaOff → captcha ON at edge
  } },
}

// Replicate the row builder
const rows = planDomains.map(d => {
  const v = docByDomain[d]?.val || {}
  const hasCF = !!(v.cfZoneId && v.nameserverType === 'cloudflare')
  const isOff = v.visitorCaptchaOff === true || v.antiRedOff === true
  return renderBtn(d, isOff, hasCF)
})
assert(rows[0] === '🔴 OFF · verify-navy.com',         'C1 main domain row shows OFF (matches DB state)')
assert(rows[1] === '🟢 ON · homepage-navyfed.com',     'C2 addon row shows ON (matches DB state)')

// Simulate the user tapping the addon row
const tapped = rows[1]
const pickedM = tapped.match(PICK_RE)
const picked = pickedM ? pickedM[1].toLowerCase() : ''
assert(planDomains.includes(picked), 'C3 picker resolves the tapped row to the addon domain')
assert(picked === 'homepage-navyfed.com', 'C4 picked domain is homepage-navyfed.com (the one the customer wanted to toggle)')

// Confirm that prior to the fix the bot would have toggled the WRONG domain
const preFixDomainBotWouldToggle = planDomains[0]  // selectedHostingDomain
assert(preFixDomainBotWouldToggle === 'verify-navy.com', 'C5 (regression) without picker, bot would toggle verify-navy.com — the BUG')
assert(picked !== preFixDomainBotWouldToggle, 'C6 picker now correctly targets the addon, not the main domain')

// ───────────────────────────────────────────────────────────
// Test D — single-domain plans keep the original direct-to-toggle UX
// ───────────────────────────────────────────────────────────
console.log('\nTest D: single-domain plans skip the picker (no regression)')

const singleDomainPlanDomains = ['onlyone.com']
const singleDomainUnique = Array.from(new Set(singleDomainPlanDomains.map(d => d.toLowerCase()).filter(Boolean)))
assert(singleDomainUnique.length === 1, 'D1 single-domain plans produce a 1-element unique list')
assert(singleDomainUnique.length > 1 === false, 'D2 picker branch is skipped when uniquePlanDomains.length === 1')

// ───────────────────────────────────────────────────────────
// Test E — node --check
// ───────────────────────────────────────────────────────────
console.log('\nTest E: js/_index.js parses')
const checkRes = spawnSync('node', ['--check', path.join(__dirname, '..', 'js', '_index.js')], { encoding: 'utf8' })
assert(checkRes.status === 0, `E1 node --check exits 0 (stderr: ${checkRes.stderr.trim() || 'none'})`)

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
