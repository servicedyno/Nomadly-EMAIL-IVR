/* global process */
/**
 * READ-ONLY forensic dump for chatId 7191777173 — $60 vs $30 deposit dispute.
 * Pulls from production Mongo (no writes).
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })
const { MongoClient } = require('mongodb')

const CHAT_ID = '7191777173'
const REFS = ['z02SZ', 'drKee']
const PAYMENT_IDS = [
  '2fd3c05b-0654-48b1-a201-f165e587dcb8',
  'a2b3a5a8-c103-4d63-bf89-8df4e5c1aadd',
]

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)
  console.log('Connected to db:', process.env.DB_NAME)
  console.log('')

  // 1. Wallet
  const wallet = await db.collection('walletOf').findOne({ _id: CHAT_ID })
  console.log('=== WALLET (walletOf) ===')
  console.log(JSON.stringify(wallet, null, 2))
  console.log('')

  // 2. Payments by ref
  console.log('=== PAYMENTS (payments) by ref ===')
  for (const ref of REFS) {
    const p = await db.collection('payments').findOne({ _id: ref })
    console.log(`ref ${ref}:`, JSON.stringify(p, null, 2))
  }
  console.log('')

  // 3. Transactions ledger
  console.log('=== TRANSACTIONS (transactions) for this chatId ===')
  const txs = await db.collection('transactions')
    .find({ chatId: CHAT_ID })
    .sort({ createdAt: -1 })
    .limit(30)
    .toArray()
  console.log(`Found ${txs.length} transactions`)
  for (const tx of txs) {
    console.log(JSON.stringify(tx, null, 2))
    console.log('---')
  }
  console.log('')

  // Also try numeric chatId
  const txsNum = await db.collection('transactions')
    .find({ chatId: Number(CHAT_ID) })
    .sort({ createdAt: -1 })
    .limit(30)
    .toArray()
  console.log(`(numeric chatId) Found ${txsNum.length} transactions`)
  for (const tx of txsNum) {
    console.log(JSON.stringify(tx, null, 2))
    console.log('---')
  }
  console.log('')

  // 4. Transactions by metadata.ref
  console.log('=== TRANSACTIONS where metadata.ref in refs ===')
  const txByRef = await db.collection('transactions')
    .find({ 'metadata.ref': { $in: REFS } })
    .toArray()
  console.log(JSON.stringify(txByRef, null, 2))
  console.log('')

  // 5. chatIdOfDynopayPayment (active intent map)
  console.log('=== chatIdOfDynopayPayment by ref ===')
  for (const ref of REFS) {
    const p = await db.collection('chatIdOfDynopayPayment').findOne({ _id: ref })
    console.log(`ref ${ref}:`, JSON.stringify(p, null, 2))
  }
  console.log('')

  // 6. Try transactions matching paymentId in metadata
  console.log('=== TRANSACTIONS where metadata.transactionId or metadata.id in paymentIds ===')
  const txByPid = await db.collection('transactions')
    .find({
      $or: [
        { 'metadata.payment_id': { $in: PAYMENT_IDS } },
        { 'metadata.transactionId': { $in: PAYMENT_IDS } },
        { 'metadata.id': { $in: PAYMENT_IDS } },
      ]
    })
    .toArray()
  console.log(JSON.stringify(txByPid, null, 2))
  console.log('')

  // 7. Listing collections (sample)
  const colls = await db.listCollections().toArray()
  const interesting = colls.map(c => c.name).filter(n => /pay|wallet|dyno|crypto|transaction|deposit/i.test(n))
  console.log('Possibly relevant collections:', interesting)
  console.log('')

  // 8. State action for this user
  const st = await db.collection('state').findOne({ _id: CHAT_ID })
  console.log('=== STATE for user ===')
  console.log(JSON.stringify(st, null, 2))

  await client.close()
})().catch(e => { console.error(e); process.exit(1) })
