/**
 * Regression test for the consolidated "Choose Your Plan" copy.
 *
 * Guarantees:
 *  1) buildChooseSubscription(lang) produces the same string that each
 *     lang/*.js module exposes via t.chooseSubscription (single source of truth).
 *  2) The BulkSMS branch contains device suffixes; the hidden-SMS branch doesn't.
 *  3) All 4 locales + config.js fallback stay in lockstep.
 *
 * Run: `node js/tests/test_plan_copy.js`  (exit 0 = pass, non-zero = fail)
 */

/* eslint-disable no-console */

const assert = require('assert')

const { buildChooseSubscription } = require('../lang/plan-copy')
const { en } = require('../lang/en')
const { fr } = require('../lang/fr')
const { hi } = require('../lang/hi')
const { zh } = require('../lang/zh')
const config = require('../config')

const LOCALES = { en, fr, hi, zh }

let failed = 0
const check = (name, fn) => {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${name}\n    ${e.message}`)
  }
}

console.log('plan-copy single-source-of-truth tests')

for (const [lang, mod] of Object.entries(LOCALES)) {
  check(`${lang}: lang file matches builder output`, () => {
    assert.strictEqual(mod.t.chooseSubscription, buildChooseSubscription(lang))
  })
}

check('config.js fallback matches builder(en)', () => {
  assert.strictEqual(config.t.chooseSubscription, buildChooseSubscription('en'))
})

check('every locale starts with its localized title + two newlines', () => {
  const titles = {
    en: '<b>Choose Your Plan</b>\n\n',
    fr: '<b>Choisissez votre plan</b>\n\n',
    hi: '<b>अपना प्लान चुनें</b>\n\n',
    zh: '<b>选择您的计划</b>\n\n',
  }
  for (const [lang, prefix] of Object.entries(titles)) {
    assert.ok(
      buildChooseSubscription(lang).startsWith(prefix),
      `${lang} missing expected title prefix`,
    )
  }
})

check('device suffix behavior honors HIDE_SMS_APP flag', () => {
  const originalHide = process.env.HIDE_SMS_APP
  try {
    process.env.HIDE_SMS_APP = 'true'
    const hidden = buildChooseSubscription('en')
    assert.ok(!hidden.includes('SMS devices'), 'device suffix leaked when hidden')
    assert.ok(!hidden.includes('📧 BulkSMS'), 'BulkSMS perk leaked when hidden')

    process.env.HIDE_SMS_APP = 'false'
    const shown = buildChooseSubscription('en')
    assert.ok(shown.includes('3 SMS devices'), 'daily device suffix missing')
    assert.ok(shown.includes('10 SMS devices'), 'weekly device suffix missing')
    assert.ok(shown.includes('unlimited SMS devices'), 'monthly unlimited suffix missing')
    assert.ok(shown.includes('📧 BulkSMS'), 'BulkSMS perk missing when shown')
  } finally {
    if (originalHide === undefined) delete process.env.HIDE_SMS_APP
    else process.env.HIDE_SMS_APP = originalHide
  }
})

check('unknown lang falls back to English', () => {
  assert.strictEqual(buildChooseSubscription('xx'), buildChooseSubscription('en'))
})

if (failed) {
  console.log(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log('\nAll plan-copy tests passed')
