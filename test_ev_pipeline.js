/**
 * Email Validation Pipeline Test
 * Tests the full 7-layer validation pipeline with a small sample
 */
require('dotenv').config()
const { MongoClient } = require('mongodb')
const { validateEmailBatch, parseEmailList } = require('./js/email-validation.js')
const { EV_CONFIG, calculatePrice } = require('./js/email-validation-config.js')
const evService = require('./js/email-validation-service.js')
const fs = require('fs')

const CHATID = 5168006768 // @Hostbay_support

async function main() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017'
  const client = await MongoClient.connect(mongoUrl)
  const db = client.db()

  console.log('=== Email Validation Pipeline Test ===')
  console.log('EV_CONFIG.maxEmails:', EV_CONFIG.maxEmails)
  console.log('EV_CONFIG.workerUrl:', EV_CONFIG.workerUrl)
  console.log('EV_CONFIG.workerBatchSize:', EV_CONFIG.workerBatchSize)

  // Parse a small sample from the file
  const content = fs.readFileSync('/tmp/120K_UHQ_YAHOO.txt', 'utf-8')
  const allEmails = parseEmailList(content)
  console.log(`\nTotal emails parsed: ${allEmails.length}`)

  // Test with 20 emails first
  const sampleEmails = allEmails.slice(0, 20)
  console.log(`\nTesting with ${sampleEmails.length} emails:`)
  sampleEmails.forEach((e, i) => console.log(`  ${i + 1}. ${e}`))

  console.log('\n--- Starting 7-layer validation ---')
  const startTime = Date.now()

  try {
    const results = await validateEmailBatch(sampleEmails, {
      onProgress: (pct, stats) => {
        console.log(`  Progress: ${pct}% | Phase: ${stats.phase} | Done: ${stats.done}/${stats.total}`)
      }
    })

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n--- Validation complete in ${elapsed}s ---`)

    // Summary
    const summary = evService.buildSummary(results)
    console.log('\nSummary:')
    console.log(`  Total: ${summary.total}`)
    console.log(`  Valid: ${summary.valid}`)
    console.log(`  Invalid: ${summary.invalid}`)
    console.log(`  Risky: ${summary.risky}`)
    console.log(`  Unknown: ${summary.unknown}`)
    console.log(`  Deliverability: ${summary.deliverabilityPct}%`)
    console.log(`  Avg Score: ${summary.avgScore}/100`)

    // Show individual results
    console.log('\nDetailed results:')
    for (const r of results) {
      console.log(`  ${r.email}: ${r.category} (score=${r.score}, smtp=${r.smtp_status}, reason=${r.smtp_reason || '-'})`)
    }

    console.log('\n✅ Pipeline test PASSED')
  } catch (err) {
    console.error('\n❌ Pipeline test FAILED:', err.message)
    console.error(err.stack)
  }

  await client.close()
}

main().catch(console.error)
