'use strict'
/**
 * Offline verification: every VPS-password string used by the Telegram inline
 * keyboard + reset/reveal flows must exist and render to a non-empty string
 * (no `undefined`) in every supported language. A missing key here is exactly
 * what crashed the bot for non-English users (undefined inline-keyboard button).
 *
 * Run: node js/__tests__/vps-password-i18n.verify.js
 */

const LANGS = ['en', 'fr', 'zh', 'hi']

// Keys that are fed DIRECTLY into an inline-keyboard button → must be non-empty
// strings or Telegram rejects the whole keyboard.
const BUTTON_KEYS = ['revealPasswordBtn', 'resetPasswordBtn', 'reinstallWindowsBtn']

// Message builders. [name, args, mustInclude]
const FN_CASES = [
  ['revealPasswordChecking', ['My VPS'], []],
  ['revealPasswordFailed', ['My VPS'], []],
  ['revealPasswordNotStored', ['My VPS', 'no stored password'], ['My VPS']],
  ['revealPasswordSuccess', ['My VPS', '1.2.3.4', 'root', 'Pw1', { isRDP: false, verification: { status: 'ok' } }], ['1.2.3.4', 'root', 'Pw1']],
  ['revealPasswordSuccess', ['My VPS', '1.2.3.4', 'root', 'Pw1', { isRDP: false, verification: { status: 'password_wrong' } }], ['Pw1']],
  ['revealPasswordSuccess', ['My VPS', '1.2.3.4', 'root', 'Pw1', { isRDP: false, verification: { status: 'password_auth_disabled' } }], ['Pw1']],
  ['revealPasswordSuccess', ['My VPS', '1.2.3.4', 'root', 'Pw1', { isRDP: false, verification: { status: 'unreachable' } }], ['Pw1']],
  ['revealPasswordSuccess', ['My VPS', '1.2.3.4', 'root', 'Pw1', { recovered: true, verification: { status: 'ok' } }], ['1.2.3.4']],
  ['revealPasswordSuccess', ['RDP-1', '1.2.3.4', 'Administrator', 'Pw1', { isRDP: true }], ['3389', 'Administrator']],
  ['confirmResetPasswordText', ['My VPS'], ['My VPS']],
  ['confirmResetPasswordText', ['My VPS', { mode: 'in-place', isRDP: false }], ['My VPS']],
  ['confirmResetPasswordText', ['My VPS', { mode: 'reinstall', isRDP: false }], ['My VPS']],
  ['confirmResetPasswordText', ['My VPS', { mode: 'rebuild-emailed', isRDP: false }], ['My VPS']],
  ['passwordResetInProgress', ['My VPS'], ['My VPS']],
  ['passwordResetInProgress', ['My VPS', { mode: 'in-place' }], ['My VPS']],
  ['passwordResetSuccess', ['My VPS', '1.2.3.4', 'root', 'NewPw9', { isRDP: false, dataPreserved: true, verified: true }], ['1.2.3.4', 'root', 'NewPw9']],
  ['passwordResetSuccess', ['My VPS', '1.2.3.4', 'root', 'NewPw9', { isRDP: false, dataPreserved: false }], ['NewPw9']],
  ['passwordResetSuccess', ['RDP-1', '1.2.3.4', 'Administrator', 'NewPw9', { isRDP: true, dataPreserved: true }], ['3389', 'NewPw9']],
]

// The default (in-place) confirm screen MUST carry a clear "your data is kept"
// note — the user's core request. One accepted phrase per language.
const DATA_KEPT_PHRASE = {
  en: 'data is kept',
  fr: 'données sont conservées',
  zh: '您的数据将保留',
  hi: 'आपका डेटा सुरक्षित रहता है',
}

let failures = 0
const fail = (msg) => { failures++; console.error('  ❌ ' + msg) }

for (const lang of LANGS) {
  console.log(`\n=== ${lang} ===`)
  const vp = require(`../lang/${lang}.js`)[lang].vp
  if (!vp) { fail(`${lang}: no vp object`); continue }

  // 1. keyboard buttons must be non-empty strings
  for (const k of BUTTON_KEYS) {
    if (typeof vp[k] !== 'string' || !vp[k].length) fail(`${lang}.${k} is not a non-empty string (got ${typeof vp[k]})`)
  }

  // 2. simulate the actual keyboard row build (js/_index.js ~11720)
  const row = [vp.revealPasswordBtn, vp.resetPasswordBtn, vp.reinstallWindowsBtn]
  if (row.some(b => b === undefined || b === null || b === '')) fail(`${lang}: keyboard row has empty/undefined button → Telegram would reject it`)

  // 3. message builders must render clean strings
  for (const [name, args, mustInclude] of FN_CASES) {
    const fn = vp[name]
    if (typeof fn !== 'function') { fail(`${lang}.${name} is not a function (got ${typeof fn})`); continue }
    let out
    try { out = fn(...args) } catch (e) { fail(`${lang}.${name} threw: ${e.message}`); continue }
    if (typeof out !== 'string' || !out.length) { fail(`${lang}.${name} did not return a non-empty string`); continue }
    if (out.includes('undefined')) fail(`${lang}.${name} output contains the literal "undefined"`)
    if (out.includes('[object Object]')) fail(`${lang}.${name} output contains "[object Object]"`)
    for (const needle of mustInclude) {
      if (!out.includes(needle)) fail(`${lang}.${name} output missing expected "${needle}"`)
    }
  }

  // 4. data-is-kept note on the default confirm screen
  const confirmDefault = vp.confirmResetPasswordText('My VPS', { mode: 'in-place' })
  if (!confirmDefault.includes(DATA_KEPT_PHRASE[lang])) fail(`${lang}.confirmResetPasswordText (in-place) missing data-kept note "${DATA_KEPT_PHRASE[lang]}"`)
  else console.log(`  ✅ data-kept note present`)
  console.log(`  ✅ all ${BUTTON_KEYS.length} buttons + ${FN_CASES.length} render cases passed`)
}

console.log(`\n${failures === 0 ? '✅ ALL LANGUAGES PASSED' : `❌ ${failures} FAILURE(S)`}`)
process.exit(failures === 0 ? 0 : 1)
