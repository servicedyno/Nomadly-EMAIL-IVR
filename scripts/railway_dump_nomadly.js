// Dump ALL Nomadly-EMAIL-IVR live-deployment log lines to a file for local grep.
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('/app/node_modules/axios')
const fs = require('fs')
const TOKEN = process.env.API_KEY_RAILWAY
const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
async function gql(q, v = {}) {
  const r = await axios.post('https://backboard.railway.com/graphql/v2', { query: q, variables: v }, { headers, timeout: 60000 })
  if (r.data?.errors) throw new Error(JSON.stringify(r.data.errors).substring(0, 400))
  return r.data?.data
}
;(async () => {
  const p = await gql(`query($id:String!){ project(id:$id){ services{ edges{ node{ id name deployments(first:3){edges{node{id status createdAt}}} } } } } }`, { id: PROJECT_ID })
  const svc = p.project.services.edges.map(e => e.node).find(s => s.name === 'Nomadly-EMAIL-IVR')
  const dep = svc.deployments.edges.map(e => e.node).find(d => d.status === 'SUCCESS')
  const logs = await gql(`query($id:String!,$n:Int!){ deploymentLogs(deploymentId:$id, limit:$n){timestamp message severity} }`, { id: dep.id, n: 5000 })
  const lines = (logs?.deploymentLogs || []).map(l => `[${(l.timestamp||'').slice(0,19)}] ${(l.message||'').replace(/\n/g,' ')}`)
  fs.writeFileSync('/tmp/nomadly_logs.txt', lines.join('\n'))
  console.log('wrote', lines.length, 'lines; time span:', lines[0]?.slice(0,20), '→', lines[lines.length-1]?.slice(0,20))
})().catch(e => console.error('FATAL', e.message))
