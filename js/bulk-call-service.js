// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Bulk Call Campaign Service — Speechcue-based IVR campaigns
// Handles concurrent call queues, per-lead result tracking, and final reporting
// Uses Speechcue's TwiML webhooks for IVR logic (play audio, gather DTMF, transfer)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { log } = require('console')
const { sanitizeProviderError, sanitizeHangupCause } = require('./sanitize-provider')
const { getBalance } = require('./utils.js')
const { get } = require('./db.js')

// ━━━ Bulk Call Pricing & Limits ━━━
const BULK_CALL_RATE = parseFloat(process.env.BULK_CALL_RATE_PER_MIN || '0.15')   // $/min — charged whether answered or not
const MAX_BULK_LEADS  = parseInt(process.env.BULK_CALL_MAX_LEADS || '500', 10)     // max leads per campaign

let _db = null
let _collection = null
let _bot = null
let _twilioService = null
let _voiceService = null
let _walletOf = null
let _phoneNumbersOf = null

// Active campaigns in memory: campaignId → { queue state }
const activeCampaigns = {}

// Map: callSid → { campaignId, leadIndex }
const callToCampaign = {}

/**
 * Initialize bulk call service
 */
async function initBulkCallService(db, bot, twilioService, walletOf) {
  _db = db
  _bot = bot
  _twilioService = twilioService
  _voiceService = require('./voice-service.js')
  _walletOf = walletOf || db.collection('walletOf')
  _phoneNumbersOf = db.collection('phoneNumbersOf')
  _collection = db.collection('bulkCallCampaigns')
  await _collection.createIndex({ chatId: 1 })
  await _collection.createIndex({ id: 1 }, { unique: true })
  await _collection.createIndex({ status: 1 })
  log('[BulkCall] Service initialized (Speechcue mode)')
}

/**
 * Parse a leads file (CSV or TXT)
 * Supports: one number per line, or CSV with number,name columns
 * @param {string} content - File content
 * @returns {{ leads: Array<{number, name}>, errors: string[] }}
 */
function parseLeadsFile(content) {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  const leads = []
  const errors = []
  const seen = new Set()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let number = ''
    let name = null

    // Try CSV (comma or semicolon separated)
    if (line.includes(',') || line.includes(';')) {
      const parts = line.split(/[,;]/).map(p => p.trim())
      number = parts[0]
      name = parts[1] || null
    } else {
      number = line
    }

    // Clean the number
    number = number.replace(/["'\s]/g, '')
    if (!number.startsWith('+')) number = '+' + number.replace(/^0+/, '')
    number = number.replace(/[^+\d]/g, '')

    if (!number.match(/^\+\d{8,15}$/)) {
      errors.push(`Line ${i + 1}: Invalid number "${lines[i].substring(0, 30)}"`)
      continue
    }

    if (seen.has(number)) continue // skip duplicates
    seen.add(number)
    leads.push({ number, name: name ? name.trim() : null })
  }

  return { leads, errors }
}

/**
 * Create a new campaign
 */
async function createCampaign(params) {
  const { chatId, callerId, audioUrl, audioName, mode, transferNumber, activeKeys, concurrency, holdMusic, leads, twilioSubAccountSid, twilioSubAccountToken } = params

  // ━━━ Enforce max lead limit ━━━
  if (leads.length > MAX_BULK_LEADS) {
    return { error: `Maximum ${MAX_BULK_LEADS} leads per campaign. You uploaded ${leads.length}.` }
  }

  const campaign = {
    id: crypto.randomUUID(),
    chatId: Number(chatId),
    callerId,
    audioUrl,
    audioName: audioName || 'Custom Audio',
    mode: mode || 'report_only', // 'transfer' or 'report_only'
    transferNumber: transferNumber || null,
    activeKeys: activeKeys || ['1'],
    concurrency: Math.min(concurrency || 10, 20),
    holdMusic: holdMusic || false,
    twilioSubAccountSid: twilioSubAccountSid || null,
    twilioSubAccountToken: twilioSubAccountToken || null,
    leads: leads.map((l, i) => ({
      index: i,
      number: l.number,
      name: l.name,
      status: 'pending', // pending|calling|ringing|answered|completed|no_answer|busy|failed
      digitPressed: null,
      transferred: false,
      transferConnected: false,
      duration: 0,
      callSid: null,
      startedAt: null,
      answeredAt: null,
      completedAt: null,
      hangupCause: null,
    })),
    status: 'created', // created|running|paused|completed|cancelled
    stats: {
      total: leads.length,
      completed: 0,
      answered: 0,
      keyPressed: 0,
      transferred: 0,
      noAnswer: 0,
      busy: 0,
      failed: 0,
      hungUp: 0,
    },
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
  }

  await _collection.insertOne(campaign)
  log(`[BulkCall] Campaign created: ${campaign.id} (${leads.length} leads, mode: ${mode}, concurrency: ${campaign.concurrency})`)
  return campaign
}

/**
 * Start a campaign — begin dialing leads via Twilio
 */
async function startCampaign(campaignId) {
  const campaign = await _collection.findOne({ id: campaignId })
  if (!campaign) return { error: 'Campaign not found' }
  if (campaign.status === 'running') return { error: 'Campaign already running' }

  // ━━━ PRE-CAMPAIGN CREDIT CHECK: Bulk calls charge $BULK_CALL_RATE/min from wallet (plan minutes NOT used) ━━━
  try {
    if (_walletOf) {
      const { usdBal } = await getBalance(_walletOf, campaign.chatId)
      const minRequired = BULK_CALL_RATE * campaign.leads.length  // 1 min minimum per lead
      if (usdBal < BULK_CALL_RATE) {
        _bot?.sendMessage(campaign.chatId,
          `🚫 <b>Campaign Blocked — Insufficient Wallet Balance</b>\n\n` +
          `Bulk campaigns are charged at <b>$${BULK_CALL_RATE.toFixed(2)}/min</b> per number (min. 1 min, whether answered or not).\n` +
          `Wallet: <b>$${usdBal.toFixed(2)}</b>\n` +
          `Estimated cost: <b>$${minRequired.toFixed(2)}</b> (${campaign.leads.length} leads × $${BULK_CALL_RATE.toFixed(2)})\n\n` +
          `Top up via 👛 Wallet, then retry.`,
          { parse_mode: 'HTML' }
        ).catch(() => {})
        return { error: `Insufficient wallet balance ($${usdBal.toFixed(2)}). Need at least $${BULK_CALL_RATE.toFixed(2)} per lead.` }
      }
      if (usdBal < minRequired) {
        const estLeadsCovered = Math.floor(usdBal / BULK_CALL_RATE)
        _bot?.sendMessage(campaign.chatId,
          `⚠️ <b>Low Balance Warning</b>\n\n` +
          `Wallet: <b>$${usdBal.toFixed(2)}</b> (~${estLeadsCovered} calls at $${BULK_CALL_RATE.toFixed(2)}/min).\n` +
          `Campaign has <b>${campaign.leads.length}</b> leads — estimated cost: <b>$${minRequired.toFixed(2)}</b>.\n` +
          `Campaign may pause mid-way if balance runs out.\n` +
          `Consider topping up for uninterrupted dialing.`,
          { parse_mode: 'HTML' }
        ).catch(() => {})
      }
    }
  } catch (e) {
    log(`[BulkCall] Pre-campaign credit check error: ${e.message}`)
  }

  // ── Resolve sub-account token if SID is present but token is missing ──
  if (campaign.twilioSubAccountSid && !campaign.twilioSubAccountToken && _twilioService?.getSubAccount) {
    try {
      const subAccount = await _twilioService.getSubAccount(campaign.twilioSubAccountSid)
      if (subAccount && subAccount.authToken) {
        campaign.twilioSubAccountToken = subAccount.authToken
        await _collection.updateOne({ id: campaignId }, { $set: { twilioSubAccountToken: subAccount.authToken } })
        log(`[BulkCall] Resolved sub-account token for ${campaign.twilioSubAccountSid}`)
      } else {
        log(`[BulkCall] WARNING: Could not resolve sub-account token for ${campaign.twilioSubAccountSid}`)
      }
    } catch (e) {
      log(`[BulkCall] Failed to resolve sub-account token: ${e.message}`)
    }
  }

  await _collection.updateOne({ id: campaignId }, { $set: { status: 'running', startedAt: new Date() } })
  campaign.status = 'running'
  campaign.startedAt = new Date()

  // Initialize in-memory state
  activeCampaigns[campaignId] = {
    activeCalls: 0,
    nextLeadIndex: 0,
    paused: false,
  }

  log(`[BulkCall] Starting campaign ${campaignId}: ${campaign.leads.length} leads, concurrency ${campaign.concurrency}`)

  // Notify user
  _bot?.sendMessage(campaign.chatId,
    `🚀 <b>Campaign Started!</b>\n\n` +
    `📞 Leads: <b>${campaign.leads.length}</b>\n` +
    `🎵 Audio: <b>${campaign.audioName}</b>\n` +
    `📱 Caller ID: <b>${campaign.callerId}</b>\n` +
    `📞 Provider: <b>Speechcue</b>\n` +
    `⚡ Concurrency: <b>${campaign.concurrency}</b>\n` +
    `📊 Mode: <b>${campaign.mode === 'transfer' ? '🔗 Transfer + Report' : '📊 Report Only'}</b>\n` +
    `Dialing now... You'll receive updates as calls complete.`,
    { parse_mode: 'HTML' }
  ).catch(() => {})

  // Fire initial batch
  await fireNextBatch(campaignId)
  return { success: true }
}

/**
 * Fire the next batch of calls up to concurrency limit via Twilio
 */
async function fireNextBatch(campaignId) {
  const state = activeCampaigns[campaignId]
  if (!state || state.paused) return

  const campaign = await _collection.findOne({ id: campaignId })
  if (!campaign || campaign.status !== 'running') return

  const available = campaign.concurrency - state.activeCalls
  if (available <= 0) return

  const SELF_URL = process.env.SELF_URL_PROD || process.env.SELF_URL || ''

  // Find pending leads
  const pendingLeads = campaign.leads.filter(l => l.status === 'pending')
  const toFire = pendingLeads.slice(0, available)

  // ━━━ PER-BATCH CREDIT CHECK: Pause campaign if wallet exhausted (bulk calls use wallet only) ━━━
  if (toFire.length > 0 && _walletOf) {
    try {
      const { usdBal } = await getBalance(_walletOf, campaign.chatId)
      if (usdBal < BULK_CALL_RATE) {
        // No credits — pause campaign
        log(`[BulkCall] Pausing campaign ${campaignId}: wallet $${usdBal.toFixed(2)} < $${BULK_CALL_RATE}/min`)
        state.paused = true
        await _collection.updateOne({ id: campaignId }, { $set: { status: 'paused' } })
        _bot?.sendMessage(campaign.chatId,
          `⏸️ <b>Campaign Paused — Wallet Depleted</b>\n\n` +
          `📞 ${campaign.stats.completed}/${campaign.stats.total} calls completed so far.\n` +
          `Wallet: <b>$${usdBal.toFixed(2)}</b> (need $${BULK_CALL_RATE.toFixed(2)}/min per call).\n\n` +
          `Top up via 👛 Wallet, then resume the campaign.`,
          { parse_mode: 'HTML' }
        ).catch(() => {})
        return
      }
    } catch (e) { log(`[BulkCall] Per-batch credit check error: ${e.message}`) }
  }

  for (const lead of toFire) {
    state.activeCalls++

    try {
      // Build TwiML URL with campaign context
      const twimlUrl = `${SELF_URL}/twilio/bulk-ivr?campaignId=${encodeURIComponent(campaignId)}&leadIndex=${lead.index}`
      const statusUrl = `${SELF_URL}/twilio/bulk-status?campaignId=${encodeURIComponent(campaignId)}&leadIndex=${lead.index}`

      const result = await _twilioService.makeOutboundCall(
        campaign.callerId,
        lead.number,
        twimlUrl,
        campaign.twilioSubAccountSid || null,
        campaign.twilioSubAccountToken || null,
        {
          statusCallback: statusUrl,
          statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
          timeout: 30, // ring for 30s
        }
      )

      if (result.error) {
        state.activeCalls--
        await updateLeadResult(campaignId, lead.index, {
          status: 'failed',
          hangupCause: result.error,
          completedAt: new Date(),
        })
        log(`[BulkCall] Speechcue call failed for ${lead.number}: ${result.error}`)
        // Recalc and check completion after failure
        await recalcStats(campaignId)
        await sendProgressUpdate(campaignId, lead.index, {
          status: 'failed', hangupCause: result.error, duration: 0,
        })
        await checkCampaignCompletion(campaignId)
      } else {
        // Map callSid to campaign
        callToCampaign[result.callSid] = { campaignId, leadIndex: lead.index }
        await updateLeadResult(campaignId, lead.index, {
          status: 'calling',
          callSid: result.callSid,
          startedAt: new Date(),
        })
        log(`[BulkCall] Speechcue call initiated: ${result.callSid} → ${lead.number}`)
      }
    } catch (e) {
      state.activeCalls--
      await updateLeadResult(campaignId, lead.index, {
        status: 'failed',
        hangupCause: e.message,
        completedAt: new Date(),
      })
      log(`[BulkCall] Speechcue call error for ${lead.number}: ${e.message}`)
      await recalcStats(campaignId)
      await checkCampaignCompletion(campaignId)
    }
  }

  // Check if all done (in case all calls failed immediately)
  if (toFire.length === 0) {
    await checkCampaignCompletion(campaignId)
  }
}

/**
 * Update a lead's result in the campaign
 */
async function updateLeadResult(campaignId, leadIndex, updates) {
  const setFields = {}
  for (const [key, val] of Object.entries(updates)) {
    setFields[`leads.${leadIndex}.${key}`] = val
  }
  await _collection.updateOne({ id: campaignId }, { $set: setFields })
}

/**
 * Called when a DTMF digit is received (from TwiML gather callback)
 */
async function onDigitReceived(campaignId, leadIndex, digit) {
  await updateLeadResult(campaignId, leadIndex, {
    digitPressed: digit,
  })
  log(`[BulkCall] Digit received: campaign=${campaignId} lead=${leadIndex} digit=${digit}`)
}

/**
 * Called when a call status update is received from Twilio
 * This handles ringing, answered, and completed statuses
 */
async function onCallStatusUpdate(callSid, campaignId, leadIndex, status, duration, hangupCause) {
  const campaign = await _collection.findOne({ id: campaignId })
  if (!campaign) return

  const lead = campaign.leads[leadIndex]
  if (!lead) return

  if (status === 'ringing' && lead.status === 'calling') {
    await updateLeadResult(campaignId, leadIndex, { status: 'ringing' })
    return
  }

  if (status === 'in-progress' && lead.status !== 'answered') {
    await updateLeadResult(campaignId, leadIndex, {
      status: 'answered',
      answeredAt: new Date(),
    })
    return
  }

  // Terminal statuses
  if (['completed', 'no-answer', 'busy', 'failed', 'canceled'].includes(status)) {
    const state = activeCampaigns[campaignId]
    if (state) state.activeCalls = Math.max(0, state.activeCalls - 1)

    // Clean up callSid mapping
    if (callSid) delete callToCampaign[callSid]

    // Refresh lead data to get digitPressed
    const freshCampaign = await _collection.findOne({ id: campaignId })
    const freshLead = freshCampaign?.leads[leadIndex]
    const digitPressed = freshLead?.digitPressed || null

    // Map Twilio status to our status
    let finalStatus = 'completed'
    if (status === 'no-answer') finalStatus = 'no_answer'
    else if (status === 'busy') finalStatus = 'busy'
    else if (status === 'failed' || status === 'canceled') finalStatus = 'failed'

    // Determine if transferred (transfer mode + digit pressed)
    const transferred = freshCampaign.mode === 'transfer' && digitPressed && freshCampaign.activeKeys.includes(digitPressed)

    await updateLeadResult(campaignId, leadIndex, {
      status: finalStatus,
      duration: duration || 0,
      hangupCause: hangupCause || null,
      completedAt: new Date(),
      transferred,
      transferConnected: transferred, // Speechcue Dial handles this — if completed it connected
    })

    // ━━━ BILLING: Charge $BULK_CALL_RATE/min from wallet — min 1 min, whether answered or not ━━━
    if (_walletOf && freshCampaign.chatId) {
      try {
        const minutesBilled = Math.max(1, Math.ceil((duration || 0) / 60))  // minimum 1 minute always
        const charge = +(minutesBilled * BULK_CALL_RATE).toFixed(4)

        // Direct wallet deduction (bulk calls do NOT use plan minutes)
        const { atomicIncrement } = require('./db.js')
        await atomicIncrement(_walletOf, freshCampaign.chatId, 'usdOut', charge)
        // Log the payment
        if (_db) {
          const phoneLogs = _db.collection('phoneLogs')
          await phoneLogs.insertOne({
            chatId: freshCampaign.chatId,
            type: 'BulkIVR',
            direction: 'outbound',
            from: freshCampaign.callerId,
            to: freshLead?.number || 'unknown',
            duration: duration || 0,
            minutesBilled,
            charge,
            rate: BULK_CALL_RATE,
            callStatus: finalStatus,
            campaignId,
            leadIndex,
            createdAt: new Date(),
          })
        }
        log(`[BulkCall] Billed $${charge.toFixed(2)} (${minutesBilled} min × $${BULK_CALL_RATE}/min) for campaign=${campaignId} lead=${leadIndex} status=${finalStatus}`)

        // ━━━ POST-BILLING: Check if wallet is now exhausted → pause campaign ━━━
        try {
          const { usdBal } = await getBalance(_walletOf, freshCampaign.chatId)
          if (usdBal < BULK_CALL_RATE) {
            const campState = activeCampaigns[campaignId]
            if (campState && !campState.paused) {
              log(`[BulkCall] Wallet exhausted after billing ($${usdBal.toFixed(2)}) — pausing campaign ${campaignId}`)
              campState.paused = true
              await _collection.updateOne({ id: campaignId }, { $set: { status: 'paused' } })
              _bot?.sendMessage(freshCampaign.chatId,
                `⏸️ <b>Campaign Auto-Paused — Wallet Depleted</b>\n\n` +
                `Wallet: <b>$${usdBal.toFixed(2)}</b> (need $${BULK_CALL_RATE.toFixed(2)}/min per call).\n` +
                `${freshCampaign.stats?.completed || 0}/${freshCampaign.stats?.total || 0} calls completed.\n\n` +
                `Top up via 👛 Wallet to resume.`,
                { parse_mode: 'HTML' }
              ).catch(() => {})
            }
          }
        } catch (e) { log(`[BulkCall] Post-billing wallet check error: ${e.message}`) }
      } catch (billErr) {
        log(`[BulkCall] Billing error for campaign=${campaignId} lead=${leadIndex}: ${billErr.message}`)
      }
    }

    await recalcStats(campaignId)
    await sendProgressUpdate(campaignId, leadIndex, {
      status: finalStatus,
      digitPressed,
      duration: duration || 0,
      hangupCause,
      transferred,
      transferConnected: transferred,
    })

    // Fire next batch
    await fireNextBatch(campaignId)
    await checkCampaignCompletion(campaignId)
  }
}

/**
 * Recalculate campaign stats from lead results
 */
async function recalcStats(campaignId) {
  const campaign = await _collection.findOne({ id: campaignId })
  if (!campaign) return

  const stats = {
    total: campaign.leads.length,
    completed: 0,
    answered: 0,
    keyPressed: 0,
    transferred: 0,
    noAnswer: 0,
    busy: 0,
    failed: 0,
    hungUp: 0,
  }

  for (const lead of campaign.leads) {
    if (lead.status === 'pending' || lead.status === 'calling' || lead.status === 'ringing') continue
    stats.completed++
    if (lead.status === 'no_answer') stats.noAnswer++
    else if (lead.status === 'busy') stats.busy++
    else if (lead.status === 'failed') stats.failed++
    else {
      // answered/completed/transferred
      if (lead.duration > 0 || lead.status === 'answered' || lead.digitPressed) stats.answered++
      if (lead.digitPressed) stats.keyPressed++
      if (lead.transferred) stats.transferred++
      if (!lead.digitPressed && lead.duration > 0 && lead.duration < 3) stats.hungUp++
      else if (!lead.digitPressed && lead.duration > 0) stats.hungUp++
    }
  }

  await _collection.updateOne({ id: campaignId }, { $set: { stats } })
}

/**
 * Send a progress update to the bot user
 */
async function sendProgressUpdate(campaignId, leadIndex, result) {
  const campaign = await _collection.findOne({ id: campaignId })
  if (!campaign) return

  const lead = campaign.leads[leadIndex]
  const { stats } = campaign
  const displayNumber = lead?.number || '?'
  const displayName = lead?.name ? ` (${lead.name})` : ''

  // Per-call notification
  let icon = '📵'
  let statusText = 'Unknown'
  if (result.status === 'no_answer') { icon = '📵'; statusText = 'No answer' }
  else if (result.status === 'busy') { icon = '📵'; statusText = 'Busy' }
  else if (result.status === 'failed') { icon = '❌'; statusText = `Failed: ${sanitizeHangupCause(result.hangupCause)}` }
  else if (result.digitPressed) {
    icon = '🔘'
    statusText = `Pressed ${result.digitPressed}`
    if (result.transferred) statusText += result.transferConnected ? ' → Connected' : ' → Transfer attempted'
  } else if (result.duration > 0 && result.duration < 3) {
    icon = '📵'; statusText = 'Hung up immediately'
  } else if (result.duration > 0) {
    icon = '📵'; statusText = 'Listened but no key pressed'
  } else {
    statusText = sanitizeHangupCause(result.hangupCause) || 'Completed'
  }

  const durText = result.duration > 0 ? ` (${Math.floor(result.duration / 60)}:${String(result.duration % 60).padStart(2, '0')})` : ''

  // Build progress bar
  const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  const barLen = 10
  const filled = Math.round(pct / 10)
  const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled)

  const msg = `${icon} <b>${displayNumber}</b>${displayName} — ${statusText}${durText}\n` +
    `${bar} ${stats.completed}/${stats.total} (${pct}%) | ` +
    `🔘${stats.keyPressed} 📵${stats.noAnswer + stats.hungUp} ❌${stats.failed}`

  _bot?.sendMessage(campaign.chatId, msg, { parse_mode: 'HTML' }).catch(() => {})
}

/**
 * Check if a campaign is complete (all leads processed)
 */
async function checkCampaignCompletion(campaignId) {
  const campaign = await _collection.findOne({ id: campaignId })
  if (!campaign || campaign.status !== 'running') return

  const allDone = campaign.leads.every(l => !['pending', 'calling', 'ringing', 'answered'].includes(l.status))
  if (!allDone) return

  // Campaign complete!
  await _collection.updateOne({ id: campaignId }, {
    $set: { status: 'completed', completedAt: new Date() }
  })
  delete activeCampaigns[campaignId]

  log(`[BulkCall] Campaign ${campaignId} completed!`)

  // Send final report
  await sendFinalReport(campaignId)
}

/**
 * Send the final campaign report to the user
 */
async function sendFinalReport(campaignId) {
  const campaign = await _collection.findOne({ id: campaignId })
  if (!campaign) return

  const { stats, leads } = campaign
  const duration = campaign.completedAt && campaign.startedAt
    ? Math.round((new Date(campaign.completedAt) - new Date(campaign.startedAt)) / 1000)
    : 0
  const durMin = Math.floor(duration / 60)
  const durSec = duration % 60

  // Summary message
  const summary = [
    `📊 <b>Campaign Complete!</b>`,
    ``,
    `📱 Caller ID: <b>${campaign.callerId}</b>`,
    `🎵 Audio: <b>${campaign.audioName}</b>`,
    `📞 Provider: <b>Speechcue</b>`,
    `⏱ Duration: <b>${durMin}m ${durSec}s</b>`,
    ``,
    `📞 Total Calls: <b>${stats.total}</b>`,
    `✅ Answered: <b>${stats.answered}</b>`,
    `🔘 Key Pressed: <b>${stats.keyPressed}</b>`,
    campaign.mode === 'transfer' ? `🔗 Transferred: <b>${stats.transferred}</b>` : null,
    `📵 No Answer: <b>${stats.noAnswer}</b>`,
    `📵 Hung Up: <b>${stats.hungUp}</b>`,
    `🚫 Busy: <b>${stats.busy}</b>`,
    `❌ Failed: <b>${stats.failed}</b>`,
  ].filter(Boolean).join('\n')

  _bot?.sendMessage(campaign.chatId, summary, { parse_mode: 'HTML' }).catch(() => {})

  // Generate detailed report file
  try {
    const reportPath = await generateReportFile(campaign)
    if (reportPath) {
      await _bot?.sendDocument(campaign.chatId, reportPath, {
        caption: `📋 Detailed campaign report — ${stats.total} calls`,
      })
      // Clean up file after sending
      setTimeout(() => { try { fs.unlinkSync(reportPath) } catch (e) {} }, 30000)
    }
  } catch (e) {
    log(`[BulkCall] Report file error: ${e.message}`)
  }
}

/**
 * Generate a detailed CSV report file
 */
async function generateReportFile(campaign) {
  const lines = ['Number,Name,Status,Key Pressed,Duration (s),Transferred,Transfer Connected,Hangup Cause']

  for (const lead of campaign.leads) {
    lines.push([
      lead.number,
      `"${(lead.name || '').replace(/"/g, '""')}"`,
      lead.status,
      lead.digitPressed || '',
      lead.duration || 0,
      lead.transferred ? 'Yes' : 'No',
      lead.transferConnected ? 'Yes' : 'No',
      lead.hangupCause ? sanitizeHangupCause(lead.hangupCause) : '',
    ].join(','))
  }

  const filename = `campaign-report-${campaign.id.slice(0, 8)}.csv`
  const reportPath = path.join('/tmp', filename)
  fs.writeFileSync(reportPath, lines.join('\n'))
  return reportPath
}

/**
 * Cancel a running campaign
 */
async function cancelCampaign(campaignId) {
  const state = activeCampaigns[campaignId]
  if (state) state.paused = true

  await _collection.updateOne(
    { id: campaignId },
    { $set: { status: 'cancelled', completedAt: new Date() } }
  )
  delete activeCampaigns[campaignId]

  // Clean up callToCampaign mappings for this campaign
  for (const [sid, mapping] of Object.entries(callToCampaign)) {
    if (mapping.campaignId === campaignId) delete callToCampaign[sid]
  }

  log(`[BulkCall] Campaign ${campaignId} cancelled`)
  return true
}

/**
 * Pause a running campaign (stop firing new calls, let active calls finish)
 */
async function pauseCampaign(campaignId) {
  const state = activeCampaigns[campaignId]
  if (state) state.paused = true
  await _collection.updateOne({ id: campaignId }, { $set: { status: 'paused' } })
  log(`[BulkCall] Campaign ${campaignId} paused`)
  return true
}

/**
 * Get campaign by ID
 */
async function getCampaign(campaignId) {
  return _collection.findOne({ id: campaignId })
}

/**
 * Get recent campaigns for a user
 */
async function getUserCampaigns(chatId, limit = 10) {
  return _collection.find({ chatId: Number(chatId) }).sort({ createdAt: -1 }).limit(limit).toArray()
}

/**
 * Check if a callSid belongs to a bulk campaign
 */
function isBulkCall(callSid) {
  return !!callToCampaign[callSid]
}

/**
 * Get campaign mapping for a callSid
 */
function getCampaignMapping(callSid) {
  return callToCampaign[callSid] || null
}

module.exports = {
  initBulkCallService,
  parseLeadsFile,
  createCampaign,
  startCampaign,
  onDigitReceived,
  onCallStatusUpdate,
  cancelCampaign,
  pauseCampaign,
  getCampaign,
  getUserCampaigns,
  isBulkCall,
  getCampaignMapping,
  callToCampaign,
  activeCampaigns,
  BULK_CALL_RATE,
  MAX_BULK_LEADS,
}
