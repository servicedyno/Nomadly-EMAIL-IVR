/**
 * Lead Job Persistence — Survives deployments
 * 
 * Saves lead generation job state to MongoDB so interrupted jobs
 * can resume after redeployment (SIGTERM).
 */

const { log } = require('console')

let _db = null
const COLLECTION = 'leadJobs'
const SAVE_INTERVAL_MS = Number(process.env.LEAD_JOB_SAVE_INTERVAL_MS) || 10_000 // Save progress every 10 seconds
// ── Silent-stall detector ──
// If a job's results.length hasn't grown for STALL_THRESHOLD_MS, fire onStall
// callback once (re-arms when progress resumes). Catches cases where the bot is
// alive but provider APIs (Telnyx CNAM, Alcazar, etc.) are silently down — the
// hard phoneGenTimeout would otherwise let the user wait the full 90+ min.
const STALL_THRESHOLD_MS = Number(process.env.LEAD_JOB_STALL_THRESHOLD_MS) || 120_000 // 120 s
const activeJobs = new Map()     // jobId → interval timer + stall state

function initLeadJobPersistence(db) {
  _db = db
  db.collection(COLLECTION).createIndex({ status: 1 }).catch(() => {})
  db.collection(COLLECTION).createIndex({ chatId: 1, status: 1 }).catch(() => {})
  log('[LeadJobs] Persistence initialized')
}

/**
 * Create a new job before starting generation
 */
async function createJob({ chatId, carrier, phonesToGenerate, countryCode, areaCodes, cnam, requireRealName, target, price, lang, walletDeducted, paymentCoin }) {
  if (!_db) return null
  const jobId = require('crypto').randomUUID()
  const job = {
    jobId,
    chatId,
    carrier,
    phonesToGenerate,
    countryCode,
    areaCodes,
    cnam,
    requireRealName,
    target: target || 'unknown',
    price: price || 0,
    lang: lang || 'en',
    walletDeducted: walletDeducted || false,
    paymentCoin: paymentCoin || null,
    status: 'running',       // running | completed | failed | interrupted
    results: [],             // accumulated leads
    realNameCount: 0,
    totalGenerated: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await _db.collection(COLLECTION).insertOne(job)
  log(`[LeadJobs] Created job ${jobId} for chatId ${chatId} — ${phonesToGenerate} leads`)
  return jobId
}

/**
 * Save progress (called periodically + on SIGTERM)
 */
async function saveProgress(jobId, results, realNameCount) {
  if (!_db || !jobId) return
  try {
    await _db.collection(COLLECTION).updateOne(
      { jobId },
      {
        $set: {
          results,
          realNameCount,
          totalGenerated: results.length,
          updatedAt: new Date(),
        }
      }
    )
  } catch (e) {
    log(`[LeadJobs] Save progress error: ${e.message}`)
  }
}

/**
 * Start periodic saving for a job
 * @param {string} jobId
 * @param {() => {results: any[], realNameCount: number}} getState
 * @param {(info: {jobId: string, stalledForSec: number, currentCount: number, targetCount: number, chatId?: any, target?: string}) => void} [onStall]
 *        Optional callback fired ONCE when results.length stops growing for
 *        STALL_THRESHOLD_MS. Re-arms when progress resumes.
 * @param {{chatId?: any, target?: string, targetCount?: number, onRecover?: (info: {jobId: string, stalledForSec: number, currentCount: number, targetCount: number, chatId?: any, target?: string}) => void}} [meta]
 *        Optional metadata + onRecover callback fired ONCE when results.length
 *        grows again after a stall alert was emitted (closes the loop).
 */
function startPeriodicSave(jobId, getState, onStall, meta = {}) {
  if (activeJobs.has(jobId)) return
  const initial = getState() || { results: [] }
  const state = {
    lastProgressCount: (initial.results || []).length,
    lastProgressAt: Date.now(),
    stallAlerted: false,
    stallStartedAt: null, // Set when stall fires; cleared on recovery.
  }
  const timer = setInterval(async () => {
    const { results, realNameCount } = getState()
    await saveProgress(jobId, results, realNameCount)

    // ── Stall detection ──
    const currentCount = (results || []).length
    if (currentCount > state.lastProgressCount) {
      // Progress made.
      if (state.stallAlerted) {
        const recoveredAfterSec = state.stallStartedAt
          ? Math.round((Date.now() - state.stallStartedAt) / 1000)
          : 0
        log(`[LeadJobs] ✅ STALL RESOLVED: job ${jobId} resumed at ${currentCount} leads after ${recoveredAfterSec}s stall`)
        if (typeof meta.onRecover === 'function') {
          try {
            meta.onRecover({
              jobId,
              stalledForSec: recoveredAfterSec,
              currentCount,
              targetCount: meta.targetCount,
              chatId: meta.chatId,
              target: meta.target,
            })
          } catch (e) {
            log(`[LeadJobs] onRecover callback error: ${e.message}`)
          }
        }
        state.stallAlerted = false
        state.stallStartedAt = null
      }
      state.lastProgressCount = currentCount
      state.lastProgressAt = Date.now()
      return
    }
    const stalledMs = Date.now() - state.lastProgressAt
    if (stalledMs >= STALL_THRESHOLD_MS && !state.stallAlerted) {
      state.stallAlerted = true
      state.stallStartedAt = state.lastProgressAt
      const stalledForSec = Math.round(stalledMs / 1000)
      log(`[LeadJobs] ⚠️ STALL DETECTED: job ${jobId} no progress for ${stalledForSec}s (stuck at ${currentCount}/${meta.targetCount || '?'} leads)`)
      if (typeof onStall === 'function') {
        try {
          onStall({
            jobId,
            stalledForSec,
            currentCount,
            targetCount: meta.targetCount,
            chatId: meta.chatId,
            target: meta.target,
          })
        } catch (e) {
          log(`[LeadJobs] onStall callback error: ${e.message}`)
        }
      }
    }
  }, SAVE_INTERVAL_MS)
  activeJobs.set(jobId, { timer, getState, state })
}

/**
 * Stop periodic saving
 */
function stopPeriodicSave(jobId) {
  const entry = activeJobs.get(jobId)
  if (entry) {
    clearInterval(entry.timer)
    activeJobs.delete(jobId)
  }
}

/**
 * Mark job as completed
 */
async function completeJob(jobId, results, realNameCount) {
  stopPeriodicSave(jobId)
  if (!_db || !jobId) return
  await _db.collection(COLLECTION).updateOne(
    { jobId },
    {
      $set: {
        status: 'completed',
        results,
        realNameCount,
        totalGenerated: results.length,
        completedAt: new Date(),
        updatedAt: new Date(),
      }
    }
  )
  log(`[LeadJobs] Job ${jobId} completed — ${results.length} leads, ${realNameCount} real names`)
}

/**
 * Mark job as failed
 */
async function failJob(jobId, reason) {
  stopPeriodicSave(jobId)
  if (!_db || !jobId) return
  await _db.collection(COLLECTION).updateOne(
    { jobId },
    { $set: { status: 'failed', failReason: reason, updatedAt: new Date() } }
  )
}

/**
 * Mark job as resuming (called before re-entering the generation loop)
 */
async function resumeJob(jobId) {
  if (!_db || !jobId) return
  await _db.collection(COLLECTION).updateOne(
    { jobId },
    { $set: { status: 'running', resumedAt: new Date(), updatedAt: new Date() } }
  )
  log(`[LeadJobs] Job ${jobId} status → running (resumed)`)
}

/**
 * Find all interrupted/orphaned jobs
 * Covers both cases:
 *  - 'interrupted': SIGTERM handler flushed before shutdown
 *  - 'running': process was killed before SIGTERM handler could flush
 */
async function findInterruptedJobs() {
  if (!_db) return []
  return _db.collection(COLLECTION).find({ status: { $in: ['running', 'interrupted', 'resume_error'] } }).toArray()
}

/**
 * Flush all active job progress to DB (called on SIGTERM)
 */
async function flushAllJobs() {
  const promises = []
  for (const [jobId, { timer, getState }] of activeJobs) {
    const { results, realNameCount } = getState()
    promises.push(
      _db.collection(COLLECTION).updateOne(
        { jobId },
        {
          $set: {
            status: 'interrupted',
            results,
            realNameCount,
            totalGenerated: results.length,
            interruptedAt: new Date(),
            updatedAt: new Date(),
          }
        }
      ).catch(e => log(`[LeadJobs] Flush error for ${jobId}: ${e.message}`))
    )
    clearInterval(timer)
  }
  if (promises.length > 0) {
    await Promise.allSettled(promises)
    log(`[LeadJobs] Flushed ${promises.length} active jobs to DB`)
  }
  activeJobs.clear()
}

module.exports = {
  initLeadJobPersistence,
  createJob,
  saveProgress,
  startPeriodicSave,
  stopPeriodicSave,
  completeJob,
  failJob,
  resumeJob,
  findInterruptedJobs,
  flushAllJobs,
}
