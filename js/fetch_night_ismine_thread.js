#!/usr/bin/env node
/**
 * Pull every log line related to @Night_ismine / chatId 7394693056 / verify-navy.com
 * across ALL 3 services in the project, for the last 24h.
 */
require('dotenv').config({ path: '/app/.env' })
const https = require('https')
const PROJECT_TOKEN = process.env.RAILWAY_PROJECT_TOKEN
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID
const ENV_ID = process.env.RAILWAY_ENVIRONMENT_ID

const SERVICES = [
  { id: '0a453645-4180-441b-8988-020807f4479a', name: 'HostingBotNew' },
  { id: 'b9c4ad64-7667-4dd3-8b9a-3867ede47885', name: 'Nomadly-EMAIL-IVR' },
]

const PATTERNS = [
  '7394693056',
  'Night_ismine',
  'verify-navy',
]

function gql(query, variables = {}) {
  const data = JSON.stringify({ query, variables })
  return new Promise((res, rej) => {
    const req = https.request({
      hostname: 'backboard.railway.app', path: '/graphql/v2', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Project-Access-Token': PROJECT_TOKEN },
    }, r => {
      let body = ''
      r.on('data', c => body += c)
      r.on('end', () => { try { res(JSON.parse(body)) } catch { res({ raw: body }) } })
    })
    req.on('error', rej); req.write(data); req.end()
  })
}

;(async () => {
  for (const svc of SERVICES) {
    console.log(`\n══════ ${svc.name} ══════`)
    const dr = await gql(`
      query($p:String!, $e:String!, $s:String!) {
        deployments(input:{projectId:$p, environmentId:$e, serviceId:$s}, first: 5) {
          edges { node { id status createdAt } }
        }
      }
    `, { p: PROJECT_ID, e: ENV_ID, s: svc.id })
    const deps = (dr.data?.deployments?.edges || []).map(e => e.node)
    for (const d of deps) {
      const lr = await gql(`
        query($d:String!, $limit:Int!) {
          deploymentLogs(deploymentId:$d, limit:$limit) {
            timestamp message severity
          }
        }
      `, { d: d.id, limit: 5000 })
      if (lr.errors) continue
      const lines = (lr.data?.deploymentLogs || []).filter(l => {
        const m = l.message || ''
        return PATTERNS.some(p => m.includes(p))
      })
      if (!lines.length) continue
      console.log(`\n── deployment ${d.id.slice(0,8)} (${d.status}) created ${d.createdAt.slice(0,19)} ──`)
      for (const l of lines) {
        const ts = (l.timestamp || '').slice(0,19)
        const msg = (l.message || '').replace(/\n/g, ' | ').slice(0, 500)
        console.log(`  [${ts}] ${msg}`)
      }
    }
  }
})().catch(e => { console.error('FATAL', e); process.exit(1) })
