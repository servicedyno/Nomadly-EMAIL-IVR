// Get @HHR2009's wallet history + admin replies + payments audit around
// the failed paperlesseviteguestreview.com purchase at 2026-07-06T10:52:39Z.
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('/app/node_modules/mongodb')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  const CHAT = '1960615421'
  const DOMAIN = 'paperlesseviteguestreview.com'
  const T = new Date('2026-07-06T10:52:39.539Z')
  const w0 = new Date(T.getTime() - 15 * 60_000)
  const w1 = new Date(T.getTime() + 30 * 60_000)

  console.log('═══ Wallet + audit around', T.toISOString(), '═══\n')

  // Current wallet balance
  const wallet = await db.collection('walletOf').findOne({ _id: CHAT })
  console.log('── walletOf ──')
  console.log(JSON.stringify(wallet, null, 2))

  // ALL transactions in the window (any type)
  console.log('\n── transactions in ±window (any) ──')
  const txAll = await db.collection('transactions').find({
    chatId: CHAT,
    createdAt: { $gte: w0, $lte: w1 },
  }).sort({ createdAt: 1 }).toArray()
  txAll.forEach(t => console.log(JSON.stringify(t)))

  // payments collection docs around the window
  console.log('\n── payments (recent 20 for user) ──')
  const pays = await db.collection('payments').find({}).sort({ _id: -1 }).limit(200).toArray()
  const userPays = pays.filter(p => {
    const v = typeof p.val === 'string' ? p.val : JSON.stringify(p)
    return v.includes(CHAT) || v.includes(DOMAIN)
  }).slice(0, 20)
  userPays.forEach(p => console.log(JSON.stringify(p)))

  // Admin reply logs for this user
  console.log('\n── admin_reply_logs.json (from /app/memory) — scanning for CHAT ──')
  const fs = require('fs')
  try {
    const arl = JSON.parse(fs.readFileSync('/app/memory/admin_reply_logs.json', 'utf8'))
    const arr = Array.isArray(arl) ? arl : (Array.isArray(arl.entries) ? arl.entries : Object.values(arl))
    const hits = arr.filter(a => {
      const s = JSON.stringify(a)
      return s.includes(CHAT) || s.includes(DOMAIN) || /HHR2009/i.test(s)
    }).slice(-10)
    hits.forEach(h => console.log(JSON.stringify(h)))
    if (hits.length === 0) console.log('  (none)')
  } catch (e) { console.log('  (could not read: ' + e.message + ')') }

  // Check state doc to see current session context
  console.log('\n── state doc (session) for @HHR2009 ──')
  const st = await db.collection('state').findOne({ _id: CHAT })
  console.log(JSON.stringify({
    _id: st?._id, action: st?.action, userLanguage: st?.userLanguage,
    website_name: st?.website_name, domain: st?.domain, plan: st?.plan,
    totalPrice: st?.totalPrice, domainPrice: st?.domainPrice, hostingPrice: st?.hostingPrice,
    price: st?.price, newPrice: st?.newPrice, couponApplied: st?.couponApplied,
    existingDomain: st?.existingDomain, connectExternalDomain: st?.connectExternalDomain,
    processingPayment: st?.processingPayment, cfZoneId: st?.cfZoneId,
    registrarFallback: st?.registrarFallback,
    updatedAt: st?.updatedAt,
  }, null, 2))

  // Also check chatIdOfPayment for any pending reference
  console.log('\n── chatIdOfPayment (recent 200) matching @HHR2009 ──')
  const cop = await db.collection('chatIdOfPayment').find({}).sort({ _id: -1 }).limit(200).toArray()
  const copH = cop.filter(c => (typeof c.val === 'string' ? c.val : JSON.stringify(c)).includes(CHAT))
  copH.slice(0, 10).forEach(c => console.log(JSON.stringify(c)))

  // Also check dynopay payment intent state for hhr2009's pending order
  console.log('\n── chatIdOfDynopayPayment recent matches ──')
  const codp = await db.collection('chatIdOfDynopayPayment').find({}).sort({ _id: -1 }).limit(200).toArray()
  const codpH = codp.filter(c => (typeof c.val === 'string' ? c.val : JSON.stringify(c)).includes(CHAT))
  codpH.slice(0, 10).forEach(c => console.log(JSON.stringify(c)))

  await client.close()
})().catch(e => { console.error('FATAL', e.stack || e); process.exit(1) })
