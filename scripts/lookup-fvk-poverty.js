/**
 * Look up production user @fvk_poverty and check wallet balance.
 * Read-only, no mutations.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

;(async () => {
  const url = process.env.MONGO_URL
  if (!url) { console.error('No MONGO_URL'); process.exit(1) }
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 20000 })
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  // Search nameOf for fvk_poverty (case-insensitive)
  const matches = await db.collection('nameOf').find({
    val: { $regex: '^fvk_poverty$', $options: 'i' }
  }).toArray()
  console.log('nameOf matches:', JSON.stringify(matches, null, 2))

  if (matches.length === 0) {
    // Also try partial
    const partial = await db.collection('nameOf').find({
      val: { $regex: 'fvk', $options: 'i' }
    }).limit(20).toArray()
    console.log('partial fvk matches:', JSON.stringify(partial, null, 2))
  }

  for (const m of matches) {
    const chatId = m._id
    const wallet = await db.collection('walletOf').findOne({ _id: chatId })
    console.log(`\nWallet for ${m.val} (${chatId}):`, JSON.stringify(wallet, null, 2))
    const lang = await db.collection('languageOf').findOne({ _id: chatId })
    console.log(`Language:`, lang)
    const cpAccts = await db.collection('cpanelAccounts').find({ chatId: String(chatId) }).toArray()
    console.log(`Existing cpanel accounts (${cpAccts.length}):`, cpAccts.map(a => ({
      cpUser: a.cpUser, domain: a.domain, plan: a.plan, expiry: a.expiryDate, deleted: a.deleted
    })))
    const domainsOf = await db.collection('domainsOf').findOne({ _id: chatId })
    console.log(`domainsOf keys:`, domainsOf ? Object.keys(domainsOf).filter(k => k !== '_id') : 'none')
  }

  // Check if domain nymcub.com exists in registeredDomains
  const reg = await db.collection('registeredDomains').findOne({ _id: 'nymcub.com' })
  console.log('\nregisteredDomains nymcub.com:', JSON.stringify(reg, null, 2))
  const cpExists = await db.collection('cpanelAccounts').findOne({ domain: 'nymcub.com', deleted: { $ne: true } })
  console.log('Existing cpanelAccount for nymcub.com:', cpExists ? cpExists.cpUser : 'none')

  await client.close()
})().catch(e => { console.error(e); process.exit(1) })
