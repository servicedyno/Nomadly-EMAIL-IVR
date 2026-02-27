// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Bulk Call Campaign Service — Launch, manage, and report on multi-call campaigns
// Handles concurrent call queues, per-lead result tracking, and final reporting
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { log } = require('console')

let _db = null
let _collection = null
let _bot = null
let _voiceService = null

// Active campaigns in memory: campaignId → { queue state }
const activeCampaigns = {}

// Map: callControlId → { campaignId, leadIndex }
const callToCampaign = {}

/**
 * Initialize bulk call service
 */
async function initBulkCallService(db, bot, voiceService) {
  _db = db
  _bot = bot
  _voiceService = voiceService
  _collection = db.collection('bulkCallCampaigns')
  await _collection.createIndex({ chatId: 1 })
  await _collection.createIndex({ id: 1 }, { unique: true })
  await _collection.createIndex({ status: 1 })
  log('[BulkCall] Service initialized')
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
  const { chatId, callerId, audioUrl, audioName, mode, transferNumber, activeKeys, concurrency, holdMusic, leads } = params

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
    leads: leads.map((l, i) => ({
      index: i,
      number: l.number,
      name: l.name,
      status: 'pending', // pending|calling|ringing|answered|completed|no_answer|busy|failed
      digitPressed: null,
      transferred: false,
      transferConnected: false,
      duration: 0,
      callControlId: null,
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
 * Start a campaign — begin dialing leads
 */
async function startCampaign(campaignId) {
  const campaign = await _collection.findOne({ id: campaignId })
  if (!campaign) return { error: 'Campaign not found' }
  if (campaign.status === 'running') return { error: 'Campaign already running' }

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
    `⚡ Concurrency: <b>${campaign.concurrency}</b>\n` +
    `📊 Mode: <b>${campaign.mode === 'transfer' ? '🔗 Transfer + Report' : '📊 Report Only'}</b>\n\n` +
    `Dialing now... You'll receive updates as calls complete.`,
    { parse_mode: 'HTML' }
  ).catch(() => {})

  // Fire initial batch
  await fireNextBatch(campaignId)
  return { success: true }
}

/**
 * Fire the next batch of calls up to concurrency limit
 */
async function fireNextBatch(campaignId) {
  const state = activeCampaigns[campaignId]
  if (!state || state.paused) return

  const campaign = await _collection.findOne({ id: campaignId })
  if (!campaign || campaign.status !== 'running') return

  const available = campaign.concurrency - state.activeCalls
  if (available <= 0) return

  // Find pending leads
  const pendingLeads = campaign.leads.filter(l => l.status === 'pending')
  const toFire = pendingLeads.slice(0, available)

  for (const lead of toFire) {
    state.activeCalls++

    try {
      const result = await _voiceService.initiateOutboundIvrCall({
        chatId: campaign.chatId,
        callerId: campaign.callerId,
        targetNumber: lead.number,
        ivrNumber: campaign.transferNumber || campaign.callerId, // fallback to callerId
        audioUrl: campaign.audioUrl,
        activeKeys: campaign.activeKeys,
        templateName: `Bulk Campaign`,
        placeholderValues: {},
        voiceName: 'Campaign',
        isTrial: false,
        holdMusic: campaign.holdMusic,
        // Bulk campaign metadata
        campaignId: campaignId,
        leadIndex: lead.index,
        bulkMode: campaign.mode, // 'transfer' or 'report_only'
      })

      if (result.error) {
        state.activeCalls--
        await updateLeadResult(campaignId, lead.index, {
          status: 'failed',
          hangupCause: result.error,
          completedAt: new Date(),
        })
        log(`[BulkCall] Call failed for ${lead.number}: ${result.error}`)
      } else {
        // Map callControlId to campaign
        callToCampaign[result.callControlId] = { campaignId, leadIndex: lead.index }
        await updateLeadResult(campaignId, lead.index, {
          status: 'calling',
          callControlId: result.callControlId,
          startedAt: new Date(),
        })
      }
    } catch (e) {
      state.activeCalls--
      await updateLeadResult(campaignId, lead.index, {
        status: 'failed',
        hangupCause: e.message,
        completedAt: new Date(),
      })
      log(`[BulkCall] Call error for ${lead.number}: ${e.message}`)
    }
  }

  // Check if all calls have been attempted and none are active
  await checkCampaignCompletion(campaignId)
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
 * Called by voice-service when a bulk campaign call completes (hangup)
 * @param {string} callControlId
 * @param {object} result - { status, digitPressed, duration, hangupCause, transferred, transferConnected }
 */
async function onCallComplete(callControlId, result) {
  const mapping = callToCampaign[callControlId]
  if (!mapping) return false

  const { campaignId, leadIndex } = mapping
  delete callToCampaign[callControlId]

  const state = activeCampaigns[campaignId]
  if (state) state.activeCalls = Math.max(0, state.activeCalls - 1)

  // Update lead result
  await updateLeadResult(campaignId, leadIndex, {
    status: result.status || 'completed',
    digitPressed: result.digitPressed || null,
    transferred: result.transferred || false,
    transferConnected: result.transferConnected || false,
    duration: result.duration || 0,
    answeredAt: result.answeredAt || null,
    completedAt: new Date(),
    hangupCause: result.hangupCause || null,
  })

  // Update campaign stats
  await recalcStats(campaignId)

  // Send progress update
  await sendProgressUpdate(campaignId, leadIndex, result)

  // Fire next calls
  await fireNextBatch(campaignId)

  // Check if campaign is complete
  await checkCampaignCompletion(campaignId)

  return true
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
      stats.answered++
      if (lead.digitPressed) stats.keyPressed++
      if (lead.transferred) stats.transferred++
      if (!lead.digitPressed && lead.duration > 0) stats.hungUp++
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
  else if (result.status === 'failed') { icon = '❌'; statusText = `Failed: ${result.hangupCause || 'unknown'}` }
  else if (result.digitPressed) {
    icon = '🔘'
    statusText = `Pressed ${result.digitPressed}`
    if (result.transferred) statusText += result.transferConnected ? ' → Connected' : ' → Transfer attempted'
  } else if (result.duration > 0 && result.duration < 3) {
    icon = '📵'; statusText = 'Hung up immediately'
  } else if (result.duration > 0) {
    icon = '📵'; statusText = 'Listened but no key pressed'
  } else {
    statusText = result.hangupCause || 'Completed'
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
      lead.hangupCause || '',
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
  for (const [ccId, mapping] of Object.entries(callToCampaign)) {
    if (mapping.campaignId === campaignId) delete callToCampaign[ccId]
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
 * Check if a callControlId belongs to a bulk campaign
 */
function isBulkCall(callControlId) {
  return !!callToCampaign[callControlId]
}

/**
 * Get campaign mapping for a callControlId
 */
function getCampaignMapping(callControlId) {
  return callToCampaign[callControlId] || null
}

module.exports = {
  initBulkCallService,
  parseLeadsFile,
  createCampaign,
  startCampaign,
  onCallComplete,
  cancelCampaign,
  pauseCampaign,
  getCampaign,
  getUserCampaigns,
  isBulkCall,
  getCampaignMapping,
  callToCampaign,
  activeCampaigns,
}
