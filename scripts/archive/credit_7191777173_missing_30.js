/**
 * Credit chatId 7191777173 the missing $30 from the 2026-06-18 03:52 deposit.
 *
 * Evidence:
 *   TXN-20260618-5FCA6 credited 0.00093443 BTC as $30 (implied price $32,105/BTC)
 *   TXN-20260618-AFCAE credited 0.00031227 BTC as $20 (implied price $64,047/BTC)
 *   Live BTC price (Coinbase + Kraken cross-check at audit time): ~$63,870
 *   Deposit 1's correct USD value: 0.00093443 × $64,043 = $59.84 ≈ $60
 *   Customer claim of "$60 sent, only $30 credited" → confirmed accurate.
 *   Underlying bug: price oracle returned ~half the real BTC/USD rate at 03:52.
 *
 * Action:
 *   1. INCR walletOf[chatId].usdIn by 30
 *   2. Insert a TXN record so audit + customer-facing transaction list shows it
 *   3. Send a Telegram /reply to close the support ticket
 *
 * IDEMPOTENT — if a TXN of type=wallet-correction with ref=fix-5FCA6 already
 *              exists for this chatId, this script is a no-op.
 */
require('dotenv').config({ path: '/app/.env' })
const { MongoClient } = require('mongodb')

const CHAT = '7191777173'
const AMOUNT = 30
const REF = 'fix-5FCA6'
const REASON = 'BTC price-oracle returned ~50% rate on TXN-20260618-5FCA6 (deposit 0.00093443 BTC was worth ~$60 but credited as $30). Manual correction.'

;(async () => {
  const c = new MongoClient(process.env.MONGO_URL); await c.connect()
  const db = c.db(process.env.DB_NAME || 'test')

  // Idempotency check
  const existing = await db.collection('transactions').findOne({
    chatId: CHAT,
    'metadata.ref': REF,
  })
  if (existing) {
    console.log(`Already applied — txn ${existing._id} dated ${existing.createdAt}. No-op.`)
    await c.close()
    return
  }

  // Pre-state
  const beforeWallet = await db.collection('walletOf').findOne({ _id: CHAT })
  console.log(`Before walletOf: ${JSON.stringify(beforeWallet)}`)
  const balanceBefore = (beforeWallet?.usdIn || 0) - (beforeWallet?.usdOut || 0)
  console.log(`Balance before: $${balanceBefore}`)

  // Generate TXN id like the rest of the system
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
  const txnId = `TXN-${today}-${rand}`

  // Insert the correction txn
  await db.collection('transactions').insertOne({
    _id: txnId,
    chatId: CHAT,
    type: 'wallet-correction',
    amount: AMOUNT,
    currency: 'USD',
    status: 'completed',
    metadata: {
      ref: REF,
      originalTxn: 'TXN-20260618-5FCA6',
      reason: REASON,
      appliedBy: 'support-audit-2026-06-18',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  // Increment usdIn (wallet ledger)
  const r = await db.collection('walletOf').updateOne(
    { _id: CHAT },
    { $inc: { usdIn: AMOUNT } },
  )
  console.log(`walletOf $inc result: matched=${r.matchedCount} modified=${r.modifiedCount}`)

  // Post-state
  const afterWallet = await db.collection('walletOf').findOne({ _id: CHAT })
  console.log(`After walletOf:  ${JSON.stringify(afterWallet)}`)
  const balanceAfter = (afterWallet?.usdIn || 0) - (afterWallet?.usdOut || 0)
  console.log(`Balance after: $${balanceAfter}`)

  console.log(`\n✅ Credit applied — TXN ${txnId}: +$${AMOUNT} to chatId ${CHAT}`)
  console.log(`   Reason: ${REASON}`)

  await c.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
