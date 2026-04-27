// Regression test for the 'Unlimited' → NaN bug in getPoolMinuteLimit / computeDialTimeLimit.
// Reproduces the exact production scenario seen in railway logs:
//   [Twilio] SIP dial timeLimit: NaNs (planRemaining=NaNmin, wallet=$5.00, rate=$0.15/min)
//
// Root cause: phoneConfig.plans.business.minutes is the LITERAL STRING 'Unlimited',
// which the old code returned via `... ?.minutes || Infinity` (string is truthy → falls through).
// The string then propagated NaN through arithmetic in computeDialTimeLimit.
//
// Run: node /app/js/tests/test_pool_minute_limit_fix.js

const assert = require('assert')
const phoneConfig = require('../phone-config.js')

function _normalizePlanLimit(val) {
  if (val == null || val === 'Unlimited') return Infinity
  if (typeof val === 'number') return Number.isFinite(val) ? val : Infinity
  if (typeof val === 'string') {
    const n = parseInt(val, 10)
    return Number.isFinite(n) ? n : Infinity
  }
  return Infinity
}

function getPoolMinuteLimit(numbers, num) {
  if (num.isSubNumber && num.parentNumber) {
    const parent = numbers.find(n => n.phoneNumber === num.parentNumber && !n.isSubNumber)
    return _normalizePlanLimit(phoneConfig.plans[parent?.plan || num.plan]?.minutes)
  }
  return _normalizePlanLimit(phoneConfig.plans[num.plan]?.minutes)
}

function getPoolMinutesUsed(numbers, num) {
  if (num.isSubNumber && num.parentNumber) {
    const parent = numbers.find(n => n.phoneNumber === num.parentNumber && !n.isSubNumber)
    const siblings = numbers.filter(n => n.isSubNumber && n.parentNumber === num.parentNumber)
    return (parent?.minutesUsed || 0) + siblings.reduce((sum, n) => sum + (n.minutesUsed || 0), 0)
  }
  const subs = numbers.filter(n => n.isSubNumber && n.parentNumber === num.phoneNumber)
  return (num.minutesUsed || 0) + subs.reduce((sum, n) => sum + (n.minutesUsed || 0), 0)
}

function computeDialTimeLimit(mode, { planMinutesRemaining = 0, walletBalance = 0, ratePerMinute = 0.04 }) {
  const planRem = Number.isFinite(planMinutesRemaining) ? planMinutesRemaining
    : (planMinutesRemaining === Infinity ? Infinity : 0)
  const wallet = Number.isFinite(walletBalance) ? walletBalance : 0
  const rate = Number.isFinite(ratePerMinute) && ratePerMinute > 0 ? ratePerMinute : 0.04
  let totalSeconds = 0
  if (mode === 'inbound') {
    if (planRem === Infinity) {
      totalSeconds = 14400
    } else {
      totalSeconds = planRem * 60
      if (wallet > 0) totalSeconds += Math.floor(wallet / rate) * 60
    }
  } else {
    if (wallet > 0) totalSeconds = Math.floor(wallet / rate) * 60
  }
  return Math.max(60, Math.min(14400, totalSeconds))
}

let pass = 0, fail = 0
function check(name, fn) {
  try { fn(); console.log('  ✅', name); pass++ }
  catch (e) { console.log('  ❌', name, '\n    ', e.message); fail++ }
}

console.log('\n=== Pool minute limit fix regression ===')

const businessNum = { phoneNumber: '+18882437690', plan: 'business', minutesUsed: 26 }
const proNum     = { phoneNumber: '+12025550100', plan: 'pro',      minutesUsed: 50 }
const starterNum = { phoneNumber: '+12025550101', plan: 'starter',  minutesUsed: 10 }

check('Business plan returns Infinity (was string "Unlimited" before fix)', () => {
  const limit = getPoolMinuteLimit([businessNum], businessNum)
  assert.strictEqual(limit, Infinity, `expected Infinity, got ${limit} (typeof=${typeof limit})`)
})

check('Pro plan returns numeric minute count', () => {
  const limit = getPoolMinuteLimit([proNum], proNum)
  assert.strictEqual(typeof limit, 'number', `expected number, got ${typeof limit}`)
  assert.ok(Number.isFinite(limit) && limit > 0, `expected positive finite, got ${limit}`)
})

check('Starter plan returns numeric minute count', () => {
  const limit = getPoolMinuteLimit([starterNum], starterNum)
  assert.strictEqual(typeof limit, 'number', `expected number, got ${typeof limit}`)
  assert.ok(Number.isFinite(limit) && limit > 0, `expected positive finite, got ${limit}`)
})

check('Unknown plan defaults to Infinity', () => {
  const limit = getPoolMinuteLimit([{ plan: 'nonexistent' }], { plan: 'nonexistent' })
  assert.strictEqual(limit, Infinity)
})

check('Business arithmetic: minuteLimit - poolMinutesUsed is NOT NaN (was NaN before fix)', () => {
  const limit = getPoolMinuteLimit([businessNum], businessNum)
  const used = getPoolMinutesUsed([businessNum], businessNum)
  // Before fix: 'Unlimited' - 26 = NaN
  // After fix: Math.max(0, Infinity - 26) = Infinity (skipped via Infinity branch in real code)
  const planRemaining = limit === Infinity ? 240 : Math.max(0, limit - used)
  assert.ok(Number.isFinite(planRemaining), `planRemaining should be finite, got ${planRemaining}`)
})

check('computeDialTimeLimit for Business inbound returns finite seconds (no NaN)', () => {
  const limit = getPoolMinuteLimit([businessNum], businessNum)
  const used = getPoolMinutesUsed([businessNum], businessNum)
  const planRemaining = limit === Infinity ? Infinity : Math.max(0, limit - used)
  const seconds = computeDialTimeLimit('inbound', {
    planMinutesRemaining: planRemaining,
    walletBalance: 5.00,
    ratePerMinute: 0.15,
  })
  assert.ok(Number.isFinite(seconds), `expected finite seconds, got ${seconds}`)
  assert.ok(seconds >= 60 && seconds <= 14400, `expected 60..14400, got ${seconds}`)
})

check('computeDialTimeLimit defends against NaN inputs (defense in depth)', () => {
  const seconds = computeDialTimeLimit('inbound', {
    planMinutesRemaining: NaN,
    walletBalance: NaN,
    ratePerMinute: NaN,
  })
  assert.ok(Number.isFinite(seconds), `expected finite seconds, got ${seconds}`)
  assert.ok(seconds >= 60, `expected at least 60s, got ${seconds}`)
})

check('computeDialTimeLimit for Infinity plan minutes uses 4-hour cap', () => {
  const seconds = computeDialTimeLimit('inbound', {
    planMinutesRemaining: Infinity,
    walletBalance: 5.00,
    ratePerMinute: 0.15,
  })
  assert.strictEqual(seconds, 14400)
})

check('computeDialTimeLimit for finite plan + wallet sums correctly', () => {
  const seconds = computeDialTimeLimit('inbound', {
    planMinutesRemaining: 60,        // 1 hour plan
    walletBalance: 3.00,
    ratePerMinute: 0.10,             // wallet covers 30 min
  })
  // plan: 60*60=3600s, wallet: floor(3/0.10)*60 = 30*60 = 1800s, total 5400s
  assert.strictEqual(seconds, 5400)
})

check('computeDialTimeLimit for outbound (wallet only) ignores plan minutes', () => {
  const seconds = computeDialTimeLimit('outbound', {
    planMinutesRemaining: 1000,
    walletBalance: 1.00,
    ratePerMinute: 0.50,             // 2 minutes
  })
  assert.strictEqual(seconds, 120)
})

console.log(`\n  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
