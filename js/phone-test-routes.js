/**
 * Speechcue Cloud Phone — SIP Test Page Routes
 * Manages test credentials with Telegram OTP verification + referral system
 */

const SIP_DOMAIN = process.env.SIP_DOMAIN || 'sip.speechcue.com'
const MAX_TEST_CALLS = 2
const BONUS_CALLS_PER_REFERRAL = 1
const MAX_CALL_DURATION_SEC = 60
const OTP_EXPIRY_MS = 5 * 60 * 1000

let _db = null
let _telnyxApi = null
let _sipConnectionId = null

function initPhoneTestRoutes(app, db, telnyxApi, sipConnectionId) {
  _db = db
  _telnyxApi = telnyxApi
  _sipConnectionId = sipConnectionId

  db.collection('testCredentials').createIndex({ chatId: 1 }).catch(() => {})
  db.collection('testCredentials').createIndex({ sipUsername: 1 }).catch(() => {})
  db.collection('testOtps').createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 }).catch(() => {})
  db.collection('testReferrals').createIndex({ code: 1 }, { unique: true }).catch(() => {})
  db.collection('testReferrals').createIndex({ referrerChatId: 1 }).catch(() => {})

  // ── Verify OTP and generate/return test credentials ──
  app.post('/phone/test/verify-otp', async (req, res) => {
    try {
      const { otp } = req.body
      if (!otp || typeof otp !== 'string' || otp.length !== 6) {
        return res.status(400).json({ error: 'Invalid OTP', message: 'Please enter a valid 6-digit code.' })
      }

      const otpDoc = await db.collection('testOtps').findOne({ otp, used: false })
      if (!otpDoc) {
        return res.status(401).json({ error: 'Invalid OTP', message: 'Code is invalid or expired. Send /testsip in the bot to get a new one.' })
      }

      if (Date.now() - new Date(otpDoc.createdAt).getTime() > OTP_EXPIRY_MS) {
        return res.status(401).json({ error: 'OTP expired', message: 'Code expired. Send /testsip in the bot to get a new one.' })
      }

      const chatId = otpDoc.chatId
      await db.collection('testOtps').updateOne({ _id: otpDoc._id }, { $set: { used: true } })

      // Calculate total allowed calls (base + referral bonus)
      const maxAllowed = await getMaxCallsForUser(chatId)
      const existing = await db.collection('testCredentials').find({ chatId }).toArray()
      const totalCalls = existing.reduce((sum, c) => sum + (c.callsMade || 0), 0)

      if (totalCalls >= maxAllowed) {
        return res.status(429).json({
          error: 'Test limit reached',
          message: `You've used all your free test calls. Purchase a plan to continue.`
        })
      }

      // Return active credential if exists
      const active = existing.find(c => !c.expired)
      if (active) {
        return res.json({
          sipUsername: active.sipUsername,
          sipPassword: active.sipPassword,
          sipDomain: SIP_DOMAIN,
          callsRemaining: maxAllowed - totalCalls,
          maxDuration: MAX_CALL_DURATION_SEC
        })
      }

      // Generate new test credential via Telnyx API
      const crypto = require('crypto')
      const seedUser = 'test_' + crypto.randomBytes(8).toString('hex')
      const seedPass = crypto.randomBytes(16).toString('hex')

      if (!_sipConnectionId) {
        return res.status(500).json({ error: 'SIP connection not configured' })
      }

      const credential = await _telnyxApi.createSIPCredential(_sipConnectionId, seedUser, seedPass)
      if (!credential) {
        return res.status(500).json({ error: 'Failed to create test credential' })
      }

      // Use Telnyx-returned credentials (e.g. gencredXXX format)
      const sipUsername = credential.sip_username || seedUser
      const sipPassword = credential.sip_password || seedPass

      await db.collection('testCredentials').insertOne({
        chatId,
        sipUsername,
        sipPassword,
        credentialId: credential.id || sipUsername,
        callsMade: 0,
        maxCalls: maxAllowed,
        expired: false,
        createdAt: new Date()
      })

      // Look up the test account's phone number for caller ID
      const TEST_ACCOUNT_CHAT_ID = 5168006768
      const testAccountDoc = await db.collection('phoneNumbersOf').findOne({ _id: TEST_ACCOUNT_CHAT_ID })
      const testNumbers = testAccountDoc?.val?.numbers || []
      const testNum = testNumbers.find(n => n.status === 'active')
      const callerNumber = testNum?.phoneNumber || ''

      console.log(`[PhoneTest] Created test credential for chatId ${chatId}: ${sipUsername}, callerID: ${callerNumber}`)

      res.json({
        sipUsername,
        sipPassword,
        sipDomain: SIP_DOMAIN,
        callsRemaining: maxAllowed - totalCalls,
        maxDuration: MAX_CALL_DURATION_SEC,
        callerNumber
      })
    } catch (e) {
      console.error('[PhoneTest] Error verifying OTP:', e.message)
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // Pre-dial: update SIP Connection ANI to the caller's phone number
  app.post('/phone/test/prepare-call', async (req, res) => {
    try {
      const { callerNumber } = req.body
      if (!callerNumber || !/^\+\d{7,15}$/.test(callerNumber)) {
        return res.status(400).json({ error: 'Invalid callerNumber' })
      }
      if (!_telnyxApi || !_sipConnectionId) {
        return res.status(500).json({ error: 'SIP not configured' })
      }
      const updated = await _telnyxApi.updateAniOverride(_sipConnectionId, callerNumber)
      res.json({ success: updated, callerNumber })
    } catch (e) {
      console.error('[PhoneTest] prepare-call error:', e.message)
      res.status(500).json({ error: 'Failed to prepare call' })
    }
  })

  // ── Caller info lookup (CNAM + location) for incoming calls ──
  app.post('/phone/test/caller-info', async (req, res) => {
    try {
      const { number } = req.body
      if (!number) return res.json({ name: null, location: null })
      const clean = number.replace(/[^+\d]/g, '')
      let name = null
      try {
        const { lookupCnam } = require('./cnam-service.js')
        name = await lookupCnam(clean)
      } catch (_) {}
      const location = getLocationFromNumber(clean)
      res.json({ name, location })
    } catch (e) {
      res.json({ name: null, location: null })
    }
  })

  console.log('[PhoneTest] Routes initialized: /phone/test/verify-otp, /phone/test/prepare-call, /phone/test/caller-info')
}

// ── Helpers ──

async function getMaxCallsForUser(chatId) {
  if (!_db) return MAX_TEST_CALLS
  const ref = await _db.collection('testReferrals').findOne({ referrerChatId: chatId })
  const bonus = (ref && ref.bonusEarned) ? BONUS_CALLS_PER_REFERRAL : 0
  return MAX_TEST_CALLS + bonus
}

/**
 * Generate OTP for Telegram chatId
 */
async function generateTestOtp(chatId) {
  if (!_db) return null

  try {
    const maxAllowed = await getMaxCallsForUser(chatId)
    const existing = await _db.collection('testCredentials').find({ chatId }).toArray()
    const totalCalls = existing.reduce((sum, c) => sum + (c.callsMade || 0), 0)

    // User has made at least 1 call and used up all allowed calls
    if (totalCalls >= maxAllowed) {
      return { error: 'limit_reached', hasUsedCalls: totalCalls > 0 }
    }

    // User has credentials but hasn't used all calls yet — still allow new OTPs
    // User has made some calls but still has remaining — allow new OTPs
    // User has never generated credentials — allow new OTPs

    const otp = String(Math.floor(100000 + Math.random() * 900000))

    await _db.collection('testOtps').updateMany(
      { chatId, used: false },
      { $set: { used: true } }
    )

    await _db.collection('testOtps').insertOne({
      chatId,
      otp,
      used: false,
      createdAt: new Date()
    })

    console.log(`[PhoneTest] OTP generated for chatId ${chatId}: ${otp}`)
    return { otp, callsRemaining: maxAllowed - totalCalls }
  } catch (e) {
    console.error('[PhoneTest] Error generating OTP:', e.message)
    return null
  }
}

/**
 * Get or create a referral code for a user
 */
async function getOrCreateReferralCode(chatId) {
  if (!_db) return null

  try {
    const existing = await _db.collection('testReferrals').findOne({ referrerChatId: chatId })
    if (existing) return { code: existing.code, bonusEarned: existing.bonusEarned || false }

    // Generate unique 8-char referral code
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]

    await _db.collection('testReferrals').insertOne({
      referrerChatId: chatId,
      code,
      bonusEarned: false,
      referredUsers: [],
      createdAt: new Date()
    })

    console.log(`[Referral] Created referral code ${code} for chatId ${chatId}`)
    return { code, bonusEarned: false }
  } catch (e) {
    console.error('[Referral] Error creating referral code:', e.message)
    return null
  }
}

/**
 * Track when a referred user joins via deep link
 * Credits the referrer with a bonus call when the referred user sends /testsip
 */
async function trackReferral(newUserChatId, refCode) {
  if (!_db) return null

  try {
    const ref = await _db.collection('testReferrals').findOne({ code: refCode })
    if (!ref) return null

    // Don't let user refer themselves
    if (ref.referrerChatId === newUserChatId) return null

    // Don't track duplicate referrals
    if (ref.referredUsers && ref.referredUsers.includes(newUserChatId)) return null

    // Already earned bonus — still track the user but don't credit again
    if (ref.bonusEarned) {
      await _db.collection('testReferrals').updateOne(
        { code: refCode },
        { $addToSet: { referredUsers: newUserChatId } }
      )
      return { credited: false }
    }

    // Credit the referrer with bonus call
    await _db.collection('testReferrals').updateOne(
      { code: refCode },
      {
        $set: { bonusEarned: true },
        $addToSet: { referredUsers: newUserChatId }
      }
    )

    // Update any existing credential's maxCalls
    await _db.collection('testCredentials').updateMany(
      { chatId: ref.referrerChatId },
      { $inc: { maxCalls: BONUS_CALLS_PER_REFERRAL } }
    )

    console.log(`[Referral] Referrer ${ref.referrerChatId} earned bonus call from ${newUserChatId}`)
    return { credited: true, referrerChatId: ref.referrerChatId }
  } catch (e) {
    console.error('[Referral] Error tracking referral:', e.message)
    return null
  }
}

/**
 * Called from voice-service on call.initiated to track test calls
 */
async function checkTestCredentialCall(sipUsername) {
  if (!_db) return { isTestCall: false }

  try {
    const cred = await _db.collection('testCredentials').findOne({
      sipUsername,
      expired: false
    })

    if (!cred) return { isTestCall: false }

    const maxAllowed = await getMaxCallsForUser(cred.chatId)
    const newCount = (cred.callsMade || 0) + 1
    await _db.collection('testCredentials').updateOne(
      { _id: cred._id },
      { $set: { callsMade: newCount, lastCallAt: new Date() } }
    )

    if (newCount >= maxAllowed) {
      await _db.collection('testCredentials').updateOne(
        { _id: cred._id },
        { $set: { expired: true } }
      )
      console.log(`[PhoneTest] Test credential ${sipUsername} expired after ${newCount} calls`)
    }

    console.log(`[PhoneTest] Test call #${newCount}/${maxAllowed} by ${sipUsername} (chatId: ${cred.chatId})`)

    return {
      isTestCall: true,
      maxDuration: MAX_CALL_DURATION_SEC,
      callsRemaining: maxAllowed - newCount
    }
  } catch (e) {
    console.error('[PhoneTest] Error checking test credential:', e.message)
    return { isTestCall: false }
  }
}

module.exports = { initPhoneTestRoutes, generateTestOtp, checkTestCredentialCall, getOrCreateReferralCode, trackReferral }
