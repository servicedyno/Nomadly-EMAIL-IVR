/* global process */
/**
 * DnsHealer — background self-healing for registry-side delegation failures.
 *
 * Why this exists:
 * Some ccTLDs (notably .de via DENIC, but also .nl/.se/.fi/.be/.ch/.ie/.it/.eu/.at/.li/.dk/.cz/.no)
 * run a pre-delegation nameserver check during/after registration. If our
 * Cloudflare zone wasn't fully published at the moment that check ran, the
 * registry refuses to publish the NS records — even though OpenProvider's API
 * returned a success response. The result: the customer's domain resolves to
 * a registry parking page (e.g. DENIC's `nx.denic.de` / `93.180.69.*`) instead
 * of Cloudflare. We saw this happen with teustbnk.de on 2026-05-26.
 *
 * What it does:
 * Every DNS_HEAL_INTERVAL_MIN minutes, this worker scans the registeredDomains
 * collection for cloudflare-managed domains and verifies — via Cloudflare DoH
 * — that public DNS actually delegates to Cloudflare. When it finds a domain
 * that doesn't, it walks a healing ladder:
 *   1. opService.disableDnssec(domain)   — best-effort, no-op if already off
 *   2. opService.updateNameservers(domain, [...cfNs])  — re-push to registry
 * Both of these helpers already retry on 5xx and auto-recover DNSSEC errors.
 *
 * Healing state lives in collection `dnsHealState` keyed by domain:
 *   {
 *     _id: domain,
 *     status: 'unknown' | 'healthy' | 'unhealthy' | 'healing' | 'stable' | 'escalated',
 *     attempts: int,                  // consecutive heal calls
 *     consecutiveHealthy: int,        // consecutive healthy probes (resets to 0 on unhealthy)
 *     lastProbeAt: Date,
 *     lastHealAttemptAt: Date | null,
 *     nextProbeAt: Date,              // earliest time worker will touch this row again
 *     lastError: string | null,
 *     lastPublicNs: [string],
 *     lastPublicA: [string],
 *   }
 *
 * Cadence:
 *   - Default probe interval: 5 min for active monitoring (first 7 days post-registration).
 *   - Exponential backoff between heal attempts: 5m → 10m → 30m → 1h → 2h → 4h (cap).
 *   - Escalate to admin Telegram (notifyAdmin) after MAX_ATTEMPTS (3) failed heals.
 *   - Once "stable" (3 consecutive healthy probes), probes drop to once per day.
 */

'use strict'

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const dnsChecker = require('./dns-checker')
const opService = require('./op-service')

// ── Config ──────────────────────────────────────────────────────────────────
const INTERVAL_MIN = parseInt(process.env.DNS_HEAL_INTERVAL_MIN || '5', 10)
const MAX_ATTEMPTS = parseInt(process.env.DNS_HEAL_MAX_ATTEMPTS || '3', 10)
const ACTIVE_WINDOW_DAYS = parseInt(process.env.DNS_HEAL_ACTIVE_WINDOW_DAYS || '7', 10)
const STABLE_PROBE_HOURS = parseInt(process.env.DNS_HEAL_STABLE_PROBE_HOURS || '24', 10)
const STABLE_THRESHOLD = parseInt(process.env.DNS_HEAL_STABLE_THRESHOLD || '3', 10)
const BACKOFF_LADDER_MIN = [5, 10, 30, 60, 120, 240]       // minutes between heal attempts
const HEAL_RECHECK_MIN = 5                                  // probe quickly after a heal call

// TLDs that require/perform pre-delegation NS checks at the registry.
// These are the ones most prone to silent delegation failure on initial
// registration. Other TLDs are still monitored, just less aggressively.
const PRE_DELEGATION_TLDS = new Set([
  'de', 'nl', 'se', 'fi', 'be', 'ch', 'ie', 'it', 'eu', 'at', 'li', 'dk', 'cz', 'no',
])

// Cloudflare authoritative-NS suffix — all CF customer NS look like
// `<word>.ns.cloudflare.com`. Two NS are assigned per zone.
const isCfNs = (host) => /\.ns\.cloudflare\.com\.?$/i.test(String(host || ''))

// Known registry parking IP ranges — appearing here proves the registry has
// not delegated to our NS yet. We currently know DENIC's `nx.denic.de`
// wildcard at `93.180.69.0/24`. Add more here as we observe them.
const PARKED_IP_PREFIXES = [
  '93.180.69.',   // DENIC nx.denic.de wildcard
]

// ── Helpers ─────────────────────────────────────────────────────────────────
const log = (...args) => console.log(`[DnsHealer]`, ...args)
const now = () => new Date()
const addMin = (mins, base = now()) => new Date(base.getTime() + mins * 60 * 1000)
const tldOf = (domain) => String(domain || '').split('.').pop().toLowerCase()

let bot = null
let notifyAdmin = null
let TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID
let _timer = null
let _running = false

/**
 * Probe public DNS to determine whether the registry is delegating this
 * domain to Cloudflare's nameservers. Returns a structured verdict.
 */
async function probeDelegation(domain) {
  const nsRes = await dnsChecker.resolve(domain, 'NS')
  const aRes = await dnsChecker.resolve(domain, 'A')

  const publicNs = (nsRes.answers || []).map((a) => String(a.data || '').toLowerCase())
  const publicA = (aRes.answers || []).map((a) => String(a.data || ''))
  const cfNsCount = publicNs.filter(isCfNs).length
  const parked = publicA.some((ip) => PARKED_IP_PREFIXES.some((p) => ip.startsWith(p)))

  // Healthy iff at least 2 CF nameservers in NS answer AND not landing on
  // a known registry parking IP.
  const healthy = cfNsCount >= 2 && !parked

  let reason = 'ok'
  if (!healthy) {
    if (parked) reason = `parked at registry (A=${publicA.join(',')})`
    else if (cfNsCount === 0 && publicNs.length === 0) reason = 'no NS in public DNS (registry not delegating)'
    else if (cfNsCount < 2) reason = `only ${cfNsCount} CF NS in public DNS (need ≥2). got: ${publicNs.join(',')}`
    else reason = 'unhealthy'
  }

  return { healthy, reason, publicNs, publicA, cfNsCount, parked }
}

/**
 * Apply the healing ladder once. Idempotent.
 * Returns { ok, action, error }.
 */
async function attemptHeal(domain, cfNameservers) {
  if (!Array.isArray(cfNameservers) || cfNameservers.length < 2) {
    return { ok: false, action: 'noop', error: 'missing CF nameservers for domain' }
  }

  // 1) Best-effort DNSSEC disable. Most domains never had DNSSEC set; this is
  //    a no-op for them but cheap. If it fails, log + continue — the real
  //    work is updateNameservers, which has its own DNSSEC autofix.
  try {
    await opService.disableDnssec(domain)
  } catch (e) {
    log(`disableDnssec(${domain}) soft-failed: ${e.message} — continuing`)
  }

  // 2) Re-push NS. opService.updateNameservers already retries on 5xx and
  //    self-heals DNSSEC errors.
  try {
    const upd = await opService.updateNameservers(domain, cfNameservers)
    if (upd && upd.error) {
      return { ok: false, action: 'updateNameservers', error: upd.error }
    }
    return { ok: true, action: 'updateNameservers', error: null }
  } catch (e) {
    return { ok: false, action: 'updateNameservers', error: e.message }
  }
}

function nextBackoffMin(attempts) {
  const i = Math.min(Math.max(0, attempts), BACKOFF_LADDER_MIN.length - 1)
  return BACKOFF_LADDER_MIN[i]
}

/**
 * Pick the next batch of domains to probe — those with nextProbeAt in the
 * past OR no state row yet but inside the active monitoring window.
 */
async function pickBatch(db) {
  const stateCol = db.collection('dnsHealState')
  const regCol = db.collection('registeredDomains')

  // 1) Rows already in healing/escalated/unhealthy — always re-probe when due
  const dueExisting = await stateCol
    .find({ nextProbeAt: { $lte: now() } })
    .sort({ nextProbeAt: 1 })
    .limit(200)
    .toArray()

  // 2) Recently-registered CF-managed domains that have no state yet
  const activeCutoff = new Date(now().getTime() - ACTIVE_WINDOW_DAYS * 24 * 3600 * 1000)
  const existingIds = new Set(dueExisting.map((s) => s._id))
  const newReg = await regCol
    .find({
      'val.nameserverType': 'cloudflare',
      'val.registeredAt': { $gte: activeCutoff },
      'val.status': 'registered',
    })
    .limit(200)
    .toArray()

  const newCandidates = newReg
    .filter((r) => !existingIds.has(r._id))
    .map((r) => ({ _id: r._id, status: 'unknown', attempts: 0, consecutiveHealthy: 0 }))

  return [...dueExisting, ...newCandidates]
}

async function processDomain(db, stateRow, regCol, stateCol) {
  const domain = stateRow._id
  const reg = await regCol.findOne({ _id: domain })
  if (!reg) return // domain was deleted/cancelled — skip
  if (reg.val?.nameserverType !== 'cloudflare') return // user moved off CF — don't touch

  const cfNs = reg.val?.nameservers || []
  const ownerChatId = reg.val?.ownerChatId || null

  const probe = await probeDelegation(domain)
  const tld = tldOf(domain)
  const preDelegationTld = PRE_DELEGATION_TLDS.has(tld)

  // ── Healthy branch ────────────────────────────────────────────────────────
  if (probe.healthy) {
    const consecutiveHealthy = (stateRow.consecutiveHealthy || 0) + 1
    const isStable = consecutiveHealthy >= STABLE_THRESHOLD
    const nextStatus = isStable ? 'stable' : 'healthy'
    const nextProbeAt = isStable
      ? addMin(STABLE_PROBE_HOURS * 60)
      : addMin(INTERVAL_MIN)

    // If we just recovered from healing/escalated/unhealthy, notify the user.
    const wasUnhealthy = ['healing', 'escalated', 'unhealthy'].includes(stateRow.status)
    if (wasUnhealthy && bot && ownerChatId) {
      try {
        bot.sendMessage(
          ownerChatId,
          `✅ Your domain <b>${domain}</b> is now live and resolving correctly. Thanks for your patience.`,
          { parse_mode: 'HTML' }
        ).catch(() => {})
      } catch (_) { /* ignore */ }

      if (notifyAdmin) {
        notifyAdmin(`[DnsHealer] RECOVERED: <code>${domain}</code> (owner ${ownerChatId})`)
      }
    }

    // BUG FIX (2026-02): Only reset `attempts` once the domain is truly
    // "stable" (consecutiveHealthy >= STABLE_THRESHOLD). Previously a single
    // healthy probe wiped attempts to 0, which meant a flapping domain
    // (healthy → unhealthy → healthy → unhealthy …) would log "attempt 1/3"
    // forever and never escalate. Keeping the counter across single-blip
    // recoveries lets us reach MAX_ATTEMPTS and escalate properly.
    const updateSet = {
      status: nextStatus,
      consecutiveHealthy,
      lastProbeAt: now(),
      nextProbeAt,
      lastError: null,
      lastPublicNs: probe.publicNs,
      lastPublicA: probe.publicA,
    }
    if (isStable) {
      updateSet.attempts = 0  // truly recovered — safe to clear
    }
    await stateCol.updateOne(
      { _id: domain },
      { $set: updateSet },
      { upsert: true }
    )
    return { domain, status: nextStatus }
  }

  // ── Unhealthy branch ──────────────────────────────────────────────────────
  // For non-pre-delegation TLDs (like .com), unhealthy usually just means
  // global DNS propagation in flight — don't immediately call OP. We give it
  // one full probe cycle of grace first, by demoting status to 'unhealthy'
  // without bumping attempts on the first occurrence.
  const isFirstUnhealthy = stateRow.status === 'unknown' || stateRow.status === 'healthy' || stateRow.status === 'stable'

  if (isFirstUnhealthy && !preDelegationTld) {
    const nextProbeAt = addMin(INTERVAL_MIN)
    await stateCol.updateOne(
      { _id: domain },
      { $set: {
        status: 'unhealthy',
        consecutiveHealthy: 0,
        lastProbeAt: now(),
        nextProbeAt,
        lastError: probe.reason,
        lastPublicNs: probe.publicNs,
        lastPublicA: probe.publicA,
      } },
      { upsert: true }
    )
    log(`${domain}: unhealthy (${probe.reason}) — grace period for non-preDelegation TLD, will recheck in ${INTERVAL_MIN}m`)
    return { domain, status: 'unhealthy' }
  }

  // Heal attempt
  const attempts = Math.min(stateRow.attempts || 0, MAX_ATTEMPTS)
  if (attempts >= MAX_ATTEMPTS || stateRow.status === 'escalated') {
    // Already escalated — keep probing at backoff cap, but don't call OP again
    // unless an operator runs /dnsheal manually.
    const nextProbeAt = addMin(BACKOFF_LADDER_MIN[BACKOFF_LADDER_MIN.length - 1])
    await stateCol.updateOne(
      { _id: domain },
      { $set: {
        status: 'escalated',
        consecutiveHealthy: 0,
        lastProbeAt: now(),
        nextProbeAt,
        lastError: probe.reason,
        lastPublicNs: probe.publicNs,
        lastPublicA: probe.publicA,
      } },
      { upsert: true }
    )
    return { domain, status: 'escalated' }
  }

  log(`${domain}: unhealthy (${probe.reason}) — heal attempt ${attempts + 1}/${MAX_ATTEMPTS}, CF NS=${cfNs.join(',')}`)
  const heal = await attemptHeal(domain, cfNs)
  const nextAttempts = attempts + 1
  const escalateNow = !heal.ok && nextAttempts >= MAX_ATTEMPTS
  const status = escalateNow ? 'escalated' : 'healing'

  const backoffMin = escalateNow
    ? BACKOFF_LADDER_MIN[BACKOFF_LADDER_MIN.length - 1]
    : nextBackoffMin(attempts)

  await stateCol.updateOne(
    { _id: domain },
    { $set: {
      status,
      consecutiveHealthy: 0,
      attempts: nextAttempts,
      lastHealAttemptAt: now(),
      lastProbeAt: now(),
      nextProbeAt: addMin(heal.ok ? HEAL_RECHECK_MIN : backoffMin),
      lastError: heal.error || probe.reason,
      lastHealAction: heal.action,
      lastPublicNs: probe.publicNs,
      lastPublicA: probe.publicA,
    } },
    { upsert: true }
  )

  log(`${domain}: heal action=${heal.action} ok=${heal.ok} err=${heal.error || '-'} → status=${status}, nextProbe=+${heal.ok ? HEAL_RECHECK_MIN : backoffMin}m`)

  // Escalation notice (sent once, when crossing into escalated)
  if (escalateNow && notifyAdmin) {
    notifyAdmin(
      `🚨 <b>[DnsHealer] ESCALATED</b>\n` +
      `Domain: <code>${domain}</code> (TLD .${tld})\n` +
      `Owner: <code>${ownerChatId || 'unknown'}</code>\n` +
      `Attempts: ${nextAttempts}/${MAX_ATTEMPTS}\n` +
      `Last reason: ${probe.reason}\n` +
      `Last heal error: ${heal.error || '-'}\n` +
      `Public NS: <code>${(probe.publicNs.join(', ') || '∅')}</code>\n` +
      `Public A: <code>${(probe.publicA.join(', ') || '∅')}</code>\n` +
      `CF NS expected: <code>${cfNs.join(', ')}</code>\n\n` +
      `Manual retry: <code>/dnsheal ${domain}</code>`
    )
  }

  return { domain, status }
}

async function tick(db) {
  if (_running) {
    log('tick: previous tick still running — skipping')
    return
  }
  _running = true
  try {
    const stateCol = db.collection('dnsHealState')
    const regCol = db.collection('registeredDomains')
    const batch = await pickBatch(db)

    const counters = { probed: 0, healthy: 0, healing: 0, escalated: 0, stable: 0, unhealthy: 0 }
    for (const row of batch) {
      try {
        const result = await processDomain(db, row, regCol, stateCol)
        if (!result) continue
        counters.probed++
        counters[result.status] = (counters[result.status] || 0) + 1
      } catch (e) {
        log(`processDomain(${row._id}) crashed: ${e.message}`)
      }
    }
    log(`tick: probed=${counters.probed} healthy=${counters.healthy} stable=${counters.stable} unhealthy=${counters.unhealthy} healing=${counters.healing} escalated=${counters.escalated}`)
  } finally {
    _running = false
  }
}

/**
 * Manual single-domain heal — used by the /dnsheal admin command.
 * Resets attempts so the worker will re-engage from scratch.
 */
async function manualHeal(db, domain) {
  const regCol = db.collection('registeredDomains')
  const stateCol = db.collection('dnsHealState')
  const reg = await regCol.findOne({ _id: domain })
  if (!reg) return { ok: false, error: 'domain not in registeredDomains' }
  if (reg.val?.nameserverType !== 'cloudflare') return { ok: false, error: `nameserverType=${reg.val?.nameserverType} (not cloudflare)` }

  // Reset attempts so it isn't blocked by escalation cap
  await stateCol.updateOne(
    { _id: domain },
    { $set: { attempts: 0, status: 'unknown', nextProbeAt: now() } },
    { upsert: true }
  )

  const fresh = await stateCol.findOne({ _id: domain })
  const result = await processDomain(db, fresh, regCol, stateCol)
  const after = await stateCol.findOne({ _id: domain })
  return { ok: true, result, state: after }
}

/**
 * Inline post-registration guard (B1).
 *
 * Called right after a successful opService.registerDomain. For pre-delegation
 * TLDs, waits up to ~60s for the registry to publish CF NS; if that fails,
 * applies the heal ladder once and waits another ~60s. Returns:
 *   { healthy: bool, action: 'noop'|'healed-now'|'queued-for-worker' }
 *
 * On 'queued-for-worker', the background tick() will keep re-probing.
 */
async function verifyDelegationOrQueue(db, domain, cfNameservers, ownerChatId = null) {
  const tld = tldOf(domain)
  // For non-pre-delegation TLDs, skip the inline wait — propagation is normal there.
  if (!PRE_DELEGATION_TLDS.has(tld)) {
    return { healthy: true, action: 'noop', skipped: 'not-preDelegation-TLD' }
  }

  log(`[B1] verifying delegation for ${domain} (TLD .${tld}) — up to 60s`)
  const tryFor = async (totalMs) => {
    const deadline = Date.now() + totalMs
    let last = null
    while (Date.now() < deadline) {
      last = await probeDelegation(domain)
      if (last.healthy) return last
      await new Promise((r) => setTimeout(r, 5000))
    }
    return last
  }

  let probe = await tryFor(60000)
  if (probe?.healthy) {
    log(`[B1] ${domain}: delegated on first wait — ok`)
    return { healthy: true, action: 'noop' }
  }

  // Heal once inline
  log(`[B1] ${domain}: not delegated yet (${probe?.reason}). Re-pushing NS to registrar…`)
  const heal = await attemptHeal(domain, cfNameservers)
  log(`[B1] ${domain}: heal ok=${heal.ok} action=${heal.action} err=${heal.error || '-'}`)

  probe = await tryFor(60000)
  if (probe?.healthy) {
    log(`[B1] ${domain}: delegated after inline heal — ok`)
    // Persist a clean state row
    await db.collection('dnsHealState').updateOne(
      { _id: domain },
      { $set: {
        status: 'healthy',
        attempts: 0,
        consecutiveHealthy: 1,
        lastProbeAt: now(),
        nextProbeAt: addMin(INTERVAL_MIN),
        lastError: null,
        lastHealAttemptAt: now(),
        lastPublicNs: probe.publicNs,
        lastPublicA: probe.publicA,
      } },
      { upsert: true }
    )
    return { healthy: true, action: 'healed-now' }
  }

  // Still not delegated — queue for the background healer
  log(`[B1] ${domain}: still not delegated after inline heal — queued for background DnsHealer`)
  await db.collection('dnsHealState').updateOne(
    { _id: domain },
    { $set: {
      status: 'healing',
      attempts: 1,                                    // we already burned one inline
      consecutiveHealthy: 0,
      lastHealAttemptAt: now(),
      lastProbeAt: now(),
      nextProbeAt: addMin(HEAL_RECHECK_MIN),
      lastError: heal.error || probe?.reason || 'unknown',
      lastPublicNs: probe?.publicNs || [],
      lastPublicA: probe?.publicA || [],
      ownerChatId,
    } },
    { upsert: true }
  )
  return { healthy: false, action: 'queued-for-worker', reason: probe?.reason }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
function startScheduler(db, opts = {}) {
  if (opts.bot) bot = opts.bot
  if (opts.notifyAdmin) notifyAdmin = opts.notifyAdmin
  if (opts.adminChatId) TELEGRAM_ADMIN_CHAT_ID = opts.adminChatId

  if (_timer) {
    log('startScheduler called twice — ignored')
    return
  }
  log(`startScheduler: every ${INTERVAL_MIN}m, max ${MAX_ATTEMPTS} heal attempts before escalation, active window ${ACTIVE_WINDOW_DAYS}d`)

  // Run one tick on boot (after 30s grace so other services come up)
  setTimeout(() => { tick(db).catch((e) => log(`boot tick crashed: ${e.message}`)) }, 30 * 1000)

  _timer = setInterval(() => {
    tick(db).catch((e) => log(`tick crashed: ${e.message}`))
  }, INTERVAL_MIN * 60 * 1000)
}

function stopScheduler() {
  if (_timer) {
    clearInterval(_timer)
    _timer = null
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  verifyDelegationOrQueue,
  manualHeal,
  probeDelegation,
  PRE_DELEGATION_TLDS,
  // Exported for testing
  _internals: { attemptHeal, tick, pickBatch, processDomain },
}
