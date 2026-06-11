require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const CF_BASE = 'https://api.cloudflare.com/client/v4'
const headers = {
  'X-Auth-Email': process.env.CLOUDFLARE_EMAIL,
  'X-Auth-Key': process.env.CLOUDFLARE_API_KEY,
}
const zoneId = '5313ddc5042a9e1b1dde373202ec1e05'
;(async () => {
  // 1. Disable + Re-enable Universal SSL to force re-provision
  try {
    console.log('Step 1: PATCH /ssl/universal/settings to disable+enable')
    await axios.patch(`${CF_BASE}/zones/${zoneId}/ssl/universal/settings`, { enabled: false }, { headers })
    await new Promise(r => setTimeout(r, 2000))
    const r2 = await axios.patch(`${CF_BASE}/zones/${zoneId}/ssl/universal/settings`, { enabled: true }, { headers })
    console.log('  re-enabled:', JSON.stringify(r2.data?.result, null, 2))
  } catch (e) {
    console.log('  err:', e.response?.data || e.message)
  }
  // 2. List cert packs after
  await new Promise(r => setTimeout(r, 5000))
  const r3 = await axios.get(`${CF_BASE}/zones/${zoneId}/ssl/certificate_packs?status=all`, { headers })
  console.log('\nCert packs (all status):')
  for (const cp of r3.data?.result || []) {
    console.log(`  - id=${cp.id} type=${cp.type} status=${cp.status} certs=${cp.certificates?.length || 0}`)
  }
})().catch(e=>console.error(e.response?.data || e.message))
