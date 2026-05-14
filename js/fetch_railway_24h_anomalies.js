#!/usr/bin/env node
/**
 * fetch_railway_24h_anomalies.js
 *
 * For each Railway service in the project:
 *   1. List deployments in the last 24h
 *   2. Pull logs for each (capped to keep response small)
 *   3. Classify lines into anomalies vs user-activity
 *   4. Print a focused report + persist raw JSON to /app/memory/
 *
 * Uses RAILWAY_PROJECT_TOKEN from /app/.env (already verified to work).
 */

require('dotenv').config({ path: '/app/.env' })
const https = require('https')
const fs = require('fs')
const path = require('path')

const PROJECT_TOKEN = process.env.RAILWAY_PROJECT_TOKEN
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID
const ENV_ID = process.env.RAILWAY_ENVIRONMENT_ID

if (!PROJECT_TOKEN || !PROJECT_ID || !ENV_ID) {
  console.error('Missing RAILWAY_PROJECT_TOKEN / RAILWAY_PROJECT_ID / RAILWAY_ENVIRONMENT_ID')
  process.exit(1)
}

const SERVICES = [
  { id: '0a453645-4180-441b-8988-020807f4479a', name: 'HostingBotNew' },
  { id: '96ee768e-3f4d-49c8-be75-dea30777e890', name: 'LockbayNewFIX' },
  { id: 'b9c4ad64-7667-4dd3-8b9a-3867ede47885', name: 'Nomadly-EMAIL-IVR' },
]

const NOW = new Date()
const CUTOFF_24H = new Date(NOW.getTime() - 24 * 60 * 60 * 1000)

function gql(query, variables = {}) {
  const data = JSON.stringify({ query, variables })
  const opts = {
    hostname: 'backboard.railway.app',
    path: '/graphql/v2',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'Project-Access-Token': PROJECT_TOKEN,
    },
  }
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => {
        try { resolve(JSON.parse(body)) } catch { resolve({ raw: body }) }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

const Q_DEPLOYMENTS = `
  query($p:String!, $e:String!, $s:String!) {
    deployments(input:{projectId:$p, environmentId:$e, serviceId:$s}, first: 20) {
      edges { node { id status createdAt staticUrl meta canRedeploy } }
    }
  }
`

const Q_DEPLOY_LOGS = `
  query($d:String!, $limit:Int!) {
    deploymentLogs(deploymentId:$d, limit:$limit) {
      timestamp message severity
    }
  }
`

// ─── Classification ──────────────────────────────────────────────
const SEVERE_KEYWORDS = [
  'error:', 'exception', 'traceback', 'unhandled', 'unhandledrejection',
  'unhandled promise', 'fatal', 'segfault', 'critical',
  'econnrefused', 'etimedout', 'enotfound', 'eaddrinuse',
  'typeerror', 'referenceerror', 'syntaxerror', 'rangeerror',
  '🚨', 'crash', 'cancel failed', 'refund failed',
]

const USER_TAGS = [
  'chatid=', 'chatid:', 'user:', 'user @', 'from @',
  '[hosting]', '[hostingupgrade]', '[upgrade]', '[renew]',
  '[purchase]', '[checkout]', '[payment]', '[wallet]',
  '[domain]', '[cpanel]', '[whm]', '[antired]', '[ivr]',
  '[voice]', '[sms]', '[bulk', '[winback]', '[loyalty]',
  '[fincra', '[telnyx', '[twilio', '[stripe',
]

function classify(line) {
  const msg = (line.message || '').toLowerCase()
  const sev = (line.severity || '').toUpperCase()
  const isSevere = sev === 'ERROR' || sev === 'CRITICAL' || sev === 'FATAL' ||
    SEVERE_KEYWORDS.some((k) => msg.includes(k))
  const isWarn = sev === 'WARN' || sev === 'WARNING'
  const isUserActivity = USER_TAGS.some((t) => msg.includes(t))
  return { isSevere, isWarn, isUserActivity }
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  const fullReport = {
    generatedAt: NOW.toISOString(),
    cutoff: CUTOFF_24H.toISOString(),
    services: [],
  }

  for (const svc of SERVICES) {
    process.stdout.write(`\n══════════════════════════════════════════════════════\n`)
    process.stdout.write(`  Service: ${svc.name}  (id ${svc.id.slice(0, 8)}…)\n`)
    process.stdout.write(`══════════════════════════════════════════════════════\n`)

    const dr = await gql(Q_DEPLOYMENTS, { p: PROJECT_ID, e: ENV_ID, s: svc.id })
    if (dr.errors) {
      console.log('  GQL errors:', JSON.stringify(dr.errors, null, 2))
      continue
    }
    const edges = (dr.data?.deployments?.edges) || []
    const last24 = edges.map((e) => e.node).filter((n) => new Date(n.createdAt) >= CUTOFF_24H)

    console.log(`  Deployments in last 24h: ${last24.length} (total fetched: ${edges.length})`)
    for (const d of last24) {
      console.log(`    • ${d.createdAt.slice(0, 19)}  status=${d.status.padEnd(10)}  id=${d.id.slice(0, 8)}…`)
    }
    if (!last24.length) {
      console.log('  ℹ️  No deployments in the last 24h — fetching logs from the most recent deployment instead')
    }

    // Decide what to pull logs for: if we have last-24h deployments, those; else
    // the single most-recent deployment so we still see runtime activity for the period.
    const targets = last24.length ? last24 : (edges[0] ? [edges[0].node] : [])
    if (!targets.length) {
      fullReport.services.push({ ...svc, deployments: [], anomalies: [], userActivity: [] })
      continue
    }

    const allLogs = []
    for (const t of targets) {
      const lr = await gql(Q_DEPLOY_LOGS, { d: t.id, limit: 1500 })
      if (lr.errors) {
        console.log(`    ⚠️  Log fetch errors for ${t.id.slice(0, 8)}:`, JSON.stringify(lr.errors))
        continue
      }
      const lines = (lr.data?.deploymentLogs) || []
      for (const l of lines) allLogs.push({ ...l, deploymentId: t.id })
    }

    // Keep only logs whose timestamps fall in the last 24h (sometimes the
    // deployment was created earlier but is still emitting current logs)
    const recent = allLogs.filter((l) => {
      const t = new Date(l.timestamp || 0).getTime()
      return t >= CUTOFF_24H.getTime() && t <= NOW.getTime() + 60 * 1000
    })

    console.log(`  Log lines pulled: ${allLogs.length}  (in last 24h: ${recent.length})`)

    // Classify
    const anomalies = []
    const userActivity = []
    for (const l of recent) {
      const { isSevere, isWarn, isUserActivity } = classify(l)
      if (isSevere) anomalies.push({ ...l, _kind: 'severe' })
      else if (isWarn) anomalies.push({ ...l, _kind: 'warn' })
      if (isUserActivity) userActivity.push(l)
    }

    console.log(`\n  ─── Anomalies (severe + warn): ${anomalies.length}`)
    // Group by message-prefix for noise reduction
    const groups = new Map()
    for (const a of anomalies) {
      const msg = (a.message || '').replace(/\s+/g, ' ').trim()
      // Strip timestamps / numeric ids to group similar errors
      const key = msg.slice(0, 140).replace(/\b[0-9a-f]{8,}\b/g, '<id>').replace(/\d+/g, '<n>').slice(0, 120)
      if (!groups.has(key)) groups.set(key, { count: 0, first: a, severity: a.severity, kind: a._kind, examples: [] })
      const g = groups.get(key)
      g.count += 1
      if (g.examples.length < 3) g.examples.push(a)
    }
    const sortedGroups = [...groups.entries()].sort((a, b) => b[1].count - a[1].count)
    for (const [, g] of sortedGroups.slice(0, 25)) {
      const sample = (g.first.message || '').replace(/\n/g, ' ').slice(0, 240)
      console.log(`    [${(g.severity || g.kind || '').padEnd(7)}] (×${g.count})  ${sample}`)
    }
    if (sortedGroups.length > 25) console.log(`    … +${sortedGroups.length - 25} more distinct groups`)

    // Extract unique chatIds from user activity
    const chatIds = new Set()
    for (const l of userActivity) {
      const msg = l.message || ''
      // chatId patterns: "chatId 12345" "(12345)" "chatId=12345" "for 12345"
      const ms = msg.match(/\b\d{6,12}\b/g) || []
      for (const m of ms) chatIds.add(m)
    }
    console.log(`\n  ─── User-tagged events: ${userActivity.length}  (distinct chatIds: ${chatIds.size})`)
    // Print top 10 user-event examples
    for (const l of userActivity.slice(-15)) {
      const ts = (l.timestamp || '').slice(0, 19)
      const msg = (l.message || '').replace(/\n/g, ' ').slice(0, 200)
      console.log(`    [${ts}] ${msg}`)
    }

    fullReport.services.push({
      ...svc,
      deployments: targets.map((t) => ({ id: t.id, status: t.status, createdAt: t.createdAt })),
      logsInLast24h: recent.length,
      anomalyCount: anomalies.length,
      uniqueChatIds: [...chatIds],
      anomalyGroups: sortedGroups.slice(0, 25).map(([, g]) => ({
        severity: g.severity, kind: g.kind, count: g.count,
        sample: (g.first.message || '').slice(0, 500),
      })),
      // Cap user activity to keep file small
      userActivityTail: userActivity.slice(-100).map((l) => ({
        timestamp: l.timestamp, severity: l.severity, message: l.message,
      })),
    })
  }

  // Persist
  const outFile = path.join('/app/memory', `railway_24h_anomalies_${NOW.toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(outFile, JSON.stringify(fullReport, null, 2))
  console.log(`\n📝 Full report: ${outFile}`)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
