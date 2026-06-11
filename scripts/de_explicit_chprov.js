require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const DOMAIN_ID = 29663624

;(async () => {
  const authResp = await axios.post('https://api.openprovider.eu/v1beta/auth/login', {
    username: process.env.OPENPROVIDER_USERNAME,
    password: process.env.OPENPROVIDER_PASSWORD,
  })
  const token = authResp.data?.data?.token
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Try /sync-with-registry endpoint  
  console.log('--- Try /sync-with-registry ---')
  try {
    const r = await axios.post(`https://api.openprovider.eu/v1beta/domains/${DOMAIN_ID}/sync-with-registry`, {}, { headers, timeout: 30000 })
    console.log(JSON.stringify(r.data, null, 2))
  } catch (e) {
    console.log('Err:', e.response?.status, JSON.stringify(e.response?.data || e.message).substring(0,200))
  }

  // Try sending an explicit `name_server_status_check` request
  console.log('\n--- Try /resync-ns ---')
  try {
    const r = await axios.post(`https://api.openprovider.eu/v1beta/domains/${DOMAIN_ID}/resync-ns`, {}, { headers, timeout: 30000 })
    console.log(JSON.stringify(r.data, null, 2))
  } catch (e) {
    console.log('Err:', e.response?.status, JSON.stringify(e.response?.data || e.message).substring(0,200))
  }
  
  // Check zone API
  console.log('\n--- /v1beta/dns/zones/rsvpeviteopen.de ---')
  try {
    const r = await axios.get(`https://api.openprovider.eu/v1beta/dns/zones/rsvpeviteopen.de`, { headers, timeout: 15000 })
    console.log(JSON.stringify(r.data, null, 2).substring(0,800))
  } catch (e) {
    console.log('Err:', e.response?.status, JSON.stringify(e.response?.data || e.message).substring(0,200))
  }

  // Inspect domain.de.additional_data
  console.log('\n--- Get domain with additional data ---')
  try {
    const r = await axios.get(`https://api.openprovider.eu/v1beta/domains/${DOMAIN_ID}`, { headers, params: { with_additional_data: true }, timeout: 15000 })
    const d = r.data?.data
    console.log('additional_data:', JSON.stringify(d?.additional_data, null, 2))
    console.log('nsgroup_id:', d?.nsgroup_id)
    console.log('ns_template_id:', d?.ns_template_id)
    console.log('is_dnssec_enabled:', d?.is_dnssec_enabled)
    console.log('is_sectigo_dns_enabled:', d?.is_sectigo_dns_enabled)
  } catch (e) {
    console.log('Err:', e.response?.status)
  }
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
