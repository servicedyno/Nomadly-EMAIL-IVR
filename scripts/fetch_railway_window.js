/**
 * Fetch ALL Railway logs between two timestamps to see the admin reply chain.
 */
require('dotenv').config({ path: '/app/.env' })
const https = require('https')
const fs = require('fs')

const PROJECT_TOKEN = process.env.RAILWAY_PROJECT_TOKEN
const ACCOUNT_TOKEN = process.env.API_KEY_RAILWAY
const ENV_ID = process.env.RAILWAY_ENVIRONMENT_ID
const SERVICE_ID = process.env.RAILWAY_SERVICE_ID

function gql(query, variables = {}, useProjectToken = false) {
  const data = JSON.stringify({ query, variables })
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  }
  if (useProjectToken && PROJECT_TOKEN) headers['Project-Access-Token'] = PROJECT_TOKEN
  else if (ACCOUNT_TOKEN) headers.Authorization = `Bearer ${ACCOUNT_TOKEN}`
  const opts = { hostname: 'backboard.railway.app', path: '/graphql/v2', method: 'POST', headers }
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }) }
        catch { resolve({ status: res.statusCode, body }) }
      })
    })
    req.on('error', reject)
    req.write(data); req.end()
  })
}

async function main() {
  const deployQuery = `query Deps($envId: String!, $serviceId: String!) {
    deployments(input: { environmentId: $envId, serviceId: $serviceId }, first: 5) {
      edges { node { id status createdAt } }
    }
  }`
  let dr = await gql(deployQuery, { envId: ENV_ID, serviceId: SERVICE_ID }, true)
  if (dr.body && dr.body.errors) dr = await gql(deployQuery, { envId: ENV_ID, serviceId: SERVICE_ID }, false)
  const deps = dr.body?.data?.deployments?.edges || []
  const active = deps.find(e => ['SUCCESS', 'RUNNING'].includes(e.node.status)) || deps[0]
  const depId = active.node.id
  console.log(`Deployment: ${depId}`)

  // Pull a wider net of recent lines so we can sort & view chronologically
  const logQuery = `query Logs($depId: String!, $filter: String, $limit: Int) {
    deploymentLogs(deploymentId: $depId, filter: $filter, limit: $limit) {
      timestamp message severity
    }
  }`
  const filters = ['', 'webhook received', '5590563715', '1794625076']
  const all = []
  for (const f of filters) {
    let r = await gql(logQuery, { depId, filter: f, limit: 3000 }, true)
    if (r.body?.errors) r = await gql(logQuery, { depId, filter: f, limit: 3000 }, false)
    const logs = r.body?.data?.deploymentLogs || []
    console.log(`  filter="${f}" → ${logs.length}`)
    all.push(...logs)
  }
  const seen = new Set(); const dedup = []
  for (const l of all) {
    const k = `${l.timestamp}|${l.message}`
    if (seen.has(k)) continue
    seen.add(k); dedup.push(l)
  }
  dedup.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  const FROM = '2026-05-16T14:35:30'
  const TO   = '2026-05-16T14:50:30'
  const window = dedup.filter(l => l.timestamp >= FROM && l.timestamp <= TO)
  console.log(`\nLines between ${FROM} and ${TO}: ${window.length}`)
  fs.writeFileSync('/app/memory/admin_reply_window.json', JSON.stringify(window, null, 2))
  for (const l of window) {
    console.log(`[${l.timestamp.slice(11, 23)}] ${l.message.slice(0, 280)}`)
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
