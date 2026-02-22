/**
 * Domain DNS Sync Engine
 * 
 * Analyzes all domains in the database and syncs their current DNS records
 * from the live provider (OpenProvider, Cloudflare, ConnectReseller).
 * 
 * Stores results in `domainSyncResults` collection and provides a report.
 */

require('dotenv').config()
const { log } = require('console')
const opService = require('./op-service')
const cfService = require('./cf-service')
const viewCRDNS = require('./cr-view-dns-records')
const { getDomainInfo } = require('./cr-domain-details-get')

const BATCH_SIZE = 5
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * Run full domain DNS sync across all providers
 * @param {Db} db - MongoDB database instance
 * @returns {Object} Sync report
 */
const runDomainSync = async (db) => {
  const startTime = Date.now()
  log('[DomainSync] Starting full domain DNS sync...')

  // 1. Collect all domains from registeredDomains
  const allDomains = await db.collection('registeredDomains').find({}).toArray()
  log(`[DomainSync] Found ${allDomains.length} domains in registeredDomains`)

  const report = {
    total: allDomains.length,
    synced: 0,
    errors: 0,
    providerBreakdown: { OpenProvider: 0, Cloudflare: 0, ConnectReseller: 0, Unknown: 0 },
    statusBreakdown: { active: 0, expired: 0, pending: 0, error: 0, unknown: 0 },
    dnsIssues: [],
    results: [],
    startedAt: new Date().toISOString(),
  }

  // 2. Process in batches
  for (let i = 0; i < allDomains.length; i += BATCH_SIZE) {
    const batch = allDomains.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(doc => syncSingleDomain(doc, db))
    )

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j]
      if (result.status === 'fulfilled') {
        const r = result.value
        report.results.push(r)
        report.synced++
        
        // Provider breakdown
        const provider = r.registrar || r.provider || 'Unknown'
        if (provider.includes('OpenProvider')) report.providerBreakdown.OpenProvider++
        else if (provider.includes('Cloudflare')) report.providerBreakdown.Cloudflare++
        else if (provider.includes('ConnectReseller')) report.providerBreakdown.ConnectReseller++
        else report.providerBreakdown.Unknown++

        // Status
        if (r.opStatus === 'ACT' || r.cfStatus === 'active' || r.crStatus === 'ok') report.statusBreakdown.active++
        else if (r.opStatus === 'FAI' || r.cfStatus === 'deactivated') report.statusBreakdown.expired++
        else if (r.opStatus === 'PEN' || r.cfStatus === 'pending') report.statusBreakdown.pending++
        else if (r.syncError) report.statusBreakdown.error++
        else report.statusBreakdown.unknown++

        // DNS issues
        if (r.dnsIssues && r.dnsIssues.length > 0) {
          report.dnsIssues.push({ domain: r.domain, issues: r.dnsIssues })
        }
      } else {
        report.errors++
        report.results.push({
          domain: batch[j]?._id || 'unknown',
          syncError: result.reason?.message || 'Unknown error',
        })
      }
    }

    // Rate limit between batches
    if (i + BATCH_SIZE < allDomains.length) await sleep(1000)
    log(`[DomainSync] Progress: ${Math.min(i + BATCH_SIZE, allDomains.length)}/${allDomains.length}`)
  }

  report.completedAt = new Date().toISOString()
  report.durationMs = Date.now() - startTime

  // 3. Store full report in MongoDB
  await db.collection('domainSyncResults').insertOne({
    _id: `sync_${Date.now()}`,
    ...report,
  })

  log(`[DomainSync] Complete. Synced: ${report.synced}, Errors: ${report.errors}, Duration: ${report.durationMs}ms`)
  return report
}


/**
 * Sync a single domain: fetch live DNS from appropriate provider
 */
const syncSingleDomain = async (doc, db) => {
  const domain = doc._id
  const meta = doc.val || {}
  const registrar = meta.registrar || meta.provider || null
  const nsType = meta.nameserverType || null
  const cfZoneId = meta.cfZoneId || null

  const result = {
    domain,
    registrar,
    nsType,
    ownerChatId: meta.ownerChatId || null,
    dbStatus: meta.status || null,
    dnsIssues: [],
    liveDnsRecords: [],
    opStatus: null,
    opExpiry: null,
    cfStatus: null,
    crStatus: null,
    syncError: null,
    syncedAt: new Date().toISOString(),
  }

  try {
    // ─── Check OpenProvider status ───
    if (registrar === 'OpenProvider' || registrar === 'openprovider') {
      try {
        const opInfo = await opService.getDomainInfo(domain)
        if (opInfo) {
          result.opStatus = opInfo.status || 'unknown'
          result.opExpiry = opInfo.expiresAt || null
          result.opDomainId = opInfo.domainId || null
          result.opNameservers = opInfo.nameservers || []

          // Check: DB nameservers match live OP nameservers
          const dbNS = (meta.nameservers || []).sort()
          const liveNS = (opInfo.nameservers || []).sort()
          if (dbNS.length > 0 && liveNS.length > 0 && JSON.stringify(dbNS) !== JSON.stringify(liveNS)) {
            result.dnsIssues.push({
              type: 'ns_mismatch',
              message: `DB nameservers [${dbNS}] differ from live OP nameservers [${liveNS}]`,
            })
          }
        } else {
          result.dnsIssues.push({ type: 'op_not_found', message: 'Domain not found on OpenProvider — may be expired or transferred' })
        }
      } catch (e) {
        result.dnsIssues.push({ type: 'op_error', message: e.message })
      }
    }

    // ─── Check Cloudflare DNS ───
    if (nsType === 'cloudflare' && cfZoneId) {
      try {
        const cfRecords = await cfService.listDNSRecords(cfZoneId)
        if (cfRecords && cfRecords.length >= 0) {
          result.liveDnsRecords = cfRecords.map(r => ({
            type: r.type,
            name: r.name,
            content: r.content,
            ttl: r.ttl,
            proxied: r.proxied,
            cfRecordId: r.id,
          }))
          result.cfStatus = 'active'
          result.cfRecordCount = cfRecords.length
        }
      } catch (e) {
        result.cfStatus = 'error'
        result.dnsIssues.push({ type: 'cf_error', message: e.message })
      }
    } else if (nsType === 'cloudflare' && !cfZoneId) {
      // Cloudflare NS type but no zone ID — try to find zone by name
      try {
        const zone = await cfService.getZoneByName(domain)
        if (zone) {
          result.cfZoneIdRecovered = zone.id
          result.cfStatus = zone.status
          result.dnsIssues.push({
            type: 'cf_zone_recovered',
            message: `Found CF zone ${zone.id} (status: ${zone.status}) — DB had null cfZoneId`,
          })

          // Fetch DNS records from recovered zone
          const cfRecords = await cfService.listDNSRecords(zone.id)
          result.liveDnsRecords = cfRecords.map(r => ({
            type: r.type, name: r.name, content: r.content,
            ttl: r.ttl, proxied: r.proxied, cfRecordId: r.id,
          }))
          result.cfRecordCount = cfRecords.length

          // Update DB with recovered cfZoneId
          await db.collection('registeredDomains').updateOne(
            { _id: domain },
            { $set: { 'val.cfZoneId': zone.id } }
          )
        } else {
          result.cfStatus = 'zone_missing'
          result.dnsIssues.push({
            type: 'cf_zone_missing',
            message: 'Cloudflare NS type but no zone found — zone may need to be created',
          })
        }
      } catch (e) {
        result.dnsIssues.push({ type: 'cf_recovery_error', message: e.message })
      }
    }

    // ─── Check ConnectReseller DNS ───
    if (!registrar || registrar === 'ConnectReseller') {
      try {
        const crData = await viewCRDNS(domain)
        if (crData && crData.records && !crData.error) {
          result.liveDnsRecords = crData.records.map(r => ({
            type: r.recordType,
            name: r.recordName || domain,
            content: r.recordContent,
          }))
          result.crStatus = 'ok'
          result.crRecordCount = crData.records.length
        } else {
          result.crStatus = 'not_found'
        }
      } catch (e) {
        result.dnsIssues.push({ type: 'cr_error', message: e.message })
      }
    }

    // ─── Check OP DNS zone if OP domain with provider_default NS ───
    if (registrar === 'OpenProvider' && nsType !== 'cloudflare') {
      try {
        const opDns = await opService.listDNSRecords(domain)
        if (opDns.records && opDns.records.length > 0) {
          result.liveDnsRecords = opDns.records.map(r => ({
            type: r.recordType, name: r.recordName, content: r.recordContent, ttl: r.ttl,
          }))
        }
      } catch (e) {
        // OP DNS zone may not exist
      }
    }

    // ─── Store synced data back into registeredDomains ───
    const updateFields = { 'val.lastSyncedAt': new Date().toISOString() }
    if (result.opStatus) updateFields['val.opStatus'] = result.opStatus
    if (result.opExpiry) updateFields['val.opExpiry'] = result.opExpiry
    if (result.opDomainId) updateFields['val.opDomainId'] = result.opDomainId
    if (result.cfStatus) updateFields['val.cfStatus'] = result.cfStatus
    if (result.cfZoneIdRecovered) updateFields['val.cfZoneId'] = result.cfZoneIdRecovered
    if (result.liveDnsRecords.length > 0) updateFields['val.liveDnsRecords'] = result.liveDnsRecords

    await db.collection('registeredDomains').updateOne(
      { _id: domain },
      { $set: updateFields }
    )

  } catch (err) {
    result.syncError = err.message
  }

  return result
}


module.exports = { runDomainSync, syncSingleDomain }
