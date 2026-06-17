/**
 * Read-only check of OVH / VPS-related env vars on Railway production.
 * Prints which OVH_* / VPS_* vars are currently set on Nomadly-EMAIL-IVR.
 * Does NOT modify anything.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const TOKEN = process.env.API_KEY_RAILWAY
const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
const ENV_ID     = '889fd56a-720a-4020-884c-034784992666'
const SVC_ID     = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885' // Nomadly-EMAIL-IVR

const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
const GQL_URL = 'https://backboard.railway.com/graphql/v2'

async function gql(q, v = {}) {
  const r = await axios.post(GQL_URL, { query: q, variables: v }, { headers, timeout: 30000 })
  if (r.data?.errors) throw new Error('GQL: ' + JSON.stringify(r.data.errors).substring(0, 600))
  return r.data?.data
}

;(async () => {
  // Query all service variables and filter for OVH / VPS-related ones
  const q = `query Vars($projectId: String!, $environmentId: String!, $serviceId: String) {
    variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
  }`
  const r = await gql(q, { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID })
  const all = r.variables || {}
  const keys = Object.keys(all).sort()

  console.log(`Total variables on Nomadly-EMAIL-IVR: ${keys.length}`)
  console.log('\n━━━ OVH_* vars on Railway production:')
  const ovhKeys = keys.filter(k => k.startsWith('OVH_'))
  if (ovhKeys.length === 0) console.log('  (none — all need to be added)')
  for (const k of ovhKeys) {
    const v = all[k]
    const masked = v?.length > 10 ? v.substring(0, 6) + '…' + v.substring(v.length - 4) : v
    console.log(`  ${k} = ${masked}`)
  }

  console.log('\n━━━ VPS_* vars on Railway production:')
  const vpsKeys = keys.filter(k => k.startsWith('VPS_'))
  for (const k of vpsKeys) {
    console.log(`  ${k} = ${all[k]}`)
  }

  console.log('\n━━━ CONTABO_* vars (kept as fallback):')
  const conKeys = keys.filter(k => k.startsWith('CONTABO_'))
  console.log(`  ${conKeys.length} CONTABO_* variables currently present`)
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
