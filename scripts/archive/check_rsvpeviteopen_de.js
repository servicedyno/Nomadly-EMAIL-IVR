require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const cfService = require('/app/js/cf-service.js')
const opService = require('/app/js/op-service.js')

const DOMAIN = 'rsvpeviteopen.de'
const CHAT_ID = '1960615421'

;(async () => {
  console.log(`\n=== ${DOMAIN} deep state check ===\n`)
  // 1. CF zone state
  console.log('--- Cloudflare zone ---')
  const zone = await cfService.getZoneByName(DOMAIN)
  if (!zone) console.log('  ZONE NOT FOUND in CF')
  else console.log(`  id=${zone.id} status=${zone.status} ns=${zone.name_servers.join(', ')} orig=${(zone.original_name_servers||[]).join(', ')}`)

  // 2. CF DNS records (if zone exists)
  if (zone) {
    const records = await cfService.listDNSRecords(zone.id)
    console.log(`\n--- CF DNS records (${records.length}) ---`)
    for (const r of records) console.log(`  ${r.type.padEnd(5)} ${(r.name || '').padEnd(40)} → ${r.content} ${r.proxied?'[proxied]':'[dns-only]'}`)
  }

  // 3. OpenProvider state
  console.log('\n--- OpenProvider state ---')
  try {
    const opInfo = await opService.getDomainInfo(DOMAIN)
    if (opInfo) {
      console.log(`  domainId=${opInfo.domainId} status=${opInfo.status}`)
      console.log(`  nameservers=${JSON.stringify((opInfo.domainData?.name_servers || []).map(n => n.name))}`)
      console.log(`  is_dnssec_enabled=${opInfo.domainData?.is_dnssec_enabled}`)
      console.log(`  expiresAt=${opInfo.expiresAt}`)
    } else {
      console.log('  not found at OP')
    }
  } catch (e) {
    console.log(`  error: ${e.message}`)
  }

  // 4. MongoDB
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  console.log('\n--- MongoDB ---')
  const dof = await db.collection('domainsOf').findOne({ domainName: DOMAIN })
  console.log('domainsOf:', JSON.stringify(dof, null, 2))
  const reg = await db.collection('registeredDomains').findOne({ _id: DOMAIN })
  console.log('registeredDomains:', JSON.stringify(reg, null, 2))
  const cp = await db.collection('cpanelAccounts').findOne({ $or: [{ domain: DOMAIN }, { 'val.domain': DOMAIN }] })
  console.log('cpanelAccount:', JSON.stringify({ _id: cp?._id, domain: cp?.domain, addonDomains: cp?.addonDomains, plan: cp?.plan, chatId: cp?.chatId }, null, 2))

  await client.close()
})().catch(e => { console.error(e); process.exit(1) })
