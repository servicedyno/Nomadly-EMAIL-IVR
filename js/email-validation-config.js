/**
 * Email Validation Config — Pricing & settings from .env
 *
 * All pricing is admin-configurable via environment variables.
 */

// ── Pricing Tiers (from .env, defaults shown) ──
// Format: EV_TIER_{N}_MAX=count, EV_TIER_{N}_PRICE=pricePerEmail
function loadPricingTiers() {
  return [
    {
      max: parseInt(process.env.EV_TIER_1_MAX || '1000', 10),
      price: parseFloat(process.env.EV_TIER_1_PRICE || '0.005'),
    },
    {
      max: parseInt(process.env.EV_TIER_2_MAX || '10000', 10),
      price: parseFloat(process.env.EV_TIER_2_PRICE || '0.004'),
    },
    {
      max: parseInt(process.env.EV_TIER_3_MAX || '50000', 10),
      price: parseFloat(process.env.EV_TIER_3_PRICE || '0.003'),
    },
    {
      max: parseInt(process.env.EV_TIER_4_MAX || '100000', 10),
      price: parseFloat(process.env.EV_TIER_4_PRICE || '0.002'),
    },
  ]
}

const EV_CONFIG = {
  // ── Feature toggle ──
  enabled: (process.env.EMAIL_VALIDATION_ON || 'true') === 'true',

  // ── Limits ──
  minEmails: parseInt(process.env.EV_MIN_EMAILS || '10', 10),
  maxEmails: parseInt(process.env.EV_MAX_EMAILS || '100000', 10),
  maxPasteEmails: parseInt(process.env.EV_MAX_PASTE || '100', 10),

  // ── Worker (VPS) ──
  workerUrl: process.env.EV_WORKER_URL || 'http://5.189.166.127:8787',

  // ── Free Trial ──
  freeTrialEmails: parseInt(process.env.EV_FREE_TRIAL || '50', 10),  // 0 to disable
  workerSecret: process.env.EV_WORKER_SECRET || 'ev-worker-secret-2026',
  workerBatchSize: parseInt(process.env.EV_WORKER_BATCH || '100', 10),
  workerTimeout: parseInt(process.env.EV_WORKER_TIMEOUT || '120000', 10),   // 2 min per batch
  useDirectSmtp: (process.env.EV_USE_DIRECT_SMTP || 'false') === 'true',   // fallback: verify from main server

  // ── Concurrency ──
  domainConcurrency: parseInt(process.env.EV_DOMAIN_CONCURRENCY || '10', 10),
  progressInterval: parseInt(process.env.EV_PROGRESS_INTERVAL || '20', 10), // notify every N%

  // ── NGN rate ──
  ngnRate: parseFloat(process.env.NGN_RATE || '1600'),
}

/**
 * Calculate price for a given email count using tiered pricing
 */
function calculatePrice(emailCount) {
  const tiers = loadPricingTiers()
  for (const tier of tiers) {
    if (emailCount <= tier.max) {
      return { total: +(emailCount * tier.price).toFixed(2), rate: tier.price, tier: tier.max }
    }
  }
  // Above all tiers → use last tier price
  const last = tiers[tiers.length - 1]
  return { total: +(emailCount * last.price).toFixed(2), rate: last.price, tier: 'max' }
}

/**
 * Format pricing table for display
 */
function pricingTable() {
  const tiers = loadPricingTiers()
  let prevMax = 0
  return tiers.map(t => {
    const from = prevMax + 1
    prevMax = t.max
    return `• ${from.toLocaleString()} – ${t.max.toLocaleString()} emails: <b>$${t.price}</b>/email`
  }).join('\n')
}

module.exports = { EV_CONFIG, calculatePrice, pricingTable, loadPricingTiers }
