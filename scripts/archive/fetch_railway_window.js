require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const TOKEN = process.env.API_KEY_RAILWAY
const EID = '889fd56a-720a-4020-884c-034784992666'
const SID = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885'

async function gql(query, variables = {}) {
  for (const url of ['https://backboard.railway.com/graphql/v2', 'https://backboard.railway.app/graphql/v2']) {
    for (const authHeader of [{ Authorization: `Bearer ${TOKEN}` }, { 'Project-Access-Token': TOKEN }]) {
      try {
        const r = await axios.post(url, { query, variables }, {
          headers: { 'Content-Type': 'application/json', ...authHeader },
          timeout: 60000,
        })
        if (r.data?.errors) { console.error('gql errors:', JSON.stringify(r.data.errors).slice(0,200)); continue }
        return r.data?.data
      } catch (e) { console.error('req err:', e.message) }
    }
  }
  throw new Error('All auth attempts failed')
}

;(async () => {
  const dq = `query D($e:String!,$s:String!){deployments(input:{environmentId:$e,serviceId:$s},first:5){edges{node{id status}}}}`
  const dr = await gql(dq, { e: EID, s: SID })
  const depId = dr.deployments.edges.find(x => x.node.status === 'SUCCESS').node.id

  // Fetch more logs with no filter
  const lq = `query L($d:String!,$f:String,$n:Int!){deploymentLogs(deploymentId:$d,filter:$f,limit:$n){timestamp message severity}}`
  const lr = await gql(lq, { d: depId, f: '', n: 5000 })
  const logs = (lr.deploymentLogs || []).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  // Print all logs mentioning 5168006768 OR walletSelectCurrency OR CartRecovery OR wallet_topup_quick OR from 01:20 to 01:27
  const window = logs.filter(l => l.timestamp >= '2026-07-01T01:20:00' && l.timestamp <= '2026-07-01T01:27:30')
  console.log(`=== 01:20 - 01:27 (${window.length} lines) ===`)
  const skipPatterns = ['[Memory]', '[CR-Whitelist]', '[ProtectionHeartbeat]', '[cPanel Health]', '[DnsHealer]', '[NotifyGroup]']
  for (const l of window) {
    const m = l.message || ''
    if (skipPatterns.some(p => m.includes(p))) continue
    console.log(`[${l.timestamp.slice(11, 23)}] ${m.slice(0, 500)}`)
  }
})().catch(e => { console.error('ERR:', e.message); process.exit(1) })
