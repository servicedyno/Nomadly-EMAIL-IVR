require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const TOKEN = process.env.API_KEY_RAILWAY
const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
async function gql(q, v = {}) {
  const r = await axios.post('https://backboard.railway.com/graphql/v2', { query: q, variables: v }, { headers, timeout: 30000 })
  if (r.data?.errors) throw new Error(JSON.stringify(r.data.errors).substring(0, 800))
  return r.data?.data
}
const SERVICES = {
  'Nomadly-EMAIL-IVR': 'b9c4ad64-7667-4dd3-8b9a-3867ede47885',
  HostingBotNew: '0a453645-4180-441b-8988-020807f4479a',
  LockbayNewFIX: '96ee768e-3f4d-49c8-be75-dea30777e890',
}
;(async () => {
  const svc = process.argv[2] || 'Nomadly-EMAIL-IVR'
  const id = SERVICES[svc]
  const d = await gql(`query($id:String!){ service(id:$id){ name deployments(first:12){edges{node{id status createdAt}}} } }`, { id })
  console.log(`Deployment history for ${d?.service?.name}:`)
  for (const e of (d?.service?.deployments?.edges || [])) {
    const n = e.node
    const age = ((Date.now() - new Date(n.createdAt).getTime()) / 3600000).toFixed(1)
    console.log(`  ${n.createdAt} (${age}h ago)  ${n.status.padEnd(9)}  ${n.id}`)
  }
})().catch(e => console.error('ERR', e.message))
