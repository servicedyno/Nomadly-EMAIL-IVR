require('dotenv').config({path:'/app/backend/.env'})
const axios = require('axios')
const TOKEN = process.env.API_KEY_RAILWAY
const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
;(async () => {
  const PID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
  const r = await axios.post('https://backboard.railway.com/graphql/v2', { query: `query($id:String!){ project(id:$id){ services{ edges{ node{ id name deployments(first:8){ edges{ node{ id status createdAt } } } } } } } }`, variables: { id: PID }}, { headers })
  const services = r.data?.data?.project?.services?.edges?.map(e=>e.node) || []
  for (const svc of services) {
    if (svc.id !== 'b9c4ad64-7667-4dd3-8b9a-3867ede47885') continue  // Nomadly-EMAIL-IVR only
    for (const d of svc.deployments.edges) {
      if (d.node.status !== 'SUCCESS' && d.node.status !== 'REMOVED') continue
      const lr = await axios.post('https://backboard.railway.com/graphql/v2', { query: `query($id:String!,$f:String,$n:Int!){ deploymentLogs(deploymentId:$id, filter:$f, limit:$n){timestamp message} }`, variables: { id: d.node.id, f: '"Token acquired"', n: 5 }}, { headers }).catch(()=>null)
      const lines = lr?.data?.data?.deploymentLogs || []
      const last = lines[lines.length-1]
      console.log(`  dep=${d.node.id.substring(0,8)} status=${d.node.status} created=${d.node.createdAt.substring(0,19)} lastTokenAcq=${last?.timestamp || '(none)'}`)
    }
  }
})().catch(e=>console.error(e.message))
