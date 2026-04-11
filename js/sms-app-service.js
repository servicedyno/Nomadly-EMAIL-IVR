/**
 * SMS App Service — Server-side campaign management for Nomadly SMS App
 * 
 * Provides APIs for:
 * - User authentication via activation code (Telegram chatId)
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

function initSmsAppService(_db, _nameOf, _planEndingTime, _freeSmsCountOf, _loginCountOf, _planOf) {
  db = _db
  smsCampaigns = db.collection('smsCampaigns')
  nameOf = _nameOf
  planEndingTime = _planEndingTime
  freeSmsCountOf = _freeSmsCountOf
  loginCountOf = _loginCountOf
  planOf = _planOf

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
  const loginData = (await loginCountOf.findOne({ _id: numChatId }))
  const loginInfo = loginData?.val || loginData || { loginCount: 0, canLogin: true }

  const freeSmsLimit = Number(process.env.APP_FREE_SMS) || 100
  const isSubscribed = planExpiry > Date.now()
  const isFreeTrial = !isSubscribed && freeSmsCount < freeSmsLimit
  const canUseSms = isSubscribed || isFreeTrial

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
      loginCount: loginInfo.loginCount || 0,
      canLogin: loginInfo.canLogin !== false,
    }
  }
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
  const allowed = ['name', 'content', 'contacts', 'smsGapTime', 'scheduledAt', 'status']
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

  // Auth endpoint
  app.get('/sms-app/auth/:code', async (req, res) => {
    try {
      const result = await authenticateUser(req.params.code)
      if (!result.valid) return res.status(401).json(result)

      const numChatId = Number(req.params.code)
      // Direct findOne to avoid get() returning full doc when extra fields exist
      const doc = await loginCountOf.findOne({ _id: numChatId })
      const loginData = doc?.val || doc || { loginCount: 0, canLogin: true, lastLoginAt: 0 }

      // Enforce single-device: block if already logged in elsewhere
      if (loginData.canLogin === false) {
        const lastLoginAt = loginData.lastLoginAt || 0
        const hoursSinceLogin = (Date.now() - lastLoginAt) / (1000 * 60 * 60)

        if (hoursSinceLogin < 24) {
          return res.status(403).json({
            valid: false,
            error: 'device_conflict',
            message: 'Already logged in on another device. Logout from that device first, or type /resetlogin in @NomadlyBot.'
          })
        }
        // Auto-unlock after 24h — fall through to allow login
        console.log(`[SmsApp] Auto-unlock: ${numChatId} last login was ${hoursSinceLogin.toFixed(1)}h ago`)
      }

      // Record login with timestamp
      await set(loginCountOf, numChatId, {
        loginCount: (loginData.loginCount || 0) + 1,
        canLogin: false,
        lastLoginAt: Date.now()
      })

      res.json(result)
    } catch (error) {
      console.error('[SmsApp] Auth error:', error.message)
      res.status(500).json({ valid: false, error: 'Server error' })
    }
  })

  // Logout
  app.post('/sms-app/logout/:code', async (req, res) => {
    try {
      const numChatId = Number(req.params.code)
      const doc = await loginCountOf.findOne({ _id: numChatId })
      const loginData = doc?.val || doc || { loginCount: 0, canLogin: true, lastLoginAt: 0 }
      if (loginData.canLogin !== false) return res.json({ ok: false })
      await set(loginCountOf, numChatId, {
        loginCount: Math.max(0, (loginData.loginCount || 1) - 1),
        canLogin: true,
        lastLoginAt: loginData.lastLoginAt || 0
      })
      res.json({ ok: true })
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
        return res.status(403).json({
          error: 'subscription_required',
          message: 'Active subscription or free trial required to create campaigns. Subscribe via @NomadlyBot on Telegram.'
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
        return res.status(403).json({
          error: 'subscription_required',
          message: 'Active subscription required to edit campaigns.'
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
  app.put('/sms-app/campaigns/:campaignId/progress', async (req, res) => {
    try {
      const { chatId, sentCount, failedCount, status, lastSentIndex } = req.body
      if (!chatId) return res.status(400).json({ error: 'chatId required' })

      const sub = await checkSubscription(chatId)
      if (!sub.canUseSms) {
        return res.status(403).json({
          error: 'subscription_required',
          message: 'Subscription expired. Sending paused.'
        })
      }

      await updateCampaignProgress(req.params.campaignId, chatId, {
        sentCount, failedCount, status, lastSentIndex
      })

      res.json({ ok: true })
    } catch (error) {
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
          message: 'SMS limit reached or subscription expired.'
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
      const authResult = await authenticateUser(req.params.chatId)
      if (!authResult.valid) return res.status(401).json(authResult)

      const campaigns = await getCampaigns(req.params.chatId)
      res.json({
        user: authResult.user,
        campaigns,
        serverTime: Date.now()
      })
    } catch (error) {
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
}
