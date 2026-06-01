/**
 * Regression test for the @Lets_spam double-notification bug (2026-06-01).
 *
 * Customer @Lets_spam (chatId 1506649532) bought a Business CloudIVR plan
 * ($120/mo) via Wallet USD. Railway logs showed the admin DM and the
 * notification group each received TWO notifications instead of one.
 *
 * Root cause (`js/_index.js`):
 *   - `executeTwilioPurchase()` (module scope, line ~2109) ends with a
 *     `notifyGroup(...)` call covering both regular and sub purchases.
 *   - A 2026-05-30 change *also* added `notifyGroup(...)` blocks at
 *     line ~10181 (sub) and ~10192 (regular) inside the Wallet-USD
 *     CloudIVR action handler, on the false assumption that Twilio had
 *     no inner call. The result: every Twilio Wallet-USD purchase fired
 *     two admin DMs and two group posts.
 *
 * Fix: remove the duplicate `notifyGroup` blocks from the Wallet-USD
 * action handler. `executeTwilioPurchase()` remains the single source.
 *
 * This test asserts:
 *   A. The duplicate `notifyGroup(...)` blocks are gone from the
 *      Wallet-USD CloudIVR action handler (chat-id 1506649532 path).
 *   B. `executeTwilioPurchase()` still owns ONE `notifyGroup(...)` call
 *      that fires for BOTH regular and sub purchases.
 *   C. The Telnyx branch is untouched (still has its own `notifyGroup`
 *      because `telnyxApi.buyNumber` does NOT fire it internally).
 *   D. `node --check` on the patched file.
 *
 * Run:  node tests/test_cloudivr_double_notification.js
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

const indexPath = path.join(__dirname, '..', 'js', '_index.js')
const src = fs.readFileSync(indexPath, 'utf8')

// ───────────────────────────────────────────────────────────
// Helper — extract a function body by name (single top-level
// async function declaration). We use a brace-balanced scan
// so we don't trip on nested braces.
// ───────────────────────────────────────────────────────────
function extractAsyncFunctionBody(source, name) {
  const sig = `async function ${name}(`
  const start = source.indexOf(sig)
  if (start === -1) return ''
  let i = source.indexOf('{', start)
  if (i === -1) return ''
  let depth = 0
  const open = i
  for (; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  return source.slice(open)
}

const executeBody = extractAsyncFunctionBody(src, 'executeTwilioPurchase')
assert(executeBody.length > 0, 'A0 located executeTwilioPurchase body')

// ───────────────────────────────────────────────────────────
// Test A — executeTwilioPurchase still has exactly TWO notifyGroup calls
// (one in the regular-purchase branch + one in the sub-purchase branch)
// ───────────────────────────────────────────────────────────
console.log('\nTest A: executeTwilioPurchase is the single source of admin notifications')

const innerNotifyGroupCount = (executeBody.match(/\bnotifyGroup\(/g) || []).length
assert(innerNotifyGroupCount === 2, `A1 executeTwilioPurchase contains 2 notifyGroup calls — one per branch (found ${innerNotifyGroupCount})`)

assert(/_adminTxt\.adminPurchase\(/.test(executeBody),    'A2 executeTwilioPurchase notifies for regular purchases')
assert(/_adminTxt\.adminSubPurchase\(/.test(executeBody), 'A3 executeTwilioPurchase notifies for sub purchases')

// ───────────────────────────────────────────────────────────
// Test B — the Wallet-USD CloudIVR action handler no longer
// calls notifyGroup directly (regression from 2026-05-30).
// ───────────────────────────────────────────────────────────
console.log('\nTest B: Wallet-USD action handler no longer double-fires notifyGroup')

// The Wallet-USD CloudIVR action handler is the executeTwilioPurchase call
// that passes 'wallet_usd' as the paymentMethod. Use the full unique signature
// to find the exact call site (not just the literal 'wallet_usd' which appears
// in many comments and txPayMethod assignments earlier in the file).
const WALLET_CALL_SIG = "executeTwilioPurchase(chatId, selectedNumber, planKey, price, countryCode, countryName, info?.cpNumberType || 'local', 'wallet_usd'"
const walletCall = src.indexOf(WALLET_CALL_SIG)
assert(walletCall > 0, 'B0 located wallet_usd executeTwilioPurchase call site')
const windowStart = walletCall
const windowEnd = src.indexOf('// ── TELNYX PURCHASE FLOW ──', walletCall)
assert(windowEnd > walletCall, 'B0a located Telnyx delimiter to bound the window')
const walletBlock = src.slice(windowStart, windowEnd)

const walletNotifyGroupCount = (walletBlock.match(/\bnotifyGroup\(/g) || []).length
assert(
  walletNotifyGroupCount === 0,
  `B1 Wallet-USD action handler contains 0 notifyGroup calls (found ${walletNotifyGroupCount})`
)
assert(
  !/cpTxt\.adminPurchase\(maskName\(_twilioName\)/.test(walletBlock),
  'B2 the duplicate cpTxt.adminPurchase(_twilioName) call is gone'
)
assert(
  !/cpTxt\.adminSubPurchase\(maskName\(_twilioName\)/.test(walletBlock),
  'B3 the duplicate cpTxt.adminSubPurchase(_twilioName) call is gone'
)
// `_twilioName` was only used by the duplicate calls — it should also be gone.
assert(
  !/const _twilioName = await get\(nameOf, chatId\)/.test(walletBlock),
  'B4 unused _twilioName declaration cleaned up'
)
// A comment explaining the rationale should be present so the next agent
// doesn't "fix" this again.
assert(
  /do NOT call notifyGroup here/.test(walletBlock),
  'B5 rationale comment present (prevents 2026-05-30-style regression)'
)

// ───────────────────────────────────────────────────────────
// Test C — Telnyx branch UNCHANGED (must still call notifyGroup)
// ───────────────────────────────────────────────────────────
console.log('\nTest C: Telnyx purchase flow still fires its own notifyGroup')

const telnyxIdx = src.indexOf('// ── TELNYX PURCHASE FLOW ──')
assert(telnyxIdx > 0, 'C0 located Telnyx flow marker')
// Telnyx block runs from the marker until the surrounding handler's catch.
// We use the SAFETY NET marker as the natural lower bound.
const telnyxEnd = src.indexOf('// ── SAFETY NET: refund wallet on ANY unexpected error ──', telnyxIdx)
assert(telnyxEnd > telnyxIdx, 'C0a located Telnyx SAFETY NET delimiter')
const telnyxBlock = src.slice(telnyxIdx, telnyxEnd)
assert(/\bnotifyGroup\(\s*cpTxt\.adminPurchase\(/.test(telnyxBlock),    'C1 Telnyx still notifies for regular purchases')
assert(/\bnotifyGroup\(\s*cpTxt\.adminSubPurchase\(/.test(telnyxBlock), 'C2 Telnyx still notifies for sub purchases')

// ───────────────────────────────────────────────────────────
// Test D — no other Wallet-USD-only notifyGroup duplicates
// ───────────────────────────────────────────────────────────
console.log('\nTest D: no remaining "Wallet USD" admin-notify duplicates')

// `'Wallet USD'` literal appears in 2 internal calls inside
// executeTwilioPurchase × 2 args each = 4, plus 2 ternary branches in the
// Telnyx flow × 2 args each = 4. The Twilio Bank flow does NOT use 'Wallet USD'.
// Total expected = 8.
const walletUsdHits = (src.match(/'Wallet USD'/g) || []).length
assert(walletUsdHits === 8, `D1 'Wallet USD' literal appears 8 times in source (found ${walletUsdHits})`)

// ───────────────────────────────────────────────────────────
// Test E — node --check parses
// ───────────────────────────────────────────────────────────
console.log('\nTest E: js/_index.js parses')
const checkRes = spawnSync('node', ['--check', indexPath], { encoding: 'utf8' })
assert(checkRes.status === 0, `E1 node --check exits 0 (stderr: ${checkRes.stderr.trim() || 'none'})`)

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
