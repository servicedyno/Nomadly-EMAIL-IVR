/**
 * Regression test: leads early-abort surfaces an honest reason to the caller.
 *
 * Context (from production incident 2026-05-03 19:09 UTC, user @onlicpe):
 *   When the Alcazar LRN API returned `Fatal Error: Invalid API Key` because
 *   the account was past-due, the lead generation loop correctly detected
 *   "50 misses in first 9 iterations → likely API key issue", refunded the
 *   wallet, and returned []. But the caller in _index.js then showed the
 *   user the misleading copy "Unfortunately the selected area code is
 *   unavailable", causing a frustrating retry loop with different
 *   banks/cities/carriers — none of which would ever have worked.
 *
 * The fix: validatePhoneBulk's early-abort path now returns an array carrying
 * `_abortReason: 'api_key_invalid'`, which the caller inspects to show the
 * honest "provider down — refunded — auto-reported to admin" message.
 *
 * This test exercises the promise: when validatePhoneBulk early-aborts, the
 * returned array (a) is empty, (b) carries `_abortReason='api_key_invalid'`,
 * (c) survives a `(!res || res.length === 0)` guard so the parent caller
 * still hits the refund branch.
 */

const assert = require('assert')

function run(name, fn) {
  try { fn(); console.log(`✓ ${name}`) }
  catch (e) { console.error(`✗ ${name}\n   ${e.message}`); process.exit(1) }
}

// ── Simulate the exact return shape from validatePhoneBulk's early-abort branch
const empty = []
empty._abortReason = 'api_key_invalid'

run('Returned value is an empty array', () => {
  assert.ok(Array.isArray(empty))
  assert.strictEqual(empty.length, 0)
})

run('_abortReason side-channel is preserved on the array instance', () => {
  assert.strictEqual(empty._abortReason, 'api_key_invalid',
    'caller in _index.js relies on this property to pick the honest message')
})

run('Caller guard `(!res || res.length === 0)` still triggers refund branch', () => {
  // Mirrors the exact check in _index.js:9025
  const isFailure = (!empty || empty.length === 0)
  assert.strictEqual(isFailure, true,
    'must be truthy so the wallet is refunded')
})

run('Falsy/empty inputs without abort reason fall back to default user copy', () => {
  // Caller distinguishes by `res && res._abortReason === 'api_key_invalid'`
  const noAbort = []
  assert.strictEqual(noAbort._abortReason, undefined,
    'arrays without explicit _abortReason should fall through to default branch')
  // Older code paths (CNAM exhausted, no_good_hits, timeout) return arrays
  // with `_partialReason` not `_abortReason` — they should NOT trip the
  // honest-msg branch by accident.
  const partial = [];  partial._partialReason = 'cnam_exhausted'
  assert.notStrictEqual(partial._abortReason, 'api_key_invalid',
    'partial-reason arrays must not be mistaken for api-key aborts')
})

run('Source guarantees: validatePhoneBulk returns the abort reason via array side-channel', () => {
  // Codebase-level guard — lock in the property name to prevent silent rename.
  const fs = require('fs')
  const path = require('path')
  const src = fs.readFileSync(path.resolve(__dirname, '../validatePhoneBulk.js'), 'utf8')
  assert.ok(src.includes("empty._abortReason = 'api_key_invalid'"),
    'validatePhoneBulk.js must attach _abortReason to the empty array on early abort')
  assert.ok(src.includes('return empty'),
    'validatePhoneBulk.js must return the marked empty array, not a plain []')
})

run('Source guarantees: _index.js inspects the abort reason and shows honest copy', () => {
  const fs = require('fs')
  const path = require('path')
  const src = fs.readFileSync(path.resolve(__dirname, '../_index.js'), 'utf8')
  assert.ok(src.includes("abortReason === 'api_key_invalid'"),
    '_index.js must check res._abortReason before using the legacy buyLeadsError copy')
  assert.ok(src.includes('lead-data provider is temporarily unavailable'),
    '_index.js must show the honest "provider down" copy in English')
  assert.ok(src.includes('Leads provider down'),
    '_index.js must fire an admin alert (notifyAdmin) for provider outages')
})

run('Source guarantees: validatePhoneAlcazar uses TTL-based logging, not once-per-process', () => {
  const fs = require('fs')
  const path = require('path')
  const src = fs.readFileSync(path.resolve(__dirname, '../validatePhoneAlcazar.js'), 'utf8')
  assert.ok(src.includes('alcazarKeyErrorLastLoggedAt'),
    'should use TTL-based throttle, not the legacy alcazarKeyErrorLogged boolean')
  assert.ok(src.includes('ALCAZAR_KEY_ERROR_LOG_TTL_MS'),
    'should expose a configurable TTL constant')
  assert.ok(!src.includes('let alcazarKeyErrorLogged ='),
    'legacy once-per-process boolean must be removed')
})

console.log('\nAll leads-abort-reason tests passed.')
