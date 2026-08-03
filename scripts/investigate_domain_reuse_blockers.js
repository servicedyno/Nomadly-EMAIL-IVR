// READ-ONLY: check leftover per-domain state + any ban/suppression that could block reuse.
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('/app/node_modules/mongodb')
const DOMAIN = 'previteletterviews.com'
const CHAT = '5522767823'
const short = (v, n = 500) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s && s.length > n ? s.slice(0, n) + '…' : s }
;(async () => {
  const client = new MongoClient(process.env.MONGO_URL); await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  for (const cn of ['dnsHealState', 'sslGracePeriod', 'paymentIntents', 'cryptoDepositAddresses']) {
    const docs = await db.collection(cn).find({ $or: [{ _id: DOMAIN }, { domain: DOMAIN }, { domainName: DOMAIN } ] }).toArray().catch(() => [])
    console.log(`\n══ ${cn} (${docs.length}) ══`)
    docs.forEach(d => console.log('  ', short(d, 400)))
  }

  console.log('\n══ honeypotTriggers for domain (count + sample + status fields) ══')
  const hpCount = await db.collection('honeypotTriggers').countDocuments({ $or: [{ domain: DOMAIN }, { _id: DOMAIN }] })
  console.log('  count:', hpCount)
  const hpSample = await db.collection('honeypotTriggers').find({ $or: [{ domain: DOMAIN }] }).limit(2).toArray().catch(() => [])
  hpSample.forEach(h => console.log('  sample:', short(h, 300)))

  // Look for any domain-ban / suppression / blacklist collection
  console.log('\n══ scan for ban/blacklist/suppress collections referencing domain or chat ══')
  const cols = (await db.listCollections().toArray()).map(c => c.name)
  const suspect = cols.filter(n => /ban|block|blacklist|suppress|flag|abuse|fraud|ban|disable|suspend/i.test(n))
  console.log('  suspect collections:', JSON.stringify(suspect))
  for (const cn of suspect) {
    const cnt = await db.collection(cn).countDocuments({ $or: [ { _id: DOMAIN }, { domain: DOMAIN }, { chatId: CHAT }, { chatId: Number(CHAT) } ] }).catch(() => 0)
    if (cnt) { console.log(`  · ${cn}: ${cnt}`); const s = await db.collection(cn).find({ $or: [ { _id: DOMAIN }, { domain: DOMAIN }, { chatId: CHAT } ] }).limit(3).toArray(); s.forEach(x => console.log('     ', short(x, 300))) }
  }
  await client.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
