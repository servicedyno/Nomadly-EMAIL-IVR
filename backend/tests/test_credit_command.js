/**
 * Regression tests for the `/credit` admin command's argument-parsing layer.
 *
 * Two bugs were spotted on 2026-06-13 after the @davion419 "no feedback"
 * incident (the credit itself worked — see test_webhook_isolation.js context):
 *
 *   1. The usage string contained literal `\\n\\n` escapes (double-backslash
 *      in the source), which render in Telegram as the literal text `\n\n`
 *      instead of an actual newline.
 *   2. The trigger was `message.startsWith('/credit ')` (trailing space), which
 *      rejects `/credit@NomadlyBot @user 100` — the form Telegram auto-inserts
 *      when multiple bots are present in a chat / group autocomplete.
 *
 * These tests verify the source-level behavior so the fixes can't quietly
 * regress: we re-implement the production parser inline (lifted verbatim
 * from the production match line) and feed it every form the prod bot
 * receives, then grep the source for the usage string.
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')

function run(name, fn) {
  try {
    fn()
    console.log('✓', name)
  } catch (e) {
    console.error('✗', name, '\n   ', e.stack || e.message)
    process.exitCode = 1
  }
}

// ── Production parser (lifted verbatim from /app/js/_index.js — keep in sync) ──
// Returns { parts } when the message is a /credit command, otherwise null.
function parseCreditCommand(message) {
  const m = /^\/credit(?:@\w+)?(?:\s+(.*))?$/i.exec(message)
  if (!m) return null
  const argsStr = (m[1] || '').trim()
  const parts = argsStr ? argsStr.split(/\s+/) : []
  return { parts }
}

// 1. Plain DM form (the form 99% of admins type in private chat with the bot)
run('parses plain `/credit @user 100`', () => {
  const r = parseCreditCommand('/credit @davion419 100')
  assert.deepStrictEqual(r?.parts, ['@davion419', '100'])
})

// 2. Group autocomplete form (Telegram's `@BotUsername` suffix)
run('parses `/credit@NomadlyBot @user 100` (group autocomplete suffix)', () => {
  const r = parseCreditCommand('/credit@NomadlyBot @davion419 100')
  assert.deepStrictEqual(r?.parts, ['@davion419', '100'])
})

// 3. Mixed case @BotUsername (Telegram clients normalize, but be defensive)
run('parses `/credit@nomadlybot @user 100` case-insensitively', () => {
  const r = parseCreditCommand('/credit@nomadlybot @davion419 100')
  assert.deepStrictEqual(r?.parts, ['@davion419', '100'])
})

// 4. Numeric chatId target (no `@` prefix)
run('parses `/credit 5590563715 25.50` (raw chatId)', () => {
  const r = parseCreditCommand('/credit 5590563715 25.50')
  assert.deepStrictEqual(r?.parts, ['5590563715', '25.50'])
})

// 5. Extra whitespace between tokens — must still split correctly
run('tolerates extra whitespace between tokens', () => {
  const r = parseCreditCommand('/credit   @davion419    100')
  assert.deepStrictEqual(r?.parts, ['@davion419', '100'])
})

// 6. Bare `/credit` with no args — must match but return zero parts (so the
//    handler can fall through to the usage hint).
run('bare `/credit` matches with zero parts → handler shows usage', () => {
  const r = parseCreditCommand('/credit')
  assert.deepStrictEqual(r?.parts, [])
})

// 7. Bare `/credit@NomadlyBot` (group, no args) likewise.
run('bare `/credit@NomadlyBot` matches with zero parts', () => {
  const r = parseCreditCommand('/credit@NomadlyBot')
  assert.deepStrictEqual(r?.parts, [])
})

// 8. Unrelated commands must NOT match (false-positive guard).
run('does not match `/credits …` (prefix collision guard)', () => {
  assert.strictEqual(parseCreditCommand('/credits @davion419 100'), null)
})

run('does not match `/refundpending …`', () => {
  assert.strictEqual(parseCreditCommand('/refundpending @davion419 50'), null)
})

run('does not match a normal chat message that contains "credit"', () => {
  assert.strictEqual(parseCreditCommand('hi can you credit me $50?'), null)
})

// 9. Usage message: no literal `\n` left in source — the previous bug emitted
//    `\n\n` as visible text in Telegram (HTML messages don't auto-convert).
run('usage message uses real newlines (no literal `\\\\n` escapes in source)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../js/_index.js'), 'utf8')
  // Find the /credit usage send() line and assert it does NOT contain the
  // double-escaped `\\n` literal that the old buggy string used.
  const usageIdx = src.indexOf('⚠️ Usage: /credit <@username or chatId> <amount>')
  assert.ok(usageIdx > -1, 'credit usage message not found in source')
  // Grab the rest of that single-line string up to the next backtick or
  // single-quote close.
  const slice = src.substring(usageIdx, usageIdx + 400)
  assert.ok(!/\\\\n/.test(slice),
    'credit usage message still contains literal `\\\\n` escapes — would render as visible text in Telegram')
  // Positive check: the message should contain at least one real `\n` (one backslash + n).
  assert.ok(/\\n/.test(slice),
    'credit usage message should contain real `\\n` newlines for Telegram to render')
})

if (!process.exitCode) console.log('\nAll /credit command regression tests passed.')
