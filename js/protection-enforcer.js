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

// ─── Persistent Failure & DNS Cache Tracking ────────────
// Tracks CF zones that repeatedly fail SSL/AOP checks (auth errors, 404s).
// After 3+ consecutive failures, skip for 7 days to avoid log noise.
// Also caches "not pointing to us" DNS results to skip redundant CF API lookups.
const ZONE_FAILURE_THRESHOLD = 3         // Skip after N consecutive failures
const ZONE_FAILURE_SKIP_DAYS = 7         // How long to skip failing zones
const DNS_CACHE_SKIP_DAYS = 7            // Re-check stale domains after N days
const DNS_CACHE_MISS_THRESHOLD = 3       // Consecutive misses before caching as stale

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
    const status = err.response?.status
    if (status === 403 || status === 404) {
      return { domain, zoneId, status: 'stale_zone', actions: [`route check failed (HTTP ${status} — stale CF zone): ${err.message}`] }
    }
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

// ─── Origin Hardening (CT + Direct IP protection) ───────

/**
 * Ensure a hosting domain has Authenticated Origin Pulls enabled.
 * 
 * Origin CA cert install on WHM has been REMOVED — Cloudflare handles all SSL
 * (mode=full), so WHM's AutoSSL/self-signed certs are sufficient for CF→origin.
 *
 * @param {string} domain
 * @param {string} zoneId
 * @param {string|null} cpUser - cPanel username (unused now, kept for API compat)
 */
async function enforceOriginHardening(domain, zoneId, cpUser) {
  const actions = []
  const cfService = require('./cf-service')

  // Enable Authenticated Origin Pulls (blocks direct-IP and SNI scanning)
  try {
    const aopStatus = await cfService.getAuthenticatedOriginPullsStatus(zoneId)
    if (!aopStatus.enabled) {
      const result = await cfService.enableAuthenticatedOriginPulls(zoneId)
      if (result.success) {
        actions.push(`AOP enabled for ${domain}`)
      } else {
        actions.push(`AOP FAILED for ${domain}: ${result.error}`)
      }
    }
  } catch (err) {
    actions.push(`AOP check error for ${domain}: ${err.message}`)
  }

  return actions
}

// ─── Zone Failure Tracking Helpers ──────────────────────

/**
 * Check if a CF zone should be skipped due to persistent auth/SSL failures.
 * Returns true if zone has failed >= ZONE_FAILURE_THRESHOLD times and skip hasn't expired.
 */
async function isZoneSkipped(zoneId) {
  if (!db) return false
  try {
    const record = await db.collection('protectionZoneFailures').findOne({ _id: zoneId })
    if (!record || record.consecutiveFailures < ZONE_FAILURE_THRESHOLD) return false
    const skipUntil = new Date(record.lastFailedAt).getTime() + ZONE_FAILURE_SKIP_DAYS * 24 * 60 * 60 * 1000
    if (Date.now() < skipUntil) return true
    // Skip period expired — reset and allow retry
    await db.collection('protectionZoneFailures').deleteOne({ _id: zoneId })
    return false
  } catch { return false }
}

/**
 * Record a CF zone auth/SSL failure. Increments consecutive failure counter.
 */
async function recordZoneFailure(zoneId, domain, errorMsg) {
  if (!db) return
  try {
    await db.collection('protectionZoneFailures').updateOne(
      { _id: zoneId },
      {
        $inc: { consecutiveFailures: 1 },
        $set: { lastFailedAt: new Date(), lastDomain: domain, lastError: errorMsg },
        $setOnInsert: { firstFailedAt: new Date() }
      },
      { upsert: true }
    )
  } catch (e) { log(`[ProtectionEnforcer] Zone failure tracking error: ${e.message}`) }
}

/**
 * Reset zone failure counter (called when a zone succeeds).
 */
async function resetZoneFailure(zoneId) {
  if (!db) return
  try {
    await db.collection('protectionZoneFailures').deleteOne({ _id: zoneId })
  } catch { /* ignore */ }
}

// ─── DNS Result Cache Helpers ───────────────────────────

/**
 * Check if a domain's DNS "not pointing to us" result is cached and still valid.
 * Returns true if domain should be skipped (known stale).
 */
async function isDnsCacheStale(domain) {
  if (!db) return false
  try {
    const record = await db.collection('domainDnsCache').findOne({ _id: domain })
    if (!record || record.pointsToUs !== false) return false
    if (record.consecutiveMisses < DNS_CACHE_MISS_THRESHOLD) return false
    const skipUntil = new Date(record.checkedAt).getTime() + DNS_CACHE_SKIP_DAYS * 24 * 60 * 60 * 1000
    if (Date.now() < skipUntil) return true
    // Cache expired — allow fresh check
    return false
  } catch { return false }
}

/**
 * Update DNS cache after a live check.
 */
async function updateDnsCache(domain, pointsToUs) {
  if (!db) return
  try {
    if (pointsToUs) {
      await db.collection('domainDnsCache').deleteOne({ _id: domain })
    } else {
      await db.collection('domainDnsCache').updateOne(
        { _id: domain },
        {
          $inc: { consecutiveMisses: 1 },
          $set: { pointsToUs: false, checkedAt: new Date() },
          $setOnInsert: { firstMissAt: new Date() }
        },
        { upsert: true }
      )
    }
  } catch (e) { log(`[ProtectionEnforcer] DNS cache write error for ${domain}: ${e.message}`) }
}

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
    dnsSkipped: 0,
    zoneSkipped: 0,
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

      // ── DNS CACHE: Skip domains known to not point to us ──
      // Domains that consistently have A records pointing elsewhere are cached.
      // Re-checked every DNS_CACHE_SKIP_DAYS to detect if they return.
      const cachedStale = await isDnsCacheStale(domain)
      if (cachedStale) {
        summary.dnsSkipped++
        summary.protected++ // count as OK, just not ours
        continue
      }

      // Skip domains that don't point to our server (e.g., domain-only purchases
      // where the user set their own A record to their own server)
      const pointsToUs = await domainPointsToOurServer(domain, zoneId)
      await updateDnsCache(domain, pointsToUs) // persist result
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

        // ── Stale-zone self-heal: re-lookup CF zone and retry ──
        if (result.status === 'stale_zone') {
          log(`[ProtectionEnforcer] Stale zone detected for ${domain} (zoneId=${zoneId}), refreshing...`)
          try {
            const cfService = require('./cf-service')
            const freshZone = await cfService.getZoneByName(domain)
            if (freshZone && freshZone.id && freshZone.id !== zoneId) {
              await db.collection('registeredDomains').updateOne(
                { _id: domain },
                { $set: { 'val.cfZoneId': freshZone.id } }
              )
              log(`[ProtectionEnforcer] Zone refreshed for ${domain}: ${zoneId} → ${freshZone.id}`)
              zoneId = freshZone.id  // update local variable for downstream SSL/hardening
              const retryResult = await enforceWorkerRoutes(domain, freshZone.id)
              if (retryResult.status === 'already_protected') {
                summary.protected++
              } else if (retryResult.status === 'fixed') {
                summary.fixed++
                summary.actions.push(...retryResult.actions)
                log(`[ProtectionEnforcer] FIXED (after zone refresh): ${domain} — ${retryResult.actions.join(', ')}`)
              } else {
                summary.errors++
                summary.actions.push(...retryResult.actions)
              }
            } else if (!freshZone) {
              log(`[ProtectionEnforcer] Zone not found on CF for ${domain} — clearing stale cfZoneId`)
              await db.collection('registeredDomains').updateOne(
                { _id: domain },
                { $unset: { 'val.cfZoneId': '' } }
              )
              summary.errors++
              summary.actions.push(`${domain}: cleared stale zone (domain not on CF)`)
              continue  // skip SSL/hardening since zone is gone
            } else {
              log(`[ProtectionEnforcer] Zone ID unchanged for ${domain} — CF still rejecting`)
              summary.errors++
              summary.actions.push(...result.actions)
              continue
            }
          } catch (refreshErr) {
            log(`[ProtectionEnforcer] Zone refresh error for ${domain}: ${refreshErr.message}`)
            summary.errors++
            continue
          }
        } else if (result.status === 'already_protected') {
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
        // ── Zone Failure Tracking: skip zones with persistent auth/SSL errors ──
        const zoneIsSkipped = await isZoneSkipped(zoneId)
        if (zoneIsSkipped) {
          if (!summary._zoneSkipLogged) summary._zoneSkipLogged = new Set()
          if (!summary._zoneSkipLogged.has(zoneId)) {
            log(`[ProtectionEnforcer] SKIP SSL/AOP: ${domain} (zone ${zoneId}) — persistent auth failures (retries in ${ZONE_FAILURE_SKIP_DAYS}d)`)
            summary._zoneSkipLogged.add(zoneId)
          }
          summary.zoneSkipped++
        } else {
          let sslFailed = false
          try {
            await enforceSSLMode(domain, zoneId)
            // SSL succeeded — no failure to record (AOP check below may still fail)
          } catch (sslErr) {
            sslFailed = true
            log(`[ProtectionEnforcer] SSL enforcement error for ${domain}: ${sslErr.message}`)
            await recordZoneFailure(zoneId, domain, `SSL: ${sslErr.message}`)
          }

          // Origin hardening: Authenticated Origin Pulls (blocks direct-IP and SNI scanning)
          try {
            const cpUser = entry.cpUser || null
            const hardenActions = await enforceOriginHardening(domain, zoneId, cpUser)
            if (hardenActions.length > 0) {
              // Check if AOP failed
              const aopFailed = hardenActions.some(a => a.includes('FAILED') || a.includes('error'))
              if (aopFailed) {
                await recordZoneFailure(zoneId, domain, `AOP: ${hardenActions.join(', ')}`)
              } else {
                // AOP succeeded — reset any failure count
                if (!sslFailed) await resetZoneFailure(zoneId)
              }
              summary.actions.push(...hardenActions)
              log(`[ProtectionEnforcer] HARDENED: ${domain} — ${hardenActions.join(', ')}`)
            } else {
              // No actions needed (already hardened) — reset failures if SSL also passed
              if (!sslFailed) await resetZoneFailure(zoneId)
            }
          } catch (hardenErr) {
            log(`[ProtectionEnforcer] Origin hardening error for ${domain}: ${hardenErr.message}`)
            await recordZoneFailure(zoneId, domain, `Harden: ${hardenErr.message}`)
          }
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
  log(`[ProtectionEnforcer] Total: ${summary.total} | Protected: ${summary.protected} | Fixed: ${summary.fixed} | No Zone: ${summary.noZone} | Errors: ${summary.errors} | DNS Cached: ${summary.dnsSkipped} | Zone Skipped: ${summary.zoneSkipped}`)
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
