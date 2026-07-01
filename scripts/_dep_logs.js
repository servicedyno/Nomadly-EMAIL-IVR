'use strict'
require('dotenv').config({ path: 'backend/.env' })
const https = require('https')
const TOKEN = process.env.API_KEY_RAILWAY, PID = process.env.RAILWAY_PROJECT_ID, EID = process.env.RAILWAY_ENVIRONMENT_ID, SID = process.env.RAILWAY_SERVICE_ID
const UA = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/124.0 Safari/537.36'
function gql(q) {
  return new Promise((res, rej) => {
    const body = JSON.stringify({ query: q })
    const r = https.request('https://backboard.railway.app/graphql/v2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA, 'Project-Access-Token': TOKEN, 'Content-Length': Buffer.byteLength(body) } }, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(new Error(d.slice(0, 200))) } }) })
    r.on('error', rej); r.write(body); r.end()
  })
}
;(async () => {
  const d = await gql(`query { deployments(input:{projectId:"${PID}",environmentId:"${EID}",serviceId:"${SID}"}, first:70){ edges{ node{ id status createdAt } } } }`)
  const edges = (d.data && d.data.deployments && d.data.deployments.edges) || []
  // deployments created on Jun 26,27,29,30 (cover the $0 & low days)
  const targetDays = ['2026-06-26', '2026-06-27', '2026-06-29', '2026-06-30']
  const targets = edges.filter(e => targetDays.some(day => e.node.createdAt.startsWith(day)))
  console.log(`Found ${edges.length} deployments; ${targets.length} on target days`)
  const KWS = ['crypto-wallet', 'WALLET WEBHOOK', 'Wallet credited', 'Wallet Top-Up', 'deposit_confirmed', 'addFundsTo', 'Missing required fields', 'not supported']
  for (const t of targets) {
    console.log(`\n########## deployment ${t.node.id.slice(0,8)} created ${t.node.createdAt} (${t.node.status}) ##########`)
    for (const kw of KWS) {
      try {
        const q = `query { deploymentLogs(deploymentId:"${t.node.id}", limit:400, filter:"${kw}") { message timestamp } }`
        const r = await gql(q)
        const logs = (r.data && r.data.deploymentLogs) || []
        if (logs.length) {
          console.log(`  [filter "${kw}"] ${logs.length} lines:`)
          logs.slice(-8).forEach(l => console.log(`     ${l.timestamp} | ${String(l.message).slice(0,180)}`))
        }
      } catch (e) { console.log(`  [filter "${kw}"] ERR ${e.message}`) }
    }
  }
})().catch(e => console.error('FATAL', e.message))
