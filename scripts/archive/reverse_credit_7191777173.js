/**
 * Reverse the premature $30 credit I applied to chatId 7191777173.
 *
 * Why: I inferred from the two BTC→USD rates in Mongo that the first deposit
 * was under-credited by half. I did NOT verify the on-chain receipt amount.
 * Operator reports only 0.00031227 BTC was actually received on-chain, NOT
 * $60-worth. So the customer may have sent less than intended (or be lying).
 *
 * This script:
 *   1. Reverses walletOf.usdIn by 30
 *   2. Marks the original correction TXN as 'reversed' rather than deleting,
 *      keeping the audit trail intact
 *
 * Idempotent — if the original TXN is already marked 'reversed', this is a no-op.
 */
require('dotenv').config({ path: '/app/.env' })
const { MongoClient } = require('mongodb')

const CHAT = '7191777173'
const REVERSE_AMOUNT = 30
const ORIGINAL_REF = 'fix-5FCA6'

;(async () => {
  const c = new MongoClient(process.env.MONGO_URL); await c.connect()
  const db = c.db(process.env.DB_NAME || 'test')

  const origTxn = await db.collection('transactions').findOne({
    chatId: CHAT,
    'metadata.ref': ORIGINAL_REF,
  })
  if (!origTxn) {
    console.log('No original correction txn found — nothing to reverse.')
    await c.close()
    return
  }
  if (origTxn.status === 'reversed') {
    console.log(`Original txn ${origTxn._id} is already 'reversed' — no-op.`)
    await c.close()
    return
  }

  const beforeWallet = await db.collection('walletOf').findOne({ _id: CHAT })
  console.log(`Before walletOf: ${JSON.stringify(beforeWallet)}`)
  console.log(`Balance before: $${(beforeWallet?.usdIn || 0) - (beforeWallet?.usdOut || 0)}`)

  // Mark original as reversed
  await db.collection('transactions').updateOne(
    { _id: origTxn._id },
    { $set: { status: 'reversed', updatedAt: new Date(), 'metadata.reversedAt': new Date(), 'metadata.reversalReason': 'On-chain receipt was 0.00031227 BTC, not $60. Original correction premature.' } }
  )

  // Decrement usdIn back to its pre-correction value
  const r = await db.collection('walletOf').updateOne(
    { _id: CHAT },
    { $inc: { usdIn: -REVERSE_AMOUNT } },
  )
  console.log(`walletOf $inc -${REVERSE_AMOUNT}: matched=${r.matchedCount} modified=${r.modifiedCount}`)

  const afterWallet = await db.collection('walletOf').findOne({ _id: CHAT })
  console.log(`After walletOf:  ${JSON.stringify(afterWallet)}`)
  console.log(`Balance after: $${(afterWallet?.usdIn || 0) - (afterWallet?.usdOut || 0)}`)
  console.log(`\n✅ Reversed — TXN ${origTxn._id} marked status='reversed'.`)
  await c.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
