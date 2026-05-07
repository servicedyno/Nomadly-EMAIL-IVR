/**
 * test_admin_reply_dedupe.js
 *
 * Regression guard for the @LBHAND23 (1794625076) incident on 2026-05-07:
 *   Admin pressed 💬 Reply under the "Session closed by user" notification,
 *   saw nothing (Mongo-induced callback_query timeout), pressed again, and
 *   both presses eventually processed → 2× "Type your message to @LBHAND23"
 *   prompts were sent.
 *
 * The fix in _index.js `aR:<target>` callback handler:
 *   1. ackPopup() must run BEFORE any Mongo work (prevents Telegram timeout)
 *   2. Dedupe: if the same admin already has an `awaitingAdminAction` of type
 *      `reply` for the same target within 30 s, skip the second prompt.
 *
 * This static test parses the source and asserts both properties hold.
 *
 * Run: node /app/js/tests/test_admin_reply_dedupe.js
 */
const fs = require('fs')
const path = require('path')

const src = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

// Find the aR: handler block
const start = src.indexOf(`if (data.startsWith('aR:'))`)
if (start === -1) { console.error('❌ aR: handler not found'); process.exit(1) }
const end = src.indexOf('// ── 📩 Deliver', start)
if (end === -1) { console.error('❌ end-of-handler marker not found'); process.exit(1) }
const block = src.slice(start, end)

let pass = 0, total = 0

function check(name, cond) {
  total++
  if (cond) { console.log(`✅ ${name}`); pass++ }
  else console.error(`❌ ${name}`)
}

// 1. ackPopup must come BEFORE any await set(state, adminId, 'awaitingAdminAction'
const ackIdx = block.indexOf("ackPopup('Type your reply")
const setIdx = block.indexOf("set(state, adminId, 'awaitingAdminAction'")
check('ackPopup called BEFORE set(state, awaitingAdminAction) — prevents Telegram callback timeout',
  ackIdx > 0 && setIdx > 0 && ackIdx < setIdx)

// 2. Dedupe guard exists (check for 30s window on awaitingAdminAction.ts)
check('Dedupe guard checks awaitingAdminAction.type === "reply" for same target',
  /aw\.type === 'reply'/.test(block) && /String\(aw\.target\) === String\(target\)/.test(block))

check('Dedupe window uses a recent-timestamp check (<= ~30s)',
  /Date\.now\(\) - \(aw\.ts \|\| 0\)\) < 30000/.test(block))

check('Dedupe path EARLY-RETURNS without sending duplicate prompt',
  /Deduped duplicate Reply press[\s\S]{0,150}return/.test(block))

// 4. ackPopup happy-path is called exactly once (not re-called inside the dedupe branch)
const happyPathAcks = (block.match(/ackPopup\('Type your reply/g) || []).length
check('ackPopup("Type your reply…") called exactly once (not re-called on dedupe)', happyPathAcks === 1)

console.log(`\n── ${pass}/${total} passed ──`)
process.exit(pass === total ? 0 : 1)
