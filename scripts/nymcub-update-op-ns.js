/**
 * Follow-up: nymcub.com is actually in our OpenProvider account. The bot's
 * external-domain flow auto-updates NS at OP when the domain is detected there
 * (cr-register-domain-&-create-cpanel.js:526 — postRegistrationNSUpdate).
 * Do that now so the site goes live without manual user action.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const domainService = require('../js/domain-service')
const opService = require('../js/op-service')

const DOMAIN = 'nymcub.com'

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL, { serverSelectionTimeoutMS: 20000 })
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  const reg = await db.collection('registeredDomains').findOne({ _id: DOMAIN })
  const cfNs = reg?.val?.nameservers || []
  console.log(`[NSUpdate] CF NS from DB: ${cfNs.join(', ')}`)
  if (cfNs.length < 2) { console.error('No CF NS in DB — aborting'); await client.close(); process.exit(1) }

  // Check current OP nameservers
  const opInfo = await opService.getDomainInfo(DOMAIN)
  console.log(`[NSUpdate] OP current state: id=${opInfo?.domainId} status=${opInfo?.status} NS=${opInfo?.nameservers?.join(', ')}`)

  if (!opInfo || !opInfo.domainId) {
    console.log('[NSUpdate] nymcub.com not in OP — nothing to update.')
    await client.close()
    return
  }

  // Already matching?
  const cur = new Set((opInfo.nameservers || []).map(n => n.toLowerCase()))
  const want = new Set(cfNs.map(n => n.toLowerCase()))
  const match = cur.size === want.size && [...want].every(n => cur.has(n))
  if (match) {
    console.log('[NSUpdate] OP NS already matches CF zone — no update needed.')
    await client.close()
    return
  }

  // Update NS at OP using the standard helper used by the bot
  const result = await domainService.postRegistrationNSUpdate(DOMAIN, 'OpenProvider', 'cloudflare', cfNs, null)
  console.log(`[NSUpdate] postRegistrationNSUpdate result: ${JSON.stringify(result)}`)

  // Verify
  const verify = await opService.getDomainInfo(DOMAIN)
  console.log(`[NSUpdate] OP after update: NS=${verify?.nameservers?.join(', ')}`)

  await client.close()
})().catch(e => { console.error(e); process.exit(1) })
