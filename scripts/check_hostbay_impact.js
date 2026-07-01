require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
;(async () => {
  const uri = process.env.MONGO_URL
  const dbn = process.env.DB_NAME || 'test'
  const c = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 })
  await c.connect()
  const db = c.db(dbn)
  const cid = '5168006768'
  const ncid = 5168006768
  const anyId = { $in: [cid, ncid] }

  // Check payments/transactions in the last 24h
  const now = new Date()
  const since = new Date(now.getTime() - 24 * 3600 * 1000)

  console.log('=== Wallet ===')
  console.log(await db.collection('walletOf').findOne({ _id: cid }))

  console.log('\n=== payments records (VPS/wallet) ===')
  const payments = await db.collection('payments').find({
    val: { $regex: cid }
  }).sort({ _id: -1 }).limit(20).toArray()
  for (const p of payments) console.log(' ', p._id, ':', p.val)

  console.log('\n=== transactions (structured) ===')
  const txns = await db.collection('transactions').find({
    $or: [{ chatId: cid }, { chatId: ncid }],
    createdAt: { $gte: since }
  }).sort({ createdAt: -1 }).limit(20).toArray()
  for (const t of txns) console.log(' ', JSON.stringify(t).slice(0, 300))

  console.log('\n=== userVPSDetails ===')
  const vps = await db.collection('userVPSDetails').find({
    $or: [{ chatId: cid }, { chatId: ncid }, { userChatId: cid }, { userChatId: ncid }]
  }).sort({ createdAt: -1 }).limit(20).toArray()
  for (const v of vps) console.log(' ', JSON.stringify(v).slice(0, 400))

  console.log('\n=== State (info fields relevant) ===')
  const s = await db.collection('state').findOne({ _id: cid })
  console.log('  vpsDetails:', JSON.stringify(s?.vpsDetails, null, 2))
  console.log('  price:', s?.price)
  console.log('  totalPrice:', s?.totalPrice)

  console.log('\n=== marketplaceAccess ===')
  console.log(await db.collection('marketplaceAccess').findOne({ _id: anyId }))

  console.log('\n=== abandonedCarts (last 3) ===')
  const carts = await db.collection('abandonedCarts').find({ chatId: cid }).sort({ reachedAt: -1 }).limit(3).toArray()
  for (const cart of carts) console.log(' ', JSON.stringify(cart).slice(0, 300))

  await c.close()
})().catch(e => { console.error('ERR:', e.message); process.exit(1) })
