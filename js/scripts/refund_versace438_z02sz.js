/* global process */
/**
 * REFUND for @Versace438 (chatId 7191777173) — $30.10 under-credit on deposit z02SZ.
 *
 * Context (verified end-to-end against DynoPay portal screenshot supplied
 * by operator on 2026-06-18):
 *   • Customer paid 0.00093443 BTC on-chain (tx 01abbd84…28c1) = $60.10
 *   • Bot's z02SZ webhook handler credited only $30 because it took
 *     DynoPay's `base_amount` (the *invoice* USD, $30) instead of the
 *     *actual market value* of the received BTC ($60.10). Bug at
 *     _index.js:33969–33976. Code fix shipping in same commit.
 *   • Under-credit: $30.10 owed to user.
 *
 * Action:
 *   1. atomic $inc walletOf.7191777173.usdIn += 30.10
 *   2. insert transactions row type=wallet-correction with full audit
 *   3. insert walletLedger row (parallel audit collection, if it exists)
 *
 * Notification:
 *   Deliberately does NOT send a Telegram message from the dev pod —
 *   production bot is on Railway and dev pod must not double-send. The
 *   operator will message the user via the support session.
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })
const { MongoClient } = require('mongodb')

const CHAT_ID = '7191777173'
const REFUND_AMOUNT = 30.10
const DEPOSIT_REF = 'z02SZ'
const DEPOSIT_TXN = 'TXN-20260618-5FCA6'
const DYNOPAY_PAYMENT_ID = '2fd3c05b-0654-48b1-a201-f165e587dcb8'
const ONCHAIN_TX = '01abbd84bf3934831a9513886fb1843b7a1886eab6702ae45de586082df228c1'
const SETTLEMENT_TX = '776667a0520f95dd59efff5285d00201933c1ceeebc79fc54056d543e86c0349'

function generateTxnId() {
  const d = new Date()
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '')
  const sfx = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `TXN-${ymd}-${sfx}`
}

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)

  // 0. Snapshot wallet BEFORE
  const before = await db.collection('walletOf').findOne({ _id: CHAT_ID })
  console.log('Wallet BEFORE:', JSON.stringify({
    usdIn: before?.usdIn, usdOut: before?.usdOut,
    balance: (before?.usdIn || 0) - (before?.usdOut || 0),
  }))

  // 1. Atomic increment usdIn
  const res = await db.collection('walletOf').updateOne(
    { _id: CHAT_ID },
    { $inc: { usdIn: REFUND_AMOUNT } }
  )
  console.log('walletOf.$inc result:', JSON.stringify(res))
  if (res.matchedCount !== 1) {
    throw new Error('Wallet update did not match exactly one document — aborting')
  }

  // 2. Snapshot wallet AFTER
  const after = await db.collection('walletOf').findOne({ _id: CHAT_ID })
  console.log('Wallet AFTER:', JSON.stringify({
    usdIn: after?.usdIn, usdOut: after?.usdOut,
    balance: (after?.usdIn || 0) - (after?.usdOut || 0),
  }))

  // 3. Audit transaction row
  const txnId = generateTxnId()
  await db.collection('transactions').insertOne({
    _id: txnId,
    transactionId: txnId,
    chatId: CHAT_ID,
    type: 'wallet-correction',
    amount: REFUND_AMOUNT,
    currency: 'USD',
    status: 'completed',
    description: `Under-credit refund: DynoPay confirmed $60.10 received for ${DEPOSIT_REF}, bot credited only $30 (base_amount bug)`,
    metadata: {
      originalDepositRef: DEPOSIT_REF,
      originalDepositTxn: DEPOSIT_TXN,
      dynopayPaymentId: DYNOPAY_PAYMENT_ID,
      onchainTxHash: ONCHAIN_TX,
      settlementTxHash: SETTLEMENT_TX,
      actualPaidUsd: 60.10,
      botCreditedUsd: 30.00,
      underCreditUsd: 30.10,
      bugFix: 'webhook now credits max(base_amount, convert(value, ticker, usd)) — see _index.js webhook handler patch 2026-06-18',
      appliedBy: 'support-audit-2026-06-18',
      reason: 'DynoPay portal verified actual amount received was $60.10 USD worth of BTC; bot under-credited via base_amount=invoice instead of received market value',
    },
    createdAt: new Date(),
  })
  console.log('Transaction logged:', txnId)

  // 4. walletLedger audit row (mirror of the credit)
  try {
    await db.collection('walletLedger').insertOne({
      chatId: CHAT_ID,
      action: 'credit',
      currency: 'USD',
      amount: REFUND_AMOUNT,
      reason: 'wallet-correction',
      txnId,
      ref: DEPOSIT_REF,
      createdAt: new Date(),
    })
    console.log('walletLedger row inserted')
  } catch (_) { /* collection may not exist on prod */ }

  // 5. Print recent transactions for sanity
  console.log('\n=== last 6 transactions ===')
  const recent = await db.collection('transactions').find({ chatId: CHAT_ID })
    .sort({ createdAt: -1 }).limit(6).toArray()
  for (const r of recent) {
    console.log(`  ${r.createdAt?.toISOString?.()}  ${r._id}  type=${r.type}  amount=$${r.amount}  status=${r.status}`)
  }

  await client.close()
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
