/**
 * Unit tests for /app/js/hosting-upgrade-credit.js
 *
 * Validates the 50% prorated upgrade credit logic with PLAN-SPECIFIC windows:
 *   - Weekly plan  → 3-day window
 *   - Premium monthly → 14-day window
 *   - Golden / unknown → no upgrade path → no credit
 * Plus:
 *   - Anchor picks most recent of lastRenewedAt || createdAt
 *   - Credit math, rounding to 2 decimals
 *   - Credit clamped so the user is never billed below $0
 *
 * Run:  node js/__tests__/hosting-upgrade-credit.test.js
 */

const {
  CREDIT_WINDOW_WEEKLY_DAYS,
  CREDIT_WINDOW_PREMIUM_MONTHLY_DAYS,
  CREDIT_RATE,
  round2,
  getCreditWindowDays,
  getCycleAnchorDate,
  computeUpgradeQuote,
  getUpgradeTargets,
  getBestUpgradeQuote,
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
eq('weekly window is 3 days', CREDIT_WINDOW_WEEKLY_DAYS, 3)
eq('premium-monthly window is 14 days', CREDIT_WINDOW_PREMIUM_MONTHLY_DAYS, 14)
eq('rate is 0.5', CREDIT_RATE, 0.5)

// 2. round2
console.log('\n[round2]')
eq('round 12.345 → 12.35', round2(12.345), 12.35)
eq('round 12.344 → 12.34', round2(12.344), 12.34)
eq('round 0.1+0.2 → 0.3', round2(0.1 + 0.2), 0.3)

// 3. getCreditWindowDays
console.log('\n[getCreditWindowDays]')
eq('weekly → 3', getCreditWindowDays('Premium Anti-Red (1-Week)'), 3)
eq('premium monthly → 14', getCreditWindowDays('Premium Anti-Red HostPanel (30 Days)'), 14)
eq('golden → 0', getCreditWindowDays('Golden Anti-Red HostPanel (30 Days)'), 0)
eq('empty → 0', getCreditWindowDays(''), 0)
eq('null → 0', getCreditWindowDays(null), 0)

// 4. getCycleAnchorDate
console.log('\n[getCycleAnchorDate]')
eq('null when no plan', getCycleAnchorDate(null), null)
eq('null when no dates', getCycleAnchorDate({}), null)

const created = new Date(NOW.getTime() - 20 * DAY)
const renewed = new Date(NOW.getTime() - 5 * DAY)
const anchorRenewed = getCycleAnchorDate({ createdAt: created, lastRenewedAt: renewed })
eq('prefers latest of createdAt vs lastRenewedAt', anchorRenewed.getTime(), renewed.getTime())

const anchorCreated = getCycleAnchorDate({ createdAt: created })
eq('falls back to createdAt when no renewal', anchorCreated.getTime(), created.getTime())

// 5. computeUpgradeQuote — WEEKLY plan (3-day window)
console.log('\n[computeUpgradeQuote — WEEKLY plan (3-day window)]')
const weeklyPrice = 30
const goldPrice = 100
const weeklyPlanName = 'Premium Anti-Red (1-Week)'

// Day 2: eligible
let q = computeUpgradeQuote({
  planDoc: { plan: weeklyPlanName, lastRenewedAt: new Date(NOW.getTime() - 2 * DAY) },
  oldPrice: weeklyPrice,
  newPrice: goldPrice,
  now: NOW,
})
assert('weekly + 2 days → eligible', q.eligible === true)
approx('weekly credit = 50% old price = $15', q.creditApplied, 15)
approx('weekly charge = $85', q.chargeAmount, 85)
eq('windowDays reported as 3', q.windowDays, 3)

// Day 3: still eligible (boundary inclusive)
q = computeUpgradeQuote({
  planDoc: { plan: weeklyPlanName, lastRenewedAt: new Date(NOW.getTime() - 3 * DAY) },
  oldPrice: weeklyPrice, newPrice: goldPrice, now: NOW,
})
assert('weekly + exactly 3 days → eligible (inclusive)', q.eligible === true)

// Day 3 + 1 hour: NOT eligible
q = computeUpgradeQuote({
  planDoc: { plan: weeklyPlanName, lastRenewedAt: new Date(NOW.getTime() - (3 * DAY + 60 * 60 * 1000)) },
  oldPrice: weeklyPrice, newPrice: goldPrice, now: NOW,
})
assert('weekly + 3 days + 1 hour → NOT eligible', q.eligible === false)
eq('no credit when outside weekly window', q.creditApplied, 0)
eq('charge = full new price', q.chargeAmount, 100)

// Day 6 (within old 14-day window, but outside new 3-day weekly window)
q = computeUpgradeQuote({
  planDoc: { plan: weeklyPlanName, lastRenewedAt: new Date(NOW.getTime() - 6 * DAY) },
  oldPrice: weeklyPrice, newPrice: goldPrice, now: NOW,
})
assert('weekly + 6 days → NOT eligible (3-day window enforced)', q.eligible === false)

// 6. computeUpgradeQuote — PREMIUM MONTHLY (14-day window)
console.log('\n[computeUpgradeQuote — PREMIUM MONTHLY plan (14-day window)]')
const premiumPrice = 75
const premiumPlanName = 'Premium Anti-Red HostPanel (30 Days)'

// Day 5: eligible
q = computeUpgradeQuote({
  planDoc: { plan: premiumPlanName, lastRenewedAt: new Date(NOW.getTime() - 5 * DAY) },
  oldPrice: premiumPrice, newPrice: goldPrice, now: NOW,
})
assert('premium-monthly + 5 days → eligible', q.eligible === true)
approx('premium credit = 50% old price = $37.50', q.creditApplied, 37.5)
approx('premium charge = $62.50', q.chargeAmount, 62.5)
eq('windowDays reported as 14', q.windowDays, 14)

// Day 14: still eligible (boundary inclusive)
q = computeUpgradeQuote({
  planDoc: { plan: premiumPlanName, lastRenewedAt: new Date(NOW.getTime() - 14 * DAY) },
  oldPrice: premiumPrice, newPrice: goldPrice, now: NOW,
})
assert('premium-monthly + exactly 14 days → eligible (inclusive)', q.eligible === true)

// Day 14 + 1 hour: NOT eligible
q = computeUpgradeQuote({
  planDoc: { plan: premiumPlanName, lastRenewedAt: new Date(NOW.getTime() - (14 * DAY + 60 * 60 * 1000)) },
  oldPrice: premiumPrice, newPrice: goldPrice, now: NOW,
})
assert('premium-monthly + 14d + 1h → NOT eligible', q.eligible === false)

// 7. Golden user — no upgrade path → no credit
console.log('\n[computeUpgradeQuote — GOLDEN plan (no upgrade path)]')
q = computeUpgradeQuote({
  planDoc: { plan: 'Golden Anti-Red HostPanel (30 Days)', lastRenewedAt: NOW },
  oldPrice: 100, newPrice: 200, now: NOW,
})
assert('golden → never eligible', q.eligible === false)
eq('golden → windowDays = 0', q.windowDays, 0)

// 8. Anchor selection still works per-plan
console.log('\n[computeUpgradeQuote — anchor selection]')
q = computeUpgradeQuote({
  planDoc: {
    plan: premiumPlanName,
    createdAt: new Date(NOW.getTime() - 30 * DAY),
    lastRenewedAt: new Date(NOW.getTime() - 3 * DAY),
  },
  oldPrice: 50, newPrice: 100, now: NOW,
})
assert('uses recent renewal even when createdAt is old', q.eligible === true)
approx('credit = $25', q.creditApplied, 25)
approx('charge = $75', q.chargeAmount, 75)

// 9. Edge cases
console.log('\n[computeUpgradeQuote — edge cases]')
q = computeUpgradeQuote({
  planDoc: { plan: weeklyPlanName, lastRenewedAt: NOW },
  oldPrice: 0, newPrice: 100, now: NOW,
})
assert('oldPrice=0 → no credit', q.eligible === false && q.creditApplied === 0)

q = computeUpgradeQuote({
  planDoc: { plan: weeklyPlanName, lastRenewedAt: NOW },
  oldPrice: 1000, newPrice: 10, now: NOW,
})
eq('credit capped at new price', q.creditApplied, 10)
eq('charge floored at 0', q.chargeAmount, 0)

q = computeUpgradeQuote({
  planDoc: { plan: premiumPlanName, lastRenewedAt: NOW },
  oldPrice: 33.33, newPrice: 99.99, now: NOW,
})
eq('charge rounded to 2 decimals', q.chargeAmount, round2(99.99 - 33.33 * 0.5))
eq('credit rounded to 2 decimals', q.creditApplied, round2(33.33 * 0.5))

// 10. iMr_Brown scenario (problem statement)
console.log('\n[scenario] @iMr_Brown weekly → golden monthly')
// Within the new 3-day weekly window → eligible
q = computeUpgradeQuote({
  planDoc: { plan: weeklyPlanName, createdAt: new Date(NOW.getTime() - 2 * DAY) },
  oldPrice: 30, newPrice: 100, now: NOW,
})
assert('weekly day 2 → eligible', q.eligible === true)
approx('credit = $15', q.creditApplied, 15)
approx('charge = $85', q.chargeAmount, 85)

// 4 days after weekly renewal → NO credit (outside 3-day weekly window)
q = computeUpgradeQuote({
  planDoc: { plan: weeklyPlanName, createdAt: new Date(NOW.getTime() - 4 * DAY) },
  oldPrice: 30, newPrice: 100, now: NOW,
})
assert('weekly day 4 → NOT eligible (3d window)', q.eligible === false)
eq('weekly day 4 → no credit', q.creditApplied, 0)

// 11. getUpgradeTargets
console.log('\n[getUpgradeTargets]')
process.env.PREMIUM_ANTIRED_CPANEL_PRICE = '75'
process.env.GOLDEN_ANTIRED_CPANEL_PRICE = '100'

const weeklyTargets = getUpgradeTargets(weeklyPlanName)
eq('weekly has 2 targets', weeklyTargets.length, 2)
eq('weekly[0] = premiumCpanel', weeklyTargets[0].key, 'premiumCpanel')
eq('weekly[1] = goldenCpanel', weeklyTargets[1].key, 'goldenCpanel')

const premiumTargets = getUpgradeTargets(premiumPlanName)
eq('premium-monthly has 1 target', premiumTargets.length, 1)
eq('premium-monthly → golden only', premiumTargets[0].key, 'goldenCpanel')

const goldenTargets = getUpgradeTargets('Golden Anti-Red HostPanel (30 Days)')
eq('golden has no upgrade targets', goldenTargets.length, 0)

// 12. getBestUpgradeQuote — nudge surface
console.log('\n[getBestUpgradeQuote — credit nudge]')
// Weekly user, day 2 → eligible, best target = golden
let best = getBestUpgradeQuote({
  planDoc: { plan: weeklyPlanName, lastRenewedAt: new Date(NOW.getTime() - 2 * DAY) },
  oldPrice: 30, now: NOW,
})
assert('weekly user day 2 → nudge returned', best !== null)
eq('weekly nudge target = golden', best.target.key, 'goldenCpanel')
approx('weekly nudge credit = $15', best.quote.creditApplied, 15)
assert('weekly deadline = anchor + 3 days',
  Math.abs(best.deadlineDate.getTime() - (NOW.getTime() - 2 * DAY + 3 * DAY)) < 1000)
approx('weekly daysRemaining ≈ 1', best.daysRemaining, 1, 0.01)
eq('weekly windowDays = 3', best.windowDays, 3)

// Weekly user, day 4 → outside 3-day window, NO nudge
best = getBestUpgradeQuote({
  planDoc: { plan: weeklyPlanName, lastRenewedAt: new Date(NOW.getTime() - 4 * DAY) },
  oldPrice: 30, now: NOW,
})
eq('weekly day 4 → no nudge (3d window)', best, null)

// Premium-monthly user, day 5 → eligible
best = getBestUpgradeQuote({
  planDoc: { plan: premiumPlanName, lastRenewedAt: new Date(NOW.getTime() - 5 * DAY) },
  oldPrice: 75, now: NOW,
})
assert('premium-monthly day 5 → nudge returned', best !== null)
eq('premium nudge target = golden', best.target.key, 'goldenCpanel')
approx('premium nudge credit = $37.50', best.quote.creditApplied, 37.5)
approx('premium daysRemaining ≈ 9', best.daysRemaining, 9, 0.01)
eq('premium windowDays = 14', best.windowDays, 14)

// Premium-monthly user, day 15 → outside 14-day window
best = getBestUpgradeQuote({
  planDoc: { plan: premiumPlanName, lastRenewedAt: new Date(NOW.getTime() - 15 * DAY) },
  oldPrice: 75, now: NOW,
})
eq('premium day 15 → no nudge', best, null)

// Golden user → never gets a nudge
best = getBestUpgradeQuote({
  planDoc: { plan: 'Golden Anti-Red HostPanel (30 Days)', lastRenewedAt: NOW },
  oldPrice: 100, now: NOW,
})
eq('golden → no nudge (no upgrade path)', best, null)

// Summary
console.log('\n────────────────────────────────────')
console.log(`Result: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFailures:')
  for (const f of fails) console.log(' -', f.label, f.extra || '')
  process.exit(1)
}
process.exit(0)
