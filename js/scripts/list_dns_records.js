/* global process */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })
const cfService = require('../cf-service')

const DOMAIN = 'inviolivepaperless.com'
const ZONE_ID = 'b8e6e104abb00850956b5c7c210591b9'

;(async () => {
  console.log('=== DNS records on CF zone for', DOMAIN, '===')
  const records = await cfService.listDNSRecords ? await cfService.listDNSRecords(ZONE_ID) : null
  console.log(JSON.stringify(records, null, 2))

  // Try direct fetch
  const axios = require('axios')
  const CF_BASE_URL = 'https://api.cloudflare.com/client/v4'
  const headers = {
    'X-Auth-Email': process.env.CLOUDFLARE_EMAIL,
    'X-Auth-Key': process.env.CLOUDFLARE_API_KEY,
    'Content-Type': 'application/json',
  }
  try {
    const r = await axios.get(`${CF_BASE_URL}/zones/${ZONE_ID}/dns_records`, { headers, timeout: 15000 })
    console.log('\n=== Direct CF API list ===')
    console.log(`count=${r.data.result?.length || 0}`)
    for (const rec of r.data.result || []) {
      console.log(`  ${rec.type}  ${rec.name}  →  ${rec.content}  proxied=${rec.proxied}`)
    }
  } catch (e) {
    console.log('CF list err:', e?.response?.data || e.message)
  }
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
