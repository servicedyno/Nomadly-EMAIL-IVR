/**
 * Diagnose why Cloudflare zone for rsvpeviteopen.org returns 400 "Authentication failed"
 * but works fine for rsvpeviteopen.de
 *
 * Usage: node /app/scripts/diagnose_rsvpeviteopen.js
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const { MongoClient } = require('mongodb')

const CF_BASE_URL = 'https://api.cloudflare.com/client/v4'
const CF_EMAIL = process.env.CLOUDFLARE_EMAIL
const CF_API_KEY = process.env.CLOUDFLARE_API_KEY
const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'test'

const cfHeaders = () => ({
  'X-Auth-Email': CF_EMAIL,
  'X-Auth-Key': CF_API_KEY,
  'Content-Type': 'application/json',
})

;(async () => {
  console.log('\n=== CF Auth env ===')
  console.log('CF_EMAIL:', CF_EMAIL)
  console.log('CF_API_KEY length:', CF_API_KEY?.length, 'prefix:', CF_API_KEY?.slice(0, 6))

  console.log('\n=== Step 1: Test CF auth with /user endpoint ===')
  try {
    const res = await axios.get(`${CF_BASE_URL}/user`, { headers: cfHeaders(), timeout: 10000 })
    console.log('CF /user success:', res.data?.success, 'email:', res.data?.result?.email)
  } catch (err) {
    console.log('CF /user FAILED:', err.response?.status, JSON.stringify(err.response?.data))
  }

  console.log('\n=== Step 2: Look up both domains by name ===')
  for (const domain of ['rsvpeviteopen.org', 'rsvpeviteopen.de']) {
    try {
      const res = await axios.get(`${CF_BASE_URL}/zones`, {
        headers: cfHeaders(), params: { name: domain }, timeout: 10000,
      })
      const z = res.data?.result?.[0]
      if (z) {
        console.log(`${domain}: zoneId=${z.id} status=${z.status} ns=${(z.name_servers || []).join(', ')}`)
        console.log(`  account=${z.account?.id} (${z.account?.name})`)
        console.log(`  owner=${z.owner?.email} (${z.owner?.id})`)
      } else {
        console.log(`${domain}: NOT FOUND in this CF account`)
      }
    } catch (err) {
      console.log(`${domain}: lookup FAILED:`, err.response?.status, JSON.stringify(err.response?.data))
    }
  }

  console.log('\n=== Step 3: Test the specific failing zone id 2047e30143fb8c792301fcd4a5d340b6 ===')
  const failingZoneId = '2047e30143fb8c792301fcd4a5d340b6'
  try {
    const res = await axios.get(`${CF_BASE_URL}/zones/${failingZoneId}`, {
      headers: cfHeaders(), timeout: 10000,
    })
    console.log('Zone fetch OK:', res.data?.success, res.data?.result?.name)
  } catch (err) {
    console.log('Zone fetch FAILED:', err.response?.status, JSON.stringify(err.response?.data))
  }

  console.log('\n=== Step 4: List all zones in account (first 5) ===')
  try {
    const res = await axios.get(`${CF_BASE_URL}/zones`, {
      headers: cfHeaders(), params: { per_page: 5 }, timeout: 10000,
    })
    console.log('Zones:', res.data?.result?.map(z => `${z.name} (${z.id.slice(0,8)})`).join(', '))
    console.log('Total in account:', res.data?.result_info?.total_count)
  } catch (err) {
    console.log('List zones FAILED:', err.response?.status, JSON.stringify(err.response?.data))
  }

  console.log('\n=== Step 5: Query MongoDB for registeredDomains records ===')
  const client = new MongoClient(MONGO_URL)
  try {
    await client.connect()
    const db = client.db(DB_NAME)
    for (const domain of ['rsvpeviteopen.org', 'rsvpeviteopen.de']) {
      const rd = await db.collection('registeredDomains').findOne({ domainName: domain })
      console.log(`\nregisteredDomains[${domain}]:`)
      if (rd) {
        console.log(JSON.stringify({
          domainName: rd.domainName,
          chatId: rd.chatId,
          registrar: rd.val?.registrar || rd.registrar,
          cfZoneId: rd.val?.cfZoneId || rd.cfZoneId,
          nameservers: rd.val?.nameservers || rd.nameservers,
          nameserverType: rd.val?.nameserverType || rd.nameserverType,
          status: rd.val?.status || rd.status,
          createdAt: rd.createdAt,
          opDomainId: rd.val?.opDomainId,
        }, null, 2))
      } else {
        console.log('NOT FOUND')
      }

      const dof = await db.collection('domainsOf').findOne({ domainName: domain })
      console.log(`domainsOf[${domain}]:`)
      if (dof) {
        console.log(JSON.stringify({
          domainName: dof.domainName,
          chatId: dof.chatId,
          registrar: dof.val?.registrar,
          cfZoneId: dof.val?.cfZoneId,
          isExpired: dof.val?.isExpired,
          autoRenewable: dof.val?.autoRenewable,
        }, null, 2))
      } else {
        console.log('NOT FOUND')
      }
    }

    console.log('\n=== Step 6: Find user @HHR2009 state ===')
    // Look in dataOfUsers and any matching user collection
    const users = await db.collection('dataOfUsers').find({
      $or: [{ username: 'HHR2009' }, { username: '@HHR2009' }, { telegramUsername: 'HHR2009' }, { telegramUsername: '@HHR2009' }],
    }).toArray()
    console.log(`dataOfUsers matches (${users.length}):`, users.map(u => ({ chatId: u.chatId, username: u.username, telegramUsername: u.telegramUsername })))
  } finally {
    await client.close()
  }

  console.log('\n=== Done ===')
})().catch(e => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
