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
    return res.data?.result?.data?.content || ''
  } catch {
    return ''
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

async function checkAndRepair(cpUsername) {
  const [userIni, challenge] = await Promise.all([
    getFile(cpUsername, '/public_html', '.user.ini'),
    getFile(cpUsername, '/public_html', '.antired-challenge.php'),
  ])

  const iniOk = isUserIniIntact(userIni, cpUsername)
  const phpOk = isChallengePhpIntact(challenge)

  if (iniOk && phpOk) {
    return { cpUsername, ok: true, action: 'none' }
  }

  // Repair — redeploy both files via anti-red-service
  try {
    const antiRed = require('./anti-red-service')
    const result = await antiRed.deployCFIPFix(cpUsername)
    const reason = [
      !iniOk ? '.user.ini' : null,
      !phpOk ? '.antired-challenge.php' : null,
    ].filter(Boolean).join('+')
    log(`[ProtectionHeartbeat] REPAIRED ${cpUsername} (${reason}): ${result.success ? 'OK' : 'FAIL'}`)
    return { cpUsername, ok: result.success, action: 'repaired', reason }
  } catch (err) {
    log(`[ProtectionHeartbeat] Repair error for ${cpUsername}: ${err.message}`)
    return { cpUsername, ok: false, action: 'error', error: err.message }
  }
}

async function runHeartbeat() {
  if (!db) { log('[ProtectionHeartbeat] Not initialized'); return }
  if (!whmApi) { log('[ProtectionHeartbeat] WHM not configured — skipping'); return }
  if (isRunning) { log('[ProtectionHeartbeat] Already running — skipping'); return }

  isRunning = true
  const startTime = Date.now()
  const summary = { total: 0, ok: 0, repaired: 0, errors: 0 }

  try {
    const accounts = await db.collection('cpanelAccounts').find({}).toArray()
    summary.total = accounts.length
    log(`[ProtectionHeartbeat] Checking ${accounts.length} cPanel accounts...`)

    for (const account of accounts) {
      const cpUsername = account._id || account.cpUser
      if (!cpUsername || typeof cpUsername !== 'string') continue

      const result = await checkAndRepair(cpUsername)
      if (result.action === 'none') summary.ok++
      else if (result.action === 'repaired' && result.ok) summary.repaired++
      else summary.errors++

      await new Promise(r => setTimeout(r, PER_ACCOUNT_DELAY_MS))
    }
  } catch (err) {
    log(`[ProtectionHeartbeat] Fatal error: ${err.message}`)
    summary.fatalError = err.message
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  log(`[ProtectionHeartbeat] Done in ${elapsed}s — total:${summary.total} ok:${summary.ok} repaired:${summary.repaired} errors:${summary.errors}`)
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
