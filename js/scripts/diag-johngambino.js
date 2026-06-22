// Read-only diagnostic: dumps the johngambino phone doc, recent transactions,
// and Twilio sub-account state. Writes NOTHING.
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const CHAT_ID = '817673476'
const PHONE = '+18884879051'

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  // Production DB — name comes from MONGO_URL path
  const db = client.db()

  const doc = await db.collection('phoneNumbersOf').findOne({ _id: CHAT_ID })
  console.log('\n=== phoneNumbersOf doc for', CHAT_ID, '===')
  console.log(JSON.stringify(doc, null, 2))

  const txns = await db.collection('phoneTransactions')
    .find({ chatId: CHAT_ID, phoneNumber: PHONE })
    .sort({ timestamp: -1 })
    .limit(10)
    .toArray()
  console.log('\n=== last 10 phoneTransactions for', PHONE, '===')
  console.log(JSON.stringify(txns, null, 2))

  const allTxns = await db.collection('phoneTransactions')
    .find({ chatId: CHAT_ID })
    .sort({ timestamp: -1 })
    .limit(10)
    .toArray()
  console.log('\n=== last 10 ANY phoneTransactions for chatId', CHAT_ID, '===')
  console.log(JSON.stringify(allTxns, null, 2))

  const wallet = await db.collection('walletOf').findOne({ _id: CHAT_ID })
  console.log('\n=== walletOf ===')
  console.log(JSON.stringify(wallet, null, 2))

  const name = await db.collection('nameOf').findOne({ _id: CHAT_ID })
  console.log('\n=== nameOf ===')
  console.log(JSON.stringify(name, null, 2))

  await client.close()
})().catch(e => { console.error(e); process.exit(1) })
