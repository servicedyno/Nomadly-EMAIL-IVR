/**
 * Show pricing-relevant env vars on Railway vs dev pod.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const TOKEN = process.env.API_KEY_RAILWAY
const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
const ENV_ID = '889fd56a-720a-4020-884c-034784992666'
const SVC_ID = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885'
const GQL = 'https://backboard.railway.com/graphql/v2'
const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }

const KEYS = [
  'PREMIUM_ANTIRED_WEEKLY_PRICE',
  'PREMIUM_ANTIRED_CPANEL_PRICE',
  'GOLDEN_ANTIRED_CPANEL_PRICE',
  'PREMIUM_ANTIRED_PRICE',
  'GOLDEN_ANTIRED_PRICE',
  'VPS_PREMIUM_PRICE',
  'VPS_GOLD_PRICE',
  'DOMAIN_DEFAULT_PRICE',
  'WALLET_MIN_TOPUP_USD',
]

;(async () => {
  const r = await axios.post(GQL, {
    query: `query($projectId:String!,$environmentId:String!,$serviceId:String!){
      variables(projectId:$projectId, environmentId:$environmentId, serviceId:$serviceId)
    }`,
    variables: { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID },
  }, { headers, timeout: 15000 })
  const railwayVars = r.data?.data?.variables || {}
  console.log('Pricing-relevant env vars:')
  console.log('  KEY                                   RAILWAY                    DEV POD')
  for (const k of KEYS) {
    const rv = railwayVars[k] === undefined ? '<unset>' : String(railwayVars[k])
    const dv = process.env[k] === undefined ? '<unset>' : String(process.env[k])
    console.log(`  ${k.padEnd(38)} ${rv.padEnd(26)} ${dv}`)
  }
  // Also list anything with PRICE in the key
  console.log('\nAll Railway vars matching /PRICE|PLAN/:')
  for (const k of Object.keys(railwayVars).sort()) {
    if (/PRICE|PLAN/.test(k)) console.log(`  ${k} = ${railwayVars[k]}`)
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
