/**
 * 20K Email Validation Test
 * Runs 20,000 emails from the Yahoo file through the full pipeline.
 * Uses the EV service to create a job and process it.
 */
require('dotenv').config()
const { MongoClient } = require('mongodb')
const { parseEmailList } = require('./js/email-validation.js')
const { EV_CONFIG, calculatePrice } = require('./js/email-validation-config.js')
const evService = require('./js/email-validation-service.js')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')

const CHATID = 5168006768 // @Hostbay_support
const TOTAL = 20000

async function main() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017'
  const client = await MongoClient.connect(mongoUrl)
  const db = client.db()

  console.log('=== 20K Email Validation Test ===')
  console.log(`EV_CONFIG.maxEmails: ${EV_CONFIG.maxEmails}`)
  console.log(`EV_CONFIG.workerUrl: ${EV_CONFIG.workerUrl}`)
  console.log(`EV_CONFIG.workerBatchSize: ${EV_CONFIG.workerBatchSize}`)

  // Parse emails from file
  const content = fs.readFileSync('/tmp/120K_UHQ_YAHOO.txt', 'utf-8')
  const allEmails = parseEmailList(content)
  console.log(`Total emails in file: ${allEmails.length}`)

  // Take first 20K
  const emails = allEmails.slice(0, TOTAL)
  console.log(`Testing with: ${emails.length} emails`)

  // Calculate cost
  const pricing = calculatePrice(emails.length)
  console.log(`\nPricing: $${pricing.total} (rate: $${pricing.rate}/email, tier: ${pricing.tier})`)

  // Create job in database
  const jobId = uuidv4()
  const job = {
    _id: jobId,
    chatId: CHATID,
    totalEmails: emails.length,
    price: pricing.total,
    rate: pricing.rate,
    tier: pricing.tier,
    paymentMethod: 'wallet_usd',
    status: 'processing',
    progress: 0,
    createdAt: new Date(),
    emails: emails,
    results: [],
    summary: null,
    error: null,
  }

  await db.collection('emailValidationJobs').insertOne(job)
  console.log(`\nJob created: ${jobId}`)
  console.log(`Started at: ${new Date().toISOString()}`)

  // Process the job using the service
  const batchSize = EV_CONFIG.workerBatchSize || 100
  const totalBatches = Math.ceil(emails.length / batchSize)
  console.log(`\nBatches: ${totalBatches} (${batchSize} emails each)`)
  console.log('Processing...\n')

  let processed = 0
  let validCount = 0
  let invalidCount = 0
  let unknownCount = 0
  let catchAllCount = 0
  let errorCount = 0
  const startTime = Date.now()
  const allResults = []

  for (let i = 0; i < totalBatches; i++) {
    const batchStart = i * batchSize
    const batchEnd = Math.min(batchStart + batchSize, emails.length)
    const batch = emails.slice(batchStart, batchEnd)

    try {
      // Call worker directly
      const workerResponse = await callWorker(batch)
      if (workerResponse && workerResponse.results) {
        for (const r of workerResponse.results) {
          allResults.push(r)
          if (r.status === 'valid') validCount++
          else if (r.status === 'invalid') invalidCount++
          else if (r.status === 'catch_all') catchAllCount++
          else unknownCount++
        }
      } else {
        errorCount += batch.length
        for (const e of batch) {
          allResults.push({ email: e, status: 'unknown', reason: 'worker_error' })
        }
      }
    } catch (err) {
      errorCount += batch.length
      for (const e of batch) {
        allResults.push({ email: e, status: 'unknown', reason: 'exception', error: err.message })
      }
    }

    processed += batch.length
    const pct = Math.round((processed / emails.length) * 100)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
    const rate = (processed / ((Date.now() - startTime) / 1000)).toFixed(1)

    // Update job progress
    await db.collection('emailValidationJobs').updateOne(
      { _id: jobId },
      { $set: { progress: pct, results: allResults } }
    )

    if (i % 5 === 0 || i === totalBatches - 1) {
      console.log(`[${pct}%] Batch ${i + 1}/${totalBatches} | ${processed}/${emails.length} | ✅${validCount} ❌${invalidCount} 🔶${catchAllCount} ❓${unknownCount} | ${rate} emails/s | ${elapsed}s`)
    }
  }

  // Build summary
  const summary = {
    total: allResults.length,
    valid: validCount,
    invalid: invalidCount,
    catchAll: catchAllCount,
    unknown: unknownCount,
    errors: errorCount,
    deliverabilityPct: Math.round((validCount / allResults.length) * 100),
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // Update job as completed
  await db.collection('emailValidationJobs').updateOne(
    { _id: jobId },
    { $set: { status: 'completed', progress: 100, summary, results: allResults, completedAt: new Date() } }
  )

  console.log(`\n=== COMPLETE ===`)
  console.log(`Job: ${jobId}`)
  console.log(`Time: ${totalElapsed}s (${(allResults.length / (totalElapsed)).toFixed(1)} emails/s)`)
  console.log(`Results:`)
  console.log(`  ✅ Valid: ${validCount}`)
  console.log(`  ❌ Invalid: ${invalidCount}`)
  console.log(`  🔶 Catch-all: ${catchAllCount}`)
  console.log(`  ❓ Unknown: ${unknownCount}`)
  console.log(`  🚫 Errors: ${errorCount}`)
  console.log(`  📈 Deliverability: ${summary.deliverabilityPct}%`)

  await client.close()
}

function callWorker(emails) {
  return new Promise((resolve, reject) => {
    const baseUrl = EV_CONFIG.workerUrl
    const url = new URL('/verify-smtp', baseUrl)
    const lib = url.protocol === 'https:' ? require('https') : require('http')
    const data = JSON.stringify({ emails, timeout: 12000 })
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${process.env.EV_WORKER_SECRET || 'ev-worker-secret-2026'}`,
      },
      timeout: 300000,
    }, (res) => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => {
        try { resolve(JSON.parse(body)) } catch { reject(new Error('parse error: ' + body.slice(0, 200))) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('worker timeout')) })
    req.write(data)
    req.end()
  })
}

main().catch(e => {
  console.error('FATAL:', e.message)
  console.error(e.stack)
  process.exit(1)
})
