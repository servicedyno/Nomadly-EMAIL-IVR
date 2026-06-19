// Seeds storefront Phase-2 test fixtures. DB-only; cleaned by cleanup_storetest.js (extended).
require('/app/node_modules/dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('/app/node_modules/mongodb')
const bcrypt = require('/app/node_modules/bcryptjs')
const cpAuth = require('/app/js/cpanel-auth')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const hash = await bcrypt.hash('password1234', 10)

  // Funded buyer
  await db.collection('webUsers').updateOne({ _id: 'webuser-storebuyer-fixed' }, { $set: {
    _id: 'webuser-storebuyer-fixed', email: 'storebuyer@example.com', passwordHash: hash,
    walletUsd: 200, createdAt: new Date(), lastLogin: null, __seedTest: true,
  } }, { upsert: true })

  // Broke user (for 402 test)
  await db.collection('webUsers').updateOne({ _id: 'webuser-storebroke-fixed' }, { $set: {
    _id: 'webuser-storebroke-fixed', email: 'storebroke@example.com', passwordHash: hash,
    walletUsd: 0, createdAt: new Date(), lastLogin: null, __seedTest: true,
  } }, { upsert: true })

  // A cPanel account linked to the buyer (so My Plans + Open Panel work)
  const enc = cpAuth.encrypt('dummy-not-real')
  const pinHash = await cpAuth.hashPin('123456')
  await db.collection('cpanelAccounts').updateOne({ _id: 'webtest01' }, { $set: {
    _id: 'webtest01', cpUser: 'webtest01', cpPass_encrypted: enc.encrypted, cpPass_iv: enc.iv, cpPass_tag: enc.tag,
    pinHash, chatId: 'webuser-storebuyer-fixed', webUserId: 'webuser-storebuyer-fixed', source: 'web',
    ownerEmail: 'storebuyer@example.com', email: 'storebuyer@example.com',
    domain: 'weblinked-test.example', plan: 'Golden Anti-Red HostPanel (1-Month)',
    whmHost: process.env.WHM_HOST || null, addonDomains: [], deleted: false,
    expiryDate: new Date(Date.now() + 30 * 864e5), createdAt: new Date(), __seedTest: true,
  } }, { upsert: true })

  console.log('SEEDED: storebuyer@example.com ($200) + storebroke@example.com ($0) + cpanelAccount webtest01 (domain weblinked-test.example)')
  await client.close()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
