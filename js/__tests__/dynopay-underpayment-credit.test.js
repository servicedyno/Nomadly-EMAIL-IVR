/**
 * Regression test for the 2026-07-19 DynoPay UNDERPAYMENT over-credit bug.
 *
 * Bug (reported): @Spirits_Of_The_Ancesters (chatId 7898648919) sent
 *   17.720549 TRX (exchange_rate 0.33 → ≈ $5.85) against a $100 invoice
 *   (ref 6dwYg, fee_payer 'company') and was credited the FULL $100.
 *
 * Root cause: /dynopay/crypto-wallet used `Math.max(invoice, convertedValue)`,
 *   which returns the invoice whenever the user underpays — no matter how
 *   large the shortfall.
 *
 * Fix: crypto-credit.js#computeDepositCreditUsd
 *   • actual >= invoice ............. credit actual  (Versace438 overpayment)
 *   • invoice*tol <= actual < inv ... credit invoice (fee-shave goodwill)
 *   • actual < invoice*tol .......... credit actual  (major underpayment fix)
 *
 * Run: node /app/js/__tests__/dynopay-underpayment-credit.test.js
 */
const assert = require('assert')
const { computeDepositCreditUsd, DEFAULT_UNDERPAY_TOLERANCE } = require('../crypto-credit.js')

let pass = 0
function check(name, got, want) {
  assert.strictEqual(got, want, `${name}: expected ${want}, got ${got}`)
  console.log(`  ✅ ${name}`)
  pass++
}

console.log('DynoPay underpayment over-credit fix — regression suite')

// 1. THE reported incident: 17.72 TRX ≈ $5.85 vs $100 invoice → credit ACTUAL.
{
  const r = computeDepositCreditUsd({ invoiceUsd: 100, convertedValue: 5.85, feePayer: 'company' })
  check('Spirits 17.72 TRX → credits $5.85 not $100 (creditUsd)', r.creditUsd, 5.85)
  check('Spirits mode = major-underpayment', r.mode, 'major-underpayment')
}

// 2. Similar historical incidents from the sweep.
check('3R9ly hosting $58.94/$105 → actual', computeDepositCreditUsd({ invoiceUsd: 105, convertedValue: 58.94, feePayer: 'company' }).creditUsd, 58.94)
check('sAoKK mkt $4.23/$50 → actual', computeDepositCreditUsd({ invoiceUsd: 50, convertedValue: 4.23, feePayer: 'company' }).creditUsd, 4.23)
check('N4b0q btc $5/$10 → actual', computeDepositCreditUsd({ invoiceUsd: 10, convertedValue: 5, feePayer: 'company' }).creditUsd, 5)

// 3. Legit fee-shave (0.958 ratio: $45.04 of $47) → credit INVOICE (goodwill).
{
  const r = computeDepositCreditUsd({ invoiceUsd: 47, convertedValue: 45.04, feePayer: 'company' })
  check('fee-shave $45.04/$47 → credits invoice $47', r.creditUsd, 47)
  check('fee-shave mode = minor-underpayment', r.mode, 'minor-underpayment')
}

// 4. Overpayment (Versace438) preserved → credit ACTUAL.
{
  const r = computeDepositCreditUsd({ invoiceUsd: 30, convertedValue: 60.10, feePayer: 'company' })
  check('Versace438 $60.10/$30 → credits actual $60.10', r.creditUsd, 60.10)
  check('Versace438 mode = overpayment', r.mode, 'overpayment')
}

// 5. Exact payment → credit invoice/actual (equal).
check('exact $50/$50 → $50', computeDepositCreditUsd({ invoiceUsd: 50, convertedValue: 50, feePayer: 'company' }).creditUsd, 50)

// 6. Boundary: exactly at tolerance (0.90 * 100 = 90) → still goodwill invoice.
check('boundary $90/$100 (== tol) → invoice $100', computeDepositCreditUsd({ invoiceUsd: 100, convertedValue: 90, feePayer: 'company' }).creditUsd, 100)
// Just below tolerance → actual.
check('boundary $89.99/$100 (< tol) → actual $89.99', computeDepositCreditUsd({ invoiceUsd: 100, convertedValue: 89.99, feePayer: 'company' }).creditUsd, 89.99)

// 7. fee_payer !== 'company' → always credit actual (no invoice protection).
check('fee_payer=customer underpay → actual', computeDepositCreditUsd({ invoiceUsd: 100, convertedValue: 5.85, feePayer: 'customer' }).creditUsd, 5.85)

// 8. Conversion failed but invoice known + company → invoice fallback (ciroovblzz guard).
{
  const r = computeDepositCreditUsd({ invoiceUsd: 25, convertedValue: NaN, feePayer: 'company' })
  check('convert NaN + invoice → invoice $25', r.creditUsd, 25)
  check('convert NaN mode = invoice-fallback-noconvert', r.mode, 'invoice-fallback-noconvert')
}

// 9. Nothing usable (no invoice guard + conversion failed) → blocked.
{
  const r = computeDepositCreditUsd({ invoiceUsd: NaN, convertedValue: NaN, feePayer: 'customer' })
  check('no data → blocked-no-data', r.mode, 'blocked-no-data')
  assert.ok(Number.isNaN(r.creditUsd), 'blocked → creditUsd NaN')
  console.log('  ✅ blocked → creditUsd NaN'); pass++
}

// 10. Sanity: default tolerance is 0.90.
check('default tolerance = 0.90', DEFAULT_UNDERPAY_TOLERANCE, 0.90)

console.log(`\n${pass}/${pass} assertions passed ✅`)
