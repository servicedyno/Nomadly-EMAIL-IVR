/**
 * One-shot cleanup: rewrite any cPanel account whose `whmHost` is the
 * literal "test" / "test.host" (a leftover from older fixtures of
 * /app/tests/seed_captcha_accounts.js and /app/js/tests/test_chunked_upload.js).
 *
 * Symptom these rows cause:
 *   "🚨 cPanel control plane unreachable
 *    Host: test
 *    Reason: ENOTFOUND ..."
 *
 * Why: every proxy call by these accounts becomes `https://test:2087/...`
 * which DNS can't resolve, fires the admin alert.
 *
 * Run:  set -a; source /app/backend/.env; set +a; node /app/scripts/fix_bogus_whmhost.js
 *
 * Idempotent — safe to run repeatedly.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const BOGUS_HOSTS = ['test', 'test.host', 'localhost', '127.0.0.1', 'TEST']

;(async () => {
  if (!process.env.MONGO_URL) throw new Error('MONGO_URL missing — source /app/backend/.env first')
  const client = new MongoClient(process.env.MONGO_URL)
  try {
    await client.connect()
    const db = client.db(process.env.DB_NAME)
    const col = db.collection('cpanel_accounts')

    const offenders = await col.find(
      { whmHost: { $in: BOGUS_HOSTS } },
      { projection: { _id: 1, cpUser: 1, whmHost: 1, domain: 1, plan: 1 } }
    ).toArray()

    console.log(`Found ${offenders.length} cpanel account(s) with bogus whmHost:`)
    for (const a of offenders) {
      console.log(`  - ${a._id} (${a.cpUser}, domain=${a.domain}, whmHost=${a.whmHost})`)
    }

    if (offenders.length === 0) {
      console.log('Nothing to fix.')
      return
    }

    const newHost = process.env.WHM_HOST || null
    const r = await col.updateMany(
      { whmHost: { $in: BOGUS_HOSTS } },
      { $set: { whmHost: newHost } }
    )
    console.log(`✅ Updated ${r.modifiedCount} account(s) → whmHost=${newHost === null ? 'null (will fall back to env WHM_HOST)' : newHost}`)
  } finally {
    await client.close()
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
