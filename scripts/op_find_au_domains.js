/**
 * Look for any existing .au/.com.au domain already registered in our
 * OpenProvider account. If found, fetch its additional_data — that is
 * the source of truth for the field names OP actually accepts.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const OP = 'https://api.openprovider.eu'

async function token() {
  const r = await axios.post(`${OP}/v1beta/auth/login`, {
    username: process.env.OPENPROVIDER_USERNAME,
    password: process.env.OPENPROVIDER_PASSWORD,
  }, { timeout: 15000 })
  if (r.data?.code !== 0) throw new Error('OP auth failed: ' + JSON.stringify(r.data))
  return r.data.data.token
}

;(async () => {
  const t = await token()
  const headers = { Authorization: `Bearer ${t}` }

  for (const ext of ['au', 'com.au', 'net.au', 'org.au', 'id.au']) {
    try {
      const r = await axios.get(`${OP}/v1beta/domains`, {
        headers, timeout: 15000,
        params: { extension: ext, limit: 5, with_additional_data: true },
      })
      const results = r.data?.data?.results || []
      console.log(`\n.${ext} → ${results.length} domain(s) in OP account`)
      for (const d of results) {
        console.log(`  - ${d.domain?.name}.${d.domain?.extension}  status=${d.status}  id=${d.id}`)
        if (d.additional_data) {
          const trimmed = Object.fromEntries(
            Object.entries(d.additional_data).filter(([_, v]) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && !v.length))
          )
          console.log('    additional_data (non-empty fields):')
          console.log('    ' + JSON.stringify(trimmed, null, 4).replace(/\n/g, '\n    '))
        }
      }
    } catch (e) {
      console.log(`.${ext} → ERROR ${e.response?.status} ${JSON.stringify(e.response?.data || e.message).substring(0, 200)}`)
    }
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
