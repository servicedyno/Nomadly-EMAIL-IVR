/* global process */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })
const { MongoClient } = require('mongodb')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)

  for (const d of ['inviolivepaperless.com', 'rsvpeviteopen.org', 'strivepartypaperless.com']) {
    const reg = await db.collection('registeredDomains').findOne({ _id: d })
    console.log(`\n=== registeredDomains.${d} ===`)
    console.log(JSON.stringify(reg, null, 2))
  }

  // Also check NS-update audit logs if any
  for (const d of ['inviolivepaperless.com', 'rsvpeviteopen.org']) {
    const ns = await db.collection('nsAuditLog').find({ domain: d }).sort({ ts: -1 }).limit(5).toArray()
    if (ns.length) {
      console.log(`\n=== nsAuditLog for ${d} ===`)
      for (const e of ns) console.log(JSON.stringify(e))
    }
  }

  await client.close()
})().catch(e => { console.error(e); process.exit(1) })
