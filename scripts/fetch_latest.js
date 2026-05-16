require('dotenv').config({ path: '/app/.env' })
const https = require('https')
const PROJECT_TOKEN = process.env.RAILWAY_PROJECT_TOKEN
const ACCOUNT_TOKEN = process.env.API_KEY_RAILWAY
const ENV_ID = process.env.RAILWAY_ENVIRONMENT_ID
const SERVICE_ID = process.env.RAILWAY_SERVICE_ID
function gql(q, v = {}, p = false) {
  const d = JSON.stringify({ query: q, variables: v })
  const h = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) }
  if (p && PROJECT_TOKEN) h['Project-Access-Token'] = PROJECT_TOKEN
  else if (ACCOUNT_TOKEN) h.Authorization = `Bearer ${ACCOUNT_TOKEN}`
  return new Promise((res, rej) => {
    const r = https.request({ hostname: 'backboard.railway.app', path: '/graphql/v2', method: 'POST', headers: h }, (s) => {
      let b = ''; s.on('data', c => b += c); s.on('end', () => { try { res({ s: s.statusCode, b: JSON.parse(b) }) } catch { res({ s: s.statusCode, b }) } })
    }); r.on('error', rej); r.write(d); r.end()
  })
}
;(async () => {
  const dq = `query D($e:String!,$s:String!){deployments(input:{environmentId:$e,serviceId:$s},first:5){edges{node{id status}}}}`
  let dr = await gql(dq, { e: ENV_ID, s: SERVICE_ID }, true); if (dr.b?.errors) dr = await gql(dq, { e: ENV_ID, s: SERVICE_ID }, false)
  const a = dr.b?.data?.deployments?.edges?.find(x => ['SUCCESS','RUNNING'].includes(x.node.status))
  const depId = a.node.id
  const lq = `query L($d:String!,$l:Int){deploymentLogs(deploymentId:$d,limit:$l){timestamp message severity}}`
  let r = await gql(lq, { d: depId, l: 200 }, true); if (r.b?.errors) r = await gql(lq, { d: depId, l: 200 }, false)
  const logs = r.b?.data?.deploymentLogs || []
  logs.sort((x,y)=>x.timestamp.localeCompare(y.timestamp))
  console.log(`Total: ${logs.length}, latest: ${logs[logs.length-1]?.timestamp}`)
  for (const l of logs.slice(-100)) {
    if (l.message.includes('CR-Whitelist') || l.message.includes('ProtectionHeartbeat')) continue
    console.log(`[${l.timestamp.slice(11,23)}] ${l.message.slice(0,260)}`)
  }
})().catch(e=>{console.error(e); process.exit(1)})
