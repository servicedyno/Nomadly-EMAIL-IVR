#!/usr/bin/env node
/**
 * Targeted search for a specific chatId / username across all Railway services.
 * Pulls multiple recent deployments and greps the logs.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const https = require('https')
const fs = require('fs')

const PROJECT_TOKEN = process.env.RAILWAY_PROJECT_TOKEN
const ACCOUNT_TOKEN = process.env.API_KEY_RAILWAY
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID || '4f01d2a9-13fb-4321-b6d8-c1f4d5fc7e60'
const ENV_ID = process.env.RAILWAY_ENVIRONMENT_ID || 'b9c87cda-ad3a-4d8e-add5-2a83bc4af3ad'

const TARGET_CHAT_ID = process.argv[2] || '6996287179'
const EXTRA_PATTERNS = (process.argv[3] || 'spoofed,VPS,vps,RDP,password,Contabo,contabo,vmInstanceSetup,vpsBoughtSuccess').split(',')

const SERVICES = [
  { id: '0a453645-4180-441b-8988-020807f4479a', name: 'HostingBotNew' },
  { id: '96ee768e-3f4d-49c8-be75-dea30777e890', name: 'LockbayNewFIX' },
  { id: 'b9c4ad64-7667-4dd3-8b9a-3867ede47885', name: 'Nomadly-EMAIL-IVR' },
]

const NUM_DEPLOYMENTS_TO_SEARCH = 8
const LOG_LIMIT_PER_DEPLOY = 5000

function gql(query, variables = {}) {
  const data = JSON.stringify({ query, variables })
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  }
  if (PROJECT_TOKEN) headers['Project-Access-Token'] = PROJECT_TOKEN
  else if (ACCOUNT_TOKEN) headers.Authorization = `Bearer ${ACCOUNT_TOKEN}`
  const opts = {
    hostname: 'backboard.railway.app',
    path: '/graphql/v2',
    method: 'POST',
    headers,
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
      edges { node { id status createdAt } }
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

async function main() {
  console.log(`\n=== Searching Railway for chatId=${TARGET_CHAT_ID} and patterns: ${EXTRA_PATTERNS.join(',')} ===\n`)
  const allHits = []

  for (const svc of SERVICES) {
    console.log(`\n--- ${svc.name} ---`)
    const dr = await gql(Q_DEPLOYMENTS, { p: PROJECT_ID, e: ENV_ID, s: svc.id })
    const edges = (dr.data?.deployments?.edges) || []
    const targets = edges.slice(0, NUM_DEPLOYMENTS_TO_SEARCH).map((e) => e.node)
    console.log(`  searching ${targets.length} deployments...`)

    for (const t of targets) {
      const lr = await gql(Q_DEPLOY_LOGS, { d: t.id, limit: LOG_LIMIT_PER_DEPLOY })
      if (lr.errors) { console.log(`    ⚠️ ${t.id.slice(0, 8)}: ${JSON.stringify(lr.errors).slice(0, 200)}`); continue }
      const lines = (lr.data?.deploymentLogs) || []
      const matched = lines.filter((l) => {
        const m = l.message || ''
        if (m.includes(TARGET_CHAT_ID)) return true
        const low = m.toLowerCase()
        for (const p of EXTRA_PATTERNS) {
          if (p && low.includes(p.toLowerCase())) {
            // require chatId-like co-occurrence for "VPS"/"password" generic patterns to reduce noise
            if (/\bpassword\b/i.test(p) || /^vps$/i.test(p)) {
              if (m.includes(TARGET_CHAT_ID) || /\b6996\d+\b/.test(m)) return true
              continue
            }
            return true
          }
        }
        return false
      })
      if (matched.length) {
        console.log(`    deploy ${t.id.slice(0, 8)} (${t.status} ${t.createdAt.slice(0, 19)}): ${matched.length} matched lines`)
        for (const l of matched.slice(0, 40)) {
          const ts = (l.timestamp || '').slice(0, 19)
          const msg = (l.message || '').replace(/\n/g, ' ').slice(0, 320)
          console.log(`      [${ts}] [${l.severity || ''}] ${msg}`)
        }
        for (const l of matched) {
          allHits.push({ service: svc.name, deployId: t.id, ...l })
        }
      }
    }
  }

  const outFile = `/app/memory/railway_search_${TARGET_CHAT_ID}_${Date.now()}.json`
  fs.writeFileSync(outFile, JSON.stringify(allHits, null, 2))
  console.log(`\n📝 ${allHits.length} hits saved to ${outFile}`)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
