#!/usr/bin/env node
/**
 * Back-fill `priceUsd` + `renewalPriceUsd` + `priceLockedAt` on every existing
 * cpanelAccount from the matching `hostingTransactions.priceUsd`.
 *
 * Default mode: DRY-RUN (prints what would change, makes no DB writes).
 * To apply:  `APPLY=1 node scripts/backfill_renewal_prices.js`
 *
 * Match rule:
 *   account.chatId == txn.chatId AND
 *   account.domain == txn.domain
 *   → pick the most recent SUCCESSFUL txn (`outcome=success`) for that pair
 *   → set renewalPriceUsd = txn.priceUsd  (only if not already set)
 *
 * Skip rules:
 *   - account.renewalPriceUsd already set (no overwrite — idempotent)
 *   - no matching successful txn (likely legacy/imported, leave alone)
 *
 * Output: a per-account decision list + summary counts.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const APPLY = process.env.APPLY === '1' || process.argv.includes('--apply')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const cpanelAccounts = db.collection('cpanelAccounts')
  const hostingTransactions = db.collection('hostingTransactions')

  const accounts = await cpanelAccounts.find({}).toArray()
  console.log(`\n=== BACK-FILL renewalPriceUsd  (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`)
  console.log(`Accounts in DB: ${accounts.length}`)

  let toSet = 0, alreadySet = 0, noTxn = 0, errors = 0
  const writeOps = []

  for (const acct of accounts) {
    if (typeof acct.renewalPriceUsd === 'number' && acct.renewalPriceUsd > 0) {
      alreadySet++
      continue
    }
    if (!acct.chatId || !acct.domain) {
      noTxn++
      continue
    }
    // Find latest successful txn for this chatId + domain
    const candidates = await hostingTransactions.find({
      chatId: String(acct.chatId),
      domain: acct.domain,
      outcome: 'success',
      priceUsd: { $exists: true, $ne: null },
    }).sort({ timestamp: -1 }).limit(1).toArray()

    if (!candidates.length) {
      // Fallback: any txn for the same chatId where the plan matches
      const fallback = await hostingTransactions.find({
        chatId: String(acct.chatId),
        plan: acct.plan,
        outcome: 'success',
        priceUsd: { $exists: true, $ne: null },
      }).sort({ timestamp: -1 }).limit(1).toArray()
      if (!fallback.length) {
        noTxn++
        console.log(`  - SKIP  ${acct.domain.padEnd(35)} chat=${acct.chatId} plan=${acct.plan}  (no successful txn found)`)
        continue
      }
      candidates.push(fallback[0])
    }

    const txn = candidates[0]
    const renewalPriceUsd = txn.priceUsd
    if (typeof renewalPriceUsd !== 'number' || renewalPriceUsd <= 0) {
      errors++
      console.log(`  ! ERR   ${acct.domain.padEnd(35)} bogus priceUsd in txn: ${renewalPriceUsd}`)
      continue
    }
    toSet++
    const note = (renewalPriceUsd === 30 && acct.plan.includes('Golden')) ? '  ← bug-recovery (paid $30, was renewing $100)' : ''
    console.log(`  + SET   ${acct.domain.padEnd(35)} chat=${acct.chatId} plan=${acct.plan.padEnd(36)} renewalPriceUsd=$${renewalPriceUsd}${note}`)

    writeOps.push({
      updateOne: {
        filter: { _id: acct._id },
        update: {
          $set: {
            priceUsd: renewalPriceUsd,
            renewalPriceUsd,
            priceLockedAt: new Date(),
            priceLockedFromTxn: txn._id,
          },
        },
      },
    })
  }

  console.log(`\n── SUMMARY ──`)
  console.log(`  Will set:     ${toSet}`)
  console.log(`  Already set:  ${alreadySet}`)
  console.log(`  No txn match: ${noTxn}`)
  console.log(`  Errors:       ${errors}`)

  if (APPLY && writeOps.length) {
    const res = await cpanelAccounts.bulkWrite(writeOps, { ordered: false })
    console.log(`\n✅ APPLIED: matched=${res.matchedCount}, modified=${res.modifiedCount}`)
  } else if (APPLY) {
    console.log(`\n✅ APPLY mode but no writes needed.`)
  } else {
    console.log(`\nℹ️  DRY-RUN. Re-run with APPLY=1 to write to DB.`)
  }

  await client.close()
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
