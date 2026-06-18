/**
 * Pull Railway prod logs around the creation times of Contabo instances we
 * want to attribute: the orphan `203368031` plus the two `pending_payment`
 * holds. Searches for the instance IDs themselves + adjacent provisioning
 * attempts so we can identify which chatId requested them.
 */
require('dotenv').config({ path: '/app/.env' })
const https = require('https')
const fs = require('fs')

const TOKEN = process.env.RAILWAY_PROJECT_TOKEN || process.env.API_KEY_RAILWAY
const EID = process.env.RAILWAY_ENVIRONMENT_ID
const SID = process.env.RAILWAY_SERVICE_ID

function gql(query, vars = {}) {
  return new Promise((res, rej) => {
    const req = https.request({
      hostname: 'backboard.railway.app',
      path: '/graphql/v2',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Project-Access-Token': TOKEN },
    }, (r) => {
      let b = ''
      r.on('data', (c) => (b += c))
      r.on('end', () => { try { res(JSON.parse(b)) } catch { res({ raw: b }) } })
    })
    req.on('error', rej)
    req.write(JSON.stringify({ query, variables: vars }))
    req.end()
  })
}

const TARGETS = [
  { id: '203368031', context: 'ORPHAN — created 2026-06-12 09:55Z, V92, IP 13.140.176.82, running' },
  { id: '203369342', context: 'pending_payment — created 2026-06-12 17:09Z, V94 US-central, chatId 7776668174' },
  { id: '203378282', context: 'pending_payment — created 2026-06-16 18:25Z, V94 US-west, chatId 404562920' },
]

;(async () => {
  // get all SUCCESS deployments (we want logs from earlier ones too)
  const dr = await gql(`query D($e: String!, $s: String!) {
    deployments(input: { environmentId: $e, serviceId: $s, status: { in: [SUCCESS, REMOVED] } }, first: 20) {
      edges { node { id status createdAt } }
    }
  }`, { e: EID, s: SID })
  const deps = (dr?.data?.deployments?.edges || []).map(e => e.node)
  console.log(`Available deployments: ${deps.length} (showing all to search)`)
  for (const d of deps.slice(0, 8)) console.log(`  ${d.id.slice(0,8)}  ${d.status}  ${d.createdAt}`)

  for (const t of TARGETS) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`Target: instanceId ${t.id}`)
    console.log(`Context: ${t.context}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    const allLogs = []
    // Search every deployment for this instanceId  
    for (const dep of deps) {
      const r = await gql(
        `query L($d: String!, $f: String, $l: Int) { deploymentLogs(deploymentId: $d, filter: $f, limit: $l) { timestamp message severity } }`,
        { d: dep.id, f: t.id, l: 200 }
      )
      const logs = r?.data?.deploymentLogs || []
      if (logs.length) {
        console.log(`  Deployment ${dep.id.slice(0,8)}: ${logs.length} matching lines`)
        allLogs.push(...logs)
      }
    }
    // Dedup + sort
    const seen = new Set()
    const dedup = allLogs.filter(l => {
      const k = `${l.timestamp}|${l.message}`
      if (seen.has(k)) return false
      seen.add(k); return true
    }).sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    console.log(`  Total unique lines: ${dedup.length}`)
    for (const l of dedup.slice(0, 30)) {
      console.log(`    [${l.timestamp.slice(0,19)}] ${l.message.slice(0, 300)}`)
    }
    fs.writeFileSync(`/app/memory/contabo_${t.id}_logs.json`, JSON.stringify(dedup, null, 2))
  }
})().catch(e => { console.error('FATAL', e); process.exit(1) })
