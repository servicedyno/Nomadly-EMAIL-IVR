/* Seed test accounts for Visitor Captcha (Gold-only) backend tests.
 * MUST be run with /app/backend/.env sourced into the env so SESSION_SECRET
 * matches the running service's encryption key.
 *   set -a; source /app/backend/.env; set +a; node /app/tests/seed_captcha_accounts.js
 */
const { MongoClient } = require('mongodb')
const cpAuth = require('/app/js/cpanel-auth')

async function main() {
  const url = process.env.MONGO_URL || 'mongodb://localhost:27017'
  const dbName = process.env.DB_NAME || 'test'
  const client = new MongoClient(url)
  await client.connect()
  const db = client.db(dbName)
  const accounts = db.collection('cpanelAccounts')
  const regDomains = db.collection('registeredDomains')

  const pinHash = await cpAuth.hashPin('123456')
  const enc = cpAuth.encrypt('dummypass')
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const goldDoc = {
    _id: 'goldtest',
    cpUser: 'goldtest',
    cpPass_encrypted: enc.encrypted,
    cpPass_iv: enc.iv,
    cpPass_tag: enc.tag,
    pinHash,
    chatId: '9999999',
    email: 'gold@test.com',
    domain: 'goldtest.com',
    addonDomains: [{ domain: 'goldaddon.com' }],
    plan: 'Golden Anti-Red HostPanel (30 Days)',
    // null → the panel falls back to the environment's WHM_HOST. Setting a
    // bogus literal here would trigger ENOTFOUND admin alerts on every
    // proxy call by this account.
    whmHost: process.env.WHM_HOST || null,
    expiryDate: expiry,
    createdAt: now,
  }

  const premDoc = {
    _id: 'premtest',
    cpUser: 'premtest',
    cpPass_encrypted: enc.encrypted,
    cpPass_iv: enc.iv,
    cpPass_tag: enc.tag,
    pinHash,
    chatId: '8888888',
    email: 'prem@test.com',
    domain: 'premtest.com',
    addonDomains: [],
    plan: 'Premium Anti-Red HostPanel (30 Days)',
    whmHost: process.env.WHM_HOST || null,
    expiryDate: expiry,
    createdAt: now,
  }

  // Replace fully so tests are deterministic
  await accounts.deleteMany({ _id: { $in: ['goldtest', 'premtest'] } })
  await accounts.insertMany([goldDoc, premDoc])

  await regDomains.deleteMany({ _id: { $in: ['goldtest.com', 'goldaddon.com', 'premtest.com'] } })
  await regDomains.insertMany([
    { _id: 'goldtest.com', val: { cfZoneId: 'test-zone-main', nameserverType: 'cloudflare' } },
    { _id: 'goldaddon.com', val: { cfZoneId: 'test-zone-addon', nameserverType: 'cloudflare' } },
    { _id: 'premtest.com', val: { cfZoneId: 'test-zone-prem', nameserverType: 'cloudflare' } },
  ])

  console.log('SEED_OK')
  await client.close()
}

main().catch(e => { console.error('SEED_ERR', e.message); process.exit(1) })
