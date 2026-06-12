require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const TOKEN = process.env.API_KEY_RAILWAY
const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
const DEP = process.argv[2] || 'f18fa194-a8be-48c7-abf9-99b6143ee3a9'
const FILTER = process.argv[3] || ''
const LIMIT = parseInt(process.argv[4] || '500', 10)

async function gql(q,v){
  const r = await axios.post('https://backboard.railway.com/graphql/v2',{query:q,variables:v},{headers,timeout:60000})
  if (r.data?.errors) throw new Error(JSON.stringify(r.data.errors).substring(0,500))
  return r.data?.data
}

;(async () => {
  const logs = await gql(`query($id:String!,$f:String,$n:Int!){ deploymentLogs(deploymentId:$id, filter:$f, limit:$n){timestamp message severity} }`, { id: DEP, f: FILTER, n: LIMIT })
  const lines = logs?.deploymentLogs || []
  console.log(`Got ${lines.length} lines (filter='${FILTER}', limit=${LIMIT})`)
  for (const l of lines) console.log(`[${l.timestamp}] ${(l.message || '').substring(0, 400)}`)
})().catch(e=>console.error('ERR',e.message))
