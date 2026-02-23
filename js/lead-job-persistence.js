/**
 * Lead Job Persistence — Survives deployments
 * 
 * Saves lead generation job state to MongoDB so interrupted jobs
 * can resume after redeployment (SIGTERM).
 */

const { log } = require('console')

let _db = null
const COLLECTION = 'leadJobs'
const SAVE_INTERVAL_MS = 10_000 // Save progress every 10 seconds
const activeJobs = new Map()     // jobId → interval timer

function initLeadJobPersistence(db) {
  _db = db
  db.collection(COLLECTION).createIndex({ status: 1 }).catch(() => {})
  db.collection(COLLECTION).createIndex({ chatId: 1, status: 1 }).catch(() => {})
  log('[LeadJobs] Persistence initialized')
}

/**
 * Create a new job before starting generation
 */
async function createJob({ chatId, carrier, phonesToGenerate, countryCode, areaCodes, cnam, requireRealName, target, price, lang }) {
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
 */
function startPeriodicSave(jobId, getState) {
  if (activeJobs.has(jobId)) return
  const timer = setInterval(async () => {
    const { results, realNameCount } = getState()
    await saveProgress(jobId, results, realNameCount)
  }, SAVE_INTERVAL_MS)
  activeJobs.set(jobId, { timer, getState })
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
 * Find all interrupted/orphaned jobs
 * Covers both cases:
 *  - 'interrupted': SIGTERM handler flushed before shutdown
 *  - 'running': process was killed before SIGTERM handler could flush
 */
async function findInterruptedJobs() {
  if (!_db) return []
  return _db.collection(COLLECTION).find({ status: { $in: ['running', 'interrupted'] } }).toArray()
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
  findInterruptedJobs,
  flushAllJobs,
}
