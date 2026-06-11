/**
 * Heal rsvpeviteopen.org (chatId 1960615421 = @HHR2009)
 *
 * Diagnosis:
 *   - CF zone EXISTS at 2047e30143fb8c792301fcd4a5d340b6 (NS: anderson, leanna)
 *   - CF DNS records EXIST (CNAME root + www → tunnel)
 *   - registeredDomains.val.cfZoneId is set, nameserverType=cloudflare
 *   - BUT domainsOf has cfZoneId=null, nameserverType='provider_default' (inconsistent)
 *   - OP domain (29665245) still has OP default NS — that's why the user
 *     never reaches Cloudflare (no captcha page, no DNS).
 *
 * Heal plan:
 *   1. Verify OP domain id 29665245 currently uses OP default NS
 *   2. Update OP nameservers → CF nameservers
 *   3. Sync domainsOf record: cfZoneId, nameserverType='cloudflare'
 *   4. Sync registeredDomains.val: add missing fields (domain, provider,
 *      registrar, nameservers, autoRenew, ownerChatId, status, registeredAt,
 *      opDomainId)
 *
 * Idempotent: re-running is safe.
 */
require('dotenv').config({ path: '/app/backend/.env' })
process.chdir('/app/js')
const path = require('path')
const { MongoClient } = require('mongodb')

const opService = require(path.resolve('/app/js/op-service.js'))
const cfService = require(path.resolve('/app/js/cf-service.js'))

const DOMAIN = 'rsvpeviteopen.org'
const CHAT_ID = '1960615421'
const CF_ZONE_ID = '2047e30143fb8c792301fcd4a5d340b6'
const CF_NAMESERVERS = ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com']

;(async () => {
  console.log(`\n=== Heal ${DOMAIN} (user @HHR2009 / chatId ${CHAT_ID}) ===\n`)

  // Step 1: Verify CF zone still exists with expected zoneId
  console.log('Step 1: Verify CF zone state...')
  const zone = await cfService.getZoneByName(DOMAIN)
  if (!zone) {
    console.error(`❌ CF zone for ${DOMAIN} not found. Aborting.`)
    process.exit(1)
  }
  if (zone.id !== CF_ZONE_ID) {
    console.error(`❌ CF zoneId mismatch. Expected ${CF_ZONE_ID}, got ${zone.id}. Aborting.`)
    process.exit(1)
  }
  console.log(`  ✓ CF zone confirmed: ${zone.id}, status=${zone.status}, NS=${zone.name_servers.join(', ')}`)

  // Step 2: Look up OP domain
  console.log('\nStep 2: Look up OP domain info...')
  const opInfo = await opService.getDomainInfo(DOMAIN)
  if (!opInfo || !opInfo.domainId) {
    console.error(`❌ OP getDomainInfo failed for ${DOMAIN}.`)
    process.exit(1)
  }
  console.log(`  OP domainId: ${opInfo.domainId}`)
  console.log(`  OP current NS: ${JSON.stringify(opInfo.nameservers || opInfo.domainData?.name_servers || 'unknown')}`)
  const currentNs = (opInfo.domainData?.name_servers || []).map(n => (n.name || '').toLowerCase())
  const alreadyOnCF = currentNs.length >= 2 && currentNs.every(n => n.endsWith('.ns.cloudflare.com'))
  if (alreadyOnCF) {
    console.log('  ✓ OP NS already point to Cloudflare — skipping NS update.')
  } else {
    // Step 3: Update OP NS to CF
    console.log(`\nStep 3: Updating OP NS to CF ${CF_NAMESERVERS.join(', ')}...`)
    const nsResult = await opService.updateNameservers(DOMAIN, CF_NAMESERVERS)
    if (!nsResult.success) {
      console.error(`❌ OP NS update failed:`, JSON.stringify(nsResult))
      console.error('Manual intervention required at OpenProvider.')
      process.exit(2)
    }
    console.log('  ✓ OP NS updated to Cloudflare')
  }

  // Step 4: Sync MongoDB records
  console.log('\nStep 4: Sync MongoDB records...')
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  // 4a. Update domainsOf record
  const dofResult = await db.collection('domainsOf').updateOne(
    { domainName: DOMAIN, chatId: CHAT_ID },
    {
      $set: {
        cfZoneId: CF_ZONE_ID,
        nameserverType: 'cloudflare',
        registrar: 'OpenProvider',
        opDomainId: 29665245,
      },
    },
  )
  console.log(`  domainsOf: matched=${dofResult.matchedCount}, modified=${dofResult.modifiedCount}`)

  // 4b. Backfill registeredDomains.val with full structure (mirroring rsvpeviteopen.de)
  const regResult = await db.collection('registeredDomains').updateOne(
    { _id: DOMAIN },
    {
      $set: {
        'val.domain': DOMAIN,
        'val.provider': 'OpenProvider',
        'val.registrar': 'OpenProvider',
        'val.nameserverType': 'cloudflare',
        'val.nameservers': CF_NAMESERVERS,
        'val.autoRenew': true,
        'val.ownerChatId': CHAT_ID,
        'val.status': 'registered',
        'val.cfZoneId': CF_ZONE_ID,
        'val.opDomainId': 29665245,
        'val.healedAt': new Date(),
        'val.healReason': 'heal_rsvpeviteopen_org_2026-02',
      },
    },
    { upsert: true },
  )
  console.log(`  registeredDomains: matched=${regResult.matchedCount}, modified=${regResult.modifiedCount}, upserted=${regResult.upsertedId ? 'yes' : 'no'}`)

  // 4c. Set registeredAt if missing (don't overwrite — original is on domainsOf only)
  await db.collection('registeredDomains').updateOne(
    { _id: DOMAIN, 'val.registeredAt': { $exists: false } },
    { $set: { 'val.registeredAt': new Date('2026-06-11T16:42:40.017Z'), 'val.linkedAt': new Date() } },
  )

  // Step 5: Verify final state
  console.log('\nStep 5: Verify final state...')
  const finalDof = await db.collection('domainsOf').findOne({ domainName: DOMAIN, chatId: CHAT_ID })
  console.log('  domainsOf:', JSON.stringify(finalDof, null, 2))
  const finalReg = await db.collection('registeredDomains').findOne({ _id: DOMAIN })
  console.log('  registeredDomains:', JSON.stringify(finalReg, null, 2))

  await client.close()
  console.log('\n✅ Done. NS propagation to TLD will take 1-24h, then the captcha page will appear at https://rsvpeviteopen.org/')
})().catch(e => {
  console.error('Fatal:', e.message, e.stack)
  process.exit(1)
})
