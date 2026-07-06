/**
 * BACKFILL one-shot: insert the missing `domain-refund` record for
 * @leprechaun00's first .com.au attempt (03:14:22Z USDT-ERC20 $65)
 * that was refunded to wallet without leaving a transactions row.
 *
 * Safe to re-run — uses fixed _id so any second run is a no-op upsert.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const FIXED_ID = 'TXN-20260616-LP65R'   // unique, descriptive, idempotent
const CHAT_ID  = '6550622589'
const DOMAIN   = 'coinspotsupport.com.au'
const COIN     = 'USDT-ERC20'
const VALUE    = 65          // crypto amount sent (in USDT terms, ≈USD)
const USD      = 65
const ORIG_REF = 'zW0nH'                                // payments._id from the audit row
const ORIG_PAY = '6eab504d-9c58-49e0-a905-665559efd3a9' // payment_id from the audit row
const ORIG_TS  = new Date('2026-06-16T03:14:22Z')

;(async () => {
  const cli = new MongoClient(process.env.MONGO_URL); await cli.connect()
  const db = cli.db()

  // Verify the user actually had this gap (no domain-refund row for this domain already)
  const existing = await db.collection('transactions').findOne({
    chatId: CHAT_ID, type: 'domain-refund', 'metadata.domain': DOMAIN
  })
  if (existing) {
    console.log(`Already has a domain-refund row for ${DOMAIN} (id=${existing._id}). No backfill needed.`)
    await cli.close(); return
  }

  const doc = {
    _id: FIXED_ID,
    chatId: CHAT_ID,
    type: 'domain-refund',
    amount: USD,
    currency: 'USD',
    status: 'refunded',
    metadata: {
      domain: DOMAIN,
      coin: COIN,
      value: VALUE,
      ref: ORIG_REF,
      paymentId: ORIG_PAY,
      source: 'dynopay',
      reason: 'buyDomainFullProcess failed (OP code 374 — missing additional_data — pre-fix bug)',
      backfill: true,
      backfilledAt: new Date(),
      backfillNote: 'Wallet was credited at 03:14:22Z but no transactions row was written. Original payments row: zW0nH.',
    },
    createdAt: ORIG_TS,
    updatedAt: new Date(),
  }

  const r = await db.collection('transactions').updateOne(
    { _id: FIXED_ID },
    { $set: doc },
    { upsert: true }
  )
  console.log(`Backfill: matched=${r.matchedCount} modified=${r.modifiedCount} upsertedId=${r.upsertedId || '-'}`)
  console.log('Inserted document:')
  console.log(JSON.stringify(doc, null, 2))

  // Show the user's full updated history
  const all = await db.collection('transactions').find({ chatId: CHAT_ID }).sort({ createdAt: 1 }).toArray()
  console.log(`\nUser now has ${all.length} transactions:`)
  for (const t of all) {
    console.log(`  ${(t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt)).substring(0,19)}  ${(t.type||'?').padEnd(22)} ${String(t.amount||0).padStart(6)} ${t.currency||''}  ${t.status||''}`)
  }
  await cli.close()
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
