require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const CF_BASE = 'https://api.cloudflare.com/client/v4'
const headers = {
  'X-Auth-Email': process.env.CLOUDFLARE_EMAIL,
  'X-Auth-Key': process.env.CLOUDFLARE_API_KEY,
}
;(async () => {
  const zoneId = '5313ddc5042a9e1b1dde373202ec1e05'
  const r = await axios.get(`${CF_BASE}/zones/${zoneId}/ssl/universal/settings`, { headers })
  console.log('SSL universal:', JSON.stringify(r.data, null, 2))
  const r2 = await axios.get(`${CF_BASE}/zones/${zoneId}/ssl/certificate_packs`, { headers })
  console.log('Cert packs:', JSON.stringify(r2.data?.result?.map(c => ({id: c.id, status: c.status, type: c.type, certs: c.certificates?.length})), null, 2))
})().catch(e => console.error(e.response?.data || e.message))
