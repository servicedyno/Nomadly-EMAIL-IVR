/**
 * READ-ONLY. Calls OpenProvider's GET /v1beta/domains/additional-data
 * (the documented discovery endpoint) for several .au extensions
 * with operation=create. Returns the exact list of required field names
 * and their accepted values. No purchase, no money.
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
  const headers = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }

  for (const ext of ['au', 'com.au', 'net.au', 'id.au']) {
    console.log('\n────────────────────────────────────────')
    console.log(`Extension: .${ext}  (operation=create)`)
    console.log('────────────────────────────────────────')
    try {
      const r = await axios.get(`${OP}/v1beta/domains/additional-data`, {
        headers, timeout: 15000,
        params: { 'domain.extension': ext, operation: 'create' },
      })
      const list = r.data?.data || []
      console.log(`code=${r.data?.code}  desc=${r.data?.desc}  fields=${list.length}`)
      for (const f of list) {
        const opts = (f.options || []).slice(0, 8).map(o => `${o.value}=${o.description}`).join(' | ')
        console.log(`  - ${f.name}  required=${f.required}  type=${f.type}  desc=${(f.description || '').substring(0, 90)}`)
        if (opts) console.log(`      options: ${opts}`)
      }
    } catch (e) {
      console.log('ERROR:', e.response?.status, e.response?.data || e.message)
    }
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
