require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const DOMAIN = 'rsvpeviteopen.de'
const DOMAIN_ID = 29663624

;(async () => {
  // Auth
  const authResp = await axios.post('https://api.openprovider.eu/v1beta/auth/login', {
    username: process.env.OPENPROVIDER_USERNAME,
    password: process.env.OPENPROVIDER_PASSWORD,
  })
  const token = authResp.data?.data?.token
  if (!token) throw new Error('Auth failed')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // First try empty NS to clear, then set back. .de may need a clear-and-set.
  // Actually, let's try setting `ns_group` to default registry and force chprov.
  // Try with `is_use_default_ns` etc.
  
  // Approach 1: Send name_servers with autorenew flag (full record update)
  console.log('Attempt 1: Full PUT with name_servers reset')
  try {
    const r = await axios.put(`https://api.openprovider.eu/v1beta/domains/${DOMAIN_ID}`, {
      name_servers: [
        { name: 'anderson.ns.cloudflare.com', seq_nr: 0 },
        { name: 'leanna.ns.cloudflare.com', seq_nr: 1 },
      ],
      ns_group: '',
    }, { headers, timeout: 30000 })
    console.log('  Result:', JSON.stringify(r.data, null, 2))
  } catch (e) {
    console.log('  Error:', e.response?.status, JSON.stringify(e.response?.data || e.message))
  }

  // Approach 2: Trigger explicit registry sync via OP's special endpoint
  // OP has /v1beta/domains/{id}/sync but it's not always documented
  console.log('\nAttempt 2: Check for explicit sync endpoint')
  try {
    const r = await axios.post(`https://api.openprovider.eu/v1beta/domains/${DOMAIN_ID}/sync`, {}, { headers, timeout: 30000 })
    console.log('  Result:', JSON.stringify(r.data, null, 2))
  } catch (e) {
    console.log('  Error:', e.response?.status, JSON.stringify(e.response?.data || e.message).substring(0, 300))
  }
  
  // Approach 3: Verify domain status from OP with all details
  console.log('\nAttempt 3: Get full domain detail with all metadata')
  try {
    const r = await axios.get(`https://api.openprovider.eu/v1beta/domains/${DOMAIN_ID}`, { headers, params: { with_history: true } })
    const d = r.data?.data
    console.log('  last_changed:', d?.last_changed)
    console.log('  status:', d?.status)
    console.log('  comments:', d?.comments)
    console.log('  has_history:', d?.has_history)
    // Check history
    const h = await axios.get(`https://api.openprovider.eu/v1beta/domains/${DOMAIN_ID}/history`, { headers }).catch(()=>null)
    if (h?.data) console.log('  History (last 5):', JSON.stringify(h.data?.data?.results?.slice(0,5), null, 2))
  } catch (e) {
    console.log('  Error:', e.response?.status, JSON.stringify(e.response?.data || e.message).substring(0,300))
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
