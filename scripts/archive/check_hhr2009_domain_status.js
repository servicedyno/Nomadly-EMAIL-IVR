// Check whether paperlesseviteguestreview.com is actually registered at
// OpenProvider or ConnectReseller (i.e. registration succeeded on registrar
// side but our DB write may have failed), OR whether it's genuinely
// unregistered.
require('dotenv').config({ path: '/app/backend/.env' })
const DOMAIN = 'paperlesseviteguestreview.com'

;(async () => {
  console.log(`=== Checking ${DOMAIN} across registrars ===\n`)

  // 1) OpenProvider
  console.log('── OpenProvider ──')
  try {
    const op = require('/app/js/op-service.js')
    const info = await op.getDomainInfo(DOMAIN)
    if (info) {
      console.log(JSON.stringify(info, null, 2))
    } else {
      console.log('  Not found in OpenProvider')
    }
  } catch (e) {
    console.log('  Error:', e.message)
  }

  // 2) ConnectReseller
  console.log('\n── ConnectReseller ──')
  try {
    const cr = require('/app/js/cr-service.js')
    if (cr.getDomainInfo) {
      const info = await cr.getDomainInfo(DOMAIN)
      console.log(info ? JSON.stringify(info, null, 2) : '  Not found in CR')
    } else if (cr.getDomainDetails) {
      const info = await cr.getDomainDetails(DOMAIN)
      console.log(info ? JSON.stringify(info, null, 2) : '  Not found in CR')
    } else {
      // fallback: WHOIS-style check via public DNS
      console.log('  cr-service has no getDomainInfo — trying isDomainAvailable / whois fallback')
    }
  } catch (e) {
    console.log('  Error:', e.message)
  }

  // 3) Public WHOIS via dns (does the domain resolve? does it have any NS in DNS?)
  console.log('\n── Public DNS check ──')
  try {
    const dns = require('dns').promises
    try {
      const ns = await dns.resolveNs(DOMAIN)
      console.log('  NS records:', ns)
    } catch (e) { console.log('  NS lookup:', e.code || e.message) }
    try {
      const a = await dns.resolve4(DOMAIN)
      console.log('  A records:', a)
    } catch (e) { console.log('  A lookup:', e.code || e.message) }
    try {
      const soa = await dns.resolveSoa(DOMAIN)
      console.log('  SOA:', soa)
    } catch (e) { console.log('  SOA lookup:', e.code || e.message) }
  } catch (e) { console.log('  DNS error:', e.message) }

  // 4) Cloudflare zone check — DID we successfully create a CF zone for this
  //    domain during the failed purchase (10:52 UTC yesterday)?
  console.log('\n── Cloudflare zone ──')
  try {
    const cf = require('/app/js/cf-service.js')
    const zone = await cf.getZoneByName(DOMAIN)
    if (zone) {
      console.log('  zoneId:', zone.id)
      console.log('  status:', zone.status)
      console.log('  name_servers:', zone.name_servers)
      console.log('  created_on:', zone.created_on)
      console.log('  activated_on:', zone.activated_on)
    } else {
      console.log('  No CF zone found')
    }
  } catch (e) {
    console.log('  Error:', e.message)
  }

  // 5) OpenProvider available check via ?operation=check
  console.log('\n── OpenProvider availability check ──')
  try {
    const op = require('/app/js/op-service.js')
    if (op.checkDomainAvailability) {
      const av = await op.checkDomainAvailability(DOMAIN)
      console.log('  availability:', JSON.stringify(av))
    } else {
      console.log('  op.checkDomainAvailability not exported')
    }
  } catch (e) {
    console.log('  Error:', e.message)
  }
})().catch(e => { console.error('FATAL', e); process.exit(1) })
