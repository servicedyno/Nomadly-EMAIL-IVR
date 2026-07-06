#!/usr/bin/env node
/**
 * heal_https_enforcement.js
 *
 * Backfill the Cloudflare HTTPS-baseline settings (Always Use HTTPS,
 * HSTS, Auto-Rewrites) on every existing registered domain that has a
 * `cfZoneId` but missed those settings at provisioning time.
 *
 * Background: until 2026-06-01, `domain-service.js#registerDomain` (the
 * standalone domain-purchase path — no hosting attached) called
 * `cfService.createZone` but never followed up with `setSSLMode` /
 * `enforceHTTPS`. As a result:
 *   • https://<domain>/ worked (Cloudflare Universal SSL)
 *   • http://<domain>/  returned 200 in plaintext → no 301 redirect
 *   • Browsers showed "Not Secure" in the URL bar
 *   • Customers reported "domain has no SSL"
 *     (e.g. mccoyfcuportal.com — 2026-06-01)
 *
 * The createZone() fix bakes the defaults in for ALL new zones. This
 * script repairs existing domains that were created before that fix.
 *
 * SAFE / IDEMPOTENT — re-running it is harmless. CF's settings API is
 * a PATCH so applying the same value twice is a no-op.
 *
 * Usage:
 *   MONGO_URL=... DB_NAME=... CLOUDFLARE_EMAIL=... CLOUDFLARE_API_KEY=... \
 *     node scripts/heal_https_enforcement.js [--dry-run] [--limit=N] [--batch=N]
 *
 *   --dry-run   Only report what would change, no API calls (default: false)
 *   --limit=N   Process at most N domains (default: unlimited)
 *   --batch=N   Concurrency for CF API calls (default: 4)
 *
 * Marks healed docs with `val.httpsEnforcementHealedAt = ISO date` so a
 * second run can quickly skip them via the `--skip-already-healed` flag.
 */

'use strict'

require('dotenv').config()
const { MongoClient } = require('mongodb')
const cfService = require('../js/cf-service')

const arg = (name, def) => {
  const m = process.argv.find(a => a.startsWith(`--${name}=`))
  return m ? m.slice(name.length + 3) : def
}
const flag = (name) => process.argv.includes(`--${name}`)

const DRY_RUN              = flag('dry-run')
const SKIP_ALREADY_HEALED  = flag('skip-already-healed')
const LIMIT                = Math.max(0, parseInt(arg('limit', '0'), 10))
const BATCH                = Math.max(1, parseInt(arg('batch', '4'), 10))

const MONGO_URL = process.env.MONGO_URL
const DB_NAME   = process.env.DB_NAME
const CF_EMAIL  = process.env.CLOUDFLARE_EMAIL
const CF_KEY    = process.env.CLOUDFLARE_API_KEY

if (!MONGO_URL || !DB_NAME) {
  console.error('❌ MONGO_URL and DB_NAME are required')
  process.exit(1)
}
if (!CF_EMAIL || !CF_KEY) {
  console.error('❌ CLOUDFLARE_EMAIL and CLOUDFLARE_API_KEY are required')
  process.exit(1)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 10000 })
  await client.connect()
  const db = client.db(DB_NAME)

  // Find all domains with a CF zone id. These are candidates.
  const query = {
    $or: [
      { 'val.nameserverType': 'cloudflare' },
      { 'val.cfZoneId':       { $exists: true, $ne: null } },
    ],
  }
  if (SKIP_ALREADY_HEALED) {
    query['val.httpsEnforcementHealedAt'] = { $exists: false }
  }
  const cursor = db.collection('registeredDomains').find(query)
  const docs = await cursor.toArray()

  // Filter to domains that actually have a zoneId (the index query is permissive)
  const eligible = docs.filter(d => d.val && d.val.cfZoneId)
  const slice = LIMIT > 0 ? eligible.slice(0, LIMIT) : eligible

  console.log(`📋 Found ${docs.length} candidate docs, ${eligible.length} have cfZoneId, processing ${slice.length} (DRY_RUN=${DRY_RUN}, BATCH=${BATCH})`)

  const results = { healed: 0, skipped: 0, errors: 0, dryRunPreview: [] }

  // Process in batches of BATCH concurrently
  for (let i = 0; i < slice.length; i += BATCH) {
    const batch = slice.slice(i, i + BATCH)
    await Promise.all(batch.map(async (doc) => {
      const domain = doc._id
      const zoneId = doc.val.cfZoneId
      try {
        if (DRY_RUN) {
          results.dryRunPreview.push({ domain, zoneId })
          console.log(`[DRY-RUN] would heal ${domain} (zone: ${zoneId})`)
          return
        }
        const r = await cfService.enforceHTTPS(zoneId)
        if (r && (r.alwaysHTTPS || r.hsts || r.autoRewrites)) {
          await db.collection('registeredDomains').updateOne(
            { _id: domain },
            { $set: { 'val.httpsEnforcementHealedAt': new Date().toISOString() } }
          )
          results.healed++
          console.log(`✅ healed ${domain} → alwaysHTTPS=${r.alwaysHTTPS} hsts=${r.hsts} autoRewrites=${r.autoRewrites}`)
        } else {
          results.errors++
          console.log(`⚠️  ${domain}: enforceHTTPS returned no successes (${JSON.stringify(r).slice(0, 200)})`)
        }
      } catch (e) {
        results.errors++
        console.error(`❌ ${domain} (zone ${zoneId}): ${e.message}`)
      }
    }))
    // Gentle pacing to stay well under CF's 1200 req / 5 min rate limit
    if (!DRY_RUN && i + BATCH < slice.length) await sleep(500)
  }

  await client.close()

  console.log('\n──────── summary ────────')
  console.log(`Considered: ${slice.length}`)
  console.log(`Healed:     ${results.healed}`)
  console.log(`Errors:     ${results.errors}`)
  if (DRY_RUN) {
    console.log(`Dry-run:    ${results.dryRunPreview.length} would have been healed`)
  }
  console.log('──────────────────────────')
  process.exit(results.errors > 0 ? 2 : 0)
})().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
})
