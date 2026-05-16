/**
 * Regression test for the @LBHAND23 (2026-02) IVR bug:
 *
 *   User taps "📞 New Call" → bot used to auto-load the PREVIOUS call's
 *   template / placeholders / audio because the prior `ivrObData` was kept
 *   in state and the downstream `ivrObEnterTarget` handler shortcuts when
 *   it sees `fromPreset=true` & `audioUrl/templateText` set.
 *
 * Fix: the "📞 New Call" handler MUST reset `ivrObData` to a clean
 * `{ isTrial: false }` BEFORE prompting for caller-ID selection.
 *
 * Because the bot lives inside the 35k-LOC `_index.js` file (not yet
 * modularised), this test does a focused static check of the source: it
 * locates the New-Call handler block and asserts the reset call sits
 * between the `if (message === '📞 New Call')` line and the `return send`
 * line that shows the caller-ID keyboard.
 *
 * Run:  node js/__tests__/ivr-new-call-reset.test.js
 */

const fs = require('fs')
const path = require('path')

const SRC = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

let passed = 0
let failed = 0
const fails = []

function assert(label, cond, extra) {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${label}`)
  } else {
    failed += 1
    fails.push({ label, extra })
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`)
  }
}

console.log('\nivr-new-call-reset — regression test')
console.log('─────────────────────────────────────')

// 1. Locate the "📞 New Call" handler line
const newCallIdx = SRC.indexOf("if (message === '📞 New Call')")
assert('handler "if (message === \'📞 New Call\')" exists in _index.js', newCallIdx > 0)

// 2. Extract a window of ~30 lines starting from the handler
const handlerWindow = SRC.slice(newCallIdx, newCallIdx + 1200)

// 3. Must reset ivrObData BEFORE returning the caller-ID prompt.
//    The reset writes a fresh object — `isTrial: false` is the only field
//    we keep. Anything else (fromPreset / templateText / audioUrl /
//    placeholderValues / scriptText etc.) MUST be wiped.
const resetMatch = handlerWindow.match(
  /saveInfo\(\s*['"]ivrObData['"]\s*,\s*\{\s*isTrial:\s*false\s*\}\s*\)/
)
assert('handler resets ivrObData to a clean object before returning', !!resetMatch)

// 4. The reset must appear BEFORE the return send(... trans('t.cp_15') ...)
//    line so the caller-ID prompt is shown on a clean slate.
const promptIdx = handlerWindow.indexOf("trans('t.cp_15')")
const resetIdx = resetMatch ? handlerWindow.indexOf(resetMatch[0]) : -1
assert(
  'reset runs BEFORE the caller-ID prompt (`trans(\'t.cp_15\')`)',
  resetIdx > 0 && promptIdx > 0 && resetIdx < promptIdx,
  `resetIdx=${resetIdx}, promptIdx=${promptIdx}`
)

// 5. Sanity: the reset must NOT carry over any of the leaking fields.
const leakyFields = [
  'fromPreset', 'templateText', 'templateName', 'templateKey',
  'placeholderValues', 'placeholders', 'placeholderIndex',
  'audioUrl', 'audioPath', 'scriptText', 'filledText',
  'activeKeys', 'ivrMode', 'voiceName', 'voiceKey', 'voiceSpeed',
  'targetNumber', 'batchTargets', 'holdMusic',
  'otpLength', 'otpMaxAttempts', 'otpConfirmMsg', 'otpRejectMsg',
  'customScript', 'category',
]
const resetCall = resetMatch ? resetMatch[0] : ''
const leaked = leakyFields.filter(f => resetCall.includes(f))
assert(
  'reset object carries NONE of the per-call leak-prone fields',
  leaked.length === 0,
  leaked.length ? `leaked: ${leaked.join(', ')}` : ''
)

// 6. The legitimate Redial handler (line ≈3952) must remain untouched —
//    redial INTENTIONALLY reuses lastIvrCallParams.
const redialIdx = SRC.indexOf("if (chatId && data.startsWith('ivr_redial:'))")
assert('redial handler (ivr_redial:) is still present', redialIdx > 0)
const redialWindow = SRC.slice(redialIdx, redialIdx + 2000)
assert(
  'redial handler still reads voiceService.lastIvrCallParams.get(chatId)',
  redialWindow.includes('voiceService.lastIvrCallParams.get(chatId)')
)

// 7. The IVR Outbound menu entry (≈line 18675) must still preserve drafts
//    (this path runs BEFORE the user taps New Call — we only want the
//    reset to fire on the explicit New-Call tap, not on every menu open).
const menuEntryMatch = SRC.match(
  /\/\/ UX-fix-2: don't blow away ivrObData if the user has an active draft[\s\S]{0,400}saveInfo\(\s*'ivrObData'\s*,\s*\{\s*\.\.\.existing\s*,\s*isTrial:\s*false\s*\}\s*\)/
)
assert('menu-entry draft-preservation logic is still intact', !!menuEntryMatch)

console.log('─────────────────────────────────────')
console.log(`${passed} passed, ${failed} failed`)

if (failed > 0) {
  console.log('\nFAILURES:')
  fails.forEach(f => console.log(`  ✗ ${f.label}${f.extra ? ` — ${f.extra}` : ''}`))
  process.exit(1)
}
process.exit(0)
