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
  const now = new Date()
  const since = new Date(now.getTime() - 12 * 3600 * 1000)  // last 12h

  const out = {}
  const anyId = { $in: [cid, ncid] }

  // Basic profile
  out.name = await db.collection('nameOf').findOne({ _id: { $in: [cid, ncid] } })
  out.wallet = await db.collection('walletOf').findOne({ _id: { $in: [cid, ncid] } })
  out.state = await db.collection('state').findOne({ _id: { $in: [cid, ncid] } })

  // Marketplace access
  out.mpAccess = await db.collection('marketplaceAccess').findOne({ _id: anyId })

  // Payments in last 12h
  out.recentPayments = await db.collection('payments').find({
    chatId: anyId,
    at: { $gte: since.toISOString() },
  }).sort({ at: -1 }).limit(30).toArray()

  // Also check alternate field names
  out.recentPayments_ts = await db.collection('payments').find({
    chatId: anyId,
    timestamp: { $gte: since }
  }).sort({ timestamp: -1 }).limit(30).toArray()

  // VPS records
  out.vps = await db.collection('userVPSDetails').find({ chatId: anyId }).sort({ createdAt: -1 }).limit(10).toArray()
  out.vpsAlt = await db.collection('vpsOf').find({ _id: anyId }).limit(5).toArray()

  // ChatIdOfPayment (in-mem may not be in db) & ChatIdOfDynopayPayment
  const paymentColls = await db.listCollections({ name: /^chatIdOf/i }).toArray()
  out.paymentColls = paymentColls.map(x => x.name)

  // Payment collections lookup
  for (const coll of ['chatIdOfPayment', 'chatIdOfDynopayPayment', 'chatIdOfBBPayment']) {
    try {
      const docs = await db.collection(coll).find({ 'val.chatId': anyId }).sort({ 'val._createdAt': -1 }).limit(10).toArray()
      if (docs.length) out[coll] = docs
    } catch (_) {}
  }

  // Any collection containing this chatId in the last 12h (best effort)
  // - Check leadJobs, plansOf, phoneNumbersOf as well
  out.planOf = await db.collection('planOf').findOne({ _id: { $in: [cid, ncid] } })

  console.log(JSON.stringify(out, null, 2))
  await c.close()
})().catch(e => { console.error('ERR:', e.message); process.exit(1) })
