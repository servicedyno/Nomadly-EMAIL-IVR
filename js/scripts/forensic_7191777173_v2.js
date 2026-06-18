/* global process */
/**
 * Verify wallet ledger / hosting tx for 7191777173.
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })
const { MongoClient } = require('mongodb')

const CHAT_ID = '7191777173'

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)

  const ledger = await db.collection('walletLedger')
    .find({ chatId: CHAT_ID }).sort({ createdAt: 1 }).toArray()
  console.log(`=== walletLedger (${ledger.length}) ===`)
  for (const e of ledger) console.log(JSON.stringify(e), '\n---')

  const audit = await db.collection('walletAudit')
    .find({ chatId: CHAT_ID }).sort({ createdAt: 1 }).toArray()
  console.log(`\n=== walletAudit (${audit.length}) ===`)
  for (const e of audit) console.log(JSON.stringify(e), '\n---')

  const hosting = await db.collection('hostingTransactions')
    .find({ chatId: CHAT_ID }).toArray()
  console.log(`\n=== hostingTransactions (${hosting.length}) ===`)
  for (const e of hosting) console.log(JSON.stringify(e), '\n---')

  await client.close()
})().catch(e => { console.error(e); process.exit(1) })
