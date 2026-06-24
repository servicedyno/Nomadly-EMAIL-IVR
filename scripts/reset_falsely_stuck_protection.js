/* global process */
/**
 * Reset cpanelAccounts that were falsely marked `stuck_repair_loop` by the
 * 2026-06-24 WHM-empty-read bug (see /app/memory/ANTIRED_STUCK_FALSE_POSITIVE_2026-06-24.md
 * and js/protection-heartbeat.js for the root-cause analysis).
 *
 * Criteria — an account is treated as a FALSE positive iff:
 *   - protectionLastSkipReason === 'stuck_repair_loop'
 *   - protectionRepairCount >= 3
 *   - lastCfIpFixSig is set (cryptographic proof we successfully deployed
 *     the .user.ini + .antired-challenge.php files at some point)
 *
 * What we do: clear protectionStuckAt / protectionLastSkipReason / repair
 * counter so the heartbeat can rescan them on its next pass. Record an
 * audit trail via protectionManualResetAt / protectionManualResetBy.
 *
 * Idempotent — running twice is a no-op.
 *
 * Usage:
 *   node /app/scripts/reset_falsely_stuck_protection.js           # apply
 *   DRY_RUN=1 node /app/scripts/reset_falsely_stuck_protection.js # preview
 */
require('dotenv').config()
const { MongoClient } = require('mongodb')

const DRY_RUN = process.env.DRY_RUN === '1'

;(async () => {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL not set')
    process.exit(1)
  }
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const coll = db.collection('cpanelAccounts')

  // Find accounts that match the false-positive criteria
  const candidates = await coll.find({
    protectionLastSkipReason: 'stuck_repair_loop',
    protectionRepairCount: { $gte: 3 },
    lastCfIpFixSig: { $exists: true, $ne: null, $ne: '' },
  }).project({
    _id: 1, cpUser: 1, domain: 1, plan: 1, whmHost: 1,
    protectionStuckAt: 1, protectionRepairCount: 1, lastCfIpFixSig: 1, lastCfIpFixAt: 1,
  }).toArray()

  console.log(`Found ${candidates.length} falsely-stuck cpanelAccounts to reset${DRY_RUN ? ' (DRY RUN)' : ''}.`)
  candidates.forEach((a, i) => {
    console.log(`  [${i + 1}] ${a.cpUser} / ${a.domain} — stuckAt=${a.protectionStuckAt} sig=${a.lastCfIpFixSig} count=${a.protectionRepairCount}`)
  })

  if (DRY_RUN || candidates.length === 0) {
    await client.close()
    return
  }

  const result = await coll.updateMany(
    {
      _id: { $in: candidates.map(c => c._id) },
      // re-check the conditions atomically to avoid racing the live heartbeat
      protectionLastSkipReason: 'stuck_repair_loop',
      protectionRepairCount: { $gte: 3 },
      lastCfIpFixSig: { $exists: true, $ne: null, $ne: '' },
    },
    {
      $set: {
        protectionRepairCount: 0,
        protectionManualResetAt: new Date(),
        protectionManualResetBy: 'reset_falsely_stuck_protection_2026-06-24',
      },
      $unset: {
        protectionLastSkipReason: '',
        protectionStuckAt: '',
      },
    }
  )

  console.log(`✅ Reset ${result.modifiedCount} accounts. matchedCount=${result.matchedCount}`)
  await client.close()
})().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
