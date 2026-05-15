/* global process */
require('dotenv').config()
const axios = require('axios')
const crypto = require('crypto')
const { log } = require('console')

const WHM_HOST = process.env.WHM_HOST
const WHM_TOKEN = process.env.WHM_TOKEN
const WHM_USERNAME = process.env.WHM_USERNAME || 'root'
// ── Tunnel routing (origin-IP-hidden) ──
// When WHM_API_URL is set, every WHM JSON API call is routed through that
// URL instead of `https://<WHM_HOST>:2087`. Used to route through Cloudflare
// Tunnel so the origin IP and port 2087 can stay locked down.
// Example value: "https://whm-api.hostbay.io"
const WHM_API_URL = (process.env.WHM_API_URL || '').replace(/\/+$/, '')
const WHM_BASE = WHM_API_URL ? `${WHM_API_URL}/json-api` : `https://${WHM_HOST}:2087/json-api`
const WHM_AUTH = `whm ${WHM_USERNAME}:${WHM_TOKEN}`

// Plan name mapping: bot plan names → WHM package names
const PLAN_MAP = {
  'premium anti-red (1-week)': 'Premium-Anti-Red-1-Week',
  'premium anti-red hostpanel (1-month)': 'Premium-Anti-Red-HostPanel-1-Month',
  'premium anti-red hostpanel (30 days)': 'Premium-Anti-Red-HostPanel-1-Month',
  'golden anti-red hostpanel (1-month)': 'Golden-Anti-Red-HostPanel-1-Month',
  'golden anti-red hostpanel (30 days)': 'Golden-Anti-Red-HostPanel-1-Month',
  'freedom plan': 'Premium-Anti-Red-1-Week',
  'starter': 'Premium-Anti-Red-1-Week',
  'pro': 'Premium-Anti-Red-HostPanel-1-Month',
  'business': 'Golden-Anti-Red-HostPanel-1-Month',
}

// Addon domain limits per WHM package (-1 = unlimited)
const PLAN_ADDON_LIMITS = {
  'Premium-Anti-Red-1-Week': 1,              // Weekly: 1 addon (2 total with primary)
  'Premium-Anti-Red-HostPanel-1-Month': 5,   // Premium Monthly: 5 addons (6 total)
  'Golden-Anti-Red-HostPanel-1-Month': -1,   // Golden Monthly: unlimited
}

/**
 * Get the addon domain limit for a given plan (by WHM package name or bot plan name)
 * Returns -1 for unlimited, or a positive number for the max allowed addon domains
 */
function getAddonLimit(planName) {
  // Try direct WHM package lookup first
  if (PLAN_ADDON_LIMITS[planName] !== undefined) return PLAN_ADDON_LIMITS[planName]
  // Try mapping from bot plan name
  const pkg = PLAN_MAP[(planName || '').toLowerCase()]
  if (pkg && PLAN_ADDON_LIMITS[pkg] !== undefined) return PLAN_ADDON_LIMITS[pkg]
  return -1 // default to unlimited for unknown plans
}

const whmApi = axios.create({
  baseURL: WHM_BASE,
  headers: {
    Authorization: WHM_AUTH,
    // Cloudflare Access service token (Zero Trust). Sent on every request;
    // ignored by direct WHM API but required when WHM_API_URL routes through
    // a CF Access-protected tunnel hostname.
    ...(process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET ? {
      'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID,
      'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET,
    } : {}),
  },
  httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
  timeout: 30000,
})

// ─── Transient-error retry helper ───────────────────────
// Used by autoWhitelistIP() to absorb the first-contact latency spike that
// happens on a cold Railway deploy (new outbound IP + CF-Access token verify
// + TLS handshake easily pushes past the per-call timeout). Retries ONLY on
// network-level timeouts/disconnects, never on HTTP 4xx/5xx — so legitimate
// "already whitelisted" / "not installed" responses still short-circuit.
const _TRANSIENT_NET_RX = /ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up|timeout of/i
function _isTransientNetErr(err) {
  if (!err) return false
  if (err.response) return false // we got an HTTP response — not a network error
  if (err.code && _TRANSIENT_NET_RX.test(err.code)) return true
  if (err.message && _TRANSIENT_NET_RX.test(err.message)) return true
  return false
}
async function _whmRetry(fn, { retries = 1, backoffMs = 1500 } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt >= retries || !_isTransientNetErr(err)) throw err
      log(`[WHM-Whitelist] transient error (${err.code || err.message}), retrying in ${backoffMs}ms…`)
      await new Promise(r => setTimeout(r, backoffMs))
    }
  }
  throw lastErr
}

function generateUsername(domain) {
  // cPanel usernames: max 8 chars, alphanumeric, MUST start with a letter
  const clean = domain.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/gi, '').toLowerCase()
  let base = clean.substring(0, 4) || 'usr'

  // cPanel rejects usernames that start with a digit — prefix with 'n' (Nomadly)
  if (/^[0-9]/.test(base)) {
    base = 'n' + clean.replace(/^[0-9]+/, '').substring(0, 3)
    // If still empty after stripping leading digits (e.g. domain "1234.com"), fallback
    if (base.length < 2) base = 'nusr'
  }

  // WHM reserves usernames starting with these prefixes — avoid them
  const reserved = ['test', 'root', 'admi', 'cpan', 'whm', 'www', 'mail', 'ftp', 'mysq', 'post', 'nob', 'daemon', 'bin']
  if (reserved.some(r => base.startsWith(r))) {
    // Prefix with 'n' (Nomadly) and use 3 chars from domain
    base = 'n' + clean.replace(/^[0-9]+/, '').substring(0, 3)
    if (base.length < 2) base = 'nusr'
  }

  const suffix = crypto.randomBytes(3).toString('hex').substring(0, 4)
  return base + suffix
}

// Retryable errors — generate a new username and try again
const RETRYABLE_PATTERNS = [
  'reserved username',
  'already exists',
  'username.*taken',
  'account.*already',
  'not a valid username',
]

function isRetryableError(errorMsg) {
  const lower = (errorMsg || '').toLowerCase()
  return RETRYABLE_PATTERNS.some(pattern => lower.match(new RegExp(pattern)))
}

function generatePassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const specials = '!@#$%&*'
  let pass = ''
  for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)]
  pass += specials[Math.floor(Math.random() * specials.length)]
  pass += crypto.randomBytes(2).toString('hex')
  return pass
}

// ─── WHM Tweak Settings (one-time) ──────────────────────

/**
 * Ensure WHM is configured to allow Cloudflare-pointed domains.
 * Sets allowremotedomains=1 and skiphttpdomaincheck=1.
 * Safe to call multiple times (idempotent).
 */
async function ensureCloudflareTweaks() {
  const tweaks = [
    { key: 'allowremotedomains', value: '1' },
    { key: 'skiphttpdomaincheck', value: '1', fallback: 'skipdomaincheck' },
  ]
  for (const { key, value, fallback } of tweaks) {
    try {
      const res = await whmApi.get('/set_tweaksetting', {
        params: { 'api.version': 1, key, value },
      })
      const ok = res.data?.metadata?.result === 1
      if (ok) {
        log(`[WHM] Tweak ${key}=${value}: OK`)
      } else if (fallback) {
        // Try fallback tweak name
        const res2 = await whmApi.get('/set_tweaksetting', {
          params: { 'api.version': 1, key: fallback, value },
        })
        const ok2 = res2.data?.metadata?.result === 1
        log(`[WHM] Tweak ${key} failed, fallback ${fallback}=${value}: ${ok2 ? 'OK' : 'FAIL (non-critical)'}`)
      } else {
        log(`[WHM] Tweak ${key}=${value}: FAIL (non-critical)`)
      }
    } catch (err) {
      log(`[WHM] Tweak ${key} error: ${err.message}`)
    }
  }
}

// ─── Core WHM Operations ────────────────────────────────

/**
 * Create a cPanel account
 * @param {string} domain - Domain name
 * @param {string} plan - Plan name (Starter Plan, Pro Plan, Business Plan)
 * @param {string} email - Contact email
 * @param {string} [customUsername] - Optional custom username
 * @param {object} [opts] - Options { useCloudflareNS: boolean }
 * @returns {{ success, username, password, domain, url, nameservers, error }}
 */
async function createAccount(domain, plan, email, customUsername, opts = {}) {
  const pkg = PLAN_MAP[plan.toLowerCase()]
  if (!pkg) return { success: false, error: `Unknown plan: ${plan}` }

  // If Cloudflare NS, ensure WHM allows remote domains first
  if (opts.useCloudflareNS) {
    await ensureCloudflareTweaks()
  }

  const MAX_RETRIES = 3
  let lastError = ''

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const username = customUsername || generateUsername(domain)
    const password = generatePassword()

    try {
      const params = {
        'api.version': 1,
        username,
        domain,
        plan: pkg,
        contactemail: email,
        password,
        maxpark: 'unlimited',
        maxaddon: PLAN_ADDON_LIMITS[pkg] === -1 ? 'unlimited' : PLAN_ADDON_LIMITS[pkg],
      }

      // Skip DNS check for Cloudflare-pointed domains (domain won't resolve to WHM yet)
      if (opts.useCloudflareNS) {
        params.skip_dns_check = 1
      }

      const res = await whmApi.get('/createacct', { params })

      const meta = res.data?.metadata
      if (meta?.result !== 1) {
        const reason = meta?.reason || 'Account creation failed'

        // If the error is retryable (reserved/taken username), try again with a new username
        if (!customUsername && attempt < MAX_RETRIES && isRetryableError(reason)) {
          log(`[WHM] Username "${username}" failed (${reason}), retrying with new username (attempt ${attempt}/${MAX_RETRIES})...`)
          lastError = reason
          continue
        }

        return { success: false, error: reason }
      }

      if (attempt > 1) {
        log(`[WHM] Account created on retry ${attempt}: ${username}@${domain} (${pkg})`)
      } else {
        log(`[WHM] Account created: ${username}@${domain} (${pkg})`)
      }
      return {
        success: true,
        username,
        password,
        domain,
        url: `https://${WHM_HOST}:2083`,
        nameservers: {
          ns1: `ns1.${WHM_HOST}`,
          ns2: `ns2.${WHM_HOST}`,
        },
        package: pkg,
      }
    } catch (err) {
      const errMsg = err.response?.data?.metadata?.reason || err.message
      const errCode = err.code || ''
      const isDown = !err.response && /ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up/i.test(errCode + ' ' + errMsg)

      // If WHM control plane is down (host refusing / timing out), do NOT
      // burn through retries — bubble up immediately so the caller can queue
      // the provisioning job. The pending-jobs worker re-runs createAccount()
      // when the probe sees WHM come back. Burning retries here just delays
      // the user's "your hosting is being prepared" message.
      if (isDown) {
        log(`[WHM] createAccount CPANEL_DOWN (${errCode || errMsg}) — caller will queue`)
        return { success: false, error: errMsg, code: 'CPANEL_DOWN' }
      }

      // If the error is retryable, try again with a new username
      if (!customUsername && attempt < MAX_RETRIES && isRetryableError(errMsg)) {
        log(`[WHM] Username "${username}" failed (${errMsg}), retrying with new username (attempt ${attempt}/${MAX_RETRIES})...`)
        lastError = errMsg
        continue
      }

      log(`[WHM] createAccount error: ${errMsg}`)
      return { success: false, error: errMsg }
    }
  }

  // All retries exhausted
  log(`[WHM] createAccount failed after ${MAX_RETRIES} attempts: ${lastError}`)
  return { success: false, error: lastError }
}

/**
 * Check if a domain already exists on the WHM server
 * @returns {{ exists: boolean, user?: string }}
 */
async function domainExists(domain) {
  try {
    const res = await whmApi.get('/domainuserdata', {
      params: { 'api.version': 1, domain },
    })
    const meta = res.data?.metadata
    if (meta?.result === 1 && res.data?.data?.userdata) {
      return { exists: true, user: res.data.data.userdata.user }
    }
    return { exists: false }
  } catch {
    return { exists: false }
  }
}

/**
 * List all accounts on WHM
 */
async function listAccounts() {
  try {
    const res = await whmApi.get('/listaccts', { params: { 'api.version': 1 } })
    return res.data?.data?.acct || []
  } catch (err) {
    log(`[WHM] listAccounts error: ${err.message}`)
    return []
  }
}

/**
 * Suspend a cPanel account
 */
async function suspendAccount(username, reason = 'Suspended by Nomadly') {
  try {
    const res = await whmApi.get('/suspendacct', {
      params: { 'api.version': 1, user: username, reason },
    })
    return res.data?.metadata?.result === 1
  } catch (err) {
    log(`[WHM] suspendAccount error: ${err.message}`)
    return false
  }
}

/**
 * Unsuspend a cPanel account
 */
async function unsuspendAccount(username) {
  try {
    const res = await whmApi.get('/unsuspendacct', {
      params: { 'api.version': 1, user: username },
    })
    return res.data?.metadata?.result === 1
  } catch (err) {
    log(`[WHM] unsuspendAccount error: ${err.message}`)
    return false
  }
}

/**
 * Terminate (delete) a cPanel account
 */
async function terminateAccount(username) {
  try {
    const res = await whmApi.get('/removeacct', {
      params: { 'api.version': 1, user: username },
    })
    return res.data?.metadata?.result === 1
  } catch (err) {
    log(`[WHM] terminateAccount error: ${err.message}`)
    return false
  }
}

/**
 * Change account password
 */
async function changePassword(username, newPassword) {
  try {
    const res = await whmApi.get('/passwd', {
      params: { 'api.version': 1, user: username, password: newPassword || generatePassword() },
    })
    const pwd = newPassword || generatePassword()
    return res.data?.metadata?.result === 1 ? { success: true, password: pwd } : { success: false }
  } catch (err) {
    log(`[WHM] changePassword error: ${err.message}`)
    return { success: false, error: err.message }
  }
}

/**
 * Upgrade/downgrade account package
 */
async function changePackage(username, newPlan) {
  const pkg = PLAN_MAP[newPlan.toLowerCase()]
  if (!pkg) return { success: false, error: `Unknown plan: ${newPlan}` }
  try {
    const res = await whmApi.get('/changepackage', {
      params: { 'api.version': 1, user: username, pkg },
    })
    return { success: res.data?.metadata?.result === 1, package: pkg }
  } catch (err) {
    log(`[WHM] changePackage error: ${err.message}`)
    return { success: false, error: err.message }
  }
}

/**
 * Get account details
 */
async function getAccountInfo(username) {
  try {
    const res = await whmApi.get('/accountsummary', {
      params: { 'api.version': 1, user: username },
    })
    if (res.data?.metadata?.result === 1) {
      return { success: true, data: res.data.data.acct?.[0] || res.data.data.acct }
    }
    return { success: false }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ─── Auto-Whitelist IP ──────────────────────────────────

/**
 * Automatically whitelist the current server's outbound IP on the WHM server.
 * This runs at startup so the app works regardless of hosting provider (Railway, Emergent, etc.)
 * Uses two approaches: cPHulk whitelist + CSF allow (if available)
 */
async function autoWhitelistIP() {
  try {
    // 1. Detect outbound IP
    const ipRes = await axios.get('https://api.ipify.org/', { timeout: 5000 })
    const ip = ipRes.data?.trim()
    if (!ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
      log(`[WHM-Whitelist] Invalid IP detected: ${ip}`)
      return { success: false, error: 'Invalid IP' }
    }
    log(`[WHM-Whitelist] Detected outbound IP: ${ip}`)

    const results = { ip, cphulk: false, csf: false }

    // 2. Whitelist in cPHulk (brute force protection)
    //
    // Timeout/retry notes (2026-05-02):
    //   Railway deploys pick a new outbound IP each time, and the FIRST WHM
    //   call after a cold start has to negotiate TLS + verify the CF-Access
    //   service token against the tunnel. That regularly pushes cold-path
    //   latency to 8-12 s. The old 10 s cap caused recurring
    //   `[WHM-Whitelist] cPHulk error: timeout of 10000ms exceeded` — 12
    //   occurrences in a 12 h window, each of which cascaded into
    //   `[cPanel Health] WHM control-plane DOWN` and paused job runs.
    //   Bumping to 20 s + 1 retry eliminates the cascade without masking
    //   genuinely-down WHM boxes (which still error out on the retry).
    try {
      const whitelistRes = await _whmRetry(() => whmApi.get('/create_cphulk_record', {
        params: {
          'api.version': 1,
          ip,
          list_name: 'white',
          comment: `Auto-whitelisted by Nomadly at ${new Date().toISOString()}`,
        },
        timeout: 20000,
      }))
      if (whitelistRes.data?.metadata?.result === 1) {
        results.cphulk = true
        log(`[WHM-Whitelist] cPHulk: ${ip} whitelisted successfully`)
      } else {
        // Check if already whitelisted (not an error)
        const msg = whitelistRes.data?.metadata?.reason || ''
        if (msg.includes('already') || msg.includes('exists')) {
          results.cphulk = true
          log(`[WHM-Whitelist] cPHulk: ${ip} already whitelisted`)
        } else {
          log(`[WHM-Whitelist] cPHulk response: ${msg}`)
        }
      }
    } catch (err) {
      log(`[WHM-Whitelist] cPHulk error: ${err.message}`)
    }

    // 3. Whitelist in CSF firewall (if installed)
    // Detection: If /csf_allow returns "Unknown app", CSF is NOT installed on this server.
    // In that case, skip silently — cPHulk + Host Access (step 4) are sufficient.
    try {
      const csfRes = await _whmRetry(() => whmApi.get('/csf_allow', {
        params: {
          'api.version': 1,
          ip,
          comment: `Nomadly auto-whitelist ${new Date().toISOString().split('T')[0]}`,
        },
        timeout: 20000,
      }))
      if (csfRes.data?.metadata?.result === 1 || csfRes.data?.result === 1) {
        results.csf = true
        log(`[WHM-Whitelist] CSF: ${ip} allowed successfully`)
      } else {
        const msg = JSON.stringify(csfRes.data?.metadata || csfRes.data || {})
        if (msg.includes('already') || msg.includes('exists')) {
          results.csf = true
          log(`[WHM-Whitelist] CSF: ${ip} already allowed`)
        } else if (msg.includes('Unknown app')) {
          // CSF plugin is not installed on this WHM — skip entirely
          results.csf = 'not_installed'
          log(`[WHM-Whitelist] CSF not installed on server (skipped)`)
        } else {
          log(`[WHM-Whitelist] CSF response: ${msg}`)
        }
      }
    } catch (err) {
      if (err.response?.status === 404 || err.message?.includes('404')) {
        results.csf = 'not_installed'
        log(`[WHM-Whitelist] CSF not installed on server (skipped)`)
      } else {
        log(`[WHM-Whitelist] CSF error: ${err.message}`)
      }
    }

    // 4. Also add to host access control (TCP wrappers)
    try {
      await _whmRetry(() => whmApi.get('/add_host_access', {
        params: {
          'api.version': 1,
          daemon: 'ALL',
          access: 'allow',
          host: ip,
          comment: 'Nomadly auto-whitelist',
        },
        timeout: 20000,
      }))
      log(`[WHM-Whitelist] Host Access: ${ip} added`)
    } catch (err) {
      // Non-critical
      log(`[WHM-Whitelist] Host Access: ${err.message}`)
    }

    log(`[WHM-Whitelist] Complete — IP: ${ip}, cPHulk: ${results.cphulk}, CSF: ${results.csf}`)
    return { success: true, ...results }
  } catch (err) {
    log(`[WHM-Whitelist] Failed to auto-whitelist: ${err.message}`)
    return { success: false, error: err.message }
  }
}

// ─── AutoSSL ─────────────────────────────────────────────

/**
 * Trigger AutoSSL check for a specific cPanel user.
 * WHM API: start_autossl_check_for_one_user
 * This will request Let's Encrypt (or whatever AutoSSL provider is configured)
 * to issue/renew certificates for all domains under that user.
 */
async function startAutoSSL(cpUser) {
  try {
    const res = await whmApi.get('/start_autossl_check_for_one_user', {
      params: {
        'api.version': 1,
        username: cpUser,
      },
      timeout: 60000, // AutoSSL can take a while
    })
    const meta = res.data?.metadata || {}
    if (meta.result === 1) {
      log(`[WHM-AutoSSL] Triggered for user: ${cpUser}`)
      return { success: true, message: 'AutoSSL check started' }
    } else {
      const reason = meta.reason || 'Unknown error'
      log(`[WHM-AutoSSL] Failed for ${cpUser}: ${reason}`)
      return { success: false, error: reason }
    }
  } catch (err) {
    log(`[WHM-AutoSSL] Error for ${cpUser}: ${err.message}`)
    return { success: false, error: err.message }
  }
}

/**
 * Check if AutoSSL has issued a valid (CA-signed) cert for a domain on the WHM server.
 * Connects directly to WHM_HOST:443 with the domain as SNI and inspects the certificate.
 * @param {string} domain - Domain to check
 * @returns {{ valid: boolean, selfSigned: boolean, issuer?: string, subject?: string, expiresAt?: string }}
 */
async function checkSSLCert(domain) {
  const https = require('https')
  return new Promise((resolve) => {
    const req = https.request({
      hostname: WHM_HOST,
      port: 443,
      path: '/',
      method: 'HEAD',
      servername: domain, // SNI — tells server which cert to present
      rejectUnauthorized: false, // Don't reject — we want to inspect, not enforce
      timeout: 15000,
    }, (res) => {
      try {
        const cert = res.socket.getPeerCertificate()
        const authorized = res.socket.authorized // true if cert is from a trusted CA

        if (!cert || !cert.issuer) {
          resolve({ valid: false, selfSigned: true, issuer: 'none', subject: 'none' })
          return
        }

        const issuerOrg = cert.issuer.O || cert.issuer.CN || 'unknown'
        const subjectCN = cert.subject?.CN || 'unknown'
        const isSelfSigned = !authorized || issuerOrg.toLowerCase().includes('cpanel') || issuerOrg.toLowerCase().includes('self')

        resolve({
          valid: authorized,
          selfSigned: isSelfSigned,
          issuer: issuerOrg,
          subject: subjectCN,
          expiresAt: cert.valid_to || null,
        })
      } catch (e) {
        resolve({ valid: false, selfSigned: true, error: e.message })
      }
    })
    req.on('error', (err) => resolve({ valid: false, selfSigned: true, error: err.message }))
    req.on('timeout', () => { req.destroy(); resolve({ valid: false, selfSigned: true, error: 'timeout' }) })
    req.end()
  })
}

// ─── Origin Hardening: SSL & AutoSSL ──────────────────────

/**
 * Install an SSL certificate on a specific domain via WHM API.
 * Uses the WHM `installssl` endpoint which can install SSL on any domain on the server.
 *
 * @param {string} cpUser - cPanel username that owns the domain
 * @param {string} domain - Domain to install cert on
 * @param {string} cert - PEM-encoded certificate
 * @param {string} key - PEM-encoded private key
 * @param {string} [cabundle] - PEM-encoded CA bundle (optional for Origin CA)
 * @returns {{ success, message?, error? }}
 */
async function installDomainSSL(cpUser, domain, cert, key, cabundle = '') {
  try {
    const res = await whmApi.get('/installssl', {
      params: {
        'api.version': 1,
        domain,
        crt: cert,
        key,
        cab: cabundle,
        // ip: is auto-detected by WHM
      },
      timeout: 60000,
    })
    const meta = res.data?.metadata || {}
    if (meta.result === 1) {
      log(`[WHM-SSL] Installed Origin CA cert on ${domain} (user: ${cpUser})`)
      return { success: true, message: `SSL installed on ${domain}` }
    } else {
      const reason = meta.reason || res.data?.data?.message || 'Unknown error'
      log(`[WHM-SSL] installssl failed for ${domain}: ${reason}`)
      return { success: false, error: reason }
    }
  } catch (err) {
    log(`[WHM-SSL] installDomainSSL error for ${domain}: ${err.message}`)
    return { success: false, error: err.message }
  }
}

/**
 * Ensure AutoSSL does NOT overwrite externally-installed certificates (like CF Origin CA).
 * When clobber_externally_signed=0 (default), AutoSSL skips domains with non-AutoSSL certs.
 * This prevents Let's Encrypt from issuing certs that expose the origin IP via CT logs.
 *
 * @param {string} cpUser - cPanel username
 * @param {string[]} domains - Domains to protect (for logging only — protection is user-wide)
 */
async function excludeDomainsFromAutoSSL(cpUser, domains) {
  try {
    // Check current setting
    const getRes = await whmApi.get('/get_autossl_metadata', {
      params: { 'api.version': 1, username: cpUser },
      timeout: 15000,
    })
    const payload = getRes.data?.data?.payload || {}

    if (payload.clobber_externally_signed === 0) {
      log(`[WHM-AutoSSL] clobber_externally_signed=0 already set for ${cpUser} — Origin CA certs safe from overwrite`)
      return { success: true, message: 'Already protected' }
    }

    // Force clobber_externally_signed to 0
    const setRes = await whmApi.get('/set_autossl_metadata', {
      params: {
        'api.version': 1,
        username: cpUser,
        metadata_json: JSON.stringify({ clobber_externally_signed: 0 }),
      },
      timeout: 15000,
    })
    const meta = setRes.data?.metadata || {}
    if (meta.result === 1) {
      log(`[WHM-AutoSSL] Set clobber_externally_signed=0 for ${cpUser} — AutoSSL will not overwrite Origin CA certs for: ${domains.join(', ')}`)
      return { success: true, message: 'clobber_externally_signed set to 0' }
    } else {
      const reason = meta.reason || 'Unknown error'
      log(`[WHM-AutoSSL] Failed to set clobber_externally_signed for ${cpUser}: ${reason}`)
      return { success: false, error: reason }
    }
  } catch (err) {
    log(`[WHM-AutoSSL] excludeDomainsFromAutoSSL error for ${cpUser}: ${err.message}`)
    return { success: false, error: err.message }
  }
}

module.exports = {
  createAccount,
  domainExists,
  listAccounts,
  suspendAccount,
  unsuspendAccount,
  terminateAccount,
  changePassword,
  changePackage,
  getAccountInfo,
  generatePassword,
  ensureCloudflareTweaks,
  autoWhitelistIP,
  startAutoSSL,
  checkSSLCert,
  PLAN_MAP,
  PLAN_ADDON_LIMITS,
  getAddonLimit,
  // Origin Hardening
  installDomainSSL,
  excludeDomainsFromAutoSSL,
}
