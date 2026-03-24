/**
 * Email Validation Service — Bulk orchestrator with job persistence
 *
 * Handles the full lifecycle:
 *   1. Create validation job
 *   2. Process through 7-layer engine
 *   3. Track progress + notify user
 *   4. Generate result files (CSV)
 *   5. Deliver to user via Telegram
 */

const { validateEmailBatch, parseEmailList } = require('./email-validation.js')
const { EV_CONFIG, calculatePrice } = require('./email-validation-config.js')
const crypto = require('crypto')

const COLLECTION = 'emailValidationJobs'
let _db = null
let _bot = null

function initEmailValidationService(db, bot) {
  _db = db
  _bot = bot
  db.collection(COLLECTION).createIndex({ status: 1 }).catch(() => {})
  db.collection(COLLECTION).createIndex({ chatId: 1, status: 1 }).catch(() => {})
  db.collection(COLLECTION).createIndex({ createdAt: -1 }).catch(() => {})
  console.log('[EmailValidation] Service initialized')
}

// ═══════════════════════════════════════
// Job Management
// ═══════════════════════════════════════

async function createJob(chatId, emails, price, paymentMethod) {
  if (!_db) throw new Error('Service not initialized')
  const jobId = crypto.randomUUID()
  const job = {
    jobId,
    chatId,
    totalEmails: emails.length,
    price,
    paymentMethod,
    status: 'processing',  // processing | completed | failed
    progress: 0,
    results: null,
    summary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  }
  await _db.collection(COLLECTION).insertOne(job)
  return jobId
}

async function updateJobProgress(jobId, progress) {
  if (!_db) return
  await _db.collection(COLLECTION).updateOne(
    { jobId },
    { $set: { progress, updatedAt: new Date() } }
  )
}

async function completeJob(jobId, summary) {
  if (!_db) return
  await _db.collection(COLLECTION).updateOne(
    { jobId },
    { $set: { status: 'completed', progress: 100, summary, completedAt: new Date(), updatedAt: new Date() } }
  )
}

async function failJob(jobId, error) {
  if (!_db) return
  await _db.collection(COLLECTION).updateOne(
    { jobId },
    { $set: { status: 'failed', error, updatedAt: new Date() } }
  )
}

async function getJobHistory(chatId, limit = 10) {
  if (!_db) return []
  return _db.collection(COLLECTION)
    .find({ chatId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
}

async function getJob(jobId) {
  if (!_db) return null
  return _db.collection(COLLECTION).findOne({ jobId })
}

// ═══════════════════════════════════════
// CSV Generation
// ═══════════════════════════════════════

function generateValidCsv(results) {
  const valid = results.filter(r => r.category === 'valid')
  let csv = 'email\n'
  for (const r of valid) csv += `${r.email}\n`
  return csv
}

function generateFullReportCsv(results) {
  let csv = 'email,category,score,syntax,disposable,role_based,free_provider,mx_valid,smtp_status,smtp_reason,catch_all\n'
  for (const r of results) {
    csv += `${r.email},${r.category},${r.score},${r.syntax},${r.disposable},${r.role_based},${r.free_provider},${r.mx_valid},${r.smtp_status},${r.smtp_reason || ''},${r.catch_all}\n`
  }
  return csv
}

function generateInvalidCsv(results) {
  const invalid = results.filter(r => r.category !== 'valid')
  let csv = 'email,category,reason\n'
  for (const r of invalid) csv += `${r.email},${r.category},${r.smtp_reason || r.category}\n`
  return csv
}

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════

function buildSummary(results) {
  const summary = {
    total: results.length,
    valid: 0,
    invalid: 0,
    risky: 0,
    disposable: 0,
    unknown: 0,
    role_based: 0,
    free_provider: 0,
    catch_all: 0,
    unverifiable: 0,
    avgScore: 0,
  }

  let scoreSum = 0
  for (const r of results) {
    if (r.category === 'valid') summary.valid++
    else if (r.category === 'invalid') summary.invalid++
    else if (r.category === 'risky') summary.risky++
    else if (r.category === 'disposable') summary.disposable++
    else summary.unknown++

    if (r.role_based) summary.role_based++
    if (r.free_provider) summary.free_provider++
    if (r.catch_all) summary.catch_all++
    if (r.smtp_status === 'unverifiable') summary.unverifiable++
    scoreSum += r.score
  }

  summary.avgScore = results.length ? Math.round(scoreSum / results.length) : 0
  summary.deliverabilityPct = results.length ? Math.round((summary.valid / results.length) * 100) : 0
  return summary
}

// ═══════════════════════════════════════
// Main Processing Pipeline
// ═══════════════════════════════════════

/**
 * Run full email validation job.
 * Sends progress updates and results to user via Telegram.
 */
async function processValidationJob(chatId, emails, price, paymentMethod, lang) {
  const jobId = await createJob(chatId, emails, price, paymentMethod)
  let lastNotifiedPct = 0

  try {
    // Send start message
    _bot?.sendMessage(chatId,
      `⏳ <b>Email Validation Started</b>\n\n` +
      `📊 Emails: <b>${emails.length.toLocaleString()}</b>\n` +
      `🔄 Processing through 7 validation layers...\n\n` +
      `You'll receive progress updates.`,
      { parse_mode: 'HTML' }
    ).catch(() => {})

    // Run validation with progress callback
    const results = await validateEmailBatch(emails, {
      onProgress: async (pct, stats) => {
        // Notify every N% or on phase change
        const interval = EV_CONFIG.progressInterval
        if (pct - lastNotifiedPct >= interval || pct === 100 || stats.phase === 'local_done') {
          lastNotifiedPct = pct
          await updateJobProgress(jobId, pct)

          let phaseEmoji = '🔄'
          let phaseText = 'Processing...'
          if (stats.phase === 'local') { phaseEmoji = '🔍'; phaseText = `Layers 1-5: Syntax, MX, Filters (${stats.done}/${stats.total})` }
          else if (stats.phase === 'local_done') { phaseEmoji = '✅'; phaseText = `Local checks done — ${stats.smtpNeeded} emails queued for SMTP` }
          else if (stats.phase === 'smtp') { phaseEmoji = '📡'; phaseText = `Layer 6-7: SMTP Verification (${stats.done}/${stats.total})` }
          else if (stats.phase === 'done') { phaseEmoji = '🎉'; phaseText = 'Validation complete!' }

          if (pct < 100) {
            _bot?.sendMessage(chatId,
              `${phaseEmoji} <b>${pct}%</b> — ${phaseText}`,
              { parse_mode: 'HTML' }
            ).catch(() => {})
          }
        }
      }
    })

    // Build summary
    const summary = buildSummary(results)
    await completeJob(jobId, summary)

    // Generate CSV files
    const validCsv = generateValidCsv(results)
    const fullCsv = generateFullReportCsv(results)
    const invalidCsv = generateInvalidCsv(results)

    // Send summary
    const pctValid = summary.deliverabilityPct
    const qualityEmoji = pctValid >= 80 ? '🟢' : pctValid >= 50 ? '🟡' : '🔴'

    _bot?.sendMessage(chatId,
      `🎉 <b>Email Validation Complete</b>\n\n` +
      `📊 <b>Results Summary</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📬 Deliverable: <b>${summary.valid.toLocaleString()}</b>\n` +
      `❌ Invalid: <b>${summary.invalid.toLocaleString()}</b>\n` +
      `⚠️ Risky: <b>${summary.risky.toLocaleString()}</b> (catch-all / role)\n` +
      `🚫 Disposable: <b>${summary.disposable.toLocaleString()}</b>\n` +
      `❓ Unknown: <b>${summary.unknown.toLocaleString()}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `${qualityEmoji} Deliverability: <b>${pctValid}%</b>\n` +
      `📈 Avg Score: <b>${summary.avgScore}/100</b>\n\n` +
      `📄 Sending your result files...\n` +
      `📬 <i>The first file is your campaign-ready list.</i>`,
      { parse_mode: 'HTML' }
    ).catch(() => {})

    // Send files — valid (campaign-ready) file FIRST and prominently
    await sleep(500)

    if (summary.valid > 0) {
      await _bot?.sendDocument(chatId, Buffer.from(validCsv), {
        caption: `📬 Campaign-Ready List — ${summary.valid.toLocaleString()} deliverable emails\n✅ Use this file for your email campaign`,
      }, { filename: `deliverable_emails_${jobId.slice(0, 8)}.csv`, contentType: 'text/csv' }).catch(() => {})
      await sleep(300)
    }

    if (summary.invalid > 0 || summary.risky > 0 || summary.disposable > 0 || summary.unknown > 0) {
      await _bot?.sendDocument(chatId, Buffer.from(invalidCsv), {
        caption: `❌ Invalid & Risky — ${(summary.total - summary.valid).toLocaleString()} emails removed`,
      }, { filename: `invalid_emails_${jobId.slice(0, 8)}.csv`, contentType: 'text/csv' }).catch(() => {})
      await sleep(300)
    }

    await _bot?.sendDocument(chatId, Buffer.from(fullCsv), {
      caption: `📊 Full Report — All ${summary.total.toLocaleString()} emails with scores & details`,
    }, { filename: `full_report_${jobId.slice(0, 8)}.csv`, contentType: 'text/csv' }).catch(() => {})

    return { jobId, summary }

  } catch (err) {
    console.error(`[EmailValidation] Job ${jobId} failed:`, err.message)
    await failJob(jobId, err.message)
    _bot?.sendMessage(chatId,
      `❌ <b>Validation Failed</b>\n\n` +
      `Error: ${err.message}\n\n` +
      `Your payment will be refunded. Please try again or contact support.`,
      { parse_mode: 'HTML' }
    ).catch(() => {})
    return { jobId, error: err.message }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

module.exports = {
  initEmailValidationService,
  processValidationJob,
  getJobHistory,
  getJob,
  parseEmailList,
  buildSummary,
  generateValidCsv,
  generateFullReportCsv,
  generateInvalidCsv,
}
