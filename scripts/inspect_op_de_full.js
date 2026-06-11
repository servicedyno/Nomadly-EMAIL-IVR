require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const { authHeaders, OP_BASE_URL } = (() => {
  const m = require('/app/js/op-service.js')
  return m._exposed || { authHeaders: m.authHeaders, OP_BASE_URL: 'https://api.openprovider.eu' }
})()

const DOMAIN = 'rsvpeviteopen.de'

;(async () => {
  // Auth from scratch using env
  const username = process.env.OPENPROVIDER_USERNAME
  const password = process.env.OPENPROVIDER_PASSWORD
  if (!username || !password) {
    console.error('OP_USERNAME / OP_PASSWORD missing')
    process.exit(1)
  }
  const authResp = await axios.post('https://api.openprovider.eu/v1beta/auth/login', { username, password })
  const token = authResp.data?.data?.token
  if (!token) throw new Error('Auth failed')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Search domain
  const sr = await axios.get('https://api.openprovider.eu/v1beta/domains', { headers, params: { domain_name_pattern: 'rsvpeviteopen', extension: 'de', limit: 5 } })
  console.log('Search result:', JSON.stringify(sr.data?.data?.results?.[0], null, 2))

  const domainId = sr.data?.data?.results?.[0]?.id
  console.log('\nFull domain detail:')
  const r = await axios.get(`https://api.openprovider.eu/v1beta/domains/${domainId}`, { headers })
  console.log(JSON.stringify(r.data?.data, null, 2))
})().catch(e => { console.error('ERR:', e.response?.status, JSON.stringify(e.response?.data || e.message)); process.exit(1) })
