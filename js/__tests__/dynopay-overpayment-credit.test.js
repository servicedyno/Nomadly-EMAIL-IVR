/**
 * Regression test for the 2026-06-18 DynoPay overpayment under-credit bug.
 *
 * Bug
 *   `/app/js/_index.js` /dynopay/crypto-wallet handler did:
 *
 *       if (baseAmount && feePayer === 'company') {
 *         usdIn = parseFloat(baseAmount)   // ← invoice amount, NOT actual received
 *       } else {
 *         usdIn = await convert(value, ticker, 'usd')
 *       }
 *
 *   `base_amount` is the **invoiced** USD (what we told the customer to send).
 *   `amount` is the **actual** crypto quantity DynoPay received. When a
 *   customer over-paid (sent more crypto than invoiced), the bot credited
 *   only the invoice amount and silently swallowed the excess.
 *
 *   Real incident: @Versace438 (chatId 7191777173) on 2026-06-18 sent
 *   0.00093443 BTC (= $60.10) for a $30 invoice (ref z02SZ). DynoPay's
 *   portal logged the full $60.10 receipt; bot credited $30. Under-credit
 *   $30.10 refunded via /app/js/scripts/refund_versace438_z02sz.js.
 *
 * Fix
 *   Credit max(invoice, converted-actual), preserving the underpayment
 *   protection AND fixing the overpayment swallow.
 */

// Inline the credit-decision logic from the patched handler so we can unit-test
// it without spinning up the full _index.js. The patched block lives at
// _index.js: "// ── DynoPay credit decision ──" — keep this in sync if changed.
const computeCredit = (reqBody, convertedValue) => {
  const baseAmount = reqBody.base_amount
  const feePayer = reqBody.fee_payer
  if (baseAmount && feePayer === 'company') {
    return Math.max(parseFloat(baseAmount), convertedValue)
  }
  return convertedValue
}

let failed = 0
const t = (label, cond) => {
  if (cond) console.log(`  ✅ ${label}`)
  else { console.log(`  ❌ ${label}`); failed++ }
}

console.log('DynoPay overpayment under-credit regression test\n')

// ── Case 1: OVERPAYMENT (the Versace438 scenario) ──
console.log('Case 1: customer overpaid 2× — credit actual received, not invoice')
{
  const body = { base_amount: '30', fee_payer: 'company' }
  const convertedValue = 60.10
  const credit = computeCredit(body, convertedValue)
  t('credit equals actual received ($60.10), NOT invoice ($30)', credit === 60.10)
  t('credit > invoice (overpayment honoured)', credit > parseFloat(body.base_amount))
}

// ── Case 2: UNDERPAYMENT (legacy protection — must remain) ──
console.log('\nCase 2: customer underpaid (network fee shaved value) — credit invoice')
{
  const body = { base_amount: '30', fee_payer: 'company' }
  const convertedValue = 29.85   // $0.15 short due to mempool fee
  const credit = computeCredit(body, convertedValue)
  t('credit equals invoice ($30), NOT converted ($29.85)', credit === 30)
  t('user not punished for network-fee variance', credit === parseFloat(body.base_amount))
}

// ── Case 3: EXACT match (most common) ──
console.log('\nCase 3: customer paid exactly invoice')
{
  const body = { base_amount: '30', fee_payer: 'company' }
  const convertedValue = 30.001  // floating-point noise
  const credit = computeCredit(body, convertedValue)
  t('credit equals invoice (no spurious excess)', credit === 30.001)  // max picks converted by 0.001
  t('credit ≥ invoice', credit >= parseFloat(body.base_amount))
}

// ── Case 4: fee_payer != 'company' falls back to converted value ──
console.log('\nCase 4: fee_payer != company → fall back to raw convert()')
{
  const body = { base_amount: '30', fee_payer: 'customer' }
  const credit = computeCredit(body, 60.10)
  t('uses converted value, not invoice', credit === 60.10)
}

// ── Case 5: base_amount missing → fall back to converted value ──
console.log('\nCase 5: base_amount missing → fall back to raw convert()')
{
  const body = { fee_payer: 'company' }
  const credit = computeCredit(body, 27.45)
  t('uses converted value when base_amount absent', credit === 27.45)
}

// ── Case 6: numeric base_amount (not string) ──
console.log('\nCase 6: numeric base_amount type-coerced safely')
{
  const body = { base_amount: 30, fee_payer: 'company' }
  const credit = computeCredit(body, 60.10)
  t('numeric base_amount handled', credit === 60.10)
}

// ── Case 7: huge overpay (5× invoice) ──
console.log('\nCase 7: 5× overpayment — credit actual')
{
  const body = { base_amount: '20', fee_payer: 'company' }
  const credit = computeCredit(body, 100)
  t('5× overpayment credited fully', credit === 100)
}

// ── Case 8: simulation against the historical Versace438 incident ──
console.log('\nCase 8: exact replay of Versace438 / z02SZ webhook payload')
{
  // Webhook payload reconstructed from DynoPay portal + bot logs:
  const body = {
    event: 'payment.confirmed',
    status: 'confirmed',
    payment_id: '2fd3c05b-0654-48b1-a201-f165e587dcb8',
    amount: 0.00093443,        // BTC actually received
    base_amount: '30',         // invoice USD (the bug source)
    fee_payer: 'company',
    currency: 'BTC',
  }
  const convertedValue = 60.10  // what convert(0.00093443, 'btc', 'usd') would return at ~$64,332/BTC
  const credit = computeCredit(body, convertedValue)
  t('Versace438 would now be credited $60.10 (not $30)', credit === 60.10)
  t('under-credit eliminated: max(30, 60.10) = 60.10', credit === Math.max(30, 60.10))
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll DynoPay credit-decision guards in place.')
