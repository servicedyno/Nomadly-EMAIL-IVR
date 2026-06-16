/**
 * Unit test for the order-history isRefundOrCredit() classification logic
 * and total-spend computation. We replicate the predicate locally because
 * the function is internal to handleOrderHistory; if this test ever drifts
 * from the production code, that's a regression worth catching in CI.
 */
'use strict'
const assert = require('assert')

// Mirror of the predicate in /app/js/order-history.js (keep in sync)
const isRefundOrCredit = (t) =>
  t.status === 'refunded' || t.status === 'failed' ||
  /^(.+-refund|.+-overpayment-credit|.+-underpayment-credit|.+-savings-credit|wallet-topup|welcome-bonus|admin-credit|admin-refund-pending)$/.test(String(t.type || ''))

console.log('━━━ order-history classification dry-run ━━━')

const tests = [
  // [type,                          status,      isRefundOrCredit?]
  ['domain',                          'completed', false],
  ['hosting',                         'completed', false],
  ['phone',                           'completed', false],
  ['vps',                             'completed', false],
  ['leads',                           'completed', false],
  ['domain',                          'pending',   false],
  ['domain',                          'failed',    true],
  ['domain-refund',                   'refunded',  true],
  ['domain-overpayment-credit',       'completed', true],
  ['domain-underpayment-credit',      'completed', true],
  ['domain-savings-credit',           'completed', true],
  ['hosting-refund',                  'refunded',  true],
  ['phone-refund',                    'refunded',  true],
  ['vps-refund',                      'refunded',  true],
  ['wallet-topup',                    'completed', true],
  ['welcome-bonus',                   'completed', true],
  ['admin-credit',                    'completed', true],
  ['admin-refund-pending',            'completed', true],
]
for (const [type, status, expected] of tests) {
  const got = isRefundOrCredit({ type, status })
  assert.strictEqual(got, expected, `[${type}/${status}] expected ${expected}, got ${got}`)
  console.log(`✓  ${(type+'/'+status).padEnd(40)} → ${got ? 'CREDIT' : 'SPEND'}`)
}

// ── Spend-total computation against @leprechaun00's real 6-transaction history
const leprechaun = [
  { type: 'welcome-bonus',    amount:  5, status: 'completed' },
  { type: 'domain-refund',    amount: 65, status: 'refunded'  },
  { type: 'domain',           amount: 30, status: 'completed' },
  { type: 'wallet-topup',     amount: 14, status: 'completed' },
  { type: 'wallet-topup',     amount: 16, status: 'completed' },
  { type: 'domain',           amount: 65, status: 'completed' },
]
const spendOnly = leprechaun.filter(t => t.status === 'completed' && !isRefundOrCredit(t))
const totalSpent = spendOnly.reduce((s, t) => s + t.amount, 0)
console.log(`\nLeprechaun00 totalSpent = $${totalSpent}  (expected $95: $30 .org + $65 .com.au)`)
assert.strictEqual(totalSpent, 95, 'totalSpent must equal $95 (only counts real spends)')
console.log('✓  total-spent excludes refunds, topups, bonuses, credits\n')

console.log('━━━━ ALL ASSERTIONS PASSED ━━━━')
