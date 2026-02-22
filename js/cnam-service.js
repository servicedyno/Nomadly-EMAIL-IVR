// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CNAM Lookup Service — Resolve caller/sender names
// Priority: Telnyx (primary) → Multitel (fallback) → SignalWire (last resort)
// Results cached in MongoDB to avoid repeat lookups
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const axios = require('axios')
const { log } = require('console')

const TELNYX_API_KEY = process.env.TELNYX_API_KEY
const MULTITEL_USERNAME = process.env.MULTITEL_USERNAME
const MULTITEL_PASSWORD = process.env.MULTITEL_PASSWORD
const TOKEN_SIGNALWIRE = process.env.TOKEN_SIGNALWIRE

let _cnamCache = null // MongoDB collection

function initCnamService(deps) {
  _cnamCache = deps.cnamCache
  const providers = []
  if (TELNYX_API_KEY) providers.push('Telnyx')
  if (MULTITEL_USERNAME) providers.push('Multitel')
  if (TOKEN_SIGNALWIRE) providers.push('SignalWire')
  log(`[CnamService] Initialized — priority: ${providers.join(' → ')} + MongoDB cache`)
}

// ── Telnyx Caller Name lookup (primary) ──
async function lookupTelnyx(phone) {
  const clean = phone.replace(/[^+\d]/g, '')
  const formatted = clean.startsWith('+') ? clean : `+${clean}`
  const res = await axios({
    method: 'get',
    url: `https://api.telnyx.com/v2/number_lookup/${encodeURIComponent(formatted)}`,
    headers: {
      'Authorization': `Bearer ${TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    params: { type: 'caller-name' },
    timeout: 8000,
  })
  const data = res?.data?.data
  return data?.caller_name?.caller_name || null
}

// ── Multitel CNAM lookup (fallback) ──
async function lookupMultitel(phone) {
  const clean = phone.replace(/[^0-9]/g, '')
  const res = await axios({
    method: 'get',
    url: `https://api.multitel.net/v3/cnam/${clean}`,
    auth: { username: MULTITEL_USERNAME, password: MULTITEL_PASSWORD },
    timeout: 8000,
  })
  if (res?.data?.status?.code !== 200) {
    throw new Error(res?.data?.status?.msg || 'Multitel lookup failed')
  }
  return res?.data?.response?.name || null
}

// ── SignalWire CNAM lookup (last resort) ──
async function lookupSignalwire(phone) {
  const clean = phone.replace(/[^0-9]/g, '')
  const res = await axios({
    method: 'get',
    url: `https://greetline-llc.signalwire.com/api/relay/rest/lookup/phone_number/%2B${clean}?include=carrier,cnam`,
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${TOKEN_SIGNALWIRE}`,
    },
    timeout: 8000,
  })
  return res?.data?.cnam?.caller_id || null
}

// ── Main CNAM lookup with caching ──
async function lookupCnam(phoneNumber) {
  const clean = phoneNumber.replace(/[^+\d]/g, '')
  if (!clean || clean.length < 7) return null

  // Check cache first
  if (_cnamCache) {
    try {
      const cached = await _cnamCache.findOne({ phone: clean })
      if (cached && cached.name) {
        // Cache hit — return if less than 30 days old
        const age = Date.now() - new Date(cached.updatedAt).getTime()
        if (age < 30 * 24 * 60 * 60 * 1000) {
          return cached.name
        }
      }
    } catch (e) { /* cache miss */ }
  }

  let name = null

  // 1. Try Telnyx first (cheapest, primary)
  if (TELNYX_API_KEY) {
    try {
      name = await lookupTelnyx(clean)
    } catch (e) {
      const status = e.response?.status
      const detail = e.response?.data?.errors?.[0]?.detail || e.message
      log(`[CNAM] Telnyx failed for ${clean} (${status || 'network'}): ${detail}`)
    }
  }

  // 2. Fallback to Multitel
  if (!name && MULTITEL_USERNAME && MULTITEL_PASSWORD) {
    try {
      name = await lookupMultitel(clean)
    } catch (e) {
      log(`[CNAM] Multitel failed for ${clean}: ${e.message}`)
    }
  }

  // 3. Last resort: SignalWire
  if (!name && TOKEN_SIGNALWIRE) {
    try {
      name = await lookupSignalwire(clean)
    } catch (e) {
      log(`[CNAM] SignalWire failed for ${clean}: ${e.message}`)
    }
  }

  // Cache result
  if (_cnamCache && name) {
    try {
      await _cnamCache.updateOne(
        { phone: clean },
        { $set: { phone: clean, name: name, source: name ? 'lookup' : 'miss', updatedAt: new Date().toISOString() } },
        { upsert: true }
      )
    } catch (e) {
      log(`[CNAM] Cache write error: ${e.message}`)
    }
  }

  return name
}

// ── Batch CNAM lookup for multiple numbers ──
async function batchLookupCnam(phoneNumbers) {
  const results = {}
  // Process in parallel, max 5 concurrent
  const chunks = []
  for (let i = 0; i < phoneNumbers.length; i += 5) {
    chunks.push(phoneNumbers.slice(i, i + 5))
  }
  for (const chunk of chunks) {
    const promises = chunk.map(async phone => {
      const name = await lookupCnam(phone)
      results[phone] = name
    })
    await Promise.allSettled(promises)
  }
  return results
}

module.exports = {
  initCnamService,
  lookupCnam,
  batchLookupCnam,
}
