/**
 * Search Railway logs for an AI-support complaint where a user claims to
 * have deposited $60 but received only $30. Pull all related deposit-flow
 * lines for that chatId and reconcile against on-chain receipts.
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
  // get all deployments to widen the search window
  const dr = await gql(`query D($e: String!, $s: String!) {
    deployments(input: { environmentId: $e, serviceId: $s, status: { in: [SUCCESS, REMOVED] } }, first: 25) {
      edges { node { id status createdAt } }
    }
  }`, { e: EID, s: SID })
  const deps = (dr?.data?.deployments?.edges || []).map(e => e.node)
  console.log(`Searching across ${deps.length} deployments`)

  const filters = [
    // direct phrasings the user / AI may have used
    'deposited $60',
    'deposited 60',
    'deposit of $60',
    'sent $60',
    'sent 60',
    'paid $60',
    'I sent 60',
    'I deposited 60',
    'i deposited',
    'i sent',
    'got 30',
    'only got',
    'received 30',
    'only $30',
    'half of',
    'short by',
    'missing $30',
    // AI-support escalation markers
    '[Support] AI ->',
    '[Support]',
    'escalate',
  ]
  const seen = new Set()
  const allHits = []

  for (const f of filters) {
    for (const dep of deps) {
      const r = await gql(
        `query L($d: String!, $f: String, $l: Int) { deploymentLogs(deploymentId: $d, filter: $f, limit: $l) { timestamp message severity } }`,
        { d: dep.id, f, l: 200 }
      )
      const logs = r?.data?.deploymentLogs || []
      for (const l of logs) {
        const k = `${l.timestamp}|${l.message}`
        if (seen.has(k)) continue
        seen.add(k)
        allHits.push(l)
      }
    }
  }
  allHits.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  // Filter to lines that mention amount keywords AND look like a deposit complaint
  const interesting = allHits.filter(l => {
    const m = l.message
    return /60|\$60/.test(m) && /deposit|sent|paid|wallet|short|half|got/i.test(m)
  })

  console.log(`\n=== Lines mentioning "60" near deposit keywords (${interesting.length}) ===`)
  for (const l of interesting.slice(-60)) {
    console.log(`[${l.timestamp.slice(0,19)}] ${l.message.slice(0, 350)}`)
  }

  // Also dump all [Support] lines as a fallback
  const support = allHits.filter(l => /\[Support\]/.test(l.message))
  console.log(`\n=== [Support] lines total: ${support.length} (showing last 50) ===`)
  for (const l of support.slice(-50)) {
    console.log(`[${l.timestamp.slice(0,19)}] ${l.message.slice(0, 280)}`)
  }

  fs.writeFileSync('/app/memory/deposit_60_30_complaint_logs.json', JSON.stringify({ interesting, support }, null, 2))
})().catch(e => { console.error('FATAL', e); process.exit(1) })
