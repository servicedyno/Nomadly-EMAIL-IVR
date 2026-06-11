require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const CF_BASE = 'https://api.cloudflare.com/client/v4'
const headers = {
  'X-Auth-Email': process.env.CLOUDFLARE_EMAIL,
  'X-Auth-Key': process.env.CLOUDFLARE_API_KEY,
}
;(async () => {
  const zoneId = '5313ddc5042a9e1b1dde373202ec1e05'
  try {
    const r = await axios.put(`${CF_BASE}/zones/${zoneId}/activation_check`, {}, { headers, timeout: 15000 })
    console.log('Activation check:', JSON.stringify(r.data, null, 2))
  } catch (e) {
    console.log('Activation err:', e.response?.status, JSON.stringify(e.response?.data))
  }
})().catch(e=>{console.error(e); process.exit(1)})
