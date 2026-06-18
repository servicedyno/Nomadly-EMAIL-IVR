/* global process */
/**
 * Look up the new DynoPay payment_id aa1a43f8-e754-42d7-8673-c16cd082a3a8
 * in our records to identify the bot user + intent.
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })
const { MongoClient } = require('mongodb')

const NEW_PAYMENT_ID = 'aa1a43f8-e754-42d7-8673-c16cd082a3a8'

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)

  // 1. transactions where metadata.transactionId, metadata.id, or metadata.payment_id match
  console.log(`=== transactions matching payment_id ${NEW_PAYMENT_ID} ===`)
  const txs = await db.collection('transactions').find({
    $or: [
      { 'metadata.transactionId': NEW_PAYMENT_ID },
      { 'metadata.payment_id': NEW_PAYMENT_ID },
      { 'metadata.id': NEW_PAYMENT_ID },
    ],
  }).toArray()
  console.log(`Found ${txs.length}`)
  for (const t of txs) console.log(JSON.stringify(t, null, 2))

  // 2. payments collection scan (val string contains payment_id as last column)
  console.log(`\n=== payments rows containing the payment_id ===`)
  const pays = await db.collection('payments').find({
    val: { $regex: NEW_PAYMENT_ID }
  }).toArray()
  console.log(`Found ${pays.length}`)
  for (const p of pays) console.log(`  ref=${p._id}: ${p.val}`)

  // 3. chatIdOfDynopayPayment — any active session that matches by payment_id
  console.log(`\n=== chatIdOfDynopayPayment (all live entries) ===`)
  const all = await db.collection('chatIdOfDynopayPayment').find({}).toArray()
  console.log(`Total alive sessions: ${all.length}`)
  for (const a of all) {
    const v = a.val || a
    if (JSON.stringify(v).includes(NEW_PAYMENT_ID)) {
      console.log('MATCH:', JSON.stringify(a, null, 2))
    }
  }

  // 4. New forensic collections (only populated post-patch deployment)
  try {
    const wh = await db.collection('dynopayWebhooks').find({ paymentId: NEW_PAYMENT_ID }).toArray()
    if (wh.length) {
      console.log(`\n=== dynopayWebhooks ===`)
      for (const w of wh) console.log(JSON.stringify(w, null, 2))
    }
  } catch (_) { /* coll may not exist yet */ }
  try {
    const cda = await db.collection('cryptoDepositAddresses').findOne({ webhookPaymentId: NEW_PAYMENT_ID })
    if (cda) {
      console.log(`\n=== cryptoDepositAddresses ===`)
      console.log(JSON.stringify(cda, null, 2))
    }
  } catch (_) { /* */ }

  // 5. List the 5 most recent chatIdOfDynopayPayment entries (we don't know
  //    if there's a separate timestamp; show what's there)
  console.log(`\n=== ALL live chatIdOfDynopayPayment entries (action / chatId / domain / price / address) ===`)
  for (const a of all) {
    const v = a.val || a
    console.log(`  _id=${a._id}  ${JSON.stringify({
      chatId: v.chatId, action: v.action, address: v.address,
      domain: v.domain, price: v.price, orderId: v.orderId,
      _createdAt: v._createdAt
    })}`)
  }

  await client.close()
})().catch(e => { console.error(e); process.exit(1) })
