/**
 * Fetch Railway production logs filtered by domain name + user chatId.
 *
 * Usage:
 *   RAILWAY_API_KEY=... node /app/scripts/fetch_rsvpeviteopen_org_trace.js
 *
 * Or rely on /app/backend/.env API_KEY_RAILWAY.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const https = require('https')
const fs = require('fs')

const ACCOUNT_TOKEN = process.env.RAILWAY_API_KEY || process.env.API_KEY_RAILWAY

function gql(query, variables = {}) {
  const data = JSON.stringify({ query, variables })
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    Authorization: `Bearer ${ACCOUNT_TOKEN}`,
  }
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
  // 1. Locate the production project + service
  const projectsQ = `query Me { me { projects { edges { node { id name environments { edges { node { id name } } } services { edges { node { id name } } } } } } } }`
  const meRes = await gql(projectsQ)
  if (meRes.body.errors) {
    console.error('Railway auth FAILED:', JSON.stringify(meRes.body.errors))
    process.exit(1)
  }
  const projects = meRes.body?.data?.me?.projects?.edges || []
  console.log('Projects found:')
  for (const p of projects) {
    console.log(`  - ${p.node.name} (id=${p.node.id})`)
    for (const e of p.node.environments?.edges || []) {
      console.log(`      env: ${e.node.name} (${e.node.id})`)
    }
    for (const s of p.node.services?.edges || []) {
      console.log(`      svc: ${s.node.name} (${s.node.id})`)
    }
  }

  // Find Nomadly-EMAIL-IVR service
  let envId, serviceId
  for (const p of projects) {
    for (const s of p.node.services?.edges || []) {
      if (/nomadly|email|ivr/i.test(s.node.name)) {
        serviceId = s.node.id
        const prodEnv = (p.node.environments?.edges || []).find(e => /prod/i.test(e.node.name)) || p.node.environments?.edges?.[0]
        envId = prodEnv?.node.id
        console.log(`\nUsing project="${p.node.name}" service="${s.node.name}" (${serviceId}), env=${prodEnv?.node.name} (${envId})`)
        break
      }
    }
    if (serviceId) break
  }
  if (!serviceId || !envId) {
    console.error('Could not auto-detect Nomadly service. Set RAILWAY_SERVICE_ID + RAILWAY_ENVIRONMENT_ID manually.')
    process.exit(1)
  }

  // 2. Get latest deployment
  const depQ = `query Deps($envId: String!, $serviceId: String!) {
    deployments(input: { environmentId: $envId, serviceId: $serviceId }, first: 5) {
      edges { node { id status createdAt } }
    }
  }`
  const dr = await gql(depQ, { envId, serviceId })
  const deps = dr.body?.data?.deployments?.edges || []
  const active = deps.find(e => ['SUCCESS', 'RUNNING'].includes(e.node.status)) || deps[0]
  console.log(`Active deployment: ${active?.node?.id} (status=${active?.node?.status})`)

  // 3. Pull logs filtered by domain + chatId
  const logQuery = `query Logs($depId: String!, $filter: String, $limit: Int) {
    deploymentLogs(deploymentId: $depId, filter: $filter, limit: $limit) {
      timestamp message severity
    }
  }`
  const filters = [
    'rsvpeviteopen.org',
    'rsvpeviteopen',
    '29665245', // OP domain id
    '1960615421', // chatId
    '2047e30143fb8c792301fcd4a5d340b6', // CF zone id
  ]

  const all = []
  for (const f of filters) {
    const r = await gql(logQuery, { depId: active.node.id, filter: f, limit: 2000 })
    const logs = r.body?.data?.deploymentLogs || []
    console.log(`  filter="${f}" → ${logs.length} lines`)
    all.push(...logs)
  }

  const seen = new Set()
  const dedup = []
  for (const l of all) {
    const k = `${l.timestamp}|${l.message}`
    if (seen.has(k)) continue
    seen.add(k); dedup.push(l)
  }
  dedup.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  fs.writeFileSync('/app/memory/rsvpeviteopen_org_trace.json', JSON.stringify(dedup, null, 2))
  console.log(`\n=== ${dedup.length} unique log lines saved to /app/memory/rsvpeviteopen_org_trace.json ===\n`)

  // Print chronological — focus on the window 16:42 → 16:50 UTC on 2026-06-11
  const WINDOW_FROM = '2026-06-11T16:30:00'
  const WINDOW_TO = '2026-06-11T17:00:00'
  const win = dedup.filter(l => l.timestamp >= WINDOW_FROM && l.timestamp <= WINDOW_TO)
  console.log(`Lines in window ${WINDOW_FROM}—${WINDOW_TO}: ${win.length}\n`)
  for (const l of win) {
    console.log(`[${l.timestamp.slice(11, 23)}] ${l.severity || ''} ${l.message.slice(0, 360)}`)
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
