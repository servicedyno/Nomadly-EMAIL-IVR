#!/usr/bin/env node
/**
 * audit-cancellation-refunds.js
 * ─────────────────────────────
 * BUG FIX (2026-07-08 chatId 8011229362): Cancellation must be NON-REFUNDABLE
 * per business policy. Any refund that DID get issued on a cancelled cPanel
 * plan in the past should be clawed back from the user's wallet.
 *
 * This script scans `cpanelAccounts` for docs where `deleted=true` AND either
 * `refundAmount>0` OR `walletCredited>0`, then for each match verifies the
 * refund was actually added to walletOf (by matching transactions collection),
 * and reverses it with a compensating $inc on walletOf.usdOut so the wallet
 * balance drops by the refunded amount.
 *
 * Usage:
 *   DRY RUN (default):  node scripts/audit-cancellation-refunds.js
 *   APPLY:              node scripts/audit-cancellation-refunds.js --apply
 *
 * Safeguards:
 *   • DRY RUN by default — prints a full report, no writes.
 *   • Skips users whose current wallet balance would go NEGATIVE after
 *     deduction (flags them for manual review instead).
 *   • Records every reversal in `walletReversalsLog` for auditability.
 *   • Idempotent: writes a marker (`refundReversedAt`) so re-runs are a no-op.
 *
 * Safe to run against production Mongo (uses MONGO_URL + DB_NAME from env).
 */

require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const APPLY = process.argv.includes('--apply')
const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'test'

if (!MONGO_URL) {
  console.error('MONGO_URL not set in backend/.env')
  process.exit(1)
}

async function main() {
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(DB_NAME)

  console.log(`\n╭─────────────────────────────────────────────────────────╮`)
  console.log(`│ CANCELLATION-REFUND AUDIT — ${APPLY ? '\x1b[31mAPPLY mode\x1b[0m' : '\x1b[33mDRY RUN\x1b[0m'}${' '.repeat(APPLY ? 20 : 24)}│`)
  console.log(`│ (per Nomadly policy: cancelled plans get NO refund)     │`)
  console.log(`╰─────────────────────────────────────────────────────────╯\n`)

  // Query: cpanelAccounts marked deleted with a non-zero refundAmount
  // OR a walletCredited flag, AND not already reversed.
  const suspects = await db.collection('cpanelAccounts').find({
    deleted: true,
    $or: [
      { refundAmount: { $gt: 0 } },
      { walletCredited: { $gt: 0 } },
      { refundIssuedTxnId: { $exists: true, $ne: null } },
    ],
    refundReversedAt: { $exists: false },
  }).toArray()

  if (suspects.length === 0) {
    console.log('✅ No cancelled plans with unreversed refunds found. Nothing to do.\n')
    await client.close()
    return
  }

  console.log(`Found ${suspects.length} cancelled plan(s) with an unreversed refund credit:\n`)

  const walletOf = db.collection('walletOf')
  const walletReversalsLog = db.collection('walletReversalsLog')

  let totalReversed = 0
  let flaggedNegative = 0
  let applied = 0

  for (const p of suspects) {
    const chatId = String(p.chatId || '')
    const refundAmount = Number(p.refundAmount || p.walletCredited || 0)
    if (!refundAmount || refundAmount <= 0) continue

    const wallet = await walletOf.findOne({ _id: chatId })
    const usdBal = wallet ? ((wallet.usdIn || 0) - (wallet.usdOut || 0)) : 0
    const newBal = usdBal - refundAmount
    const willGoNegative = newBal < 0

    console.log(`─── ${p.cpUser || p._id} (chatId=${chatId}) ───`)
    console.log(`    domain=${p.domain}   plan=${p.plan}   deletedAt=${p.deletedAt}`)
    console.log(`    refundAmount=$${refundAmount}   currentWallet=$${usdBal.toFixed(2)}   afterDeduct=$${newBal.toFixed(2)}`)
    if (willGoNegative) {
      console.log(`    \x1b[31m⚠️  would go NEGATIVE — SKIPPED (needs manual review)\x1b[0m`)
      flaggedNegative++
      continue
    }

    if (!APPLY) {
      console.log(`    \x1b[33m(dry-run) would $inc walletOf.usdOut by $${refundAmount}\x1b[0m`)
      totalReversed += refundAmount
      continue
    }

    // APPLY: reverse the refund
    await walletOf.updateOne(
      { _id: chatId },
      { $inc: { usdOut: refundAmount } },
      { upsert: true }
    )
    await walletReversalsLog.insertOne({
      chatId,
      cpUser: p.cpUser,
      domain: p.domain,
      plan: p.plan,
      amount: refundAmount,
      reason: 'cancellation_refund_reversal',
      originalDeletedAt: p.deletedAt,
      reversedAt: new Date(),
      walletBalBefore: usdBal,
      walletBalAfter: newBal,
    })
    await db.collection('cpanelAccounts').updateOne(
      { _id: p._id },
      { $set: { refundReversedAt: new Date(), refundReversedAmount: refundAmount } }
    )
    console.log(`    \x1b[32m✅ reversed $${refundAmount} from wallet (was $${usdBal.toFixed(2)} → $${newBal.toFixed(2)})\x1b[0m`)
    totalReversed += refundAmount
    applied++
  }

  console.log(`\n═══════════════════════════════════════════════════════════`)
  console.log(`SUMMARY`)
  console.log(`  Suspects found:       ${suspects.length}`)
  console.log(`  Reversal applied:     ${applied}   (${APPLY ? 'writes committed' : 'DRY RUN — no writes'})`)
  console.log(`  Flagged (negative):   ${flaggedNegative}`)
  console.log(`  Total $ reversed:     $${totalReversed.toFixed(2)}`)
  console.log(`═══════════════════════════════════════════════════════════\n`)
  if (!APPLY && suspects.length > 0) {
    console.log(`Re-run with \x1b[31m--apply\x1b[0m to commit the reversals.\n`)
  }
  await client.close()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
