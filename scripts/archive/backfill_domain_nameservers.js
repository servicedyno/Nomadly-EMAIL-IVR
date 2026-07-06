/**
 * One-shot backfill: scan all domainsOf with cfZoneId but missing/empty
 * `nameservers` field, fetch the actual nameservers from Cloudflare and
 * persist them. This fixes the "No nameserver records found" UX bug
 * retroactively for ALL existing CF-managed domains.
 *
 * Idempotent — re-runnable. Safe — only reads from CF + writes to DB.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const axios = require('axios')

const CF_BASE = 'https://api.cloudflare.com/client/v4'
const CF_HEADERS = {
  'X-Auth-Email': process.env.CLOUDFLARE_EMAIL,
  'X-Auth-Key':   process.env.CLOUDFLARE_API_KEY,
  'Content-Type': 'application/json',
}

;(async () => {
  const cli = new MongoClient(process.env.MONGO_URL); await cli.connect()
  const db = cli.db()

  // Find every CF-managed domain that's missing the nameservers field
  const candidates = await db.collection('domainsOf').find({
    cfZoneId: { $exists: true, $ne: null, $ne: '' },
    $or: [
      { nameservers: { $exists: false } },
      { nameservers: null },
      { nameservers: { $size: 0 } },
    ],
  }).toArray()

  console.log(`Found ${candidates.length} CF-managed domain(s) missing nameservers field.\n`)
  let healed = 0, skipped = 0, errored = 0

  for (const d of candidates) {
    try {
      const r = await axios.get(`${CF_BASE}/zones`, { headers: CF_HEADERS, params: { name: d.domainName }, timeout: 10000 })
      const zone = (r.data?.result || [])[0]
      if (!zone?.name_servers?.length) {
        console.log(`  ⊘ ${d.domainName} — CF returned no nameservers (zone may have been deleted). Skipping.`)
        skipped++
        continue
      }
      await db.collection('domainsOf').updateOne(
        { _id: d._id },
        { $set: { nameservers: zone.name_servers } }
      )
      console.log(`  ✓ ${d.domainName} ← ${zone.name_servers.join(', ')}`)
      healed++
    } catch (e) {
      console.log(`  ✗ ${d.domainName} — ${e.response?.status || ''} ${e.message}`)
      errored++
    }
  }

  console.log(`\nDone: ${healed} healed, ${skipped} skipped, ${errored} errored.`)
  await cli.close()
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
