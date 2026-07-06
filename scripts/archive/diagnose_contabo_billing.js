/**
 * Diagnose Contabo billing — list every instance in the Nomadly account,
 * count by status, and (if available) check the prepaid balance.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const { randomUUID } = require('crypto')

const CB_TOKEN_URL = 'https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token'
const CB_API = 'https://api.contabo.com/v1'

async function tok() {
  const body = new URLSearchParams({
    client_id: process.env.CONTABO_CLIENT_ID,
    client_secret: process.env.CONTABO_CLIENT_SECRET,
    username: process.env.CONTABO_API_USER,
    password: process.env.CONTABO_API_PASSWORD,
    grant_type: 'password',
  })
  return (await axios.post(CB_TOKEN_URL, body, { timeout: 15000 })).data.access_token
}

;(async () => {
  const t = await tok()
  const H = (extra={}) => ({ Authorization: 'Bearer '+t, 'x-request-id': randomUUID(), ...extra })

  // 1) Count instances by status
  const all = []
  let page = 1
  while (true) {
    const r = await axios.get(`${CB_API}/compute/instances`, { headers: H(), params: { page, size: 50 }, timeout: 20000 })
    const items = r.data?.data || []
    all.push(...items)
    if (items.length < 50) break
    page++
    if (page > 20) break
  }
  console.log(`Total instances in Contabo account: ${all.length}\n`)
  const byStatus = {}
  for (const i of all) byStatus[i.status] = (byStatus[i.status] || 0) + 1
  console.log('Status breakdown:')
  for (const [s, n] of Object.entries(byStatus).sort((a,b) => b[1]-a[1])) console.log(`  ${s.padEnd(20)} ${n}`)

  // 2) Show pending_payment / pending instances
  console.log('\n--- pending_payment / non-running instances ---')
  for (const i of all) {
    if (i.status !== 'running') {
      console.log(`  ${i.instanceId}  status=${i.status.padEnd(20)} created=${i.createdDate}  name=${i.name || i.displayName || '-'}  ip=${i.ipConfig?.v4?.ip || '-'}`)
    }
  }

  // 3) Try to read user/billing info if endpoint exists
  console.log('\n--- Account / billing balance check ---')
  try {
    const r = await axios.get(`${CB_API}/users`, { headers: H(), timeout: 15000 })
    const me = (r.data?.data || [])[0]
    if (me) {
      console.log('  User ID:    ', me.userId)
      console.log('  Customer:   ', me.customerNumber || me.firstName + ' ' + me.lastName)
      console.log('  Locale:     ', me.locale)
    }
  } catch (e) { console.log('  /users error:', e.response?.status, e.response?.data?.message || e.message) }

  // Some Contabo accounts expose /payments or /credits
  for (const path of ['/payments', '/credits', '/wallets']) {
    try {
      const r = await axios.get(`${CB_API}${path}`, { headers: H(), timeout: 15000 })
      console.log(`  ${path}:`, JSON.stringify(r.data).substring(0, 300))
    } catch (e) { console.log(`  ${path} → ${e.response?.status || ''} (not exposed via API)`) }
  }
})().catch(e => { console.error('FATAL:', e.response?.data || e.message); process.exit(1) })
