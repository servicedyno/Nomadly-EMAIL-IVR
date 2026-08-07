'use strict'
/**
 * NS Auto-Retry — re-applies a user's nameserver change once a freshly
 * registered domain finishes activating at the registry.
 *
 * WHY (Nomadly 48h scan 2026-08-07, user 8868602470 / rbcroyalbank.app):
 *   A .app domain was registered via OpenProvider, but the registry hadn't
 *   activated it yet. When the user immediately tried to set custom
 *   nameservers, OpenProvider rejected it 3× with code 366
 *   "This action is prohibitted for current domain status" — NS edits are
 *   locked until the domain status is ACT. The user was left retrying and
 *   failing. This module queues the requested NS change and re-applies it
 *   automatically the moment the domain becomes active, then notifies the user.
 *
 * Collection: `nsActivationRetry`
 *   { _id: domain, domainName, chatId, nameservers: [..], status:
 *     'pending'|'applied'|'failed'|'stuck', attempts, createdAt, nextCheckAt,
 *     lastStatus, lastError, appliedAt }
 */

/* global process */

// OpenProvider domain-status buckets.
const ACTIVE = new Set(['ACT', 'ACTIVE'])
const PENDING = new Set(['REQ', 'SCH', 'PEN', 'PENDING', 'REQUESTED', 'SCHEDULED', ''])
const FAILED = new Set(['FAI', 'DEL', 'FAILED', 'DELETED'])

const MAX_AGE_HOURS = parseFloat(process.env.NS_RETRY_MAX_AGE_HRS || '72')
const MAX_ATTEMPTS = parseInt(process.env.NS_RETRY_MAX_ATTEMPTS || '40', 10)
const BACKOFF_LADDER_MIN = [2, 5, 10, 15, 30, 60] // minutes between checks

/**
 * Pure decision: what to do given the domain's current OP status, how long
 * it's been queued, and how many checks we've made.
 * Returns 'apply' | 'wait' | 'giveup' | 'escalate'.
 */
function classifyAction(opStatus, ageHours = 0, attempts = 0) {
  const s = String(opStatus || '').toUpperCase()
  if (ACTIVE.has(s)) return 'apply'                       // active → push NS now
  if (FAILED.has(s)) return 'giveup'                      // registration failed → escalate + stop
  if (ageHours >= MAX_AGE_HOURS || attempts >= MAX_ATTEMPTS) return 'escalate' // stuck too long
  if (PENDING.has(s)) return 'wait'                       // still activating → back off
  return 'wait'                                           // unknown/transient → wait
}

function nextDelayMs(attempts) {
  const i = Math.min(Math.max(0, attempts), BACKOFF_LADDER_MIN.length - 1)
  return BACKOFF_LADDER_MIN[i] * 60 * 1000
}

async function enqueue(db, { domainName, chatId, nameservers, opStatus = null, lastError = null } = {}) {
  if (!db || !domainName) return { queued: false }
  const col = db.collection('nsActivationRetry')
  const nowD = new Date()
  await col.updateOne(
    { _id: domainName },
    {
      $set: {
        _id: domainName,
        domainName,
        chatId: String(chatId || ''),
        nameservers: Array.isArray(nameservers) ? nameservers : [],
        status: 'pending',
        lastError,
        lastStatus: opStatus,
        nextCheckAt: new Date(nowD.getTime() + nextDelayMs(0)),
        updatedAt: nowD,
      },
      $setOnInsert: { createdAt: nowD, attempts: 0 },
    },
    { upsert: true }
  )
  return { queued: true }
}

/**
 * Process a single queued row. `deps` is injected so this is unit-testable:
 *   { getDomainInfo, updateNameservers, sendMessage, notifyAdmin, log }
 */
async function processOne(db, deps, row) {
  const col = db.collection('nsActivationRetry')
  const domain = row.domainName || row._id
  const attempts = row.attempts || 0
  const ageHours = (Date.now() - new Date(row.createdAt || Date.now()).getTime()) / 3600000
  const nowD = new Date()

  let info = null
  try { info = await deps.getDomainInfo(domain) } catch (e) { info = null }
  const opStatus = info?.status || info?.domainData?.status || null
  const action = classifyAction(opStatus, ageHours, attempts)

  if (action === 'apply') {
    let ok = false
    let err = null
    try {
      const res = await deps.updateNameservers(domain, row.nameservers || [])
      ok = !(res && res.error)
      err = res && res.error
    } catch (e) { err = e.message }

    if (ok) {
      await col.updateOne({ _id: domain }, { $set: { status: 'applied', appliedAt: nowD, lastStatus: opStatus, updatedAt: nowD } })
      if (deps.sendMessage && row.chatId) {
        const nsLines = (row.nameservers || []).map((n, i) => `NS${i + 1}: <code>${n}</code>`).join('\n')
        try {
          deps.sendMessage(row.chatId, `✅ Good news — <b>${domain}</b> is now active and your nameservers have been applied automatically:\n${nsLines}\n\n⏱ DNS may take a little while to propagate.`, { parse_mode: 'HTML' })
        } catch (_) { /* non-fatal */ }
      }
      return { domain, action: 'applied', opStatus }
    }
    // Active but the push still errored → back off and retry.
    await col.updateOne({ _id: domain }, { $set: { attempts: attempts + 1, lastError: err, lastStatus: opStatus, nextCheckAt: new Date(nowD.getTime() + nextDelayMs(attempts + 1)), updatedAt: nowD } })
    return { domain, action: 'apply-retry', error: err, opStatus }
  }

  if (action === 'giveup' || action === 'escalate') {
    const newStatus = action === 'giveup' ? 'failed' : 'stuck'
    await col.updateOne({ _id: domain }, { $set: { status: newStatus, lastStatus: opStatus, updatedAt: nowD } })
    if (deps.notifyAdmin) {
      try { deps.notifyAdmin(`⚠️ [NS Auto-Retry] ${action.toUpperCase()}: <code>${domain}</code> opStatus=${opStatus || '?'} attempts=${attempts} age=${ageHours.toFixed(1)}h owner=${row.chatId || '?'}`) } catch (_) { /* noop */ }
    }
    return { domain, action, opStatus }
  }

  // wait
  await col.updateOne({ _id: domain }, { $set: { attempts: attempts + 1, lastStatus: opStatus, nextCheckAt: new Date(nowD.getTime() + nextDelayMs(attempts + 1)), updatedAt: nowD } })
  return { domain, action: 'wait', opStatus }
}

async function tick(db, deps) {
  const col = db.collection('nsActivationRetry')
  const due = await col.find({ status: 'pending', nextCheckAt: { $lte: new Date() } }).limit(50).toArray()
  const out = []
  for (const row of due) {
    try { out.push(await processOne(db, deps, row)) }
    catch (e) { (deps.log || console.log)(`[NS Auto-Retry] processOne(${row._id}) crashed: ${e.message}`) }
  }
  if (out.length) (deps.log || console.log)(`[NS Auto-Retry] tick processed ${out.length} row(s)`)
  return out
}

function startScheduler(db, deps = {}) {
  const log = deps.log || ((...a) => console.log('[NS Auto-Retry]', ...a))
  // Sandbox safety: only the production instance processes the queue + messages
  // users, so a dev/sandbox pod sharing the same DB never double-applies NS or
  // spams users (mirrors the phone-monitor SKIP_WEBHOOK_SYNC gate).
  if (String(process.env.SKIP_WEBHOOK_SYNC || '').toLowerCase() === 'true') {
    log('SKIP_WEBHOOK_SYNC=true → NS auto-retry scheduler DISABLED on this pod')
    return
  }
  const intervalMs = parseInt(process.env.NS_RETRY_INTERVAL_MS || '120000', 10)
  setInterval(() => {
    tick(db, deps).catch((e) => log(`tick crashed: ${e.message}`))
  }, intervalMs)
  log(`scheduler started (every ${Math.round(intervalMs / 1000)}s)`)
}

module.exports = {
  enqueue,
  processOne,
  tick,
  startScheduler,
  classifyAction,
  nextDelayMs,
  _sets: { ACTIVE, PENDING, FAILED },
}
