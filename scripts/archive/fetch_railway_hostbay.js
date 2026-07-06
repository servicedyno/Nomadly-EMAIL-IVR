require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const TOKEN = process.env.API_KEY_RAILWAY
const PID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
const EID = '889fd56a-720a-4020-884c-034784992666'
const SID = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885'

const endpoints = ['https://backboard.railway.com/graphql/v2', 'https://backboard.railway.app/graphql/v2']

async function gql(query, variables = {}) {
  const errors = []
  for (const url of endpoints) {
    for (const authHeader of [{ Authorization: `Bearer ${TOKEN}` }, { 'Project-Access-Token': TOKEN }]) {
      try {
        const r = await axios.post(url, { query, variables }, {
          headers: { 'Content-Type': 'application/json', ...authHeader },
          timeout: 30000,
        })
        if (r.data?.errors) { errors.push(JSON.stringify(r.data.errors).slice(0, 300)); continue }
        return r.data?.data
      } catch (e) {
        errors.push(`${url} ${Object.keys(authHeader)[0]}: ${e.message}`)
      }
    }
  }
  throw new Error('All auth attempts failed: ' + errors.join(' | '))
}

;(async () => {
  const filterArg = process.argv[2] || '5168006768'
  const nLines = parseInt(process.argv[3] || '500')

  // 1. Find the latest RUNNING deployment for our service
  const q = `query D($e:String!,$s:String!){deployments(input:{environmentId:$e,serviceId:$s},first:5){edges{node{id status createdAt}}}}`
  const dr = await gql(q, { e: EID, s: SID })
  const edges = dr?.deployments?.edges || []
  console.log('Recent deployments:')
  for (const e of edges) console.log(`  ${e.node.status.padEnd(10)} ${e.node.createdAt}  ${e.node.id}`)
  const running = edges.find(x => x.node.status === 'SUCCESS' || x.node.status === 'RUNNING')
  if (!running) { console.error('No SUCCESS/RUNNING deployment found'); process.exit(1) }
  const depId = running.node.id
  console.log(`\nFetching logs from deployment ${depId} — filter="${filterArg}", limit=${nLines}\n`)

  // 2. Fetch logs
  const lq = `query L($d:String!,$f:String,$n:Int!){deploymentLogs(deploymentId:$d,filter:$f,limit:$n){timestamp message severity}}`
  const lr = await gql(lq, { d: depId, f: filterArg, n: nLines })
  const logs = lr?.deploymentLogs || []
  console.log(`Got ${logs.length} lines`)
  logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  for (const l of logs) {
    console.log(`[${l.timestamp?.slice(11, 23)}] ${(l.message || '').slice(0, 400)}`)
  }
})().catch(e => { console.error('ERR:', e.message); process.exit(1) })
