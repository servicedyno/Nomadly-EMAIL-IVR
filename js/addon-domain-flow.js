/**
 * addon-domain-flow.js
 * --------------------
 * Single source of truth for "attach addon domain to existing hosting plan".
 * Used by:
 *   - js/cpanel-routes.js POST /domains/add (HostPanel web UI)
 *   - js/_index.js Telegram bot "➕ Add Domain to Plan" flow
 *
 * Responsibilities:
 *   1. Pre-flight validation (blocklist, plan addon-limit, duplicate-on-plan)
 *   2. cPanel `addaddondomain` call via cpanel-proxy
 *   3. Persist the addon to `cpanelAccounts.addonDomains[]`
 *   4. Cloudflare zone setup (find/create) + DNS conflict cleanup
 *   5. Hosting DNS records (root + www CNAME → CF Tunnel) + SSL + AOP
 *   6. Anti-red protection deployment with 3-retry back-off
 *   7. 30s post-deploy verification probe (best-effort, async)
 *   8. Health check schedule (5-min reachability probe)
 *
 * The function is idempotent within a hosting account: if the addon already
 * exists in `cpanelAccounts.addonDomains[]`, it returns `{ ok: true,
 * alreadyAttached: true }` without re-running WHM/CF/anti-red.
 */

const { log } = require('console')

// Folder path users will need to upload their site files to.
function getAddonDocRoot(domain) {
  return `public_html/${(domain || '').toLowerCase()}`
}

/**
 * @param {object} opts
 * @param {object} opts.account     - cpanelAccounts document (must include
 *                                    cpUser, cpPass_encrypted/iv/tag,
 *                                    domain (primary), plan, addonDomains[],
 *                                    optionally whmHost, chatId)
 * @param {string} opts.cpPass      - decrypted cPanel password (caller must decrypt)
 * @param {string} opts.domain      - addon domain to attach (lowercased internally)
 * @param {string} [opts.subDomain] - optional addon subdomain alias; defaults to
 *                                    domain.replace(/\./g,'')
 * @param {string} [opts.dir]       - optional document root; defaults to
 *                                    `public_html/<domain>` (relative to /home/<cpUser>)
 * @param {object} opts.db          - MongoDB db handle (for persistence + blocklist)
 * @param {object} [opts.bot]       - optional Telegram bot instance (for verify-fail DM)
 * @param {string} [opts.lang='en'] - user language for verify-fail DM
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   errorKind?: 'blocked'|'limit'|'duplicate'|'cpanel_down'|'whm_failed'|'no_credentials'|'unknown',
 *   error?: string,
 *   alreadyAttached?: boolean,
 *   docRoot?: string,
 *   limit?: number,
 *   currentAddons?: number,
 * }>}
 */
async function attachAddonDomain(opts) {
  const cpProxy = require('./cpanel-proxy')
  const cfService = require('./cf-service')
  const whmService = require('./whm-service')
  const antiRedService = require('./anti-red-service')

  const account = opts.account
  if (!account || !account.cpUser) {
    return { ok: false, errorKind: 'unknown', error: 'missing account' }
  }
  if (!opts.cpPass) {
    return { ok: false, errorKind: 'no_credentials', error: 'missing cPanel password' }
  }

  const domainRaw = (opts.domain || '').trim()
  const domain = domainRaw.toLowerCase()
  if (!domain || !domain.includes('.')) {
    return { ok: false, errorKind: 'unknown', error: 'invalid domain' }
  }
  const cpUser = account.cpUser
  const cpUserId = String(account._id || cpUser).toLowerCase()
  const whmHost = opts.account.whmHost || process.env.WHM_HOST
  const docRoot = opts.dir || getAddonDocRoot(domain)
  const subDomain = opts.subDomain || domain.replace(/\./g, '')

  const cpanelAccountsCol = opts.db.collection('cpanelAccounts')

  // ── Idempotency: already attached? ──
  const existingAddons = (account.addonDomains || []).map(d => (d || '').toLowerCase())
  if (existingAddons.includes(domain)) {
    log(`[AddonFlow] ${domain} already on ${cpUser} — returning idempotent success`)
    return { ok: true, alreadyAttached: true, docRoot }
  }
  // Reject if the requested domain is the primary (already served by main plan)
  if ((account.domain || '').toLowerCase() === domain) {
    return { ok: false, errorKind: 'duplicate', error: 'domain is already the primary on this plan' }
  }

  // ── Blocklist check ──
  try {
    const blocked = await opts.db.collection('blockedDomains').findOne({ domain })
    if (blocked) {
      log(`[AddonFlow] BLOCKED domain rejected: ${domain} (reason: ${blocked.reason})`)
      return { ok: false, errorKind: 'blocked', error: blocked.reason || 'domain is blocked' }
    }
  } catch (e) {
    log(`[AddonFlow] blocklist check warning: ${e.message}`)
  }

  // ── Plan addon-limit ──
  try {
    const limit = whmService.getAddonLimit(account.plan)
    const currentAddons = (account.addonDomains || []).length
    if (limit !== -1 && currentAddons >= limit) {
      return {
        ok: false,
        errorKind: 'limit',
        error: 'addon limit reached',
        limit,
        currentAddons,
      }
    }
  } catch (e) {
    log(`[AddonFlow] limit check warning (non-blocking): ${e.message}`)
  }

  // ── Duplicate check across all hosting accounts ──
  try {
    const dupe = await cpanelAccountsCol.findOne({
      $or: [{ domain }, { addonDomains: domain }],
      deleted: { $ne: true },
      _id: { $ne: cpUserId },
    })
    if (dupe) {
      return {
        ok: false,
        errorKind: 'duplicate',
        error: 'domain is already attached to a different hosting plan',
      }
    }
  } catch (e) {
    log(`[AddonFlow] duplicate-domain check warning: ${e.message}`)
  }

  // ── cPanel addaddondomain ──
  let result
  try {
    result = await cpProxy.addAddonDomain(cpUser, opts.cpPass, domain, subDomain, docRoot, whmHost)
  } catch (e) {
    log(`[AddonFlow] addAddonDomain threw: ${e.message}`)
    return { ok: false, errorKind: 'whm_failed', error: e.message }
  }

  // CPANEL_DOWN response → caller can re-queue
  if (result && result.code === 'CPANEL_DOWN') {
    return { ok: false, errorKind: 'cpanel_down', error: 'WHM unreachable' }
  }
  if (!result || result.status !== 1) {
    const errMsg = (result?.errors || []).join(', ') || 'cPanel rejected the addon'
    return { ok: false, errorKind: 'whm_failed', error: errMsg }
  }

  // ── Persist to cpanelAccounts.addonDomains[] ──
  try {
    await cpanelAccountsCol.updateOne(
      { _id: cpUserId },
      { $addToSet: { addonDomains: domain } }
    )
    log(`[AddonFlow] Persisted addon ${domain} on ${cpUser}`)
  } catch (e) {
    log(`[AddonFlow] persist warning: ${e.message}`)
  }

  // ── Cloudflare zone + DNS + SSL + anti-red (fire-and-forget) ──
  // We intentionally do NOT await this. Anti-red deployment + retries can take
  // up to ~65 seconds in the worst case (5s + 15s + 45s back-off), and the
  // user would otherwise see a hung spinner. The helper returns success right
  // after the WHM addaddondomain + DB persist (which is the authoritative
  // attach), and the DNS/protection runs in the background. The 30-second
  // verification probe DMs the user if anti-red didn't go live.
  ;(async () => {
    try {
      await runDnsAndProtection({
        domain,
        cpUser,
        whmHost,
        account,
        db: opts.db,
        bot: opts.bot,
        lang: opts.lang || 'en',
      })
    } catch (e) {
      log(`[AddonFlow] DNS/protection background pipeline error for ${domain}: ${e.message}`)
    }
  })()

  // ── Schedule 5-min health check (matches primary-domain provisioning) ──
  try {
    const healthCheck = require('./hosting-health-check')
    healthCheck.scheduleHealthCheck(domain, cpUser, account.chatId || '')
    log(`[AddonFlow] health check scheduled for addon ${domain}`)
  } catch (_) {}

  return { ok: true, docRoot }
}

/**
 * Internal: Cloudflare + anti-red pipeline shared with the panel route.
 * Mirrors cpanel-routes.js:594-688 exactly so behavior is identical.
 */
async function runDnsAndProtection({ domain, cpUser, whmHost, account, db, bot, lang }) {
  const cfService = require('./cf-service')
  const antiRedService = require('./anti-red-service')
  const { translation } = require('./translation')

  const MAX_RETRIES = 3
  const RETRY_DELAYS = [5000, 15000, 45000]

  let zoneId = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let zone = await cfService.getZoneByName(domain)
      if (!zone) {
        const newZone = await cfService.createZone(domain)
        if (newZone.success) zone = { id: newZone.zoneId }
      }
      if (!zone) throw new Error('Cloudflare zone could not be created or found')
      zoneId = zone.id

      await cfService.cleanupConflictingDNS(zoneId, domain)
      await cfService.createHostingDNSRecords(zoneId, domain, whmHost || process.env.WHM_HOST)
      await cfService.setSSLMode(zoneId, 'flexible')
      await cfService.enforceHTTPS(zoneId)
      try { await cfService.enableAuthenticatedOriginPulls(zoneId) } catch (_) {}

      await antiRedService.deployFullProtection(cpUser, domain, account.plan || '')
      log(`[AddonFlow] anti-red + DNS deployed for ${domain} (attempt ${attempt})`)
      break
    } catch (e) {
      log(`[AddonFlow] DNS/protection attempt ${attempt}/${MAX_RETRIES} for ${domain} failed: ${e.message}`)
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]))
      } else {
        log(`[AddonFlow] all ${MAX_RETRIES} protection attempts failed for ${domain}`)
        if (account?.chatId && bot) {
          try {
            bot.sendMessage(
              account.chatId,
              translation('t.antiRedFailedTitle', lang) + '\n\n' +
              translation('t.antiRedFailedBodyShort', lang, domain, MAX_RETRIES),
              { parse_mode: 'HTML' }
            ).catch(() => {})
          } catch (_) {}
        }
      }
    }
  }

  // 30s verification probe — runs in the background, may DM user if protection
  // didn't go live.
  if (zoneId && account?.chatId && bot) {
    setTimeout(async () => {
      try {
        const verification = await antiRedService.verifyProtection(domain)
        if (!verification?.active) {
          log(`[AddonFlow] verify: ⚠️ protection not live for ${domain}: ${verification?.error || 'no worker/challenge'}`)
          try {
            bot.sendMessage(
              account.chatId,
              translation('t.antiRedWarningTitle', lang) + '\n\n' +
              translation('t.antiRedWarningBodyShort', lang, domain),
              { parse_mode: 'HTML' }
            ).catch(() => {})
          } catch (_) {}
        } else {
          log(`[AddonFlow] verify: ✅ protection live for ${domain}`)
        }
      } catch (e) {
        log(`[AddonFlow] verify error for ${domain}: ${e.message}`)
      }
    }, 30000)
  }
}

module.exports = {
  attachAddonDomain,
  getAddonDocRoot,
}
