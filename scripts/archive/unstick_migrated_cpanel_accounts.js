#!/usr/bin/env node
/**
 * One-shot unstick for the 19 cPanel accounts pinned out of ProtectionHeartbeat
 * since the 2026-06-17 WHM migration to 68.183.77.106.
 *
 * The 2026-06-17 migration set whmHost + migratedAt + prevWhmHost on these
 * accounts but inherited the stale `protectionRepairCount: 3` +
 * `protectionLastSkipReason: "stuck_repair_loop"` flags from the dead old
 * WHM (209.38.241.9). The heartbeat query at
 * /app/js/protection-heartbeat.js:284 excludes anything with repairCount >= 3,
 * so 19/20 active accounts on the new server have had no AntiRed verification
 * for 24h.
 *
 * Clearing the flags causes ProtectionHeartbeat to re-evaluate these accounts
 * from scratch on its next 60-min tick. If protection is still healthy on the
 * new server (highly likely — accounts work, just unverified), the heartbeat
 * stays silent. If something *is* broken on the new server, it'll repair —
 * which is the whole point of the heartbeat.
 *
 * Idempotent + safe to re-run. Only affects accounts on the NEW WHM.
 */

require('dotenv').config({ path: '/app/.env' })
const { MongoClient } = require('mongodb')

const NEW_WHM_HOST = '68.183.77.106'
const MAX_CONSECUTIVE_REPAIRS = 3

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const col = db.collection('cpanelAccounts')

  // Pre-flight: what would be affected?
  const filter = {
    whmHost: NEW_WHM_HOST,
    protectionRepairCount: { $gte: MAX_CONSECUTIVE_REPAIRS },
  }
  const targets = await col.find(filter).project({ _id: 1, domain: 1, chatId: 1, protectionRepairCount: 1, protectionLastSkipReason: 1, migratedAt: 1 }).toArray()

  console.log(`Pre-flight: ${targets.length} accounts will be unstuck.\n`)
  for (const t of targets) {
    console.log(`  ${t._id.padEnd(10)} domain=${(t.domain || '?').padEnd(40)} chatId=${t.chatId}  count=${t.protectionRepairCount}  reason=${t.protectionLastSkipReason}`)
  }

  if (targets.length === 0) {
    console.log('\nNothing to do — exiting.')
    await client.close()
    process.exit(0)
  }

  // Execute
  const result = await col.updateMany(filter, {
    $unset: {
      protectionRepairCount: '',
      protectionLastSkipReason: '',
      protectionStuckAt: '',
      protectionRepairUpdatedAt: '',
    },
  })

  console.log(`\n✅ Modified ${result.modifiedCount} of ${result.matchedCount} matched accounts.`)
  console.log('   Next ProtectionHeartbeat tick (~60 min) will re-evaluate all of these.')
  console.log('   Watch /var/log/supervisor/nodejs.out.log for [ProtectionHeartbeat] Checking N cPanel accounts')

  // Verify
  const remaining = await col.countDocuments(filter)
  console.log(`\nVerify: ${remaining} accounts still match the stuck filter (expected: 0).`)

  await client.close()
  process.exit(0)
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
