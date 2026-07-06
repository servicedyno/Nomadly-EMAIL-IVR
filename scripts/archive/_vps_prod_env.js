require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const TOKEN = process.env.API_KEY_RAILWAY
const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
const ENV_ID = '889fd56a-720a-4020-884c-034784992666'
const SVC_ID = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885'
async function gql(q, v = {}) {
  const r = await axios.post('https://backboard.railway.com/graphql/v2', { query: q, variables: v }, { headers, timeout: 30000 })
  if (r.data?.errors) throw new Error(JSON.stringify(r.data.errors).substring(0, 500))
  return r.data?.data
}
;(async () => {
  const d = await gql(`query($p:String!,$e:String!,$s:String!){ variables(projectId:$p, environmentId:$e, serviceId:$s) }`, { p: PROJECT_ID, e: ENV_ID, s: SVC_ID })
  const v = d.variables || {}
  const keys = Object.keys(v).filter(k => /VPS|CONTABO|OVH|PROVIDER|WINDOWS|DRY_RUN/i.test(k)).sort()
  console.log('=== PROD VPS/Contabo/OVH env ===')
  for (const k of keys) {
    let val = v[k]
    if (/PASSWORD|SECRET|TOKEN|KEY/i.test(k)) val = String(val).substring(0, 6) + '…(masked)'
    console.log(`${k}=${val}`)
  }
})().catch(e => console.error('ERR', e.message))
