/**
 * Rescue stuck domains where OpenProvider's REST API code:0 NS-update was
 * accepted but the registry never republished the new NS (real prod case:
 * inviowelcoparty.de, rsvpcrumelbell.de, rsvpeviteguestview.de — DENIC still
 * serves ina*.registrar.eu / 185.53.179.136 parking).
 *
 * What it does (per domain):
 *   1. Pre-flight NAST check — verify ≥2 of the target CF NS answer
 *      authoritatively for the domain RIGHT NOW. Skip rescue if not.
 *   2. Call opService.syncDomain() — PUT /v1beta/domains/{id} with the
 *      current name_servers + ns_group:'' to force OP→registry chprov push.
 *      This is what RCP's "Synchronize" button does internally.
 *   3. Wait, then probe public DNS for delegation health.
 *   4. Reset the dnsHealState row so the background DnsHealer re-engages.
 *
 * READ-ONLY for Cloudflare side; mutates OP (re-pushes existing NS) and the
 * dnsHealState collection. Idempotent — safe to re-run.
 *
 * Usage:
 *   node js/scripts/sync_stuck_domains.js                    # rescue all
 *                                                            # escalated rows
 *   node js/scripts/sync_stuck_domains.js domain1 domain2 …  # rescue specific
 */
'use strict'

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') })

const https = require('https')
const { MongoClient } = require('mongodb')
const opService = require('../op-service')
const cfService = require('../cf-service')

const log = (...a) => console.log(new Date().toISOString(), ...a)

const doh = (name, type) =>
  new Promise((resolve, reject) => {
    https.get(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { accept: 'application/dns-json' } },
      (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => {
          try { resolve(JSON.parse(body)) } catch (e) { reject(e) }
        })
      }
    ).on('error', reject)
  })

const probeDelegation = async (domain) => {
  const nsR = await doh(domain, 'NS')
  const aR = await doh(domain, 'A')
  const publicNs = (nsR.Answer || []).map((a) => String(a.data || '').toLowerCase())
  const publicA = (aR.Answer || []).map((a) => String(a.data || ''))
  const cfNsCount = publicNs.filter((h) => /\.ns\.cloudflare\.com\.?$/i.test(h)).length
  const healthy = cfNsCount >= 2
  return { healthy, publicNs, publicA, cfNsCount }
}

const rescueDomain = async (db, domain) => {
  log('')
  log(`════════ ${domain} ════════`)

  // 0) Cloudflare zone — confirm zone exists and get NS
  const zone = await cfService.getZoneByName(domain)
  if (!zone) {
    // Try create (idempotent at CF)
    const created = await cfService.createZone(domain)
    if (!created?.success) {
      log(`❌ Cannot rescue — no CF zone and createZone failed: ${JSON.stringify(created?.errors || created)}`)
      return { domain, rescued: false, reason: 'no-cf-zone' }
    }
  }
  const cfZone = await cfService.getZoneByName(domain)
  const cfNs = (cfZone?.name_servers || []).map((n) => String(n).toLowerCase())
  if (cfNs.length < 2) {
    log(`❌ CF zone has <2 nameservers — cannot rescue`)
    return { domain, rescued: false, reason: 'cf-zone-incomplete' }
  }
  log(`CF zone status=${cfZone.status} NS=${cfNs.join(', ')}`)

  // 1) Pre-flight: are CF NS authoritative for this domain?
  log(`Pre-flight NAST check against [${cfNs.join(', ')}]…`)
  const nast = await opService.checkNsAuthoritative(domain, cfNs, 30000)
  log(`NAST: ready=${nast.ready} authoritativeCount=${nast.authoritativeCount}/${cfNs.length} elapsed=${nast.elapsedMs}ms`)
  for (const n of nast.perNs) {
    log(`  - ${n.ns} (${n.ip || 'unresolved'}): aa=${n.aa} ancount=${n.ancount} error=${n.error || '-'}`)
  }
  if (!nast.ready) {
    log(`⚠️  Pre-flight failed — CF NS are not authoritative yet. Skipping OP sync (would just re-fail at DENIC NAST).`)
    log(`    Wait for the CF zone to fully serve the domain, then retry this script.`)
    return { domain, rescued: false, reason: 'preflight-not-ready' }
  }

  // 2) Probe current public delegation
  const before = await probeDelegation(domain)
  log(`Public DNS BEFORE: cfNsCount=${before.cfNsCount}, NS=[${before.publicNs.join(', ')}], A=[${before.publicA.join(', ')}]`)
  if (before.healthy) {
    log(`✅ Already delegated to Cloudflare publicly — nothing to do.`)
    // Make sure dnsHealState reflects this
    await db.collection('dnsHealState').updateOne(
      { _id: domain },
      { $set: {
        status: 'healthy',
        consecutiveHealthy: 1,
        attempts: 0,
        lastProbeAt: new Date(),
        nextProbeAt: new Date(Date.now() + 5 * 60 * 1000),
        lastError: null,
        lastPublicNs: before.publicNs,
        lastPublicA: before.publicA,
      } },
      { upsert: true }
    )
    return { domain, rescued: true, alreadyHealthy: true }
  }

  // 3) Call OP sync
  log(`Calling opService.syncDomain(${domain})…`)
  const sync = await opService.syncDomain(domain)
  log(`syncDomain result: ${JSON.stringify(sync)}`)
  if (!sync.success) {
    log(`❌ OP sync failed: ${sync.error}`)
    // Record the attempt
    await db.collection('dnsHealState').updateOne(
      { _id: domain },
      { $set: {
        lastSyncAt: new Date(),
        lastSyncResult: sync.error,
      } },
      { upsert: true }
    )
    return { domain, rescued: false, reason: 'op-sync-failed', error: sync.error }
  }

  // 4) Wait and re-probe (registry takes up to ~5min to publish)
  log(`OP accepted sync. Waiting up to 3min for DENIC/registry to publish CF NS…`)
  let after = before
  for (const waitMs of [30000, 60000, 90000]) {
    log(`  …waiting ${waitMs / 1000}s`)
    await new Promise((r) => setTimeout(r, waitMs))
    after = await probeDelegation(domain)
    log(`  Public DNS: cfNsCount=${after.cfNsCount}, NS=[${after.publicNs.join(', ')}]`)
    if (after.healthy) break
  }

  // 5) Update dnsHealState — clear escalated state, give healer a fresh start
  const status = after.healthy ? 'healthy' : 'healing'
  await db.collection('dnsHealState').updateOne(
    { _id: domain },
    { $set: {
      status,
      consecutiveHealthy: after.healthy ? 1 : 0,
      attempts: after.healthy ? 0 : 1, // give the healer 2 more attempts after sync
      lastSyncAt: new Date(),
      lastSyncResult: 'ok',
      lastProbeAt: new Date(),
      nextProbeAt: new Date(Date.now() + 5 * 60 * 1000),
      lastError: after.healthy ? null : 'post-sync awaiting registry publish',
      lastPublicNs: after.publicNs,
      lastPublicA: after.publicA,
    } },
    { upsert: true }
  )

  if (after.healthy) {
    log(`✅ ${domain} RESCUED — registry now publishes CF NS.`)
  } else {
    log(`⚠️  ${domain} sync accepted by OP but DENIC has not yet published.`)
    log(`    DnsHealer will re-probe every 5min. If still stuck in 24h, open OP support ticket.`)
  }

  return { domain, rescued: after.healthy, sync, after }
}

const main = async () => {
  // Targets: explicit args, else all escalated rows
  let targets = process.argv.slice(2).filter((a) => a && !a.startsWith('-'))

  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)

  if (targets.length === 0) {
    const rows = await db.collection('dnsHealState')
      .find({ status: 'escalated' })
      .toArray()
    targets = rows.map((r) => r._id)
    log(`No domains given — rescuing all ${targets.length} escalated rows`)
  }

  if (targets.length === 0) {
    log('Nothing to rescue.')
    await client.close()
    process.exit(0)
  }

  log(`Targets: ${targets.join(', ')}`)
  const results = []
  for (const dom of targets) {
    try {
      const r = await rescueDomain(db, dom)
      results.push(r)
    } catch (e) {
      log(`FATAL during rescue of ${dom}: ${e.message}`)
      results.push({ domain: dom, rescued: false, error: e.message })
    }
  }

  log('')
  log('════════ Summary ════════')
  for (const r of results) {
    const tag = r.rescued ? '✅' : '❌'
    log(`${tag} ${r.domain}: ${r.alreadyHealthy ? 'already healthy' : r.reason || (r.rescued ? 'rescued' : 'failed')}`)
  }
  const rescued = results.filter((r) => r.rescued).length
  log(`${rescued}/${results.length} rescued.`)

  await client.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('FATAL:', e?.stack || e)
  process.exit(1)
})
