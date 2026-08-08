/*global process */
// ─────────────────────────────────────────────────────────────────────────────
// RATE-DECK SYNC (2026-08-07) — keeps the dial-rate-guard high-cost table current
// by periodically pulling provider outbound-voice rate decks and MERGING them,
// taking the MAX cost per prefix so the guard always reflects the most expensive
// provider (safest for margin).
//
//   • Twilio: public outbound-voice pricing CSV (auto-fetched from TWILIO_RATEDECK_URL,
//             defaults to Twilio's published CSV).
//   • Telnyx: Telnyx exposes NO public rate-deck API — decks are per-account CSV
//             downloads from Mission Control. So set TELNYX_RATEDECK_URL to a hosted
//             copy of your Telnyx deck (or POST one to /dev/rate-deck-sync) and it
//             gets merged the same way. If unset, only Twilio is synced.
//
// Merged rows are stored in the `dialRateDeck` MongoDB collection
// ({ _id: prefix, cost: <max>, costs: {twilio, telnyx, ...}, updatedAt }).
// Only prefixes costing > RATE_DECK_THRESHOLD (default $0.50) and ≤ 9 digits
// (skip individual premium numbers) are stored — matching the guard's surcharge tier.
// ─────────────────────────────────────────────────────────────────────────────
const axios = require('axios')

const THRESHOLD = parseFloat(process.env.RATE_DECK_THRESHOLD || '0.50')
const TWILIO_RATEDECK_URL = process.env.TWILIO_RATEDECK_URL
  || 'https://www.twilio.com/content/dam/twilio-com/pricing-data/en/csv/PMded94a0dae30eaaec0f115f22859bd38_OutboundVoicePricing.csv'
const TELNYX_RATEDECK_URL = process.env.TELNYX_RATEDECK_URL || ''

let _db = null
let _log = (...a) => console.log('[RateDeckSync]', ...a)
let _onUpdated = null // callback (e.g., dialGuard.reloadFromDb) fired after a merge

function init({ db, logger, onUpdated } = {}) {
  _db = db
  if (logger) _log = logger
  if (onUpdated) _onUpdated = onUpdated
}

// Minimal CSV parser (handles quoted fields with embedded commas).
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQ = false
      else cur += ch
    } else {
      if (ch === '"') inQ = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out
}

// Parse a rate-deck CSV into [{prefix, cost}]. Auto-detects common column names:
//   - Twilio outbound-voice: "Price / min" + "Destination Prefixes" (+ Description to skip satellite/premium)
//   - Generic decks: prefix|Prefix|destination|Dial Prefix  +  cost|rate|Price|Rate/Min
function parseRateDeck(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase())
  const idx = (names) => header.findIndex(h => names.includes(h))
  const priceCol = idx(['price / min', 'price/min', 'rate', 'rate/min', 'cost', 'cost/min', 'price'])
  const prefixCol = idx(['destination prefixes', 'prefix', 'prefixes', 'dial prefix', 'destination', 'code'])
  const descCol = idx(['description', 'destination name', 'name'])
  if (priceCol < 0 || prefixCol < 0) return []

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const cost = parseFloat(cells[priceCol])
    if (!Number.isFinite(cost) || cost <= THRESHOLD) continue
    const desc = (descCol >= 0 ? cells[descCol] : '').toLowerCase()
    // Skip satellite/premium/special rows — those are BLOCKED by the guard, not surcharged.
    if (/satellite|premium|special service/.test(desc)) continue
    const prefixes = (cells[prefixCol] || '').replace(/"/g, '').split(',').map(p => p.trim()).filter(p => /^\d+$/.test(p))
    for (const pf of prefixes) {
      if (pf.length > 9) continue // individual numbers, not ranges
      rows.push({ prefix: pf, cost: Math.round(cost * 10000) / 10000 })
    }
  }
  // De-dup within this deck, keep max
  const map = new Map()
  for (const r of rows) { if (!map.has(r.prefix) || r.cost > map.get(r.prefix)) map.set(r.prefix, r.cost) }
  return [...map.entries()].map(([prefix, cost]) => ({ prefix, cost }))
}

// Merge a provider's parsed rows into dialRateDeck, keeping cost = max across providers.
async function mergeIntoDeck(provider, rows) {
  if (!_db) throw new Error('rate-deck-sync not initialized (no db)')
  const col = _db.collection('dialRateDeck')
  let upserts = 0
  for (const { prefix, cost } of rows) {
    const existing = await col.findOne({ _id: prefix })
    const costs = { ...(existing?.costs || {}), [provider]: cost }
    const maxCost = Math.max(...Object.values(costs))
    await col.updateOne(
      { _id: prefix },
      { $set: { _id: prefix, prefix, costs, cost: Math.round(maxCost * 10000) / 10000, updatedAt: new Date() } },
      { upsert: true }
    )
    upserts++
  }
  _log(`merged ${upserts} '${provider}' prefixes into dialRateDeck`)
  if (_onUpdated) { try { await _onUpdated() } catch (e) { _log('onUpdated error:', e.message) } }
  return upserts
}

async function fetchDeck(url) {
  const res = await axios.get(url, { timeout: 30000, responseType: 'text', headers: { 'User-Agent': 'Mozilla/5.0 (rate-deck-sync)' } })
  return typeof res.data === 'string' ? res.data : String(res.data)
}

// Sync one provider from a URL. Returns { provider, prefixes, merged } or throws.
async function syncFromUrl(provider, url) {
  if (!url) throw new Error(`no URL configured for provider '${provider}'`)
  const text = await fetchDeck(url)
  const rows = parseRateDeck(text)
  const merged = await mergeIntoDeck(provider, rows)
  return { provider, prefixes: rows.length, merged }
}

// Sync all configured providers (Twilio always; Telnyx only if TELNYX_RATEDECK_URL set).
async function syncAll() {
  const results = []
  try { results.push(await syncFromUrl('twilio', TWILIO_RATEDECK_URL)) }
  catch (e) { _log('twilio sync failed:', e.message); results.push({ provider: 'twilio', error: e.message }) }
  if (TELNYX_RATEDECK_URL) {
    try { results.push(await syncFromUrl('telnyx', TELNYX_RATEDECK_URL)) }
    catch (e) { _log('telnyx sync failed:', e.message); results.push({ provider: 'telnyx', error: e.message }) }
  } else {
    _log('TELNYX_RATEDECK_URL not set — skipping Telnyx (no public rate-deck API; provide a hosted CSV URL to enable)')
    results.push({ provider: 'telnyx', skipped: 'TELNYX_RATEDECK_URL not set' })
  }
  return results
}

module.exports = { init, syncAll, syncFromUrl, mergeIntoDeck, parseRateDeck, TWILIO_RATEDECK_URL, TELNYX_RATEDECK_URL, THRESHOLD }
