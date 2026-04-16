/**
 * SMS App Service — Server-side campaign management for Nomadly SMS App
 * 
 * Provides APIs for:
 * - User authentication via activation code (Telegram chatId)
 * - Plan-based multi-device management (Monthly=unlimited, Weekly=10, Daily=3, Trial=1)
 * - Subscription-gated campaign CRUD
 * - Campaign sync between Telegram bot and mobile app
 * - SMS delivery reporting and analytics
 */

const { v4: uuidv4 } = require('uuid')

let db
let smsCampaigns
let nameOf
let planEndingTime
let freeSmsCountOf
let loginCountOf
let planOf

// ─── Device limits per subscription plan ───
const DEVICE_LIMITS = {
  Monthly: Infinity,   // unlimited
  Weekly: 10,
  Daily: 3,
  trial: 1,
  none: 1,
}

function getDeviceLimit(plan, isSubscribed, isFreeTrial) {
  if (!isSubscribed && isFreeTrial) return DEVICE_LIMITS.trial
  if (!isSubscribed) return DEVICE_LIMITS.none
  return DEVICE_LIMITS[plan] || 1
}

let _bot = null
// Track users who have already received the trial-exhausted notification (prevent spam)
const _trialExhaustedNotified = new Set()

function initSmsAppService(_db, _nameOf, _planEndingTime, _freeSmsCountOf, _loginCountOf, _planOf, bot) {
  db = _db
  smsCampaigns = db.collection('smsCampaigns')
  nameOf = _nameOf
  planEndingTime = _planEndingTime
  freeSmsCountOf = _freeSmsCountOf
  loginCountOf = _loginCountOf
  planOf = _planOf
  _bot = bot

  smsCampaigns.createIndex({ chatId: 1 })
  smsCampaigns.createIndex({ chatId: 1, status: 1 })
  smsCampaigns.createIndex({ createdAt: -1 })

  console.log('[SmsApp] Service initialized')
}

// ─── Helper: get value from key-value collection ───
async function getVal(collection, key) {
  const doc = await collection.findOne({ _id: key })
  if (!doc) return undefined
  if (doc.val === 0) return 0
  if (doc.val === false) return false
  return doc.val || undefined
}

// ─── Device session helpers ───
function getDevices(loginData) {
  // Support new format (devices array) and migrate from old format
  if (Array.isArray(loginData?.devices)) return loginData.devices
  // Old format: { loginCount, canLogin, lastLoginAt } → convert
  if (loginData?.canLogin === false && loginData?.lastLoginAt) {
    return [{ deviceId: 'legacy', loginAt: loginData.lastLoginAt, lastActive: loginData.lastLoginAt }]
  }
  return []
}

function cleanStaleDevices(devices, maxAgeHours = 24) {
  const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000)
  return devices.filter(d => (d.lastActive || d.loginAt || 0) > cutoff)
}

// ─── Auth: Validate activation code and return user info ───
async function authenticateUser(chatId) {
  const numChatId = Number(chatId)
  if (isNaN(numChatId)) return { valid: false, error: 'Invalid code' }

  const nameDoc = await nameOf.findOne({ _id: numChatId })
  const name = nameDoc?.val || nameDoc?.name
  if (!name) return { valid: false, error: 'Invalid activation code. Open @NomadlyBot on Telegram to get your code.' }

  const planExpiry = await getVal(planEndingTime, numChatId) || 0
  const freeSmsCount = await getVal(freeSmsCountOf, numChatId) || 0
  const plan = await getVal(planOf, numChatId) || 'none'
  const doc = await loginCountOf.findOne({ _id: numChatId })
  const loginData = doc?.val || doc || {}
  const devices = getDevices(loginData)

  const freeSmsLimit = Number(process.env.APP_FREE_SMS) || 100
  const isSubscribed = planExpiry > Date.now()
  const isFreeTrial = !isSubscribed && freeSmsCount < freeSmsLimit
  const canUseSms = isSubscribed || isFreeTrial
  const deviceLimit = getDeviceLimit(plan, isSubscribed, isFreeTrial)

  return {
    valid: true,
    user: {
      chatId: numChatId,
      name,
      plan,
      planExpiry,
      isSubscribed,
      isFreeTrial,
      canUseSms,
      freeSmsUsed: freeSmsCount,
      freeSmsLimit,
      freeSmsRemaining: Math.max(0, freeSmsLimit - freeSmsCount),
      deviceLimit: isFinite(deviceLimit) ? deviceLimit : 'unlimited',
      activeDevices: devices.length,
      loginCount: devices.length,
      canLogin: true,  // backward compat — real check is in auth route
    }
  }
}

// ─── Get active devices for a user ───
async function getActiveDevices(chatId) {
  const numChatId = Number(chatId)
  const doc = await loginCountOf.findOne({ _id: numChatId })
  const loginData = doc?.val || doc || {}
  let devices = getDevices(loginData)
  devices = cleanStaleDevices(devices, 24)
  return devices
}

// ─── Subscription Check (reusable) ───
async function checkSubscription(chatId) {
  const numChatId = Number(chatId)
  const planExpiry = await getVal(planEndingTime, numChatId) || 0
  const freeSmsCount = await getVal(freeSmsCountOf, numChatId) || 0
  const freeSmsLimit = Number(process.env.APP_FREE_SMS) || 100
  const isSubscribed = planExpiry > Date.now()
  const isFreeTrial = !isSubscribed && freeSmsCount < freeSmsLimit

  return {
    canUseSms: isSubscribed || isFreeTrial,
    isSubscribed,
    isFreeTrial,
    freeSmsRemaining: Math.max(0, freeSmsLimit - freeSmsCount),
  }
}

// ─── Campaign CRUD ───

async function createCampaign(chatId, data) {
  const campaign = {
    _id: uuidv4(),
    chatId: Number(chatId),
    name: data.name || `Campaign ${new Date().toLocaleDateString()}`,
    content: data.content || [''],
    contacts: data.contacts || [],
    status: 'draft',
    smsGapTime: data.smsGapTime || 5,
    scheduledAt: data.scheduledAt || null,
    deviceId: data.deviceId || null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sentCount: 0,
    failedCount: 0,
    totalCount: (data.contacts || []).length,
    source: data.source || 'app',
    lastSentIndex: 0,
  }

  await smsCampaigns.insertOne(campaign)
  return campaign
}

async function getCampaigns(chatId) {
  return await smsCampaigns
    .find({ chatId: Number(chatId) })
    .sort({ createdAt: -1 })
    .toArray()
}

async function getCampaign(campaignId) {
  return await smsCampaigns.findOne({ _id: campaignId })
}

async function updateCampaign(campaignId, chatId, updates) {
  const allowed = ['name', 'content', 'contacts', 'smsGapTime', 'scheduledAt', 'status', 'deviceId']
  const safeUpdates = {}
  for (const key of allowed) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key]
  }
  safeUpdates.updatedAt = new Date()
  if (safeUpdates.contacts) {
    safeUpdates.totalCount = safeUpdates.contacts.length
  }

  const result = await smsCampaigns.updateOne(
    { _id: campaignId, chatId: Number(chatId) },
    { $set: safeUpdates }
  )
  return result.modifiedCount > 0
}

async function deleteCampaign(campaignId, chatId) {
  const result = await smsCampaigns.deleteOne({
    _id: campaignId,
    chatId: Number(chatId)
  })
  return result.deletedCount > 0
}

async function updateCampaignProgress(campaignId, chatId, progress) {
  const updates = { updatedAt: new Date() }
  if (progress.sentCount !== undefined) updates.sentCount = progress.sentCount
  if (progress.failedCount !== undefined) updates.failedCount = progress.failedCount
  if (progress.status !== undefined) updates.status = progress.status
  if (progress.lastSentIndex !== undefined) updates.lastSentIndex = progress.lastSentIndex

  await smsCampaigns.updateOne(
    { _id: campaignId, chatId: Number(chatId) },
    { $set: updates }
  )
}

// ─── Register Express Routes ───

function registerRoutes(app, get, set, increment, clicksOfSms, today, week, month, year) {

  // Auth endpoint — plan-based multi-device enforcement
  app.get('/sms-app/auth/:code', async (req, res) => {
    try {
      const deviceId = req.query.deviceId || 'unknown'
      const deviceName = req.query.deviceName || null
      const result = await authenticateUser(req.params.code)
      if (!result.valid) return res.status(401).json(result)

      const numChatId = Number(req.params.code)
      const { plan, isSubscribed, isFreeTrial } = result.user
      const deviceLimit = getDeviceLimit(plan, isSubscribed, isFreeTrial)

      // Get current device sessions
      const doc = await loginCountOf.findOne({ _id: numChatId })
      const loginData = doc?.val || doc || {}
      let devices = getDevices(loginData)

      // Clean up stale sessions (>24h inactive)
      devices = cleanStaleDevices(devices, 24)

      // Check if this device is already registered
      const existingIdx = devices.findIndex(d => d.deviceId === deviceId)

      if (existingIdx >= 0) {
        // Returning device — update lastActive and deviceName if provided
        devices[existingIdx].lastActive = Date.now()
        if (deviceName) devices[existingIdx].deviceName = deviceName
      } else {
        // New device — check limit (Infinity means unlimited)
        if (isFinite(deviceLimit) && devices.length >= deviceLimit) {
          // For single-device plans (trial/daily), auto-replace the old device
          // This handles reinstalls, phone switches, etc.
          if (deviceLimit === 1) {
            console.log(`[SmsApp] Auto-replacing device for ${numChatId}: ${devices[0]?.deviceId} → ${deviceId}`)
            devices = [{ deviceId, deviceName: deviceName || null, loginAt: Date.now(), lastActive: Date.now() }]
          } else {
            const limitLabel = `${deviceLimit} devices`
            const planLabel = isFreeTrial ? 'Free Trial' : (plan || 'your plan')
            return res.status(403).json({
              valid: false,
              error: 'device_limit',
              message: `${planLabel} allows ${limitLabel}. You have ${devices.length} active. Logout from another device first, or type /resetlogin in @NomadlyBot.`,
              deviceLimit,
              activeDevices: devices.length,
            })
          }
        } else {
          // Add new device with optional name
          devices.push({ deviceId, deviceName: deviceName || null, loginAt: Date.now(), lastActive: Date.now() })
        }
      }

      // Save updated device sessions
      await set(loginCountOf, numChatId, {
        devices,
        loginCount: devices.length,
        canLogin: true, // device array handles session mgmt — keep true so old bot code doesn't block user
        lastLoginAt: Date.now()
      })

      // Add device info to response
      result.user.activeDevices = devices.length
      result.user.deviceLimit = isFinite(deviceLimit) ? deviceLimit : 'unlimited'

      res.json(result)
    } catch (error) {
      console.error('[SmsApp] Auth error:', error.message)
      res.status(500).json({ valid: false, error: 'Server error' })
    }
  })

  // Logout — remove specific device
  app.post('/sms-app/logout/:code', async (req, res) => {
    try {
      const numChatId = Number(req.params.code)
      const deviceId = req.body?.deviceId || req.query?.deviceId || null

      const doc = await loginCountOf.findOne({ _id: numChatId })
      const loginData = doc?.val || doc || {}
      let devices = getDevices(loginData)

      if (deviceId) {
        // Remove specific device
        devices = devices.filter(d => d.deviceId !== deviceId)
      } else {
        // No deviceId — remove all (backward compat / full reset)
        devices = []
      }

      await set(loginCountOf, numChatId, {
        devices,
        loginCount: devices.length,
        canLogin: true, // device array handles session mgmt
        lastLoginAt: loginData.lastLoginAt || Date.now()
      })

      res.json({ ok: true, activeDevices: devices.length })
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  // Get plan info
  app.get('/sms-app/plan/:code', async (req, res) => {
    try {
      const result = await authenticateUser(req.params.code)
      if (!result.valid) return res.status(401).json(result)
      res.json(result.user)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Get all campaigns for user
  app.get('/sms-app/campaigns/:chatId', async (req, res) => {
    try {
      const campaigns = await getCampaigns(req.params.chatId)
      res.json({ campaigns })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Create campaign — SUBSCRIPTION GATED
  app.post('/sms-app/campaigns', async (req, res) => {
    try {
      const { chatId, name, content, contacts, smsGapTime, scheduledAt, source } = req.body
      if (!chatId) return res.status(400).json({ error: 'chatId required' })

      // Enforce subscription
      const sub = await checkSubscription(chatId)
      if (!sub.canUseSms) {
        // Send one-time Telegram notification when BulkSMS trial is exhausted
        const notifKey = `sms_trial_${chatId}`
        if (_bot && !_trialExhaustedNotified.has(notifKey)) {
          _trialExhaustedNotified.add(notifKey)
          // Auto-cleanup after 24h to allow re-notification if they come back later
          setTimeout(() => _trialExhaustedNotified.delete(notifKey), 24 * 60 * 60 * 1000)
          const BRAND = process.env.CHAT_BOT_BRAND || 'Nomadly'
          _bot.sendMessage(Number(chatId),
            `📱 <b>BulkSMS Free Trial Complete!</b>\n\n` +
            `You've used all ${sub.user?.freeSmsLimit || 100} free SMS messages from your trial. Great job testing the platform!\n\n` +
            `🚀 <b>Subscribe to unlock unlimited BulkSMS:</b>\n` +
            `✅ Unlimited SMS campaigns\n` +
            `✅ Multi-device support\n` +
            `✅ Scheduled sending & analytics\n` +
            `✅ Plus unlimited URL shortening & more\n\n` +
            `💰 Plans start from just <b>$${process.env.PRICE_DAILY_SUBSCRIPTION || '50'}/day</b>\n\n` +
            `👉 Tap <b>👛 Wallet → 📋 View Subscriptions</b> in ${BRAND} bot to subscribe now!`,
            { parse_mode: 'HTML' }
          ).catch(e => console.error(`[SmsApp] Failed to send trial-exhausted notification: ${e.message}`))
        }
        return res.status(403).json({
          error: 'subscription_required',
          message: 'Active subscription or free trial required to create campaigns. Tap ⚡ Upgrade Plan on the main menu of @NomadlyBot to subscribe — includes BulkSMS, unlimited links, validations & more!'
        })
      }

      const campaign = await createCampaign(chatId, {
        name, content, contacts, smsGapTime, scheduledAt, source
      })
      res.json({ campaign })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Update campaign — SUBSCRIPTION GATED
  app.put('/sms-app/campaigns/:campaignId', async (req, res) => {
    try {
      const { chatId, ...updates } = req.body
      if (!chatId) return res.status(400).json({ error: 'chatId required' })

      const sub = await checkSubscription(chatId)
      if (!sub.canUseSms) {
        // Send one-time Telegram notification when BulkSMS trial is exhausted
        const notifKey = `sms_trial_${chatId}`
        if (_bot && !_trialExhaustedNotified.has(notifKey)) {
          _trialExhaustedNotified.add(notifKey)
          setTimeout(() => _trialExhaustedNotified.delete(notifKey), 24 * 60 * 60 * 1000)
          _bot.sendMessage(Number(chatId),
            `📱 <b>BulkSMS Trial Expired</b>\n\nSubscribe to continue sending SMS campaigns.\n👉 Tap <b>👛 Wallet → 📋 View Subscriptions</b> to upgrade!`,
            { parse_mode: 'HTML' }
          ).catch(() => {})
        }
        return res.status(403).json({
          error: 'subscription_required',
          message: 'Active subscription required to edit campaigns. Tap ⚡ Upgrade Plan in @NomadlyBot to subscribe.'
        })
      }

      const success = await updateCampaign(req.params.campaignId, chatId, updates)
      res.json({ success })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Delete campaign
  app.delete('/sms-app/campaigns/:campaignId', async (req, res) => {
    try {
      const chatId = req.query.chatId
      if (!chatId) return res.status(400).json({ error: 'chatId required' })
      const success = await deleteCampaign(req.params.campaignId, chatId)
      res.json({ success })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Update campaign progress — SUBSCRIPTION GATED
  // ALSO increments free SMS counter based on sentCount delta (fixes counter not decrementing)
  app.put('/sms-app/campaigns/:campaignId/progress', async (req, res) => {
    try {
      const { chatId, sentCount, failedCount, status, lastSentIndex } = req.body
      if (!chatId) return res.status(400).json({ error: 'chatId required' })
      const numChatId = Number(chatId)

      const sub = await checkSubscription(numChatId)
      if (!sub.canUseSms) {
        return res.status(403).json({
          error: 'subscription_required',
          message: 'Subscription expired. Sending paused. Tap ⚡ Upgrade Plan in @NomadlyBot to reactivate.'
        })
      }

      // ── FIX: Increment free SMS counter based on sentCount delta ──
      // The background service and foreground plugin may not call /sms-sent individually,
      // so we derive the count from campaign progress (sentCount) delta.
      if (sentCount !== undefined && sentCount > 0) {
        const campaign = await getCampaign(req.params.campaignId)
        const previousSent = campaign?.sentCount || 0
        const delta = Math.max(0, sentCount - previousSent)
        if (delta > 0) {
          console.log(`[SmsApp] Progress: user ${numChatId}, campaign ${req.params.campaignId}: +${delta} SMS (${previousSent}→${sentCount}), failed=${failedCount || 0}, status=${status || 'n/a'}`)
          // Increment free SMS counter by the delta (atomic)
          increment(freeSmsCountOf, numChatId, delta)
          // Also track in analytics
          const name = await get(nameOf, numChatId)
          increment(clicksOfSms, numChatId + ', ' + name + ', ' + today(), delta)
          increment(clicksOfSms, numChatId + ', ' + name + ', ' + week(), delta)
          increment(clicksOfSms, numChatId + ', ' + name + ', ' + month(), delta)
          increment(clicksOfSms, numChatId + ', ' + name + ', ' + year(), delta)
          increment(clicksOfSms, 'total, total, ' + today(), delta)
          increment(clicksOfSms, 'total, total, ' + week(), delta)
          increment(clicksOfSms, 'total, total, ' + month(), delta)
          increment(clicksOfSms, 'total, total, ' + year(), delta)
        }
      }

      await updateCampaignProgress(req.params.campaignId, chatId, {
        sentCount, failedCount, status, lastSentIndex
      })

      // Return updated subscription state so app can react
      const updatedSub = await checkSubscription(numChatId)
      res.json({ ok: true, freeSmsRemaining: updatedSub.freeSmsRemaining, canUseSms: updatedSub.canUseSms })
    } catch (error) {
      console.log(`[SmsApp] Progress update error:`, error.message)
      res.status(500).json({ error: error.message })
    }
  })

  // Increment SMS count — SUBSCRIPTION GATED
  app.post('/sms-app/sms-sent/:chatId', async (req, res) => {
    try {
      const numChatId = Number(req.params.chatId)

      const sub = await checkSubscription(numChatId)
      if (!sub.canUseSms) {
        return res.status(403).json({
          error: 'subscription_required',
          message: 'SMS limit reached or subscription expired. Tap ⚡ Upgrade Plan in @NomadlyBot to continue.'
        })
      }

      increment(freeSmsCountOf, numChatId)

      const name = await get(nameOf, numChatId)
      increment(clicksOfSms, numChatId + ', ' + name + ', ' + today())
      increment(clicksOfSms, numChatId + ', ' + name + ', ' + week())
      increment(clicksOfSms, numChatId + ', ' + name + ', ' + month())
      increment(clicksOfSms, numChatId + ', ' + name + ', ' + year())
      increment(clicksOfSms, 'total, total, ' + today())
      increment(clicksOfSms, 'total, total, ' + week())
      increment(clicksOfSms, 'total, total, ' + month())
      increment(clicksOfSms, 'total, total, ' + year())

      res.json({ ok: true, remaining: sub.freeSmsRemaining - 1 })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Full sync endpoint
  app.get('/sms-app/sync/:chatId', async (req, res) => {
    try {
      const chatId = req.params.chatId
      const userVersion = req.query.version || 'unknown'
      const latestVersion = '2.4.1'
      
      console.log(`[SmsApp] Sync request for chatId: ${chatId}, version: ${userVersion}`)
      
      const authResult = await authenticateUser(chatId)
      if (!authResult.valid) {
        console.log(`[SmsApp] Auth failed for ${chatId}: ${authResult.error}`)
        return res.status(401).json(authResult)
      }

      // Track user's app version
      await loginCountOf.updateOne(
        { _id: Number(chatId) },
        { $set: { 'val.appVersion': userVersion, 'val.lastSync': new Date() } },
        { upsert: true }
      )

      // Check if user needs to update
      if (userVersion !== latestVersion && userVersion !== 'unknown' && _bot) {
        // Use underscores instead of dots to avoid MongoDB nested path interpretation
        const versionKey = `update_notified_${userVersion.replace(/\./g, '_')}_${latestVersion.replace(/\./g, '_')}`
        const doc = await loginCountOf.findOne({ _id: Number(chatId) })
        const alreadyNotified = doc?.val?.[versionKey]
        
        if (!alreadyNotified) {
          // Send update reminder
          const updateMsg = `📱 <b>Nomadly SMS App Update Available</b>

Your version: ${userVersion}
Latest version: ${latestVersion}

<b>Important fixes in this update:</b>
✅ Fixed multi-line messages being split into fragments
✅ Fixed trial SMS double-counting
✅ Trial limit enforcement during sending
✅ Better upgrade prompts

<b>To update:</b>
1. ⚠️ <b>UNINSTALL</b> the current app first (Settings → Apps → Nomadly SMS → Uninstall)
2. Click link below to download latest version
3. Install and login again

⚠️ You MUST uninstall first — just deleting the APK file is not enough!

🔗 Download: /start → 📱 BulkSMS App

<i>This ensures you have the latest fixes and features.</i>`
          
          try {
            await _bot.sendMessage(chatId, updateMsg, { parse_mode: 'HTML' })
            // Mark as notified for this version pair
            await loginCountOf.updateOne(
              { _id: Number(chatId) },
              { $set: { [`val.${versionKey}`]: true } }
            )
            console.log(`[SmsApp] Update reminder sent to ${chatId}: ${userVersion} → ${latestVersion}`)
          } catch (e) {
            console.log(`[SmsApp] Failed to send update reminder to ${chatId}:`, e.message)
          }
        }
      }

      const campaigns = await getCampaigns(chatId)
      console.log(`[SmsApp] Sync for ${chatId} - canUseSms: ${authResult.user.canUseSms}, isFreeTrial: ${authResult.user.isFreeTrial}, freeSmsUsed: ${authResult.user.freeSmsUsed}, freeSmsRemaining: ${authResult.user.freeSmsRemaining}, isSubscribed: ${authResult.user.isSubscribed}`)
      
      res.json({
        user: authResult.user,
        campaigns,
        serverTime: Date.now(),
        latestVersion
      })
    } catch (error) {
      console.log(`[SmsApp] Sync error:`, error.message)
      res.status(500).json({ error: error.message })
    }
  })

  // SMS error reporting endpoint — logs device-side SMS failures for diagnostics
  app.post('/sms-app/report-errors/:chatId', async (req, res) => {
    try {
      const chatId = req.params.chatId
      const numChatId = Number(chatId)
      const { campaignId, errors } = req.body || {}
      if (!errors || !Array.isArray(errors) || errors.length === 0) {
        return res.json({ ok: true })
      }

      const errorReasons = errors.map(e => e.reason).join(', ')
      console.log(`[SmsApp] SMS errors for user ${chatId}, campaign ${campaignId}: ${errors.length} failures — reasons: ${errorReasons}`)

      // ── FIX: Also increment free SMS counter for successfully-sent-but-error-reported messages ──
      // The background service reports errors AFTER the campaign completes.
      // Some messages may have been sent successfully — track them via campaign sentCount.

      // Store errors in the campaign for future diagnostics
      if (campaignId) {
        await smsCampaigns.updateOne(
          { _id: campaignId },
          { $set: { lastErrors: errors.slice(-10), lastErrorAt: new Date().toISOString() } }
        )
      }

      // Store in a dedicated diagnostic collection for long-term analysis
      await db.collection('smsAppDiagnostics').insertOne({
        chatId: numChatId,
        campaignId,
        errors: errors.slice(-20),
        errorSummary: Object.entries(errors.reduce((acc, e) => { acc[e.reason] = (acc[e.reason] || 0) + 1; return acc }, {})),
        reportedAt: new Date()
      })

      // Log each unique error reason with detailed messages
      const reasonCounts = {}
      const errorDetails = {}
      for (const e of errors) {
        reasonCounts[e.reason] = (reasonCounts[e.reason] || 0) + 1
        if (e.error && !errorDetails[e.reason]) {
          errorDetails[e.reason] = e.error
        }
      }
      for (const [reason, count] of Object.entries(reasonCounts)) {
        const detail = errorDetails[reason] ? ` | Detail: ${errorDetails[reason]}` : ''
        console.log(`[SmsApp] Error: ${reason} × ${count}${detail} — user: ${chatId}, campaign: ${campaignId}`)
      }

      res.json({ ok: true })
    } catch (error) {
      console.log(`[SmsApp] Error storing SMS errors:`, error.message)
      res.status(500).json({ error: error.message })
    }
  })

  // ── Diagnostics endpoint — visibility into what's happening per user ──
  app.get('/sms-app/diagnostics/:chatId', async (req, res) => {
    try {
      const chatId = req.params.chatId
      const numChatId = Number(chatId)

      // Gather all relevant data
      const [authResult, campaigns, loginDoc, recentErrors] = await Promise.all([
        authenticateUser(chatId),
        getCampaigns(chatId),
        loginCountOf.findOne({ _id: numChatId }),
        db.collection('smsAppDiagnostics').find({ chatId: numChatId }).sort({ reportedAt: -1 }).limit(10).toArray()
      ])

      const loginData = loginDoc?.val || {}
      const devices = getDevices(loginData)

      // Campaign summary
      const campaignSummary = campaigns.map(c => ({
        id: c._id,
        name: c.name,
        status: c.status,
        sentCount: c.sentCount,
        failedCount: c.failedCount,
        totalCount: c.totalCount,
        lastSentIndex: c.lastSentIndex,
        lastErrors: c.lastErrors?.slice(-3),
        lastErrorAt: c.lastErrorAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }))

      // Error summary across all recent diagnostics
      const allErrors = recentErrors.flatMap(d => d.errors || [])
      const errorBreakdown = {}
      for (const e of allErrors) {
        errorBreakdown[e.reason] = (errorBreakdown[e.reason] || 0) + 1
      }

      const totalSent = campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0)
      const totalFailed = campaigns.reduce((sum, c) => sum + (c.failedCount || 0), 0)

      res.json({
        user: authResult.valid ? authResult.user : { error: authResult.error },
        device: {
          appVersion: loginData.appVersion || 'unknown',
          lastSync: loginData.lastSync,
          activeDevices: devices.length,
          devices: devices.map(d => ({ id: d.deviceId, name: d.deviceName, lastActive: d.lastActive })),
        },
        campaigns: {
          total: campaigns.length,
          totalSent,
          totalFailed,
          details: campaignSummary,
        },
        errors: {
          recentCount: allErrors.length,
          breakdown: errorBreakdown,
          recentDiagnostics: recentErrors.slice(0, 5).map(d => ({
            campaignId: d.campaignId,
            errors: d.errors?.slice(0, 5),
            reportedAt: d.reportedAt,
          })),
        },
        serverTime: new Date().toISOString(),
      })
    } catch (error) {
      console.log(`[SmsApp] Diagnostics error:`, error.message)
      res.status(500).json({ error: error.message })
    }
  })

  console.log('[SmsApp] Routes registered')
}

module.exports = {
  initSmsAppService,
  registerRoutes,
  createCampaign,
  getCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  checkSubscription,
  getActiveDevices,
  DEVICE_LIMITS,
  getDeviceLimit,
}
