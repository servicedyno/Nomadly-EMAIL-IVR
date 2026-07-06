// Deep-dive @HHR2009's 2026-07-06 failed hosting purchase
// paperlesseviteguestreview.com — outcome=domain_only, wallet_usd, $35.10
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('/app/node_modules/mongodb')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  const CHAT = '1960615421'  // @HHR2009
  const DOMAIN = 'paperlesseviteguestreview.com'

  console.log('═══ @HHR2009 failed hosting: ' + DOMAIN + ' ═══\n')

  // 1) hostingTransactions doc (full)
  const htx = await db.collection('hostingTransactions').findOne({ chatId: CHAT, domain: DOMAIN })
  console.log('── hostingTransactions ──')
  console.log(JSON.stringify(htx, null, 2))

  // 2) transactions of the same domain
  console.log('\n── transactions (any type) mentioning this domain ──')
  const txns = await db.collection('transactions').find({
    chatId: CHAT,
    'metadata.domain': DOMAIN,
  }).sort({ createdAt: 1 }).toArray()
  txns.forEach(t => console.log(JSON.stringify(t)))

  // 3) domainsOf record — was the domain actually registered?
  console.log('\n── domainsOf ──')
  const dom = await db.collection('domainsOf').findOne({ chatId: CHAT, domainName: DOMAIN })
  console.log(dom ? JSON.stringify(dom, null, 2) : 'NOT FOUND (domain never registered)')

  // 4) cpanelAccounts / cpanelPendingJobs — hosting side
  console.log('\n── cpanelAccounts ──')
  const cp = await db.collection('cpanelAccounts').find({ chatId: CHAT, domain: DOMAIN }).toArray()
  console.log(cp.length ? JSON.stringify(cp, null, 2) : 'NOT FOUND')
  console.log('\n── cpanelPendingJobs ──')
  const cpj = await db.collection('cpanelPendingJobs').find({ chatId: CHAT, domain: DOMAIN }).toArray()
  console.log(cpj.length ? JSON.stringify(cpj, null, 2) : 'NOT FOUND')

  // 5) any bot crash around the transaction time?
  const t0 = htx && htx.timestamp ? new Date(htx.timestamp) : null
  if (t0) {
    const start = new Date(t0.getTime() - 5 * 60 * 1000)
    const end = new Date(t0.getTime() + 30 * 60 * 1000)
    console.log(`\n── botCrashes between ${start.toISOString()} and ${end.toISOString()} ──`)
    const crashes = await db.collection('botCrashes').find({
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { timestamp: { $gte: start, $lte: end } },
      ],
    }).toArray()
    console.log(crashes.length ? JSON.stringify(crashes.slice(0, 5), null, 2) : 'no crashes')

    console.log(`\n── notifications / escalations (same window) ──`)
    const esc = await db.collection('escalations').find({
      chatId: CHAT,
      $or: [{ createdAt: { $gte: start, $lte: end } }, { timestamp: { $gte: start, $lte: end } }],
    }).toArray()
    console.log(esc.length ? JSON.stringify(esc, null, 2) : 'none')
  }

  // 6) The AI-support chat history in the last few hours to see what he complained about
  console.log('\n── aiSupportChats — last 8 for @HHR2009 (most recent first) ──')
  const chats = await db.collection('aiSupportChats').find({ chatId: CHAT }).sort({ createdAt: -1 }).limit(8).toArray()
  chats.forEach(c => {
    const preview = (c.content || '').slice(0, 300).replace(/\n/g, ' ⏎ ')
    console.log(`[${c.createdAt}] ${c.role}: ${preview}`)
  })

  // 7) also check registeredDomains, digitalOrders
  console.log('\n── registeredDomains ──')
  const rd = await db.collection('registeredDomains').find({ chatId: CHAT, domain: DOMAIN }).toArray()
  console.log(rd.length ? JSON.stringify(rd, null, 2) : 'NOT FOUND')

  // 8) look at complaints_24h if it mentioned this txn
  await client.close()
})().catch(e => { console.error('FATAL', e.stack || e); process.exit(1) })
