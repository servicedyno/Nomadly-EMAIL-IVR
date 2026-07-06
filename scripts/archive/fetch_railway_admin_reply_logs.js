/**
 * Fetch Railway logs around admin "💬 Reply User" callback flow.
 * Hunts for failure modes: callback acks, awaitingAdminAction sets,
 * AdminQuickReply dedupes, and /reply rewrites.
 */
require('dotenv').config({ path: '/app/.env' })
const https = require('https')
const fs = require('fs')

const PROJECT_TOKEN = process.env.RAILWAY_PROJECT_TOKEN
const ACCOUNT_TOKEN = process.env.API_KEY_RAILWAY
const ENV_ID = process.env.RAILWAY_ENVIRONMENT_ID
const SERVICE_ID = process.env.RAILWAY_SERVICE_ID
const LOOKBACK_HOURS = Number(process.argv[2]) || 6

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
  if (!active) { console.error('No deployments found'); process.exit(1) }
  const depId = active.node.id
  console.log(`Deployment: ${depId} (${active.node.status})`)

  const filters = [
    'AdminQuickReply',
    'AdminAction',
    'Quick-reply',
    'Quick Reply',
    'awaitingAdminAction',
    'Admin replied to',
    'Admin tapped',
    'reply: ',
    'Support session',
    'supportChat',
    '5590563715',     // admin chat id
    'callback_query',
    'Telegram callback',
    'TelegramError',
    'ETELEGRAM',
    'aR:',
    '/reply',
  ]

  const logQuery = `query Logs($depId: String!, $filter: String, $limit: Int) {
    deploymentLogs(deploymentId: $depId, filter: $filter, limit: $limit) {
      timestamp message severity
    }
  }`

  const allLogs = []
  for (const f of filters) {
    let r = await gql(logQuery, { depId, filter: f, limit: 1500 }, true)
    if (r.body?.errors) r = await gql(logQuery, { depId, filter: f, limit: 1500 }, false)
    const logs = r.body?.data?.deploymentLogs || []
    console.log(`  filter="${f}" → ${logs.length}`)
    allLogs.push(...logs)
  }
  const seen = new Set(); const dedup = []
  for (const l of allLogs) {
    const k = `${l.timestamp}|${l.message}`
    if (seen.has(k)) continue
    seen.add(k); dedup.push(l)
  }
  dedup.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  // Filter to lookback window
  const cutoff = Date.now() - LOOKBACK_HOURS * 3600 * 1000
  const recent = dedup.filter(l => Date.parse(l.timestamp) >= cutoff)
  console.log(`\nTotal unique lines (last ${LOOKBACK_HOURS}h): ${recent.length}`)
  fs.writeFileSync('/app/memory/admin_reply_logs.json', JSON.stringify(recent, null, 2))
  console.log('Saved → /app/memory/admin_reply_logs.json')

  console.log('\n--- Tail (last 80 lines) ---')
  for (const l of recent.slice(-80)) {
    console.log(`[${l.timestamp}] ${l.message.slice(0, 320)}`)
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
