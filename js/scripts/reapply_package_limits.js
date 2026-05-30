#!/usr/bin/env node
/**
 * Bulk re-apply cPanel package limits to all existing accounts.
 *
 * WHY THIS EXISTS
 * ---------------
 * When you change a cPanel package's quotas in WHM (e.g., set MAXSQL=0 on the
 * Premium/Weekly packages to lock MySQL behind the Gold plan), the change does
 * NOT automatically propagate to existing accounts that are already assigned
 * to that package — only NEW accounts created after the change inherit it.
 *
 * This script loops over every cPanel account stored in Mongo (the same source
 * of truth the bot uses) and calls `whmapi1 changepackage user=<X> pkg=<same>`
 * to force-re-apply the package, which re-reads its current quotas and applies
 * them to that user. Idempotent — safe to run multiple times.
 *
 * USAGE
 * -----
 *   # 1. SSH into the prod box (or run wherever Mongo + WHM are reachable)
 *   # 2. Optional: dry run first to preview what would change
 *   DRY_RUN=1 node /app/js/scripts/reapply_package_limits.js
 *   # 3. Apply
 *   node /app/js/scripts/reapply_package_limits.js
 *
 * SAFETY
 * ------
 * - Dry-run mode (DRY_RUN=1) prints what WOULD be done without calling WHM.
 * - One account at a time (no parallelism) to avoid hammering WHM.
 * - 200 ms delay between accounts.
 * - Logs success/skip/error for every account; final summary at the end.
 * - Skips suspended accounts (status: 'suspended') — those don't need quota refresh.
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') })
const { MongoClient } = require('mongodb')
const whmService = require('../whm-service')

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

if (!MONGO_URL || !DB_NAME) {
  console.error('Missing MONGO_URL or DB_NAME in env — aborting.')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(DB_NAME)
  const col = db.collection('cpanel_accounts')

  // Pull all non-suspended accounts. The schema lives in cpanel-auth.js
  // (see line 134 onwards: cpUser, domain, plan, status, …).
  const accounts = await col
    .find({ status: { $ne: 'suspended' } })
    .project({ _id: 1, cpUser: 1, domain: 1, plan: 1, whmHost: 1 })
    .toArray()

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Bulk re-apply package limits${DRY_RUN ? ' (DRY RUN)' : ''}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`Accounts found: ${accounts.length}`)
  console.log('')

  const summary = { ok: 0, skipped: 0, failed: 0, failures: [] }

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i]
    const prefix = `[${i + 1}/${accounts.length}] ${acc.cpUser.padEnd(14)} (${(acc.plan || '?').padEnd(46)})`

    if (!acc.plan) {
      console.log(`${prefix} SKIP — no plan recorded`)
      summary.skipped++
      continue
    }

    if (DRY_RUN) {
      console.log(`${prefix} would re-apply package`)
      summary.ok++
      continue
    }

    try {
      // changeAccountPackage maps bot plan name → WHM package internally and
      // calls /changepackage. Passing the SAME plan re-applies current quotas.
      const result = await whmService.changePackage(acc.cpUser, acc.plan)
      if (result?.success) {
        console.log(`${prefix} OK`)
        summary.ok++
      } else {
        console.log(`${prefix} FAIL — ${result?.error || 'unknown'}`)
        summary.failed++
        summary.failures.push({ user: acc.cpUser, plan: acc.plan, error: result?.error })
      }
    } catch (err) {
      console.log(`${prefix} ERROR — ${err.message}`)
      summary.failed++
      summary.failures.push({ user: acc.cpUser, plan: acc.plan, error: err.message })
    }

    await sleep(200)
  }

  console.log('')
  console.log('─'.repeat(60))
  console.log(`Done. OK: ${summary.ok}   Skipped: ${summary.skipped}   Failed: ${summary.failed}`)
  if (summary.failures.length) {
    console.log('')
    console.log('Failures (review before retrying):')
    for (const f of summary.failures) {
      console.log(`  - ${f.user} (${f.plan}): ${f.error}`)
    }
  }
  console.log('')

  await client.close()
  process.exit(summary.failed > 0 ? 2 : 0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
