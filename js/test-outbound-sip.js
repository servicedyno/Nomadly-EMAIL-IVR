/**
 * Test Outbound SIP — one-tap "📤 Test Outbound SIP" feature.
 *
 * Unlike Test My Number (which tests INBOUND SIP by calling the user's number
 * from our Telnyx trial line), this feature tests OUTBOUND SIP — i.e., it
 * verifies that a call placed FROM the user's softphone reaches our servers
 * with the right SIP credentials, provider routing, and wallet checks.
 *
 * Because only the user's softphone can originate a true outbound SIP call,
 * the flow is interactive:
 *
 *   1. User taps the button → we open a 90-second listening window keyed to
 *      the user's chatId + sipUsername.
 *   2. We ask the user to dial ANY number from their softphone within 90 s
 *      (their own mobile is ideal — zero risk of accidental charges).
 *   3. When that call arrives at `voice-service.handleOutboundSipCall`, a hook
 *      (exported below as `matchPendingTest`) is checked AFTER user
 *      identification but BEFORE wallet/connection-fee/PSTN transfer.
 *   4. On match: the call is immediately hung up (NO wallet deduction, NO
 *      PSTN call, NO provider minutes used), and the user receives a
 *      detailed success report via Telegram (SIP credential, provider,
 *      routing time).
 *   5. On timeout: a helpful diagnostic message is sent with /sipguide CTA.
 *
 * Throttle: 5 tests per number per 24 h (in-memory).
 *
 * Wiring: initTestOutboundSip({ bot, log, getTxt })
 *         — registers no HTTP route (hook-based integration with voice-service).
 */

const SESSION_TTL_MS = 5 * 60 * 1000     // 5 min — safety sweep
const TEST_TIMEOUT_MS = 90 * 1000        // 90 s — listening window
const MAX_TESTS_PER_DAY = 5

// In-memory: chatId → { num, lang, sipUsername, startedAt, timeoutHandle, reported }
const pendingTests = {}
// Throttle map: phoneNumber → [timestamps within last 24h]
const testHistory = {}

let _bot = null
let _log = console.log
let _getTxt = null
let _telnyxApi = null

function initTestOutboundSip(deps) {
  _bot = deps.bot
  _log = deps.log || console.log
  _getTxt = deps.getTxt
  _telnyxApi = deps.telnyxApi || null

  // Periodic cleanup of stale sessions + throttle history
  setInterval(() => {
    const now = Date.now()
    for (const [chatId, s] of Object.entries(pendingTests)) {
      if (now - s.startedAt > SESSION_TTL_MS && !s.reported) {
        if (s.timeoutHandle) clearTimeout(s.timeoutHandle)
        delete pendingTests[chatId]
      }
    }
    const cutoff = now - 24 * 60 * 60 * 1000
    for (const [num, ts] of Object.entries(testHistory)) {
      testHistory[num] = ts.filter(t => t >= cutoff)
      if (testHistory[num].length === 0) delete testHistory[num]
    }
  }, 60 * 1000)

  _log('[TestOutboundSip] initialized — hook-based (no HTTP route)')
}

/**
 * Open a 90-second listening window for an outbound SIP test.
 * Returns { ok, message } — message is what the bot should send to the user.
 */
function startTest(chatId, num, lang) {
  const chatIdStr = String(chatId)
  const targetNumber = num.phoneNumber
  const t = _getTxt ? _getTxt(lang) : null
  const M = (key, ...args) => {
    const v = t?.testOutboundSip?.[key]
    if (!v) return null
    return typeof v === 'function' ? v(...args) : v
  }

  // Sanity
  if (!_bot) {
    return { ok: false, message: '❌ Test feature not initialized. Please try again in a moment.' }
  }
  if (num.status !== 'active') {
    return {
      ok: false,
      message: M('inactive', targetNumber) || `❌ Number <code>${targetNumber}</code> is not active — outbound SIP testing is only available for active numbers.`,
    }
  }
  if (!num.sipUsername) {
    return {
      ok: false,
      message: M('noSipConfigured', targetNumber) || `❌ No SIP credentials on <code>${targetNumber}</code>. Set up SIP first via <b>🔑 SIP Credentials</b>, then retry.`,
    }
  }

  // Throttle
  const recent = (testHistory[targetNumber] || []).filter(ts => Date.now() - ts < 24 * 60 * 60 * 1000)
  if (recent.length >= MAX_TESTS_PER_DAY) {
    return {
      ok: false,
      message: M('throttled', MAX_TESTS_PER_DAY) || `⏳ You've already run ${MAX_TESTS_PER_DAY} outbound SIP tests on this number in the last 24 hours. Try again later.`,
    }
  }

  // Already has an active test?  Cancel the old one and start fresh.
  const existing = pendingTests[chatIdStr]
  if (existing && !existing.reported) {
    if (existing.timeoutHandle) clearTimeout(existing.timeoutHandle)
    _log(`[TestOutboundSip] Replacing stale test for chatId=${chatIdStr}`)
  }

  const session = {
    chatId: chatIdStr,
    num,
    lang,
    sipUsername: num.sipUsername,
    telnyxSipUsername: num.telnyxSipUsername || null,
    startedAt: Date.now(),
    reported: false,
    timeoutHandle: null,
  }

  // Hard timeout — if no call arrives, finalize with a "no call detected" report
  session.timeoutHandle = setTimeout(() => {
    finalizeTimeout(chatIdStr).catch(e => _log(`[TestOutboundSip] timeout finalize err: ${e.message}`))
  }, TEST_TIMEOUT_MS)

  pendingTests[chatIdStr] = session
  testHistory[targetNumber] = [...recent, Date.now()]

  _log(`[TestOutboundSip] Test started chatId=${chatIdStr} num=${targetNumber} sipUser=${num.sipUsername} — 90s window`)

  return {
    ok: true,
    message: M('listening', targetNumber, num.sipUsername) || `📤 <b>Outbound SIP Test — listening for 90s</b>\n\nFrom your softphone (<code>${num.sipUsername}</code>), dial <b>any number</b> within the next 90 seconds. Your own mobile is ideal — the call will be intercepted safely, so <b>no wallet charges and no PSTN leg will be placed</b>.\n\nResult will appear here as soon as your call reaches our servers.`,
  }
}

/**
 * Hook called from voice-service.handleOutboundSipCall AFTER user identification,
 * BEFORE connection-fee / PSTN transfer.
 *
 * @param {string} chatId   — identified owner of the SIP credential
 * @param {object} num      — phone-number record
 * @param {string} sipUsername — actual SIP user (gencred… or legacy) that rang in
 * @param {object} context  — { provider, destination, callControlId, autoRouted }
 * @returns {Promise<boolean>} true if the call was intercepted (caller must return early).
 */
async function matchPendingTest(chatId, num, sipUsername, context = {}) {
  const chatIdStr = String(chatId)
  const session = pendingTests[chatIdStr]
  if (!session || session.reported) return false

  // Match the SIP credential loosely — some providers deliver different username
  // variants (gencredXYZ vs sip:gencredXYZ@domain). Accept any of:
  //   session.sipUsername, session.telnyxSipUsername, num.phoneNumber
  const u = String(sipUsername || '').toLowerCase()
  const candidates = [
    session.sipUsername,
    session.telnyxSipUsername,
    num?.sipUsername,
    num?.telnyxSipUsername,
  ].filter(Boolean).map(x => String(x).toLowerCase())
  const credMatch = candidates.some(c => c === u)
  const numMatch = num && session.num && num.phoneNumber === session.num.phoneNumber
  if (!credMatch && !numMatch) return false

  // Match — short-circuit the real call
  session.reported = true
  if (session.timeoutHandle) clearTimeout(session.timeoutHandle)

  const elapsedMs = Date.now() - session.startedAt
  const destination = context.destination || 'unknown'
  const provider = context.provider || num?.provider || 'unknown'
  const callControlId = context.callControlId

  _log(`[TestOutboundSip] ✅ Matched test for chatId=${chatIdStr} sipUser=${sipUsername} dest=${destination} provider=${provider} elapsed=${elapsedMs}ms`)

  // Hang up the call quietly (prefer Telnyx API; if not available, caller's own hangup)
  if (_telnyxApi && callControlId) {
    try {
      await _telnyxApi.hangupCall(callControlId)
    } catch (e) {
      _log(`[TestOutboundSip] hangup during match failed (call may already be ending): ${e.message}`)
    }
  }

  // Build & send success report
  const t = _getTxt ? _getTxt(session.lang) : null
  const M = (key, ...args) => {
    const v = t?.testOutboundSip?.[key]
    if (!v) return null
    return typeof v === 'function' ? v(...args) : v
  }
  const elapsedSec = (elapsedMs / 1000).toFixed(1)
  const msg = M('success', session.num.phoneNumber, sipUsername, provider, destination, elapsedSec)
    || `✅ <b>Outbound SIP verified</b>\n\nYour softphone successfully placed a call.\n\n📞 Number: <code>${session.num.phoneNumber}</code>\n🔑 SIP user: <code>${sipUsername}</code>\n🌐 Provider: <code>${provider}</code>\n📍 Dialed: <code>${destination}</code>\n⏱️ Latency: ${elapsedSec}s\n\n💡 The call was intercepted safely — no wallet charges, no PSTN leg.`

  try {
    await _bot?.sendMessage(session.chatId, msg, { parse_mode: 'HTML', disable_web_page_preview: true })
  } catch (e) {
    _log(`[TestOutboundSip] Failed to send success report to chatId=${session.chatId}: ${e.message}`)
  }

  // Clean up after a short delay (lets straggling webhook events log correctly)
  setTimeout(() => {
    if (pendingTests[chatIdStr]?.reported) delete pendingTests[chatIdStr]
  }, 5000)

  return true
}

async function finalizeTimeout(chatIdStr) {
  const session = pendingTests[chatIdStr]
  if (!session || session.reported) return
  session.reported = true

  const t = _getTxt ? _getTxt(session.lang) : null
  const M = (key, ...args) => {
    const v = t?.testOutboundSip?.[key]
    if (!v) return null
    return typeof v === 'function' ? v(...args) : v
  }
  const msg = M('timeout', session.num.phoneNumber)
    || `❌ <b>No outbound SIP call detected</b> on <code>${session.num.phoneNumber}</code> in 90 seconds.\n\nPossible causes:\n• Softphone not registered (check the Status light in Linphone/Zoiper)\n• Wrong SIP credentials — verify username + password via 🔑 SIP Credentials\n• Firewall blocking UDP 5060\n• PBX (3CX/FreePBX) misconfigured — see /sipguide\n\nRun the test again once you're registered.`

  try {
    await _bot?.sendMessage(session.chatId, msg, { parse_mode: 'HTML', disable_web_page_preview: true })
  } catch (e) {
    _log(`[TestOutboundSip] Failed to send timeout report to chatId=${session.chatId}: ${e.message}`)
  }

  setTimeout(() => { delete pendingTests[chatIdStr] }, 5000)
  _log(`[TestOutboundSip] Test timed out chatId=${chatIdStr}`)
}

module.exports = {
  initTestOutboundSip,
  startTest,
  matchPendingTest,
  MAX_TESTS_PER_DAY,
  // Exported for tests
  _sessions: pendingTests,
  _history: testHistory,
}
