/* global module */
/**
 * store-payment-verify.js — Storefront crypto-webhook payment classification.
 *
 * PARITY WITH THE TELEGRAM BOT (authDyno in js/_index.js).
 *
 * BUG CONTEXT (2026-08):
 *   The web storefront's /store/crypto-webhook used to gate provisioning on
 *   getDynopayCryptoPaymentStatus(order.payAddress). That DynoPay status
 *   endpoint returns false / "Application not found" for storefront payment
 *   addresses, so fully-PAID web orders were dropped/held and never
 *   provisioned. Symptom: zero web-sourced cpanelAccounts while the bot has
 *   many. The bot never hits that endpoint — its authDyno wallet path TRUSTS
 *   the webhook (deny-list) and provisions fine.
 *
 * FIX:
 *   classifyStoreWebhook() mirrors authDyno's DENY-LIST — hold ONLY when the
 *   event is empty or a definitively-unpaid status; trust EVERY other event as
 *   paid and fulfill. The gateway status becomes advisory-only (see the route),
 *   and must never block a paid webhook.
 */

'use strict'

// Non-terminal unpaid statuses → HOLD (order stays pending; wait for a paid event).
const HOLD_STATUSES = new Set([
  'pending',
  'underpaid',
  'waiting',
  'processing',
  'unpaid',
])

// Terminal unpaid statuses → FAIL (mark a still-pending order failed).
const FAIL_STATUSES = new Set([
  'failed',
  'expired',
  'cancelled',
  'canceled',
  'declined',
  'rejected',
  'voided',
  'refunded',
  'chargeback',
])

/**
 * Normalize a raw event/status string: lowercase, trimmed, `payment.` prefix
 * stripped (DynoPay sends `payment.confirmed`, some providers send `confirmed`).
 */
function normalizeStatus(raw) {
  return String(raw == null ? '' : raw).trim().toLowerCase().replace(/^payment\./, '')
}

/**
 * Classify a DynoPay-style store webhook body using a DENY-LIST.
 *
 * @param {object} body  webhook JSON body ({ event | status, payment_id, meta_data... })
 * @returns {{decision:'fulfill'|'hold'|'fail', paid:boolean, status:string, reason:string}}
 *   - 'fulfill' → trusted PAID; run provisioning / credit (the default for
 *                 anything not explicitly unpaid — this is the fix).
 *   - 'hold'    → definitively unpaid but not terminal → keep order pending.
 *   - 'fail'    → terminal unpaid → mark a still-pending order failed.
 */
function classifyStoreWebhook(body) {
  const raw = (body && (body.event != null ? body.event : body.status)) || ''
  const status = normalizeStatus(raw)

  // Empty / missing event → cannot confirm payment → HOLD (never provision blind).
  if (!status) {
    return { decision: 'hold', paid: false, status: '', reason: 'empty_event' }
  }

  // Terminal unpaid → FAIL the order.
  if (FAIL_STATUSES.has(status)) {
    return { decision: 'fail', paid: false, status, reason: 'terminal_unpaid' }
  }

  // Non-terminal unpaid (pending / underpaid / waiting) → HOLD, wait for confirmation.
  if (HOLD_STATUSES.has(status)) {
    return { decision: 'hold', paid: false, status, reason: 'unpaid_status' }
  }

  // Everything else (confirmed / settled / completed / paid / success / or ANY
  // provider-specific "paid" event we don't explicitly know) → TRUST as PAID.
  // This deny-list default is exactly what the bot's authDyno does.
  return { decision: 'fulfill', paid: true, status, reason: 'trusted_paid' }
}

/**
 * Amount-based underpayment guard. Underpaid iff the received USD is below
 * `tolerance` (0.90 = 90%) of what's owed. Kept at the store's historical 0.90
 * tolerance (do not change). Non-finite / non-positive owed → NOT underpaid
 * (defer to the caller's other checks; fail-open so we don't wrongly reject).
 *
 * @param {number} usdIn      USD actually received (from base_amount / order)
 * @param {number} total      USD owed for the order
 * @param {number} [tolerance=0.90]
 * @returns {boolean}
 */
function isStoreUnderpaid(usdIn, total, tolerance = 0.90) {
  const paid = Number(usdIn)
  const owed = Number(total)
  if (!Number.isFinite(paid) || !Number.isFinite(owed) || owed <= 0) return false
  return paid < owed * tolerance
}

module.exports = {
  classifyStoreWebhook,
  isStoreUnderpaid,
  normalizeStatus,
  HOLD_STATUSES,
  FAIL_STATUSES,
}
