require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const CF_BASE = 'https://api.cloudflare.com/client/v4'
const headers = {
  'X-Auth-Email': process.env.CLOUDFLARE_EMAIL,
  'X-Auth-Key': process.env.CLOUDFLARE_API_KEY,
}
;(async () => {
  // Try to trigger an activation check
  const zoneId = '5313ddc5042a9e1b1dde373202ec1e05'
  try {
    const r = await axios.put(`${CF_BASE}/zones/${zoneId}/activation_check`, {}, { headers, timeout: 15000 })
    console.log('Activation check triggered:', JSON.stringify(r.data, null, 2))
  } catch (e) {
    console.log('Activation check err:', e.response?.status, JSON.stringify(e.response?.data || e.message, null, 2))
  }
  // Re-fetch zone state
  const r2 = await axios.get(`${CF_BASE}/zones/${zoneId}`, { headers, timeout: 15000 })
  const z = r2.data.result
  console.log('\nZone state:')
  console.log('  status:', z.status)
  console.log('  paused:', z.paused)
  console.log('  name_servers:', z.name_servers)
  console.log('  original_name_servers:', z.original_name_servers)
  console.log('  verification_key:', z.verification_key)
  console.log('  activated_on:', z.activated_on)
  console.log('  created_on:', z.created_on)
  console.log('  modified_on:', z.modified_on)
})().catch(e=>{console.error(e); process.exit(1)})
