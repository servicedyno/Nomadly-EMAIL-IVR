#!/usr/bin/env node
/**
 * fetch_railway_all_services.js
 * Fetches env variables for every service in the Railway project so we can
 * identify which service runs the bot vs the scheduler vs IVR.
 */
require('dotenv').config({ path: '/app/.env' })
const https = require('https')
const fs = require('fs')

const PROJECT_TOKEN = process.env.RAILWAY_PROJECT_TOKEN
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID
const ENV_ID = process.env.RAILWAY_ENVIRONMENT_ID

const SERVICES = [
  { id: '0a453645-4180-441b-8988-020807f4479a', name: 'HostingBotNew' },
  { id: '96ee768e-3f4d-49c8-be75-dea30777e890', name: 'LockbayNewFIX' },
  { id: 'b9c4ad64-7667-4dd3-8b9a-3867ede47885', name: 'Nomadly-EMAIL-IVR' },
]

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
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }) }
        catch { resolve({ status: res.statusCode, body }) }
      })
    })
    req.on('error', reject)
    req.write(data); req.end()
  })
}

async function main() {
  const all = {}
  const q = `query Vars($projectId: String!, $environmentId: String!, $serviceId: String!) {
    variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
  }`
  for (const s of SERVICES) {
    const r = await gql(q, { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: s.id })
    if (r.body?.data?.variables) {
      const vars = r.body.data.variables
      all[s.name] = vars
      console.log(`\n=== ${s.name} (${s.id}) — ${Object.keys(vars).length} keys ===`)
      const keysOfInterest = [
        'MONGO_URL','DB_NAME','BOT_ENVIRONMENT','HOSTED_ON','NODE_ENV',
        'TELEGRAM_BOT_ON','TELEGRAM_BOT_TOKEN_PROD','SELF_URL','SELF_URL_PROD',
        'CONTABO_CLIENT_ID','VPS_ENABLED','PHONE_SERVICE_ON','EMAIL_VALIDATION_ON',
        'REST_APIS_ON','SKIP_WEBHOOK_SYNC','PORT'
      ]
      for (const k of keysOfInterest) {
        if (vars[k] !== undefined) {
          const v = String(vars[k])
          const masked = v.length > 60 ? v.slice(0, 35) + '…' + v.slice(-8) : v
          console.log(`  ${k.padEnd(28)} = ${masked}`)
        }
      }
      // Look for scheduler/cron hints
      const procKeys = ['START_COMMAND','RAILWAY_RUN_COMMAND','PROC','APP_PROCESS','APP_TYPE']
      for (const k of procKeys) if (vars[k]) console.log(`  ${k.padEnd(28)} = ${vars[k]}`)
    } else {
      console.log(`\n=== ${s.name} (${s.id}) — ERROR`)
      console.log(JSON.stringify(r.body).slice(0, 500))
    }
  }
  fs.writeFileSync('/app/memory/railway_all_services_env.json', JSON.stringify(all, null, 2))
  console.log(`\nSaved -> /app/memory/railway_all_services_env.json`)
}
main().catch(e => { console.error(e); process.exit(1) })
