/**
 * Deep diagnosis: full DB records + Cloudflare state for rsvpeviteopen.org/.de
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const { MongoClient } = require('mongodb')

const CF_BASE_URL = 'https://api.cloudflare.com/client/v4'
const cfHeaders = () => ({
  'X-Auth-Email': process.env.CLOUDFLARE_EMAIL,
  'X-Auth-Key': process.env.CLOUDFLARE_API_KEY,
  'Content-Type': 'application/json',
})

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  console.log('\n=== Full domainsOf records ===')
  for (const domain of ['rsvpeviteopen.org', 'rsvpeviteopen.de']) {
    const dof = await db.collection('domainsOf').findOne({ domainName: domain })
    console.log(`\n${domain}:`)
    console.log(JSON.stringify(dof, null, 2))
  }

  console.log('\n=== Search registeredDomains by all fields ===')
  for (const domain of ['rsvpeviteopen.org', 'rsvpeviteopen.de']) {
    const variants = [
      { domainName: domain },
      { domain: domain },
      { name: domain },
      { 'val.domainName': domain },
      { _id: domain },
    ]
    for (const q of variants) {
      const rd = await db.collection('registeredDomains').findOne(q)
      if (rd) {
        console.log(`\nregisteredDomains matched on ${JSON.stringify(q)}:`)
        console.log(JSON.stringify(rd, null, 2))
        break
      }
    }
  }

  console.log('\n=== User chatId 1960615421 ===')
  const user = await db.collection('dataOfUsers').findOne({ chatId: '1960615421' })
  console.log(JSON.stringify({
    chatId: user?.chatId,
    username: user?.username,
    telegramUsername: user?.telegramUsername,
    firstName: user?.firstName,
    lastName: user?.lastName,
    lang: user?.lang,
  }, null, 2))

  console.log('\n=== All domains owned by chatId 1960615421 ===')
  const userDomains = await db.collection('domainsOf').find({ chatId: '1960615421' }).toArray()
  console.log(JSON.stringify(userDomains, null, 2))

  console.log('\n=== Search ALL registeredDomains for chatId 1960615421 ===')
  const userRegDomains = await db.collection('registeredDomains').find({ chatId: '1960615421' }).limit(20).toArray()
  console.log(`Count: ${userRegDomains.length}`)
  userRegDomains.forEach(d => console.log(`  - ${d.domainName || d.name || d._id} | reg=${d.val?.registrar} | cfZoneId=${d.val?.cfZoneId} | ns=${d.val?.nameserverType}`))

  console.log('\n=== Show schema of one full registeredDomains record ===')
  const sample = await db.collection('registeredDomains').findOne({})
  console.log('Sample record keys:', Object.keys(sample || {}))
  console.log('Sample val keys:', Object.keys(sample?.val || {}))

  console.log('\n=== CF DNS records for both zones ===')
  for (const [domain, zoneId] of [
    ['rsvpeviteopen.org', '2047e30143fb8c792301fcd4a5d340b6'],
    ['rsvpeviteopen.de', '5313ddc5042a9e1b1dde373202ec1e05'],
  ]) {
    try {
      const res = await axios.get(`${CF_BASE_URL}/zones/${zoneId}/dns_records`, {
        headers: cfHeaders(), timeout: 10000,
      })
      console.log(`\n${domain} DNS records (${res.data?.result?.length || 0}):`)
      for (const r of (res.data?.result || [])) {
        console.log(`  ${r.type}\t${r.name}\t→ ${r.content}${r.proxied ? ' [proxied]' : ''}`)
      }
    } catch (e) {
      console.log(`${domain} dns_records FAILED:`, e.response?.status, JSON.stringify(e.response?.data))
    }

    try {
      const res = await axios.get(`${CF_BASE_URL}/zones/${zoneId}`, {
        headers: cfHeaders(), timeout: 10000,
      })
      const z = res.data?.result
      console.log(`\n${domain} zone full state:`)
      console.log(`  status: ${z?.status}`)
      console.log(`  paused: ${z?.paused}`)
      console.log(`  original NS: ${(z?.original_name_servers || []).join(', ')}`)
      console.log(`  CF NS: ${(z?.name_servers || []).join(', ')}`)
      console.log(`  activated_on: ${z?.activated_on}`)
      console.log(`  created_on: ${z?.created_on}`)
      console.log(`  modified_on: ${z?.modified_on}`)
    } catch (e) {
      console.log(`${domain} zone FAILED:`, e.response?.status, JSON.stringify(e.response?.data))
    }
  }

  console.log('\n=== Look up domain at OpenProvider/ConnectReseller (where is it registered?) ===')
  // Check registrar via state cache
  const cache = await db.collection('registrarLookupCache').findOne({ domainName: 'rsvpeviteopen.org' }).catch(() => null)
  console.log('registrarLookupCache (.org):', JSON.stringify(cache))
  const cache2 = await db.collection('registrarLookupCache').findOne({ domainName: 'rsvpeviteopen.de' }).catch(() => null)
  console.log('registrarLookupCache (.de):', JSON.stringify(cache2))

  await client.close()
})().catch(e => { console.error(e); process.exit(1) })
