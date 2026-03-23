/**
 * Email Validation Engine — 7-layer self-hosted validation
 *
 * Layer 1: Syntax check (RFC 5322)
 * Layer 2: Disposable email filter (708+ domains)
 * Layer 3: Role-based detection (info@, admin@, etc.)
 * Layer 4: Free email provider detection (gmail, yahoo, etc.)
 * Layer 5: MX record lookup
 * Layer 6: SMTP RCPT TO verification (via VPS worker)
 * Layer 7: Catch-all domain detection (via VPS worker)
 *
 * Each email gets a confidence score 0–100.
 */

const dns = require('dns').promises
const path = require('path')
const http = require('http')
const https = require('https')
const { EV_CONFIG } = require('./email-validation-config.js')

// ── Disposable Domains (708+) ──
let _disposableList
try {
  _disposableList = require(path.join(__dirname, 'disposable-domains.json'))
} catch (e) {
  console.log('[EmailValidation] Warning: Could not load disposable-domains.json, using fallback')
  _disposableList = []
}
const DISPOSABLE_DOMAINS = new Set(_disposableList)

// ── Role-based Prefixes ──
const ROLE_PREFIXES = new Set([
  'abuse', 'admin', 'billing', 'compliance', 'devnull', 'dns', 'ftp',
  'hostmaster', 'info', 'inoc', 'ispfeedback', 'ispsupport', 'list',
  'list-request', 'maildaemon', 'mailer-daemon', 'marketing', 'media',
  'noc', 'no-reply', 'noreply', 'null', 'office', 'phish', 'phishing',
  'postmaster', 'privacy', 'registrar', 'root', 'sales', 'security',
  'spam', 'support', 'sysadmin', 'tech', 'undisclosed-recipients',
  'unsubscribe', 'usenet', 'uucp', 'webmaster', 'www', 'contact',
  'help', 'jobs', 'press', 'team', 'feedback', 'hello', 'hr',
  'legal', 'partners', 'recruitment', 'service', 'subscribe',
])

// ── Free Email Providers ──
const FREE_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.fr',
  'yahoo.de', 'yahoo.it', 'yahoo.es', 'yahoo.co.jp', 'yahoo.co.in',
  'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de',
  'live.com', 'live.co.uk', 'live.fr', 'msn.com',
  'aol.com', 'aim.com', 'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'zoho.com', 'zohomail.com',
  'mail.com', 'email.com', 'usa.com',
  'gmx.com', 'gmx.de', 'gmx.net', 'gmx.at',
  'yandex.com', 'yandex.ru', 'ya.ru',
  'mail.ru', 'inbox.ru', 'list.ru', 'bk.ru',
  'tutanota.com', 'tutamail.com', 'tuta.io',
  'fastmail.com', 'fastmail.fm',
  'rocketmail.com', 'att.net', 'sbcglobal.net',
  'comcast.net', 'verizon.net', 'cox.net', 'charter.net',
  'bellsouth.net', 'earthlink.net', 'optonline.net',
])

// Email syntax regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

// ── MX Cache ──
const mxCache = new Map()
const MX_CACHE_TTL = 10 * 60 * 1000

// ═══════════════════════════════════════
// Layer 1: Syntax Validation
// ═══════════════════════════════════════
function validateSyntax(email) {
  if (!email || typeof email !== 'string') return false
  email = email.trim().toLowerCase()
  if (email.length > 254) return false
  const local = email.split('@')[0]
  if (!local || local.length > 64) return false
  return EMAIL_REGEX.test(email)
}

// ═══════════════════════════════════════
// Layer 2: Disposable Email Detection
// ═══════════════════════════════════════
function isDisposable(email) {
  const domain = email.split('@')[1]
  return DISPOSABLE_DOMAINS.has(domain)
}

// ═══════════════════════════════════════
// Layer 3: Role-based Detection
// ═══════════════════════════════════════
function isRoleBased(email) {
  const local = email.split('@')[0].toLowerCase()
  return ROLE_PREFIXES.has(local)
}

// ═══════════════════════════════════════
// Layer 4: Free Email Provider Detection
// ═══════════════════════════════════════
function isFreeProvider(email) {
  const domain = email.split('@')[1].toLowerCase()
  return FREE_PROVIDERS.has(domain)
}

// ═══════════════════════════════════════
// Layer 5: MX Record Lookup
// ═══════════════════════════════════════
async function checkMx(email) {
  const domain = email.split('@')[1]
  const cached = mxCache.get(domain)
  if (cached && Date.now() - cached.ts < MX_CACHE_TTL) return cached.valid
  try {
    const records = await dns.resolveMx(domain)
    const valid = records && records.length > 0
    mxCache.set(domain, { valid, ts: Date.now() })
    return valid
  } catch {
    mxCache.set(domain, { valid: false, ts: Date.now() })
    return false
  }
}

// ═══════════════════════════════════════
// Layer 6+7: SMTP Verification + Catch-all (via VPS Worker)
// ═══════════════════════════════════════
async function smtpVerifyBatch(emails) {
  const workerUrl = EV_CONFIG.workerUrl
  const workerSecret = EV_CONFIG.workerSecret
  const timeout = EV_CONFIG.workerTimeout

  return new Promise((resolve, reject) => {
    const url = new URL('/verify-smtp', workerUrl)
    const isHttps = url.protocol === 'https:'
    const lib = isHttps ? https : http

    const payload = JSON.stringify({ emails })
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerSecret}`,
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout,
    }

    const req = lib.request(options, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve(parsed.results || [])
        } catch (e) {
          reject(new Error(`Worker parse error: ${e.message}`))
        }
      })
    })

    req.on('error', (e) => reject(new Error(`Worker connection error: ${e.message}`)))
    req.on('timeout', () => { req.destroy(); reject(new Error('Worker timeout')) })
    req.write(payload)
    req.end()
  })
}

// ═══════════════════════════════════════
// Confidence Scoring
// ═══════════════════════════════════════
function calculateScore(result) {
  let score = 0

  if (result.syntax === false) return 0
  if (result.disposable) return 0

  // Base score from SMTP result
  if (result.smtp_status === 'valid') score = 95
  else if (result.smtp_status === 'catch_all') score = 55
  else if (result.smtp_status === 'unknown') score = 40
  else if (result.smtp_status === 'invalid') return 0
  else if (result.smtp_status === 'skipped') {
    // No SMTP check was done — score based on MX only
    score = result.mx_valid ? 60 : 0
  } else {
    score = result.mx_valid ? 50 : 0
  }

  // Adjustments
  if (result.role_based) score = Math.min(score, 45)
  if (result.free_provider) score = Math.max(score - 5, 0)
  if (result.catch_all) score = Math.min(score, 55)

  return Math.round(score)
}

// ═══════════════════════════════════════
// Determine final category from score + flags
// ═══════════════════════════════════════
function categorize(result) {
  if (!result.syntax) return 'invalid'
  if (result.disposable) return 'disposable'
  if (!result.mx_valid) return 'invalid'
  if (result.smtp_status === 'invalid') return 'invalid'
  if (result.smtp_status === 'catch_all' || result.catch_all) return 'risky'
  if (result.role_based) return 'risky'
  if (result.smtp_status === 'valid') return 'valid'
  if (result.smtp_status === 'unknown') return 'unknown'
  if (result.smtp_status === 'skipped') return result.mx_valid ? 'unknown' : 'invalid'
  return 'unknown'
}

// ═══════════════════════════════════════
// Parse email list from CSV or TXT file content
// ═══════════════════════════════════════
function parseEmailList(content) {
  if (!content || typeof content !== 'string') return []
  const emails = new Set()
  const lines = content.split(/[\r\n]+/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const parts = trimmed.split(/[,;\t|]/)
    for (const part of parts) {
      const cleaned = part.trim().toLowerCase().replace(/^"|"$/g, '')
      if (EMAIL_REGEX.test(cleaned)) emails.add(cleaned)
    }
  }
  return [...emails]
}

// ═══════════════════════════════════════
// Full 7-Layer Batch Validation
// ═══════════════════════════════════════
/**
 * Validate a batch of emails through all 7 layers.
 *
 * @param {string[]} emails
 * @param {object} opts - { onProgress: (pct, stats) => void }
 * @returns {object[]} Array of result objects
 */
async function validateEmailBatch(emails, opts = {}) {
  const total = emails.length
  const results = []
  const smtpQueue = []    // emails that pass layers 1-5 → need SMTP
  const onProgress = opts.onProgress || (() => {})

  // ── Layers 1-5: Local checks ──
  let localDone = 0
  for (const email of emails) {
    const r = {
      email,
      syntax: validateSyntax(email),
      disposable: false,
      role_based: false,
      free_provider: false,
      mx_valid: false,
      smtp_status: 'skipped',
      smtp_reason: null,
      smtp_code: null,
      catch_all: false,
      score: 0,
      category: 'invalid',
    }

    // Layer 1: Syntax
    if (!r.syntax) {
      r.score = 0; r.category = 'invalid'; r.smtp_reason = 'bad_syntax'
      results.push(r)
      localDone++
      continue
    }

    // Layer 2: Disposable
    r.disposable = isDisposable(email)
    if (r.disposable) {
      r.score = 0; r.category = 'disposable'; r.smtp_reason = 'disposable'
      results.push(r)
      localDone++
      continue
    }

    // Layer 3: Role-based
    r.role_based = isRoleBased(email)

    // Layer 4: Free provider
    r.free_provider = isFreeProvider(email)

    // Layer 5: MX
    r.mx_valid = await checkMx(email)
    if (!r.mx_valid) {
      r.score = 0; r.category = 'invalid'; r.smtp_reason = 'no_mx'
      results.push(r)
      localDone++
      continue
    }

    // Queue for SMTP (layers 6-7)
    smtpQueue.push(r)
    localDone++

    // Progress for local layers (0-30%)
    if (localDone % 100 === 0) {
      const pct = Math.round((localDone / total) * 30)
      onProgress(pct, { phase: 'local', done: localDone, total })
    }
  }

  onProgress(30, { phase: 'local_done', done: localDone, total, smtpNeeded: smtpQueue.length })

  // ── Layers 6-7: SMTP + Catch-all via VPS Worker ──
  if (smtpQueue.length > 0) {
    const batchSize = EV_CONFIG.workerBatchSize
    const emailsToVerify = smtpQueue.map(r => r.email)
    const smtpMap = new Map() // email → smtp result

    let smtpDone = 0
    for (let i = 0; i < emailsToVerify.length; i += batchSize) {
      const batch = emailsToVerify.slice(i, i + batchSize)
      try {
        const smtpResults = await smtpVerifyBatch(batch)
        for (const sr of smtpResults) {
          smtpMap.set(sr.email, sr)
        }
      } catch (e) {
        console.log(`[EmailValidation] Worker batch error: ${e.message} — marking ${batch.length} as unknown`)
        for (const email of batch) {
          smtpMap.set(email, { email, status: 'unknown', reason: 'worker_error', catch_all: false })
        }
      }
      smtpDone += batch.length
      const pct = 30 + Math.round((smtpDone / emailsToVerify.length) * 65)
      onProgress(pct, { phase: 'smtp', done: smtpDone, total: emailsToVerify.length })
    }

    // Merge SMTP results back
    for (const r of smtpQueue) {
      const sr = smtpMap.get(r.email)
      if (sr) {
        r.smtp_status = sr.status || 'unknown'
        r.smtp_reason = sr.reason || null
        r.smtp_code = sr.code || null
        r.catch_all = sr.catch_all || false
      }
      r.score = calculateScore(r)
      r.category = categorize(r)
      results.push(r)
    }
  }

  onProgress(100, { phase: 'done', total: results.length })
  return results
}

module.exports = {
  validateSyntax,
  isDisposable,
  isRoleBased,
  isFreeProvider,
  checkMx,
  smtpVerifyBatch,
  parseEmailList,
  validateEmailBatch,
  calculateScore,
  categorize,
  DISPOSABLE_DOMAINS,
  ROLE_PREFIXES,
  FREE_PROVIDERS,
}
