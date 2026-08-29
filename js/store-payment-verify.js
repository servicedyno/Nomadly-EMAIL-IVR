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
 * pending/failed skip. Mirrors the wallet path: trust the webhook event; use
 * the gateway re-verify as a best-effort confirmation only.
 *
 * @param {Object} p
 * @param {string}  p.event          - webhook body event/status
 * @param {boolean} p.gatewayReached - did getDynopayCryptoPaymentStatus return data?
 * @param {string} [p.gatewayStatus] - the gateway's reported status (when reached)
 * @returns {{action:'fulfill'|'unverified-fulfill'|'hold', reason:string}}
 */
function classifyStoreWebhook({ event, gatewayReached, gatewayStatus } = {}) {
  const ev = normalizeStatus(event)
  if (gatewayReached) {
    if (isPaidStatus(gatewayStatus)) return { action: 'fulfill', reason: `gateway-confirmed:${normalizeStatus(gatewayStatus)}` }
    if (isUnpaidStatus(gatewayStatus)) return { action: 'hold', reason: `gateway-unpaid:${normalizeStatus(gatewayStatus)}` }
    // gateway reached but returned an UNKNOWN status → fall through to trust the webhook event
  }
  // Gateway unreachable (IP-restricted 404 / network) OR unknown status →
  // trust the webhook event exactly like the wallet-deposit path does.
  if (isPaidStatus(ev)) {
    return {
      action: gatewayReached ? 'fulfill' : 'unverified-fulfill',
      reason: `webhook-event:${ev}${gatewayReached ? '(gateway-unknown-status)' : '(gateway-unreachable)'}`,
    }
  }
  return { action: 'hold', reason: `webhook-event-not-paid:${ev || 'empty'}` }
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
