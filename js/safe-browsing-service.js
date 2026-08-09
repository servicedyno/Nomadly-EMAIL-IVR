/* global process */
/**
 * Google Safe Browsing + Domain Reputation Monitoring
 * Checks domains against Google Safe Browsing API v4 for malware/phishing flags.
 * Also checks domain/IP reputation via external blacklist services.
 */

require('dotenv').config()
const axios = require('axios')
const { log } = require('console')

const SB_API_KEY = process.env.GOOGLE_SAFE_BROWSING_KEY || ''
const SB_ENDPOINT = 'https://safebrowsing.googleapis.com/v4/threatMatches:find'

// In-memory cache: domain → { status, threats, checkedAt }
const cache = new Map()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

/**
 * Check a single domain against Google Safe Browsing API v4
 * Returns { safe: true/false, threats: [...], error: string|null }
 */
async function checkDomain(domain) {
  if (!SB_API_KEY) {
    return { safe: null, threats: [], error: 'GOOGLE_SAFE_BROWSING_KEY not configured' }
  }

  // Check cache first
  const cached = cache.get(domain)
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL) {
    return { safe: cached.safe, threats: cached.threats, error: null, cached: true }
  }

  try {
    const urls = [
      { url: `http://${domain}/` },
      { url: `https://${domain}/` },
    ]

    const res = await axios.post(`${SB_ENDPOINT}?key=${SB_API_KEY}`, {
      client: { clientId: 'nomadly-hosting', clientVersion: '1.0' },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: urls,
      },
    }, { timeout: 15000 })

    const matches = res.data?.matches || []
    const threats = matches.map(m => ({
      type: m.threatType,
      platform: m.platformType,
      url: m.threat?.url,
    }))

    const safe = threats.length === 0
    cache.set(domain, { safe, threats, checkedAt: Date.now() })
    return { safe, threats, error: null }
  } catch (err) {
    log(`[SafeBrowsing] Error checking ${domain}:`, err.message)
    return { safe: null, threats: [], error: err.message }
  }
}

/**
 * Check multiple domains at once (batched, max 500 URLs per request)
 */

/**
 * Check domain IP against common blacklists (DNSBL)
 * Uses basic DNS lookup — no API key needed
 */
async function checkBlacklists(domain) {
  const dns = require('dns').promises
  const blacklists = [
    'zen.spamhaus.org',
    'bl.spamcop.net',
    'b.barracudacentral.org',
  ]

  try {
    // Resolve domain to IP first
    const addresses = await dns.resolve4(domain).catch(() => [])
    if (addresses.length === 0) return { listed: false, error: 'Could not resolve domain', lists: [] }

    const ip = addresses[0]
    const reversed = ip.split('.').reverse().join('.')
    const listed = []

    for (const bl of blacklists) {
      try {
        await dns.resolve4(`${reversed}.${bl}`)
        listed.push(bl) // If resolves, IP is listed
      } catch (_) {
        // NXDOMAIN = not listed (expected for clean IPs)
      }
    }

    return { listed: listed.length > 0, ip, lists: listed, error: null }
  } catch (err) {
    return { listed: false, error: err.message, lists: [] }
  }
}

/**
 * Get cached status for a domain (if available)
 */

/**
 * Check if Safe Browsing API is configured
 */
function isConfigured() {
  return !!SB_API_KEY
}

module.exports = {
  checkDomain,
  
  checkBlacklists,
  
  isConfigured,
}
