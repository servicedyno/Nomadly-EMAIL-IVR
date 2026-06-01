/**
 * Regression test for the @Lets_spam Quick IVR Call UX bugs (2026-06-01).
 *
 * Customer @Lets_spam (chatId 1506649532) bought the Business CloudIVR plan
 * and then spent ~30 min trying to make a single outbound call. Railway
 * logs (17:05:48 onward) showed they kept typing the destination number
 * (+16195323733) into the Caller-ID picker, getting back the generic
 * "Please select a valid number from the list." error. They opened two
 * support sessions confused about "changing my SIP caller ID".
 *
 * Three root-cause UX bugs:
 *   1. "Caller ID" was used in user-facing prompts. Customers expect that
 *      to mean the destination, but the bot used it for the FROM number.
 *   2. When the user typed the destination instead of tapping their own
 *      number, the error gave no hint that taps were required.
 *   3. The destination prompt advertised "Batch:" inline next to "Example:",
 *      implying the bot only does batches (or that it requires multiple
 *      numbers).
 *
 * Fix: surgical wording-only changes to cp_15, cp_24, cp_25, cp_26, cp_27
 * across all 4 lang files + `phone-config.js#selectByIndex` across all 4
 * locales. No flow / action / state changes.
 *
 * This test asserts:
 *   A. Each fixed key uses the new clearer wording in every locale.
 *   B. The buggy phrases (e.g. "Caller ID:" as a bare label, "Batch:"
 *      inline with "Example:") no longer appear in the user-facing keys.
 *   C. The "Step 1/2" scaffolding is consistent in cp_15 and cp_26.
 *   D. phone-config.js#selectByIndex now hints "tap one of the index
 *      numbers" in every locale.
 *   E. All affected files parse.
 *
 * Run:  node tests/test_quick_ivr_call_ux_fix.js
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

const FILES = ['en', 'fr', 'hi', 'zh'].map(lang => ({
  lang,
  path: path.join(__dirname, '..', 'js', 'lang', `${lang}.js`),
}))
const phoneConfigPath = path.join(__dirname, '..', 'js', 'phone-config.js')

// ───────────────────────────────────────────────────────────
// Test A — every locale has the new wording
// ───────────────────────────────────────────────────────────
console.log('\nTest A: every locale has the new clearer wording for cp_15/24/25/26/27')

for (const { lang, path: p } of FILES) {
  const src = fs.readFileSync(p, 'utf8')

  // A1: cp_25 must NOT include the standalone "Caller ID: <b>${phoneNumber}</b>"
  // pattern that customers misread as "destination". The new prompt uses
  // "Calling from:" / "Appel depuis :" / "इस नंबर से कॉल:" / "从此号码呼叫".
  const cp25 = src.match(/^ cp_25: \(phoneNumber\) =>.*?,$/m)?.[0] || ''
  assert(cp25.length > 0, `A.${lang}.0 cp_25 found`)
  assert(!/📱 (Caller ID|ID Appelant|कॉलर ID|来电显示): <b>\$\{phoneNumber\}<\/b>\n\nEnter/.test(cp25),
         `A.${lang}.1 cp_25 no longer leads with "Caller ID: ${'<phoneNumber>'}" before a typed-input prompt`)

  // A2: cp_25 must contain a "Calling from"-style label (locale-specific)
  const cp25Hints = {
    en: /Calling from:/,
    fr: /Appel depuis ?:/,
    hi: /इस नंबर से कॉल:/,
    zh: /从此号码呼叫/,
  }
  assert(cp25Hints[lang].test(cp25),
         `A.${lang}.2 cp_25 uses the new "Calling from"-style label`)

  // A3: cp_25 must NOT advertise "Batch:" / "Lot:" / "बैच:" / "批量:" inline.
  // The new copy frames multi-call as an aside, not a requirement.
  assert(!/<i>(Batch|Lot|बैच|批量): \+1/.test(cp25),
         `A.${lang}.3 cp_25 no longer advertises bare "Batch:" inline with "Example:"`)

  // A4: cp_24 (typed-input error) must now hint "tap" and tell them WHY
  //     typing fails. Don't just say "invalid".
  const cp24 = src.match(/^ cp_24: '.*?',$/m)?.[0] || ''
  assert(cp24.length > 0, `A.${lang}.4 cp_24 found`)
  const cp24TapHints = {
    en: /Tap one of your phone numbers/,
    fr: /Touchez l\\'un de vos numéros/,
    hi: /अपने फ़ोन नंबरों में से किसी एक पर टैप करें/,
    zh: /请点击下方键盘中您的某个电话号码/,
  }
  assert(cp24TapHints[lang].test(cp24),
         `A.${lang}.5 cp_24 now explicitly hints to TAP a number`)

  // A5: cp_26 (Quick IVR FROM-selector header) — Step 1/2 scaffold.
  const cp26 = src.match(/^ cp_26: '.*?',$/m)?.[0] || ''
  const stepRe = {
    en: /Step 1\/2:/,
    fr: /Étape 1\/2 ?:/,
    hi: /चरण 1\/2:/,
    zh: /第 1\/2 步：/,
  }
  assert(stepRe[lang].test(cp26),
         `A.${lang}.6 cp_26 now scaffolds the flow with "Step 1/2"`)

  // A6: cp_15 (New IVR Call FROM-selector header) — same Step 1/2 scaffold.
  const cp15 = src.match(/^ cp_15: '.*?',$/m)?.[0] || ''
  assert(stepRe[lang].test(cp15),
         `A.${lang}.7 cp_15 now scaffolds the flow with "Step 1/2"`)
}

// ───────────────────────────────────────────────────────────
// Test B — exact-string regression guard so the old buggy strings
// can't accidentally be re-introduced.
// ───────────────────────────────────────────────────────────
console.log('\nTest B: the buggy original strings are gone (no accidental revert)')

const buggyOriginals = [
  // en
  ['en', "Please select a valid number from the list.", 'cp_24 old EN'],
  ['en', "Call a single number with an automated IVR message.\\n\\nSelect the number to call FROM (Caller ID):", 'cp_26 old EN'],
  ['en', "📱 Caller ID: <b>${phoneNumber}</b>\n\nEnter the phone number to call (or multiple separated by commas):\n<i>Example: +12025551234</i>\n<i>Batch: +12025551234, +12025555678</i>", 'cp_25 old EN'],
  // fr
  ['fr', "Veuillez sélectionner un numéro valide dans la liste.", 'cp_24 old FR'],
  ['fr', "Sélectionnez le numéro d'appel SORTANT (ID Appelant) :", 'cp_26/15 old FR'],
  // hi
  ['hi', "कृपया सूची से एक वैध नंबर चुनें।", 'cp_24 old HI'],
  ['hi', "आउटगोइंग नंबर (कॉलर ID) चुनें:", 'cp_26/15 old HI'],
  // zh
  ['zh', "请从列表中选择有效号码。", 'cp_24 old ZH'],
  ['zh', "选择呼出号码（来电显示）：", 'cp_26/15 old ZH'],
]
for (const [lang, str, name] of buggyOriginals) {
  const fp = FILES.find(f => f.lang === lang).path
  const src = fs.readFileSync(fp, 'utf8')
  assert(!src.includes(str), `B.${lang}.${name}: buggy original string is gone`)
}

// ───────────────────────────────────────────────────────────
// Test C — phone-config.js selectByIndex hint in every locale
// ───────────────────────────────────────────────────────────
console.log('\nTest C: phone-config.js selectByIndex hints "tap one of the index numbers" in every locale')

const pcSrc = fs.readFileSync(phoneConfigPath, 'utf8')

const indexHints = [
  /selectByIndex: 'Tap one of the index numbers/,
  /selectByIndex: 'Select a number by tapping its index\.',/,  // negative — must NOT match (post-fix)
]
assert(!indexHints[1].test(pcSrc), 'C1 old "Select a number by tapping its index." gone')
assert(/💡 Tap one of the index numbers \(1, 2, 3…\)/.test(pcSrc),
       'C2 English selectByIndex has the new tap-hint')
assert(/Touchez l\\'un des indices \(1, 2, 3…\)/.test(pcSrc),
       'C3 French selectByIndex has the new tap-hint')
assert(/请点击下方键盘中的序号（1、2、3…）/.test(pcSrc),
       'C4 Chinese selectByIndex has the new tap-hint')
assert(/नीचे कीबोर्ड में किसी एक इंडेक्स \(1, 2, 3…\)/.test(pcSrc),
       'C5 Hindi selectByIndex has the new tap-hint')

// ───────────────────────────────────────────────────────────
// Test D — every touched file parses
// ───────────────────────────────────────────────────────────
console.log('\nTest D: every touched file parses')

for (const { lang, path: p } of FILES) {
  const r = spawnSync('node', ['--check', p], { encoding: 'utf8' })
  assert(r.status === 0, `D ${lang}.js parses (stderr: ${r.stderr.trim() || 'none'})`)
}
const r = spawnSync('node', ['--check', phoneConfigPath], { encoding: 'utf8' })
assert(r.status === 0, `D phone-config.js parses (stderr: ${r.stderr.trim() || 'none'})`)

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
