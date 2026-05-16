/**
 * Regression test for the "Admin clicks 💬 Reply — bot not responding" bug.
 *
 * Diagnosis (from Railway log audit 2026-05-16 14:36):
 *   Admin tapped "💬 Reply User" 4× within 19 s. 1st press succeeded — bot
 *   sent the "Type your message" prompt. Presses 2-4 were SILENTLY deduped:
 *   the admin got the toast "Type your reply…" each time but no NEW chat
 *   message → admin perceived "bot not responding". Also the prompt has
 *   no force_reply, so on a noisy admin chat it scrolls 20+ messages up
 *   within seconds and the admin loses it.
 *
 * Fix in _index.js (aR: handler, ≈line 4398):
 *   1. On a "duplicate" press within the 30 s window, RE-EMIT the prompt
 *      (rather than silently dropping it) and slide the ts forward.
 *   2. The toast text becomes "Re-sending prompt…" on dupes so the admin
 *      gets explicit feedback that the prompt is being repeated.
 *   3. The prompt now attaches reply_markup.force_reply: true so Telegram
 *      auto-focuses the admin's keyboard with the prompt quoted — much
 *      more discoverable.
 *
 * This test does static source-grep checks against _index.js. Run:
 *   node js/__tests__/admin-reply-prompt.test.js
 */

const fs = require('fs')
const path = require('path')
const SRC = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

let passed = 0, failed = 0
const fails = []
function assert(label, cond, extra) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; fails.push({ label, extra }); console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`) }
}

console.log('\nadmin-reply-prompt — regression test')
console.log('─────────────────────────────────────')

const idx = SRC.indexOf("if (data.startsWith('aR:'))")
assert("aR: callback handler exists", idx > 0)

const block = SRC.slice(idx, idx + 4000)

// 1. force_reply is attached to the prompt's reply_markup
assert(
  "prompt attaches reply_markup.force_reply: true",
  /reply_markup:\s*\{[\s\S]*?force_reply:\s*true/.test(block)
)

// 2. input_field_placeholder is set so the admin sees "Reply to @… …"
assert(
  "prompt sets input_field_placeholder for the admin keyboard",
  /input_field_placeholder/.test(block)
)

// 3. On a dupe press the toast text changes (no longer silent)
assert(
  "on duplicate press the toast text becomes 'Re-sending prompt…' (not silent)",
  /Re-sending prompt/.test(block) && /isDupe \? 'Re-sending prompt…' : 'Type your reply…'/.test(block)
)

// 4. The prompt is re-emitted on every press — the `return` inside the
//    dedupe branch must NOT exist. The handler always reaches the send().
const earlyReturnInDedupe = /Deduped duplicate Reply press[^\n]*\n[\s\S]{0,80}return\b/.test(block)
assert(
  "dedupe branch does NOT short-circuit with `return` — prompt is re-emitted",
  !earlyReturnInDedupe
)

// 5. The dedupe window timestamp is slid forward on every press
assert(
  "every press refreshes awaitingAdminAction.ts (new Date.now())",
  /awaitingAdminAction['"]\s*,\s*\{\s*type:\s*['"]reply['"]\s*,\s*target\s*,\s*ts:\s*Date\.now\(\)/.test(block)
)

// 6. The 30 s window threshold is still present (we slide it, not remove it)
assert(
  "30 s dedupe-detection window is still computed (informational on dupes)",
  /30000\b/.test(block)
)

// 7. Original 2026-05-07 fix is preserved — callback is acked before any
//    Mongo write (ack still appears before set(state, ...)).
const ackIdx = block.indexOf('await ackPopup(')
const setIdx = block.indexOf("await set(state, adminId, 'awaitingAdminAction'")
assert(
  "ack still runs BEFORE the Mongo state write (original race-condition fix preserved)",
  ackIdx > 0 && setIdx > 0 && ackIdx < setIdx,
  `ackIdx=${ackIdx} setIdx=${setIdx}`
)

console.log('─────────────────────────────────────')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFAILURES:')
  fails.forEach(f => console.log(`  ✗ ${f.label}${f.extra ? ` — ${f.extra}` : ''}`))
  process.exit(1)
}
process.exit(0)
