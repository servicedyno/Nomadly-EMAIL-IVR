/* global process */
/**
 * store-payment-verify.js — pure DynoPay webhook/status classification for the
 * public storefront (store-routes.js).
 *
 * Extracted 2026-06 to fix a SILENT-DROP bug: the storefront webhook only
 * accepted gateway statuses ['completed','confirmed','settled','paid'] and
 * rejected DynoPay's 'received' status, dropping fully-paid orders with NO
 * admin alert — while the WORKING wallet-deposit path (authDyno in _index.js)
 * trusts the webhook event directly and only skips pending/failed/underpaid.
 * This module brings the store path to parity and adds a network-fee
 * underpayment tolerance so a fee-shaved payment (e.g. $67.31 of a $69 order)
 * still provisions.
 *
 * Pure + side-effect free (except reading process.env for the tolerance).
 */

// Statuses that mean "funds arrived" (normalized, 'payment.' prefix stripped).
const PAID = new Set([
  'completed', 'complete', 'confirmed', 'settled', 'paid', 'success',
  'received', 'received_unconfirmed',
])
// Statuses that DEFINITIVELY mean "not paid (yet)" → never provision.
const UNPAID = new Set([
  'pending', 'failed', 'expired', 'cancelled', 'canceled', 'waiting',
  'underpaid', 'declined',
])

const DEFAULT_STORE_UNDERPAY_TOLERANCE = 0.90

function normalizeStatus(s) {
  return String(s || '').trim().toLowerCase().replace(/^payment\./, '')
}
function isPaidStatus(s) { return PAID.has(normalizeStatus(s)) }
function isUnpaidStatus(s) { return UNPAID.has(normalizeStatus(s)) }

/**
 * Decide what to do with a store crypto webhook that has ALREADY passed the
 * pending/failed skip. TRUE PARITY with the working wallet-deposit path
 * (authDyno in _index.js): TRUST the webhook event and only skip the
 * definitively-unpaid statuses (pending/failed/underpaid/expired/…). The
 * DynoPay status API (getDynopayCryptoPaymentStatus) is ADVISORY ONLY and can
 * NEVER block a paid webhook — it is frequently unreachable ("Application not
 * found") for storefront payment addresses, which historically DROPPED
 * fully-paid orders (see lloyd-support.com / order 9fd5da6a, 2026-08-29 — the
 * customer paid $69, got nothing, and had to message support).
 *
 * Difference vs the old allow-list model: we no longer require the event to be
 * in a hardcoded PAID set. Anything that is NOT empty and NOT explicitly
 * unpaid is treated as "funds arrived" — exactly what authDyno does — so a new
 * or unusual paid status (e.g. 'received', 'settlement_failed') can never be
 * silently dropped again. The network-fee underpayment check in
 * isStoreUnderpaid() remains the money-safety gate.
 *
 * @param {Object} p
 * @param {string}  p.event          - webhook body event/status
 * @param {boolean} p.gatewayReached - did getDynopayCryptoPaymentStatus return data?
 * @param {string} [p.gatewayStatus] - the gateway's reported status (when reached)
 * @returns {{action:'fulfill'|'unverified-fulfill'|'hold', reason:string}}
 */
function classifyStoreWebhook({ event, gatewayReached, gatewayStatus } = {}) {
  const ev = normalizeStatus(event)

  // Never provision on an empty or definitively-unpaid webhook event.
  if (!ev) return { action: 'hold', reason: 'webhook-event-empty' }
  if (isUnpaidStatus(ev)) return { action: 'hold', reason: `webhook-event-unpaid:${ev}` }

  // The webhook says funds arrived → fulfill. The gateway is ADVISORY ONLY and
  // must never block a paid order (parity with the wallet-deposit path).
  if (gatewayReached && isPaidStatus(gatewayStatus)) {
    return { action: 'fulfill', reason: `gateway-confirmed:${normalizeStatus(gatewayStatus)}` }
  }
  if (gatewayReached && isUnpaidStatus(gatewayStatus)) {
    // Gateway contradicts a paid webhook → still fulfill (parity with wallet
    // deposits) but flag it for admin review.
    return { action: 'unverified-fulfill', reason: `webhook-paid:${ev}(gateway-contradicts:${normalizeStatus(gatewayStatus)})` }
  }
  // Gateway unreachable OR reported an unknown status → trust the webhook,
  // same policy as the wallet-deposit path.
  return {
    action: gatewayReached ? 'fulfill' : 'unverified-fulfill',
    reason: `webhook-paid:${ev}${gatewayReached ? '(gateway-unknown)' : '(gateway-unreachable)'}`,
  }
}

function storeUnderpayTolerance() {
  const t = parseFloat(process.env.STORE_UNDERPAY_TOLERANCE)
  return Number.isFinite(t) && t > 0 && t <= 1 ? t : DEFAULT_STORE_UNDERPAY_TOLERANCE
}

/**
 * @returns {boolean} true if the received USD is below the acceptable tolerance
 * of the invoiced total (→ do NOT provision; refund/hold).
 */
function isStoreUnderpaid(usdIn, totalUsd, tolerance) {
  const tol = Number.isFinite(tolerance) && tolerance > 0 && tolerance <= 1 ? tolerance : storeUnderpayTolerance()
  if (!Number.isFinite(usdIn) || usdIn <= 0) return true
  if (!Number.isFinite(totalUsd) || totalUsd <= 0) return false
  return usdIn < totalUsd * tol
}

module.exports = {
  PAID, UNPAID, DEFAULT_STORE_UNDERPAY_TOLERANCE,
  normalizeStatus, isPaidStatus, isUnpaidStatus,
  classifyStoreWebhook, storeUnderpayTolerance, isStoreUnderpaid,
}
