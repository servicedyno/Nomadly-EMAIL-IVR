/**
 * 20K Email Validation Test — Optimized
 * 
 * For catch-all domains (like Yahoo), a single SMTP probe confirms the domain
 * accepts ALL addresses — no need to check each email individually.
 * This dramatically speeds up single-domain batches.
 */
require('dotenv').config()
const { MongoClient } = require('mongodb')
const { parseEmailList } = require('./js/email-validation.js')
const { EV_CONFIG, calculatePrice } = require('./js/email-validation-config.js')
const evService = require('./js/email-validation-service.js')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const http = require('http')
const dns = require('dns').promises

const CHATID = 5168006768
const TOTAL = 20000

async function callWorkerBatch(emails) {
  return new Promise((resolve, reject) => {
    const url = new URL('/verify-smtp', EV_CONFIG.workerUrl)
    const data = JSON.stringify({ emails, timeout: 12000 })
    const req = http.request({
      hostname: url.hostname, port: url.port || 80, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Authorization': `Bearer ${process.env.EV_WORKER_SECRET || 'ev-worker-secret-2026'}` },
      timeout: 300000,
    }, (res) => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => { try { resolve(JSON.parse(body)) } catch { reject(new Error('parse error')) } })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(data)
    req.end()
  })
}

async function main() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017'
  const client = await MongoClient.connect(mongoUrl)
  const db = client.db()

  console.log('=== 20K Email Validation Test (Optimized) ===')
  const content = fs.readFileSync('/tmp/120K_UHQ_YAHOO.txt', 'utf-8')
  const allEmails = parseEmailList(content)
  const emails = allEmails.slice(0, TOTAL)
  console.log(`Testing: ${emails.length} emails`)

  const pricing = calculatePrice(emails.length)
  console.log(`Price: $${pricing.total} (${pricing.rate}/email)`)

  // Group by domain
  const domainGroups = new Map()
  for (const email of emails) {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domainGroups.has(domain)) domainGroups.set(domain, [])
    domainGroups.get(domain).push(email)
  }
  console.log(`\nDomains: ${domainGroups.size}`)
  for (const [domain, list] of domainGroups) {
    console.log(`  ${domain}: ${list.length} emails`)
  }

  const jobId = uuidv4()
  await db.collection('emailValidationJobs').insertOne({
    _id: jobId, chatId: CHATID, totalEmails: emails.length, price: pricing.total,
    rate: pricing.rate, tier: pricing.tier, paymentMethod: 'wallet_usd',
    status: 'processing', progress: 0, createdAt: new Date(), results: [], summary: null,
  })
  console.log(`\nJob: ${jobId}`)

  const startTime = Date.now()
  const allResults = []
  let validCount = 0, invalidCount = 0, catchAllCount = 0, unknownCount = 0, errorCount = 0

  for (const [domain, domainEmails] of domainGroups) {
    console.log(`\n--- Processing ${domain} (${domainEmails.length} emails) ---`)

    // Step 1: Probe catch-all with a small sample
    const probeSample = [
      `ev-catchall-probe-${Date.now()}@${domain}`,
      domainEmails[0],
      domainEmails[Math.min(1, domainEmails.length - 1)],
    ]
    console.log(`  Probing catch-all + first emails...`)

    let isCatchAll = false
    let probeResults = null
    try {
      probeResults = await callWorkerBatch(probeSample)
      if (probeResults?.results) {
        const fakeResult = probeResults.results.find(r => r.email.startsWith('ev-catchall-probe'))
        isCatchAll = fakeResult?.status === 'valid' || fakeResult?.status === 'catch_all' || fakeResult?.catch_all === true
        console.log(`  Catch-all: ${isCatchAll ? 'YES' : 'NO'}`)

        // Process non-probe results
        for (const r of probeResults.results) {
          if (!r.email.startsWith('ev-catchall-probe')) {
            console.log(`  Sample: ${r.email} → ${r.status} (${r.reason})`)
          }
        }
      }
    } catch (e) {
      console.log(`  Probe error: ${e.message}`)
    }

    if (isCatchAll) {
      // All emails from this domain are catch-all — skip individual SMTP checks
      console.log(`  ✅ Catch-all domain — marking all ${domainEmails.length} emails as catch_all (no individual SMTP needed)`)
      for (const email of domainEmails) {
        allResults.push({
          email,
          status: 'catch_all',
          reason: 'catch_all_domain',
          code: '250',
          catch_all: true,
          score: 60,
          category: 'risky',
          smtp_status: 'catch_all',
          smtp_reason: 'catch_all_domain',
        })
        catchAllCount++
      }
    } else {
      // Non catch-all — verify in batches
      const batchSize = 100
      const batches = Math.ceil(domainEmails.length / batchSize)
      console.log(`  Processing ${batches} batches of ${batchSize}...`)

      for (let i = 0; i < batches; i++) {
        const batch = domainEmails.slice(i * batchSize, (i + 1) * batchSize)
        try {
          const res = await callWorkerBatch(batch)
          if (res?.results) {
            for (const r of res.results) {
              // Enrich with scoring
              if (r.status === 'valid') { r.score = 95; r.category = 'valid'; validCount++ }
              else if (r.status === 'invalid') { r.score = 10; r.category = 'invalid'; invalidCount++ }
              else if (r.status === 'catch_all') { r.score = 60; r.category = 'risky'; catchAllCount++ }
              else { r.score = 30; r.category = 'unknown'; unknownCount++ }
              r.smtp_status = r.status
              r.smtp_reason = r.reason
              allResults.push(r)
            }
          } else {
            for (const e of batch) {
              allResults.push({ email: e, status: 'unknown', reason: 'worker_error', score: 0, category: 'unknown' })
              errorCount++
            }
          }
        } catch (err) {
          for (const e of batch) {
            allResults.push({ email: e, status: 'unknown', reason: 'exception', error: err.message, score: 0, category: 'unknown' })
            errorCount++
          }
        }

        const pct = Math.round((allResults.length / emails.length) * 100)
        if (i % 5 === 0 || i === batches - 1) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
          console.log(`  [${pct}%] Batch ${i + 1}/${batches} | Total: ${allResults.length}/${emails.length} | ${elapsed}s`)
        }
      }
    }

    // Update progress
    const pct = Math.round((allResults.length / emails.length) * 100)
    await db.collection('emailValidationJobs').updateOne(
      { _id: jobId },
      { $set: { progress: pct } }
    )
  }

  // Final summary
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const summary = {
    total: allResults.length,
    valid: validCount,
    invalid: invalidCount,
    catchAll: catchAllCount,
    risky: catchAllCount,
    unknown: unknownCount,
    errors: errorCount,
    deliverabilityPct: Math.round(((validCount + catchAllCount) / Math.max(allResults.length, 1)) * 100),
    avgScore: Math.round(allResults.reduce((s, r) => s + (r.score || 0), 0) / Math.max(allResults.length, 1)),
  }

  await db.collection('emailValidationJobs').updateOne(
    { _id: jobId },
    { $set: { status: 'completed', progress: 100, summary, completedAt: new Date() } }
  )

  // Generate CSV files
  const validCsv = allResults.filter(r => r.status === 'valid' || r.status === 'catch_all').map(r => r.email).join('\n')
  const invalidCsv = allResults.filter(r => r.status === 'invalid').map(r => r.email).join('\n')
  const fullCsv = 'email,status,reason,score,category\n' + allResults.map(r =>
    `${r.email},${r.status},${r.reason || ''},${r.score || 0},${r.category || ''}`
  ).join('\n')

  fs.writeFileSync('/tmp/ev_20k_valid.csv', validCsv)
  fs.writeFileSync('/tmp/ev_20k_invalid.csv', invalidCsv)
  fs.writeFileSync('/tmp/ev_20k_full_report.csv', fullCsv)

  console.log(`\n${'='.repeat(50)}`)
  console.log(`COMPLETE — Job: ${jobId}`)
  console.log(`Time: ${totalElapsed}s`)
  console.log(`Results:`)
  console.log(`  ✅ Valid:     ${validCount}`)
  console.log(`  ❌ Invalid:   ${invalidCount}`)
  console.log(`  🔶 Catch-all: ${catchAllCount}`)
  console.log(`  ❓ Unknown:   ${unknownCount}`)
  console.log(`  🚫 Errors:    ${errorCount}`)
  console.log(`  📈 Deliverability: ${summary.deliverabilityPct}%`)
  console.log(`  📊 Avg Score: ${summary.avgScore}/100`)
  console.log(`\nCSV files:`)
  console.log(`  /tmp/ev_20k_valid.csv`)
  console.log(`  /tmp/ev_20k_invalid.csv`)
  console.log(`  /tmp/ev_20k_full_report.csv`)

  await client.close()
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1) })
