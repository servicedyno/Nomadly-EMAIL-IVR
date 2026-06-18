/**
 * Find the $15 USDT-TRC20 deposit that slipped past the $20 minimum.
 *
 * Searches Railway for:
 *   - any wallet-topup of $15 (or any sub-$20 USDT-TRC20)
 *   - the timing relative to when the intercept code was deployed
 *     (commit e0805144 → SUCCESS at 2026-06-18 09:11:31 UTC)
 *   - confirmTrc20MinDeposit fire events (if 0 then the intercept may not be live)
 */
require('dotenv').config({ path: '/app/.env' })
const https = require('https')

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
  const deps = (dr?.data?.deployments?.edges || []).map(e => e.node).sort((a,b) => a.createdAt.localeCompare(b.createdAt))
  console.log(`Searching ${deps.length} deployments. Oldest: ${deps[0].createdAt} Newest: ${deps[deps.length-1].createdAt}\n`)

  const seen = new Set()
  const all = []
  // Search by multiple narrow filters
  for (const f of ['trc20_usdt', 'TRC20', '$15', '15.00', 'tickerView', 'depositAmountUsd', 'confirmTrc20MinDeposit', 'wallet-topup', 'showDepositCryptoInfo', 'depositMethodSelect']) {
    for (const dep of deps) {
      const r = await gql(
        `query L($d: String!, $f: String, $l: Int) { deploymentLogs(deploymentId: $d, filter: $f, limit: $l) { timestamp message severity } }`,
        { d: dep.id, f, l: 200 }
      )
      for (const l of (r?.data?.deploymentLogs || [])) {
        const k = `${l.timestamp}|${l.message}`
        if (!seen.has(k)) { seen.add(k); all.push(l) }
      }
    }
  }
  all.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  // The intercept deployed at 2026-06-18 09:11:31 UTC (commit e0805144)
  // The TRC20 min intercept patch + WhyMin button was in commit e0805144

  // 1. Show ALL TRC20-related deposit events
  const trc20Events = all.filter(l => /trc20/i.test(l.message) || /tickerView.*trc20|trc20.*ticker/i.test(l.message))
  console.log(`=== TRC20-mention events (${trc20Events.length}) ===`)
  for (const l of trc20Events.slice(-40)) {
    console.log(`[${l.timestamp.slice(0,19)}] ${l.message.slice(0, 300)}`)
  }

  // 2. Show all "confirmTrc20MinDeposit" fire events
  const intercept = all.filter(l => /confirmTrc20MinDeposit/i.test(l.message))
  console.log(`\n=== confirmTrc20MinDeposit events (${intercept.length}) ===`)
  for (const l of intercept) {
    console.log(`[${l.timestamp.slice(0,19)}] ${l.message.slice(0, 300)}`)
  }

  // 3. Look for $15 wallet-topup specifically
  const fifteen = all.filter(l => /\$15|15 ?USD|15\.00|amount: ?15\b|topup.*15\b|15\b.*topup/i.test(l.message))
  console.log(`\n=== Lines mentioning "$15" (${fifteen.length}) ===`)
  for (const l of fifteen.slice(-30)) {
    console.log(`[${l.timestamp.slice(0,19)}] ${l.message.slice(0, 300)}`)
  }
})().catch(e => { console.error('FATAL', e); process.exit(1) })
