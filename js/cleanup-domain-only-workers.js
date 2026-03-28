/**
 * One-time cleanup: Remove antired Worker routes from domain-only domains
 * (domains in registeredDomains but NOT in cpanelAccounts).
 * 
 * Run: node js/cleanup-domain-only-workers.js
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const antiRedService = require('./anti-red-service')

;(async () => {
  console.log('🧹 Cleaning up antired Worker routes from domain-only domains\n')

  const client = await MongoClient.connect(process.env.MONGO_URL)
  const db = client.db()

  // Build set of hosting domains
  const cpAccounts = await db.collection('cpanelAccounts').find({}, { projection: { domain: 1, addonDomains: 1 } }).toArray()
  const hostingDomains = new Set()
  for (const acc of cpAccounts) {
    if (acc.domain) hostingDomains.add(acc.domain.toLowerCase())
    if (Array.isArray(acc.addonDomains)) {
      for (const addon of acc.addonDomains) {
        const d = (typeof addon === 'string' ? addon : addon.domain || '').toLowerCase()
        if (d) hostingDomains.add(d)
      }
    }
  }

  // Find domain-only domains on Cloudflare
  const regDomains = await db.collection('registeredDomains').find({}).toArray()
  const toClean = []
  for (const doc of regDomains) {
    const val = doc.val || {}
    if (val.cfZoneId && val.nameserverType === 'cloudflare') {
      const domain = String(doc._id).toLowerCase()
      if (!hostingDomains.has(domain)) {
        toClean.push({ domain, zoneId: val.cfZoneId })
      }
    }
  }

  console.log(`Found ${toClean.length} domain-only domains to clean\n`)

  let cleaned = 0, alreadyClean = 0, errors = 0
  for (const { domain, zoneId } of toClean) {
    try {
      const result = await antiRedService.removeWorkerRoutes(domain, zoneId)
      if (result.success && result.removed?.length > 0) {
        console.log(`  ✅ ${domain}: removed ${result.removed.length} routes`)
        cleaned++
      } else if (result.success) {
        alreadyClean++
      } else {
        console.log(`  ❌ ${domain}: ${result.error}`)
        errors++
      }
    } catch (err) {
      console.log(`  ❌ ${domain}: ${err.message}`)
      errors++
    }
    // Rate limit
    await new Promise(r => setTimeout(r, 250))
  }

  console.log(`\n━━━ SUMMARY ━━━`)
  console.log(`Cleaned: ${cleaned}`)
  console.log(`Already clean: ${alreadyClean}`)
  console.log(`Errors: ${errors}`)
  console.log(`Total: ${toClean.length}`)

  await client.close()
  console.log('\n✅ Cleanup complete!')
})().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
