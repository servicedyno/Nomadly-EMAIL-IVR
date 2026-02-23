/* global process */
require('dotenv').config()
const axios = require('axios')
const crypto = require('crypto')
const { log } = require('console')

const WHM_HOST = process.env.WHM_HOST
const WHM_TOKEN = process.env.WHM_TOKEN
const WHM_USERNAME = process.env.WHM_USERNAME || 'root'
const WHM_BASE = `https://${WHM_HOST}:2087/json-api`
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

const whmApi = axios.create({
  baseURL: WHM_BASE,
  headers: { Authorization: WHM_AUTH },
  httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
  timeout: 30000,
})

function generateUsername(domain) {
  // cPanel usernames: max 8 chars, alphanumeric, starts with letter
  const clean = domain.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/gi, '').toLowerCase()
  const base = clean.substring(0, 4) || 'usr'
  const suffix = crypto.randomBytes(3).toString('hex').substring(0, 4)
  return base + suffix
}

// Retryable errors — generate a new username and try again
const RETRYABLE_PATTERNS = [
  'reserved username',
  'already exists',
  'username.*taken',
  'account.*already',
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
    { key: 'skiphttpdomaincheck', value: '1' },
  ]
  for (const { key, value } of tweaks) {
    try {
      const res = await whmApi.get('/set_tweaksetting', {
        params: { 'api.version': 1, key, value },
      })
      const ok = res.data?.metadata?.result === 1
      log(`[WHM] Tweak ${key}=${value}: ${ok ? 'OK' : 'FAIL'}`)
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
        maxaddon: 'unlimited',
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
    try {
      const cphulkRes = await whmApi.get('/configureservice', {
        params: {
          'api.version': 1,
        },
        timeout: 10000,
      }).catch(() => null)

      // Add to cPHulk whitelist
      const whitelistRes = await whmApi.get('/create_cphulk_record', {
        params: {
          'api.version': 1,
          ip,
          list_name: 'white',
          comment: `Auto-whitelisted by Nomadly at ${new Date().toISOString()}`,
        },
        timeout: 10000,
      })
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
    try {
      const csfRes = await whmApi.get('/csf_allow', {
        params: {
          'api.version': 1,
          ip,
          comment: `Nomadly auto-whitelist ${new Date().toISOString().split('T')[0]}`,
        },
        timeout: 10000,
      })
      if (csfRes.data?.metadata?.result === 1 || csfRes.data?.result === 1) {
        results.csf = true
        log(`[WHM-Whitelist] CSF: ${ip} allowed successfully`)
      } else {
        // CSF might not be installed, or IP already allowed
        const msg = JSON.stringify(csfRes.data?.metadata || csfRes.data || {})
        if (msg.includes('already') || msg.includes('exists')) {
          results.csf = true
          log(`[WHM-Whitelist] CSF: ${ip} already allowed`)
        } else {
          log(`[WHM-Whitelist] CSF response: ${msg}`)
        }
      }
    } catch (err) {
      // CSF not installed is common — not an error
      if (err.response?.status === 404 || err.message?.includes('404')) {
        log(`[WHM-Whitelist] CSF not installed on server (skipped)`)
      } else {
        log(`[WHM-Whitelist] CSF error: ${err.message}`)
      }
    }

    // 4. Also add to host access control (TCP wrappers)
    try {
      await whmApi.get('/add_host_access', {
        params: {
          'api.version': 1,
          daemon: 'ALL',
          access: 'allow',
          host: ip,
          comment: 'Nomadly auto-whitelist',
        },
        timeout: 10000,
      })
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
  PLAN_MAP,
}
