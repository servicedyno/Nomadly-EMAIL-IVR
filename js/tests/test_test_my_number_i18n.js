/**
 * Regression test — `cpTxt.testMyNumber` bundle must be present and non-empty
 * in every supported locale (en/fr/zh/hi).
 *
 * Run: `node js/tests/test_test_my_number_i18n.js`
 */

const pc = require('../phone-config')

const LANGS = ['en', 'fr', 'zh', 'hi']
const KEYS = [
  'placing',
  'successDtmf',
  'voicemail',
  'answeredNoDtmf',
  'noAnswer',
  'throttled',
  'inactive',
  'placeFailed',
]

let failures = 0
const sample = '+15551234567'

for (const lang of LANGS) {
  const t = pc.getTxt(lang)
  if (!t || typeof t.testMyNumber !== 'object') {
    console.log(`FAIL ${lang}: testMyNumber bundle missing`)
    failures++
    continue
  }
  for (const key of KEYS) {
    const fn = t.testMyNumber[key]
    if (typeof fn !== 'function') {
      console.log(`FAIL ${lang}.${key}: not a function (got ${typeof fn})`)
      failures++
      continue
    }
    const out = fn(sample)
    if (typeof out !== 'string' || out.length < 5) {
      console.log(`FAIL ${lang}.${key}: empty/short output (len=${out?.length})`)
      failures++
      continue
    }
    // Each message must reference either the sample phone (fn takes a phone)
    // or the throttled numeric (fn takes a max). 'placeFailed' takes arbitrary
    // err text. All three shapes just need a non-empty interpolation.
    if (!out.includes(sample) && !out.includes(String(sample))) {
      // placeFailed uses err, throttled uses max — both still get sample echoed
      // (we pass sample as the sole arg), so this should hold in every branch.
      console.log(`FAIL ${lang}.${key}: sample "${sample}" not interpolated`)
      failures++
    }
  }
}

// Non-EN locales must NOT be identical to EN (catches copy-paste regressions)
const enBundle = pc.getTxt('en').testMyNumber
for (const lang of ['fr', 'zh', 'hi']) {
  const bundle = pc.getTxt(lang).testMyNumber
  const identicalKeys = KEYS.filter(k => {
    try {
      return enBundle[k](sample) === bundle[k](sample)
    } catch (e) {
      return false
    }
  })
  if (identicalKeys.length > 0) {
    console.log(`FAIL ${lang}: keys identical to EN → ${identicalKeys.join(', ')}`)
    failures++
  }
}

if (failures === 0) {
  console.log(`\n✅ testMyNumber i18n: all ${LANGS.length * KEYS.length} keys present + localized across ${LANGS.join(', ')}`)
  process.exit(0)
} else {
  console.log(`\n❌ ${failures} failures`)
  process.exit(1)
}
