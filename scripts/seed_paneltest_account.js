// Seeds ONE throwaway panel test account for verifying the new domain-mode /
// set-primary endpoints. DB-only (no real cPanel account). Cleaned up after.
require('/app/node_modules/dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('/app/node_modules/mongodb')
const cpAuth = require('/app/js/cpanel-auth')

const ID = 'pnldoctest'
;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const col = client.db(process.env.DB_NAME || 'test').collection('cpanelAccounts')

  const enc = cpAuth.encrypt('dummy-not-a-real-pass')
  const pinHash = await cpAuth.hashPin('123456')
  const doc = {
    _id: ID,
    cpUser: ID,
    cpPass_encrypted: enc.encrypted,
    cpPass_iv: enc.iv,
    cpPass_tag: enc.tag,
    pinHash,
    chatId: '5590563715',
    email: 'paneltest@example.com',
    domain: 'primary-doctest.example',
    addonDomains: ['addon-doctest.example'],
    docrootModes: { 'addon-doctest.example': 'own' },
    plan: 'Golden Anti-Red HostPanel (1-month)',
    whmHost: process.env.WHM_HOST || null,
    deleted: false,
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    lastLogin: null,
    __seedTestAccount: true,
  }
  await col.updateOne({ _id: ID }, { $set: doc }, { upsert: true })
  const back = await col.findOne({ _id: ID })
  console.log('SEEDED test account:', JSON.stringify({
    _id: back._id, domain: back.domain, addonDomains: back.addonDomains,
    docrootModes: back.docrootModes, plan: back.plan,
  }))
  await client.close()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
