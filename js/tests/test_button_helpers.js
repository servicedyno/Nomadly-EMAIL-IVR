/**
 * Tests for isCancelPress / isYesPress / isNoPress helpers + lang-file
 * standardization of the top-level `t` object.
 *
 * Run with: node js/tests/test_button_helpers.js
 */
const fs = require('fs')
const path = require('path')

let pass = 0, fail = 0
function ok(name, cond, note = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} — ${note}`) }
}

// ─── Mirror the implementations from _index.js ───────────────────────
function isCancelPress(message) {
  if (!message || typeof message !== 'string') return false
  const m = message.trim()
  const stripped = m.replace(/^[\p{Extended_Pictographic}\u200d\ufe0f\s❌❎🚫]+/u, '').trim()
  const knownCancels = new Set(['Cancel', 'Annuler', '取消', 'रद्द करें'])
  return knownCancels.has(stripped)
}
function isYesPress(message) {
  if (!message || typeof message !== 'string') return false
  const m = message.trim()
  const stripped = m.replace(/^[\p{Extended_Pictographic}\u200d\ufe0f\s✅✔]+/u, '').trim()
  const knownYes = new Set(['Yes', 'Oui', '是', 'हाँ', 'Confirm', 'Confirmer', '确认', 'पुष्टि करें'])
  return knownYes.has(stripped)
}
function isNoPress(message) {
  if (!message || typeof message !== 'string') return false
  const m = message.trim()
  const stripped = m.replace(/^[\p{Extended_Pictographic}\u200d\ufe0f\s❌❎🚫]+/u, '').trim()
  const knownNo = new Set(['No', 'Non', '否', 'नहीं'])
  return knownNo.has(stripped)
}

// ─── Source-level assertions ─────────────────────────────────────────
const src = fs.readFileSync(path.resolve(__dirname, '..', '_index.js'), 'utf8')
ok('isCancelPress defined in _index.js', /function\s+isCancelPress/.test(src))
ok('isYesPress defined in _index.js',    /function\s+isYesPress/.test(src))
ok('isNoPress defined in _index.js',     /function\s+isNoPress/.test(src))
ok('NO residual "message === t.cancel"', !/message\s*===\s*t\.cancel\b/.test(src))
ok('NO residual "message === t.yes"',    !/message\s*===\s*t\.yes\b/.test(src))
ok('NO residual "message === t.no"',     !/message\s*===\s*t\.no\b/.test(src))

// ─── Lang-file standardization (top-level `t` object) ────────────────
const en = fs.readFileSync(path.resolve(__dirname, '..', 'lang', 'en.js'), 'utf8')
const fr = fs.readFileSync(path.resolve(__dirname, '..', 'lang', 'fr.js'), 'utf8')
const zh = fs.readFileSync(path.resolve(__dirname, '..', 'lang', 'zh.js'), 'utf8')
const hi = fs.readFileSync(path.resolve(__dirname, '..', 'lang', 'hi.js'), 'utf8')

ok('en t.cancel has ❌',  /^\s*cancel:\s*'❌ Cancel'/m.test(en))
ok('fr t.cancel has ❌',  /^\s*cancel:\s*'❌ Annuler'/m.test(fr))
ok('zh t.cancel has ❌',  /^\s*cancel:\s*'❌ 取消'/m.test(zh))
ok('hi t.cancel has ❌',  /^\s*cancel:\s*'❌ रद्द करें'/m.test(hi))
ok('en t.yes has ✅',     /^\s*yes:\s*'✅ Yes'/m.test(en))
ok('fr t.yes has ✅',     /^\s*yes:\s*'✅ Oui'/m.test(fr))
ok('zh t.yes has ✅',     /^\s*yes:\s*'✅ 是'/m.test(zh))
ok('hi t.yes has ✅',     /^\s*yes:\s*'✅ हाँ'/m.test(hi))
ok('en t.no has ❌',      /^\s*no:\s*'❌ No'/m.test(en))
ok('fr t.no has ❌',      /^\s*no:\s*'❌ Non'/m.test(fr))
ok('zh t.no has ❌',      /^\s*no:\s*'❌ 否'/m.test(zh))
ok('hi t.no has ❌',      /^\s*no:\s*'❌ नहीं'/m.test(hi))

// ─── isCancelPress ────────────────────────────────────────────────
ok('isCancelPress("❌ Cancel")',          isCancelPress('❌ Cancel'))
ok('isCancelPress("Cancel")',             isCancelPress('Cancel'))
ok('isCancelPress("❌ Annuler")',         isCancelPress('❌ Annuler'))
ok('isCancelPress("Annuler")',            isCancelPress('Annuler'))
ok('isCancelPress("❌ 取消")',             isCancelPress('❌ 取消'))
ok('isCancelPress("取消")',                isCancelPress('取消'))
ok('isCancelPress("❌ रद्द करें")',         isCancelPress('❌ रद्द करें'))
ok('isCancelPress("🚫 Cancel")',          isCancelPress('🚫 Cancel'))
ok('isCancelPress("  ❌ Cancel  ")',      isCancelPress('  ❌ Cancel  '))
ok('!isCancelPress("Continue")',          !isCancelPress('Continue'))
ok('!isCancelPress(null)',                !isCancelPress(null))
ok('!isCancelPress(undefined)',           !isCancelPress(undefined))
ok('!isCancelPress("")',                  !isCancelPress(''))

// ─── isYesPress ────────────────────────────────────────────────
ok('isYesPress("✅ Yes")',                isYesPress('✅ Yes'))
ok('isYesPress("Yes")',                   isYesPress('Yes'))
ok('isYesPress("✅ Oui")',                isYesPress('✅ Oui'))
ok('isYesPress("Oui")',                   isYesPress('Oui'))
ok('isYesPress("✅ 是")',                 isYesPress('✅ 是'))
ok('isYesPress("✅ हाँ")',                isYesPress('✅ हाँ'))
ok('isYesPress("✅ Confirm")',            isYesPress('✅ Confirm'))
ok('isYesPress("Confirm")',               isYesPress('Confirm'))
ok('!isYesPress("OK")',                   !isYesPress('OK'))
ok('!isYesPress("No")',                   !isYesPress('No'))

// ─── isNoPress ────────────────────────────────────────────────
ok('isNoPress("❌ No")',                  isNoPress('❌ No'))
ok('isNoPress("No")',                     isNoPress('No'))
ok('isNoPress("❌ Non")',                 isNoPress('❌ Non'))
ok('isNoPress("Non")',                    isNoPress('Non'))
ok('isNoPress("❌ 否")',                  isNoPress('❌ 否'))
ok('isNoPress("नहीं")',                  isNoPress('नहीं'))
ok('!isNoPress("Yes")',                   !isNoPress('Yes'))
ok('!isNoPress("Cancel")',                !isNoPress('Cancel'))

console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
