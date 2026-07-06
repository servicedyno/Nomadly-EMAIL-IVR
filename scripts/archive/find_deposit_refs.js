/**
 * Properly investigate the two BTC deposits for chatId 7191777173.
 *
 * Pull every Railway log line for the two deposit refs (z02SZ, drKee) to
 * find the actual on-chain transaction_id / txHash. Then we can verify the
 * real BTC amount(s) received against what Mongo recorded.
 */
require('dotenv').config({ path: '/app/.env' })
const https = require('https')
const fs = require('fs')

const TOKEN = process.env.RAILWAY_PROJECT_TOKEN || process.env.API_KEY_RAILWAY
const EID = process.env.RAILWAY_ENVIRONMENT_ID
const SID = process.env.RAILWAY_SERVICE_ID

function gql(q, v) {
  return new Promise((res, rej) => {
    const r = https.request({ hostname: 'backboard.railway.app', path: '/graphql/v2', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Project-Access-Token': TOKEN } },
      (rr) => { let b = ''; rr.on('data', c => b += c); rr.on('end', () => { try { res(JSON.parse(b)) } catch { res({ raw: b }) } }) })
    r.on('error', rej); r.write(JSON.stringify({ query: q, variables: v })); r.end()
  })
}

;(async () => {
  const dr = await gql(`query D($e: String!, $s: String!) {
    deployments(input: { environmentId: $e, serviceId: $s, status: { in: [SUCCESS, REMOVED] } }, first: 30) {
      edges { node { id status createdAt } }
    }
  }`, { e: EID, s: SID })
  const deps = (dr?.data?.deployments?.edges || []).map(e => e.node)

  const refs = ['z02SZ', 'drKee']
  const seen = new Set()
  const all = []
  for (const ref of refs) {
    for (const dep of deps) {
      const r = await gql(
        `query L($d: String!, $f: String, $l: Int) { deploymentLogs(deploymentId: $d, filter: $f, limit: $l) { timestamp message severity } }`,
        { d: dep.id, f: ref, l: 200 }
      )
      for (const l of (r?.data?.deploymentLogs || [])) {
        const k = `${l.timestamp}|${l.message}`
        if (!seen.has(k)) { seen.add(k); all.push(l) }
      }
    }
  }
  all.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  console.log(`=== ${all.length} log lines for refs z02SZ + drKee ===\n`)
  for (const l of all) {
    console.log(`[${l.timestamp.slice(0,19)}] ${l.message.slice(0, 500)}`)
  }
  fs.writeFileSync('/app/memory/7191777173_deposit_refs.json', JSON.stringify(all, null, 2))
})().catch(e => { console.error('FATAL', e); process.exit(1) })
