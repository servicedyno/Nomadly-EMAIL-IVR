/**
 * Shortener Activation Persistence — Survives deployments
 *
 * Tracks the multi-step shortener activation process so it can
 * resume from the last completed step after a deployment restart.
 *
 * Steps: pending → railway_linked → dns_added → completed
 */
const { log } = require('console')

const COLLECTION = 'shortenerActivations'
let _db = null

function initShortenerPersistence(db) {
  _db = db
  log('[ShortenerPersistence] Initialized')
}

/**
 * Create a new activation task (step 1 — before Railway linking)
 */
async function createActivationTask(chatId, domain, lang) {
  if (!_db) return null
  const task = {
    _id: domain,
    chatId: String(chatId),
    domain,
    status: 'pending',
    server: null,
    recordType: null,
    lang: lang || 'en',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await _db.collection(COLLECTION).updateOne(
    { _id: domain },
    { $set: task },
    { upsert: true }
  )
  log(`[ShortenerPersistence] Task created for ${domain} (chatId: ${chatId})`)
  return domain
}

/**
 * Mark Railway linking complete (step 2 — CNAME obtained)
 */
async function markRailwayLinked(domain, server, recordType) {
  if (!_db) return
  await _db.collection(COLLECTION).updateOne(
    { _id: domain },
    { $set: { status: 'railway_linked', server, recordType, updatedAt: new Date() } }
  )
  log(`[ShortenerPersistence] ${domain} → railway_linked (${recordType} → ${server})`)
}

/**
 * Mark DNS record added (step 3)
 */
async function markDnsAdded(domain) {
  if (!_db) return
  await _db.collection(COLLECTION).updateOne(
    { _id: domain },
    { $set: { status: 'dns_added', updatedAt: new Date() } }
  )
  log(`[ShortenerPersistence] ${domain} → dns_added`)
}

/**
 * Mark activation fully completed (step 4 — user notified)
 */
async function markCompleted(domain) {
  if (!_db) return
  await _db.collection(COLLECTION).updateOne(
    { _id: domain },
    { $set: { status: 'completed', completedAt: new Date(), updatedAt: new Date() } }
  )
  log(`[ShortenerPersistence] ${domain} → completed`)
}

/**
 * Mark activation failed
 */
async function markFailed(domain, error) {
  if (!_db) return
  await _db.collection(COLLECTION).updateOne(
    { _id: domain },
    { $set: { status: 'failed', error, updatedAt: new Date() } }
  )
}

/**
 * Find all incomplete activation tasks
 * Returns tasks that are pending, railway_linked, or dns_added
 */
async function findIncompleteTasks() {
  if (!_db) return []
  return _db.collection(COLLECTION).find({
    status: { $in: ['pending', 'railway_linked', 'dns_added'] }
  }).toArray()
}

module.exports = {
  initShortenerPersistence,
  createActivationTask,
  markRailwayLinked,
  markDnsAdded,
  markCompleted,
  markFailed,
  findIncompleteTasks,
}
