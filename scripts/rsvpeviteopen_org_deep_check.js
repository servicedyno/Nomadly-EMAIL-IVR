/**
 * Deep state check for rsvpeviteopen.org after hosting-panel link.
 * Inspects:
 *   - Live DNS resolution (NS, A/CNAME records via Google DoH)
 *   - Cloudflare zone state + DNS records + WAF rules + SSL mode
 *   - OpenProvider current NS + status
 *   - MongoDB: domainsOf, registeredDomains, hostOf, cpanelAccounts (any link)
 *   - antiRed/captcha settings if present
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const { MongoClient } = require('mongodb')
const cfService = require('/app/js/cf-service.js')
const opService = require('/app/js/op-service.js')

const DOMAIN = 'rsvpeviteopen.org'
const CHAT_ID = '1960615421'
const CF_ZONE_ID = '2047e30143fb8c792301fcd4a5d340b6'

const CF_BASE_URL = 'https://api.cloudflare.com/client/v4'
const cfHeaders = () => ({
  'X-Auth-Email': process.env.CLOUDFLARE_EMAIL,
  'X-Auth-Key': process.env.CLOUDFLARE_API_KEY,
  'Content-Type': 'application/json',
})

async function dohResolve(name, type) {
  try {
    const res = await axios.get(`https://dns.google/resolve`, {
      params: { name, type }, timeout: 10000,
    })
    return res.data?.Answer?.map(a => `${a.type}/${a.TTL}s ${a.data}`) || res.data?.Authority?.map(a => `AUTHORITY ${a.data}`) || []
  } catch (e) {
    return [`error: ${e.message}`]
  }
}

;(async () => {
  console.log(`\n=== ${DOMAIN} deep state check ===\n`)

  // 1. Live DNS lookups from outside
  console.log('--- Live DNS (Google DoH) ---')
  for (const type of ['NS', 'A', 'CNAME', 'SOA']) {
    const ans = await dohResolve(DOMAIN, type)
    console.log(`  ${DOMAIN} ${type}: ${ans.join(' | ') || '(none)'}`)
  }
  for (const sub of ['www.', 'mail.', 'cpanel.', 'webmail.']) {
    const ans = await dohResolve(`${sub}${DOMAIN}`, 'A')
    const c = await dohResolve(`${sub}${DOMAIN}`, 'CNAME')
    console.log(`  ${sub}${DOMAIN} A: ${ans.join(' | ') || '(none)'} | CNAME: ${c.join(' | ') || '(none)'}`)
  }

  // 2. Cloudflare zone state
  console.log('\n--- Cloudflare zone ---')
  const zone = await cfService.getZoneByName(DOMAIN)
  if (!zone) {
    console.log('  ZONE NOT FOUND')
  } else {
    console.log(`  id: ${zone.id}`)
    console.log(`  status: ${zone.status}`)
    console.log(`  paused: ${zone.paused}`)
    console.log(`  name_servers: ${zone.name_servers.join(', ')}`)
    console.log(`  original_name_servers: ${(zone.original_name_servers || []).join(', ')}`)
    console.log(`  activated_on: ${zone.activated_on}`)
    console.log(`  plan: ${zone.plan?.legacy_id || zone.plan?.name}`)
  }

  // 3. CF DNS records
  console.log('\n--- Cloudflare DNS records ---')
  const records = await cfService.listDNSRecords(CF_ZONE_ID)
  for (const r of records) {
    console.log(`  ${r.type.padEnd(5)} ${(r.name || '').padEnd(40)} → ${r.content}${r.proxied ? ' [proxied]' : ' [dns-only]'} ttl=${r.ttl}`)
  }
  console.log(`  total: ${records.length}`)

  // 4. CF SSL + HTTPS settings
  console.log('\n--- Cloudflare SSL/security settings ---')
  for (const key of ['ssl', 'always_use_https', 'automatic_https_rewrites', 'security_level', 'browser_check', 'challenge_ttl']) {
    try {
      const res = await axios.get(`${CF_BASE_URL}/zones/${CF_ZONE_ID}/settings/${key}`, { headers: cfHeaders(), timeout: 8000 })
      console.log(`  ${key}: ${JSON.stringify(res.data?.result?.value)}`)
    } catch (e) {
      console.log(`  ${key}: error ${e.response?.status}`)
    }
  }

  // 5. CF firewall / WAF rules
  console.log('\n--- Cloudflare firewall rules ---')
  try {
    const res = await axios.get(`${CF_BASE_URL}/zones/${CF_ZONE_ID}/firewall/rules`, { headers: cfHeaders(), timeout: 10000 })
    const rules = res.data?.result || []
    console.log(`  ${rules.length} rule(s)`)
    for (const rl of rules) {
      console.log(`    - "${rl.description}" action=${rl.action} enabled=${!rl.paused}`)
    }
  } catch (e) {
    console.log(`  error: ${e.message}`)
  }

  // 6. CF Page Rules
  console.log('\n--- Cloudflare page rules ---')
  try {
    const res = await axios.get(`${CF_BASE_URL}/zones/${CF_ZONE_ID}/pagerules`, { headers: cfHeaders(), timeout: 10000 })
    const rules = res.data?.result || []
    console.log(`  ${rules.length} rule(s)`)
    for (const rl of rules) {
      console.log(`    - status=${rl.status} actions=${rl.actions?.map(a=>a.id).join(',')}`)
    }
  } catch (e) {
    console.log(`  error: ${e.message}`)
  }

  // 7. OpenProvider state
  console.log('\n--- OpenProvider state ---')
  try {
    const opInfo = await opService.getDomainInfo(DOMAIN)
    if (opInfo) {
      console.log(`  domainId: ${opInfo.domainId}`)
      console.log(`  status: ${opInfo.status}`)
      console.log(`  nameservers: ${JSON.stringify((opInfo.domainData?.name_servers || []).map(n => n.name))}`)
      console.log(`  is_dnssec_enabled: ${opInfo.domainData?.is_dnssec_enabled}`)
      console.log(`  expiresAt: ${opInfo.expiresAt}`)
    } else {
      console.log('  not found at OP')
    }
  } catch (e) {
    console.log(`  error: ${e.message}`)
  }

  // 8. MongoDB state — full
  console.log('\n--- MongoDB state ---')
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  console.log('\n  domainsOf:')
  const dof = await db.collection('domainsOf').findOne({ domainName: DOMAIN })
  console.log('   ', JSON.stringify(dof, null, 4))

  console.log('\n  registeredDomains:')
  const reg = await db.collection('registeredDomains').findOne({ _id: DOMAIN })
  console.log('   ', JSON.stringify(reg, null, 4))

  console.log('\n  hostOf (hosting linkage):')
  const host = await db.collection('hostOf').findOne({ domain: DOMAIN })
  console.log('   ', JSON.stringify(host, null, 4))
  const hostByChat = await db.collection('hostOf').findOne({ chatId: CHAT_ID, domain: DOMAIN })
  if (hostByChat && hostByChat._id !== host?._id) console.log('   alt by chatId:', JSON.stringify(hostByChat, null, 4))

  console.log('\n  cpanelAccounts referencing this domain:')
  const cps = await db.collection('cpanelAccounts').find({ $or: [{ domain: DOMAIN }, { 'val.domain': DOMAIN }, { addonDomains: DOMAIN }] }).toArray()
  console.log(`   found ${cps.length}`)
  for (const cp of cps) console.log('    ', JSON.stringify({ _id: cp._id, chatId: cp.chatId, domain: cp.domain || cp.val?.domain, plan: cp.plan || cp.val?.plan, status: cp.status || cp.val?.status, addonDomains: cp.addonDomains || cp.val?.addonDomains, deleted: cp.deleted, suspended: cp.suspended }, null, 4))

  console.log('\n  AntiRed / captcha protection records:')
  const ar = await db.collection('antiRedDomains').findOne({ $or: [{ domain: DOMAIN }, { _id: DOMAIN }] })
  console.log('   ', JSON.stringify(ar, null, 4))
  const cap = await db.collection('captchaSettings').findOne({ $or: [{ domain: DOMAIN }, { _id: DOMAIN }] }).catch(() => null)
  console.log('  captchaSettings:', JSON.stringify(cap, null, 4))

  // List relevant collections
  const cols = await db.listCollections({}, { nameOnly: true }).toArray()
  const relCols = cols.map(c => c.name).filter(n => /captcha|antired|cloudflare|firewall|protect/i.test(n))
  console.log('  Potentially relevant collections:', relCols)

  // Recent user state
  console.log('\n  user state[1960615421]:')
  const state = await db.collection('state').findOne({ _id: CHAT_ID })
  const v = state?.val || state
  if (v) {
    console.log('   ', JSON.stringify({
      action: v.action,
      lastUpdated: v.lastUpdated,
      lastMessageAt: v.lastMessageAt,
      domainName: v.domainName,
      info: v.info,
      hostingPlan: v.hostingPlan,
      cpUser: v.cpUser,
      domain: v.domain,
      addonDomain: v.addonDomain,
    }, null, 4))
  }

  await client.close()
})().catch(e => { console.error('Fatal:', e); process.exit(1) })
