/**
 * Speechcue Cloud Phone — SIP Test Page Routes
 * Manages test credentials with Telegram OTP verification
 */

const SIP_DOMAIN = process.env.SIP_DOMAIN || 'sip.speechcue.com'
const MAX_TEST_CALLS = 2
const MAX_CALL_DURATION_SEC = 60
const OTP_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

let _db = null
let _telnyxApi = null
let _sipConnectionId = null

function initPhoneTestRoutes(app, db, telnyxApi, sipConnectionId) {
  _db = db
  _telnyxApi = telnyxApi
  _sipConnectionId = sipConnectionId

  // Ensure indexes
  db.collection('testCredentials').createIndex({ chatId: 1 }).catch(() => {})
  db.collection('testCredentials').createIndex({ sipUsername: 1 }).catch(() => {})
  db.collection('testOtps').createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 }).catch(() => {})

  // ── Verify OTP and generate/return test credentials ──
  app.post('/phone/test/verify-otp', async (req, res) => {
    try {
      const { otp } = req.body
      if (!otp || typeof otp !== 'string' || otp.length !== 6) {
        return res.status(400).json({ error: 'Invalid OTP', message: 'Please enter a valid 6-digit code.' })
      }

      // Find the OTP
      const otpDoc = await db.collection('testOtps').findOne({ otp, used: false })
      if (!otpDoc) {
        return res.status(401).json({ error: 'Invalid OTP', message: 'Code is invalid or expired. Send /test in the bot to get a new one.' })
      }

      // Check expiry
      if (Date.now() - new Date(otpDoc.createdAt).getTime() > OTP_EXPIRY_MS) {
        return res.status(401).json({ error: 'OTP expired', message: 'Code expired. Send /test in the bot to get a new one.' })
      }

      const chatId = otpDoc.chatId

      // Mark OTP as used
      await db.collection('testOtps').updateOne({ _id: otpDoc._id }, { $set: { used: true } })

      // Check if this chatId already exhausted test calls
      const existing = await db.collection('testCredentials').find({ chatId }).toArray()
      const totalCalls = existing.reduce((sum, c) => sum + (c.callsMade || 0), 0)

      if (totalCalls >= MAX_TEST_CALLS) {
        return res.status(429).json({
          error: 'Test limit reached',
          message: `You've already used your ${MAX_TEST_CALLS} free test calls. Purchase a plan to continue.`
        })
      }

      // Check if there's an active credential for this chatId
      const active = existing.find(c => !c.expired && c.callsMade < MAX_TEST_CALLS)
      if (active) {
        return res.json({
          sipUsername: active.sipUsername,
          sipPassword: active.sipPassword,
          sipDomain: SIP_DOMAIN,
          callsRemaining: MAX_TEST_CALLS - totalCalls,
          maxDuration: MAX_CALL_DURATION_SEC
        })
      }

      // Generate new test credential
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
      let username = 'test_'
      for (let i = 0; i < 8; i++) username += chars[Math.floor(Math.random() * chars.length)]

      const passChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let password = ''
      for (let i = 0; i < 16; i++) password += passChars[Math.floor(Math.random() * passChars.length)]

      // Create SIP credential via Telnyx API
      if (!_sipConnectionId) {
        return res.status(500).json({ error: 'SIP connection not configured' })
      }

      const credential = await _telnyxApi.createSIPCredential(_sipConnectionId, username, password)
      if (!credential) {
        return res.status(500).json({ error: 'Failed to create test credential' })
      }

      // Store in DB linked to chatId
      await db.collection('testCredentials').insertOne({
        chatId,
        sipUsername: username,
        sipPassword: password,
        credentialId: credential.id || credential.sip_username,
        callsMade: 0,
        maxCalls: MAX_TEST_CALLS,
        expired: false,
        createdAt: new Date()
      })

      console.log(`[PhoneTest] Created test credential for chatId ${chatId}: ${username}`)

      res.json({
        sipUsername: username,
        sipPassword: password,
        sipDomain: SIP_DOMAIN,
        callsRemaining: MAX_TEST_CALLS - totalCalls,
        maxDuration: MAX_CALL_DURATION_SEC
      })
    } catch (e) {
      console.error('[PhoneTest] Error verifying OTP:', e.message)
      res.status(500).json({ error: 'Internal error' })
    }
  })

  console.log('[PhoneTest] Routes initialized: /phone/test/verify-otp')
}

/**
 * Generate a 6-digit OTP for a Telegram chatId
 * Called from the bot when user sends /test
 */
async function generateTestOtp(chatId) {
  if (!_db) return null

  try {
    // Check if chatId already exhausted test calls
    const existing = await _db.collection('testCredentials').find({ chatId }).toArray()
    const totalCalls = existing.reduce((sum, c) => sum + (c.callsMade || 0), 0)

    if (totalCalls >= MAX_TEST_CALLS) {
      return { error: 'limit_reached' }
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000))

    // Invalidate any previous unused OTPs for this chatId
    await _db.collection('testOtps').updateMany(
      { chatId, used: false },
      { $set: { used: true } }
    )

    // Store new OTP
    await _db.collection('testOtps').insertOne({
      chatId,
      otp,
      used: false,
      createdAt: new Date()
    })

    console.log(`[PhoneTest] OTP generated for chatId ${chatId}: ${otp}`)
    return { otp, callsRemaining: MAX_TEST_CALLS - totalCalls }
  } catch (e) {
    console.error('[PhoneTest] Error generating OTP:', e.message)
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

    const newCount = (cred.callsMade || 0) + 1
    await _db.collection('testCredentials').updateOne(
      { _id: cred._id },
      { $set: { callsMade: newCount, lastCallAt: new Date() } }
    )

    if (newCount >= cred.maxCalls) {
      await _db.collection('testCredentials').updateOne(
        { _id: cred._id },
        { $set: { expired: true } }
      )
      console.log(`[PhoneTest] Test credential ${sipUsername} expired after ${newCount} calls`)
    }

    console.log(`[PhoneTest] Test call #${newCount}/${cred.maxCalls} by ${sipUsername} (chatId: ${cred.chatId})`)

    return {
      isTestCall: true,
      maxDuration: MAX_CALL_DURATION_SEC,
      callsRemaining: cred.maxCalls - newCount
    }
  } catch (e) {
    console.error('[PhoneTest] Error checking test credential:', e.message)
    return { isTestCall: false }
  }
}

module.exports = { initPhoneTestRoutes, generateTestOtp, checkTestCredentialCall }
