// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Voice Service — Call Handling with IVR, Recording, Limits & Feature-Gating
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const { log } = require('console')
const { get, set, atomicIncrement } = require('./db.js')
const { formatPhone, formatDuration, canAccessFeature, plans, OVERAGE_RATE_MIN, OVERAGE_RATE_SMS, CALL_FORWARDING_RATE_MIN } = require('./phone-config.js')
const { getBalance, smartWalletDeduct, smartWalletCheck } = require('./utils.js')

let _bot = null
let _phoneNumbersOf = null
let _phoneLogs = null
let _telnyxApi = null
let _telnyxResources = null
let _translation = null
let _ivrAnalytics = null
let _walletOf = null
let _payments = null
let _nanoid = null
let _twilioSipDomain = null
let _selfUrl = null
let _state = null
let _twilioService = null

// In-memory store for active call sessions (callControlId → session data)
const activeCalls = {}

// Pending bridge store: bridgeId → { twilioNumber, destination, chatId, num, callControlId }
// Used to bridge outbound SIP calls from Twilio numbers through Twilio PSTN
const pendingBridges = {}

// Outbound IVR sessions: callControlId → outbound IVR session data
const outboundIvrCalls = {}
const twilioIvrSessions = {} // sessionId → { chatId, callerId, targetNumber, ... } for Twilio IVR calls

// SIP outbound rate limiter: key (sipUser:destination) → { count, firstCallTime }
const sipRateLimit = {}
const SIP_RATE_LIMIT_MAX = 3       // Max calls per window
const SIP_RATE_LIMIT_WINDOW = 60000 // 60 seconds window

function checkSipRateLimit(sipUsername, destination) {
  const key = `${sipUsername}:${destination}`
  const now = Date.now()
  const entry = sipRateLimit[key]
  if (!entry || (now - entry.firstCallTime) > SIP_RATE_LIMIT_WINDOW) {
    sipRateLimit[key] = { count: 1, firstCallTime: now }
    return true // allowed
  }
  entry.count++
  if (entry.count > SIP_RATE_LIMIT_MAX) {
    return false // blocked
  }
  return true // allowed
}

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const key of Object.keys(sipRateLimit)) {
    if ((now - sipRateLimit[key].firstCallTime) > SIP_RATE_LIMIT_WINDOW * 2) {
      delete sipRateLimit[key]
    }
  }
}, 300000)

/**
 * Twilio direct call fallback — used when Telnyx SIP transfer fails
 * (e.g., auto-routing race condition killed the call before transfer).
 * Creates a fresh outbound call via Twilio REST API.
 */
async function _attemptTwilioDirectCall(chatId, num, destination, bridgeId, callControlId) {
  try {
    // Sub-account creds may be on the number or the user's phoneNumbersOf doc
    let subSid = num.subAccountSid || num.twilioSubAccountSid || null
    let subToken = num.subAccountAuthToken || num.twilioSubAccountToken || null
    if (!subSid || !subToken) {
      try {
        const userData = await _phoneNumbersOf.findOne({ _id: chatId })
        subSid = subSid || userData?.val?.twilioSubAccountSid || null
        subToken = subToken || userData?.val?.twilioSubAccountToken || null
      } catch (e) { /* ignore */ }
    }

    // ── TOKEN RECOVERY: If we have a subSid but no subToken, fetch it from Twilio API ──
    // This handles cases where the sub-account was created and number transferred,
    // but the auth token was never persisted to the DB.
    if (subSid && !subToken && _twilioService) {
      try {
        log(`[Voice] Twilio direct fallback: subSid found (${subSid}) but no token — recovering from Twilio API`)
        const subAcct = await _twilioService.getSubAccount(subSid)
        if (subAcct && subAcct.authToken && !subAcct.error) {
          subToken = subAcct.authToken
          log(`[Voice] Twilio direct fallback: Token recovered for subSid=${subSid}`)
          // Persist recovered credentials back to the user document so this is a one-time recovery
          try {
            const userData = await _phoneNumbersOf.findOne({ _id: chatId })
            if (userData?.val) {
              userData.val.twilioSubAccountSid = subSid
              userData.val.twilioSubAccountToken = subToken
              await _phoneNumbersOf.updateOne({ _id: chatId }, { $set: { 'val.twilioSubAccountSid': subSid, 'val.twilioSubAccountToken': subToken } })
              log(`[Voice] Twilio direct fallback: Persisted recovered credentials for chatId=${chatId}`)
            }
          } catch (persistErr) { log(`[Voice] Twilio direct fallback: Failed to persist recovered creds: ${persistErr.message}`) }
        } else {
          log(`[Voice] Twilio direct fallback: Could not recover token for subSid=${subSid}: ${subAcct?.error || 'no authToken'}`)
        }
      } catch (recoveryErr) {
        log(`[Voice] Twilio direct fallback: Token recovery failed: ${recoveryErr.message}`)
      }
    }

    if (!subSid || !subToken) {
      log(`[Voice] Twilio direct fallback: No sub-account credentials for chatId=${chatId} (subSid=${!!subSid}, subToken=${!!subToken})`)
      _bot?.sendMessage(chatId, `🚫 <b>Outbound Call Failed</b>\n📞 ${formatPhone(num.phoneNumber)} → ${formatPhone(destination)}\nReason: Call routing failed. Please try again.`, { parse_mode: 'HTML' }).catch(() => {})
      delete pendingBridges[bridgeId]
      if (activeCalls[callControlId]) delete activeCalls[callControlId]
      return
    }
    const subClient = require('twilio')(subSid, subToken)
    const call = await subClient.calls.create({
      url: `${_selfUrl}/twilio/sip-voice?bridgeId=${bridgeId}`,
      to: destination,
      from: num.phoneNumber,
      statusCallback: `${_selfUrl}/twilio/voice-dial-status?chatId=${chatId}&from=${encodeURIComponent(destination)}&to=${encodeURIComponent(num.phoneNumber)}&type=sip_outbound`,
      statusCallbackEvent: ['completed'],
    })
    log(`[Voice] Twilio direct fallback call created: ${call.sid} (${num.phoneNumber} → ${destination})`)
    if (activeCalls[callControlId]) {
      activeCalls[callControlId].phase = 'outbound_twilio_direct'
      activeCalls[callControlId].twilioCallSid = call.sid
    }
  } catch (twilioErr) {
    log(`[Voice] Twilio direct fallback failed: ${twilioErr.message}`)
    _bot?.sendMessage(chatId, `🚫 <b>Outbound Call Failed</b>\n📞 ${formatPhone(num.phoneNumber)} → ${formatPhone(destination)}\nReason: Call routing failed. Please try again.`, { parse_mode: 'HTML' }).catch(() => {})
    delete pendingBridges[bridgeId]
    if (activeCalls[callControlId]) delete activeCalls[callControlId]
  }
}

function initVoiceService(deps) {
  _bot = deps.bot
  _phoneNumbersOf = deps.phoneNumbersOf
  _phoneLogs = deps.phoneLogs
  _telnyxApi = deps.telnyxApi
  _telnyxResources = deps.telnyxResources
  _translation = deps.translation
  _ivrAnalytics = deps.ivrAnalytics
  _walletOf = deps.walletOf
  _payments = deps.payments
  _nanoid = deps.nanoid
  _twilioSipDomain = deps.twilioSipDomainName || null
  _selfUrl = deps.selfUrl || null
  _twilioService = deps.twilioService || null
  _state = deps.state || null
  log('[VoiceService] Initialized with IVR + Recording + Analytics + Limits + Overage billing + SIP Bridge + Twilio IVR')
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USAGE LIMIT HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if a phone number is US or Canada (+1 prefix)
 */
function isUSCanada(phoneNumber) {
  const clean = (phoneNumber || '').replace(/[^+\d]/g, '')
  return clean.startsWith('+1')
}

/**
 * Get per-minute overage rate based on destination country
 * US/Canada (+1): OVERAGE_RATE_MIN ($0.04)
 * International: CALL_FORWARDING_RATE_MIN ($0.50)
 */
function getCallRate(destinationNumber) {
  return isUSCanada(destinationNumber) ? OVERAGE_RATE_MIN : CALL_FORWARDING_RATE_MIN
}

// ── IVR outbound flat rate (same as bulk IVR) — plan minutes are for inbound only ──
const IVR_CALL_RATE = parseFloat(process.env.BULK_CALL_RATE_PER_MIN || '0.15')
const IVR_CALL_TYPES = ['IVR_Outbound', 'IVR_Transfer', 'IVR_Outbound_Twilio']

function getMinuteLimit(planKey) {
  const plan = plans[planKey]
  if (!plan) return 0
  if (plan.minutes === 'Unlimited') return Infinity
  return plan.minutes || 0
}

function getSmsLimit(planKey) {
  const plan = plans[planKey]
  if (!plan) return 0
  return plan.sms || 0
}

function isMinuteLimitReached(num) {
  const limit = getMinuteLimit(num.plan)
  if (limit === Infinity) return false
  const used = num.minutesUsed || 0
  return used >= limit
}

function isSmsLimitReached(num) {
  const limit = getSmsLimit(num.plan)
  const used = num.smsUsed || 0
  return used >= limit
}

// Atomically increment minutesUsed for a phone number in DB
async function incrementMinutesUsed(chatId, phoneNumber, minutes) {
  try {
    const userData = await get(_phoneNumbersOf, chatId)
    const numbers = userData?.numbers || []
    const idx = numbers.findIndex(n => n.phoneNumber === phoneNumber)
    if (idx === -1) return { used: 0, limit: 0, overageMinutes: 0 }
    numbers[idx].minutesUsed = (numbers[idx].minutesUsed || 0) + minutes
    const limit = getMinuteLimit(numbers[idx].plan)
    const used = numbers[idx].minutesUsed
    if (limit !== Infinity && used >= limit && !numbers[idx]._minLimitNotified) {
      numbers[idx]._minLimitNotified = true
      _bot?.sendMessage(chatId, `⚠️ <b>Plan Minutes Exhausted</b>\n\n📞 ${formatPhone(phoneNumber)}\nUsed: <b>${used}/${limit}</b> minutes this cycle.\n\nOverage billing is now active from your wallet. Top up or upgrade your plan.`, { parse_mode: 'HTML' }).catch(() => {})
    }
    await set(_phoneNumbersOf, chatId, { numbers })
    const overageMinutes = limit !== Infinity ? Math.max(0, used - limit) : 0
    return { used, limit, overageMinutes }
  } catch (e) {
    log(`[Voice] incrementMinutesUsed error: ${e.message}`)
    return { used: 0, limit: 0, overageMinutes: 0 }
  }
}

/**
 * Unified billing: Plan minutes first → wallet overage at destination-based rate
 * Works for ALL call types: inbound, forwarded, SIP outbound, IVR outbound, IVR transfer
 *
 * @param {string} chatId - User's chat ID
 * @param {string} phoneNumber - User's phone number (plan minutes are tracked here)
 * @param {number} minutesBilled - Minutes to bill
 * @param {string} destinationNumber - The remote party number (determines overage rate)
 * @param {string} callType - Label for payment logs (e.g. 'Inbound', 'Forwarding', 'SIPOutbound', 'IVR_Outbound', 'IVR_Transfer')
 * @returns {{ planMinUsed: number, overageMin: number, overageCharge: number, rate: number }}
 */
// ━━━ Outbound call types: charge wallet directly, do NOT use plan minutes ━━━
const OUTBOUND_CALL_TYPES = [
  'SIPOutbound', 'Forwarding', 'Bridge_Transfer',
  'IVR_Outbound', 'IVR_Transfer',
  'IVR_Outbound_Twilio', 'Twilio_SIP_Bridge', 'Twilio_SIP_Outbound', 'Twilio_Forwarding',
]

async function billCallMinutesUnified(chatId, phoneNumber, minutesBilled, destinationNumber, callType) {
  if (minutesBilled <= 0) return { planMinUsed: 0, overageMin: 0, overageCharge: 0, rate: 0, used: 0, limit: 0 }

  // IVR outbound calls use flat IVR rate; other calls use destination-based rate
  const rate = IVR_CALL_TYPES.includes(callType) ? IVR_CALL_RATE : getCallRate(destinationNumber)
  const isOutbound = OUTBOUND_CALL_TYPES.includes(callType)

  // ━━━ OUTBOUND: Charge wallet directly — plan minutes are for inbound only ━━━
  if (isOutbound) {
    const totalCharge = +(minutesBilled * rate).toFixed(4)
    try {
      if (_walletOf) {
        const deductResult = await smartWalletDeduct(_walletOf, chatId, totalCharge)
        if (deductResult.success) {
          const ref = _nanoid?.() || `out_${callType}_${Date.now()}`
          const chargedStr = deductResult.currency === 'ngn' ? `₦${deductResult.chargedNgn}` : `$${totalCharge.toFixed(2)}`
          if (_payments) set(_payments, ref, `Outbound,${callType},$${totalCharge.toFixed(2)},${chatId},${phoneNumber},${destinationNumber},${new Date()}${deductResult.currency === 'ngn' ? `,${deductResult.chargedNgn} NGN` : ''}`)
          log(`[Voice] Outbound billed: ${chargedStr} (${minutesBilled} min × $${rate} ${isUSCanada(destinationNumber) ? 'US/CA' : 'Intl'}) for ${callType}`)
          _bot?.sendMessage(chatId,
            `💰 <b>${callType}</b>: ${minutesBilled} min × $${rate} = <b>${chargedStr}</b> (${isUSCanada(destinationNumber) ? 'US/CA' : 'International'})`,
            { parse_mode: 'HTML' }
          ).catch(() => {})
        } else {
          log(`[Voice] Outbound charge failed (insufficient funds): $${totalCharge.toFixed(2)} for ${callType}`)
        }
      }
    } catch (e) { log(`[Voice] Outbound charge error: ${e.message}`) }
    return { planMinUsed: 0, overageMin: minutesBilled, overageCharge: totalCharge, rate, used: 0, limit: 0 }
  }

  // ━━━ INBOUND: Use plan minutes first, then overage from wallet ━━━
  // Step 1: Increment plan minutes
  const { used, limit, overageMinutes } = await incrementMinutesUsed(chatId, phoneNumber, minutesBilled)

  // Step 2: If there are overage minutes, charge wallet at destination-based rate
  let overageCharge = 0
  if (overageMinutes > 0 && _walletOf) {
    // Only charge the NEW overage (not previously charged)
    // overageMinutes is the TOTAL overage after this increment
    // We need to figure how many of THIS call's minutes were overage
    const previousUsed = used - minutesBilled
    const previousOverage = limit !== Infinity ? Math.max(0, previousUsed - limit) : 0
    const newOverageMin = overageMinutes - previousOverage
    if (newOverageMin > 0) {
      overageCharge = newOverageMin * rate
      try {
        const deductResult = await smartWalletDeduct(_walletOf, chatId, overageCharge)
        if (deductResult.success) {
          const ref = _nanoid?.() || `ov_${callType}_${Date.now()}`
          const chargedStr = deductResult.currency === 'ngn' ? `₦${deductResult.chargedNgn}` : `$${overageCharge.toFixed(2)}`
          if (_payments) set(_payments, ref, `Overage,${callType},$${overageCharge.toFixed(2)},${chatId},${phoneNumber},${destinationNumber},${new Date()}${deductResult.currency === 'ngn' ? `,${deductResult.chargedNgn} NGN` : ''}`)
          log(`[Voice] Overage billed: ${chargedStr} (${newOverageMin} min × $${rate} ${isUSCanada(destinationNumber) ? 'US/CA' : 'Intl'}) for ${callType}`)
          _bot?.sendMessage(chatId,
            `💰 <b>Overage</b>: ${newOverageMin} min × $${rate} = <b>${chargedStr}</b> (${isUSCanada(destinationNumber) ? 'US/CA' : 'International'})`,
            { parse_mode: 'HTML' }
          ).catch(() => {})
        }
      } catch (e) { log(`[Voice] Overage charge error: ${e.message}`) }
    }
  }

  const planMinUsed = minutesBilled - (overageMinutes > 0 ? Math.min(minutesBilled, overageMinutes) : 0)
  log(`[Voice] Billed ${callType}: ${minutesBilled} min (${planMinUsed} plan + ${minutesBilled - planMinUsed} overage @ $${rate}) for ${phoneNumber}`)
  return { planMinUsed, overageMin: minutesBilled - planMinUsed, overageCharge, rate, used, limit }
}

// Atomically increment smsUsed for a phone number in DB
async function incrementSmsUsed(chatId, phoneNumber) {
  try {
    const userData = await get(_phoneNumbersOf, chatId)
    const numbers = userData?.numbers || []
    const idx = numbers.findIndex(n => n.phoneNumber === phoneNumber)
    if (idx === -1) return
    numbers[idx].smsUsed = (numbers[idx].smsUsed || 0) + 1
    // Check if just hit limit and notify
    const limit = getSmsLimit(numbers[idx].plan)
    const used = numbers[idx].smsUsed
    if (used >= limit && !numbers[idx]._smsLimitNotified) {
      numbers[idx]._smsLimitNotified = true
      const msg = `⚠️ <b>Plan SMS Exhausted</b>\n\n📞 ${formatPhone(phoneNumber)}\nUsed: <b>${used}/${limit}</b> inbound SMS this cycle.\n\nOverage billing is now active at <b>$${OVERAGE_RATE_SMS}/SMS</b> from your wallet. Service pauses if wallet is empty. Top up or upgrade your plan.`
      _bot?.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(() => {})
    }
    await set(_phoneNumbersOf, chatId, { numbers })
  } catch (e) {
    log(`[Voice] incrementSmsUsed error: ${e.message}`)
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN WEBHOOK HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Hold music URL — soft jazz instrumental loop (no voice, TTS handles announcement separately)
const HOLD_MUSIC_URL = `${process.env.SELF_URL || process.env.SELF_URL_PROD || ''}/assets/hold-music-jazz.mp3?v=1`
const RINGBACK_URL = `${process.env.SELF_URL || process.env.SELF_URL_PROD || ''}/assets/us-ringback.wav?v=1`

/**
 * Play hold music to the caller, then transfer.
 * Flow: Start hold music loop → wait for Telnyx to buffer → transfer call
 * The hold music keeps playing until the transfer target answers and calls are bridged.
 *
 * Note: speakOnCall + playbackStart conflict in Telnyx (can't overlay by default).
 * Using playbackStart alone is reliable — music signals "please wait" to the caller.
 *
 * @param {string} callControlId - Active call to play hold music on
 * @param {string} forwardTo - Number to transfer to
 * @param {string} fromNumber - Caller ID for the transfer
 * @param {object} config - { holdMusic: true/false }
 */
// Pending hold-music transfers: callControlId → { forwardTo, fromNumber }
// Used to defer the transfer until after the TTS announcement finishes
const pendingHoldTransfers = {}

// Active bridge transfers: originalCallControlId → { transferCallControlId, forwardTo, fromNumber }
// Used to track the two-leg bridge approach for hold music during transfer
const activeBridgeTransfers = {}

// Track pending non-hold-music transfers: callControlId → { forwardTo, initiatedAt }
// Used to detect when a native transferCall target didn't answer
const pendingNativeTransfers = {}

async function playHoldMusicAndTransfer(callControlId, forwardTo, fromNumber, config) {
  const useHoldMusic = config?.holdMusic === true

  if (useHoldMusic) {
    // Two-phase approach:
    // Phase 1: Speak TTS announcement
    // Phase 2 (on speak.ended): Start hold music + create outbound call to destination
    // Phase 3 (on destination answered): Bridge the two calls (stops music automatically)
    pendingHoldTransfers[callControlId] = { forwardTo, fromNumber }
    // Safety: clean up if speak.ended never fires (10s timeout — TTS is ~3-4s)
    setTimeout(() => {
      if (pendingHoldTransfers[callControlId]) {
        log(`[Voice] Stale pendingHoldTransfer cleanup for ${callControlId} — speak.ended never arrived`)
        delete pendingHoldTransfers[callControlId]
      }
    }, 10000)
    log(`[Voice] Speaking hold announcement for ${callControlId}, will bridge-transfer to ${forwardTo}`)
    await _telnyxApi.speakOnCall(callControlId, 'Please hold while your call is being transferred.')
  } else {
    // Track native transfer for timeout/no-answer detection
    pendingNativeTransfers[callControlId] = {
      forwardTo,
      fromNumber,
      initiatedAt: Date.now(),
      connected: false,
    }
    // Safety timeout: if native transfer doesn't connect in 35s, mark as timed out
    // (Telnyx will hang up both legs, but we track it for accurate notification)
    const transferTimeout = setTimeout(() => {
      const transfer = pendingNativeTransfers[callControlId]
      if (transfer && !transfer.connected) {
        transfer.timedOut = true
        log(`[Voice] Native transfer timeout: ${forwardTo} didn't answer in 35s (call: ${callControlId})`)
      }
    }, 35000)
    pendingNativeTransfers[callControlId]._timeout = transferTimeout

    await _telnyxApi.transferCall(callControlId, forwardTo, fromNumber)
  }
}

// ── Bridge Transfer Handlers ──
// When the outbound leg (to transfer destination) answers, bridge it with the original leg
async function handleBridgeTransferAnswered(payload) {
  const callControlId = payload.call_control_id
  const transfer = activeBridgeTransfers[callControlId]
  if (!transfer) return false

  log(`[Voice] Bridge transfer destination answered: ${transfer.forwardTo}, bridging with original call`)

  // If original inbound call hasn't been answered yet (SIP ring without auto-answer),
  // answer it now before bridging
  if (transfer.unanswered) {
    try {
      await _telnyxApi.answerCall(transfer.originalCallControlId)
      transfer.unanswered = false
      log(`[Voice] Answered original inbound call for SIP bridge`)
    } catch (e) {
      log(`[Voice] Failed to answer original call for bridge: ${e.message}`)
      await _telnyxApi.hangupCall(callControlId).catch(() => {})
      delete activeBridgeTransfers[callControlId]
      return true
    }
  }

  // Stop hold music/ringback on original leg and bridge the two calls
  await _telnyxApi.playbackStop(transfer.originalCallControlId).catch(() => {})
  await _telnyxApi.bridgeCalls(transfer.originalCallControlId, callControlId)

  transfer.phase = 'bridged'
  transfer.bridgeTime = Date.now()

  // Safety timeout: max bridge duration (10 min) to prevent indefinite calls (e.g., voicemail recording silence)
  const MAX_BRIDGE_MINUTES = 10
  transfer._bridgeTimeout = setTimeout(async () => {
    const t = activeBridgeTransfers[callControlId]
    if (t && t.phase === 'bridged') {
      log(`[Voice] Bridge safety timeout: ${transfer.forwardTo} exceeded ${MAX_BRIDGE_MINUTES} min — disconnecting`)
      await _telnyxApi.hangupCall(callControlId).catch(() => {})
      // handleBridgeTransferHangup will clean up the original leg
    }
  }, MAX_BRIDGE_MINUTES * 60 * 1000)

  // Notify bot user
  const parentSession = outboundIvrCalls[transfer.originalCallControlId] || activeCalls[transfer.originalCallControlId]
  if (parentSession) {
    const chatId = parentSession.chatId
    const msg = transfer.type === 'sip_ring'
      ? `✅ <b>SIP Call Connected</b>\nIncoming call bridged to your device`
      : `✅ <b>Transfer Connected</b>\n📞 ${transfer.forwardTo} connected`
    _bot?.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(() => {})
  }
  return true
}

// When either leg of a bridge transfer hangs up, clean up and ensure other leg disconnects

  // Calculate transfer leg duration from when destination answered (bridgeTime) to now
// Bill the transfer leg's connected time (original leg billing is separate in handleOutboundIvrHangup)
async function handleBridgeTransferHangup(payload) {
  const callControlId = payload.call_control_id
  const transfer = activeBridgeTransfers[callControlId]
  if (!transfer) return false

  const hangupCause = payload.hangup_cause || 'unknown'

  // Clear bridge safety timeout if set
  if (transfer._bridgeTimeout) clearTimeout(transfer._bridgeTimeout)
  // Telnyx reports 0s for bridged legs, so we track it ourselves
  const transferDuration = transfer.bridgeTime ? Math.round((Date.now() - transfer.bridgeTime) / 1000) : 0
  const transferMinutes = transferDuration > 0 ? Math.ceil(transferDuration / 60) : 0

  log(`[Voice] Bridge transfer leg hangup: ${transfer.forwardTo} (${transferDuration}s = ${transferMinutes} min, cause: ${hangupCause})`)

  // Bill the transfer leg's minutes (this is a separate outbound call to the destination)
  if (transferMinutes > 0 && transfer.phase === 'bridged') {
    // Check both outboundIvrCalls and activeCalls for the parent session
    const parentSession = outboundIvrCalls[transfer.originalCallControlId] || activeCalls[transfer.originalCallControlId]
    if (parentSession && !parentSession.isTrial) {
      try {
        // For inbound calls, the owner is already in the session (chatId, num)
        // For outbound IVR, we need to look up the callerId
        let ownerId, ownerNum
        if (parentSession.callerId) {
          // Outbound IVR session — look up by callerId
          const lookup = await findNumberOwner(parentSession.callerId)
          ownerId = lookup.chatId
          ownerNum = lookup.num
        } else if (parentSession.chatId && parentSession.num) {
          // Inbound call session — owner info already available
          ownerId = parentSession.chatId
          ownerNum = parentSession.num
        }

        if (ownerId && ownerNum) {
          const billingInfo = await billCallMinutesUnified(ownerId, ownerNum.phoneNumber, transferMinutes, transfer.forwardTo, 'Bridge_Transfer')
          log(`[Voice] Billed transfer leg: ${transferMinutes} min to ${transfer.forwardTo} for ${ownerNum.phoneNumber}`)

          const remaining = billingInfo.limit > 0 ? Math.max(0, billingInfo.limit - billingInfo.used) : null
          const planLine = remaining !== null
            ? `📊 Transfer: ${transferMinutes} min deducted · <b>${remaining}/${billingInfo.limit}</b> min remaining`
            : `📊 Transfer: ${transferMinutes} min used`
          _bot?.sendMessage(ownerId,
            `📞 <b>Transfer Ended</b>\n${formatPhone(transfer.forwardTo)} — ${formatDuration(transferDuration)}\n${planLine}`,
            { parse_mode: 'HTML' }
          ).catch(() => {})
        } else {
          log(`[Voice] Bridge transfer billing: could not find owner for parent session`)
        }
      } catch (e) { log(`[Voice] Bridge transfer billing error: ${e.message}`) }
    }
  }

  // Stop any playback (ringback/hold music) on the original leg
  await _telnyxApi.playbackStop(transfer.originalCallControlId).catch(() => {})

  // If destination never answered (no_answer, busy, timeout), handle fallback
  if (transfer.phase !== 'bridged') {
    // Special handling for SIP ring: DON'T hang up original leg — fall through to voicemail/forwarding/missed
    if (transfer.type === 'sip_ring') {
      const origSession = activeCalls[transfer.originalCallControlId]
      if (origSession) {
        // If original inbound was never answered (unanswered SIP ring), answer it now for fallback
        if (transfer.unanswered) {
          try {
            await _telnyxApi.answerCall(transfer.originalCallControlId)
            transfer.unanswered = false
            log(`[Voice] SIP no answer → answered original call for fallback`)
            // Small delay to let Telnyx process the answer before issuing speak/playback
            await new Promise(r => setTimeout(r, 500))
          } catch (e) {
            log(`[Voice] Failed to answer original call for fallback: ${e.message} — hanging up`)
            await _telnyxApi.hangupCall(transfer.originalCallControlId).catch(() => {})
            notifyUser(transfer.chatId, transfer.num, 'missed', origSession)
            delete activeBridgeTransfers[callControlId]
            return true
          }
        }

        const vm = transfer.vmConfig
        const fwd = transfer.fwdConfig

        // Try forwarding on no_answer (if configured)
        if (fwd?.enabled && fwd.forwardTo && fwd.mode === 'no_answer') {
          origSession.phase = 'forwarding'
          origSession.forwardingRate = CALL_FORWARDING_RATE_MIN
          log(`[Voice] SIP no answer → forwarding to ${fwd.forwardTo}`)
          await playHoldMusicAndTransfer(transfer.originalCallControlId, fwd.forwardTo, transfer.fromNumber, fwd)
        }
        // Try voicemail (if configured and plan allows)
        else if (vm?.enabled && canAccessFeature(transfer.num.plan, 'voicemail')) {
          origSession.phase = 'voicemail_greeting'
          log(`[Voice] SIP no answer → playing voicemail for ${transfer.num.phoneNumber}`)
          if (vm.greetingType === 'custom' && vm.customAudioGreetingUrl) {
            try {
              const axios = require('axios')
              await axios.post(`https://api.telnyx.com/v2/calls/${transfer.originalCallControlId}/actions/playback_start`, {
                audio_url: vm.customAudioGreetingUrl,
              }, {
                headers: { 'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`, 'Content-Type': 'application/json' }
              })
            } catch (e) {
              const fallback = vm.customGreetingText || `The person at ${formatPhone(transfer.num.phoneNumber)} is unavailable. Please leave a message after the tone.`
              await _telnyxApi.speakOnCall(transfer.originalCallControlId, fallback)
            }
          } else {
            const greeting = vm.greetingType === 'custom' && vm.customGreetingText
              ? vm.customGreetingText
              : `The person at ${formatPhone(transfer.num.phoneNumber)} is unavailable. Please leave a message after the tone.`
            await _telnyxApi.speakOnCall(transfer.originalCallControlId, greeting)
          }
        }
        // No forwarding or voicemail — missed call
        else {
          origSession.phase = 'missed'
          log(`[Voice] SIP no answer → missed call for ${transfer.num.phoneNumber}`)
          await _telnyxApi.speakOnCall(transfer.originalCallControlId, 'The person you are calling is currently unavailable. Please try again later.')
          setTimeout(() => _telnyxApi.hangupCall(transfer.originalCallControlId), 4000)
          notifyUser(transfer.chatId, transfer.num, 'missed', origSession)
        }
      }
      delete activeBridgeTransfers[callControlId]
      return true
    }

    // Regular bridge transfer failure — hang up original leg and notify user
    await _telnyxApi.hangupCall(transfer.originalCallControlId).catch(() => {})
    const parentSession = outboundIvrCalls[transfer.originalCallControlId] || activeCalls[transfer.originalCallControlId]
    if (parentSession) {
      const chatId = parentSession.chatId
      let reason = hangupCause === 'no_answer' || hangupCause === 'timeout' ? 'No answer' :
                   hangupCause === 'user_busy' ? 'Busy' : hangupCause
      _bot?.sendMessage(chatId,
        `❌ <b>Transfer Failed</b>\n📞 ${formatPhone(transfer.forwardTo)} — ${reason}`,
        { parse_mode: 'HTML' }
      ).catch(() => {})
    }
  } else {
    // Bridge was active and one leg hung up — hang up the other leg too
    await _telnyxApi.hangupCall(transfer.originalCallControlId).catch(() => {})
  }

  delete activeBridgeTransfers[callControlId]
  return true
}

// Used to recognize new call legs that Telnyx creates during call transfers
const ivrTransferLegs = {}

// ── Webhook Event Buffer ──
// Handles race condition where call.hangup arrives before call.initiated
// Buffers early hangups and processes them after initiated is handled
const _eventBuffer = new Map() // call_control_id → { hangupPayload, timer }
const EVENT_BUFFER_TIMEOUT_MS = 5000 // Max 5s to wait for matching initiated event

function bufferHangup(callControlId, payload) {
  // Clear any existing timer for this call
  const existing = _eventBuffer.get(callControlId)
  if (existing?.timer) clearTimeout(existing.timer)

  _eventBuffer.set(callControlId, {
    hangupPayload: payload,
    timer: setTimeout(() => {
      // Timeout: process the orphan hangup
      const entry = _eventBuffer.get(callControlId)
      if (entry) {
        _eventBuffer.delete(callControlId)
        log(`[Voice] Buffer timeout — processing orphan hangup for ${callControlId}`)
        processHangup(entry.hangupPayload)
      }
    }, EVENT_BUFFER_TIMEOUT_MS)
  })
  log(`[Voice] Buffered early hangup for ${callControlId} (waiting for call.initiated)`)
}

async function processHangup(payload) {
  if (await handleBridgeTransferHangup(payload)) return
  if (handleOutboundIvrHangup(payload)) return
  if (handleIvrTransferLegHangup(payload)) return
  await handleCallHangup(payload)
}

// Track which call_control_ids have been initiated (processed)
const _initiatedCalls = new Set()
const INITIATED_CALL_TTL_MS = 120_000 // Clean up after 2 min

async function handleVoiceWebhook(req, res) {
  res.sendStatus(200)

  try {
    const event = req.body?.data || req.body
    const eventType = event?.event_type || event?.type
    const payload = event?.payload || event

    if (!eventType) return

    log(`[Voice] Event: ${eventType}`)
    
    // Detailed payload logging for call debugging
    if (eventType === 'call.initiated' || eventType === 'call.hangup') {
      log(`[Voice] PAYLOAD DUMP: direction=${payload.direction}, from=${payload.from}, to=${payload.to}, connection_id=${payload.connection_id}, call_control_id=${payload.call_control_id}, call_leg_id=${payload.call_leg_id}, hangup_cause=${payload.hangup_cause || 'N/A'}, hangup_source=${payload.hangup_source || 'N/A'}, sip_hangup_cause=${payload.sip_hangup_cause || 'N/A'}, state=${payload.state}`)
    }

    const callControlId = payload?.call_control_id

    switch (eventType) {
      case 'call.initiated': {
        // Mark as initiated and process
        if (callControlId) {
          _initiatedCalls.add(callControlId)
          setTimeout(() => _initiatedCalls.delete(callControlId), INITIATED_CALL_TTL_MS)
        }

        if (handleOutboundIvrInitiated(payload)) break
        if (handleIvrTransferLegInitiated(payload)) break
        // Skip normal routing for bridge transfer legs (e.g., SIP ring, call forwarding)
        if (activeBridgeTransfers[callControlId]) {
          log(`[Voice] call.initiated for bridge transfer leg ${callControlId} — skipping normal routing`)
        }
        // Skip SIP device delivery legs — Telnyx auto-routes these to the registered device
        // These arrive on the SIP Connection with state=bridging when we ring a SIP URI
        // FIX: Only skip if `to` is a SIP URI (delivery leg). Outbound SIP calls to PSTN numbers
        // (e.g., +17123393700) must NOT be skipped — they need handleOutboundSipCall() routing.
        else if (payload.state === 'bridging' && payload.connection_id === (process.env.TELNYX_SIP_CONNECTION_ID || '') && (payload.to || '').startsWith('sip:')) {
          log(`[Voice] call.initiated for SIP device delivery leg ${callControlId} — skipping (Telnyx auto-routes)`)
        } else {
          await handleCallInitiated(payload)
        }

        // Check if we have a buffered hangup for this call
        const buffered = _eventBuffer.get(callControlId)
        if (buffered) {
          clearTimeout(buffered.timer)
          _eventBuffer.delete(callControlId)
          log(`[Voice] Processing buffered hangup for ${callControlId} (arrived before initiated)`)
          await processHangup(buffered.hangupPayload)
        }
        break
      }
      case 'call.answered':
        if (await handleBridgeTransferAnswered(payload)) break
        if (await handleOutboundIvrAnswered(payload)) break
        if (handleIvrTransferLegAnswered(payload)) break
        await handleCallAnswered(payload)
        break
      case 'call.hangup': {
        // If we haven't seen call.initiated for this call yet, buffer the hangup
        if (callControlId && !_initiatedCalls.has(callControlId)) {
          bufferHangup(callControlId, payload)
          break
        }
        if (await handleBridgeTransferHangup(payload)) break
        if (handleOutboundIvrHangup(payload)) break
        if (handleIvrTransferLegHangup(payload)) break
        await handleCallHangup(payload)
        break
      }
      case 'call.gather.ended':
        if (await handleOutboundIvrGatherEnded(payload)) break
        await handleGatherEnded(payload)
        break
      case 'call.recording.saved':
        await handleRecordingSaved(payload)
        break
      case 'call.speak.ended':
        await handleSpeakEnded(payload)
        break
      case 'call.playback.ended':
        // Only route to handleSpeakEnded for voicemail flows, NOT for hold music
        // Hold music transfers are handled via call.speak.ended only
        if (!pendingHoldTransfers[payload?.call_control_id]) {
          await handleSpeakEnded(payload)
        }
        break
      case 'call.bridged':
        handleCallBridged(payload)
        break
      case 'call.playback.started':
      case 'call.dtmf.received':
        // Informational events — already handled via gather.ended
        break
      case 'fax.received':
      case 'fax.receiving.started':
      case 'fax.media.processing.started':
      case 'fax.failed':
        // Fax events — handled by dedicated /telnyx/fax-webhook endpoint
        // If they arrive here via voice webhook, log and skip
        log(`[Voice] Fax event received on voice webhook: ${eventType} — use /telnyx/fax-webhook for fax handling`)
        break
      default:
        log(`[Voice] Unhandled event: ${eventType}`)
    }
  } catch (e) {
    log(`[Voice] Webhook error: ${e.message}`)
  }
}

/**
 * Handle call.bridged — mark active/IVR sessions as bridged
 */
function handleCallBridged(payload) {
  const callControlId = payload.call_control_id
  const session = outboundIvrCalls[callControlId]
  if (session) {
    session.phase = 'bridged'
    log(`[OutboundIVR] Bridged: ${session.targetNumber} → ${session.ivrNumber}`)
    _bot?.sendMessage(session.chatId, ivrOutbound.formatCallNotification('transferred', session), { parse_mode: 'HTML' }).catch(() => {})
    return
  }
  const active = activeCalls[callControlId]
  if (active) {
    active.phase = 'bridged'
    log(`[Voice] Call bridged: ${active.from} ↔ ${active.to}`)
    // Mark native transfer as connected if one exists
    const nativeTransfer = pendingNativeTransfers[callControlId]
    if (nativeTransfer) {
      nativeTransfer.connected = true
      if (nativeTransfer._timeout) clearTimeout(nativeTransfer._timeout)
      log(`[Voice] Native transfer connected: ${nativeTransfer.forwardTo}`)
    }
    return
  }
  // Check if this is a transfer leg being bridged
  const transfer = ivrTransferLegs[callControlId]
  if (transfer) {
    log(`[OutboundIVR] Transfer leg bridged: ${transfer.ivrNumber}`)
    return
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CALL INITIATED — Answer or reject based on limits
// Also handles OUTBOUND SIP calls (Twilio bridge)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleCallInitiated(payload) {
  const callControlId = payload.call_control_id
  const to = (payload.to || '').replace(/[^+\d]/g, '')
  const from = (payload.from || '').replace(/[^+\d]/g, '')
  const direction = payload.direction
  const connectionId = payload.connection_id || ''
  const sipConnectionId = process.env.TELNYX_SIP_CONNECTION_ID || ''

  // ── OUTBOUND / SIP CALLS ──
  // Route to SIP handler if:
  // 1. direction is 'outgoing' (explicit outbound)
  // 2. connection_id matches SIP Connection (outbound from SIP device)
  const isFromSipConnection = sipConnectionId && connectionId === sipConnectionId
  if (direction === 'outgoing' || (isFromSipConnection && direction !== 'incoming')) {
    await handleOutboundSipCall(payload)
    return
  }

  // ── INBOUND CALLS (via Call Control App) ──
  // With numbers assigned to Call Control App, all inbound calls arrive here
  // with direction='incoming'. We answer and apply IVR/forwarding/voicemail.

  // Lookup number owner — get FRESH data from DB
  const { chatId, num } = await findNumberOwner(to)
  if (!chatId || !num) {
    log(`[Voice] ⚠️ ORPHANED NUMBER: No owner found for ${to} — inbound call from ${from} rejected. Number may need cleanup.`)
    // Alert admin about orphaned number
    if (_bot && process.env.TELEGRAM_ADMIN_CHAT_ID) {
      _bot.sendMessage(process.env.TELEGRAM_ADMIN_CHAT_ID, `⚠️ <b>Orphaned Number Alert</b>\n\n📞 <code>${to}</code> received inbound call from <code>${from}</code>\n\n❌ No owner found in DB — call rejected.\nThis number may need to be released or re-assigned.`, { parse_mode: 'HTML' }).catch(() => {})
    }
    await _telnyxApi.hangupCall(callControlId).catch(() => {})
    return
  }

  // ── CHECK: Number suspended? ──
  if (num.status !== 'active') {
    log(`[Voice] Number ${to} is ${num.status}, rejecting call`)
    try {
      await _telnyxApi.answerCall(callControlId)
      await _telnyxApi.speakOnCall(callControlId, 'This number is no longer in service.')
      setTimeout(() => _telnyxApi.hangupCall(callControlId), 4000)
    } catch (e) {
      await _telnyxApi.hangupCall(callControlId).catch(() => {})
    }
    return
  }

  // ── CHECK: Inbound minutes limit reached? → Try overage billing ──
  if (isMinuteLimitReached(num)) {
    const inboundRate = getCallRate(from) // Rate based on caller's country
    let overageAllowed = false
    if (_walletOf) {
      try {
        const check = await smartWalletCheck(_walletOf, chatId, inboundRate)
        if (check.sufficient) {
          overageAllowed = true
          log(`[Voice] Minutes limit reached for ${to}, but wallet has funds (${check.currency}) — allowing overage at $${inboundRate}/min`)
        }
      } catch (e) { log(`[Voice] Overage check error: ${e.message}`) }
    }
    if (!overageAllowed) {
      const inboundRate = getCallRate(from)
      log(`[Voice] Minutes limit reached for ${to} (${num.minutesUsed || 0}/${getMinuteLimit(num.plan)}), no wallet balance — rejecting call`)
      try {
        await _telnyxApi.answerCall(callControlId)
        await _telnyxApi.speakOnCall(callControlId, 'Your inbound minutes limit has been reached and wallet balance is insufficient. Please top up your wallet or upgrade your plan.')
        setTimeout(() => _telnyxApi.hangupCall(callControlId), 6000)
      } catch (e) {
        await _telnyxApi.hangupCall(callControlId).catch(() => {})
      }
      _bot?.sendMessage(chatId, `🚫 <b>Incoming Call Blocked — Wallet Empty</b>\n\n📞 ${formatPhone(to)}\n👤 Caller: ${formatPhone(from)}\n\nPlan minutes exhausted and wallet balance is insufficient for overage ($${inboundRate}/min ${isUSCanada(from) ? 'US/CA' : 'Intl'}). Top up your wallet or upgrade your plan to resume receiving calls.`, { parse_mode: 'HTML' }).catch(() => {})
      return
    }
  }

  // Store session data
  activeCalls[callControlId] = {
    chatId,
    num,
    from,
    to,
    startedAt: new Date(),
    phase: 'answering',
    recordingEnabled: num.features?.recording === true && canAccessFeature(num.plan, 'callRecording'),
  }

  // ── MID-CALL LIMIT MONITOR ──
  // All call types: plan minutes first, then overage at destination-based rate
  const minuteLimit = getMinuteLimit(num.plan)
  const sessionRef = activeCalls[callControlId]
  sessionRef._limitTimer = setInterval(async () => {
    const sess = activeCalls[callControlId]
    if (!sess) { clearInterval(sessionRef._limitTimer); return }
    const elapsedSec = Math.floor((Date.now() - sess.startedAt.getTime()) / 1000)
    const elapsedMin = Math.ceil(elapsedSec / 60)

    // Determine destination for rate calculation
    const isForwarded = sess.phase === 'forwarding' || sess.phase === 'ivr_forward'
    const isOutbound = sess.direction === 'outgoing'
    const destination = isForwarded
      ? (num.features?.callForwarding?.forwardTo || from)
      : isOutbound ? to : from
    const rate = getCallRate(destination)

    // Check plan minutes + overage
    if (minuteLimit !== Infinity) {
      const projectedTotal = (num.minutesUsed || 0) + elapsedMin
      if (projectedTotal >= minuteLimit) {
        let canContinue = false
        if (_walletOf) {
          try {
            const deductResult = await smartWalletDeduct(_walletOf, chatId, rate)
            if (deductResult.success) {
              canContinue = true
              if (!sess._overageNotified) {
                sess._overageNotified = true
                const chargedStr = deductResult.currency === 'ngn' ? `₦${deductResult.chargedNgn}/min` : `$${rate}/min`
                _bot?.sendMessage(chatId, `💰 <b>Overage Active</b> — Plan minutes exhausted. ${chargedStr} (${isUSCanada(destination) ? 'US/CA' : 'Intl'}) from ${deductResult.currency.toUpperCase()} wallet.`, { parse_mode: 'HTML' }).catch(() => {})
              }
            }
          } catch (e) { log(`[Voice] Mid-call overage error: ${e.message}`) }
        }
        if (!canContinue) {
          log(`[Voice] Mid-call limit reached for ${to}: projected ${projectedTotal}/${minuteLimit} min, no wallet balance. Disconnecting.`)
          clearInterval(sessionRef._limitTimer)
          sess._limitDisconnect = true
          try {
            await _telnyxApi.speakOnCall(callControlId, 'Your call limit and wallet balance have been exhausted. This call will now end.')
            setTimeout(() => _telnyxApi.hangupCall(callControlId), 5000)
          } catch (e) {
            await _telnyxApi.hangupCall(callControlId).catch(() => {})
          }
          _bot?.sendMessage(chatId, `🚫 <b>Call Ended</b> — Plan minutes + wallet exhausted.\n⏱️ ~${elapsedMin} min. Top up wallet or upgrade plan.`, { parse_mode: 'HTML' }).catch(() => {})
        }
      }
    }
  }, 60000)

  // ── SIP DEVICE RING (NO AUTO-ANSWER) ──
  // If number has SIP credentials, ring the SIP device BEFORE answering.
  // The caller hears real network ringback. Only answer when SIP device picks up.
  // If SIP device doesn't answer → answer + voicemail/forwarding/missed fallback.
  const fwdConfig = num.features?.callForwarding
  const ivrConfig = num.features?.ivr
  const hasSip = !!num.sipUsername
  const hasIvr = ivrConfig?.enabled && canAccessFeature(num.plan, 'ivr') && ivrConfig.options && Object.keys(ivrConfig.options).length > 0
  const hasForwardAlways = fwdConfig?.enabled && fwdConfig.forwardTo && fwdConfig.mode === 'always'

  // Only do unanswered SIP ring if: has SIP, no IVR, no forward-always (those need answered call)
  if (hasSip && !hasIvr && !hasForwardAlways) {
    sessionRef.phase = 'ringing_sip'
    const sipUser = num.telnyxSipUsername || num.sipUsername
    const sipUri = `sip:${sipUser}@sip.telnyx.com`
    const ringTimeout = fwdConfig?.ringTimeout || 25
    const vmConfig = num.features?.voicemail
    log(`[Voice] Ringing SIP device (unanswered): ${sipUri} for ${num.phoneNumber} (timeout: ${ringTimeout}s)`)

    try {
      const newCall = await _telnyxApi.createOutboundCall(from, sipUri)
      // Pass original caller's number as 'from' so SIP device shows correct caller ID
      if (newCall?.callControlId) {
        activeBridgeTransfers[newCall.callControlId] = {
          originalCallControlId: callControlId,
          forwardTo: sipUri,
          fromNumber: to,
          type: 'sip_ring',
          vmConfig,
          fwdConfig,
          chatId,
          num,
          phase: 'ringing',
          unanswered: true, // Original inbound NOT yet answered
        }
        sessionRef.sipRingCallControlId = newCall.callControlId // Track for hangup cleanup

        _bot?.sendMessage(chatId,
          `📞 <b>Incoming Call</b>\n${formatPhone(from)} → ${formatPhone(to)}\nRinging your SIP device...`,
          { parse_mode: 'HTML' }
        ).catch(() => {})

        // Timeout: SIP device didn't answer — answer inbound + fallback
        setTimeout(async () => {
          const transfer = activeBridgeTransfers[newCall.callControlId]
          if (transfer && transfer.phase !== 'bridged') {
            log(`[Voice] SIP ring timeout: device didn't answer in ${ringTimeout}s — falling through`)
            await _telnyxApi.hangupCall(newCall.callControlId).catch(() => {})
          }
        }, ringTimeout * 1000)
        return // Don't answer — wait for SIP device
      }
    } catch (e) {
      log(`[Voice] Failed to ring SIP device: ${e.message} — answering and routing normally`)
    }
    // If SIP ring failed, fall through to normal answer + routing
  }

  // Answer the call — for non-SIP numbers, or SIP ring failed, or IVR/forwarding-always
  try {
    await _telnyxApi.answerCall(callControlId)
  } catch (answerErr) {
    const errMsg = answerErr?.response?.data?.errors?.[0]?.detail || answerErr?.message || ''
    log(`[Voice] answerCall error for ${to}: ${errMsg}`)
    if (sessionRef._limitTimer) clearInterval(sessionRef._limitTimer)
    delete activeCalls[callControlId]
    return
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OUTBOUND SIP CALL — Bridge Twilio numbers through Twilio PSTN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleOutboundSipCall(payload) {
  const callControlId = payload.call_control_id
  const rawTo = payload.to || ''
  const rawFrom = payload.from || ''
  const connectionId = payload.connection_id || ''

  // Detect SIP-originated calls using multiple methods:
  // 1. sip: prefix or @ in from field (SIP URI format — user dialing via SIP client with URI)
  // 2. connection_id matches our SIP Connection ID (Telnyx credential connection outbound —
  //    from field will be phone number, not SIP URI)
  const sipConnectionId = process.env.TELNYX_SIP_CONNECTION_ID || ''
  const isSipByFromField = rawFrom.startsWith('sip:') || rawFrom.includes('@')
  const isSipByConnection = sipConnectionId && connectionId === sipConnectionId
  const fromClean = rawFrom.replace(/[^+\d]/g, '')
  const toClean = rawTo.replace(/[^+\d]/g, '')

  // For connection_id based detection, check if we already have an active session
  // that initiated a transfer to this destination (avoid double-processing transfer legs)
  const isDuplicateSession = activeCalls[callControlId] !== undefined
  
  const isSipOriginated = isSipByFromField || isSipByConnection

  if (!isSipOriginated) {
    log(`[Voice] Outbound call from ${rawFrom} to ${rawTo} (conn=${connectionId}) — not on SIP connection, ignoring`)
    return
  }

  if (isDuplicateSession) {
    log(`[Voice] Outbound SIP: Already tracking call ${callControlId}, skipping duplicate`)
    return
  }

  // Determine if Telnyx auto-routed this call (state=bridging means already routing)
  const isAutoRouted = isSipByConnection && !isSipByFromField
  log(`[Voice] SIP call detected: byFromField=${isSipByFromField}, byConnection=${isSipByConnection}, autoRouted=${isAutoRouted}, connection_id=${connectionId}`)

  // Parse destination number from SIP URI: sip:+1234567890@domain → +1234567890
  let destination = rawTo.replace(/[^+\d]/g, '')
  if (rawTo.startsWith('sip:')) {
    destination = rawTo.replace('sip:', '').split('@')[0].replace(/[^+\d]/g, '')
  }

  // E.164 normalization — SIP clients may dial without + prefix
  // 10 digits (US/CA local) → prepend +1
  // 11 digits starting with 1 (US/CA with country code) → prepend +
  // Already has + → leave as-is
  if (destination && !destination.startsWith('+')) {
    if (destination.length === 10) {
      destination = '+1' + destination
    } else if (destination.length === 11 && destination.startsWith('1')) {
      destination = '+' + destination
    } else if (destination.length > 6) {
      destination = '+' + destination // International — assume country code included
    }
  }

  // Parse SIP username from the 'from' field: sip:user@domain or user@domain → user
  let sipUsername = rawFrom
  if (rawFrom.includes('@')) {
    sipUsername = rawFrom.replace(/^sip:/, '').split('@')[0]
  }

  log(`[Voice] Outbound SIP: from=${sipUsername} (cleaned=${fromClean}) to=${destination} (${callControlId}, conn=${connectionId})`)

  // ── SIP Rate Limiting — prevent spam dialing ──
  if (!checkSipRateLimit(sipUsername, destination)) {
    log(`[Voice] ⚠️ SIP RATE LIMIT: ${sipUsername} → ${destination} — exceeded ${SIP_RATE_LIMIT_MAX} calls/${SIP_RATE_LIMIT_WINDOW/1000}s, rejecting`)
    try {
      await _telnyxApi.hangupCall(callControlId)
    } catch (e) { log(`[Voice] Reject error: ${e.message}`) }
    return
  }

  // Look up the SIP user → find their phone number and provider
  // Try by SIP username first, then by phone number from the 'from' field
  const { chatId, num } = await findNumberBySipUser(sipUsername, fromClean)
  if (!chatId || !num) {
    log(`[Voice] Outbound SIP: No owner found for SIP user ${sipUsername}, rejecting`)
    try {
      await _telnyxApi.hangupCall(callControlId)
    } catch (e) { log(`[Voice] Reject error: ${e.message}`) }
    return
  }

  // Number suspended check
  if (num.status !== 'active') {
    log(`[Voice] Outbound SIP: Number ${num.phoneNumber} is ${num.status}, rejecting`)
    try {
      await _telnyxApi.hangupCall(callControlId)
    } catch (e) { log(`[Voice] Reject error: ${e.message}`) }
    _bot?.sendMessage(chatId, `🚫 <b>Outbound Call Blocked</b>\n📞 ${formatPhone(num.phoneNumber)} → ${formatPhone(destination)}\nReason: Number is ${num.status}. Please renew or contact support.`, { parse_mode: 'HTML' }).catch(() => {})
    return
  }

  // Wallet balance check — outbound calls charge directly from wallet (plan minutes are for inbound only)
  const sipRate = getCallRate(destination)
  if (_walletOf) {
    try {
      const walletCheck = await smartWalletCheck(_walletOf, chatId, sipRate)
      if (!walletCheck.sufficient) {
        log(`[Voice] Outbound SIP: wallet too low for ${num.phoneNumber} → ${destination} (USD: $${walletCheck.usdBal.toFixed(2)}, NGN: ₦${walletCheck.ngnBal.toFixed(2)})`)
        await _telnyxApi.hangupCall(callControlId)
        _bot?.sendMessage(chatId, `🚫 <b>SIP Call Blocked</b> — Wallet balance insufficient (need $${sipRate}/min ${isUSCanada(destination) ? 'US/CA' : 'Intl'}).\nUSD: $${walletCheck.usdBal.toFixed(2)} / NGN: ₦${walletCheck.ngnBal.toFixed(2)}\nOutbound calls are billed from wallet. Top up via 👛 Wallet.`, { parse_mode: 'HTML' }).catch(() => {})
        return
      }
    } catch (e) { log(`[Voice] Wallet check error: ${e.message}`) }
  }

  // ── TELNYX NUMBER: Route SIP call to PSTN via transfer command ──
  if (num.provider === 'telnyx') {
    const callerDisplay = num.phoneNumber || 'TEST-SIP'
    log(`[Voice] Outbound SIP (Telnyx): ${callerDisplay} → ${destination} — routing to PSTN`)

    // Check if this is a test credential call (enforce limits)
    let testCallInfo = { isTestCall: false }
    try {
      const { checkTestCredentialCall } = require('./phone-test-routes.js')
      testCallInfo = await checkTestCredentialCall(sipUsername, fromClean)
      if (testCallInfo.isTestCall) {
        log(`[Voice] TEST CALL detected — max ${testCallInfo.maxDuration}s, ${testCallInfo.callsRemaining} calls remaining`)
      }
    } catch (e) { /* phone-test-routes not loaded, ignore */ }

    activeCalls[callControlId] = {
      chatId,
      num,
      from: num.phoneNumber,
      to: destination,
      startedAt: new Date(),
      phase: 'outbound_telnyx',
      direction: 'outgoing',
      recordingEnabled: num.features?.recording === true,
      isTestCall: testCallInfo.isTestCall,
    }

    // Auto-hangup for test calls after max duration
    if (testCallInfo.isTestCall && testCallInfo.maxDuration) {
      const maxMs = testCallInfo.maxDuration * 1000
      setTimeout(async () => {
        if (activeCalls[callControlId]) {
          log(`[Voice] Test call time limit (${testCallInfo.maxDuration}s) reached — hanging up ${callControlId}`)
          await _telnyxApi.hangupCall(callControlId).catch(() => {})
        }
      }, maxMs)
    }

    // Mid-call wallet monitor — outbound calls billed from wallet only (plan minutes are for inbound)
    if (!testCallInfo.isTestCall) {
      const outboundSession = activeCalls[callControlId]
      outboundSession._limitTimer = setInterval(async () => {
        const sess = activeCalls[callControlId]
        if (!sess) { clearInterval(outboundSession._limitTimer); return }
        const rate = getCallRate(destination)
        // Check wallet balance each minute
        if (_walletOf) {
          try {
            const deductResult = await smartWalletDeduct(_walletOf, chatId, rate)
            if (!deductResult.success) {
              log(`[Voice] Mid-call wallet exhausted for outbound ${num.phoneNumber}: insufficient funds. Disconnecting.`)
              clearInterval(outboundSession._limitTimer)
              sess._limitDisconnect = true
              await _telnyxApi.hangupCall(callControlId).catch(() => {})
              _bot?.sendMessage(chatId, `🚫 <b>Call Disconnected</b> — Wallet exhausted.\nTop up via 👛 Wallet.`, { parse_mode: 'HTML' }).catch(() => {})
              return
            }
          } catch (e) { log(`[Voice] Mid-call wallet check error: ${e.message}`) }
        }
      }, 60000)
    }

    // ── MULTI-USER CALLER ID FIX ──
    // Always set per-call ANI via transferCall for ALL outbound SIP calls.
    // Auto-routed calls (credential connection) use the shared SIP connection ANI override,
    // which is a single global value — wrong for multi-user. transferCall's `from` param
    // overrides this per-call, ensuring each user's correct phone number displays as caller ID.
    //
    // Also update the connection-level ANI override in the background (best-effort)
    // so the next auto-routed call uses the right number even before our transfer fires.
    if (sipConnectionId) {
      _telnyxApi.updateAniOverride(sipConnectionId, num.phoneNumber).catch(() => {})
    }

    try {
      await _telnyxApi.transferCall(callControlId, destination, num.phoneNumber)
      log(`[Voice] Outbound SIP (Telnyx): Transfer initiated ${callerDisplay} → ${destination} (autoRouted=${isAutoRouted})`)
    } catch (e) {
      log(`[Voice] Outbound SIP (Telnyx): Transfer failed — ${e.message}`)
      // If transfer fails on auto-routed call, it may still proceed with connection-level ANI
      if (isAutoRouted) {
        log(`[Voice] Outbound SIP (Telnyx): Auto-routed call may proceed with connection ANI — still tracking`)
      } else {
        // Non-auto-routed calls with failed transfer can't proceed
        const sess = activeCalls[callControlId]
        if (sess?._limitTimer) clearInterval(sess._limitTimer)
        delete activeCalls[callControlId]
        _bot?.sendMessage(chatId, `🚫 <b>Outbound Call Failed</b>\n📞 ${formatPhone(num.phoneNumber)} → ${formatPhone(destination)}\nReason: Call routing failed. Please try again.`, { parse_mode: 'HTML' }).catch(() => {})
      }
    }

    // Notify user about the outbound call
    if (testCallInfo.isTestCall) {
      _bot?.sendMessage(chatId, `📞 <b>Free SIP Test Call</b>\nFrom: ${formatPhone(num.phoneNumber)}\nTo: ${formatPhone(destination)}\n🆓 Free test call (${testCallInfo.callsRemaining ?? 0} remaining, max ${testCallInfo.maxDuration}s)`, { parse_mode: 'HTML' }).catch(() => {})
    } else {
      let walletLine = ''
      if (_walletOf) {
        try {
          const { usdBal } = await getBalance(_walletOf, chatId)
          const estMinutes = Math.floor(usdBal / sipRate)
          walletLine = `💳 Wallet: <b>$${usdBal.toFixed(2)}</b> (~${estMinutes} min at $${sipRate}/min ${isUSCanada(destination) ? 'US/CA' : 'Intl'})`
        } catch (e) { /* ignore */ }
      }
      _bot?.sendMessage(chatId, `📞 <b>SIP Outbound Call</b>\nFrom: ${formatPhone(num.phoneNumber)}\nTo: ${formatPhone(destination)}\n${walletLine}`, { parse_mode: 'HTML' }).catch(() => {})
    }    return
  }

  // ── TWILIO NUMBER: Bridge through Twilio SIP → Twilio PSTN ──
  if (num.provider === 'twilio') {
    if (!_twilioSipDomain) {
      log(`[Voice] Outbound SIP (Twilio): No Twilio SIP domain available, rejecting`)
      await _telnyxApi.hangupCall(callControlId)
      _bot?.sendMessage(chatId, `🚫 <b>Outbound Call Failed</b>\n📞 ${formatPhone(num.phoneNumber)} → ${formatPhone(destination)}\nReason: Outbound calling is temporarily unavailable. Please try again later.`, { parse_mode: 'HTML' }).catch(() => {})
      return
    }

    // ── CRITICAL: Answer the call first to STOP Telnyx auto-routing ──
    // Without answering, Telnyx simultaneously auto-routes the call via the SIP Connection's
    // outbound voice profile. The auto-routed call uses the wrong caller ID (Telnyx default ANI,
    // not the user's Twilio number), so the callee rejects → call dies → our transfer fails.
    // Answering first establishes the call on Telnyx's side, preventing the auto-route race.
    try {
      await _telnyxApi.answerCall(callControlId)
      log(`[Voice] Outbound SIP (Twilio): Answered call to prevent auto-routing race`)
    } catch (ansErr) {
      // If answer fails (e.g., call already ended), fall back to Twilio direct call
      log(`[Voice] Outbound SIP (Twilio): Answer failed (${ansErr.message}) — will attempt Twilio direct call`)
    }

    log(`[Voice] Outbound SIP (Twilio): Bridging ${num.phoneNumber} → ${destination} via ${_twilioSipDomain}`)

    // Generate unique bridge ID
    const bridgeId = `bridge_${_nanoid ? _nanoid() : Date.now()}`

    // Store bridge context for the Twilio SIP voice handler to pick up
    pendingBridges[bridgeId] = {
      twilioNumber: num.phoneNumber,
      destination,
      chatId,
      num,
      callControlId,
      selfUrl: _selfUrl,
      createdAt: Date.now(),
    }

    // Auto-expire bridge after 60s to prevent memory leaks
    setTimeout(() => { delete pendingBridges[bridgeId] }, 60000)

    // Store session for tracking
    activeCalls[callControlId] = {
      chatId,
      num,
      from: num.phoneNumber,
      to: destination,
      startedAt: new Date(),
      phase: 'outbound_twilio_bridge',
      direction: 'outgoing',
      bridgeId,
    }

    // ── Strategy: Use a valid Telnyx number as 'from' for the SIP transfer ──
    // The user's Twilio number can't be used as 'from' on Telnyx (D51 error).
    // The connection ANI override may also be set to a non-Telnyx number.
    // Solution: Use TELNYX_DEFAULT_ANI (a verified Telnyx number) as 'from'.
    // The Twilio SIP handler (/twilio/sip-voice) will use the correct Twilio
    // number as caller ID for the final PSTN leg.
    const telnyxDefaultAni = process.env.TELNYX_DEFAULT_ANI || ''
    const sipUri = `sip:${bridgeId}@${_twilioSipDomain}`

    // ── FIX: Restore ANI to user's actual number after transfer attempt ──
    // Setting ANI to TELNYX_DEFAULT_ANI causes a problem: if the user retries their SIP call
    // (e.g., after a failed transfer), the auto-routed call arrives with from=TELNYX_DEFAULT_ANI
    // and findNumberBySipUser can't match it to any owner → "No owner found", call rejected.
    // We still use TELNYX_DEFAULT_ANI for the transfer 'from' param, but we restore the
    // connection-level ANI back to the user's number afterward so retries are identifiable.
    const sipConnectionId = process.env.TELNYX_SIP_CONNECTION_ID || ''

    try {
      log(`[Voice] Transferring SIP call to Twilio: ${sipUri} (from=${telnyxDefaultAni || 'none'})`)
      const transferResult = await _telnyxApi.transferCall(callControlId, sipUri, telnyxDefaultAni || undefined)

      if (!transferResult) {
        // Transfer failed (call may already be dead from auto-routing race)
        log(`[Voice] Telnyx transfer returned null — falling back to Twilio direct call`)
        await _attemptTwilioDirectCall(chatId, num, destination, bridgeId, callControlId)
      }
    } catch (e) {
      log(`[Voice] Telnyx→Twilio transfer failed: ${e.message} — falling back to Twilio direct call`)
      await _telnyxApi.hangupCall(callControlId).catch(() => {})
      await _attemptTwilioDirectCall(chatId, num, destination, bridgeId, callControlId)
    }

    // ── Restore connection ANI to user's phone number ──
    // This ensures that if the user retries their SIP call, the auto-routed call
    // will have from=user's number (identifiable by findNumberBySipUser) instead of
    // from=TELNYX_DEFAULT_ANI (which would be rejected as "No owner found").
    if (sipConnectionId && num.phoneNumber) {
      _telnyxApi.updateAniOverride(sipConnectionId, num.phoneNumber).catch(() => {})
    }

    // Notify user
    if (_walletOf) {
      try {
        const { usdBal } = await getBalance(_walletOf, chatId)
        const estMinutes = Math.floor(usdBal / RATE)
        _bot?.sendMessage(chatId, `📞 <b>SIP Outbound Call</b>\nFrom: ${formatPhone(num.phoneNumber)}\nTo: ${formatPhone(destination)}\nRate: $${RATE}/min (~${estMinutes} min available)`, { parse_mode: 'HTML' }).catch(() => {})
      } catch (e) { /* ignore */ }
    }
    return
  }

  // Unknown provider — reject gracefully without trying to answer outbound calls
  log(`[Voice] Outbound SIP: Unknown provider '${num.provider}' for ${num.phoneNumber}`)
  try {
    // Only attempt answer+speak on incoming calls; outbound calls can't be answered
    if (payload.direction === 'incoming') {
      await _telnyxApi.answerCall(callControlId)
      await _telnyxApi.speakOnCall(callControlId, 'Outbound calling is not available for this number.')
      setTimeout(() => _telnyxApi.hangupCall(callControlId), 3000)
    } else {
      log(`[Voice] Outbound SIP: Skipping answer/speak for outbound call (not an incoming SIP call)`)
    }
  } catch (e) {
    log(`[Voice] Reject error: ${e.message}`)
  }
}

// Find a phone number record by SIP username (across all providers)
async function findNumberBySipUser(sipUsername, fromPhone) {
  try {
    const allUsers = await _phoneNumbersOf.find({}).toArray()
    for (const user of allUsers) {
      const numbers = user.val?.numbers || []
      for (const num of numbers) {
        if (num.status !== 'active' && num.status !== 'suspended') continue
        // Match by SIP username (Telnyx gencred or legacy)
        if (num.telnyxSipUsername && num.telnyxSipUsername === sipUsername) {
          return { chatId: user._id, num }
        }
        if (num.sipUsername && num.sipUsername === sipUsername) {
          return { chatId: user._id, num }
        }
        // Match by phone number (in case 'from' is the phone number)
        // Normalize both sides by stripping '+' for comparison
        if (fromPhone) {
          const normalizedFrom = fromPhone.replace(/^\+/, '')
          const normalizedNum = num.phoneNumber?.replace(/[^+\d]/g, '').replace(/^\+/, '')
          if (normalizedFrom === normalizedNum) {
            return { chatId: user._id, num }
          }
        }
      }
    }

    // Fallback: check testCredentials — test SIP users won't be in phoneNumbersOf
    // All test calls route through @hostbay_support's phone number plan
    const TEST_ACCOUNT_CHAT_ID = 5168006768
    const db = _phoneNumbersOf?.s?.db
    if (db) {
      const testCred = await db.collection('testCredentials').findOne({
        sipUsername, expired: { $ne: true }
      })
      if (testCred) {
        log(`[Voice] Found test credential for SIP user ${sipUsername}, chatId=${testCred.chatId} — routing via test account ${TEST_ACCOUNT_CHAT_ID}`)
        // Always use @hostbay_support's phone number for test calls
        const testAccountDoc = await _phoneNumbersOf.findOne({ _id: TEST_ACCOUNT_CHAT_ID })
        const testNumbers = testAccountDoc?.val?.numbers || []
        const testNum = testNumbers.find(n => n.status === 'active')
        if (testNum) {
          return { chatId: testCred.chatId, num: testNum, isTestCall: true }
        }
        log(`[Voice] Test account ${TEST_ACCOUNT_CHAT_ID} has no active number — cannot route test call`)
      }
    }

    return {}
  } catch (e) {
    log(`[Voice] findNumberBySipUser error: ${e.message}`)
    return {}
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CALL ANSWERED — Route based on features
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleCallAnswered(payload) {
  const callControlId = payload.call_control_id
  const session = activeCalls[callControlId]
  if (!session) return

  const { num, chatId, to, from } = session

  // Outbound SIP calls: skip inbound feature routing (IVR, forwarding, voicemail)
  // Just start recording if enabled and update phase
  if (session.direction === 'outgoing' || session.phase === 'outbound_telnyx' || session.phase === 'outbound_twilio_bridge') {
    log(`[Voice] Outbound call answered: ${from} → ${to} (phase: ${session.phase})`)
    if (session.recordingEnabled) {
      log(`[Voice] Starting call recording for outbound ${num.phoneNumber}`)
      await _telnyxApi.startRecording(callControlId, 'single')
      session.isRecording = true
    }
    session.phase = session.phase === 'outbound_telnyx' ? 'outbound_telnyx_active' : session.phase
    return
  }

  // Start recording if Business plan + recording enabled
  if (session.recordingEnabled) {
    log(`[Voice] Starting call recording for ${num.phoneNumber}`)
    await _telnyxApi.startRecording(callControlId, 'single')
    session.isRecording = true
  }

  // Route based on features priority: IVR > Forwarding(always) > Ring SIP Device > Voicemail > Missed Call
  const ivrConfig = num.features?.ivr
  const fwdConfig = num.features?.callForwarding
  const vmConfig = num.features?.voicemail

  // 1. IVR — Business plan only
  if (ivrConfig?.enabled && canAccessFeature(num.plan, 'ivr') && ivrConfig.options && Object.keys(ivrConfig.options).length > 0) {
    session.phase = 'ivr'
    const greeting = ivrConfig.greeting || 'Thank you for calling. Please listen to the following options.'
    log(`[Voice] Starting IVR for ${num.phoneNumber}`)

    await _telnyxApi.gatherDTMF(callControlId, greeting, {
      minDigits: 1,
      maxDigits: 1,
      timeout: 15000,
      validDigits: Object.keys(ivrConfig.options).join(''),
    })
    return
  }

  // 2. Call Forwarding (billed at CALL_FORWARDING_RATE_MIN from wallet)
  if (fwdConfig?.enabled && fwdConfig.forwardTo) {
    // Check wallet balance for forwarding rate
    let forwardingAllowed = false
    if (_walletOf) {
      try {
        const { usdBal } = await getBalance(_walletOf, chatId)
        if (usdBal >= CALL_FORWARDING_RATE_MIN) {
          forwardingAllowed = true
          // Low balance warning
          const estMinutes = Math.floor(usdBal / CALL_FORWARDING_RATE_MIN)
          if (usdBal < 5) {
            _bot?.sendMessage(chatId, `⚠️ <b>Low Balance</b> — $${usdBal.toFixed(2)} (~${estMinutes} min fwd). Top up <b>$25</b> via 👛 Wallet.`, { parse_mode: 'HTML' }).catch(() => {})
          }
        } else {
          log(`[Voice] Forwarding wallet check: $${usdBal} < $${CALL_FORWARDING_RATE_MIN} required — blocking forward`)
          await _telnyxApi.speakOnCall(callControlId, 'Your wallet balance is insufficient for call forwarding. Please top up your wallet.')
          setTimeout(() => _telnyxApi.hangupCall(callControlId), 5000)
          _bot?.sendMessage(chatId, `🚫 <b>Forwarding Blocked</b> — Wallet $${usdBal.toFixed(2)} (need $${CALL_FORWARDING_RATE_MIN}/min).\nTop up <b>$25</b> via 👛 Wallet.`, { parse_mode: 'HTML' }).catch(() => {})
          return
        }
      } catch (e) { log(`[Voice] Forwarding wallet check error: ${e.message}`) }
    }

    session.phase = 'forwarding'
    session.forwardingRate = CALL_FORWARDING_RATE_MIN
    const mode = fwdConfig.mode || 'always'

    if (mode === 'always') {
      const rate = getCallRate(fwdConfig.forwardTo)
      log(`[Voice] Forwarding call to ${fwdConfig.forwardTo} from ${to} (rate: $${rate}/min ${isUSCanada(fwdConfig.forwardTo) ? 'US/CA' : 'Intl'})`)
      await playHoldMusicAndTransfer(callControlId, fwdConfig.forwardTo, to, fwdConfig)
      return
    }
    if (mode === 'no_answer') {
      session.phase = 'ringing'
      session.forwardAfterTimeout = true
      session.forwardingRate = CALL_FORWARDING_RATE_MIN
      const ringTime = (fwdConfig.ringTimeout || 25) * 1000
      setTimeout(async () => {
        const current = activeCalls[callControlId]
        if (current && current.phase === 'ringing') {
          const rate = getCallRate(fwdConfig.forwardTo)
          log(`[Voice] No answer after ${fwdConfig.ringTimeout}s, forwarding to ${fwdConfig.forwardTo} from ${to} (rate: $${rate}/min ${isUSCanada(fwdConfig.forwardTo) ? 'US/CA' : 'Intl'})`)
          current.phase = 'forwarding'
          await playHoldMusicAndTransfer(callControlId, fwdConfig.forwardTo, to, fwdConfig)
        }
      }, ringTime)
      return
    }
  }

  // 3. Ring SIP device — only reached when call was already answered (IVR/fwd-always fallthrough or SIP ring failed in handleCallInitiated)
  // Primary unanswered SIP ring is handled in handleCallInitiated
  if (num.sipUsername && session.phase !== 'ringing_sip') {
    session.phase = 'ringing_sip'
    const sipUser = num.telnyxSipUsername || num.sipUsername
    const sipUri = `sip:${sipUser}@sip.telnyx.com`
    const ringTimeout = fwdConfig?.ringTimeout || 25
    log(`[Voice] Ringing SIP device (answered path): ${sipUri} for ${num.phoneNumber} (timeout: ${ringTimeout}s)`)

    // Play ringback tone to the CALLER while the SIP device rings
    _telnyxApi.playbackStart(callControlId, RINGBACK_URL, { loop: 'infinity' }).catch(e => {
      log(`[Voice] Ringback playback failed: ${e.message}`)
    })

    try {
      // Use Call Control App ID — POST /v2/calls only accepts Call Control Apps, not SIP Connection IDs
      // The SIP device registered on the credential connection is reachable via its SIP URI
      const newCall = await _telnyxApi.createOutboundCall(from, sipUri)
      // Pass original caller's number as 'from' so SIP device shows correct caller ID
      if (newCall?.callControlId) {
        // Track as SIP ring bridge — handleBridgeTransferAnswered/Hangup handles the rest
        activeBridgeTransfers[newCall.callControlId] = {
          originalCallControlId: callControlId,
          forwardTo: sipUri,
          fromNumber: to,
          type: 'sip_ring',
          vmConfig,
          fwdConfig,
          chatId,
          num,
          phase: 'ringing',
        }

        _bot?.sendMessage(chatId,
          `📞 <b>Incoming Call</b>\n${formatPhone(from)} → ${formatPhone(to)}\nRinging your SIP device...`,
          { parse_mode: 'HTML' }
        ).catch(() => {})

        // Timeout: SIP device didn't answer — hang up outbound leg (triggers fallback in handleBridgeTransferHangup)
        setTimeout(async () => {
          const transfer = activeBridgeTransfers[newCall.callControlId]
          if (transfer && transfer.phase !== 'bridged') {
            log(`[Voice] SIP ring timeout: device didn't answer in ${ringTimeout}s — falling through`)
            await _telnyxApi.hangupCall(newCall.callControlId).catch(() => {})
            // handleBridgeTransferHangup will handle voicemail/forwarding/missed fallback
          }
        }, ringTimeout * 1000)
        return
      }
    } catch (e) {
      log(`[Voice] Failed to ring SIP device: ${e.message} — falling through to voicemail/missed`)
    }
    // If we get here, SIP ring failed — fall through to voicemail/missed below
  }

  // 4. Voicemail — Pro/Business (also counts toward minutes)
  if (vmConfig?.enabled && canAccessFeature(num.plan, 'voicemail')) {
    session.phase = 'voicemail_greeting'
    
    // Check for custom audio greeting first
    if (vmConfig.greetingType === 'custom' && vmConfig.customAudioGreetingUrl) {
      try {
        const axios = require('axios')
        await axios.post(`https://api.telnyx.com/v2/calls/${callControlId}/actions/playback_start`, {
          audio_url: vmConfig.customAudioGreetingUrl,
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
            'Content-Type': 'application/json',
          }
        })
      } catch (e) {
        log(`[Voice] Custom audio playback failed, falling back to TTS: ${e.message}`)
        const fallback = vmConfig.customGreetingText || `The person at ${formatPhone(num.phoneNumber)} is unavailable. Please leave a message after the tone.`
        await _telnyxApi.speakOnCall(callControlId, fallback)
      }
      return
    }
    
    const greeting = vmConfig.greetingType === 'custom' && vmConfig.customGreetingText
      ? vmConfig.customGreetingText
      : `The person at ${formatPhone(num.phoneNumber)} is unavailable. Please leave a message after the tone.`
    await _telnyxApi.speakOnCall(callControlId, greeting)
    return
  }

  // 5. No features / no SIP device — notify missed call and hang up
  session.phase = 'missed'
  await _telnyxApi.speakOnCall(callControlId, 'This number is currently unavailable. Please try again later.')
  setTimeout(async () => {
    await _telnyxApi.hangupCall(callControlId)
  }, 5000)

  notifyUser(chatId, num, 'missed', session)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GATHER ENDED — IVR DTMF selection
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleGatherEnded(payload) {
  const callControlId = payload.call_control_id
  const session = activeCalls[callControlId]
  if (!session) return

  const digits = payload.digits || ''
  const { num, chatId } = session
  const ivrConfig = num.features?.ivr

  log(`[Voice] DTMF received: "${digits}" for ${num.phoneNumber}`)

  // Track IVR analytics
  trackIvrAnalytics(num.phoneNumber, chatId, session.from, digits, ivrConfig?.options?.[digits]?.action || 'invalid')

  if (!digits || !ivrConfig?.options?.[digits]) {
    if (!session.ivrRetried) {
      session.ivrRetried = true
      await _telnyxApi.gatherDTMF(callControlId, 'Sorry, that was not a valid option. Please try again.', {
        minDigits: 1,
        maxDigits: 1,
        timeout: 10000,
        validDigits: Object.keys(ivrConfig?.options || {}).join('') || '0123456789',
      })
    } else {
      await _telnyxApi.speakOnCall(callControlId, 'Goodbye.')
      setTimeout(() => _telnyxApi.hangupCall(callControlId), 2000)
    }
    return
  }

  const option = ivrConfig.options[digits]

  switch (option.action) {
    case 'forward': {
      const ivrFwdRate = getCallRate(option.forwardTo)
      // ── Wallet check before IVR forward (same pattern as regular call forwarding) ──
      if (_walletOf) {
        try {
          const { usdBal } = await getBalance(_walletOf, chatId)
          if (usdBal < ivrFwdRate) {
            log(`[Voice] IVR forward blocked: wallet $${usdBal} < $${ivrFwdRate}/min for ${option.forwardTo}`)
            await _telnyxApi.speakOnCall(callControlId, 'Your wallet balance is insufficient for call forwarding. Please top up your wallet.')
            setTimeout(() => _telnyxApi.hangupCall(callControlId), 5000)
            _bot?.sendMessage(chatId, `🚫 <b>IVR Forward Blocked — Wallet Empty</b>\n\n📞 ${formatPhone(num.phoneNumber)}\n📲 Forward to: ${formatPhone(option.forwardTo)}\n\nWallet $${usdBal.toFixed(2)} (need $${ivrFwdRate}/min ${isUSCanada(option.forwardTo) ? 'US/CA' : 'Intl'}).\nTop up via 👛 Wallet.`, { parse_mode: 'HTML' }).catch(() => {})
            break
          }
          // Low balance warning
          const estMinutes = Math.floor(usdBal / ivrFwdRate)
          if (usdBal < 5) {
            _bot?.sendMessage(chatId, `⚠️ <b>Low Balance</b> — $${usdBal.toFixed(2)} (~${estMinutes} min IVR fwd). Top up via 👛 Wallet.`, { parse_mode: 'HTML' }).catch(() => {})
          }
        } catch (e) { log(`[Voice] IVR forward wallet check error: ${e.message}`) }
      }
      session.phase = 'ivr_forward'
      log(`[Voice] IVR: forwarding to ${option.forwardTo} from ${session.to} (rate: $${ivrFwdRate}/min ${isUSCanada(option.forwardTo) ? 'US/CA' : 'Intl'})`)
      await playHoldMusicAndTransfer(callControlId, option.forwardTo, session.to, num.features?.callForwarding || {})
      notifyUser(chatId, num, 'ivr_forward', session, { digit: digits, forwardTo: option.forwardTo })
      break
    }

    case 'voicemail':
      session.phase = 'voicemail_greeting'
      await _telnyxApi.speakOnCall(callControlId, 'Please leave a message after the tone.')
      break

    case 'message':
      session.phase = 'ivr_message'
      await _telnyxApi.speakOnCall(callControlId, option.message || 'Thank you for calling.')
      setTimeout(() => _telnyxApi.hangupCall(callControlId), 8000)
      notifyUser(chatId, num, 'ivr_message', session, { digit: digits, message: option.message })
      break

    default:
      await _telnyxApi.speakOnCall(callControlId, 'Goodbye.')
      setTimeout(() => _telnyxApi.hangupCall(callControlId), 2000)
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SPEAK ENDED — After IVR/Voicemail greeting
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleSpeakEnded(payload) {
  const callControlId = payload.call_control_id

  // Check if there's a pending hold-music transfer waiting for this speak to end
  const pending = pendingHoldTransfers[callControlId]
  if (pending) {
    delete pendingHoldTransfers[callControlId]
    log(`[Voice] Hold announcement done for ${callControlId}, starting hold music + dialing ${pending.forwardTo}`)

    // Phase 2: Start hold music on the ORIGINAL call leg (caller hears music)
    await _telnyxApi.playbackStart(callControlId, HOLD_MUSIC_URL, { loop: 'infinity' })

    // Let caller hear 5 seconds of hold music before dialing the transfer destination
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Phase 2b: Create new outbound call to the transfer destination
    const newCall = await _telnyxApi.createOutboundCall(pending.fromNumber, pending.forwardTo)
    if (newCall?.callControlId) {
      activeBridgeTransfers[newCall.callControlId] = {
        originalCallControlId: callControlId,
        forwardTo: pending.forwardTo,
        fromNumber: pending.fromNumber,
      }
      log(`[Voice] Bridge transfer: dialing ${pending.forwardTo} (new leg: ${newCall.callControlId}), hold music on ${callControlId}`)

      // Timeout: if transfer destination doesn't answer in 30s, cancel and hang up
      setTimeout(async () => {
        const transfer = activeBridgeTransfers[newCall.callControlId]
        if (transfer && transfer.phase !== 'bridged') {
          log(`[Voice] Bridge transfer timeout: ${pending.forwardTo} didn't answer in 30s`)
          await _telnyxApi.hangupCall(newCall.callControlId).catch(() => {})
          // handleBridgeTransferHangup will clean up the original leg
        }
      }, 30000)
    } else {
      // Failed to create outbound call — fall back to regular transfer with tracking
      log(`[Voice] Failed to create outbound call to ${pending.forwardTo}, falling back to transfer`)
      await _telnyxApi.playbackStop(callControlId)
      // Track the fallback transfer for no-answer detection
      pendingNativeTransfers[callControlId] = {
        forwardTo: pending.forwardTo,
        fromNumber: pending.fromNumber,
        initiatedAt: Date.now(),
        connected: false,
      }
      const fallbackTimeout = setTimeout(() => {
        const transfer = pendingNativeTransfers[callControlId]
        if (transfer && !transfer.connected) {
          transfer.timedOut = true
          log(`[Voice] Fallback transfer timeout: ${pending.forwardTo} didn't answer in 35s`)
        }
      }, 35000)
      pendingNativeTransfers[callControlId]._timeout = fallbackTimeout
      await _telnyxApi.transferCall(callControlId, pending.forwardTo, pending.fromNumber)
    }
    return
  }

  const session = activeCalls[callControlId]
  if (!session) return

  if (session.phase === 'voicemail_greeting') {
    session.phase = 'voicemail_recording'
    log(`[Voice] Starting voicemail recording for ${session.num.phoneNumber}`)
    await _telnyxApi.startRecording(callControlId, 'single')

    setTimeout(async () => {
      const current = activeCalls[callControlId]
      if (current && current.phase === 'voicemail_recording') {
        await _telnyxApi.stopRecording(callControlId)
        await _telnyxApi.hangupCall(callControlId)
      }
    }, 60000)
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RECORDING SAVED — Deliver voicemail / call recording
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleRecordingSaved(payload) {
  const callControlId = payload.call_control_id
  const session = activeCalls[callControlId]
  if (!session) return

  const recordingUrl = payload.recording_urls?.mp3 || payload.public_recording_urls?.mp3 || payload.recording_urls?.wav
  const duration = payload.duration_secs || 0
  const { chatId, num, from, to } = session
  const time = new Date().toLocaleString()

  if (session.phase === 'voicemail_recording') {
    log(`[Voice] Voicemail saved for ${to} from ${from}: ${recordingUrl}`)

    if (num.features?.voicemail?.forwardToTelegram && recordingUrl) {
      const caption = `🎙️ <b>New Voicemail</b>\n\n📞 To: ${formatPhone(to)}\n👤 From: ${formatPhone(from)}\n⏱️ Duration: ${formatDuration(duration)}\n🕐 ${time}`
      try {
        await _bot.sendAudio(chatId, recordingUrl, { caption, parse_mode: 'HTML' })
      } catch (e) {
        log(`[Voice] Failed to send voicemail audio: ${e.message}`)
        _bot.sendMessage(chatId, caption + `\n\n🔗 <a href="${recordingUrl}">Listen</a>`, { parse_mode: 'HTML' }).catch(() => {})
      }
    }

    logEvent(to, from, 'voicemail', duration, recordingUrl)
    return
  }

  if (session.isRecording && recordingUrl) {
    log(`[Voice] Call recording saved for ${to} from ${from}: ${recordingUrl}`)
    const caption = `🔴 <b>Call Recording</b>\n\n📞 To: ${formatPhone(to)}\n👤 From: ${formatPhone(from)}\n⏱️ Duration: ${formatDuration(duration)}\n🕐 ${time}`
    try {
      await _bot.sendAudio(chatId, recordingUrl, { caption, parse_mode: 'HTML' })
    } catch (e) {
      log(`[Voice] Failed to send recording audio: ${e.message}`)
      _bot.sendMessage(chatId, caption + `\n\n🔗 <a href="${recordingUrl}">Listen</a>`, { parse_mode: 'HTML' }).catch(() => {})
    }

    logEvent(to, from, 'call_recording', duration, recordingUrl)
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CALL HANGUP — Cleanup + REAL-TIME minute tracking
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleCallHangup(payload) {
  const callControlId = payload.call_control_id
  const hangupCauseRaw = payload.hangup_cause || payload.sip_hangup_cause || 'unknown'
  const hangupSourceRaw = payload.hangup_source || 'unknown'
  
  const session = activeCalls[callControlId]
  if (!session) {
    // Log hangup details even for untracked calls (helps debug SIP failures)
    log(`[Voice] Hangup for untracked call ${callControlId}: cause=${hangupCauseRaw}, source=${hangupSourceRaw}, from=${payload.from}, to=${payload.to}, duration=${payload.duration_secs || 0}s`)
    return
  }

  // ── CLEANUP SIP RING LEG ──
  // If the inbound caller hangs up while SIP device is still ringing,
  // we must hang up the outbound SIP ring leg so the WebRTC client stops ringing
  if (session.sipRingCallControlId) {
    const sipRingTransfer = activeBridgeTransfers[session.sipRingCallControlId]
    if (sipRingTransfer && sipRingTransfer.phase !== 'bridged') {
      log(`[Voice] Caller hung up during SIP ring — hanging up SIP ring leg ${session.sipRingCallControlId}`)
      await _telnyxApi.hangupCall(session.sipRingCallControlId).catch(() => {})
      delete activeBridgeTransfers[session.sipRingCallControlId]
    }
  }

  // Prevent duplicate hangup processing (Telnyx can fire multiple hangup events for transferred calls)
  if (session._hangupProcessed) return
  session._hangupProcessed = true

  const payloadDuration = payload.duration_secs || 0
  // Telnyx doesn't always include duration_secs for credential connection calls
  // Calculate from session start time as fallback
  const duration = payloadDuration > 0 ? payloadDuration : Math.floor((Date.now() - session.startedAt.getTime()) / 1000)
  const hangupCause = payload.hangup_cause || payload.sip_hangup_cause || 'unknown'
  const hangupSource = payload.hangup_source || 'unknown'
  const { chatId, num, from, to } = session
  const time = new Date().toLocaleString()

  // Log hangup details for all calls (helps diagnose outbound drops)
  const isOutbound = session.direction === 'outgoing'
  if (isOutbound) {
    log(`[Voice] Outbound call hangup: ${from} → ${to}, duration=${duration}s, cause=${hangupCause}, source=${hangupSource}`)
  }

  // ── UNIFIED BILLING: plan minutes → overage at destination-based rate ──
  const minutesBilled = duration > 0 ? Math.ceil(duration / 60) : 0
  const isForwarded = session.phase === 'forwarding' || session.phase === 'ivr_forward'

  // Skip billing for Twilio bridge legs — Twilio handles billing via /twilio/voice-status
  const isTwilioBridge = session.phase === 'outbound_twilio_bridge'

  // Determine destination for rate calculation
  const destination = isForwarded
    ? (num.features?.callForwarding?.forwardTo || from)
    : isOutbound ? to : from

  let billingInfo = { planMinUsed: 0, overageMin: 0, overageCharge: 0, rate: 0, used: 0, limit: 0 }
  if (minutesBilled > 0 && !isTwilioBridge && !session.isTestCall) {
    const callType = isForwarded ? 'Forwarding' : isOutbound ? 'SIPOutbound' : 'Inbound'
    billingInfo = await billCallMinutesUnified(chatId, num.phoneNumber, minutesBilled, destination, callType)
  } else if (isTwilioBridge) {
    log(`[Voice] Skipping Telnyx-side billing for Twilio bridge leg (${duration}s) — Twilio /voice-status handles billing`)
  } else if (session.isTestCall) {
    log(`[Voice] Skipping billing for test call (${duration}s) — free test call`)
  }

  // Clean up mid-call limit timer
  if (session._limitTimer) {
    clearInterval(session._limitTimer)
  }

  // Build plan usage line for notifications
  const remaining = billingInfo.limit > 0 ? Math.max(0, billingInfo.limit - billingInfo.used) : null
  const planLine = remaining !== null
    ? `📊 ${minutesBilled} min deducted · <b>${remaining}/${billingInfo.limit}</b> min remaining`
    : `📊 ${minutesBilled} min used`

  // Notify based on phase
  if (isForwarded) {
    const forwardTo = num.features?.callForwarding?.forwardTo || 'unknown'
    // Check if the forward/transfer actually connected
    const nativeTransfer = pendingNativeTransfers[callControlId]
    const transferConnected = nativeTransfer ? nativeTransfer.connected : (session.phase === 'bridged')
    if (nativeTransfer) {
      if (nativeTransfer._timeout) clearTimeout(nativeTransfer._timeout)
      delete pendingNativeTransfers[callControlId]
    }

    if (transferConnected) {
      const msg = `📞 <b>Call Forwarded</b>\n\n📞 ${formatPhone(to)} → 📲 ${formatPhone(forwardTo)}\n👤 ${formatPhone(from)}\n⏱️ ${formatDuration(duration)}\n${planLine}\n🕐 ${time}`
      _bot.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(() => {})
    } else {
      const msg = `❌ <b>Forward Failed — No Answer</b>\n\n📞 ${formatPhone(to)} → 📲 ${formatPhone(forwardTo)}\n👤 Caller: ${formatPhone(from)}\n📲 ${formatPhone(forwardTo)} didn't answer\n🕐 ${time}`
      _bot.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(() => {})
    }
    logEvent(to, from, transferConnected ? 'forwarded' : 'forward_failed', duration)
  } else if (isOutbound) {
    // Check if there was a native transfer that failed to connect (SIP → Twilio bridge)
    const nativeTransfer = pendingNativeTransfers[callControlId]
    if (nativeTransfer) {
      if (nativeTransfer._timeout) clearTimeout(nativeTransfer._timeout)
      if (!nativeTransfer.connected) {
        const msg = `❌ <b>SIP Call Failed — Transfer No Answer</b>\n\n📞 From: ${formatPhone(from)}\n📲 To: ${formatPhone(to)}\n📲 Transfer to ${formatPhone(nativeTransfer.forwardTo)} didn't connect\n🕐 ${time}`
        _bot?.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(() => {})
      } else {
        const msg = `📞 <b>SIP Call Ended</b>\n\n📞 From: ${formatPhone(from)}\n📲 To: ${formatPhone(to)}\n⏱️ ${formatDuration(duration)}\n${planLine}\n🕐 ${time}`
        _bot?.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(() => {})
      }
      delete pendingNativeTransfers[callControlId]
    } else if (session.isTestCall) {
      const msg = `📞 <b>Free Test Call Ended</b>\n\n📞 From: ${formatPhone(from)}\n📲 To: ${formatPhone(to)}\n⏱️ ${formatDuration(duration)}\n🆓 Free test call — no charges\n🕐 ${time}`
      _bot?.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(() => {})
    } else {
      const hangupInfo = hangupCause !== 'unknown' ? `\n🔍 Cause: ${hangupCause}` : ''
      const msg = `📞 <b>SIP Call Ended</b>\n\n📞 From: ${formatPhone(from)}\n📲 To: ${formatPhone(to)}\n⏱️ ${formatDuration(duration)}\n${planLine}${hangupInfo}\n🕐 ${time}`
      _bot?.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(() => {})
    }
    logEvent(from, to, 'outbound_sip', duration)
  } else if (session.phase === 'missed' || session.phase === 'answering') {
    const msg = `📞 <b>Missed Call</b>\n\n📞 To: ${formatPhone(to)}\n👤 From: ${formatPhone(from)}\n🕐 ${time}`
    _bot.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(() => {})
    logEvent(to, from, 'missed', 0)
  }

  // Cleanup any bridge transfer legs tied to this call (e.g., caller hung up during hold music)
  for (const [transferLegId, transfer] of Object.entries(activeBridgeTransfers)) {
    if (transfer.originalCallControlId === callControlId) {
      log(`[Voice] Inbound leg hung up — cancelling bridge transfer leg ${transferLegId} to ${transfer.forwardTo}`)
      await _telnyxApi.hangupCall(transferLegId).catch(() => {})
      delete activeBridgeTransfers[transferLegId]
    }
  }

  // Cleanup any pending hold transfers that never completed
  delete pendingHoldTransfers[callControlId]

  // Cleanup any pending native transfers
  const remainingNativeTransfer = pendingNativeTransfers[callControlId]
  if (remainingNativeTransfer) {
    if (remainingNativeTransfer._timeout) clearTimeout(remainingNativeTransfer._timeout)
    delete pendingNativeTransfers[callControlId]
  }

  // Cleanup
  delete activeCalls[callControlId]
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function findNumberOwner(phoneNumber) {
  try {
    const clean = phoneNumber.replace(/[^+\d]/g, '')
    const allUsers = await _phoneNumbersOf.find({}).toArray()
    for (const user of allUsers) {
      const numbers = user.val?.numbers || []
      for (const num of numbers) {
        if (num.phoneNumber?.replace(/[^+\d]/g, '') === clean && (num.status === 'active' || num.status === 'suspended')) {
          return { chatId: user._id, num }
        }
      }
    }
    return {}
  } catch (e) {
    log(`[Voice] findNumberOwner error: ${e.message}`)
    return {}
  }
}

function notifyUser(chatId, num, type, session, extra = {}) {
  const time = new Date().toLocaleString()
  let msg = ''
  if (type === 'missed') {
    msg = `📞 <b>Missed Call</b>\n\n📞 To: ${formatPhone(session.to)}\n👤 From: ${formatPhone(session.from)}\n🕐 ${time}`
  } else if (type === 'ivr_forward') {
    msg = `📞 <b>IVR Call Routed</b>\n\n📞 To: ${formatPhone(session.to)}\n👤 From: ${formatPhone(session.from)}\nPressed: <b>${extra.digit}</b> → Forwarded to ${formatPhone(extra.forwardTo)}\n🕐 ${time}`
  } else if (type === 'ivr_message') {
    msg = `📞 <b>IVR Call</b>\n\n📞 To: ${formatPhone(session.to)}\n👤 From: ${formatPhone(session.from)}\nPressed: <b>${extra.digit}</b> → Played message\n🕐 ${time}`
  }
  if (msg) _bot.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(() => {})
}

function logEvent(to, from, type, duration, recordingUrl) {
  if (!_phoneLogs) return
  _phoneLogs.insertOne({
    phoneNumber: to,
    from,
    type,
    duration: duration || 0,
    recordingUrl: recordingUrl || null,
    timestamp: new Date().toISOString(),
  }).catch(e => log(`[Voice] Log error: ${e.message}`))
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IVR ANALYTICS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function trackIvrAnalytics(phoneNumber, chatId, callerFrom, digit, action) {
  if (!_ivrAnalytics) return
  _ivrAnalytics.insertOne({
    phoneNumber,
    chatId,
    callerFrom,
    digit,
    action,
    timestamp: new Date().toISOString(),
  }).catch(e => log(`[Voice] IVR analytics log error: ${e.message}`))
}

async function getIvrAnalytics(phoneNumber, days = 30) {
  if (!_ivrAnalytics) return { totalCalls: 0, optionBreakdown: [], topOption: null, recentCalls: [] }
  try {
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString()

    const all = await _ivrAnalytics.find({
      phoneNumber,
      timestamp: { $gte: sinceStr },
    }).sort({ timestamp: -1 }).toArray()

    const totalCalls = all.length

    const digitCounts = {}
    for (const entry of all) {
      const d = entry.digit || '?'
      digitCounts[d] = (digitCounts[d] || 0) + 1
    }

    const optionBreakdown = Object.entries(digitCounts)
      .map(([digit, count]) => ({ digit, count, percent: totalCalls > 0 ? Math.round((count / totalCalls) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)

    const topOption = optionBreakdown.length > 0 ? optionBreakdown[0] : null

    const recentCalls = all.slice(0, 5).map(e => ({
      from: e.callerFrom,
      digit: e.digit,
      action: e.action,
      time: e.timestamp,
    }))

    return { totalCalls, optionBreakdown, topOption, recentCalls }
  } catch (e) {
    log(`[Voice] IVR analytics query error: ${e.message}`)
    return { totalCalls: 0, optionBreakdown: [], topOption: null, recentCalls: [] }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OUTBOUND IVR CALL — Place automated IVR calls
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ivrOutbound = require('./ivr-outbound.js')

/**
 * Initiate an outbound IVR call via Telnyx
 * @param {object} params - Call parameters from bot flow
 * @returns {{ callControlId, error }}
 */
async function initiateOutboundIvrCall(params) {
  const { chatId, callerId, targetNumber, ivrNumber, audioUrl, activeKeys, templateName, placeholderValues, voiceName, isTrial, holdMusic, campaignId, leadIndex, bulkMode } = params

  // ── Wallet balance check (skip for trial calls) ──
  // Outbound IVR always charges wallet at flat IVR rate (plan minutes are for inbound only)
  if (!isTrial && _walletOf) {
    try {
      const { chatId: ownerId } = await findNumberOwner(callerId)
      if (ownerId) {
        const { usdBal } = await getBalance(_walletOf, ownerId)
        if (usdBal < IVR_CALL_RATE) {
          return { error: `Insufficient wallet balance ($${usdBal.toFixed(2)}). Quick IVR calls cost $${IVR_CALL_RATE.toFixed(2)}/min from wallet. Top up your wallet.` }
        }
        log(`[OutboundIVR] Wallet check passed: $${usdBal.toFixed(2)} (IVR rate: $${IVR_CALL_RATE}/min)`)
      }
    } catch (e) {
      log(`[OutboundIVR] Wallet check error: ${e.message}`)
    }
  }

  // ── TWILIO PATH: Use Twilio REST API + TwiML endpoints ──
  const provider = params.provider || 'telnyx'
  if (provider === 'twilio' && _twilioService) {
    // ── TRIAL CALLS: Use main Twilio account (trial number lives on main account) ──
    if (isTrial) {
      log(`[OutboundIVR] Trial call via Twilio main account: ${callerId} → ${targetNumber}`)
      const crypto = require('crypto')
      const sessionId = crypto.randomUUID()
      twilioIvrSessions[sessionId] = {
        chatId,
        callerId,
        targetNumber,
        ivrNumber,
        audioUrl,
        activeKeys: activeKeys || ['1'],
        templateName: templateName || 'Custom',
        placeholderValues: placeholderValues || {},
        voiceName: voiceName || 'Rachel',
        isTrial: true,
        holdMusic: holdMusic || false,
        bulkMode: null,
        campaignId: null,
        leadIndex: null,
        phase: 'initiated',
        digitPressed: null,
        startTime: Date.now(),
      }

      const twimlUrl = `${_selfUrl}/twilio/single-ivr?sessionId=${encodeURIComponent(sessionId)}`
      const statusUrl = `${_selfUrl}/twilio/single-ivr-status?sessionId=${encodeURIComponent(sessionId)}`

      const result = await _twilioService.makeTrialOutboundCall(
        callerId, targetNumber, twimlUrl,
        {
          statusCallback: statusUrl,
          statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
          timeout: 30,
        }
      )

      if (result.error) {
        delete twilioIvrSessions[sessionId]
        return { error: result.error }
      }

      twilioIvrSessions[sessionId].callSid = result.callSid
      log(`[OutboundIVR] Trial Twilio call initiated: ${result.callSid} ${callerId} → ${targetNumber} (sessionId: ${sessionId})`)
      return { callSid: result.callSid, sessionId, provider: 'twilio' }
    }

    // ━━━ SECURITY: Block non-trial Twilio calls without sub-account credentials ━━━
    if (!params.twilioSubAccountSid || !params.twilioSubAccountToken) {
      log(`[OutboundIVR] SECURITY BLOCK: Twilio call rejected — missing sub-account credentials for chatId ${chatId}`)
      return { error: 'Twilio calls require sub-account credentials. Cannot use main account.' }
    }
    const crypto = require('crypto')
    const sessionId = crypto.randomUUID()
    twilioIvrSessions[sessionId] = {
      chatId,
      callerId,
      targetNumber,
      ivrNumber,
      audioUrl,
      activeKeys: activeKeys || ['1'],
      templateName: templateName || 'Custom',
      placeholderValues: placeholderValues || {},
      voiceName: voiceName || 'Rachel',
      isTrial: isTrial || false,
      holdMusic: holdMusic || false,
      bulkMode: bulkMode || null,
      campaignId: campaignId || null,
      leadIndex: leadIndex != null ? leadIndex : null,
      phase: 'initiated',
      digitPressed: null,
      startTime: Date.now(),
    }

    const twimlUrl = `${_selfUrl}/twilio/single-ivr?sessionId=${encodeURIComponent(sessionId)}`
    const statusUrl = `${_selfUrl}/twilio/single-ivr-status?sessionId=${encodeURIComponent(sessionId)}`

    const result = await _twilioService.makeOutboundCall(
      callerId, targetNumber, twimlUrl,
      params.twilioSubAccountSid || null,
      params.twilioSubAccountToken || null,
      {
        statusCallback: statusUrl,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        timeout: 30,
      }
    )

    if (result.error) {
      delete twilioIvrSessions[sessionId]
      return { error: result.error }
    }

    twilioIvrSessions[sessionId].callSid = result.callSid
    log(`[OutboundIVR] Twilio call initiated: ${result.callSid} ${callerId} → ${targetNumber} (sessionId: ${sessionId})`)
    return { callSid: result.callSid, sessionId, provider: 'twilio' }
  }

  // ── TELNYX PATH (default): Use Telnyx Call Control API ──
  const webhookUrl = `${_selfUrl}/telnyx/voice-webhook`
  const result = await _telnyxApi.createOutboundCall(callerId, targetNumber, webhookUrl)

  if (result.error) {
    return { error: result.error }
  }

  // Store outbound IVR session
  outboundIvrCalls[result.callControlId] = {
    chatId,
    callerId,
    targetNumber,
    ivrNumber,
    audioUrl,
    activeKeys: activeKeys || ['1'],
    templateName: templateName || 'Custom',
    placeholderValues: placeholderValues || {},
    voiceName: voiceName || 'Rachel',
    isTrial: isTrial || false,
    holdMusic: holdMusic || false,
    phase: 'initiated',
    digitPressed: null,
    startTime: Date.now(),
    // Bulk campaign fields
    campaignId: campaignId || null,
    leadIndex: leadIndex != null ? leadIndex : null,
    bulkMode: bulkMode || null, // 'transfer' | 'report_only'
  }

  log(`[OutboundIVR] Call initiated: ${callerId} → ${targetNumber} (chatId: ${chatId}, template: ${templateName})`)
  return { callControlId: result.callControlId }
}

/**
 * Handle outbound IVR: call.initiated
 */
function handleOutboundIvrInitiated(payload) {
  const callControlId = payload.call_control_id
  const session = outboundIvrCalls[callControlId]
  if (!session) return false

  session.phase = 'ringing'
  log(`[OutboundIVR] Ringing: ${session.targetNumber}`)
  return true
}

/**
 * Handle outbound IVR: call.answered — play audio + gather DTMF
 * NOTE: Do NOT notify the bot user here — "answered" can be voicemail
 * or the target may hang up immediately. We only notify on final outcome (hangup).
 */
async function handleOutboundIvrAnswered(payload) {
  const callControlId = payload.call_control_id
  const session = outboundIvrCalls[callControlId]
  if (!session) return false

  session.phase = 'playing'
  session.answerTime = Date.now()
  log(`[OutboundIVR] Answered: ${session.targetNumber} — playing IVR audio`)

  // ── MID-CALL WALLET MONITOR for outbound IVR ──
  // Outbound IVR charges wallet at flat IVR rate (plan minutes are for inbound only)
  if (!session.isTrial) {
    try {
      const { chatId: ownerId } = await findNumberOwner(session.callerId)
      if (ownerId) {
        session._limitTimer = setInterval(async () => {
          const sess = outboundIvrCalls[callControlId]
          if (!sess) { clearInterval(session._limitTimer); return }
          if (_walletOf) {
            try {
              const { usdBal } = await getBalance(_walletOf, ownerId)
              if (usdBal < IVR_CALL_RATE) {
                log(`[OutboundIVR] Mid-call wallet exhausted: $${usdBal.toFixed(2)} < $${IVR_CALL_RATE}/min. Disconnecting.`)
                clearInterval(session._limitTimer)
                await _telnyxApi.hangupCall(callControlId).catch(() => {})
                _bot?.sendMessage(session.chatId, `🚫 <b>IVR Call Ended</b> — Wallet exhausted ($${usdBal.toFixed(2)}).\nIVR calls cost $${IVR_CALL_RATE}/min. Top up via 👛 Wallet.`, { parse_mode: 'HTML' }).catch(() => {})
              }
            } catch (e) { log(`[OutboundIVR] Mid-call wallet check error: ${e.message}`) }
          }
        }, 60000)
      }
    } catch (e) { log(`[OutboundIVR] Limit monitor setup error: ${e.message}`) }
  }

  // Play audio and gather DTMF
  const validDigits = session.activeKeys.join('')
  if (session.audioUrl) {
    await _telnyxApi.gatherDTMFWithAudio(callControlId, session.audioUrl, {
      minDigits: 1,
      maxDigits: 1,
      timeout: 20000,
      validDigits: validDigits || '0123456789',
    })
  } else {
    // Fallback to TTS if no audio URL
    await _telnyxApi.gatherDTMF(callControlId, 'Thank you for your time. Goodbye.', {
      minDigits: 1,
      maxDigits: 1,
      timeout: 15000,
    })
  }
  return true
}

/**
 * Handle outbound IVR: call.gather.ended — transfer on valid key
 */
async function handleOutboundIvrGatherEnded(payload) {
  const callControlId = payload.call_control_id
  const session = outboundIvrCalls[callControlId]
  if (!session) return false

  const digits = payload.digits || ''
  log(`[OutboundIVR] DTMF received: "${digits}" for ${session.targetNumber}`)

  if (digits && session.activeKeys.includes(digits)) {
    session.phase = 'transferring'
    session.digitPressed = digits

    // Bulk campaign: report-only mode — log digit, say goodbye, hang up (NO transfer)
    if (session.bulkMode === 'report_only') {
      log(`[OutboundIVR] Bulk report-only: ${session.targetNumber} pressed ${digits} — no transfer`)
      session.phase = 'completed'
      // Don't notify per-call for bulk (bulk service sends its own progress)
      if (!session.campaignId) {
        _bot?.sendMessage(session.chatId, ivrOutbound.formatCallNotification('key_pressed', {
          ...session, digit: digits,
        }), { parse_mode: 'HTML' }).catch(() => {})
      }
      await _telnyxApi.speakOnCall(callControlId, 'Thank you. Goodbye.')
      setTimeout(() => _telnyxApi.hangupCall(callControlId), 2000)
      return true
    }

    // Normal or bulk transfer mode — notify + transfer
    if (!session.campaignId) {
      _bot?.sendMessage(session.chatId, ivrOutbound.formatCallNotification('key_pressed', {
        ...session, digit: digits,
      }), { parse_mode: 'HTML' }).catch(() => {})
    }

    // Register pending transfer so we can recognize the new call leg
    // Telnyx creates a new outbound call to ivrNumber with a different callControlId
    session._pendingTransferTo = session.ivrNumber
    session._pendingTransferFrom = session.callerId

    // Transfer to IVR number — use session's holdMusic flag
    await playHoldMusicAndTransfer(callControlId, session.ivrNumber, session.callerId, { holdMusic: session.holdMusic })
    log(`[OutboundIVR] Transferring to ${session.ivrNumber}${session.holdMusic ? ' (with hold music)' : ''}`)
  } else if (!session.ivrRetried) {
    // No valid key — replay audio once
    session.ivrRetried = true
    if (session.audioUrl) {
      await _telnyxApi.gatherDTMFWithAudio(callControlId, session.audioUrl, {
        minDigits: 1,
        maxDigits: 1,
        timeout: 15000,
        validDigits: session.activeKeys.join('') || '0123456789',
      })
    } else {
      await _telnyxApi.speakOnCall(callControlId, 'Goodbye.')
      setTimeout(() => _telnyxApi.hangupCall(callControlId), 2000)
    }
  } else {
    // Already retried — hang up
    await _telnyxApi.speakOnCall(callControlId, 'Goodbye.')
    setTimeout(() => _telnyxApi.hangupCall(callControlId), 2000)
  }
  return true
}

/**
 * Handle outbound IVR: call.hangup — bill + notify bot user
 * This is the ORIGINAL LEG (callerId → targetNumber)
 * Billed via unified billing: plan minutes first → overage at destination-based rate
 */
async function handleOutboundIvrHangup(payload) {
  const callControlId = payload.call_control_id
  const session = outboundIvrCalls[callControlId]
  if (!session) return false

  // Clean up mid-call limit timer
  if (session._limitTimer) clearInterval(session._limitTimer)

  // Use tracked answerTime for accurate duration (Telnyx reports 0 for bridged/transferred calls)
  const telnyxDuration = payload.duration_secs || 0
  const trackedDuration = session.answerTime ? Math.round((Date.now() - session.answerTime) / 1000) : 0
  const duration = telnyxDuration > 0 ? telnyxDuration : trackedDuration
  const hangupCause = payload.hangup_cause || 'unknown'
  // Quick IVR: minimum 1 minute charge regardless of outcome (busy, no answer, etc.)
  const minutesBilled = Math.max(1, duration > 0 ? Math.ceil(duration / 60) : 1)
  log(`[OutboundIVR] Hangup: ${session.targetNumber} (${duration}s [telnyx=${telnyxDuration}s, tracked=${trackedDuration}s], ${minutesBilled} min, cause: ${hangupCause})`)

  let notifType = 'hangup'
  const callWasAnswered = session.phase !== 'ringing' && session.phase !== 'initiated'
  if (session.phase === 'ringing' || session.phase === 'initiated') {
    // Never answered
    notifType = hangupCause === 'timeout' || hangupCause === 'originator_cancel' ? 'no_answer'
      : (hangupCause === 'busy' || hangupCause === 'user_busy') ? 'busy'
      : 'no_answer'
  } else if (session.phase === 'transferring') {
    // Check if the transfer leg actually connected
    // Look for a matching transfer leg that was answered
    let transferConnected = false
    for (const [, transfer] of Object.entries(ivrTransferLegs)) {
      if (transfer.parentCallControlId === callControlId && transfer.phase === 'answered') {
        transferConnected = true
        break
      }
    }
    notifType = transferConnected ? 'completed' : 'transfer_failed'
  } else if (session.phase === 'bridged') {
    // Call was transferred and completed
    notifType = 'completed'
  } else if (session.phase === 'playing') {
    // Was answered but hung up during IVR playback
    const answerDuration = session.answerTime ? (Date.now() - session.answerTime) / 1000 : 0
    if (answerDuration < 3) {
      notifType = 'early_hangup'
    } else if (!session.digitPressed) {
      notifType = 'no_response'
    } else {
      notifType = 'hangup'
    }
  }

  // ── Bill IVR leg via unified billing (skip trial calls) ──
  // Quick IVR: always charge min 1 minute regardless of outcome (like bulk IVR)
  let billingInfo = { planMinUsed: 0, overageMin: 0, overageCharge: 0, rate: 0, used: 0, limit: 0 }
  if (!session.isTrial) {
    try {
      const { chatId: ownerId, num } = await findNumberOwner(session.callerId)
      if (ownerId && num) {
        billingInfo = await billCallMinutesUnified(ownerId, num.phoneNumber, minutesBilled, session.targetNumber, 'IVR_Outbound')
      } else {
        log(`[OutboundIVR] Could not find owner for ${session.callerId} — skipping billing`)
      }
    } catch (e) { log(`[OutboundIVR] Billing error: ${e.message}`) }
  }

  // Build plan usage line
  const remaining = billingInfo.limit > 0 ? Math.max(0, billingInfo.limit - billingInfo.used) : null
  const planLine = remaining !== null
    ? `\n📊 ${minutesBilled} min deducted · <b>${remaining}/${billingInfo.limit}</b> min remaining`
    : minutesBilled > 0 ? `\n📊 ${minutesBilled} min used` : ''

  // ── Bulk campaign call: report to bulk-call-service ──
  if (session.campaignId) {
    try {
      const bulkCallService = require('./bulk-call-service.js')
      // Determine transfer status
      let transferred = false
      let transferConnected = false
      if (session.bulkMode === 'transfer' && session.digitPressed) {
        transferred = true
        for (const [, transfer] of Object.entries(ivrTransferLegs)) {
          if (transfer.parentCallControlId === callControlId && transfer.phase === 'answered') {
            transferConnected = true
            break
          }
        }
      }

      const resultStatus = notifType === 'no_answer' ? 'no_answer'
        : notifType === 'busy' ? 'busy'
        : notifType === 'failed' ? 'failed'
        : 'completed'

      await bulkCallService.onCallComplete(callControlId, {
        status: resultStatus,
        digitPressed: session.digitPressed,
        duration,
        hangupCause,
        transferred,
        transferConnected,
        answeredAt: session.answerTime ? new Date(session.answerTime) : null,
      })
    } catch (e) {
      log(`[OutboundIVR] Bulk campaign report error: ${e.message}`)
    }

    // Skip per-call bot notification for bulk calls (bulk service sends progress)
    logEvent(session.callerId, session.targetNumber, 'outbound_ivr_bulk', duration)
    // Clean up
    for (const [transferLegId, transfer] of Object.entries(activeBridgeTransfers)) {
      if (transfer.originalCallControlId === callControlId) {
        await _telnyxApi.hangupCall(transferLegId).catch(() => {})
        delete activeBridgeTransfers[transferLegId]
      }
    }
    delete outboundIvrCalls[callControlId]
    return true
  }

  // Notify bot user (non-bulk calls only)
  const baseNotif = ivrOutbound.formatCallNotification(notifType, {
    ...session,
    duration,
    digitPressed: session.digitPressed,
  })
  _bot?.sendMessage(session.chatId, baseNotif + planLine, { parse_mode: 'HTML' }).catch(() => {})

  // If trial call, only mark as used if the call was actually answered
  if (session.isTrial) {
    if (callWasAnswered) {
      // Call connected — trial is consumed
      if (_state) {
        const trialKey = `ivrTrialUsed_${session.chatId}`
        set(_state, trialKey, true).catch(e => log(`[OutboundIVR] Failed to mark trial used: ${e.message}`))
        log(`[OutboundIVR] Trial marked as used for chatId ${session.chatId} (call was answered)`)
      }
      setTimeout(() => {
        _bot?.sendMessage(session.chatId, ivrOutbound.formatCallNotification('trial_used', {}), { parse_mode: 'HTML' }).catch(() => {})
      }, 2000)
    } else {
      // Call never connected (busy, no answer, etc.) — trial is preserved
      log(`[OutboundIVR] Trial NOT consumed for chatId ${session.chatId} (call not answered, cause: ${hangupCause})`)
      setTimeout(() => {
        _bot?.sendMessage(session.chatId, `📞 <b>Call not connected</b> — the recipient was busy or didn't answer.\n\n🎁 Your free trial call is still available! Try again anytime.`, { parse_mode: 'HTML' }).catch(() => {})
      }, 2000)
    }
  }

  // Log the outbound IVR call
  logEvent(session.callerId, session.targetNumber, 'outbound_ivr', duration)

  // Clean up any active bridge transfer leg tied to this call
  for (const [transferLegId, transfer] of Object.entries(activeBridgeTransfers)) {
    if (transfer.originalCallControlId === callControlId) {
      log(`[Voice] Original leg hung up — hanging up bridge transfer leg ${transferLegId}`)
      await _telnyxApi.hangupCall(transferLegId).catch(() => {})
      delete activeBridgeTransfers[transferLegId]
    }
  }

  // Cleanup
  delete outboundIvrCalls[callControlId]
  return true
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IVR TRANSFER LEG HANDLERS
// When an IVR outbound call transfers, Telnyx creates a new call leg.
// These handlers prevent that leg from being misidentified as an outbound SIP call.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if an initiated call is a transfer leg from an active IVR outbound session.
 * Matches by: direction=outgoing, from=callerId, to=ivrNumber of a session in 'transferring' phase.
 */
function handleIvrTransferLegInitiated(payload) {
  const callControlId = payload.call_control_id
  const direction = payload.direction
  if (direction === 'incoming') return false

  const to = (payload.to || '').replace(/[^+\d]/g, '')
  const from = (payload.from || '').replace(/[^+\d]/g, '')

  // Find an IVR session that is transferring to this number
  for (const [parentId, session] of Object.entries(outboundIvrCalls)) {
    if (session.phase === 'transferring' &&
        session.ivrNumber === to &&
        session.callerId === from) {
      // This is the transfer leg — register it
      ivrTransferLegs[callControlId] = {
        parentCallControlId: parentId,
        chatId: session.chatId,
        ivrNumber: to,
        callerId: from,
        targetNumber: session.targetNumber,
        templateName: session.templateName,
        phase: 'initiated',
        startTime: Date.now(),
      }
      log(`[OutboundIVR] Transfer leg initiated: ${from} → ${to} (leg: ${callControlId})`)

      // Timeout: if transfer target doesn't answer in 30s, notify user
      // (Telnyx will hang up both legs on its own, but we track it for accurate notification)
      const transferTimeout = setTimeout(() => {
        const transfer = ivrTransferLegs[callControlId]
        if (transfer && transfer.phase === 'initiated') {
          log(`[OutboundIVR] Transfer timeout: ${to} didn't answer in 30s`)
          transfer.timedOut = true
          // Proactively notify user — the hangup handler will also fire
          _bot?.sendMessage(transfer.chatId,
            `⏱ <b>Transfer Timeout</b>\n📞 ${formatPhone(to)} didn't answer after 30 seconds`,
            { parse_mode: 'HTML' }
          ).catch(() => {})
        }
      }, 30000)
      ivrTransferLegs[callControlId]._transferTimeout = transferTimeout

      return true
    }
  }
  return false
}

/**
 * Handle transfer leg answered — the transfer target picked up
 */
function handleIvrTransferLegAnswered(payload) {
  const callControlId = payload.call_control_id
  const transfer = ivrTransferLegs[callControlId]
  if (!transfer) return false

  transfer.phase = 'answered'
  transfer.answerTime = Date.now()
  // Clear the transfer timeout — target answered
  if (transfer._transferTimeout) { clearTimeout(transfer._transferTimeout); delete transfer._transferTimeout }
  log(`[OutboundIVR] Transfer leg answered: ${transfer.ivrNumber}`)

  // Notify bot user that transfer connected
  const parentSession = outboundIvrCalls[transfer.parentCallControlId]
  if (parentSession) {
    _bot?.sendMessage(transfer.chatId,
      `✅ <b>Transfer Connected</b>\n📞 ${transfer.targetNumber} connected to ${formatPhone(transfer.ivrNumber)}`,
      { parse_mode: 'HTML' }
    ).catch(() => {})
  }
  return true
}

/**
 * Handle transfer leg hangup — bill + cleanup
 * This is the TRANSFER LEG (callerId → ivrNumber)
 * Billed via unified billing: plan minutes first → overage at destination-based rate
 */
async function handleIvrTransferLegHangup(payload) {
  const callControlId = payload.call_control_id
  const transfer = ivrTransferLegs[callControlId]
  if (!transfer) return false

  // Clear the transfer timeout if still active
  if (transfer._transferTimeout) { clearTimeout(transfer._transferTimeout); delete transfer._transferTimeout }

  const telnyxDuration = payload.duration_secs || 0
  const trackedDuration = transfer.answerTime ? Math.round((Date.now() - transfer.answerTime) / 1000) : 0
  // Telnyx often reports 0s for transfer legs — use tracked duration as fallback
  const duration = telnyxDuration > 0 ? telnyxDuration : trackedDuration
  const hangupCause = payload.hangup_cause || 'unknown'
  const minutesBilled = duration > 0 ? Math.ceil(duration / 60) : 0
  log(`[OutboundIVR] Transfer leg hangup: ${transfer.ivrNumber} (${duration}s [telnyx=${telnyxDuration}s, tracked=${trackedDuration}s], ${minutesBilled} min, cause: ${hangupCause})`)

  // ── Bill transfer leg via unified billing ──
  let billingInfo = { planMinUsed: 0, overageMin: 0, overageCharge: 0, rate: 0, used: 0, limit: 0 }
  if (minutesBilled > 0 && _walletOf) {
    try {
      const { chatId: ownerId, num } = await findNumberOwner(transfer.callerId)
      if (ownerId && num) {
        billingInfo = await billCallMinutesUnified(ownerId, num.phoneNumber, minutesBilled, transfer.ivrNumber, 'IVR_Transfer')
      } else {
        log(`[OutboundIVR] Could not find owner for ${transfer.callerId} — skipping transfer billing`)
      }
    } catch (e) { log(`[OutboundIVR] Transfer leg billing error: ${e.message}`) }
  }

  // Build plan usage line
  const remaining = billingInfo.limit > 0 ? Math.max(0, billingInfo.limit - billingInfo.used) : null
  const planLine = remaining !== null
    ? `📊 ${minutesBilled} min deducted · <b>${remaining}/${billingInfo.limit}</b> min remaining`
    : `📊 ${minutesBilled} min used`

  // Notify bot user about transfer leg ending
  let statusMsg = `📞 <b>Call Ended</b>\n`
  statusMsg += `Target: ${formatPhone(transfer.targetNumber)}\n`
  statusMsg += `Transfer: ${formatPhone(transfer.ivrNumber)}\n`
  statusMsg += `Duration: ${formatDuration(duration)}\n`
  statusMsg += `${planLine}\n`

  // Check if the transfer was never answered — regardless of hangup cause
  if (transfer.phase === 'initiated') {
    // Transfer target never picked up
    statusMsg += `Status: Transfer target didn't answer`
  } else if (hangupCause === 'normal_clearing') {
    statusMsg += `Status: Completed normally`
  } else if (hangupCause === 'timeout' || hangupCause === 'no_answer') {
    statusMsg += `Status: Transfer target didn't answer`
  } else if (hangupCause === 'user_busy') {
    statusMsg += `Status: Transfer target busy`
  } else {
    statusMsg += `Status: ${hangupCause}`
  }

  _bot?.sendMessage(transfer.chatId, statusMsg, { parse_mode: 'HTML' }).catch(() => {})

  // Log the transfer leg
  logEvent(transfer.callerId, transfer.ivrNumber, 'ivr_transfer_leg', duration)

  delete ivrTransferLegs[callControlId]
  return true
}

module.exports = {
  handleVoiceWebhook,
  initVoiceService,
  activeCalls,
  pendingBridges,
  outboundIvrCalls,
  twilioIvrSessions,
  ivrTransferLegs,
  getIvrAnalytics,
  initiateOutboundIvrCall,
  incrementSmsUsed,
  isSmsLimitReached,
  isMinuteLimitReached,
  getMinuteLimit,
  getSmsLimit,
  isUSCanada,
  getCallRate,
  billCallMinutesUnified,
  findNumberOwner,
  incrementMinutesUsed,
  IVR_CALL_RATE,
}
