// Regression test for:
//   - IVR-with-empty-options warning (Bug 2 from Feb 2026 SIP investigation)
//   - softphoneGuide includes 3CX/PBX trunk section in all 4 locales
//
// Scenario context: User @Mrdoitright53 (chatId 8737445617) had ivr.enabled=true with
// options={} on +18882437690. The bot UI silently said "No options configured yet" so
// the user thought IVR was working. In reality, voice-webhook skips IVR when options is
// empty → callers fall through to voicemail. Now the menu shouts a clear warning.
//
// Also enforces the SIP guide upgrade: 3CX/FreePBX/Asterisk PBX users were registering
// gencred SIP credentials as "extensions", which made the PBX answer the call and dump
// it to its own voicemail (the "Record your message and press pound, or press star to
// contact the operator" prompt). The new guide explicitly tells PBX users to use TRUNK
// mode instead.
//
// Run: node /app/js/tests/test_sip_ux_warnings.js

const assert = require('assert')
const phoneConfig = require('../phone-config.js')

let pass = 0, fail = 0
function check(name, fn) {
  try { fn(); console.log('  ✅', name); pass++ }
  catch (e) { console.log('  ❌', name, '\n    ', e.message); fail++ }
}

console.log('\n=== IVR empty-options warning ===')

const NUMBER = '+18882437690'

// Disabled IVR — neutral message
check('Disabled IVR: shows neutral status (no warning)', () => {
  const out = phoneConfig.txt.ivrMenu(NUMBER, { enabled: false })
  assert.ok(out.includes('Disabled') || out.includes('❌'), 'should show disabled')
  assert.ok(!out.includes('IVR will not run'), 'no warning for disabled')
})

// Enabled IVR but options={} — must warn
check('EN: enabled but empty options shows ⚠️ warning + actionable hint', () => {
  const out = phoneConfig.txt.ivrMenu(NUMBER, { enabled: true, greeting: 'Hi', options: {} })
  assert.ok(out.includes('⚠️'), 'must include warning emoji')
  assert.ok(out.includes('No options added yet'), 'must clearly state no options')
  assert.ok(out.includes('IVR will not run'), 'must say IVR will not run')
  assert.ok(out.includes('voicemail'), 'must mention voicemail fallback')
  assert.ok(out.includes('Add Option') || out.includes('add at least one'), 'must give actionable next step')
  assert.ok(out.includes('forward'), 'must give example like 1 forward +14155551234')
})

// Each locale should warn (not silently say "no options configured")
const langCases = [
  ['fr', '⚠️', 'le SVI ne se déclenchera pas', 'messagerie vocale'],
  ['zh', '⚠️', 'IVR 不会运行', '语音信箱'],
  ['hi', '⚠️', 'IVR नहीं चलेगा', 'वॉइसमेल'],
]
for (const [lang, ...needles] of langCases) {
  check(`${lang.toUpperCase()}: enabled but empty options shows visible warning`, () => {
    const t = phoneConfig.getTxt(lang)
    const out = t.ivrMenu(NUMBER, { enabled: true, greeting: 'X', options: {} })
    for (const needle of needles) {
      assert.ok(out.includes(needle), `${lang}: missing "${needle}" in:\n${out}`)
    }
  })
}

// Enabled with options — no warning, normal listing
check('Enabled with options shows ✅ + listing, no warning', () => {
  const out = phoneConfig.txt.ivrMenu(NUMBER, {
    enabled: true,
    greeting: 'Press 1 for support',
    options: { '1': { action: 'forward', forwardTo: '+14155551234' } },
  })
  assert.ok(out.includes('✅'), 'should show enabled checkmark')
  assert.ok(!out.includes('IVR will not run'), 'no warning when options present')
  assert.ok(out.includes('Press <b>1</b>') || out.includes('1'), 'should list option 1')
})

console.log('\n=== softphoneGuide PBX/3CX section ===')

const sipDomain = 'sip.speechcue.com'

// English: must include all PBX-related anchors
check('EN guide: contains PBX warning + 3CX trunk steps + recommended softphones', () => {
  const out = phoneConfig.txt.softphoneGuide(sipDomain)
  assert.ok(out.includes('SIP Setup Guide'), 'title')
  assert.ok(out.includes('Linphone'), 'recommends Linphone')
  assert.ok(out.includes('Zoiper'), 'recommends Zoiper')
  assert.ok(out.includes('PBX'), 'must mention PBX')
  assert.ok(out.includes('3CX') || out.includes('FreePBX') || out.includes('Asterisk'), 'must name a PBX')
  assert.ok(out.includes('SIP TRUNK') || out.includes('SIP Trunk') || out.includes('Trunk'), 'must say TRUNK')
  assert.ok(out.includes('Inbound Rules') || out.includes('inbound rule'), 'must show 3CX inbound rules step')
  assert.ok(out.includes(sipDomain), 'must include the SIP domain')
  assert.ok(out.includes('Record your message'), 'must reference the symptom users hear')
  assert.ok(out.length < 4096, `Telegram message limit: ${out.length} chars`)
})

// Each locale should have the same critical anchors
const localeChecks = [
  ['fr', ['Trunk', '3CX', 'PBX', 'sip.speechcue.com']],
  ['zh', ['Trunk', '3CX', 'PBX', 'sip.speechcue.com']],
  ['hi', ['Trunk', '3CX', 'PBX', 'sip.speechcue.com']],
]
for (const [lang, anchors] of localeChecks) {
  check(`${lang.toUpperCase()} guide: PBX/3CX TRUNK anchors present`, () => {
    const t = phoneConfig.getTxt(lang)
    const out = t.softphoneGuide(sipDomain)
    for (const a of anchors) {
      assert.ok(out.includes(a), `${lang}: missing "${a}"`)
    }
    assert.ok(out.length < 4096, `${lang}: telegram limit, got ${out.length}`)
  })
}

console.log(`\n  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
