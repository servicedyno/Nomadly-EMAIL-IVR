/* global process */
require('dotenv').config()
const { log } = require('console')
const { checkDomainPriceOnline } = require('./cr-domain-price-get')
const { buyDomainOnline } = require('./cr-domain-register')
const opService = require('./op-service')
const cfService = require('./cf-service')

/**
 * Unified Domain Service
 * - CR first, fallback to OP for availability/pricing
 * - Supports: provider_default, cloudflare, custom nameservers
 * - Routes DNS ops to correct API based on stored metadata
 */

// ─── Domain check ───────────────────────────────────────

const checkDomainPrice = async (domainName, db) => {
  // Check both registrars in parallel for speed
  log(`[domain-service] Checking ${domainName} on CR + OP in parallel...`)
  const [crResult, opResult] = await Promise.allSettled([
    checkDomainPriceOnline(domainName),
    opService.checkDomainAvailability(domainName),
  ])

  const cr = crResult.status === 'fulfilled' ? crResult.value : { available: false, message: crResult.reason?.message }
  const op = opResult.status === 'fulfilled' ? opResult.value : { available: false, message: opResult.reason?.message }

  // When both registrars have the domain, pick the cheapest for consistent pricing
  if (cr.available && op.available) {
    const winner = cr.price <= op.price ? cr : op
    const registrar = winner === cr ? 'ConnectReseller' : 'OpenProvider'
    log(`[domain-service] ${domainName} available on both — CR: $${cr.price}, OP: $${op.price} → using ${registrar} @ $${winner.price}`)
    return {
      available: true, price: winner.price,
      originalPrice: winner.originalPrice, registrar,
      message: winner.message || 'Domain is available',
    }
  }

  if (cr.available) {
    log(`[domain-service] ${domainName} available on ConnectReseller only @ $${cr.price}`)
    return {
      available: true, price: cr.price,
      originalPrice: cr.originalPrice, registrar: 'ConnectReseller',
      message: cr.message,
    }
  }

  if (op.available) {
    log(`[domain-service] ${domainName} available on OpenProvider only @ $${op.price}`)
    return {
      available: true, price: op.price,
      originalPrice: op.originalPrice, registrar: 'OpenProvider',
      message: 'Domain is available',
    }
  }

  return {
    available: false, price: 0, originalPrice: 0, registrar: null,
    message: 'Domain name not available, please try another domain name',
  }
}

/**
 * Check multiple TLD alternatives in parallel
 */
const checkAlternativeTLDs = async (baseName, db) => {
  const tlds = ['com', 'net', 'org', 'io', 'co', 'de', 'fr', 'it', 'xyz', 'sbs', 'app', 'dev']
  const checks = tlds.map(tld => {
    const domain = `${baseName}.${tld}`
    return checkDomainPrice(domain, db).then(r => ({ domain, ...r })).catch(() => ({ domain, available: false }))
  })
  const results = await Promise.allSettled(checks)
  return results
    .filter(r => r.status === 'fulfilled' && r.value.available)
    .map(r => r.value)
    .sort((a, b) => a.price - b.price)
    .slice(0, 5) // Top 5 cheapest
}

// ─── Domain registration ────────────────────────────────

/**
 * @param {string} nsChoice - 'provider_default', 'cloudflare', or 'custom'
 * @param {string[]} customNS - custom nameservers (only when nsChoice === 'custom')
 */
const registerDomain = async (domainName, registrar, nsChoice, db, chatId, customNS) => {
  let result
  let nameservers = []
  let cfZoneId = null

  // Determine nameservers based on choice
  if (nsChoice === 'cloudflare') {
    log(`[domain-service] Creating Cloudflare zone for ${domainName}...`)
    const cfResult = await cfService.createZone(domainName)
    if (cfResult.success) {
      nameservers = cfResult.nameservers || []
      cfZoneId = cfResult.zoneId
      log(`[domain-service] Cloudflare zone created. NS: ${nameservers.join(', ')}`)
    } else {
      log(`[domain-service] Cloudflare zone creation failed:`, cfResult.errors)
      nsChoice = 'provider_default'
    }
  } else if (nsChoice === 'custom' && customNS && customNS.length >= 2) {
    nameservers = customNS
    log(`[domain-service] Using custom NS: ${nameservers.join(', ')}`)
  }

  if (registrar === 'ConnectReseller') {
    const ns1 = nameservers.length >= 1 ? nameservers[0] : undefined
    const ns2 = nameservers.length >= 2 ? nameservers[1] : undefined
    result = await buyDomainOnline(domainName, ns1, ns2)
    if (result.success) {
      log(`[domain-service] ${domainName} registered on ConnectReseller with NS: ${ns1 || 'default'}, ${ns2 || 'default'}`)
    } else {
      // Fallback to OpenProvider when ConnectReseller fails (insufficient balance, API error, etc.)
      log(`[domain-service] ConnectReseller failed for ${domainName}: ${result.error} — falling back to OpenProvider`)
      const ns = (nsChoice === 'cloudflare' || nsChoice === 'custom') ? nameservers : []
      log(`[domain-service] Fallback OP registration for ${domainName} with NS: ${ns.length > 0 ? ns.join(', ') : 'provider_default (OP built-in)'}`)
      result = await opService.registerDomain(domainName, ns)
      if (result.success) {
        registrar = 'OpenProvider'
        log(`[domain-service] ${domainName} registered on OpenProvider via fallback (ID: ${result.domainId})`)
      }
    }
  } else if (registrar === 'OpenProvider') {
    // Pass CF/custom NS if selected, otherwise empty → OP will use its built-in defaults
    const ns = (nsChoice === 'cloudflare' || nsChoice === 'custom') ? nameservers : []
    log(`[domain-service] Registering ${domainName} on OpenProvider with NS: ${ns.length > 0 ? ns.join(', ') : 'provider_default (OP built-in)'}`)
    result = await opService.registerDomain(domainName, ns)
    if (result.success) {
      log(`[domain-service] ${domainName} registered on OpenProvider (ID: ${result.domainId})`)
    }
  } else {
    return { error: `Unknown registrar: ${registrar}` }
  }

  if (result.error) return { error: result.error }

  // Store metadata in MongoDB
  if (db) {
    try {
      await db.collection('domainsOf').updateOne(
        { domainName, chatId: String(chatId) },
        {
          $set: {
            registrar,
            nameserverType: nsChoice,
            cfZoneId: cfZoneId || null,
            opDomainId: result.domainId || null,
            customNS: nsChoice === 'custom' ? nameservers : null,
            registeredAt: new Date(),
          },
        },
        { upsert: true }
      )
      log(`[domain-service] Stored metadata for ${domainName} in DB`)
    } catch (err) {
      log(`[domain-service] DB update error:`, err.message)
    }
  }

  return {
    success: true, registrar,
    nameservers: nsChoice !== 'provider_default' ? nameservers : [],
    cfZoneId, opDomainId: result.domainId || null,
  }
}

/**
 * Post-registration: update nameservers for custom NS or Cloudflare on CR domains
 */
const postRegistrationNSUpdate = async (domainName, registrar, nsChoice, nameservers, db) => {
  if (nsChoice === 'provider_default') return { success: true }
  if (!nameservers || nameservers.length < 2) return { success: true }

  if (registrar === 'ConnectReseller') {
    // CR: update NS via the CR API
    const { updateDNSRecordNs } = require('./cr-dns-record-update-ns')
    const viewCRDNS = require('./cr-view-dns-records')
    const crData = await viewCRDNS(domainName)
    if (!crData || !crData.domainNameId) {
      return { error: 'Could not fetch CR domain data for NS update' }
    }
    const nsRecords = (crData.records || []).filter(r => r.recordType === 'NS')
    // Update each NS record
    for (let i = 0; i < nameservers.length && i < 4; i++) {
      const existingNS = nsRecords[i]
      if (existingNS) {
        await updateDNSRecordNs(crData.domainNameId, domainName, nameservers[i], existingNS.nsId, nsRecords)
      }
    }
    return { success: true }
  } else if (registrar === 'OpenProvider') {
    // OP was already registered with the nameservers, but update if needed
    return await opService.updateNameservers(domainName, nameservers)
  }
  return { success: true }
}

// ─── Domain metadata ────────────────────────────────────

const getDomainMeta = async (domainName, db) => {
  if (!db) return null
  try {
    // First check domainsOf for inline metadata (new registrations)
    const inlineMeta = await db.collection('domainsOf').findOne(
      { domainName },
      { projection: { _id: 0 } }
    )
    if (inlineMeta) return inlineMeta

    // Fallback: check registeredDomains for migrated/legacy domains
    const regDoc = await db.collection('registeredDomains').findOne({ _id: domainName })
    if (regDoc?.val) {
      return {
        domainName: regDoc.val.domain || domainName,
        registrar: regDoc.val.registrar || regDoc.val.provider || null,
        nameserverType: regDoc.val.nameserverType || null,
        cfZoneId: regDoc.val.cfZoneId || null,
        opDomainId: regDoc.val.opDomainId || null,
        nameservers: regDoc.val.nameservers || [],
        ownerChatId: regDoc.val.ownerChatId || null,
      }
    }

    return null
  } catch (err) {
    log(`[domain-service] getDomainMeta error:`, err.message)
    return null
  }
}

// ─── DNS operations (routing) ───────────────────────────

const viewDNSRecords = async (domainName, db) => {
  const meta = await getDomainMeta(domainName, db)

  // Cloudflare DNS
  if (meta?.nameserverType === 'cloudflare' && meta?.cfZoneId) {
    const cfRecords = await cfService.listDNSRecords(meta.cfZoneId)
    const records = cfRecords.map(r => ({
      recordType: r.type,
      recordContent: r.content,
      recordName: r.name,
      cfRecordId: r.id,
      ttl: r.ttl,
      proxied: r.proxied,
    }))
    // Prepend nameservers as NS records (zone-level, not deletable via record API)
    const nameservers = meta.nameservers || []
    for (const ns of nameservers) {
      records.unshift({ recordType: 'NS', recordContent: ns, recordName: domainName, isNameserver: true })
    }
    return { records, source: 'cloudflare', cfZoneId: meta.cfZoneId }
  }

  // Cloudflare NS but no zone yet — try to auto-create zone
  if (meta?.nameserverType === 'cloudflare' && !meta?.cfZoneId) {
    log(`[domain-service] ${domainName} has CF nameservers but no zone — auto-creating...`)
    const cfResult = await cfService.createZone(domainName)
    if (cfResult.success && cfResult.zoneId) {
      const newNS = cfResult.nameservers || []
      if (db) {
        await db.collection('registeredDomains').updateOne(
          { _id: domainName },
          { $set: { 'val.cfZoneId': cfResult.zoneId, 'val.nameservers': newNS } }
        )
      }
      const cfRecords = await cfService.listDNSRecords(cfResult.zoneId)
      const records = cfRecords.map(r => ({
        recordType: r.type,
        recordContent: r.content,
        recordName: r.name,
        cfRecordId: r.id,
        ttl: r.ttl,
        proxied: r.proxied,
      }))
      for (const ns of newNS) {
        records.unshift({ recordType: 'NS', recordContent: ns, recordName: domainName, isNameserver: true })
      }
      return { records, source: 'cloudflare', cfZoneId: cfResult.zoneId }
    }
    log(`[domain-service] ${domainName} CF zone auto-create failed, falling back to OP`)
  }

  // OpenProvider DNS (provider_default or custom)
  if (meta?.registrar === 'OpenProvider') {
    const dnsResult = await opService.listDNSRecords(domainName)
    if (dnsResult.records && dnsResult.records.length > 0) {
      return {
        records: dnsResult.records.map(r => ({
          recordType: r.recordType,
          recordContent: r.recordContent,
          recordName: r.recordName,
          ttl: r.ttl,
        })),
        source: 'openprovider',
        opDomainId: meta.opDomainId,
      }
    }
    // Fallback: show nameserver info
    const info = await opService.getDomainInfo(domainName)
    if (info) {
      return {
        records: info.nameservers.map((ns, i) => ({
          recordType: 'NS', recordContent: ns, nsId: i + 1,
        })),
        source: 'openprovider',
        opDomainId: info.domainId,
      }
    }
    return { records: [], source: 'openprovider' }
  }

  // Default: ConnectReseller
  const viewCRDNS = require('./cr-view-dns-records')
  return { ...(await viewCRDNS(domainName)), source: 'connectreseller' }
}

const addDNSRecord = async (domainName, recordType, recordValue, hostName, db, priority, extraData) => {
  const meta = await getDomainMeta(domainName, db)

  // NS records on Cloudflare-managed domains → update nameservers at registrar instead
  if (recordType === 'NS' && meta?.nameserverType === 'cloudflare' && meta?.registrar === 'OpenProvider') {
    log(`[domain-service] NS add on CF domain ${domainName} — updating nameservers at OpenProvider`)
    // Parse multiple NS values (user may send multiple lines or comma-separated)
    const nsValues = recordValue.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
    const result = await opService.updateNameservers(domainName, nsValues)
    if (result.success) {
      // Check if NS changed from current CF zone — if so, create new CF zone
      const oldNS = (meta.nameservers || []).sort().join(',')
      const newNS = nsValues.sort().join(',')
      let newCfZoneId = meta.cfZoneId
      if (oldNS !== newNS) {
        log(`[domain-service] NS changed for ${domainName}, checking if new CF zone needed`)
        const cfResult = await cfService.createZone(domainName)
        if (cfResult.success && cfResult.zoneId) {
          newCfZoneId = cfResult.zoneId
        }
      }
      // Update DB with new nameservers and zone
      if (db) {
        await db.collection('registeredDomains').updateOne(
          { _id: domainName },
          { $set: { 'val.nameservers': nsValues, 'val.cfZoneId': newCfZoneId } }
        )
      }
      return { success: true }
    }
    return { error: result.error || 'Failed to update nameservers at registrar' }
  }

  if (meta?.nameserverType === 'cloudflare' && meta?.cfZoneId) {
    const name = hostName ? `${hostName}.${domainName}` : domainName
    // A and CNAME records should be proxied through Cloudflare for SSL & CDN
    // Other record types (MX, TXT, SRV, etc.) must be DNS-only
    const shouldProxy = ['A', 'AAAA', 'CNAME'].includes(recordType.toUpperCase())
    return await cfService.createDNSRecord(meta.cfZoneId, recordType, name, recordValue, 300, shouldProxy, priority, extraData)
  }

  if (meta?.registrar === 'OpenProvider') {
    return await opService.addDNSRecord(domainName, recordType, recordValue, hostName || domainName, priority, extraData)
  }

  // Default: ConnectReseller — SRV/CAA not supported
  if (['SRV', 'CAA'].includes(recordType.toUpperCase())) {
    return { error: 'SRV and CAA records are not supported by ConnectReseller. Use Cloudflare or OpenProvider nameservers.' }
  }
  const { saveServerInDomain } = require('./cr-dns-record-add')
  return await saveServerInDomain(domainName, recordValue, recordType, null, null, null, hostName, priority)
}

const updateDNSRecord = async (domainName, recordData, db) => {
  const meta = await getDomainMeta(domainName, db)

  if (meta?.nameserverType === 'cloudflare' && meta?.cfZoneId && recordData.cfRecordId) {
    return await cfService.updateDNSRecord(
      meta.cfZoneId, recordData.cfRecordId,
      recordData.recordType, recordData.recordName || domainName,
      recordData.recordValue, recordData.ttl || 300
    )
  }

  if (meta?.registrar === 'OpenProvider') {
    return await opService.updateDNSRecord(domainName, recordData, recordData.recordValue, recordData.recordType)
  }

  // Default: ConnectReseller
  const { updateDNSRecord: crUpdate } = require('./cr-dns-record-update')
  return await crUpdate(
    recordData.DNSZoneID, recordData.DNSZoneRecordID,
    domainName, recordData.recordType, recordData.recordValue,
    recordData.domainNameId, recordData.nsId, recordData.dnsRecords, recordData.hostName
  )
}

const deleteDNSRecord = async (domainName, recordData, db) => {
  const meta = await getDomainMeta(domainName, db)

  if (meta?.nameserverType === 'cloudflare' && meta?.cfZoneId && recordData.cfRecordId) {
    return await cfService.deleteDNSRecord(meta.cfZoneId, recordData.cfRecordId)
  }

  if (meta?.registrar === 'OpenProvider') {
    return await opService.deleteDNSRecord(domainName, recordData)
  }

  // Default: ConnectReseller
  const { deleteDNSRecord: crDelete } = require('./cr-dns-record-del')
  return await crDelete(
    recordData.DNSZoneID, recordData.DNSZoneRecordID,
    domainName, recordData.domainNameId, recordData.nsId, recordData.dnsRecords
  )
}

// ─── NS update (registrar-level) ────────────────────────

/**
 * Update a single NS slot at the registrar.
 * For OP: replaces all nameservers (fetches current, swaps the slot, PUTs all).
 * For CR: calls the CR UpdateNameServer API.
 */
const updateNameserverAtRegistrar = async (domainName, nsSlot, newValue, db) => {
  const meta = await getDomainMeta(domainName, db)

  if (meta?.registrar === 'OpenProvider') {
    // OP: fetch current NS, replace slot, push all
    const info = await opService.getDomainInfo(domainName)
    if (!info) return { error: 'Domain not found on OpenProvider' }
    const currentNS = info.nameservers || []
    const idx = nsSlot - 1
    if (idx < 0 || idx >= Math.max(currentNS.length, 4)) return { error: 'Invalid NS slot' }
    // Build new NS array (expand to fit slot if needed)
    const newNS = [...currentNS]
    while (newNS.length <= idx) newNS.push('')
    newNS[idx] = newValue
    // Filter out empty entries
    const filtered = newNS.filter(Boolean)
    if (filtered.length < 2) return { error: 'At least 2 nameservers are required' }
    const result = await opService.updateNameservers(domainName, filtered)
    if (result.success) {
      // Update DB metadata
      if (db) {
        await db.collection('domainsOf').updateOne(
          { domainName },
          { $set: { nameservers: filtered } },
          { upsert: false }
        )
        await db.collection('registeredDomains').updateOne(
          { _id: domainName },
          { $set: { 'val.nameservers': filtered } },
          { upsert: false }
        )
      }
    }
    return result
  }

  // Default: ConnectReseller
  // CR uses the existing cr-dns-record-update-ns flow
  // (handled by the caller in _index.js passing nsId + nsRecords)
  return { useDefaultCR: true }
}

// ─── Switch to Cloudflare ───────────────────────────────

/**
 * Switch a domain's DNS to Cloudflare:
 * 1. Create CF zone (get NS)
 * 2. Update NS at registrar (CR or OP)
 * 3. Update DB metadata
 */
const switchToCloudflare = async (domainName, db) => {
  const meta = await getDomainMeta(domainName, db)
  if (!meta) return { error: 'Domain metadata not found' }

  // Already on Cloudflare?
  if (meta.nameserverType === 'cloudflare' && meta.cfZoneId) {
    return { error: 'Domain is already using Cloudflare DNS' }
  }

  // 1. Create CF zone
  const cfResult = await cfService.createZone(domainName)
  if (!cfResult.success || !cfResult.zoneId) {
    return { error: 'Failed to create Cloudflare zone: ' + (cfResult.errors?.[0]?.message || 'Unknown error') }
  }
  const cfNameservers = cfResult.nameservers || []
  if (cfNameservers.length < 2) {
    return { error: 'Cloudflare did not return nameservers' }
  }

  // 2. Update NS at registrar
  const registrar = meta.registrar || 'ConnectReseller'
  if (registrar === 'OpenProvider') {
    const nsResult = await opService.updateNameservers(domainName, cfNameservers)
    if (nsResult.error) return { error: `Failed to update nameservers at OpenProvider: ${nsResult.error}` }
  } else {
    // ConnectReseller
    const viewCRDNS = require('./cr-view-dns-records')
    const crData = await viewCRDNS(domainName)
    if (!crData || !crData.domainNameId) {
      return { error: 'Could not fetch ConnectReseller domain data for NS update' }
    }
    const nsRecords = (crData.records || []).filter(r => r.recordType === 'NS')
    const { updateDNSRecordNs } = require('./cr-dns-record-update-ns')
    for (let i = 0; i < cfNameservers.length && i < 4; i++) {
      const existingNS = nsRecords[i]
      if (existingNS) {
        const result = await updateDNSRecordNs(crData.domainNameId, domainName, cfNameservers[i], existingNS.nsId, nsRecords)
        if (result.error) {
          log(`[domain-service] Warning: NS slot ${i + 1} update failed: ${result.error}`)
        }
      }
    }
  }

  // 3. Update DB metadata
  if (db) {
    const updateData = {
      nameserverType: 'cloudflare',
      cfZoneId: cfResult.zoneId,
      nameservers: cfNameservers,
    }
    await db.collection('domainsOf').updateOne(
      { domainName },
      { $set: updateData },
      { upsert: false }
    )
    await db.collection('registeredDomains').updateOne(
      { _id: domainName },
      { $set: { 'val.nameserverType': 'cloudflare', 'val.cfZoneId': cfResult.zoneId, 'val.nameservers': cfNameservers } },
      { upsert: false }
    )
  }

  return {
    success: true,
    nameservers: cfNameservers,
    zoneId: cfResult.zoneId,
  }
}

// ─── Auto-create CF zone in viewDNSRecords also triggers worker ─────

module.exports = {
  checkDomainPrice,
  checkAlternativeTLDs,
  registerDomain,
  postRegistrationNSUpdate,
  getDomainMeta,
  viewDNSRecords,
  addDNSRecord,
  updateDNSRecord,
  deleteDNSRecord,
  updateNameserverAtRegistrar,
  switchToCloudflare,
}
