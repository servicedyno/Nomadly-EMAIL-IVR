/**
 * Unit tests for /app/js/hosting-upgrade-nudge.js
 *
 *   - inSweetSpot: returns null outside the 2-days-before-window-close band
 *   - inSweetSpot: returns non-null inside the sweet spot, for both plan types
 *   - alreadyNudgedThisCycle: respects anchor advancement (i.e. renewals reset)
 *   - buildMessage: includes the credit amount + deadline in the rendered body
 *
 * Run:  node js/__tests__/hosting-upgrade-nudge.test.js
 */

const {
  inSweetSpot,
  alreadyNudgedThisCycle,
  buildMessage,
} = require('../hosting-upgrade-nudge')

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

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-02-15T12:00:00Z')

console.log('\nhosting-upgrade-nudge — unit tests')
console.log('───────────────────────────────────')

// ─── inSweetSpot — WEEKLY (window=3, fires on days 1.0–2.0) ───
console.log('\n[inSweetSpot — WEEKLY plan]')
const weekly = (daysAgo) => ({
  plan: 'Premium Anti-Red (1-Week)',
  lastRenewedAt: new Date(NOW.getTime() - daysAgo * DAY),
})

eq('day 0  → null (too early)', inSweetSpot(weekly(0), NOW), null)
eq('day 0.99 → null (just before)', inSweetSpot(weekly(0.99), NOW), null)
assert('day 1.0 → fires', inSweetSpot(weekly(1.0), NOW) !== null)
assert('day 1.5 → fires', inSweetSpot(weekly(1.5), NOW) !== null)
eq('day 2.0 → null (past sweet spot)', inSweetSpot(weekly(2.0), NOW), null)
eq('day 5   → null (long past)', inSweetSpot(weekly(5), NOW), null)

// ─── inSweetSpot — PREMIUM MONTHLY (window=14, fires on days 12.0–13.0) ───
console.log('\n[inSweetSpot — PREMIUM MONTHLY plan]')
const monthly = (daysAgo) => ({
  plan: 'Premium Anti-Red HostPanel (30 Days)',
  lastRenewedAt: new Date(NOW.getTime() - daysAgo * DAY),
})

eq('day 10 → null (too early)', inSweetSpot(monthly(10), NOW), null)
eq('day 11.99 → null', inSweetSpot(monthly(11.99), NOW), null)
assert('day 12.0 → fires', inSweetSpot(monthly(12.0), NOW) !== null)
assert('day 12.5 → fires', inSweetSpot(monthly(12.5), NOW) !== null)
eq('day 13.0 → null (past sweet spot)', inSweetSpot(monthly(13.0), NOW), null)
eq('day 20 → null', inSweetSpot(monthly(20), NOW), null)

// ─── inSweetSpot — GOLDEN never qualifies (no upgrade path) ───
console.log('\n[inSweetSpot — GOLDEN plan]')
eq('golden any day → null', inSweetSpot({
  plan: 'Golden Anti-Red HostPanel (30 Days)',
  lastRenewedAt: new Date(NOW.getTime() - 12.5 * DAY),
}, NOW), null)

// ─── inSweetSpot — anchor uses lastRenewedAt over createdAt ───
console.log('\n[inSweetSpot — anchor uses lastRenewedAt over createdAt]')
const wkRenewed = {
  plan: 'Premium Anti-Red (1-Week)',
  createdAt: new Date(NOW.getTime() - 30 * DAY),  // old — would be skipped
  lastRenewedAt: new Date(NOW.getTime() - 1.5 * DAY),  // just renewed — in sweet spot
}
assert('renewed 1.5d ago overrides 30d createdAt', inSweetSpot(wkRenewed, NOW) !== null)

// ─── alreadyNudgedThisCycle ───
console.log('\n[alreadyNudgedThisCycle]')
eq('no creditNudgeAt → false',
  alreadyNudgedThisCycle({ plan: 'Premium Anti-Red (1-Week)', lastRenewedAt: new Date(NOW.getTime() - 1.5 * DAY) }),
  false)

eq('creditNudgeAt BEFORE anchor (renewal happened after) → false (can resend)',
  alreadyNudgedThisCycle({
    plan: 'Premium Anti-Red (1-Week)',
    lastRenewedAt: new Date(NOW.getTime() - 1.5 * DAY),
    creditNudgeAt: new Date(NOW.getTime() - 10 * DAY),
  }),
  false)

eq('creditNudgeAt AFTER anchor (same cycle) → true (skip)',
  alreadyNudgedThisCycle({
    plan: 'Premium Anti-Red (1-Week)',
    lastRenewedAt: new Date(NOW.getTime() - 1.5 * DAY),
    creditNudgeAt: new Date(NOW.getTime() - 1 * DAY),
  }),
  true)

// ─── buildMessage ───
console.log('\n[buildMessage]')
const args = {
  domain: 'mydomain.com',
  daysRemaining: 1.4,
  planName: 'Premium Anti-Red (1-Week)',
  targetName: 'Golden Anti-Red HostPanel (30 Days)',
  chargeAmount: 85.0,
  originalPrice: 100.0,
  creditApplied: 15.0,
  deadlineStr: 'Feb 16, 2026',
}
const enBody = buildMessage('en', args)
assert('en includes the credit amount', enBody.includes('$15.00'))
assert('en includes the discounted charge', enBody.includes('$85.00'))
assert('en includes the list price', enBody.includes('$100.00'))
assert('en includes the deadline', enBody.includes('Feb 16, 2026'))
assert('en includes the domain', enBody.includes('mydomain.com'))
assert('en includes the target plan name', enBody.includes('Golden Anti-Red HostPanel (30 Days)'))

// "1.4 days left" rounds up to 2 days in the headline
assert('en headline rounds days up (2 days left)', enBody.includes('2 days left'))

// Last-day variant
const lastDayBody = buildMessage('en', { ...args, daysRemaining: 0.4 })
assert('en headline says "Last day" when <1 day remaining', lastDayBody.includes('Last day'))

// Locale fallback
const xxBody = buildMessage('xx', args)  // unknown locale
assert('unknown locale falls back to English', xxBody === enBody)

// Other locales render (basic smoke test — just ensure no crash, includes values)
for (const lang of ['fr', 'zh', 'hi']) {
  const body = buildMessage(lang, args)
  assert(`${lang} body includes credit amount`, body.includes('$15.00'))
  assert(`${lang} body includes deadline`, body.includes('Feb 16, 2026'))
}

// Summary
console.log('\n───────────────────────────────────')
console.log(`Result: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  for (const f of fails) console.log(' -', f.label, f.extra || '')
  process.exit(1)
}
process.exit(0)
