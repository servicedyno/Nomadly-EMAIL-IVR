require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const TOKEN = process.env.API_KEY_RAILWAY
const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
async function gql(q,v={}) { const r = await axios.post('https://backboard.railway.com/graphql/v2',{query:q,variables:v},{headers,timeout:30000}); if(r.data?.errors) throw new Error(JSON.stringify(r.data.errors).substring(0,500)); return r.data?.data }
;(async () => {
  const p = await gql(`query($id:String!){ project(id:$id){ services{ edges{ node{ id name deployments(first:1){edges{node{id status}}} } } } } }`, { id: PROJECT_ID })
  const services = p?.project?.services?.edges?.map(e=>e.node) || []
  for (const s of services) {
    const dep = s.deployments?.edges?.[0]?.node
    if (!dep || dep.status !== 'SUCCESS') { console.log(`${s.name}: no live SUCCESS dep`); continue }
    const logs = await gql(`query($id:String!,$n:Int!){ deploymentLogs(deploymentId:$id, limit:$n){timestamp message severity} }`, { id: dep.id, n: 40 }).catch(()=>null)
    console.log(`\n=== ${s.name} (${dep.id}) — last 40 lines ===`)
    for (const l of (logs?.deploymentLogs || [])) console.log(`  [${l.timestamp?.substring(11,19)}] ${(l.message || '').substring(0, 230)}`)
  }
})().catch(e=>console.error('ERR',e.message))
