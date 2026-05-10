/* global process */
/**
 * Protection Heartbeat — hourly self-healing check for every cPanel account.
 *
 * Ensures these critical Anti-Red artifacts exist and are intact on every
 * provisioned cPanel account:
 *
 *   1. /public_html/.user.ini                 → auto_prepend_file pointing at the challenge
 *   2. /public_html/.antired-challenge.php    → IP restore + session bootstrap
 *
 * If either is missing or has been mutated by a client/tool/template overwrite,
 * deployCFIPFix() is called to restore them immediately.
 *
 * This complements hosting-health-check.js (which only runs 5min/30min/2hr post-
 * provisioning) by covering the whole fleet indefinitely.
 */

require('dotenv').config()
const axios = require('axios')
const https = require('https')
const { log } = require('console')

const WHM_HOST = process.env.WHM_HOST
const WHM_USERNAME = process.env.WHM_USERNAME || 'root'
const WHM_TOKEN = process.env.WHM_TOKEN

const whmApi = WHM_HOST && WHM_TOKEN ? axios.create({
  baseURL: `https://${WHM_HOST}:2087/json-api`,
  headers: { Authorization: `whm ${WHM_USERNAME}:${WHM_TOKEN}` },
  timeout: 30000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
}) : null

// Run every hour by default
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.PROTECTION_HEARTBEAT_INTERVAL_MIN || '60', 10) * 60 * 1000

// Rate limit WHM calls — sleep between accounts
const PER_ACCOUNT_DELAY_MS = 250

let db = null
let heartbeatTimer = null
let isRunning = false

function init(mongoDb) {
  db = mongoDb
  log('[ProtectionHeartbeat] Initialized')
}

// ─── File fetch helpers (via WHM root token) ─────────────

async function getFile(cpUsername, dir, file) {
  try {
    const res = await whmApi.get('/cpanel', {
      params: {
        'api.version': 1,
        cpanel_jsonapi_user: cpUsername,
        cpanel_jsonapi_apiversion: 3,
        cpanel_jsonapi_module: 'Fileman',
        cpanel_jsonapi_func: 'get_file_content',
        dir, file,
      },
    })
    // cPanel returns `errors: ["No such user"]` for terminated accounts in the
    // result.errors array, while the HTTP call itself is a 200. Surface that
    // so the caller can short-circuit to `accountGone`.
    const result = res.data?.result
    if (result?.errors && Array.isArray(result.errors) && result.errors.length > 0) {
      return { content: '', whmErrors: result.errors }
    }
    return { content: result?.data?.content || '' }
  } catch (e) {
    return { content: '', fetchError: e.message, status: e.response?.status }
  }
}

// Intact if .user.ini contains our auto_prepend and challenge PHP is the IP-fix variant
function isUserIniIntact(content, cpUsername) {
  if (!content) return false
  const expected = `/home/${cpUsername}/public_html/.antired-challenge.php`
  return content.includes('auto_prepend_file') && content.includes(expected)
}

function isChallengePhpIntact(content) {
  if (!content) return false
  return content.includes('ANTIRED_IP_FIXED') &&
         content.includes('CF_CONNECTING_IP') &&
         content.includes("FIL212sD")
}

// ─── Core heartbeat ──────────────────────────────────────

// Track consecutive repairs per account to detect broken accounts
const consecutiveRepairs = {}
const MAX_CONSECUTIVE_REPAIRS = 3  // Skip after N consecutive repairs without sticking

async function checkAndRepair(cpUsername) {
  // Skip accounts stuck in repair loop
  if ((consecutiveRepairs[cpUsername] || 0) >= MAX_CONSECUTIVE_REPAIRS) {
    return { cpUsername, ok: false, action: 'skipped', reason: 'stuck_repair_loop' }
  }
  const [iniRes, phpRes] = await Promise.all([
    getFile(cpUsername, '/public_html', '.user.ini'),
    getFile(cpUsername, '/public_html', '.antired-challenge.php'),
  ])

  // ── If WHM says the user no longer exists, auto-mark as deleted in DB so
  // future heartbeats stop scanning it. Detected by either an explicit
  // "No such user" error from cPanel, or a 401/404 from WHM on both files.
  const whmErrCombined = [
    ...(iniRes.whmErrors || []),
    ...(phpRes.whmErrors || []),
  ]
  const looksGoneOnWhm =
    whmErrCombined.some(e => /No such user|user does not exist|Cpanel::Sys::Suspended/i.test(String(e))) ||
    ((iniRes.status === 401 || iniRes.status === 404) && (phpRes.status === 401 || phpRes.status === 404))
  if (looksGoneOnWhm) {
    if (db) {
      try {
        await db.collection('cpanelAccounts').updateOne(
          { _id: cpUsername },
          { $set: { deleted: true, deletedAt: new Date(), deletedReason: 'auto: not_on_whm', deletedBy: 'protection_heartbeat' } }
        )
        log(`[ProtectionHeartbeat] AUTO-DELETED ${cpUsername} in DB — account no longer on WHM (errs: ${JSON.stringify(whmErrCombined).slice(0,200)})`)
      } catch (dbErr) {
        log(`[ProtectionHeartbeat] auto-delete DB write failed for ${cpUsername}: ${dbErr.message}`)
      }
    }
    return { cpUsername, ok: false, action: 'skipped', reason: 'not_on_whm' }
  }

  const userIni = iniRes.content || ''
  const challenge = phpRes.content || ''

  const iniOk = isUserIniIntact(userIni, cpUsername)
  const phpOk = isChallengePhpIntact(challenge)

  if (iniOk && phpOk) {
    // Files are intact — reset consecutive repair counter
    if (consecutiveRepairs[cpUsername]) {
      consecutiveRepairs[cpUsername] = 0
    }
    return { cpUsername, ok: true, action: 'none' }
  }

  // Diagnostic: log what state the files are in before repair
  const iniState = !userIni ? 'MISSING' : !userIni.includes('auto_prepend_file') ? 'NO_PREPEND' : 'WRONG_PATH'
  const phpState = !challenge ? 'MISSING' : !challenge.includes('ANTIRED_IP_FIXED') ? 'WRONG_CONTENT' : 'PARTIAL'
  const iniSnippet = userIni ? userIni.slice(0, 120).replace(/\n/g, '\\n') : '(empty)'
  const phpSnippet = challenge ? challenge.slice(0, 120).replace(/\n/g, '\\n') : '(empty)'
  log(`[ProtectionHeartbeat] DIAG ${cpUsername}: .user.ini=${iniState} [${iniSnippet}] | .php=${phpState} [${phpSnippet}]`)

  // Repair — for .user.ini, MERGE our directive instead of overwriting
  // so we preserve any existing directives (e.g., from CMS/plugins/server)
  try {
    const antiRed = require('./anti-red-service')
    const expectedPrepend = `/home/${cpUsername}/public_html/.antired-challenge.php`

    // If .user.ini exists but lacks our directive, merge instead of overwrite
    if (userIni && !iniOk) {
      const mergedIni = mergeUserIni(userIni, cpUsername)
      await saveFile(cpUsername, '/public_html', '.user.ini', mergedIni)
      log(`[ProtectionHeartbeat] MERGED .user.ini for ${cpUsername} (preserved existing directives)`)
    }

    // For the challenge PHP and missing .user.ini, use the standard deployCFIPFix
    if (!userIni || !phpOk) {
      const result = await antiRed.deployCFIPFix(cpUsername)
      // If we already merged .user.ini above, re-merge to restore our directives
      // (deployCFIPFix overwrites .user.ini)
      if (userIni && !iniOk) {
        const freshIniRes = await getFile(cpUsername, '/public_html', '.user.ini')
        const _freshIni = freshIniRes.content || ''
        const reMerged = mergeUserIni(userIni, cpUsername)
        await saveFile(cpUsername, '/public_html', '.user.ini', reMerged)
      }
    }

    const reason = [
      !iniOk ? '.user.ini' : null,
      !phpOk ? '.antired-challenge.php' : null,
    ].filter(Boolean).join('+')
    log(`[ProtectionHeartbeat] REPAIRED ${cpUsername} (${reason}): OK`)
    consecutiveRepairs[cpUsername] = (consecutiveRepairs[cpUsername] || 0) + 1
    if (consecutiveRepairs[cpUsername] >= MAX_CONSECUTIVE_REPAIRS) {
      log(`[ProtectionHeartbeat] ⚠️ ${cpUsername} repaired ${MAX_CONSECUTIVE_REPAIRS}x consecutively — files won't stick. Skipping future repairs. Account may be suspended/terminated.`)
    }
    return { cpUsername, ok: true, action: 'repaired', reason }
  } catch (err) {
    log(`[ProtectionHeartbeat] Repair error for ${cpUsername}: ${err.message}`)
    return { cpUsername, ok: false, action: 'error', error: err.message }
  }
}

/**
 * Merge our auto_prepend directive into an existing .user.ini without losing
 * existing directives (e.g., from WordPress, LiteSpeed Cache, cPanel defaults).
 * PHP uses the LAST auto_prepend_file when duplicates exist, so ours goes at the bottom.
 */
function mergeUserIni(existingContent, cpUsername) {
  const expectedLine = `auto_prepend_file = /home/${cpUsername}/public_html/.antired-challenge.php`

  // Remove ALL auto_prepend_file lines (ours and any others — we'll add ours back at the bottom)
  let cleaned = existingContent.replace(/^auto_prepend_file\s*=.*$/gm, '')
  // Remove our comment header if it exists
  cleaned = cleaned.replace(/^;\s*Anti-Red:.*$/gm, '')
  // Clean up excessive blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()

  // Place our directive at the BOTTOM (PHP uses the last auto_prepend_file)
  const merged = `${cleaned ? cleaned + '\n\n' : ''}; Anti-Red: CF IP Restoration (do not remove)\n${expectedLine}`
  return merged
}

async function saveFile(cpUsername, dir, file, content) {
  await whmApi.get('/cpanel', {
    params: {
      'api.version': 1,
      cpanel_jsonapi_user: cpUsername,
      cpanel_jsonapi_apiversion: 3,
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'save_file_content',
      dir, file, content,
    },
  })
}

async function runHeartbeat() {
  if (!db) { log('[ProtectionHeartbeat] Not initialized'); return }
  if (!whmApi) { log('[ProtectionHeartbeat] WHM not configured — skipping'); return }
  if (isRunning) { log('[ProtectionHeartbeat] Already running — skipping'); return }

  isRunning = true
  const startTime = Date.now()
  const summary = { total: 0, ok: 0, repaired: 0, errors: 0, skipped: 0 }

  try {
    // Only scan ACTIVE accounts. Deleted accounts can never be repaired
    // (cPanel user is gone) and waste WHM API calls + flood the log with
    // "errors:14" lines after the repair-loop counter pins them.
    const accounts = await db.collection('cpanelAccounts').find({ deleted: { $ne: true } }).toArray()
    summary.total = accounts.length
    log(`[ProtectionHeartbeat] Checking ${accounts.length} cPanel accounts (deleted excluded)...`)

    for (const account of accounts) {
      const cpUsername = account._id || account.cpUser
      if (!cpUsername || typeof cpUsername !== 'string') continue

      const result = await checkAndRepair(cpUsername)
      if (result.action === 'none') summary.ok++
      else if (result.action === 'repaired' && result.ok) summary.repaired++
      else if (result.action === 'skipped') summary.skipped++
      else summary.errors++

      await new Promise(r => setTimeout(r, PER_ACCOUNT_DELAY_MS))
    }
  } catch (err) {
    log(`[ProtectionHeartbeat] Fatal error: ${err.message}`)
    summary.fatalError = err.message
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  log(`[ProtectionHeartbeat] Done in ${elapsed}s — total:${summary.total} ok:${summary.ok} repaired:${summary.repaired} skipped:${summary.skipped} errors:${summary.errors}`)
  isRunning = false
  return summary
}

// ─── Scheduler ───────────────────────────────────────────

function startScheduler() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  const minutes = HEARTBEAT_INTERVAL_MS / 60000
  log(`[ProtectionHeartbeat] Scheduler started — runs every ${minutes}m`)

  // Run first heartbeat after 2 minutes (let services initialize + stagger with enforcer)
  setTimeout(() => {
    runHeartbeat().catch(e => log(`[ProtectionHeartbeat] Run error: ${e.message}`))
  }, 2 * 60 * 1000)

  heartbeatTimer = setInterval(() => {
    runHeartbeat().catch(e => log(`[ProtectionHeartbeat] Run error: ${e.message}`))
  }, HEARTBEAT_INTERVAL_MS)
}

function stopScheduler() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
    log('[ProtectionHeartbeat] Scheduler stopped')
  }
}

module.exports = {
  init,
  checkAndRepair,
  runHeartbeat,
  startScheduler,
  stopScheduler,
}
