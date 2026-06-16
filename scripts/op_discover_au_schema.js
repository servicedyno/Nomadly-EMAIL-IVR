/**
 * READ-ONLY diagnostic. Calls OpenProvider's discovery endpoint to find out
 * the exact additional_data schema OP expects for .com.au, .au, .net.au, .id.au.
 * Never performs a registration. Never touches money or domains.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const OP_BASE = 'https://api.openprovider.eu'

async function token() {
  const r = await axios.post(`${OP_BASE}/v1beta/auth/login`, {
    username: process.env.OPENPROVIDER_USERNAME,
    password: process.env.OPENPROVIDER_PASSWORD,
  }, { timeout: 15000 })
  if (r.data?.code !== 0) throw new Error('OP auth failed: ' + JSON.stringify(r.data))
  return r.data.data.token
}

;(async () => {
  const t = await token()
  const headers = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }

  // Endpoint candidates — try a few; OP docs are inconsistent. Read-only GETs only.
  const tlds = ['au', 'com.au', 'net.au', 'id.au']
  for (const ext of tlds) {
    console.log('\n────────────────────────────────────────')
    console.log(`TLD: .${ext}`)
    console.log('────────────────────────────────────────')

    // Path 1 — extensions/{ext}/additional-data (most reliable)
    try {
      const r = await axios.get(`${OP_BASE}/v1beta/extensions/${encodeURIComponent(ext)}/additional-data`, { headers, timeout: 15000 })
      console.log(`GET /v1beta/extensions/${ext}/additional-data → code=${r.data?.code}`)
      console.log(JSON.stringify(r.data?.data, null, 2).substring(0, 3500))
      continue
    } catch (e) {
      console.log(`  /extensions/${ext}/additional-data failed: HTTP ${e.response?.status} ${e.response?.data?.desc || e.message}`)
    }

    // Path 2 — extensions filter
    try {
      const r = await axios.get(`${OP_BASE}/v1beta/extensions`, { headers, timeout: 15000, params: { 'filters[names]': ext, 'with_additional_data': true } })
      console.log(`GET /v1beta/extensions?filters[names]=${ext} → code=${r.data?.code}`)
      const item = (r.data?.data?.results || [])[0]
      if (item) console.log(JSON.stringify(item, null, 2).substring(0, 3500))
      else      console.log('  (no results)')
    } catch (e) {
      console.log(`  /extensions?filters failed: HTTP ${e.response?.status} ${e.response?.data?.desc || e.message}`)
    }
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
