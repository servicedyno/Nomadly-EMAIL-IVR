require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const CHATID = '404562920'

  // Full state record
  const state = await db.collection('state').findOne({ _id: CHATID })
  console.log('=== state record ===')
  console.log(JSON.stringify(state, null, 2))

  // Any past VPS attempts that may have failed
  const txs = await db.collection('transactions').find({ chatId: CHATID }).sort({ createdAt: -1 }).limit(20).toArray()
  console.log(`\n=== transactions (${txs.length}) ===`)
  for (const t of txs) console.log(`  ${t.createdAt} ${t.type} $${t.amount} ${t.description || ''} ${t.note || ''}`)

  // Wallet
  const w = await db.collection('wallet').findOne({ _id: CHATID })
  console.log('\n=== wallet ===')
  console.log(JSON.stringify(w, null, 2))

  // user record
  const u = await db.collection('users').findOne({ _id: CHATID })
  console.log('\n=== users record ===')
  console.log(JSON.stringify(u, null, 2)?.substring(0, 2000))

  // any logs/conversation hints
  const conv = await db.collection('conversation').find({ chatId: CHATID }).sort({ createdAt: -1 }).limit(15).toArray()
  console.log(`\n=== conversation (${conv.length}) ===`)
  for (const c of conv) console.log(`  ${c.createdAt} role=${c.role}: ${(c.content || '').substring(0, 150)}`)
  
  // Check vpsPlansOf for any record (active/inactive)
  const vps = await db.collection('vpsPlansOf').find({ chatId: CHATID }).toArray()
  console.log(`\n=== vpsPlansOf entries (${vps.length}) ===`)
  for (const v of vps) console.log(JSON.stringify(v, null, 2))

  await client.close()
})().catch(e => { console.error(e.message); process.exit(1) })
