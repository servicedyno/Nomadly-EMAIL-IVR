/**
 * Hosting Upgrade Credit
 *
 * Implements the 50% prorated upgrade credit:
 *   - When a user upgrades within 14 days of their current plan's start/renewal,
 *     50% of the OLD plan's price is credited toward the new plan.
 *   - Effective charge = max(newPrice - credit, 0), rounded to 2 decimals.
 *   - The "anchor date" of the current cycle is `lastRenewedAt || createdAt`.
 *
 * Reused by:
 *   - js/_index.js (upgrade keyboard, confirmation modal, wallet charge)
 *   - tests under /app/tests
 */

const CREDIT_WINDOW_DAYS = 14
const CREDIT_RATE = 0.5
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Round a number to 2 decimal places (banker-style not needed for currency here).
 */
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

/**
 * Resolve the anchor date of the user's current billing cycle.
 * Prefer the most recent renewal; fall back to plan creation date.
 *
 * @param {object} planDoc - cpanelAccounts document
 * @returns {Date|null}
 */
function getCycleAnchorDate(planDoc) {
  if (!planDoc) return null
  const renewed = planDoc.lastRenewedAt ? new Date(planDoc.lastRenewedAt) : null
  const created = planDoc.createdAt ? new Date(planDoc.createdAt) : null
  // Pick the most recent valid date.
  const candidates = [renewed, created].filter(d => d && !isNaN(d.getTime()))
  if (!candidates.length) return null
  return candidates.sort((a, b) => b.getTime() - a.getTime())[0]
}

/**
 * Compute the upgrade quote.
 *
 * @param {object} args
 * @param {object} args.planDoc      - cpanelAccounts document (must contain lastRenewedAt/createdAt)
 * @param {number} args.oldPrice     - price of the user's current plan
 * @param {number} args.newPrice     - sticker price of the plan they're upgrading to
 * @param {Date}   [args.now]        - override "now" (used by tests)
 * @returns {{
 *   eligible: boolean,
 *   anchorDate: (Date|null),
 *   daysSinceAnchor: number,
 *   creditApplied: number,
 *   originalPrice: number,
 *   chargeAmount: number
 * }}
 */
function computeUpgradeQuote({ planDoc, oldPrice, newPrice, now } = {}) {
  const _now = now instanceof Date ? now : new Date()
  const _old = Number(oldPrice) || 0
  const _new = Number(newPrice) || 0
  const anchor = getCycleAnchorDate(planDoc)

  let daysSinceAnchor = Number.POSITIVE_INFINITY
  if (anchor) {
    daysSinceAnchor = (_now.getTime() - anchor.getTime()) / MS_PER_DAY
  }

  const eligible = anchor !== null && daysSinceAnchor >= 0 && daysSinceAnchor <= CREDIT_WINDOW_DAYS && _old > 0

  const rawCredit = eligible ? _old * CREDIT_RATE : 0
  // Never let credit exceed the new price (we floor charge at 0).
  const creditApplied = round2(Math.min(rawCredit, _new))
  const chargeAmount = round2(Math.max(_new - creditApplied, 0))

  return {
    eligible,
    anchorDate: anchor,
    daysSinceAnchor: anchor ? round2(daysSinceAnchor) : null,
    creditApplied,
    originalPrice: round2(_new),
    chargeAmount,
  }
}

module.exports = {
  CREDIT_WINDOW_DAYS,
  CREDIT_RATE,
  round2,
  getCycleAnchorDate,
  computeUpgradeQuote,
}
