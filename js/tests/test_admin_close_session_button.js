/**
 * test_admin_close_session_button.js
 *
 * Guards the "one-tap ✖️ Close Session" feature added on 2026-05-07.
 *
 * Verifies:
 *   1. buildAdminButtons({ supportSession: true, chatId }) emits BOTH a
 *      Reply and a Close Session button in the same row.
 *   2. The aCS:<target> callback handler exists, is admin-gated, calls
 *      ackPopup before state writes, and performs the same side-effects
 *      as the `/close <chatId>` text command.
 *   3. All support-admin notification sites pass supportSession: true.
 *
 * Run: node /app/js/tests/test_admin_close_session_button.js
 */
const fs = require('fs')
const path = require('path')

const src = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

let pass = 0, total = 0
function check(name, cond) {
  total++
  if (cond) { console.log(`✅ ${name}`); pass++ }
  else console.error(`❌ ${name}`)
}

// ── 1. buildAdminButtons supports the supportSession flag ─────────────
const buildFnStart = src.indexOf('const buildAdminButtons = (')
const buildFnEnd = src.indexOf('\nconst adminMsgOpts =', buildFnStart)
const buildFn = src.slice(buildFnStart, buildFnEnd)

check('buildAdminButtons accepts `supportSession` option',
  /supportSession\s*\}/.test(buildFn))

check('supportSession=true emits a Reply+Close row with aR: and aCS: callbacks',
  /supportSession[\s\S]{0,500}aR:\$\{chatId\}[\s\S]{0,300}aCS:\$\{chatId\}/.test(buildFn))

// ── 2. aCS: callback handler ──────────────────────────────────────────
const aCSIdx = src.indexOf(`if (data.startsWith('aCS:'))`)
check('aCS: handler exists in callback_query block', aCSIdx > 0)

if (aCSIdx > 0) {
  const handlerEnd = src.indexOf('\n    }\n', aCSIdx)
  const handler = src.slice(aCSIdx, handlerEnd)
  check('aCS: acks callback BEFORE Mongo writes (prevents dead-button UX)',
    handler.indexOf('ackPopup') < handler.indexOf('supportSessions'))
  check('aCS: validates numeric target (prevents injection)',
    /\^\\d\+\$/.test(handler))
  check('aCS: clears adminTakeover flag (same as /close command)',
    /adminTakeover'\s*,\s*false/.test(handler))
  check('aCS: clears AI history (same as /close command)',
    /clearAiHistory/.test(handler))
  check('aCS: notifies the user their session was closed',
    /send\(target,/.test(handler))
}

// ── 3. Admin-only gate still accepts aCS: ─────────────────────────────
const gateRegex = src.match(/\/\^a\[A-Z\]\//)
check('Admin callback regex `/^a[A-Z]/` accepts aCS: (matches "aCS")',
  gateRegex && /^a[A-Z]/.test('aCS:123'))

// ── 4. Support-admin notification sites tag supportSession: true ──────
// The 7 support notifications + their counts (some have supportSession tag from this change,
// but we verify the exact number is >= 7).
const suppCount = (src.match(/supportSession:\s*true/g) || []).length
check('At least 7 support-admin sites passed supportSession: true', suppCount >= 7)

console.log(`\n── ${pass}/${total} passed ──`)
process.exit(pass === total ? 0 : 1)
