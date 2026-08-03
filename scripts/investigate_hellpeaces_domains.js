// READ-ONLY: what domains are linked to @hellpeaces + are they reusable for new hosting?
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('/app/node_modules/mongodb')
const CHAT = '5522767823'
const DOMAIN = 'previteletterviews.com'
const short = (v, n = 600) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s && s.length > n ? s.slice(0, n) + '…' : s }
;(async () => {
  const client = new MongoClient(process.env.MONGO_URL); await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  console.log('══ domainsOf (by chatId and by domain key) ══')
  const doByChat = await db.collection('domainsOf').findOne({ _id: CHAT })
  console.log(' by chatId _id=%s :', CHAT, short(doByChat, 800))
  const doByDom = await db.collection('domainsOf').findOne({ _id: DOMAIN })
  console.log(' by domain _id=%s :', DOMAIN, short(doByDom, 400))

  console.log('\n══ registeredDomains ══')
  const rd = await db.collection('registeredDomains').findOne({ _id: DOMAIN })
  console.log(' ', short(rd, 800))
  // any registeredDomains for this chat
  const rdByChat = await db.collection('registeredDomains').find({ 'val.chatId': { $in: [CHAT, Number(CHAT)] } }).limit(20).toArray().catch(() => [])
  console.log(' registeredDomains w/ val.chatId=%s : %d', CHAT, rdByChat.length)
  rdByChat.forEach(r => console.log('   -', r._id, short(r.val, 200)))

  console.log('\n══ cpanelAccounts referencing this domain (primary or addon) ══')
  const cps = await db.collection('cpanelAccounts').find({ $or: [
    { domain: DOMAIN }, { _id: 'prevc2b4' },
    { 'addonDomains.domain': DOMAIN }, { addonDomains: DOMAIN },
  ] }).toArray()
  cps.forEach(a => console.log('   - _id=%s domain=%s deleted=%s terminatedOnWhm=%s addons=%s', a._id, a.domain, a.deleted, a.terminatedOnWhm, short(a.addonDomains, 120)))

  console.log('\n══ any OTHER active cpanelAccount that would block reuse (domain in use, not deleted) ══')
  const active = await db.collection('cpanelAccounts').find({ domain: DOMAIN, deleted: { $ne: true } }).toArray()
  console.log('  active cpanelAccounts on', DOMAIN, ':', active.length)

  // Scan for the domain string across likely collections
  console.log('\n══ domain string appears in collections ══')
  const cols = (await db.listCollections().toArray()).map(c => c.name)
  for (const cn of cols) {
    try {
      const cnt = await db.collection(cn).countDocuments({ $or: [ { domain: DOMAIN }, { _id: DOMAIN }, { domainName: DOMAIN } ] })
      if (cnt > 0) console.log('  ·', cn, ':', cnt)
    } catch (_) {}
  }
  await client.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
