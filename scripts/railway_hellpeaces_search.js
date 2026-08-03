// READ-ONLY Railway log search for @hellpeaces renewal + file-delete.
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('/app/node_modules/axios')
const TOKEN = process.env.API_KEY_RAILWAY
const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
const PATTERNS = ['5522767823', 'prevc2b4', 'previteletterviews', 'HostingScheduler', 'Auto-renew', 'auto-renew', 'EPERM', 'fixquota', 'files/delete', 'Delete', 'renew']
async function gql(q, v = {}) {
  const r = await axios.post('https://backboard.railway.com/graphql/v2', { query: q, variables: v }, { headers, timeout: 45000 })
  if (r.data?.errors) throw new Error(JSON.stringify(r.data.errors).substring(0, 400))
  return r.data?.data
}
;(async () => {
  const p = await gql(`query($id:String!){ project(id:$id){ name services{ edges{ node{ id name deployments(first:3){edges{node{id status createdAt}}} } } } } }`, { id: PROJECT_ID })
  console.log('Project:', p?.project?.name)
  const services = p?.project?.services?.edges?.map(e => e.node) || []
  for (const s of services) {
    const dep = s.deployments?.edges?.map(e => e.node).find(d => d.status === 'SUCCESS')
    if (!dep) { console.log(`\n### ${s.name}: no live SUCCESS deployment`); continue }
    console.log(`\n########## ${s.name}  (deploy ${dep.id.slice(0,8)}, up since ${dep.createdAt}) ##########`)
    let logs = null
    try {
      logs = await gql(`query($id:String!,$n:Int!){ deploymentLogs(deploymentId:$id, limit:$n){timestamp message severity} }`, { id: dep.id, n: 5000 })
    } catch (e) { console.log('  log fetch error:', e.message); continue }
    const lines = logs?.deploymentLogs || []
    const matched = lines.filter(l => {
      const m = l.message || ''
      return PATTERNS.some(pat => m.includes(pat))
    })
    console.log(`  fetched ${lines.length} lines, ${matched.length} matched patterns`)
    for (const l of matched) {
      const ts = (l.timestamp || '').slice(0, 19)
      console.log(`  [${ts}] ${(l.message || '').replace(/\n/g, ' ').slice(0, 300)}`)
    }
  }
})().catch(e => { console.error('FATAL', e.message) })
