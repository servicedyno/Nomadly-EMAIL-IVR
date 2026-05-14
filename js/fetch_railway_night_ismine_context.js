#!/usr/bin/env node
/**
 * Fetch raw deployment logs for Nomadly-EMAIL-IVR around the @Night_ismine
 * event and dump ALL adjacent context lines (no severity filtering).
 */
require('dotenv').config({ path: '/app/.env' })
const https = require('https')
const PROJECT_TOKEN = process.env.RAILWAY_PROJECT_TOKEN
const SERVICE_ID = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885'

function gql(query, variables = {}) {
  const data = JSON.stringify({ query, variables })
  return new Promise((res, rej) => {
    const req = https.request({
      hostname: 'backboard.railway.app', path: '/graphql/v2', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Project-Access-Token': PROJECT_TOKEN,
      },
    }, r => {
      let body = ''
      r.on('data', c => body += c)
      r.on('end', () => { try { res(JSON.parse(body)) } catch { res({ raw: body }) } })
    })
    req.on('error', rej); req.write(data); req.end()
  })
}

;(async () => {
  // The successful 13:27 deployment runs the bot; the prior 13:13 / 12:56 are the REMOVED ones.
  // The user event at 13:02:51 happened on deployment ec16130d (12:56 → REMOVED at 13:13).
  // Look at all 3 deployments and grep for Night_ismine + the lines immediately before/after.
  const DEPLOYS = [
    { id: 'ec16130d-247e-4a9a-95e2-76c885590b24', label: 'REMOVED@12:56' },
    { id: '860e37ee-756e-4eac-baea-274c8fdae55e', label: 'REMOVED@13:13' },
    { id: 'ed9e5c94-0f22-465b-9ed1-31c47a0f7edd', label: 'SUCCESS@13:27' },
  ]
  for (const dep of DEPLOYS) {
    process.stdout.write(`\n══ ${dep.label} (${dep.id.slice(0,8)}) ══\n`)
    const r = await gql(`
      query($d:String!, $limit:Int!) {
        deploymentLogs(deploymentId:$d, limit:$limit) {
          timestamp message severity
        }
      }
    `, { d: dep.id, limit: 3000 })
    if (r.errors) { console.log(' errors:', JSON.stringify(r.errors)); continue }
    const lines = r.data?.deploymentLogs || []
    console.log(` total lines: ${lines.length}`)
    // Find Night_ismine and print neighbors
    const idx = lines.findIndex(l => (l.message||'').includes('Night_ismine'))
    if (idx >= 0) {
      console.log(` ── Night_ismine context (idx ${idx}) ──`)
      for (let i = Math.max(0,idx-12); i <= Math.min(lines.length-1,idx+12); i++) {
        const l = lines[i]
        const marker = i === idx ? '★' : ' '
        console.log(` ${marker} [${(l.timestamp||'').slice(0,19)}] ${(l.message||'').replace(/\n/g,' | ').slice(0,280)}`)
      }
    }
    // Find all 🚨 / Admin / Hosting Upgrade / Plan / @username mentions
    console.log(` ── All admin alerts / user-triggered events ──`)
    for (const l of lines) {
      const m = l.message || ''
      if (/🚨|⬆️|@Night_ismine|@\w+|Hosting Upgrade|Plan upgraded|HostingRenew|Refund|wallet|deposit|payment received|payment failed/i.test(m)) {
        const ts = (l.timestamp || '').slice(0,19)
        console.log(` [${ts}] ${m.replace(/\n/g,' | ').slice(0,300)}`)
      }
    }
  }
})().catch(e => { console.error('FATAL', e); process.exit(1) })
