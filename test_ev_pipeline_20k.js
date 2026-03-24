/**
 * Test the full 7-layer pipeline with catch-all optimization — 20K emails
 */
require('dotenv').config()
const { parseEmailList, validateEmailBatch } = require('./js/email-validation.js')
const { EV_CONFIG, calculatePrice } = require('./js/email-validation-config.js')
const evService = require('./js/email-validation-service.js')
const fs = require('fs')

async function main() {
  console.log('=== Full Pipeline 20K Test ===')
  const content = fs.readFileSync('/tmp/120K_UHQ_YAHOO.txt', 'utf-8')
  const allEmails = parseEmailList(content)
  const emails = allEmails.slice(0, 20000)
  console.log(`Emails: ${emails.length}`)

  const startTime = Date.now()
  const results = await validateEmailBatch(emails, {
    onProgress: (pct, stats) => {
      if (pct % 10 === 0 || pct >= 95) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(`  [${pct}%] ${stats.phase} — done: ${stats.done}/${stats.total} (${elapsed}s)`)
      }
    }
  })

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const summary = evService.buildSummary(results)
  console.log(`\n✅ Done in ${elapsed}s`)
  console.log(`Total: ${summary.total}`)
  console.log(`Valid: ${summary.valid}`)
  console.log(`Invalid: ${summary.invalid}`)
  console.log(`Risky: ${summary.risky}`)
  console.log(`Unknown: ${summary.unknown}`)
  console.log(`Deliverability: ${summary.deliverabilityPct}%`)
  console.log(`Avg Score: ${summary.avgScore}/100`)

  // Show status breakdown
  const statusCounts = {}
  for (const r of results) {
    const key = `${r.smtp_status || r.category}`
    statusCounts[key] = (statusCounts[key] || 0) + 1
  }
  console.log('\nStatus breakdown:', statusCounts)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
