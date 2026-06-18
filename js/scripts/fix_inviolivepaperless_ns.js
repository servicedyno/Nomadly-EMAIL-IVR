/* global process */
/**
 * IMMEDIATE FIX for HHR2009 (1960615421) / inviolivepaperless.com
 *
 * Problem:
 *   - Domain registered at OpenProvider on 2026-06-18 11:30
 *   - cPanel addon attached to stri2c41 (strivepartypaperless.com hosting)
 *   - Cloudflare zone created (b8e6e104abb00850956b5c7c210591b9) — status: pending
 *   - BUT: nameservers at OpenProvider were NEVER updated to Cloudflare
 *   - Live NS still returns ns1/ns2/ns3.openprovider.{nl,be,eu}
 *   - Result: DNS doesn't resolve, hosting panel shows error
 *
 * Fix:
 *   1. Call OP updateNameservers with the CF zone's assigned NS
 *      (auto-disables DNSSEC if active — DNSSEC keys present)
 *   2. Patch registeredDomains.inviolivepaperless.com with full metadata
 *      so future panel/heal/audit jobs can find it.
 *   3. Print propagation probe result.
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })
const { MongoClient } = require('mongodb')
const cfService = require('../cf-service')
const opService = require('../op-service')

const DOMAIN = 'inviolivepaperless.com'
const CHAT_ID = '1960615421'

;(async () => {
  console.log('=== Fixing NS delegation for', DOMAIN, '===')

  // 1. Get CF nameservers
  const zone = await cfService.getZoneByName(DOMAIN)
  if (!zone) throw new Error('CF zone not found for ' + DOMAIN)
  const cfNs = zone.name_servers
  console.log('CF assigned NS:', cfNs)

  // 2. Update OP NS
  console.log('\nCalling opService.updateNameservers...')
  const updateResult = await opService.updateNameservers(DOMAIN, cfNs)
  console.log('OP updateNameservers result:', JSON.stringify(updateResult, null, 2))

  if (!updateResult?.success) {
    console.error('NS update failed, aborting metadata patch.')
    process.exit(1)
  }

  // 3. Patch registeredDomains entry with full metadata
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)
  try {
    const opInfo = await opService.getDomainInfo(DOMAIN)
    const opDomainId = opInfo?.domainId
    const opStatus = opInfo?.domainData?.status
    const opExpiry = opInfo?.domainData?.expiration_date

    await db.collection('registeredDomains').updateOne(
      { _id: DOMAIN },
      {
        $set: {
          'val.domain': DOMAIN,
          'val.provider': 'OpenProvider',
          'val.registrar': 'OpenProvider',
          'val.ownerChatId': CHAT_ID,
          'val.nameserverType': 'cloudflare',
          'val.nameservers': cfNs,
          'val.opDomainId': opDomainId,
          'val.opStatus': opStatus,
          'val.opExpiry': opExpiry,
          'val.status': 'registered',
          'val.linkedAt': new Date().toISOString(),
          'val.registeredAt': '2026-06-18T11:30:05.782Z',
          'val.healReason': 'addon_ns_missing_2026-06-18',
          'val.healedAt': new Date().toISOString(),
          'val.autoRenew': true,
        },
      },
      { upsert: true }
    )
    console.log('\n✅ registeredDomains.' + DOMAIN + ' patched with full metadata.')

    // 4. Add an audit row so future post-mortems know
    await db.collection('nsAuditLog').insertOne({
      domain: DOMAIN,
      chatId: CHAT_ID,
      action: 'addon_ns_fix',
      reason: 'Addon-domain flow did not update OP NS — manual fix applied',
      before: ['ns1.openprovider.nl', 'ns2.openprovider.be', 'ns3.openprovider.eu'],
      after: cfNs,
      propagationProbe: updateResult.propagation,
      ts: new Date().toISOString(),
      appliedBy: 'support-audit-2026-06-18',
    })
    console.log('✅ nsAuditLog row inserted')
  } finally {
    await client.close()
  }

  console.log('\n=== Done ===')
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
