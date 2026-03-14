/* global process */
/**
 * Protection Enforcer — ensures ALL domains in the system have
 * Cloudflare Worker anti-red protection (both domain/* and www.domain/*).
 *
 * Sources:
 *  1. registeredDomains — domains registered via the bot
 *  2. domainsOf — custom domains used for link shortening
 *  3. cpanelAccounts — hosting accounts (main domain + addon domains)
 *
 * Runs on a schedule (configurable) to verify and repair protection.
 */

require('dotenv').config()
const { log } = require('console')
const axios = require('axios')

const CF_EMAIL = process.env.CLOUDFLARE_EMAIL
const CF_API_KEY = process.env.CLOUDFLARE_API_KEY
const CF_HEADERS = {
  'X-Auth-Email': CF_EMAIL,
  'X-Auth-Key': CF_API_KEY,
  'Content-Type': 'application/json',
}
const CF_BASE = 'https://api.cloudflare.com/client/v4'
const WORKER_NAME = 'antired-challenge'

// Our WHM/hosting server IP — only domains pointing here should get anti-red protection
const OUR_SERVER_IP = process.env.RENDER_APP_IP_ADDRESS || '199.247.22.196'
const WHM_HOST_IP = process.env.WHM_HOST || '199.247.22.196'

// How often to run enforcement (default: every 6 hours)
const ENFORCE_INTERVAL_MS = parseInt(process.env.PROTECTION_ENFORCE_INTERVAL_HOURS || '6', 10) * 60 * 60 * 1000

let db = null
let enforceTimer = null
let isRunning = false

// ─── Initialize ──────────────────────────────────────────

function init(mongoDb) {
  db = mongoDb
  log('[ProtectionEnforcer] Initialized')
}

// ─── Domain Collection ───────────────────────────────────

/**
 * Collect ALL domains from all sources in the database.
 * Returns array of { domain, source, cfZoneId? }
 */
async function collectAllDomains() {
  if (!db) throw new Error('ProtectionEnforcer not initialized')

  const domains = new Map() // domain → { source, cfZoneId }

  // 1. registeredDomains
  try {
    const registered = await db.collection('registeredDomains').find({}).toArray()
    for (const doc of registered) {
      const domain = doc.val?.domain || doc._id
      if (domain && typeof domain === 'string' && domain.includes('.')) {
        domains.set(domain.toLowerCase(), {
          source: 'registeredDomains',
          cfZoneId: doc.val?.cfZoneId || null,
        })
      }
    }
    log(`[ProtectionEnforcer] registeredDomains: ${registered.length} entries`)
  } catch (e) {
    log(`[ProtectionEnforcer] Error reading registeredDomains: ${e.message}`)
  }

  // 2. domainsOf (custom link shortener domains)
  // Format: { _id: chatId, "domain@tld": true, ... }
  try {
    const customDocs = await db.collection('domainsOf').find({}).toArray()
    let count = 0
    for (const doc of customDocs) {
      for (const key of Object.keys(doc)) {
        if (key === '_id') continue
        if (doc[key] !== true) continue
        // Convert "domain@tld" → "domain.tld"
        const domain = key.replace('@', '.').toLowerCase()
        if (domain.includes('.') && !domains.has(domain)) {
          domains.set(domain, { source: 'domainsOf', cfZoneId: null })
          count++
        }
      }
    }
    log(`[ProtectionEnforcer] domainsOf: ${count} unique custom domains`)
  } catch (e) {
    log(`[ProtectionEnforcer] Error reading domainsOf: ${e.message}`)
  }

  // 3. cpanelAccounts — main domain + try to get addon domains via CF zones
  try {
    const cpAccounts = await db.collection('cpanelAccounts').find({}).toArray()
    for (const account of cpAccounts) {
      const mainDomain = account.domain
      if (mainDomain && mainDomain.includes('.')) {
        // Include cpUser for SSL upgrade logic (AutoSSL needs the cPanel username)
        const existing = domains.get(mainDomain.toLowerCase())
        if (existing) {
          // Merge cpUser into existing entry
          existing.source = 'cpanelAccounts'
          existing.cpUser = account._id || account.cpUser || null
        } else {
          domains.set(mainDomain.toLowerCase(), {
            source: 'cpanelAccounts',
            cfZoneId: null,
            cpUser: account._id || account.cpUser || null,
          })
        }
      }
      // Check for addon domains stored in the account
      if (Array.isArray(account.addonDomains)) {
        for (const addon of account.addonDomains) {
          const d = (typeof addon === 'string' ? addon : addon.domain || '').toLowerCase()
          if (d && d.includes('.') && !domains.has(d)) {
            // Propagate cpUser from parent account so SSL enforcement works on addon domains
            domains.set(d, {
              source: 'cpanelAddon',
              cfZoneId: null,
              cpUser: account._id || account.cpUser || null,
              parentDomain: mainDomain?.toLowerCase() || null,
            })
          }
        }
      }
    }
    log(`[ProtectionEnforcer] cpanelAccounts: ${cpAccounts.length} accounts`)
  } catch (e) {
    log(`[ProtectionEnforcer] Error reading cpanelAccounts: ${e.message}`)
  }

  // Convert map to array
  const result = []
  for (const [domain, info] of domains) {
    result.push({ domain, ...info })
  }
  log(`[ProtectionEnforcer] Total unique domains: ${result.length}`)
  return result
}

// ─── Cloudflare Zone Lookup ──────────────────────────────

/**
 * Look up a Cloudflare zone by domain name.
 * Returns zone object { id, status } or null.
 */
async function findCFZone(domain) {
  try {
    const res = await axios.get(`${CF_BASE}/zones`, {
      params: { name: domain, per_page: 1 },
      headers: CF_HEADERS,
      timeout: 10000,
    })
    const zones = res.data?.result || []
    return zones.length > 0 ? { id: zones[0].id, status: zones[0].status } : null
  } catch {
    return null
  }
}

// ─── Worker Route Enforcement ────────────────────────────

/**
 * Check if a domain's root A record in Cloudflare points to our server.
 * Domains pointing elsewhere (user's own server) should NOT get anti-red Workers.
 * Returns true if domain points to our server, false otherwise.
 */
async function domainPointsToOurServer(domain, zoneId) {
  try {
    const res = await axios.get(`${CF_BASE}/zones/${zoneId}/dns_records`, {
      params: { type: 'A', name: domain },
      headers: CF_HEADERS,
      timeout: 10000,
    })
    const records = res.data?.result || []
    if (records.length === 0) {
      // No A record — might be CNAME; check if CNAME points to our infrastructure
      const cnameRes = await axios.get(`${CF_BASE}/zones/${zoneId}/dns_records`, {
        params: { type: 'CNAME', name: domain },
        headers: CF_HEADERS,
        timeout: 10000,
      })
      const cnames = cnameRes.data?.result || []
      // If no records at all, skip protection
      return cnames.length === 0 ? false : true
    }
    // Check if the A record points to our WHM server or Render app IP
    const ourIPs = [OUR_SERVER_IP, WHM_HOST_IP].filter(Boolean)
    return records.some(r => ourIPs.includes(r.content))
  } catch {
    // On error, default to protecting (safer)
    return true
  }
}

/**
 * Ensure a domain has both `domain/*` and `www.domain/*` worker routes.
 * Returns { domain, status, actions[] }
 */
async function enforceWorkerRoutes(domain, zoneId) {
  const actions = []

  try {
    // Get existing routes
    const routesRes = await axios.get(`${CF_BASE}/zones/${zoneId}/workers/routes`, {
      headers: CF_HEADERS,
      timeout: 10000,
    })
    const routes = routesRes.data?.result || []
    const hasMain = routes.some(r => r.pattern === `${domain}/*`)
    const hasWww = routes.some(r => r.pattern === `www.${domain}/*`)

    // Deploy main route if missing
    if (!hasMain) {
      try {
        await axios.post(`${CF_BASE}/zones/${zoneId}/workers/routes`, {
          pattern: `${domain}/*`,
          script: WORKER_NAME,
        }, { headers: CF_HEADERS, timeout: 10000 })
        actions.push(`deployed ${domain}/*`)
      } catch (e) {
        if (!e.response?.data?.errors?.some(err => err.message?.includes('duplicate'))) {
          actions.push(`FAILED ${domain}/*: ${e.message}`)
        } else {
          actions.push(`${domain}/* already exists (duplicate)`)
        }
      }
    }

    // Deploy www route if missing
    if (!hasWww) {
      try {
        await axios.post(`${CF_BASE}/zones/${zoneId}/workers/routes`, {
          pattern: `www.${domain}/*`,
          script: WORKER_NAME,
        }, { headers: CF_HEADERS, timeout: 10000 })
        actions.push(`deployed www.${domain}/*`)
      } catch (e) {
        if (!e.response?.data?.errors?.some(err => err.message?.includes('duplicate'))) {
          actions.push(`FAILED www.${domain}/*: ${e.message}`)
        } else {
          actions.push(`www.${domain}/* already exists (duplicate)`)
        }
      }
    }

    const status = hasMain && hasWww ? 'already_protected' : actions.length > 0 ? 'fixed' : 'already_protected'
    return { domain, zoneId, status, actions }
  } catch (err) {
    return { domain, zoneId, status: 'error', actions: [`route check failed: ${err.message}`] }
  }
}

// ─── SSL Mode Enforcement ──────────────────────────────

/**
 * Ensure hosting domains use 'full' SSL mode (not 'strict').
 * Cloudflare handles visitor-facing SSL. Origin uses self-signed cert.
 * 'full' mode encrypts CF→origin traffic and accepts self-signed certs.
 * 'strict' requires CA-signed certs on origin which causes 526 errors.
 *
 * If a domain is stuck on 'strict' (from old logic), downgrade to 'full'.
 * If a domain is on 'off' or 'flexible', upgrade to 'full'.
 */
async function enforceSSLMode(domain, zoneId) {
  try {
    const sslRes = await axios.get(`${CF_BASE}/zones/${zoneId}/settings/ssl`, {
      headers: CF_HEADERS,
      timeout: 10000,
    })
    const currentSSL = sslRes.data?.result?.value

    // 'full' is the target — no action needed
    if (currentSSL === 'full') return

    // Fix 'strict' (causes 526), 'off', or 'flexible' (insecure)
    if (currentSSL === 'strict' || currentSSL === 'off' || currentSSL === 'flexible') {
      await axios.patch(`${CF_BASE}/zones/${zoneId}/settings/ssl`, { value: 'full' }, {
        headers: CF_HEADERS,
        timeout: 10000,
      })
      log(`[ProtectionEnforcer] SSL FIXED: ${domain} from '${currentSSL}' → 'full'`)
    }
  } catch (err) {
    if (!err.message?.includes('ECONNREFUSED')) {
      log(`[ProtectionEnforcer] SSL mode check error for ${domain}: ${err.message}`)
    }
  }
}

// ─── Full Enforcement Run ────────────────────────────────

/**
 * Run a full enforcement pass across all domains.
 * Returns summary of actions taken.
 */
async function runEnforcement() {
  if (isRunning) {
    log('[ProtectionEnforcer] Enforcement already running, skipping')
    return { skipped: true }
  }

  isRunning = true
  const startTime = Date.now()
  log('[ProtectionEnforcer] ═══ Starting enforcement run ═══')

  const summary = {
    total: 0,
    protected: 0,
    fixed: 0,
    noZone: 0,
    errors: 0,
    actions: [],
  }

  try {
    const allDomains = await collectAllDomains()
    summary.total = allDomains.length

    for (const entry of allDomains) {
      const { domain, cfZoneId } = entry

      // Find Cloudflare zone
      let zoneId = cfZoneId
      if (!zoneId) {
        const zone = await findCFZone(domain)
        if (zone) {
          zoneId = zone.id
          // Update the registeredDomains with the found zone ID if applicable
          if (entry.source === 'registeredDomains') {
            try {
              await db.collection('registeredDomains').updateOne(
                { _id: domain },
                { $set: { 'val.cfZoneId': zoneId } }
              )
            } catch {}
          }
        }
      }

      if (!zoneId) {
        summary.noZone++
        continue
      }

      // Skip domains that don't point to our server (e.g., domain-only purchases
      // where the user set their own A record to their own server)
      const pointsToUs = await domainPointsToOurServer(domain, zoneId)
      if (!pointsToUs) {
        log(`[ProtectionEnforcer] SKIP: ${domain} — A record does not point to our server`)
        summary.protected++ // count as OK, just not ours to protect
        continue
      }

      // Only enforce Worker routes for domains with a hosting plan (cpanelAccounts or addon domains).
      // Domain-only domains should NOT get anti-red Workers, even if their DNS
      // points to our server (could be leftover DNS or misconfiguration).
      if (entry.source === 'cpanelAccounts' || entry.source === 'cpanelAddon') {
        // Enforce worker routes for hosting domains (main + addon)
        const result = await enforceWorkerRoutes(domain, zoneId)

        if (result.status === 'already_protected') {
          summary.protected++
        } else if (result.status === 'fixed') {
          summary.fixed++
          summary.actions.push(...result.actions)
          log(`[ProtectionEnforcer] FIXED: ${domain} — ${result.actions.join(', ')}`)
        } else {
          summary.errors++
          summary.actions.push(...result.actions)
        }

        // SSL mode enforcement for hosting domains — ensure 'full' mode (not 'strict')
        try {
          await enforceSSLMode(domain, zoneId)
        } catch (sslErr) {
          log(`[ProtectionEnforcer] SSL enforcement error for ${domain}: ${sslErr.message}`)
        }
      } else {
        // Non-hosting domain pointing to our server — just count as OK, no Workers
        summary.protected++
      }

      // Rate limit: Cloudflare API has limits
      await new Promise(r => setTimeout(r, 200))
    }
  } catch (err) {
    log(`[ProtectionEnforcer] Fatal error: ${err.message}`)
    summary.fatalError = err.message
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  log(`[ProtectionEnforcer] ═══ Enforcement complete in ${elapsed}s ═══`)
  log(`[ProtectionEnforcer] Total: ${summary.total} | Protected: ${summary.protected} | Fixed: ${summary.fixed} | No Zone: ${summary.noZone} | Errors: ${summary.errors}`)
  if (summary.actions.length > 0) {
    log(`[ProtectionEnforcer] Actions: ${summary.actions.join('; ')}`)
  }

  isRunning = false
  return summary
}

// ─── Scheduler ───────────────────────────────────────────

function startScheduler() {
  if (enforceTimer) {
    clearInterval(enforceTimer)
  }

  const hours = ENFORCE_INTERVAL_MS / (60 * 60 * 1000)
  log(`[ProtectionEnforcer] Scheduler started — runs every ${hours}h`)

  // Run first enforcement after 30 seconds (let services initialize)
  setTimeout(() => {
    runEnforcement().catch(e => log(`[ProtectionEnforcer] Scheduled run error: ${e.message}`))
  }, 30000)

  // Then run periodically
  enforceTimer = setInterval(() => {
    runEnforcement().catch(e => log(`[ProtectionEnforcer] Scheduled run error: ${e.message}`))
  }, ENFORCE_INTERVAL_MS)
}

function stopScheduler() {
  if (enforceTimer) {
    clearInterval(enforceTimer)
    enforceTimer = null
    log('[ProtectionEnforcer] Scheduler stopped')
  }
}

// ─── Exports ─────────────────────────────────────────────

module.exports = {
  init,
  collectAllDomains,
  enforceWorkerRoutes,
  runEnforcement,
  startScheduler,
  stopScheduler,
}
