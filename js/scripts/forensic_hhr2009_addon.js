/* global process */
/**
 * READ-ONLY: investigate HHR2009 (chatId 1960615421) addon-domain DNS issue.
 * Recent purchase + link to hosting plan, DNS hasn't propagated, dashboard error.
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })
const { MongoClient } = require('mongodb')

const CHAT_ID = '1960615421'

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)
  console.log('connected to', process.env.DB_NAME)

  // 1. State (current action, recent flow)
  const st = await db.collection('state').findOne({ _id: CHAT_ID })
  console.log('\n=== STATE ===')
  console.log(JSON.stringify(st, null, 2).slice(0, 2500))

  // 2. Domains owned (look for the addon)
  console.log('\n=== domainsOf ===')
  const doms = await db.collection('domainsOf').findOne({ _id: CHAT_ID })
  console.log(JSON.stringify(doms?.val || doms, null, 2))

  // 3. cpanelAccounts for this user
  console.log('\n=== cpanelAccounts ===')
  const cps = await db.collection('cpanelAccounts').find({ chatId: CHAT_ID }).toArray()
  for (const c of cps) console.log(JSON.stringify(c, null, 2), '\n---')

  // 4. Most recent transactions for this user (last 20)
  console.log('\n=== recent transactions ===')
  const txs = await db.collection('transactions').find({ chatId: CHAT_ID })
    .sort({ createdAt: -1 }).limit(20).toArray()
  for (const t of txs) console.log(JSON.stringify(t))

  // 5. Hosting transactions (most recent)
  console.log('\n=== hostingTransactions ===')
  const ht = await db.collection('hostingTransactions').find({ chatId: CHAT_ID })
    .sort({ timestamp: -1 }).limit(10).toArray()
  for (const h of ht) console.log(JSON.stringify(h))

  // 6. addonDomains / addon-related collection if exists
  console.log('\n=== addonDomains / addonDomainsOf / domainAddonsOf (whichever exists) ===')
  const colls = await db.listCollections().toArray()
  const addons = colls.filter(c => /addon|cpanel/i.test(c.name)).map(c => c.name)
  console.log('Candidate collections:', addons)
  for (const name of addons) {
    try {
      const rows = await db.collection(name).find({
        $or: [{ chatId: CHAT_ID }, { _id: CHAT_ID }]
      }).limit(5).toArray()
      if (rows.length) {
        console.log(`-- ${name} (${rows.length}) --`)
        for (const r of rows) console.log(JSON.stringify(r))
      }
    } catch (e) { /* skip */ }
  }

  // 7. cpanel-job-queue current status for this user
  try {
    const jobs = await db.collection('cpanelJobs').find({ chatId: CHAT_ID })
      .sort({ createdAt: -1 }).limit(20).toArray()
    console.log('\n=== cpanelJobs ===')
    for (const j of jobs) console.log(JSON.stringify(j))
  } catch (e) { console.log('cpanelJobs scan err:', e.message) }

  // 8. Anything new in payments for this user (most recent 10)
  console.log('\n=== payments rows mentioning user ===')
  const pays = await db.collection('payments').find({ val: { $regex: CHAT_ID } })
    .sort({ _id: 1 }).limit(20).toArray()
  for (const p of pays) console.log(`${p._id}: ${p.val}`)

  await client.close()
})().catch(e => { console.error(e); process.exit(1) })
