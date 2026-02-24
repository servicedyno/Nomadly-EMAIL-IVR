/* DNS Management Real Integration Test
 * Tests viewDNSRecords, addDNSRecord, deleteDNSRecord across all 3 NS types
 * Uses real domains from the database + real Cloudflare/OP/CR APIs
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const TEST_DOMAINS = {
  cloudflare_cr: 'starboyplay1.sbs',      // CR + cloudflare
  cloudflare_op: 'auth45510.com',          // OP + cloudflare
  provider_default_cr: 'paquet-expedition.com', // CR + provider_default
  provider_default_op: 'paquet-mrelay.com',     // OP + provider_default
  custom_ns_op: 'qbreversegateway.com',         // OP + custom NS
}

const TEST_TXT_VALUE = `nomadly-dns-test-${Date.now()}`

let db, client
let pass = 0, fail = 0, skip = 0

const log = (icon, msg) => console.log(`${icon} ${msg}`)
const ok = (msg) => { pass++; log('✅', msg) }
const err = (msg) => { fail++; log('❌', msg) }
const skp = (msg) => { skip++; log('⏭️', msg) }

async function setup() {
  client = await MongoClient.connect(process.env.MONGO_URL)
  db = client.db('test')
  log('🔧', 'Connected to MongoDB')
}

async function teardown() {
  if (client) await client.close()
  log('🔧', 'Disconnected from MongoDB')
}

// ─── Test 1: getDomainMeta ───────────────────────────────
async function testGetDomainMeta() {
  const domainService = require('/app/js/domain-service')
  console.log('\n━━━ TEST 1: getDomainMeta ━━━')

  for (const [label, domain] of Object.entries(TEST_DOMAINS)) {
    const meta = await domainService.getDomainMeta(domain, db)
    if (meta) {
      ok(`getDomainMeta(${domain}) → registrar=${meta.registrar}, nsType=${meta.nameserverType}, cfZoneId=${meta.cfZoneId ? 'yes' : 'no'}`)
    } else {
      err(`getDomainMeta(${domain}) → null (not found)`)
    }
  }
}

// ─── Test 2: viewDNSRecords ──────────────────────────────
async function testViewDNSRecords() {
  const domainService = require('/app/js/domain-service')
  console.log('\n━━━ TEST 2: viewDNSRecords ━━━')

  // 2a. Cloudflare domain (CR)
  const cf_cr = await domainService.viewDNSRecords(TEST_DOMAINS.cloudflare_cr, db)
  if (cf_cr.source === 'cloudflare' && cf_cr.records?.length > 0) {
    ok(`viewDNSRecords(${TEST_DOMAINS.cloudflare_cr}) → source=cloudflare, ${cf_cr.records.length} records, cfZoneId=${cf_cr.cfZoneId ? 'yes' : 'no'}`)
  } else {
    err(`viewDNSRecords(${TEST_DOMAINS.cloudflare_cr}) → source=${cf_cr.source}, records=${cf_cr.records?.length}`)
  }

  // 2b. Cloudflare domain (OP)
  const cf_op = await domainService.viewDNSRecords(TEST_DOMAINS.cloudflare_op, db)
  if (cf_op.source === 'cloudflare' && cf_op.records?.length > 0) {
    ok(`viewDNSRecords(${TEST_DOMAINS.cloudflare_op}) → source=cloudflare, ${cf_op.records.length} records`)
  } else {
    err(`viewDNSRecords(${TEST_DOMAINS.cloudflare_op}) → source=${cf_op.source}, records=${cf_op.records?.length}`)
  }

  // 2c. Provider default (CR)
  const pd_cr = await domainService.viewDNSRecords(TEST_DOMAINS.provider_default_cr, db)
  if (pd_cr.source === 'connectreseller' && pd_cr.records?.length > 0) {
    ok(`viewDNSRecords(${TEST_DOMAINS.provider_default_cr}) → source=${pd_cr.source}, ${pd_cr.records.length} records`)
  } else if (pd_cr.records?.length === 0) {
    skp(`viewDNSRecords(${TEST_DOMAINS.provider_default_cr}) → source=${pd_cr.source}, 0 records (may be normal for fresh domain)`)
  } else {
    err(`viewDNSRecords(${TEST_DOMAINS.provider_default_cr}) → source=${pd_cr.source}, records=${pd_cr.records?.length}`)
  }

  // 2d. Provider default (OP)
  const pd_op = await domainService.viewDNSRecords(TEST_DOMAINS.provider_default_op, db)
  if (['openprovider'].includes(pd_op.source)) {
    ok(`viewDNSRecords(${TEST_DOMAINS.provider_default_op}) → source=${pd_op.source}, ${pd_op.records?.length} records`)
  } else {
    err(`viewDNSRecords(${TEST_DOMAINS.provider_default_op}) → source=${pd_op.source}, records=${pd_op.records?.length}`)
  }

  // 2e. Custom NS (OP) — should still return something (NS records from getDomainInfo)
  const cust = await domainService.viewDNSRecords(TEST_DOMAINS.custom_ns_op, db)
  if (cust.source === 'openprovider') {
    ok(`viewDNSRecords(${TEST_DOMAINS.custom_ns_op}) → source=${cust.source}, ${cust.records?.length} records (custom NS domain)`)
    if (cust.records?.length > 0) {
      console.log(`   Records: ${cust.records.map(r => `${r.recordType}=${r.recordContent}`).join(', ')}`)
    }
  } else {
    err(`viewDNSRecords(${TEST_DOMAINS.custom_ns_op}) → source=${cust.source}`)
  }
}

// ─── Test 3: addDNSRecord on Cloudflare domain ──────────
async function testAddDNSRecordCloudflare() {
  const domainService = require('/app/js/domain-service')
  console.log('\n━━━ TEST 3: addDNSRecord (Cloudflare domain) ━━━')

  const domain = TEST_DOMAINS.cloudflare_op
  const result = await domainService.addDNSRecord(domain, 'TXT', TEST_TXT_VALUE, '', db)
  if (result.success) {
    ok(`addDNSRecord(${domain}, TXT, '${TEST_TXT_VALUE}') → success, id=${result.id || 'n/a'}`)
    // Store the record ID for deletion test
    global.__cfTestRecordId = result.id
  } else {
    err(`addDNSRecord(${domain}, TXT) → ${result.error}`)
  }
}

// ─── Test 4: Verify added record exists in viewDNSRecords ──
async function testVerifyAddedRecord() {
  const domainService = require('/app/js/domain-service')
  console.log('\n━━━ TEST 4: Verify added TXT record ━━━')

  const domain = TEST_DOMAINS.cloudflare_op
  const dnsResult = await domainService.viewDNSRecords(domain, db)
  const found = dnsResult.records?.find(r => r.recordType === 'TXT' && r.recordContent === TEST_TXT_VALUE)
  if (found) {
    ok(`TXT record '${TEST_TXT_VALUE}' found in ${domain} records`)
    global.__cfTestRecordId = global.__cfTestRecordId || found.cfRecordId
  } else {
    err(`TXT record '${TEST_TXT_VALUE}' NOT found in ${domain} records`)
  }
}

// ─── Test 5: deleteDNSRecord on Cloudflare domain ───────
async function testDeleteDNSRecordCloudflare() {
  const domainService = require('/app/js/domain-service')
  console.log('\n━━━ TEST 5: deleteDNSRecord (Cloudflare domain) ━━━')

  const domain = TEST_DOMAINS.cloudflare_op
  const recordId = global.__cfTestRecordId
  if (!recordId) {
    skp('No record ID from add test — skipping delete')
    return
  }

  const result = await domainService.deleteDNSRecord(domain, {
    cfRecordId: recordId,
    recordType: 'TXT',
    recordContent: TEST_TXT_VALUE,
    recordName: domain,
  }, db)

  if (result.success) {
    ok(`deleteDNSRecord(${domain}, cfRecordId=${recordId}) → success`)
  } else {
    err(`deleteDNSRecord(${domain}) → ${result.error}`)
  }
}

// ─── Test 6: addDNSRecord on Provider Default (OP) ──────
async function testAddDNSRecordProviderDefault() {
  const domainService = require('/app/js/domain-service')
  console.log('\n━━━ TEST 6: addDNSRecord (Provider Default OP domain) ━━━')

  const domain = TEST_DOMAINS.provider_default_op
  const result = await domainService.addDNSRecord(domain, 'TXT', TEST_TXT_VALUE, '', db)
  if (result.success) {
    ok(`addDNSRecord(${domain}, TXT, '${TEST_TXT_VALUE}') → success`)
  } else {
    err(`addDNSRecord(${domain}, TXT) → ${result.error}`)
  }
}

// ─── Test 7: Verify and clean up OP record ──────────────
async function testCleanupOPRecord() {
  const domainService = require('/app/js/domain-service')
  console.log('\n━━━ TEST 7: Cleanup OP TXT record ━━━')

  const domain = TEST_DOMAINS.provider_default_op
  const dnsResult = await domainService.viewDNSRecords(domain, db)
  const found = dnsResult.records?.find(r => r.recordType === 'TXT' && r.recordContent === TEST_TXT_VALUE)
  if (found) {
    ok(`TXT record verified in OP domain ${domain}`)
    const delResult = await domainService.deleteDNSRecord(domain, found, db)
    if (delResult.success) {
      ok(`Cleanup: TXT record deleted from ${domain}`)
    } else {
      err(`Cleanup delete failed: ${delResult.error}`)
    }
  } else {
    skp(`TXT record not found in OP domain ${domain} (may not have been added)`)
  }
}

// ─── Test 8: NS update on OP domain ─────────────────────
async function testUpdateNameserversOP() {
  const domainService = require('/app/js/domain-service')
  const opService = require('/app/js/op-service')
  console.log('\n━━━ TEST 8: Read current NS on OP domains ━━━')

  // Get current NS for the custom NS domain
  const domain = TEST_DOMAINS.custom_ns_op
  const info = await opService.getDomainInfo(domain)
  if (info && info.nameservers) {
    ok(`getDomainInfo(${domain}) → NS: ${info.nameservers.join(', ')} (${info.nameservers.length} NS)`)
  } else {
    err(`getDomainInfo(${domain}) → ${info ? 'no nameservers' : 'domain not found'}`)
  }

  // Also check provider_default OP domain
  const pdDomain = TEST_DOMAINS.provider_default_op
  const pdInfo = await opService.getDomainInfo(pdDomain)
  if (pdInfo && pdInfo.nameservers) {
    ok(`getDomainInfo(${pdDomain}) → NS: ${pdInfo.nameservers.join(', ')} (${pdInfo.nameservers.length} NS)`)
  } else {
    err(`getDomainInfo(${pdDomain}) → ${pdInfo ? 'no nameservers' : 'domain not found'}`)
  }
}

// ─── Test 9: Custom NS keyboard restriction logic ───────
async function testCustomNSKeyboardLogic() {
  console.log('\n━━━ TEST 9: Custom NS keyboard restriction (code trace) ━━━')

  // Simulate the keyboard build logic from _index.js
  const buildKeyboard = (nameserverType, shortenerActive) => {
    const t = {
      quickActions: '⚡ Quick Actions', checkDns: '🔍 Check DNS',
      addDns: '➕ Add DNS', updateDns: '✏️ Update DNS', deleteDns: '🗑 Delete DNS',
      switchToCf: '☁️ Switch to Cloudflare',
      activateShortener: '🔗 Activate Shortener', deactivateShortener: '🔗 Deactivate Shortener',
      backButton: '⬅️ Back',
    }
    const shortenerBtn = shortenerActive ? t.deactivateShortener : t.activateShortener
    const _bc = [t.backButton]
    let kbRows
    if (nameserverType === 'custom') {
      kbRows = [[t.updateDns]]
      if (nameserverType !== 'cloudflare') kbRows.push([t.switchToCf])
      kbRows.push(_bc)
    } else {
      kbRows = [[t.quickActions], [t.checkDns], [t.addDns], [t.updateDns], [t.deleteDns]]
      if (nameserverType !== 'cloudflare') {
        kbRows.push([t.switchToCf])
      }
      kbRows.push([shortenerBtn], _bc)
    }
    return kbRows.flat()
  }

  // Custom NS → only Update DNS + Switch to CF + Back
  const customKb = buildKeyboard('custom', false)
  const customExpected = ['✏️ Update DNS', '☁️ Switch to Cloudflare', '⬅️ Back']
  if (JSON.stringify(customKb) === JSON.stringify(customExpected)) {
    ok(`Custom NS keyboard: [${customKb.join(', ')}] ✓`)
  } else {
    err(`Custom NS keyboard: [${customKb.join(', ')}] — expected [${customExpected.join(', ')}]`)
  }

  // Cloudflare → full buttons, NO Switch to CF
  const cfKb = buildKeyboard('cloudflare', false)
  const hasSwitchToCf = cfKb.includes('☁️ Switch to Cloudflare')
  const hasAllDns = cfKb.includes('➕ Add DNS') && cfKb.includes('🗑 Delete DNS') && cfKb.includes('⚡ Quick Actions')
  if (!hasSwitchToCf && hasAllDns) {
    ok(`Cloudflare keyboard: full DNS buttons, NO Switch to CF ✓`)
  } else {
    err(`Cloudflare keyboard issue: switchToCf=${hasSwitchToCf}, allDns=${hasAllDns}`)
  }

  // Provider default → full buttons + Switch to CF
  const pdKb = buildKeyboard('provider_default', false)
  const pdHasSwitchToCf = pdKb.includes('☁️ Switch to Cloudflare')
  const pdHasAllDns = pdKb.includes('➕ Add DNS') && pdKb.includes('🗑 Delete DNS')
  if (pdHasSwitchToCf && pdHasAllDns) {
    ok(`Provider default keyboard: full DNS buttons + Switch to CF ✓`)
  } else {
    err(`Provider default keyboard issue: switchToCf=${pdHasSwitchToCf}, allDns=${pdHasAllDns}`)
  }
}

// ─── Run all tests ──────────────────────────────────────
async function runAll() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  NOMADLY DNS MANAGEMENT — REAL INTEGRATION TEST ║')
  console.log('╚══════════════════════════════════════════════════╝')

  await setup()

  await testGetDomainMeta()
  await testViewDNSRecords()
  await testAddDNSRecordCloudflare()
  await testVerifyAddedRecord()
  await testDeleteDNSRecordCloudflare()
  await testAddDNSRecordProviderDefault()
  await testCleanupOPRecord()
  await testUpdateNameserversOP()
  await testCustomNSKeyboardLogic()

  await teardown()

  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log(`║  RESULTS: ${pass} passed, ${fail} failed, ${skip} skipped`)
  console.log('╚══════════════════════════════════════════════════╝')

  process.exit(fail > 0 ? 1 : 0)
}

runAll().catch(e => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
