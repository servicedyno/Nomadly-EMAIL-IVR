require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const TOKEN = process.env.API_KEY_RAILWAY
const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
async function gql(q,v){
  const r = await axios.post('https://backboard.railway.com/graphql/v2',{query:q,variables:v},{headers,timeout:60000})
  if (r.data?.errors) throw new Error(JSON.stringify(r.data.errors).substring(0,500))
  return r.data?.data
}
const mode = process.argv[2] || 'list'
;(async () => {
  if (mode === 'list') {
    const me = await gql(`query { projectToken { projectId environmentId } }`)
    const { projectId, environmentId } = me.projectToken
    const d = await gql(`query($p:String!,$e:String!){ deployments(first:6, input:{projectId:$p, environmentId:$e}) { edges { node { id status createdAt } } } }`, { p: projectId, e: environmentId })
    for (const e of d?.deployments?.edges || []) console.log(e.node.id, e.node.status, e.node.createdAt)
    return
  }
  const dep = process.argv[2]
  const filter = process.argv[3] || ''
  const limit = parseInt(process.argv[4] || '500', 10)
  const logs = await gql(`query($id:String!,$f:String,$n:Int!){ deploymentLogs(deploymentId:$id, filter:$f, limit:$n){timestamp message severity} }`, { id: dep, f: filter, n: limit })
  const lines = logs?.deploymentLogs || []
  console.log(`Got ${lines.length} lines`)
  for (const l of lines) console.log(`[${l.timestamp}] ${(l.message || '').substring(0, 600)}`)
})().catch(e=>console.error('ERR',e.message))
