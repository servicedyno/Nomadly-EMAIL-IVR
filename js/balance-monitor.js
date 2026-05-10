// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Provider Balance Monitor
// Periodically checks Telnyx & Twilio account balances
// and sends Telegram admin alerts when they fall below thresholds
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const axios = require('axios')

const log = (msg) => console.log(msg)

// ── Thresholds (USD) ──
const WARN_THRESHOLD  = parseFloat(process.env.BALANCE_WARN_THRESHOLD  || '10')
const CRIT_THRESHOLD  = parseFloat(process.env.BALANCE_CRIT_THRESHOLD  || '5')
const CHECK_INTERVAL  = parseInt(process.env.BALANCE_CHECK_INTERVAL_MIN || '120', 10) // minutes

// ── State ──
let _bot = null
let _adminChatId = null
let _lastAlerts = {}          // { providerName: { level, ts } }  — dedup same-level alerts within 6h

const DEDUP_WINDOW_MS = 6 * 60 * 60 * 1000   // don't repeat identical alert level for 6 hours

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Telnyx Balance Check
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function checkTelnyxBalance() {
  const apiKey = process.env.TELNYX_API_KEY
  if (!apiKey) return null

  const url = 'https://api.telnyx.com/v2/balance'
  const config = { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 15000 }

  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await axios.get(url, config)
      const data = res.data?.data
      const balance = parseFloat(data?.balance || data?.available_credit || '0')
      return { provider: 'Telnyx', balance, currency: data?.currency || 'USD', raw: data }
    } catch (e) {
      lastErr = e
      const status = e.response?.status
      const isTransient = !status || status >= 500 || ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(e.code)
      log(`[BalanceMonitor] Telnyx check attempt ${attempt}/3 failed: HTTP ${status || '-'} ${e.code || ''} ${e.message}${isTransient ? ' (transient)' : ''}`)
      if (!isTransient) break
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt))
    }
  }
  const status = lastErr?.response?.status
  const errorCategory = (!status || status >= 500) ? 'transient' : (status === 401 || status === 403) ? 'auth' : 'other'
  return {
    provider: 'Telnyx',
    error: `HTTP ${status || '-'}: ${lastErr?.message || 'unknown'}`,
    errorStatus: status,
    errorCategory,
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Twilio Balance Check
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function checkTwilioBalance() {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`
  const auth = { username: sid, password: token }

  // Retry transient 5xx / network errors up to 3 times with backoff. A 502 from
  // Twilio's edge is unrelated to credentials (which are checked at L7) but the
  // monitor previously interpreted any error as "auth/suspended" and spammed the
  // admin chat. Retry first, classify properly second.
  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await axios.get(url, { auth, timeout: 15000 })
      const balance = parseFloat(res.data?.balance || '0')
      return { provider: 'Twilio', balance, currency: res.data?.currency || 'USD', raw: res.data }
    } catch (e) {
      lastErr = e
      const status = e.response?.status
      const isTransient = !status || status >= 500 || ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(e.code)
      log(`[BalanceMonitor] Twilio check attempt ${attempt}/3 failed: HTTP ${status || '-'} ${e.code || ''} ${e.message}${isTransient ? ' (transient)' : ''}`)
      if (!isTransient) break  // 4xx — no point retrying
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt))
    }
  }
  const status = lastErr?.response?.status
  const errorCategory = (!status || status >= 500) ? 'transient' : (status === 401 || status === 403) ? 'auth' : 'other'
  return {
    provider: 'Twilio',
    error: `HTTP ${status || '-'}: ${lastErr?.message || 'unknown'}`,
    errorStatus: status,
    errorCategory,
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Alert Logic
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getAlertLevel(balance) {
  if (balance <= 0)              return 'emergency'
  if (balance <= CRIT_THRESHOLD) return 'critical'
  if (balance <= WARN_THRESHOLD) return 'warning'
  return 'ok'
}

function shouldAlert(provider, level) {
  if (level === 'ok') return false
  const prev = _lastAlerts[provider]
  if (prev && prev.level === level && (Date.now() - prev.ts) < DEDUP_WINDOW_MS) return false
  return true
}

function recordAlert(provider, level) {
  _lastAlerts[provider] = { level, ts: Date.now() }
}

async function sendAlert(result) {
  if (!_bot || !_adminChatId) return

  const level = getAlertLevel(result.balance)
  if (!shouldAlert(result.provider, level)) return

  const icon = level === 'emergency' ? '🚨' : level === 'critical' ? '⚠️' : '💡'
  const tag  = level.toUpperCase()

  const msg = [
    `${icon} <b>${tag}: ${result.provider} Balance Low</b>`,
    ``,
    `💰 Balance: <b>$${result.balance.toFixed(2)}</b> ${result.currency}`,
    `📊 Thresholds: warn=$${WARN_THRESHOLD} | critical=$${CRIT_THRESHOLD}`,
    ``,
    level === 'emergency'
      ? `🔴 Account may be disabled — outbound calls/SMS will FAIL`
      : level === 'critical'
        ? `🟠 Running critically low — top up ASAP to avoid service disruption`
        : `🟡 Balance getting low — consider topping up soon`,
    ``,
    `🔗 ${result.provider === 'Telnyx' ? 'https://portal.telnyx.com' : 'https://console.twilio.com'}`,
  ].join('\n')

  try {
    await _bot.sendMessage(_adminChatId, msg, { parse_mode: 'HTML' })
    recordAlert(result.provider, level)
    log(`[BalanceMonitor] ${tag} alert sent for ${result.provider} ($${result.balance.toFixed(2)})`)
  } catch (e) {
    log(`[BalanceMonitor] Failed to send alert: ${e.message}`)
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Check — runs all provider checks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// State tracking for transient-error suppression. We only alert on a transient
// 5xx / network error AFTER it's been observed on TWO consecutive checks —
// otherwise a one-off Twilio / Telnyx edge blip would page the admin every time.
let _consecutiveErrors = {}        // { provider: { count, lastStatus } }

async function checkAllBalances() {
  log('[BalanceMonitor] Running provider balance checks...')
  const results = []

  const telnyxResult = await checkTelnyxBalance()
  if (telnyxResult) results.push(telnyxResult)

  const twilioResult = await checkTwilioBalance()
  if (twilioResult) results.push(twilioResult)

  for (const r of results) {
    if (r.error) {
      log(`[BalanceMonitor] ${r.provider}: ERROR — ${r.error}`)

      // Track consecutive errors
      const prev = _consecutiveErrors[r.provider] || { count: 0 }
      _consecutiveErrors[r.provider] = {
        count: prev.count + 1,
        lastStatus: r.errorStatus,
        lastCategory: r.errorCategory,
        lastError: r.error,
      }
      const consecutive = _consecutiveErrors[r.provider].count

      // Decide whether to alert
      const isAuthError = r.errorCategory === 'auth'
      const isPersistentTransient = r.errorCategory === 'transient' && consecutive >= 2
      const shouldAlert_ = isAuthError || isPersistentTransient

      if (!shouldAlert_) {
        log(`[BalanceMonitor] ${r.provider}: suppressed alert (category=${r.errorCategory}, consecutive=${consecutive})`)
        continue
      }
      if (!_bot || !_adminChatId) continue
      if (!shouldAlert(r.provider + '_error_' + r.errorCategory, 'critical')) continue

      const title = isAuthError
        ? `🔒 <b>${r.provider} CREDENTIALS REJECTED (HTTP ${r.errorStatus})</b>`
        : `🌐 <b>${r.provider} API unreachable (${consecutive} consecutive failures)</b>`
      const body = isAuthError
        ? `Auth token rejected by ${r.provider}. Check that the SID/Token in env are still valid and that the account is not suspended.\n\nError: <code>${r.error}</code>`
        : `Last error: <code>${r.error}</code>\n\nLikely a transient ${r.provider} edge / network issue. If this clears on the next check, no action needed. If it persists for 30+ minutes, investigate Twilio/Telnyx status pages.`

      try {
        await _bot.sendMessage(_adminChatId, `${title}\n\n${body}`, { parse_mode: 'HTML' })
        recordAlert(r.provider + '_error_' + r.errorCategory, 'critical')
      } catch (e) { /* ignore */ }
      continue
    }

    // Successful balance read — clear consecutive error counter
    if (_consecutiveErrors[r.provider]) {
      log(`[BalanceMonitor] ${r.provider}: recovered after ${_consecutiveErrors[r.provider].count} consecutive errors`)
      delete _consecutiveErrors[r.provider]
    }

    log(`[BalanceMonitor] ${r.provider}: $${r.balance.toFixed(2)} ${r.currency} [${getAlertLevel(r.balance)}]`)
    await sendAlert(r)
  }

  return results
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Init — call once during startup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function initBalanceMonitor(bot) {
  _bot = bot
  _adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID

  if (!_adminChatId) {
    log('[BalanceMonitor] No TELEGRAM_ADMIN_CHAT_ID set — alerts disabled')
    return
  }

  // Run first check 30s after startup (let other services init first)
  setTimeout(() => {
    checkAllBalances().catch(e => log(`[BalanceMonitor] Startup check error: ${e.message}`))
  }, 30 * 1000)

  // Schedule recurring checks
  const intervalMs = CHECK_INTERVAL * 60 * 1000
  setInterval(() => {
    checkAllBalances().catch(e => log(`[BalanceMonitor] Scheduled check error: ${e.message}`))
  }, intervalMs)

  log(`[BalanceMonitor] Initialized — checking every ${CHECK_INTERVAL}min (warn=$${WARN_THRESHOLD}, crit=$${CRIT_THRESHOLD})`)
}

module.exports = {
  initBalanceMonitor,
  checkAllBalances,
  checkTelnyxBalance,
  checkTwilioBalance,
}
