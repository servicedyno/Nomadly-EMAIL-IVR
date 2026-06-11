/**
 * Compare CF state of rsvpeviteopen.de (primary, working) vs .org (broken addon).
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const { MongoClient } = require('mongodb')

const CF_BASE_URL = 'https://api.cloudflare.com/client/v4'
const cfHeaders = () => ({
  'X-Auth-Email': process.env.CLOUDFLARE_EMAIL,
  'X-Auth-Key': process.env.CLOUDFLARE_API_KEY,
  'Content-Type': 'application/json',
})

const ZONES = {
  'rsvpeviteopen.de':  '5313ddc5042a9e1b1dde373202ec1e05',
  'rsvpeviteopen.org': '2047e30143fb8c792301fcd4a5d340b6',
}

async function dumpZone(label, id) {
  console.log(`\n========== ${label} (${id}) ==========`)

  // DNS records
  console.log('--- DNS records ---')
  const dns = await axios.get(`${CF_BASE_URL}/zones/${id}/dns_records`, { headers: cfHeaders(), timeout: 10000 })
  for (const r of dns.data?.result || []) {
    console.log(`  ${r.type.padEnd(5)} ${(r.name || '').padEnd(45)} → ${r.content}${r.proxied ? ' [proxied]' : ''}`)
  }
  console.log(`  total: ${(dns.data?.result || []).length}`)

  // Security settings
  console.log('--- security settings ---')
  for (const key of ['ssl', 'always_use_https', 'security_level', 'browser_check', 'challenge_ttl', 'waf', 'hotlink_protection', 'email_obfuscation']) {
    try {
      const r = await axios.get(`${CF_BASE_URL}/zones/${id}/settings/${key}`, { headers: cfHeaders(), timeout: 8000 })
      console.log(`  ${key}: ${JSON.stringify(r.data?.result?.value)}`)
    } catch (e) {}
  }

  // Firewall rules
  console.log('--- firewall rules ---')
  try {
    const r = await axios.get(`${CF_BASE_URL}/zones/${id}/firewall/rules`, { headers: cfHeaders(), timeout: 10000 })
    for (const rl of (r.data?.result || [])) {
      console.log(`  - "${rl.description}" action=${rl.action} priority=${rl.priority} paused=${rl.paused}`)
      console.log(`    filter: ${rl.filter?.expression?.slice(0, 200)}`)
    }
    console.log(`  total: ${(r.data?.result || []).length}`)
  } catch (e) {
    console.log(`  err: ${e.message}`)
  }

  // Worker routes — anti-red typically uses a Worker that issues the captcha
  console.log('--- worker routes ---')
  try {
    const r = await axios.get(`${CF_BASE_URL}/zones/${id}/workers/routes`, { headers: cfHeaders(), timeout: 10000 })
    for (const rt of (r.data?.result || [])) {
      console.log(`  - pattern: ${rt.pattern} script=${rt.script || rt.service}`)
    }
    console.log(`  total: ${(r.data?.result || []).length}`)
  } catch (e) {
    console.log(`  err: ${e.message}`)
  }

  // Page rules
  console.log('--- page rules ---')
  try {
    const r = await axios.get(`${CF_BASE_URL}/zones/${id}/pagerules`, { headers: cfHeaders(), timeout: 10000 })
    for (const rl of (r.data?.result || [])) {
      console.log(`  - status=${rl.status} priority=${rl.priority} actions=${rl.actions?.map(a=>a.id).join(',')}`)
      console.log(`    targets: ${JSON.stringify(rl.targets?.map(t => t.constraint?.value))}`)
    }
    console.log(`  total: ${(r.data?.result || []).length}`)
  } catch (e) {
    console.log(`  err: ${e.message}`)
  }
}

;(async () => {
  for (const [n, id] of Object.entries(ZONES)) await dumpZone(n, id)

  // Compare addonDomains lifecycle in cpanelAccounts
  console.log('\n========== cpanelAccount rsvp1d0f ==========')
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const cp = await db.collection('cpanelAccounts').findOne({ _id: 'rsvp1d0f' })
  console.log(JSON.stringify(cp, null, 2))
  await client.close()
})().catch(e => { console.error('Fatal:', e); process.exit(1) })
