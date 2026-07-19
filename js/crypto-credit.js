// ============================================================
// crypto-credit.js — pure, side-effect-free crypto deposit credit logic
// ============================================================
// Extracted 2026-07-19 to fix the "underpayment over-credit" bug reported
// for @Spirits_Of_The_Ancesters (chatId 7898648919): they sent 17.72 TRX
// (~$5.85 at exchange_rate 0.33) against a $100 invoice and were credited
// the FULL $100 because the old logic used `Math.max(invoice, converted)`.
//
// See DYNOPAY_OVERPAYMENT_BUG_FIX_2026-06-18.md for the Versace438
// OVERPAYMENT fix (credit actual when the user sends MORE than invoiced).
// This module preserves that fix while closing the symmetric UNDERPAYMENT
// exploit (crediting the invoice when the user sends far LESS).
//
// Credit matrix (only when fee_payer === 'company' AND invoice is known):
//   • actual >= invoice ...................... credit ACTUAL   (overpayment — Versace438)
//   • invoice*tol <= actual < invoice ........ credit INVOICE  (fee-shave goodwill)
//   • actual < invoice*tol ................... credit ACTUAL   (major underpayment — THE FIX)
// When fee_payer !== 'company' or invoice unknown → always credit ACTUAL.
// When the market conversion is unusable → fall back to INVOICE (safe) or block.
//
// `underpayTolerance` default 0.90: production ratio analysis (2026-07-19)
// showed legit deposits cluster in [0.98, 1.02] with a single legitimate
// fee-shave at 0.958; all exploit cases were <= 0.561. 0.90 cleanly
// separates goodwill fee-shaves from abuse.

const DEFAULT_UNDERPAY_TOLERANCE = 0.90;

/**
 * Decide how much USD to credit for a confirmed crypto deposit.
 *
 * @param {Object} p
 * @param {number} p.invoiceUsd        - base_amount (USD the customer was quoted). May be NaN/undefined.
 * @param {number} p.convertedValue    - live market USD value of the crypto actually received. May be NaN/null.
 * @param {string} p.feePayer          - DynoPay `fee_payer` ('company' enables invoice protection).
 * @param {number} [p.underpayTolerance=0.90]
 * @returns {{creditUsd:number, mode:string}}
 *   mode ∈ { 'actual', 'overpayment', 'minor-underpayment', 'major-underpayment',
 *            'invoice-fallback-noconvert', 'blocked-no-data' }
 */
function computeDepositCreditUsd({ invoiceUsd, convertedValue, feePayer, underpayTolerance } = {}) {
  const tol = Number.isFinite(underpayTolerance) && underpayTolerance > 0
    ? underpayTolerance
    : DEFAULT_UNDERPAY_TOLERANCE;

  const conversionOk = Number.isFinite(convertedValue) && convertedValue > 0;
  const invoiceOk = Number.isFinite(invoiceUsd) && invoiceUsd > 0;
  const invoiceGuardApplies = invoiceOk && feePayer === 'company';

  // All returns echo the inputs so callers (e.g. underpayment alerts) have full context.
  const R = (creditUsd, mode) => ({
    creditUsd, mode,
    invoiceUsd: Number.isFinite(invoiceUsd) ? invoiceUsd : null,
    convertedValue: Number.isFinite(convertedValue) ? convertedValue : null,
    feePayer: feePayer || null,
    tolerance: tol,
  });

  if (!invoiceGuardApplies) {
    // No invoice protection → credit exactly what the market says was received.
    if (!conversionOk) return R(NaN, 'blocked-no-data');
    return R(convertedValue, 'actual');
  }

  // fee_payer === 'company' AND we have a usable invoice.
  if (!conversionOk) {
    // Live conversion failed (BlockBee HTML/5xx). DynoPay confirmed the
    // payment on-chain and the customer was quoted the invoice, so the
    // invoice is the safe fallback (see @ciroovblzz LTC→NaN guard).
    return R(invoiceUsd, 'invoice-fallback-noconvert');
  }

  if (convertedValue >= invoiceUsd) {
    // Overpayment (or exact) → credit actual market value. Versace438 fix.
    return R(convertedValue, 'overpayment');
  }

  if (convertedValue >= invoiceUsd * tol) {
    // Minor shortfall within network-fee tolerance → credit invoice (goodwill).
    return R(invoiceUsd, 'minor-underpayment');
  }

  // MAJOR underpayment → credit ONLY what was actually received. THE FIX:
  // stops "$100 invoice, send $5.85 of TRX, get $100" over-credits.
  return R(convertedValue, 'major-underpayment');
}

module.exports = { computeDepositCreditUsd, DEFAULT_UNDERPAY_TOLERANCE };
