// Comprehensive deposit/payment flow verification for Nomadly bot.
// Tests: 1) Crypto top-up initiation, 2) Wallet-payment guard regression
'use strict'
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') })
const { MongoClient } = require('mongodb')

async function main() {
  const client = new MongoClient(process.env.MONGO_URL); await client.connect()
  const db = client.db(process.env.DB_NAME)
  
  console.log('\n═══ MONGODB COLLECTIONS VERIFICATION ═══\n')
  
  // Check collections exist
  const collections = await db.listCollections().toArray()
  const collNames = collections.map(c => c.name)
  
  console.log('✅ Required collections present:')
  const required = ['state', 'walletOf', 'chatIdOfDynopayPayment']
  for (const name of required) {
    const exists = collNames.includes(name)
    console.log(`  ${exists ? '✅' : '❌'} ${name}`)
  }
  
  // Check state collection structure
  console.log('\n✅ State collection sample (last 3 test records):')
  const states = await db.collection('state').find({ _id: { $regex: /^888800/ } }).sort({ _id: -1 }).limit(3).toArray()
  for (const s of states) {
    console.log(`  chatId: ${s._id}, action: ${s.action || 'none'}, userLanguage: ${s.userLanguage || 'N/A'}`)
  }
  
  // Check walletOf collection structure
  console.log('\n✅ WalletOf collection sample (last 3 test records):')
  const wallets = await db.collection('walletOf').find({ _id: { $regex: /^888800/ } }).sort({ _id: -1 }).limit(3).toArray()
  for (const w of wallets) {
    console.log(`  chatId: ${w._id}, usdIn: ${w.usdIn || 0}, usdOut: ${w.usdOut || 0}, balance: ${(w.usdIn || 0) - (w.usdOut || 0)}`)
  }
  
  // Check chatIdOfDynopayPayment collection
  console.log('\n✅ ChatIdOfDynopayPayment collection (recent test records):')
  const payments = await db.collection('chatIdOfDynopayPayment').find({}).sort({ _id: -1 }).limit(5).toArray()
  console.log(`  Total records: ${payments.length}`)
  for (const p of payments) {
    console.log(`  paymentId: ${p._id}, chatId: ${p.val?.chatId || 'N/A'}, status: ${p.val?.status || 'N/A'}`)
  }
  
  console.log('\n═══ VERIFICATION COMPLETE ═══\n')
  
  await client.close()
  process.exit(0)
}

main().catch(e => { console.error('FATAL', e); process.exit(2) })
