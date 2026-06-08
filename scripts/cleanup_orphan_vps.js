#!/usr/bin/env node
/**
 * One-shot cleanup for the two orphan VPS instances that have been generating
 * the "VPS DELETE FAILED" admin spam (132 alerts / 911 log lines in 11h).
 *
 * Instances:
 *   - 203283942   (911 log lines, every ~5 min since 2026-06-07T20:05Z)
 *   - 203250431   (22 log lines, every ~30 min GET drift-check)
 *
 * Both return Contabo 404 "Entry Instances not found" — they are already
 * gone on Contabo's side; our DB record is the only thing keeping the
 * scheduler in a retry loop.
 *
 * Safety:
 *   - Targets ONLY the two specific vpsIds via $in
 *   - Dry-run first (prints affected docs); pass --apply to commit
 *   - Logs the before/after status so we can rollback if needed
 */

require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL
const DB_NAME   = process.env.DB_NAME

const TARGET_IDS = ['203283942', '203250431']
const APPLY      = process.argv.includes('--apply')

if (!MONGO_URL) { console.error('MONGO_URL missing from /app/backend/.env'); process.exit(1) }
if (!DB_NAME)   { console.error('DB_NAME missing from /app/backend/.env');   process.exit(1) }

;(async () => {
  const client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 15000 })
  await client.connect()
  const db = client.db(DB_NAME)
  const col = db.collection('vpsPlansOf')

  console.log(`\nMongo: ${MONGO_URL.replace(/:\/\/[^@]+@/, '://<creds>@')}`)
  console.log(`DB:    ${DB_NAME}`)
  console.log(`Mode:  ${APPLY ? 'APPLY (write)' : 'DRY-RUN (no write)'}\n`)

  // 1. find the docs first
  const docs = await col.find({ vpsId: { $in: TARGET_IDS } }).toArray()
  console.log(`Found ${docs.length} matching doc(s):`)
  for (const d of docs) {
    console.log(`  - vpsId=${d.vpsId}  status=${d.status}  end_time=${d.end_time?.toISOString?.()||d.end_time}  chatId=${d.chatId}  label=${d.label||'-'}  contaboInstanceId=${d.contaboInstanceId}`)
  }

  // also search by contaboInstanceId in case vpsId is stored differently
  const altDocs = await col.find({
    contaboInstanceId: { $in: TARGET_IDS.concat(TARGET_IDS.map(Number)) },
    vpsId: { $nin: TARGET_IDS },
  }).toArray()
  if (altDocs.length) {
    console.log(`\nAdditional docs matched by contaboInstanceId (${altDocs.length}):`)
    for (const d of altDocs) {
      console.log(`  - _id=${d._id}  vpsId=${d.vpsId}  contaboInstanceId=${d.contaboInstanceId}  status=${d.status}`)
    }
  }

  if (!APPLY) {
    console.log('\nDRY-RUN complete. Re-run with --apply to commit the update.')
    await client.close()
    return
  }

  // 2. apply the update — vpsId match
  const res = await col.updateMany(
    { vpsId: { $in: TARGET_IDS } },
    { $set: {
        status: 'DELETED',
        deletedAt: new Date(),
        cancelReason: 'manual_contabo_404_cleanup',
        _cleanupSource: 'fork-2026-06-08_manual_cleanup',
    } }
  )
  console.log(`\nupdateMany result:  matched=${res.matchedCount}  modified=${res.modifiedCount}`)

  // also clean altDocs if any
  if (altDocs.length) {
    const altRes = await col.updateMany(
      { _id: { $in: altDocs.map(d => d._id) } },
      { $set: {
          status: 'DELETED',
          deletedAt: new Date(),
          cancelReason: 'manual_contabo_404_cleanup',
          _cleanupSource: 'fork-2026-06-08_manual_cleanup',
      } }
    )
    console.log(`alt updateMany result: matched=${altRes.matchedCount}  modified=${altRes.modifiedCount}`)
  }

  // 3. verify
  const after = await col.find({
    $or: [
      { vpsId: { $in: TARGET_IDS } },
      ...(altDocs.length ? [{ _id: { $in: altDocs.map(d => d._id) } }] : []),
    ],
  }).toArray()
  console.log(`\nVerification (${after.length} docs):`)
  for (const d of after) {
    console.log(`  - vpsId=${d.vpsId}  status=${d.status}  deletedAt=${d.deletedAt?.toISOString?.()}  cancelReason=${d.cancelReason}`)
  }

  await client.close()
  console.log('\n✅ cleanup complete')
})().catch(err => { console.error('FAILED:', err); process.exit(1) })
