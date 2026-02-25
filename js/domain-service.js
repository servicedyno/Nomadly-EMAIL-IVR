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

  // Cloudflare DNS — route to CF if nameserverType is 'cloudflare' OR if cfZoneId exists
  // (handles 'external' and other non-standard types that actually have a CF zone)
  const isCfManaged = (meta?.nameserverType === 'cloudflare' || meta?.cfZoneId) && meta?.cfZoneId
  if (isCfManaged) {
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
    // Normalize: if nameserverType wasn't 'cloudflare' but cfZoneId exists, fix the DB metadata
    if (meta.nameserverType !== 'cloudflare' && db) {
      log(`[domain-service] ${domainName} has cfZoneId but nameserverType='${meta.nameserverType}' — normalizing to 'cloudflare'`)
      await db.collection('domainsOf').updateOne({ domainName }, { $set: { nameserverType: 'cloudflare' } }, { upsert: false })
      await db.collection('registeredDomains').updateOne({ _id: domainName }, { $set: { 'val.nameserverType': 'cloudflare' } }, { upsert: false })
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
        // Update BOTH collections to keep metadata consistent
        await db.collection('registeredDomains').updateOne(
          { _id: domainName },
          { $set: { 'val.cfZoneId': cfResult.zoneId, 'val.nameservers': newNS } }
        )
        await db.collection('domainsOf').updateOne(
          { domainName },
          { $set: { cfZoneId: cfResult.zoneId, nameservers: newNS } },
          { upsert: false }
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
  if (recordType === 'NS' && (meta?.nameserverType === 'cloudflare' || meta?.cfZoneId) && meta?.registrar === 'OpenProvider') {
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

  if ((meta?.nameserverType === 'cloudflare' || meta?.cfZoneId) && meta?.cfZoneId) {
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

  // ConnectReseller: look up domainNameId + current NS from CR API directly
  // (session state may not have CR data if domain DNS is managed via Cloudflare)
  try {
    const getDomainDetails = require('./cr-domain-details-get')
    const { updateDNSRecordNs } = require('./cr-dns-record-update-ns')

    const details = await getDomainDetails(domainName)
    const rd = details?.responseData
    if (!rd || !rd.domainNameId) {
      log(`[updateNameserverAtRegistrar] CR domain lookup failed for ${domainName}`)
      return { useDefaultCR: true }
    }

    // Build current NS array from CR response
    const currentNSRecords = []
    if (rd.nameserver1) currentNSRecords.push({ nsId: 1, recordContent: rd.nameserver1 })
    if (rd.nameserver2) currentNSRecords.push({ nsId: 2, recordContent: rd.nameserver2 })
    if (rd.nameserver3) currentNSRecords.push({ nsId: 3, recordContent: rd.nameserver3 })
    if (rd.nameserver4) currentNSRecords.push({ nsId: 4, recordContent: rd.nameserver4 })

    log(`[updateNameserverAtRegistrar] CR domain ${domainName}: domainNameId=${rd.domainNameId}, slot=${nsSlot} → ${newValue}`)
    const result = await updateDNSRecordNs(rd.domainNameId, domainName, newValue, nsSlot, currentNSRecords)

    if (result.success) {
      // Build updated NS list for DB
      const updatedNS = [...(meta?.nameservers || [])]
      const idx = nsSlot - 1
      while (updatedNS.length <= idx) updatedNS.push('')
      updatedNS[idx] = newValue
      const filtered = updatedNS.filter(Boolean)
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
      return { success: true }
    }
    return result
  } catch (err) {
    log(`[updateNameserverAtRegistrar] CR path error for ${domainName}:`, err.message)
    return { useDefaultCR: true }
  }
}

// ─── Migrate records helper ─────────────────────────────

/**
 * Migrate existing DNS records from old provider (OP/CR) to a Cloudflare zone.
 * Skips NS records (handled by zone-level nameservers).
 * Returns { migrated: [], failed: [], isEmpty: boolean }
 */
const migrateRecordsToCF = async (domainName, cfZoneId, meta) => {
  const migrated = []
  const failed = []
  let oldRecords = []

  try {
    // Fetch existing records from old provider
    const registrar = meta.registrar || 'ConnectReseller'
    if (registrar === 'OpenProvider') {
      const opResult = await opService.listDNSRecords(domainName)
      oldRecords = (opResult.records || [])
    } else {
      const viewCRDNS = require('./cr-view-dns-records')
      const crData = await viewCRDNS(domainName)
      oldRecords = (crData?.records || []).map(r => ({
        recordType: r.recordType,
        recordContent: r.recordContent || r.value,
        recordName: r.recordName || r.hostName || domainName,
        ttl: r.ttl,
        priority: r.priority,
      }))
    }

    // Filter out NS records and empty entries
    const toMigrate = oldRecords.filter(r =>
      r.recordType && r.recordType !== 'NS' && r.recordContent
    )

    if (toMigrate.length === 0) {
      log(`[migrateRecordsToCF] No records to migrate for ${domainName}`)
      return { migrated, failed, isEmpty: true }
    }

    log(`[migrateRecordsToCF] Migrating ${toMigrate.length} records for ${domainName}`)

    for (const record of toMigrate) {
      const type = record.recordType.toUpperCase()
      const name = record.recordName || domainName
      const content = record.recordContent
      const shouldProxy = ['A', 'AAAA', 'CNAME'].includes(type)
      const priority = record.priority

      const result = await cfService.createDNSRecord(
        cfZoneId, type, name, content, record.ttl || 300, shouldProxy, priority
      )

      if (result.success || result.alreadyExists) {
        migrated.push({ type, name, content })
        log(`[migrateRecordsToCF] ✅ ${type} ${name} → ${content}`)
      } else {
        failed.push({ type, name, content, error: result.errors?.[0]?.message || 'Unknown' })
        log(`[migrateRecordsToCF] ❌ ${type} ${name} → ${content}: ${result.errors?.[0]?.message || 'Unknown'}`)
      }
    }
  } catch (err) {
    log(`[migrateRecordsToCF] Error: ${err.message}`)
  }

  return { migrated, failed, isEmpty: oldRecords.filter(r => r.recordType !== 'NS').length === 0 }
}

// ─── Background NS verification ────────────────────────

/**
 * Background task: re-check CF zone NS after 30s to detect CF reassignment.
 * Auto-corrects at registrar + DB if drift detected.
 */
const backgroundNSVerify = (domainName, cfNameservers, registrar, db) => {
  ;(async () => {
    try {
      await new Promise(r => setTimeout(r, 30000))
      const zoneData = await cfService.getZoneByName(domainName)
      if (!zoneData) return
      const currentNS = (zoneData.name_servers || []).sort().join(',')
      const savedNS = [...cfNameservers].sort().join(',')
      if (currentNS !== savedNS) {
        log(`[NSVerify] ⚠️ CF reassigned NS for ${domainName}: was [${cfNameservers}] now [${zoneData.name_servers}]`)
        const correctNS = zoneData.name_servers
        if (registrar === 'OpenProvider') {
          await opService.updateNameservers(domainName, correctNS)
        } else {
          const viewCRDNS = require('./cr-view-dns-records')
          const crData = await viewCRDNS(domainName)
          if (crData?.domainNameId) {
            const nsRecords = (crData.records || []).filter(r => r.recordType === 'NS')
            const { updateDNSRecordNs } = require('./cr-dns-record-update-ns')
            for (let i = 0; i < correctNS.length && i < 4; i++) {
              if (nsRecords[i]) await updateDNSRecordNs(crData.domainNameId, domainName, correctNS[i], nsRecords[i].nsId, nsRecords)
            }
          }
        }
        if (db) {
          await db.collection('domainsOf').updateOne({ domainName }, { $set: { nameservers: correctNS } })
          await db.collection('registeredDomains').updateOne({ _id: domainName }, { $set: { 'val.nameservers': correctNS } })
        }
        log(`[NSVerify] NS drift corrected for ${domainName}`)
      } else {
        log(`[NSVerify] NS verified OK for ${domainName}`)
      }
    } catch (err) {
      log(`[NSVerify] Error for ${domainName}: ${err.message}`)
    }
  })()
}

// ─── Core: create CF zone + update NS at registrar ──────

const _createZoneAndUpdateNS = async (domainName, meta) => {
  const cfResult = await cfService.createZone(domainName)
  if (!cfResult.success || !cfResult.zoneId) {
    return { error: 'Failed to create Cloudflare zone: ' + (cfResult.errors?.[0]?.message || 'Unknown error') }
  }
  const cfNameservers = cfResult.nameservers || []
  log(`[switchToCloudflare] CF zone created for ${domainName}: ${cfResult.zoneId}, NS: ${cfNameservers.join(', ')}`)
  if (cfNameservers.length < 2) {
    return { error: 'Cloudflare did not return nameservers' }
  }

  const registrar = meta.registrar || 'ConnectReseller'
  if (registrar === 'OpenProvider') {
    const nsResult = await opService.updateNameservers(domainName, cfNameservers)
    if (nsResult.error) return { error: `Failed to update nameservers at OpenProvider: ${nsResult.error}` }
    log(`[switchToCloudflare] OP NS updated for ${domainName}: ${cfNameservers.join(', ')}`)
  } else {
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
        if (result.error) log(`[switchToCloudflare] Warning: CR NS slot ${i + 1} update failed: ${result.error}`)
      }
    }
    log(`[switchToCloudflare] CR NS updated for ${domainName}`)
  }

  return { success: true, zoneId: cfResult.zoneId, nameservers: cfNameservers, registrar }
}

const _updateDBMeta = async (domainName, cfZoneId, cfNameservers, db) => {
  if (!db) return
  const updateData = { nameserverType: 'cloudflare', cfZoneId, nameservers: cfNameservers }
  await db.collection('domainsOf').updateOne({ domainName }, { $set: updateData }, { upsert: false })
  await db.collection('registeredDomains').updateOne(
    { _id: domainName },
    { $set: { 'val.nameserverType': 'cloudflare', 'val.cfZoneId': cfZoneId, 'val.nameservers': cfNameservers } },
    { upsert: false }
  )
}

// ─── Switch to Cloudflare ───────────────────────────────

/**
 * Switch a domain's DNS to Cloudflare:
 * 1. Create CF zone (get NS)
 * 2. Migrate existing DNS records from old provider to CF zone
 * 3. Update NS at registrar (CR or OP)
 * 4. Update DB metadata
 * 5. Background NS drift detection
 * Returns { success, nameservers, zoneId, migration: { migrated, failed, isEmpty } }
 */
const switchToCloudflare = async (domainName, db) => {
  const meta = await getDomainMeta(domainName, db)
  if (!meta) return { error: 'Domain metadata not found' }

  if (meta.nameserverType === 'cloudflare' && meta.cfZoneId) {
    return { error: 'Domain is already using Cloudflare DNS' }
  }

  log(`[switchToCloudflare] Starting for ${domainName} (registrar: ${meta.registrar || 'ConnectReseller'})`)

  // 1+3. Create CF zone + update NS at registrar
  const zoneResult = await _createZoneAndUpdateNS(domainName, meta)
  if (zoneResult.error) return zoneResult

  // 2. Migrate existing DNS records to CF zone
  const migration = await migrateRecordsToCF(domainName, zoneResult.zoneId, meta)

  // 4. Update DB metadata
  await _updateDBMeta(domainName, zoneResult.zoneId, zoneResult.nameservers, db)

  // 5. Background NS verification
  backgroundNSVerify(domainName, zoneResult.nameservers, zoneResult.registrar, db)

  return {
    success: true,
    nameservers: zoneResult.nameservers,
    zoneId: zoneResult.zoneId,
    migration,
  }
}

/**
 * ensureCloudflare — idempotent: if already on CF, returns existing zone info.
 * If not, creates CF zone, migrates records, updates NS at registrar, updates DB.
 * Used by shortener activation to guarantee domain is on Cloudflare before adding CNAME.
 */
const ensureCloudflare = async (domainName, db) => {
  const meta = await getDomainMeta(domainName, db)
  if (!meta) return { error: 'Domain metadata not found' }

  if (meta.nameserverType === 'cloudflare' && meta.cfZoneId) {
    log(`[ensureCloudflare] ${domainName} already on CF (zone: ${meta.cfZoneId})`)
    return { success: true, cfZoneId: meta.cfZoneId, nameservers: meta.nameservers || [], alreadyActive: true }
  }

  log(`[ensureCloudflare] ${domainName} NOT on Cloudflare — switching now`)

  // Create CF zone + update NS
  const zoneResult = await _createZoneAndUpdateNS(domainName, meta)
  if (zoneResult.error) return { error: zoneResult.error }

  // Migrate existing records to CF zone
  const migration = await migrateRecordsToCF(domainName, zoneResult.zoneId, meta)

  // Update DB
  await _updateDBMeta(domainName, zoneResult.zoneId, zoneResult.nameservers, db)

  // Background NS verification
  backgroundNSVerify(domainName, zoneResult.nameservers, zoneResult.registrar, db)

  return {
    success: true,
    cfZoneId: zoneResult.zoneId,
    nameservers: zoneResult.nameservers,
    alreadyActive: false,
    migration,
  }
}

/**
 * checkDNSConflict — check if adding a record type would conflict with existing records.
 * A/AAAA and CNAME cannot coexist on the same hostname in Cloudflare.
 * Returns { hasConflict, conflictingRecords: [], message } or { hasConflict: false }
 */
const checkDNSConflict = async (domainName, recordType, hostname, db) => {
  const meta = await getDomainMeta(domainName, db)
  if (!meta?.cfZoneId) return { hasConflict: false } // Only relevant for CF zones

  const type = recordType.toUpperCase()
  if (!['A', 'AAAA', 'CNAME'].includes(type)) return { hasConflict: false }

  const fullName = hostname ? `${hostname}.${domainName}` : domainName
  const cfRecords = await cfService.listDNSRecords(meta.cfZoneId)
  const conflicting = cfRecords.filter(r => {
    if (r.name !== fullName) return false
    if (type === 'CNAME') return ['A', 'AAAA'].includes(r.type)
    if (['A', 'AAAA'].includes(type)) return r.type === 'CNAME'
    return false
  })

  if (conflicting.length === 0) return { hasConflict: false }

  const conflictTypes = [...new Set(conflicting.map(r => r.type))].join('/')
  const isCNAME = type === 'CNAME'
  const message = isCNAME
    ? `⚠️ An existing ${conflictTypes} record for <b>${fullName}</b> will be deleted to add this CNAME.\n\n`
      + conflicting.map(r => `• ${r.type} → ${r.content}`).join('\n')
      + `\n\nProceed?`
    : `⚠️ An existing CNAME record for <b>${fullName}</b> will be deleted to add this ${type} record.\n\n`
      + conflicting.map(r => `• ${r.type} → ${r.content}`).join('\n')
      + `\n\nProceed?`

  return { hasConflict: true, conflictingRecords: conflicting, message }
}

/**
 * resolveConflictAndAdd — delete conflicting records, then add the new one.
 */
const resolveConflictAndAdd = async (domainName, recordType, recordValue, hostname, conflictingRecords, db, priority) => {
  const meta = await getDomainMeta(domainName, db)
  if (!meta?.cfZoneId) return { error: 'No Cloudflare zone' }

  // Delete conflicting records
  for (const record of conflictingRecords) {
    const delResult = await cfService.deleteDNSRecord(meta.cfZoneId, record.id)
    if (delResult.success) {
      log(`[resolveConflict] Deleted ${record.type} ${record.name} → ${record.content}`)
    } else {
      log(`[resolveConflict] Warning: failed to delete ${record.type} ${record.name}`)
    }
  }

  // Add the new record
  return await addDNSRecord(domainName, recordType, recordValue, hostname, db, priority)
}

// ─── Auto-create CF zone in viewDNSRecords also triggers worker ─────

/**
 * Switch a domain's DNS BACK from Cloudflare to the registrar's default nameservers.
 * 1. Fetch all DNS records from CF zone
 * 2. Restore default NS at registrar (OP: openprovider NS, CR: managedns NS)
 * 3. Create records on OP/CR DNS zone
 * 4. Delete CF zone (cleanup)
 * 5. Update DB metadata
 * Returns { success, nameservers, migration: { migrated, failed, isEmpty } }
 */
const switchToProviderDefault = async (domainName, db) => {
  const meta = await getDomainMeta(domainName, db)
  if (!meta) return { error: 'Domain metadata not found' }

  if (meta.nameserverType !== 'cloudflare' || !meta.cfZoneId) {
    return { error: 'Domain is not currently using Cloudflare DNS' }
  }

  const registrar = meta.registrar || 'ConnectReseller'
  log(`[switchToProvider] Starting for ${domainName} (registrar: ${registrar})`)

  // 1. Fetch existing records from CF zone
  const cfRecords = await cfService.listDNSRecords(meta.cfZoneId)
  const toMigrate = cfRecords.filter(r => !['NS', 'SOA'].includes(r.type))
  log(`[switchToProvider] Found ${toMigrate.length} records to migrate from CF`)

  // 2. Restore default NS at registrar
  let defaultNS = []
  if (registrar === 'OpenProvider') {
    defaultNS = ['ns1.openprovider.nl', 'ns2.openprovider.be', 'ns3.openprovider.eu']
    const nsResult = await opService.updateNameservers(domainName, defaultNS)
    if (nsResult.error) return { error: `Failed to restore nameservers at OpenProvider: ${nsResult.error}` }
    log(`[switchToProvider] OP NS restored to defaults for ${domainName}`)
  } else {
    // ConnectReseller — update NS to CR defaults via NS update
    const viewCRDNS = require('./cr-view-dns-records')
    const crData = await viewCRDNS(domainName)
    if (crData?.domainNameId) {
      const nsRecords = (crData.records || []).filter(r => r.recordType === 'NS')
      defaultNS = nsRecords.map(r => r.recordContent)
      // NS should already be managedns.org — just ensure they're set
      if (defaultNS.length === 0) {
        defaultNS = ['8307.dns1.managedns.org', '8307.dns2.managedns.org']
      }
      // If current NS are cloudflare, update back to CR defaults
      const { updateDNSRecordNs } = require('./cr-dns-record-update-ns')
      const crDefaultNS = ['8307.dns1.managedns.org', '8307.dns2.managedns.org']
      for (let i = 0; i < crDefaultNS.length && i < nsRecords.length; i++) {
        const existing = nsRecords[i]
        if (existing && existing.recordContent.includes('cloudflare')) {
          await updateDNSRecordNs(crData.domainNameId, domainName, crDefaultNS[i], existing.nsId, nsRecords)
        }
      }
      defaultNS = crDefaultNS
      log(`[switchToProvider] CR NS restored for ${domainName}`)
    } else {
      return { error: 'Could not fetch ConnectReseller domain data' }
    }
  }

  // 3. Migrate DNS records from CF to provider DNS zone
  const migrated = []
  const failed = []
  for (const record of toMigrate) {
    const type = record.type
    const name = record.name
    // Extract hostname relative to domain
    const hostname = name === domainName ? '' : name.replace(`.${domainName}`, '')
    const content = record.content
    const priority = record.priority

    try {
      let result
      if (registrar === 'OpenProvider') {
        result = await opService.addDNSRecord(domainName, type, content, hostname || domainName, priority)
      } else {
        // ConnectReseller
        const { saveServerInDomain } = require('./cr-dns-record-add')
        result = await saveServerInDomain(domainName, content, type, undefined, undefined, undefined, hostname || undefined, priority)
      }

      if (result?.success || result?.error === undefined || result?.error === null) {
        migrated.push({ type, name, content })
        log(`[switchToProvider] ✅ ${type} ${name} → ${content}`)
      } else {
        failed.push({ type, name, content, error: result?.error || 'Unknown' })
        log(`[switchToProvider] ❌ ${type} ${name} → ${content}: ${result?.error}`)
      }
    } catch (err) {
      failed.push({ type, name, content, error: err.message })
      log(`[switchToProvider] ❌ ${type} ${name} → ${content}: ${err.message}`)
    }
  }

  // 4. Delete CF zone (cleanup)
  if (meta.cfZoneId) {
    const delResult = await cfService.deleteZone(meta.cfZoneId)
    log(`[switchToProvider] CF zone ${meta.cfZoneId} deleted: ${delResult.success}`)
  }

  // 5. Update DB metadata
  if (db) {
    const updateData = {
      nameserverType: 'provider_default',
      nameservers: defaultNS,
    }
    // Remove cfZoneId
    await db.collection('domainsOf').updateOne(
      { domainName },
      { $set: updateData, $unset: { cfZoneId: '' } },
      { upsert: false }
    )
    await db.collection('registeredDomains').updateOne(
      { _id: domainName },
      { $set: { 'val.nameserverType': 'provider_default', 'val.nameservers': defaultNS }, $unset: { 'val.cfZoneId': '' } },
      { upsert: false }
    )
  }

  return {
    success: true,
    nameservers: defaultNS,
    migration: { migrated, failed, isEmpty: toMigrate.length === 0 },
  }
}

/**
 * addShortenerCNAME — Add a root CNAME for URL shortener, auto-resolving A/AAAA conflicts.
 * 
 * The shortener always needs a root CNAME pointing to Railway/Render.
 * If the domain has existing A/AAAA records at root (e.g. from hosting),
 * they must be deleted first since CNAME cannot coexist with A/AAAA.
 * 
 * Returns { success: true } or { error: 'message' }
 */
const addShortenerCNAME = async (domainName, cnameTarget, db) => {
  try {
    const meta = await getDomainMeta(domainName, db)

    if (meta?.nameserverType === 'cloudflare' && meta?.cfZoneId) {
      // 1. Check for A/AAAA conflicts at root
      const conflict = await checkDNSConflict(domainName, 'CNAME', '', db)
      if (conflict.hasConflict && conflict.conflictingRecords?.length > 0) {
        log(`[addShortenerCNAME] ${domainName}: removing ${conflict.conflictingRecords.length} conflicting A/AAAA record(s) before CNAME`)
        for (const rec of conflict.conflictingRecords) {
          const delResult = await cfService.deleteDNSRecord(meta.cfZoneId, rec.id)
          if (delResult.success) {
            log(`[addShortenerCNAME] Deleted ${rec.type} ${rec.name} → ${rec.content}`)
          } else {
            log(`[addShortenerCNAME] Warning: failed to delete ${rec.type} ${rec.name} → ${rec.content}`)
          }
        }
      }

      // 2. Add the CNAME (proxied for CF CNAME flattening at root)
      const result = await cfService.createDNSRecord(meta.cfZoneId, 'CNAME', domainName, cnameTarget, 300, true)
      if (result.success || result.alreadyExists) {
        return { success: true }
      }
      const errMsg = result.errors?.map(e => e.message || e.code).join(', ') || 'Cloudflare DNS add failed'
      return { error: errMsg }
    }

    // Non-CF domains: use generic addDNSRecord (OP/CR don't have CNAME flattening at root)
    const result = await addDNSRecord(domainName, 'CNAME', cnameTarget, '', db)
    if (result.success || result.alreadyExists) return { success: true }
    const errMsg = result.error || result.errors?.map(e => e.message).join(', ') || 'DNS add failed'
    return { error: errMsg }
  } catch (err) {
    log(`[addShortenerCNAME] Error for ${domainName}: ${err.message}`)
    return { error: err.message }
  }
}

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
  switchToProviderDefault,
  ensureCloudflare,
  checkDNSConflict,
  resolveConflictAndAdd,
  addShortenerCNAME,
}
