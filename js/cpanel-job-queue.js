/* global process */
/**
 * cPanel Pending-Jobs Queue
 * --------------------------
 * Persistent queue (MongoDB-backed) for any cPanel/WHM-touching action that we
 * don't want to fail in front of the user when the control plane is down.
 *
 * Two callers:
 *   1) Post-payment provisioning (NEW user just paid)
 *      - The user MUST NOT see "server down". They see: "Your hosting is being
 *        prepared, you'll get login details shortly". Worker creates the cPanel
 *        account + delivers credentials the moment WHM comes back.
 *
 *   2) Existing-user mutations (file save / addon-link / suspend / cancel)
 *      - User sees: "Your request is being processed and will complete in the
 *        background — we'll notify you when it's done". Worker replays the
 *        action and DMs success.
 *
 * Read-only ops (list-files, list-domains) are NEVER queued — caller renders a
 * friendly waiting state synchronously instead.
 *
 * Storage: collection `cpanelPendingJobs`
 *   {
 *     _id, type, status: 'pending'|'running'|'done'|'failed',
 *     chatId, lang, params, createdAt, updatedAt,
 *     attempts, lastError, completedAt,
 *     // for provisioning only:
 *     domain, plan
 *   }
 */

const { log } = require('console')
const cpHealth = require('./cpanel-health')

const COLLECTION = 'cpanelPendingJobs'
const MAX_ATTEMPTS = 1000          // effectively "until WHM comes back" (probe gates this)
const ESCALATE_AFTER_MS = 24 * 60 * 60 * 1000  // alert admin if a job stays pending >24h
const RUN_INTERVAL_MS = 30 * 1000

// ─── Job-type registry ──────────────────────────────────
//
// Each handler receives:
//   {
//     job,                  // full job document from Mongo
//     deps: {                // injected by init()
//       db,                 // Mongo db
//       send,                // (chatId, message, options) => void (telegram)
//       notifyAdmin,         // (text) => void
//       collections: { cpanelAccountsCol, stateCol, ... },
//     }
//   }
// and must return an object: { ok: true, retain?: false } on success
// or { ok: false, deferred: true, reason } if WHM still down (retry later)
// or { ok: false, deferred: false, reason } on hard error (escalate to admin).

const handlers = {}

function registerHandler(type, fn) { handlers[type] = fn }

// ─── Init / wiring ──────────────────────────────────────

let _deps = null
let _col = null
let _runHandle = null
let _draining = false

function init(deps) {
  // deps: { db, bot, send, notifyAdmin }
  if (!deps || !deps.db) throw new Error('cpanel-job-queue.init: db is required')
  _deps = deps
  _col = deps.db.collection(COLLECTION)
  // Indexes are best-effort
  _col.createIndex({ status: 1, createdAt: 1 }).catch(() => {})
  _col.createIndex({ chatId: 1 }).catch(() => {})

  // Any time WHM transitions up, kick a drain
  cpHealth.onUp(() => {
    log('[cPanel Queue] WHM is UP — draining pending jobs')
    drain().catch(e => log(`[cPanel Queue] drain error: ${e.message}`))
  })
  cpHealth.onDown(() => {
    log('[cPanel Queue] WHM went DOWN — pausing job runs (probe will resume them)')
  })
}

/**
 * Background runner — wakes every RUN_INTERVAL_MS to attempt a drain.
 * Idempotent.
 */
function startWorker() {
  if (_runHandle) return
  _runHandle = setInterval(() => {
    drain().catch(e => log(`[cPanel Queue] tick drain error: ${e.message}`))
  }, RUN_INTERVAL_MS)
  if (typeof _runHandle.unref === 'function') _runHandle.unref()
  log('[cPanel Queue] worker started')
}

function stopWorker() {
  if (_runHandle) { clearInterval(_runHandle); _runHandle = null }
}

// ─── Public API ─────────────────────────────────────────

/**
 * Enqueue a job. Returns the inserted job document.
 */
async function enqueue({ type, chatId, lang = 'en', params = {}, dedupeKey, domain = null, plan = null }) {
  if (!_col) throw new Error('cpanel-job-queue not initialised — call init() first')
  if (!type) throw new Error('enqueue: type is required')

  // Dedup: if a pending/running job with the same dedupeKey already exists, return that.
  if (dedupeKey) {
    const existing = await _col.findOne({ dedupeKey, status: { $in: ['pending', 'running'] } })
    if (existing) {
      log(`[cPanel Queue] dedupe hit for ${dedupeKey} — returning existing job ${existing._id}`)
      return existing
    }
  }

  const now = new Date()
  const doc = {
    type,
    status: 'pending',
    chatId: chatId != null ? String(chatId) : null,
    lang,
    params,
    dedupeKey: dedupeKey || null,
    domain,
    plan,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    lastError: null,
    completedAt: null,
    escalated: false,
  }
  const ins = await _col.insertOne(doc)
  doc._id = ins.insertedId
  log(`[cPanel Queue] enqueued ${type} for chat=${chatId} domain=${domain || '-'} job=${doc._id}`)

  // Best-effort kick — if WHM is up right now, try immediately
  setImmediate(() => drain().catch(() => {}))
  return doc
}

/**
 * Drain pending jobs in FIFO order (oldest first).
 * Skips entirely if WHM is known-down (waits for the next probe).
 */
async function drain() {
  if (_draining) return
  if (!_col) return
  _draining = true
  try {
    // If WHM looks down right now, do nothing — we'll be woken by the up-event.
    const reachable = await cpHealth.isWhmReachable()
    if (!reachable) return

    while (true) {
      const job = await _col.findOneAndUpdate(
        { status: 'pending' },
        { $set: { status: 'running', updatedAt: new Date() }, $inc: { attempts: 1 } },
        { sort: { createdAt: 1 }, returnDocument: 'after' },
      )
      const claimed = job && (job.value || job)
      // mongo driver v4 returns { value: ... }; v5+ returns the doc directly
      const doc = claimed?.value || claimed
      if (!doc || !doc._id) break

      const handler = handlers[doc.type]
      if (!handler) {
        log(`[cPanel Queue] no handler for type=${doc.type} — marking failed`)
        await _col.updateOne({ _id: doc._id }, { $set: { status: 'failed', lastError: `no handler for ${doc.type}`, updatedAt: new Date() } })
        await _maybeEscalate(doc, `no handler for ${doc.type}`)
        continue
      }

      let result
      try {
        result = await handler({ job: doc, deps: _deps })
      } catch (err) {
        result = { ok: false, deferred: false, reason: err.message }
      }

      if (result?.ok) {
        await _col.updateOne(
          { _id: doc._id },
          { $set: { status: 'done', completedAt: new Date(), updatedAt: new Date(), lastError: null } }
        )
        log(`[cPanel Queue] ✅ ${doc.type} #${doc._id} completed (chat=${doc.chatId})`)
      } else if (result?.deferred) {
        // Soft failure — WHM transient. Re-mark pending; abort this drain pass
        await _col.updateOne(
          { _id: doc._id },
          { $set: { status: 'pending', lastError: result.reason || 'deferred', updatedAt: new Date() } }
        )
        log(`[cPanel Queue] ↩️ ${doc.type} #${doc._id} deferred (${result.reason}) — pausing drain`)
        break // stop drain; will resume on next probe
      } else {
        // Hard failure
        await _col.updateOne(
          { _id: doc._id },
          { $set: { status: 'failed', lastError: result?.reason || 'unknown', updatedAt: new Date() } }
        )
        log(`[cPanel Queue] ❌ ${doc.type} #${doc._id} hard failure: ${result?.reason}`)
        await _maybeEscalate(doc, result?.reason)
      }
    }

    // After a clean drain, escalate stale-pending (e.g. license still down >24h)
    await _checkStalePending()
  } finally {
    _draining = false
  }
}

async function _maybeEscalate(doc, reason) {
  if (!_deps?.notifyAdmin) return
  if (doc.escalated) return
  try {
    _deps.notifyAdmin(
      `🚨 <b>cPanel job failed permanently</b>\n` +
      `Type: <code>${doc.type}</code>\n` +
      `Chat: <code>${doc.chatId}</code>\n` +
      `Domain: <code>${doc.domain || '-'}</code>\n` +
      `Attempts: ${doc.attempts}\n` +
      `Reason: <code>${reason || 'unknown'}</code>\n` +
      `Job: <code>${doc._id}</code>`
    )
    await _col.updateOne({ _id: doc._id }, { $set: { escalated: true } })
  } catch (e) { log(`[cPanel Queue] escalate notify error: ${e.message}`) }
}

async function _checkStalePending() {
  if (!_col || !_deps?.notifyAdmin) return
  try {
    const cutoff = new Date(Date.now() - ESCALATE_AFTER_MS)
    const stale = await _col.find({ status: 'pending', createdAt: { $lt: cutoff }, escalated: { $ne: true } }).limit(5).toArray()
    for (const doc of stale) {
      _deps.notifyAdmin(
        `⏳ <b>cPanel job stuck >24h</b>\n` +
        `Type: <code>${doc.type}</code>\n` +
        `Chat: <code>${doc.chatId}</code>\n` +
        `Domain: <code>${doc.domain || '-'}</code>\n` +
        `Created: <code>${doc.createdAt?.toISOString?.() || doc.createdAt}</code>\n` +
        `Last error: <code>${doc.lastError || '-'}</code>\n` +
        `<i>Likely WHM/license still unhealthy — check /hostingstatus</i>`
      )
      await _col.updateOne({ _id: doc._id }, { $set: { escalated: true } })
    }
  } catch (e) { log(`[cPanel Queue] stale check error: ${e.message}`) }
}

// ─── Stats / introspection ──────────────────────────────

async function getStats() {
  if (!_col) return { initialised: false }
  const [pending, running, done, failed, oldest] = await Promise.all([
    _col.countDocuments({ status: 'pending' }),
    _col.countDocuments({ status: 'running' }),
    _col.countDocuments({ status: 'done' }),
    _col.countDocuments({ status: 'failed' }),
    _col.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(1).toArray().then(a => a[0] || null),
  ])
  return {
    initialised: true,
    pending, running, done, failed,
    oldestPendingAt: oldest?.createdAt || null,
    oldestPendingType: oldest?.type || null,
    oldestPendingDomain: oldest?.domain || null,
  }
}

module.exports = {
  init,
  startWorker,
  stopWorker,
  enqueue,
  drain,
  getStats,
  registerHandler,
  // exposed for tests
  _COLLECTION: COLLECTION,
}
