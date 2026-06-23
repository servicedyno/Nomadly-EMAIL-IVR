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
// BUG FIX (2026-02): Counter is also persisted to `cpanelAccounts.protectionRepairCount`
// so it survives container restarts. Previously the in-memory map reset every
// boot, which meant the 3x-skip guard never actually triggered in production
// for accounts that were being repaired every hour.
const consecutiveRepairs = {}
const MAX_CONSECUTIVE_REPAIRS = 3  // Skip after N consecutive repairs without sticking

// ── PREVENTION (2026-06): never give up FOREVER on a stuck account ──
// Before this, hitting MAX_CONSECUTIVE_REPAIRS excluded the account from all
// future scans permanently. A transient cause — e.g. a one-time client upload
// that overwrote/deleted .user.ini + .antired-challenge.php, or a brief WHM
// hiccup — would then leave a PAID Anti-Red site serving the cloak 404/decoy to
// its own owner indefinitely, with no alert. (Root-caused on securitedesjardins.com.)
// Now: after a cooldown we reset the counter and retry once, and we alert the
// admin the first time an account gets stuck.
const STUCK_RETRY_COOLDOWN_MS = parseInt(process.env.PROTECTION_STUCK_RETRY_COOLDOWN_MIN || '360', 10) * 60 * 1000

// Pure helper: has a stuck account cooled down enough to retry? (testable, no WHM)
function isStuckCooledDown(stuckAt, now = Date.now()) {
  if (!stuckAt) return false
  return (now - new Date(stuckAt).getTime()) >= STUCK_RETRY_COOLDOWN_MS
}

// Pure helper: the cpanelAccounts scan filter (testable, no WHM). Includes
// healthy accounts AND stuck-but-cooled-down accounts (for one auto-recovery try).
function buildAccountScanFilter(now = Date.now()) {
  const cooldownCutoff = new Date(now - STUCK_RETRY_COOLDOWN_MS)
  return {
    deleted: { $ne: true },
    $or: [
      { protectionRepairCount: { $exists: false } },
      { protectionRepairCount: { $lt: MAX_CONSECUTIVE_REPAIRS } },
      { protectionRepairCount: { $gte: MAX_CONSECUTIVE_REPAIRS }, protectionStuckAt: { $lte: cooldownCutoff } },
    ],
  }
}

// Best-effort admin Telegram alert (never throws, never blocks the heartbeat).
// Uses the active bot token (config-setup.js sets TELEGRAM_BOT_TOKEN to dev/prod).
async function alertAdmin(html) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN_PROD
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
    if (!token || !chatId) return
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true,
    }, { timeout: 10000 })
  } catch (e) { /* best-effort */ }
}

async function getRepairCount(cpUsername) {
  // In-memory cache wins if set (latest within this process), otherwise
  // fall back to the persisted DB value.
  if (cpUsername in consecutiveRepairs) return consecutiveRepairs[cpUsername]
  if (!db) return 0
  try {
    const doc = await db.collection('cpanelAccounts').findOne(
      { _id: cpUsername },
      { projection: { protectionRepairCount: 1 } }
    )
    const persisted = (doc && doc.protectionRepairCount) || 0
    consecutiveRepairs[cpUsername] = persisted
    return persisted
  } catch (e) {
    return 0
  }
}

async function setRepairCount(cpUsername, count, extra = {}) {
  consecutiveRepairs[cpUsername] = count
  if (!db) return
  try {
    await db.collection('cpanelAccounts').updateOne(
      { _id: cpUsername },
      { $set: { protectionRepairCount: count, protectionRepairUpdatedAt: new Date(), ...extra } }
    )
  } catch (e) {
    log(`[ProtectionHeartbeat] persist repair counter failed for ${cpUsername}: ${e.message}`)
  }
}

async function checkAndRepair(cpUsername) {
  // Skip accounts stuck in repair loop (counter is persisted in Mongo so it
  // survives restarts — otherwise the guard never fires in production).
  const currentCount = await getRepairCount(cpUsername)
  if (currentCount >= MAX_CONSECUTIVE_REPAIRS) {
    // PREVENTION: don't skip forever. After a cooldown, reset the counter and try
    // ONE more full repair so a paid site that broke for a transient reason can
    // self-heal (instead of serving the cloak 404/decoy to its owner indefinitely).
    let stuckAt = null
    try {
      const doc = await db.collection('cpanelAccounts').findOne(
        { _id: cpUsername }, { projection: { protectionStuckAt: 1 } })
      stuckAt = doc && doc.protectionStuckAt
    } catch (e) { /* ignore — fall back to skip below */ }
    if (!isStuckCooledDown(stuckAt)) {
      return { cpUsername, ok: false, action: 'skipped', reason: 'stuck_repair_loop' }
    }
    const mins = stuckAt ? Math.round((Date.now() - new Date(stuckAt).getTime()) / 60000) : 0
    log(`[ProtectionHeartbeat] ${cpUsername} cooled down (${mins}m since stuck) — auto-resetting counter for one more repair attempt`)
    await setRepairCount(cpUsername, 0, { protectionLastSkipReason: null, protectionStuckAt: null, protectionAutoRecoveryAt: new Date() })
    // fall through with a fresh (0) counter
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
    // Files are intact — reset persisted consecutive repair counter
    if ((await getRepairCount(cpUsername)) > 0) {
      await setRepairCount(cpUsername, 0, { protectionLastSkipReason: null })
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
      // `force: true` — bypass the deployCFIPFix idempotency cache. We've
      // already verified on WHM that the files are missing/corrupted, so the
      // cache MUST NOT skip the write or we'd be stuck in a repair loop
      // (3 fake repairs → STUCK alert → 6h pause while the site stays down).
      const result = await antiRed.deployCFIPFix(cpUsername, { force: true })
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
    const newCount = (await getRepairCount(cpUsername)) + 1
    const extra = newCount >= MAX_CONSECUTIVE_REPAIRS
      ? { protectionLastSkipReason: 'stuck_repair_loop', protectionStuckAt: new Date() }
      : {}
    await setRepairCount(cpUsername, newCount, extra)
    if (newCount >= MAX_CONSECUTIVE_REPAIRS) {
      log(`[ProtectionHeartbeat] ⚠️ ${cpUsername} repaired ${MAX_CONSECUTIVE_REPAIRS}x consecutively — files won't stick. Pausing repairs; will auto-retry in ~${Math.round(STUCK_RETRY_COOLDOWN_MS / 60000)}m.`)
      // PREVENTION: alert a human — a PAID Anti-Red site that keeps losing its
      // protection files is effectively down (serves the cloak 404/decoy to its owner).
      try {
        const acc = await db.collection('cpanelAccounts').findOne(
          { _id: cpUsername }, { projection: { domain: 1, plan: 1, chatId: 1 } })
        await alertAdmin(
          `⚠️ <b>Anti-Red protection STUCK</b>\n\n` +
          `🌐 <b>${(acc && acc.domain) || cpUsername}</b> (cPanel <code>${cpUsername}</code>)\n` +
          `📦 Plan: ${(acc && acc.plan) || 'unknown'}\n` +
          `👤 Owner chatId: <code>${(acc && acc.chatId) || '?'}</code>\n\n` +
          `The protection files (<code>.user.ini</code> / <code>.antired-challenge.php</code>) won't stick after ${MAX_CONSECUTIVE_REPAIRS} repairs — the site is likely serving the 404/decoy cloak to its own owner. Most common cause: a client upload overwrote/deleted them.\n\n` +
          `Auto-retry in ~${Math.round(STUCK_RETRY_COOLDOWN_MS / 60000)}m. If it keeps recurring, check whether the owner is re-uploading over the protection files.`
        )
      } catch (e) { /* best-effort */ }
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
    // (cPanel user is gone) and waste WHM API calls. Healthy accounts (counter
    // below MAX) are scanned every cycle; stuck accounts are scanned ONCE per
    // cooldown window so they can auto-recover instead of staying broken forever.
    const accounts = await db.collection('cpanelAccounts').find(
      buildAccountScanFilter()
    ).toArray()
    summary.total = accounts.length
    log(`[ProtectionHeartbeat] Checking ${accounts.length} cPanel accounts (deleted excluded; cooled-down stuck accounts retried)...`)

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
  // Exposed for admin/test
  getRepairCount,
  setRepairCount,
  MAX_CONSECUTIVE_REPAIRS,
  // PREVENTION helpers (pure, unit-testable without WHM)
  STUCK_RETRY_COOLDOWN_MS,
  isStuckCooledDown,
  buildAccountScanFilter,
  alertAdmin,
}
