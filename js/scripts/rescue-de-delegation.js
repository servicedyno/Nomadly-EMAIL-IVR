/**
 * One-shot rescue: re-submit nameservers for a .de domain whose OP order
 * left it in a non-delegated state at DENIC (parked at nx.denic.de).
 *
 * Usage (Railway shell):
 *   node js/scripts/rescue-de-delegation.js teustbnk.de
 *
 * What it does:
 *   1. Looks up the domain at OpenProvider and prints its current state.
 *   2. Looks up its Cloudflare zone to get the assigned NS.
 *   3. Calls opService.updateNameservers(...) which already auto-disables
 *      DNSSEC on DENIC DNSKEY rejections and retries on transient 5xx.
 *   4. Re-checks public DNS via Cloudflare DoH and prints the result.
 *
 * Safe to run repeatedly — it's idempotent.
 */
'use strict'

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') })

const https = require('https')
const opService = require('../op-service')
const cfService = require('../cf-service')

const log = (...a) => console.log(new Date().toISOString(), ...a)

const doh = (name, type) => new Promise((resolve, reject) => {
  https.get(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { accept: 'application/dns-json' } },
    (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => { try { resolve(JSON.parse(body)) } catch (e) { reject(e) } })
    }
  ).on('error', reject)
})

const isDelegatedToCloudflare = async (domain) => {
  const r = await doh(domain, 'NS')
  const ans = (r.Answer || []).map((a) => (a.data || '').toLowerCase())
  const cfNS = ans.filter((d) => d.endsWith('.ns.cloudflare.com.') || d.endsWith('.ns.cloudflare.com'))
  return { ok: cfNS.length >= 2, ns: ans, authority: r.Authority || [] }
}

const main = async () => {
  const domain = (process.argv[2] || '').trim().toLowerCase()
  if (!domain) {
    console.error('Usage: node js/scripts/rescue-de-delegation.js <domain>')
    process.exit(2)
  }

  log(`=== Rescue: ${domain} ===`)

  // 1) Public DNS — before
  const before = await isDelegatedToCloudflare(domain)
  log(`Public DNS BEFORE: ok=${before.ok}, NS=${JSON.stringify(before.ns)}, authority=${JSON.stringify(before.authority).slice(0, 200)}`)
  if (before.ok) {
    log('Domain already delegated to Cloudflare publicly — nothing to do.')
    process.exit(0)
  }

  // 2) OP — current state
  const info = await opService.getDomainInfo(domain)
  if (!info || !info.domainId) {
    log(`❌ OpenProvider: domain not found. Cannot continue. info=${JSON.stringify(info)}`)
    process.exit(3)
  }
  log(`OpenProvider: id=${info.domainId} status=${info.domainData?.status} ns=${JSON.stringify(info.domainData?.name_servers || info.nameservers)}`)

  // 3) Cloudflare — get the zone (createZone is idempotent: returns existing if found)
  const cf = await cfService.createZone(domain)
  if (!cf?.success || !Array.isArray(cf.nameservers) || cf.nameservers.length < 2) {
    log(`❌ Could not obtain CF zone for ${domain}: ${JSON.stringify(cf?.errors || cf)}`)
    process.exit(4)
  }
  log(`Cloudflare zone: id=${cf.zoneId}, status=${cf.status}, NS=${cf.nameservers.join(', ')}`)

  // 4) Push NS to OP (updateNameservers has built-in DNSSEC auto-fix + 5xx retries)
  log(`Calling opService.updateNameservers(${domain}, [${cf.nameservers.join(', ')}])…`)
  const upd = await opService.updateNameservers(domain, cf.nameservers)
  log(`OP updateNameservers result: ${JSON.stringify(upd)}`)
  if (upd.error) {
    log(`❌ NS update failed: ${upd.error}`)
    log('Next step: open a support ticket with OpenProvider for domain id ' + info.domainId + ' — DENIC pre-delegation likely needs manual reset.')
    process.exit(5)
  }

  // 5) Verify after a short propagation pause
  for (const waitMs of [30000, 60000, 120000]) {
    log(`Waiting ${Math.round(waitMs / 1000)}s for DENIC to publish delegation…`)
    await new Promise((r) => setTimeout(r, waitMs))
    const after = await isDelegatedToCloudflare(domain)
    log(`Public DNS check: ok=${after.ok}, NS=${JSON.stringify(after.ns)}`)
    if (after.ok) {
      log(`✅ ${domain} is now delegated to Cloudflare. Rescue successful.`)
      process.exit(0)
    }
  }

  log(`⚠️ NS update was accepted by OP but DENIC has not published delegation within 3.5 min.`)
  log(`This usually clears within 30–60 min. The new DNS-heal worker (job B) will keep re-checking automatically.`)
  process.exit(0)
}

main().catch((e) => {
  console.error('FATAL:', e?.stack || e)
  process.exit(1)
})
