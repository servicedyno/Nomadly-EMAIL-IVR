// Regression test for:
//   1. IVR-incomplete badge on Manage-Number screen (en/fr/zh/hi)
//   2. Test-My-Number module — throttling, button localization, prompt text
//
// Run: node /app/js/tests/test_manage_screen_features.js

const assert = require('assert')
const phoneConfig = require('../phone-config.js')
const testMyNumber = require('../test-my-number.js')

let pass = 0, fail = 0
function check(name, fn) {
  try { fn(); console.log('  ✅', name); pass++ }
  catch (e) { console.log('  ❌', name, '\n    ', e.message); fail++ }
}

console.log('\n=== Task 1: IVR-incomplete badge on Manage-Number screen ===')

const PHONE = '+18882437690'
const numWithBrokenIvr = {
  phoneNumber: PHONE,
  plan: 'business',
  planPrice: 19.99,
  status: 'active',
  features: { ivr: { enabled: true, options: {} } },
  capabilities: { voice: true, sms: true },
  minutesUsed: 26,
  smsUsed: 0,
}
const numWithGoodIvr = {
  ...numWithBrokenIvr,
  features: { ivr: { enabled: true, options: { '1': { action: 'voicemail' } } } },
}
const numWithIvrOff = {
  ...numWithBrokenIvr,
  features: { ivr: { enabled: false, options: {} } },
}

const langCases = [
  ['en', /IVR enabled but incomplete/i, /Auto-attendant/],
  ['fr', /SVI activé mais incomplet/i, /Standard Auto/],
  ['zh', /IVR 已启用但不完整/, /自动应答/],
  ['hi', /IVR सक्रिय है लेकिन अधूरा/, /ऑटो-अटेंडेंट/],
]

for (const [lang, badgeRe, ctaRe] of langCases) {
  check(`${lang.toUpperCase()}: broken IVR shows badge on Manage screen`, () => {
    const t = phoneConfig.getTxt(lang)
    const out = t.manageNumber(numWithBrokenIvr, 0, 0, [numWithBrokenIvr])
    assert.ok(badgeRe.test(out), `expected badge matching ${badgeRe} in:\n${out}`)
    assert.ok(ctaRe.test(out), `expected CTA matching ${ctaRe} in:\n${out}`)
    assert.ok(out.includes('⚠️'), 'must include warning emoji')
  })
  check(`${lang.toUpperCase()}: working IVR (with options) shows NO badge`, () => {
    const t = phoneConfig.getTxt(lang)
    const out = t.manageNumber(numWithGoodIvr, 0, 0, [numWithGoodIvr])
    assert.ok(!badgeRe.test(out), `unexpected badge present in:\n${out}`)
  })
  check(`${lang.toUpperCase()}: IVR disabled shows NO badge`, () => {
    const t = phoneConfig.getTxt(lang)
    const out = t.manageNumber(numWithIvrOff, 0, 0, [numWithIvrOff])
    assert.ok(!badgeRe.test(out), `unexpected badge for disabled IVR in:\n${out}`)
  })
}

console.log('\n=== Task 2: Test-My-Number — button + module ===')

check('testMyNumber button exists in EN', () => {
  const btn = phoneConfig.getBtn('en')
  assert.strictEqual(btn.testMyNumber, '📞 Test My Number')
})
check('testMyNumber button localized in fr/zh/hi', () => {
  assert.strictEqual(phoneConfig.getBtn('fr').testMyNumber, '📞 Tester mon numéro')
  assert.strictEqual(phoneConfig.getBtn('zh').testMyNumber, '📞 测试我的号码')
  assert.strictEqual(phoneConfig.getBtn('hi').testMyNumber, '📞 मेरा नंबर परखें')
})

check('testMyNumber localized text bundle exists in EN', () => {
  const t = phoneConfig.getTxt('en')
  assert.ok(t.testMyNumber, 'testMyNumber bundle missing')
  for (const k of ['placing', 'successDtmf', 'voicemail', 'answeredNoDtmf', 'noAnswer', 'throttled', 'inactive', 'placeFailed']) {
    assert.ok(typeof t.testMyNumber[k] === 'function', `testMyNumber.${k} should be a function`)
  }
})

check('testMyNumber.voicemail message includes /sipguide CTA + 3CX/PBX wording', () => {
  const t = phoneConfig.getTxt('en')
  const msg = t.testMyNumber.voicemail(PHONE)
  assert.ok(msg.includes('voicemail') || msg.includes('Voicemail'), 'must mention voicemail')
  assert.ok(msg.includes('PBX') || msg.includes('3CX'), 'must mention PBX/3CX')
  assert.ok(msg.includes('/sipguide'), 'must link to /sipguide')
  assert.ok(msg.includes(PHONE), 'must include the tested number')
})

check('testMyNumber.successDtmf message is a clean success', () => {
  const t = phoneConfig.getTxt('en')
  const msg = t.testMyNumber.successDtmf(PHONE)
  assert.ok(msg.includes('✅'), 'must include success emoji')
  assert.ok(msg.includes('Reached your SIP device') || msg.includes('working'), 'must indicate success')
  assert.ok(msg.includes(PHONE), 'must include the tested number')
})

check('testMyNumber.noAnswer message has actionable next step', () => {
  const t = phoneConfig.getTxt('en')
  const msg = t.testMyNumber.noAnswer(PHONE)
  assert.ok(msg.includes('❌'), 'must include error emoji')
  assert.ok(msg.includes('No answer'), 'must say no answer')
  assert.ok(msg.includes('/sipguide') || msg.includes('registered'), 'must give next step')
})

check('test-my-number module exports placeTestCall + initTestMyNumber', () => {
  assert.strictEqual(typeof testMyNumber.initTestMyNumber, 'function')
  assert.strictEqual(typeof testMyNumber.placeTestCall, 'function')
  assert.strictEqual(typeof testMyNumber.MAX_TESTS_PER_DAY, 'number')
  assert.ok(testMyNumber.MAX_TESTS_PER_DAY > 0)
  assert.ok(testMyNumber.TRIAL_CALLER_ID, 'must have a trial caller id default')
})

check('placeTestCall rejects inactive numbers', async () => {
  // No deps init — we expect the early sanity check to fail
  const res = await testMyNumber.placeTestCall(123, { phoneNumber: '+15555550100', status: 'suspended' }, 'en')
  assert.strictEqual(res.ok, false, 'should reject inactive')
})

check('placeTestCall rejects when telnyxApi/bot not initialized', async () => {
  const res = await testMyNumber.placeTestCall(123, { phoneNumber: '+15555550100', status: 'active' }, 'en')
  assert.strictEqual(res.ok, false, 'should reject without init')
  assert.ok(res.message.includes('not initialized') || res.message.includes('try again'), 'should explain')
})

console.log(`\n  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
