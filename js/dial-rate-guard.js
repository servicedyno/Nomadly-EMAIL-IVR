/*global process, __dirname */
// ─────────────────────────────────────────────────────────────────────────────
// DIAL RATE GUARD (2026-08-07) — protects margin on outbound / forwarding / SIP /
// IVR / transfer legs against destinations whose carrier termination cost EXCEEDS
// our flat $0.50/min international price.
//
//   Option 1 — BLOCK: satellite + premium-rate prefixes (catastrophic, $3–$15/min,
//              rarely legitimate). Reuses the existing phone-config block list.
//   Option 2 — HIGH-COST SURCHARGE: ~1260 real destination prefixes that cost
//              > $0.50/min (seeded from Twilio's official outbound-voice rate deck)
//              are billed at cost × markup (default 1.5×), floored at the standard
//              $0.50 intl rate. Longest-prefix match, so cheap landlines in
//              otherwise-expensive countries (e.g. UK London +4420) are unaffected —
//              only the expensive mobile/region prefixes are surcharged.
//
// Standard destinations are unchanged: US/CA and ordinary international keep their
// existing rates. This is a safety net for BOTH Twilio and Telnyx (their expensive
// destinations overlap heavily: satellite, Cuba, Portugal premium, Tunisia, Pacific
// islands, etc.).
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs')
const path = require('path')
const phoneConfig = require('./phone-config.js')

const OVERAGE_RATE_MIN = parseFloat(process.env.OVERAGE_RATE_MIN || '0.15')
const CALL_FORWARDING_RATE_MIN = parseFloat(process.env.CALL_FORWARDING_RATE_MIN || '0.50')
const IVR_CALL_RATE = parseFloat(process.env.BULK_CALL_RATE_PER_MIN || '0.15')
const HIGH_COST_MARKUP = parseFloat(process.env.HIGH_COST_MARKUP || '1.5')
// Recovery rate applied only if a blocked (satellite/premium) leg somehow reaches
// billing despite the placement guards — ensures we never eat a $10/min satellite loss.
const BLOCKED_DEST_RECOVERY_RATE = parseFloat(process.env.BLOCKED_DEST_RECOVERY_RATE || '10.00')

let TABLE = []
try {
  TABLE = JSON.parse(fs.readFileSync(path.join(__dirname, 'high-cost-dial-rates.json'), 'utf8'))
} catch (e) {
  console.error(`[DialRateGuard] Failed to load high-cost-dial-rates.json: ${e.message}`)
  TABLE = []
}
const RATE_MAP = new Map(TABLE.map(r => [r.prefix, r.cost]))
const LENGTHS = [...new Set(TABLE.map(r => r.prefix.length))].sort((a, b) => b - a)

function digits(dest) { return String(dest || '').replace(/[^\d]/g, '') }
function ceilCent(x) { return Math.ceil(x * 100) / 100 }
function retail(cost) { return Math.max(CALL_FORWARDING_RATE_MIN, ceilCent(cost * HIGH_COST_MARKUP)) }
function isUSCanada(dest) { return String(dest || '').replace(/[^+\d]/g, '').startsWith('+1') }

function matchHighCost(d) {
  for (const L of LENGTHS) {
    if (d.length >= L) {
      const pre = d.slice(0, L)
      if (RATE_MAP.has(pre)) return { prefix: pre, cost: RATE_MAP.get(pre) }
    }
  }
  return null
}

/**
 * Classify a destination number.
 * @returns {{blocked:boolean, tier:'blocked'|'high_cost'|'us_ca'|'standard_intl', rate:number, cost?:number, reason?:string}}
 */
function classifyDial(dest) {
  if (phoneConfig.isBlockedPrefix(dest)) {
    return { blocked: true, tier: 'blocked', rate: BLOCKED_DEST_RECOVERY_RATE, reason: 'satellite/premium-rate destination' }
  }
  const hc = matchHighCost(digits(dest))
  if (hc) return { blocked: false, tier: 'high_cost', cost: hc.cost, rate: retail(hc.cost) }
  const usca = isUSCanada(dest)
  return { blocked: false, tier: usca ? 'us_ca' : 'standard_intl', rate: usca ? OVERAGE_RATE_MIN : CALL_FORWARDING_RATE_MIN }
}

/**
 * High-cost/blocked RATE OVERRIDE for billing. Returns a number only when the
 * destination is high-cost or blocked; returns null for standard destinations so
 * the caller applies its own standard US/CA vs intl rate (incl. the IVR flat rate).
 */
function getHighCostRate(dest) {
  if (phoneConfig.isBlockedPrefix(dest)) return BLOCKED_DEST_RECOVERY_RATE
  const hc = matchHighCost(digits(dest))
  return hc ? retail(hc.cost) : null
}

/**
 * Full per-minute billed rate for a destination (non-IVR by default).
 * blocked → recovery rate; high-cost → surcharge; else US/CA or standard intl.
 * @param {object} opts { ivr:boolean } — use the IVR flat rate for the US/CA tier.
 */
function getBilledRate(dest, { ivr = false } = {}) {
  const c = classifyDial(dest)
  if (c.tier === 'blocked' || c.tier === 'high_cost') return c.rate
  return c.tier === 'us_ca' ? (ivr ? IVR_CALL_RATE : OVERAGE_RATE_MIN) : CALL_FORWARDING_RATE_MIN
}

module.exports = { classifyDial, getHighCostRate, getBilledRate, retail, HIGH_COST_MARKUP, BLOCKED_DEST_RECOVERY_RATE }
