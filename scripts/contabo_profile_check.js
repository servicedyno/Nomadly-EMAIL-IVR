#!/usr/bin/env node
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const crypto = require('crypto')

const CLIENT_ID = process.env.CONTABO_CLIENT_ID
const CLIENT_SECRET = process.env.CONTABO_CLIENT_SECRET
const API_USER = process.env.CONTABO_API_USER
const API_PASSWORD = process.env.CONTABO_API_PASSWORD

async function getToken() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    username: API_USER, password: API_PASSWORD, grant_type: 'password',
  })
  const r = await axios.post('https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 })
  return r.data.access_token
}

;(async () => {
  const t = await getToken()
  const headers = { Authorization: `Bearer ${t}`, 'x-request-id': crypto.randomUUID() }

  // Full user profile
  console.log('=== Full user profile ===')
  const u = await axios.get('https://api.contabo.com/v1/users', { headers, timeout: 15000, validateStatus: () => true })
  console.log(JSON.stringify(u.data, null, 2))

  // Status page
  console.log('\n=== Contabo status page ===')
  for (const url of [
    'https://status.contabo.com/api/v2/summary.json',
    'https://contabo.statuspage.io/api/v2/summary.json',
    'https://www.contabostatus.com/api/v2/summary.json',
  ]) {
    try {
      const r = await axios.get(url, { timeout: 10000, validateStatus: () => true })
      if (r.status === 200) {
        const inc = r.data.incidents || []
        const cmp = (r.data.components || []).filter(c => c.status !== 'operational')
        console.log(`  ${url} -> HTTP ${r.status}`)
        console.log(`    incidents: ${inc.length}`)
        inc.forEach(i => console.log(`      [${i.impact}] ${i.name} - ${i.status}`))
        console.log(`    degraded components: ${cmp.length}`)
        cmp.forEach(c => console.log(`      ${c.name} -> ${c.status}`))
        break
      }
    } catch (e) {
      console.log(`  ${url} -> error ${e.message}`)
    }
  }
})().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
