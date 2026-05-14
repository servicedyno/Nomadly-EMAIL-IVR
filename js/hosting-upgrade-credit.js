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

const CREDIT_WINDOW_WEEKLY_DAYS = 3
const CREDIT_WINDOW_PREMIUM_MONTHLY_DAYS = 14
const CREDIT_RATE = 0.5
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Resolve the credit window (in days) for a given plan name.
 *   • Weekly plans → 3 days  (the plan itself is only 7 days)
 *   • Premium monthly → 14 days  (upgrading to Golden Anti-Red)
 *   • Golden / unknown → 0 (no upgrade path → no credit)
 */
function getCreditWindowDays(planName) {
  const name = (planName || '').toLowerCase()
  if (name.includes('week')) return CREDIT_WINDOW_WEEKLY_DAYS
  if (name.includes('premium') && !name.includes('week')) return CREDIT_WINDOW_PREMIUM_MONTHLY_DAYS
  return 0
}

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
  const windowDays = getCreditWindowDays(planDoc?.plan)

  let daysSinceAnchor = Number.POSITIVE_INFINITY
  if (anchor) {
    daysSinceAnchor = (_now.getTime() - anchor.getTime()) / MS_PER_DAY
  }

  const eligible = anchor !== null
    && windowDays > 0
    && daysSinceAnchor >= 0
    && daysSinceAnchor <= windowDays
    && _old > 0

  const rawCredit = eligible ? _old * CREDIT_RATE : 0
  // Never let credit exceed the new price (we floor charge at 0).
  const creditApplied = round2(Math.min(rawCredit, _new))
  const chargeAmount = round2(Math.max(_new - creditApplied, 0))

  return {
    eligible,
    anchorDate: anchor,
    daysSinceAnchor: anchor ? round2(daysSinceAnchor) : null,
    windowDays,
    creditApplied,
    originalPrice: round2(_new),
    chargeAmount,
  }
}

/**
 * Enumerate the available upgrade targets for a plan, based on its current
 * tier and the env-configured prices. Mirrors the gating in _index.js.
 *
 * @param {string} currentPlanName
 * @returns {Array<{ key: string, name: string, price: number }>}
 */
function getUpgradeTargets(currentPlanName) {
  const name = (currentPlanName || '').toLowerCase()
  const premiumPrice = Number(process.env.PREMIUM_ANTIRED_CPANEL_PRICE || 75)
  const goldenPrice = Number(process.env.GOLDEN_ANTIRED_CPANEL_PRICE || 100)
  const targets = []
  if (name.includes('week')) {
    targets.push({ key: 'premiumCpanel', name: 'Premium Anti-Red HostPanel (30 Days)', price: premiumPrice })
    targets.push({ key: 'goldenCpanel', name: 'Golden Anti-Red HostPanel (30 Days)', price: goldenPrice })
  } else if (name.includes('premium') && !name.includes('week')) {
    targets.push({ key: 'goldenCpanel', name: 'Golden Anti-Red HostPanel (30 Days)', price: goldenPrice })
  }
  return targets
}

/**
 * Compute the most attractive upgrade quote for a given plan (used by the
 * loyalty-credit nudge on the plan-details / hosting-plans screens).
 *
 * Returns null when the user has no upgrade path or is outside the credit window.
 *
 * @param {object} args
 * @param {object} args.planDoc
 * @param {number} args.oldPrice    - the user's current plan price
 * @param {Date}   [args.now]
 * @returns {(null|{
 *   target: {key, name, price},
 *   quote: ReturnType<typeof computeUpgradeQuote>,
 *   deadlineDate: Date,
 *   daysRemaining: number
 * })}
 */
function getBestUpgradeQuote({ planDoc, oldPrice, now } = {}) {
  const _now = now instanceof Date ? now : new Date()
  const targets = getUpgradeTargets(planDoc?.plan)
  if (!targets.length) return null
  const anchor = getCycleAnchorDate(planDoc)
  if (!anchor) return null
  const windowDays = getCreditWindowDays(planDoc?.plan)
  if (windowDays <= 0) return null
  const deadlineDate = new Date(anchor.getTime() + windowDays * MS_PER_DAY)
  if (_now.getTime() > deadlineDate.getTime()) return null
  const daysRemaining = Math.max(0, round2((deadlineDate.getTime() - _now.getTime()) / MS_PER_DAY))

  let best = null
  for (const t of targets) {
    const q = computeUpgradeQuote({ planDoc, oldPrice, newPrice: t.price, now: _now })
    if (!q.eligible || q.creditApplied <= 0) continue
    // Prefer higher credit; on ties prefer the higher-tier target (targets are
    // listed in ascending tier order, so `>=` lets the later one win).
    if (!best || q.creditApplied >= best.quote.creditApplied) {
      best = { target: t, quote: q }
    }
  }
  if (!best) return null
  return { ...best, deadlineDate, daysRemaining, windowDays }
}

module.exports = {
  CREDIT_WINDOW_WEEKLY_DAYS,
  CREDIT_WINDOW_PREMIUM_MONTHLY_DAYS,
  CREDIT_RATE,
  round2,
  getCreditWindowDays,
  getCycleAnchorDate,
  computeUpgradeQuote,
  getUpgradeTargets,
  getBestUpgradeQuote,
}
