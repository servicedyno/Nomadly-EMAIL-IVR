/* global process */
/**
 * ConnectReseller Auto IP Whitelist
 * 
 * ConnectReseller requires the server's outbound IP to be whitelisted in their panel.
 * Since there's no API for this, this module:
 * 1. Detects the current outbound IP on startup
 * 2. Tests the ConnectReseller API
 * 3. If blocked, runs Playwright browser automation to whitelist the IP
 * 4. Falls back to Telegram notification if automation fails
 * 5. Confirms via Telegram once working
 */

const axios = require('axios')
const { execFile } = require('child_process')
const { log } = require('console')

const API_KEY = process.env.API_KEY_CONNECT_RESELLER
const WHITELIST_URL = 'https://global.connectreseller.com/tools/profile'
const WHITELIST_SCRIPT = require('path').join(__dirname, 'cr-whitelist-browser.js')

let currentIP = null
let isWhitelisted = false
let retryTimer = null
let retryCount = 0
let notificationSent = false
let automationAttempted = false
let testFailCount = 0

/**
 * Detect the server's outbound IP address
 */
async function detectIP() {
  try {
    const res = await axios.get('https://api.ipify.org/', { timeout: 5000 })
    currentIP = res.data?.trim()
    return currentIP
  } catch (e) {
    try {
      const res2 = await axios.get('https://ifconfig.me/ip', { timeout: 5000 })
      currentIP = res2.data?.trim()
      return currentIP
    } catch (_) {}
    log('[CR-Whitelist] Failed to detect IP:', e.message)
    return null
  }
}

/**
 * Test if the ConnectReseller API is accessible (IP is whitelisted)
 */
async function testConnection() {
  if (!API_KEY) {
    log('[CR-Whitelist] No API_KEY_CONNECT_RESELLER configured, skipping')
    return true
  }
  try {
    const url = `https://api.connectreseller.com/ConnectReseller/ESHOP/SearchDomainList?APIKey=${API_KEY}&page=1&maxIndex=1`
    const res = await axios.get(url, { timeout: 15000 })
    return res.data && (Array.isArray(res.data.records) || res.status === 200)
  } catch (e) {
    // Only log the first 3 failures and then every 10th to reduce noise
    testFailCount++
    if (testFailCount <= 3 || testFailCount % 10 === 0) {
      log(`[CR-Whitelist] API test failed (attempt #${testFailCount}): ${e.message}`)
    }
    return false
  }
}

/**
 * Run Playwright browser automation to whitelist the IP
 * Returns { success, ip, message }
 */
function runBrowserWhitelist(ip) {
  return new Promise((resolve) => {
    const hasCreds = process.env.CR_PANEL_EMAIL && process.env.CR_PANEL_PASSWORD
    if (!hasCreds) {
      resolve({ success: false, ip, message: 'CR_PANEL_EMAIL/CR_PANEL_PASSWORD not set' })
      return
    }

    log(`[CR-Whitelist] Running browser automation to whitelist ${ip}...`)

    const env = {
      ...process.env,
      CR_PANEL_EMAIL: process.env.CR_PANEL_EMAIL,
      CR_PANEL_PASSWORD: process.env.CR_PANEL_PASSWORD,
    }

    execFile('node', [WHITELIST_SCRIPT, ip], { env, timeout: 90000 }, (error, stdout, stderr) => {
      if (stderr) log('[CR-Whitelist] Browser stderr:', stderr.substring(0, 200))

      try {
        const result = JSON.parse(stdout.trim())
        log(`[CR-Whitelist] Browser result: ${result.message}`)
        resolve(result)
      } catch (_) {
        if (error) {
          log(`[CR-Whitelist] Browser automation failed: ${error.message}`)
          resolve({ success: false, ip, message: error.message })
        } else {
          log(`[CR-Whitelist] Browser output: ${stdout.substring(0, 200)}`)
          resolve({ success: false, ip, message: 'Unexpected output' })
        }
      }
    })
  })
}

/**
 * Main auto-whitelist function
 * Call on startup — handles detection, testing, browser automation, and notification
 */
async function autoWhitelist(opts = {}) {
  const { bot, adminChatId, devChatId } = opts

  // 1. Detect IP
  const ip = await detectIP()
  if (!ip) {
    log('[CR-Whitelist] Could not detect outbound IP')
    return { success: false, error: 'IP detection failed' }
  }
  log(`[CR-Whitelist] Outbound IP: ${ip}`)

  // 2. Test ConnectReseller API
  const working = await testConnection()

  if (working) {
    isWhitelisted = true
    testFailCount = 0
    log(`[CR-Whitelist] API working — IP ${ip} is whitelisted`)

    if (retryCount > 0 && bot) {
      const msg = `<b>Connect Reseller API is now working!</b>\nIP <code>${ip}</code> has been whitelisted successfully.`
      bot.sendMessage(adminChatId, msg, { parse_mode: 'HTML' }).catch(() => {})
    }

    stopRetry()
    return { success: true, ip, whitelisted: true }
  }

  // 3. API not working — try browser automation (once)
  isWhitelisted = false
  log(`[CR-Whitelist] API blocked — IP ${ip} needs whitelisting`)

  if (!automationAttempted) {
    automationAttempted = true
    const autoResult = await runBrowserWhitelist(ip)

    if (autoResult.success) {
      log(`[CR-Whitelist] Browser automation succeeded: ${autoResult.message}`)

      // Wait a moment for ConnectReseller to propagate the change
      await new Promise(r => setTimeout(r, 5000))

      // Re-test the API
      const nowWorking = await testConnection()
      if (nowWorking) {
        isWhitelisted = true
        log(`[CR-Whitelist] API confirmed working after browser whitelist`)

        if (bot) {
          const msg = `<b>Connect Reseller — Auto-Whitelisted!</b>\n\nIP <code>${ip}</code> was automatically whitelisted via browser automation.`
          bot.sendMessage(adminChatId, msg, { parse_mode: 'HTML' }).catch(() => {})
        }

        stopRetry()
        return { success: true, ip, whitelisted: true, method: 'browser' }
      }

      log(`[CR-Whitelist] API still not working after browser whitelist — may need propagation time`)
    } else {
      log(`[CR-Whitelist] Browser automation failed: ${autoResult.message}`)
    }
  }

  // 4. Send notification (only once per IP to avoid spam)
  if (!notificationSent && bot) {
    notificationSent = true
    const autoMsg = automationAttempted ? '\n\n<i>Browser auto-whitelist was attempted. Retrying API check...</i>' : ''
    const msg =
      `<b>Connect Reseller — IP Whitelist Required</b>\n\n` +
      `Server IP: <code>${ip}</code>\n\n` +
      `<a href="${WHITELIST_URL}">Click here to whitelist</a>\n` +
      `(API tab → Add IP)${autoMsg}\n\n` +
      `<i>Auto-retrying until whitelisted...</i>`

    bot.sendMessage(adminChatId, msg, { parse_mode: 'HTML', disable_web_page_preview: true }).catch(() => {})
    if (devChatId && String(devChatId) !== String(adminChatId)) {
      bot.sendMessage(devChatId, msg, { parse_mode: 'HTML', disable_web_page_preview: true }).catch(() => {})
    }
  }

  // 5. Schedule retry with escalating intervals
  scheduleRetry(opts)
  return { success: false, ip, whitelisted: false, retrying: true }
}

/**
 * Schedule a retry with escalating intervals:
 * - First 3 retries: every 60 seconds (3 minutes)
 * - Next 5 retries: every 10 minutes (50 minutes)
 * - After that: every 60 minutes
 */
function scheduleRetry(opts) {
  if (retryTimer) return

  retryCount++
  let interval
  if (retryCount <= 3) {
    interval = 60 * 1000
  } else if (retryCount <= 8) {
    interval = 10 * 60 * 1000
  } else {
    interval = 60 * 60 * 1000
  }

  log(`[CR-Whitelist] Retry #${retryCount} scheduled in ${interval / 1000}s`)

  retryTimer = setTimeout(async () => {
    retryTimer = null
    await autoWhitelist(opts)
  }, interval)
}

/**
 * Stop the retry timer
 */
function stopRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  retryCount = 0
  notificationSent = false
}

/**
 * Get current whitelist status (for health checks / REST endpoints)
 */
function getStatus() {
  return {
    ip: currentIP,
    whitelisted: isWhitelisted,
    retrying: !!retryTimer,
    retryCount,
    automationAttempted,
  }
}

module.exports = {
  autoWhitelist,
  testConnection,
  detectIP,
  getStatus,
  stopRetry,
}
