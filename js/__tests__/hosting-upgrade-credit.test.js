/**
 * Unit tests for /app/js/hosting-upgrade-credit.js
 *
 * Validates the 50% prorated upgrade credit logic:
 *   - Eligible inside the 14-day window (uses lastRenewedAt || createdAt anchor)
 *   - Not eligible after 14 days
 *   - Credit math, rounding to 2 decimals
 *   - Credit clamped so the user is never billed below $0
 *   - Anchor picks the latest valid date
 *
 * Run:  node js/__tests__/hosting-upgrade-credit.test.js
 */

const {
  CREDIT_WINDOW_DAYS,
  CREDIT_RATE,
  round2,
  getCycleAnchorDate,
  computeUpgradeQuote,
} = require('../hosting-upgrade-credit')

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

function eq(label, actual, expected) {
  assert(label, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

function approx(label, actual, expected, tol = 0.001) {
  assert(label, Math.abs(actual - expected) <= tol, `expected ≈${expected}, got ${actual}`)
}

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-02-15T12:00:00Z')

console.log('\nhosting-upgrade-credit — unit tests')
console.log('────────────────────────────────────')

// 1. Constants
console.log('\n[constants]')
eq('window is 14 days', CREDIT_WINDOW_DAYS, 14)
eq('rate is 0.5', CREDIT_RATE, 0.5)

// 2. round2
console.log('\n[round2]')
eq('round 12.345 → 12.35', round2(12.345), 12.35)
eq('round 12.344 → 12.34', round2(12.344), 12.34)
eq('round 0.1+0.2 → 0.3', round2(0.1 + 0.2), 0.3)

// 3. getCycleAnchorDate
console.log('\n[getCycleAnchorDate]')
eq('null when no plan', getCycleAnchorDate(null), null)
eq('null when no dates', getCycleAnchorDate({}), null)

const created = new Date(NOW.getTime() - 20 * DAY)
const renewed = new Date(NOW.getTime() - 5 * DAY)
const anchorRenewed = getCycleAnchorDate({ createdAt: created, lastRenewedAt: renewed })
eq('prefers latest of createdAt vs lastRenewedAt', anchorRenewed.getTime(), renewed.getTime())

const anchorCreated = getCycleAnchorDate({ createdAt: created })
eq('falls back to createdAt when no renewal', anchorCreated.getTime(), created.getTime())

// 4. Eligibility window
console.log('\n[computeUpgradeQuote — eligibility window]')
const weeklyPrice = 30
const goldPrice = 100

// Within window: 5 days since renewal
let q = computeUpgradeQuote({
  planDoc: { lastRenewedAt: new Date(NOW.getTime() - 5 * DAY) },
  oldPrice: weeklyPrice,
  newPrice: goldPrice,
  now: NOW,
})
assert('within 14 days → eligible', q.eligible === true)
approx('credit = 50% of old price ($15)', q.creditApplied, 15)
approx('charge = $85', q.chargeAmount, 85)

// Boundary: exactly 14 days
q = computeUpgradeQuote({
  planDoc: { lastRenewedAt: new Date(NOW.getTime() - 14 * DAY) },
  oldPrice: weeklyPrice,
  newPrice: goldPrice,
  now: NOW,
})
assert('exactly 14 days → eligible (inclusive)', q.eligible === true)

// Just outside: 14.01 days
q = computeUpgradeQuote({
  planDoc: { lastRenewedAt: new Date(NOW.getTime() - (14 * DAY + 60 * 60 * 1000)) },
  oldPrice: weeklyPrice,
  newPrice: goldPrice,
  now: NOW,
})
assert('14 days + 1 hour → NOT eligible', q.eligible === false)
eq('no credit when outside window', q.creditApplied, 0)
eq('charge = full new price', q.chargeAmount, 100)

// Way outside: 60 days
q = computeUpgradeQuote({
  planDoc: { lastRenewedAt: new Date(NOW.getTime() - 60 * DAY) },
  oldPrice: weeklyPrice,
  newPrice: goldPrice,
  now: NOW,
})
assert('60 days → NOT eligible', q.eligible === false)

// 5. Anchor selection
console.log('\n[computeUpgradeQuote — anchor selection]')
// createdAt 30 days ago, renewedAt 3 days ago → use renewed
q = computeUpgradeQuote({
  planDoc: {
    createdAt: new Date(NOW.getTime() - 30 * DAY),
    lastRenewedAt: new Date(NOW.getTime() - 3 * DAY),
  },
  oldPrice: 50,
  newPrice: 75,
  now: NOW,
})
assert('uses recent renewal even when createdAt is old', q.eligible === true)
approx('credit = $25', q.creditApplied, 25)
approx('charge = $50', q.chargeAmount, 50)

// 6. Edge: missing oldPrice
console.log('\n[computeUpgradeQuote — edge cases]')
q = computeUpgradeQuote({
  planDoc: { lastRenewedAt: NOW },
  oldPrice: 0,
  newPrice: 100,
  now: NOW,
})
assert('oldPrice=0 → no credit', q.eligible === false && q.creditApplied === 0)

// Credit larger than new price → charge floored at $0
q = computeUpgradeQuote({
  planDoc: { lastRenewedAt: NOW },
  oldPrice: 1000,
  newPrice: 10,
  now: NOW,
})
eq('credit capped at new price', q.creditApplied, 10)
eq('charge floored at 0', q.chargeAmount, 0)

// Rounding case
q = computeUpgradeQuote({
  planDoc: { lastRenewedAt: NOW },
  oldPrice: 33.33,
  newPrice: 99.99,
  now: NOW,
})
eq('charge rounded to 2 decimals', q.chargeAmount, round2(99.99 - 33.33 * 0.5))
eq('credit rounded to 2 decimals', q.creditApplied, round2(33.33 * 0.5))

// 7. iMr_Brown scenario (problem statement)
console.log("\n[scenario] @iMr_Brown weekly → golden monthly within 14 days")
q = computeUpgradeQuote({
  planDoc: {
    createdAt: new Date(NOW.getTime() - 6 * DAY),
    lastRenewedAt: null,
  },
  oldPrice: 30, // weekly
  newPrice: 100, // golden monthly
  now: NOW,
})
assert('eligible', q.eligible === true)
approx('credit = $15', q.creditApplied, 15)
approx('charge = $85', q.chargeAmount, 85)

// Summary
console.log('\n────────────────────────────────────')
console.log(`Result: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFailures:')
  for (const f of fails) console.log(' -', f.label, f.extra || '')
  process.exit(1)
}
process.exit(0)
