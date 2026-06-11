require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const TOKEN = process.env.API_KEY_RAILWAY
const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
async function gql(q,v={}) { const r = await axios.post('https://backboard.railway.com/graphql/v2',{query:q,variables:v},{headers,timeout:30000}); if(r.data?.errors) throw new Error(JSON.stringify(r.data.errors).substring(0,500)); return r.data?.data }

;(async () => {
  // Nomadly-EMAIL-IVR latest deployment
  const DEP = 'f18fa194-a8be-48c7-abf9-99b6143ee3a9'
  const filter = process.argv[2] || ''
  const logs = await gql(`query($id:String!,$f:String,$n:Int!){ deploymentLogs(deploymentId:$id, filter:$f, limit:$n){timestamp message severity} }`, { id: DEP, f: filter, n: 200 })
  const lines = logs?.deploymentLogs || []
  console.log(`Got ${lines.length} lines (filter=${filter || '(none)'})`)
  for (const l of lines.slice(-100)) console.log(`  [${l.timestamp?.substring(11,19)}] ${(l.message || '').substring(0, 240)}`)
})().catch(e=>console.error('ERR',e.message))
