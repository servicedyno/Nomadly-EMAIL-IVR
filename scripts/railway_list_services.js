require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const TOKEN = process.env.API_KEY_RAILWAY
const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
async function gql(q, v = {}) {
  const r = await axios.post('https://backboard.railway.com/graphql/v2', { query: q, variables: v }, { headers, timeout: 30000 })
  if (r.data?.errors) throw new Error(JSON.stringify(r.data.errors).substring(0, 800))
  return r.data?.data
}
;(async () => {
  const p = await gql(`query($id:String!){ project(id:$id){ name environments{edges{node{id name}}} services{ edges{ node{ id name deployments(first:1){edges{node{id status createdAt}}} } } } } }`, { id: PROJECT_ID })
  console.log('PROJECT:', p?.project?.name)
  console.log('ENVIRONMENTS:', (p?.project?.environments?.edges || []).map(e => `${e.node.name}=${e.node.id}`).join(', '))
  const services = p?.project?.services?.edges?.map(e => e.node) || []
  console.log(`\nSERVICES (${services.length}):`)
  for (const s of services) {
    const dep = s.deployments?.edges?.[0]?.node
    const age = dep ? ((Date.now() - new Date(dep.createdAt).getTime()) / 3600000).toFixed(1) + 'h' : 'n/a'
    console.log(`  ${s.name}  | svc=${s.id} | dep=${dep?.id} | status=${dep?.status} | deployed ${age} ago (${dep?.createdAt})`)
  }
})().catch(e => console.error('ERR', e.message))
