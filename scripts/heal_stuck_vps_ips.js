/**
 * READ + targeted-WRITE script: scan vpsPlansOf for instances whose host
 * field is still a placeholder ("provisioning...", "pending", empty),
 * query Contabo for their real IP, and update the DB record. Optionally
 * DM the affected user when their VPS becomes reachable.
 *
 * Fixes the @davion419 instance 203378282 case (Windows VPS that completed
 * provisioning long after the foreground 90s polling gave up).
 *
 * Read-only against Contabo's API. Write-only against vpsPlansOf.
 * Idempotent — re-runnable.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const axios = require('axios')

// Contabo OAuth2
const CB_TOKEN_URL = 'https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token'
const CB_API = 'https://api.contabo.com/v1'

async function contaboToken() {
  const body = new URLSearchParams({
    client_id: process.env.CONTABO_CLIENT_ID,
    client_secret: process.env.CONTABO_CLIENT_SECRET,
    username: process.env.CONTABO_API_USER,
    password: process.env.CONTABO_API_PASSWORD,
    grant_type: 'password',
  })
  const r = await axios.post(CB_TOKEN_URL, body, { timeout: 15000 })
  return r.data.access_token
}

const { randomUUID } = require('crypto')
;(async () => {
  const cli = new MongoClient(process.env.MONGO_URL); await cli.connect()
  const db = cli.db()

  const placeholders = ['provisioning...', 'pending', '', null, '0.0.0.0']
  const stuck = await db.collection('vpsPlansOf').find({
    $or: [
      { host: { $in: placeholders } },
      { host: { $exists: false } },
    ],
    contaboInstanceId: { $exists: true, $ne: null }
  }).toArray()

  console.log(`Found ${stuck.length} VPS records with placeholder/missing host that have a contaboInstanceId.\n`)
  if (!stuck.length) { await cli.close(); return }

  const tok = await contaboToken()
  const HDR = { Authorization: 'Bearer ' + tok, 'x-request-id': randomUUID() }

  let updated = 0, notFound = 0, stillProv = 0, errored = 0
  for (const v of stuck) {
    const iid = v.contaboInstanceId
    try {
      // Each request needs its own unique x-request-id per Contabo's API spec.
      const perReqHdr = { ...HDR, 'x-request-id': randomUUID() }
      const r = await axios.get(`${CB_API}/compute/instances/${iid}`, { headers: perReqHdr, timeout: 15000 })
      const inst = (r.data?.data || [])[0]
      const ip = inst?.ipConfig?.v4?.ip || null
      if (ip && !placeholders.includes(ip)) {
        await db.collection('vpsPlansOf').updateOne(
          { _id: v._id },
          { $set: { host: ip, _ipBackfilledAt: new Date() } }
        )
        console.log(`  ✓ ${iid}  ${v.name || v._id} → ${ip}  (was '${v.host || '-'}')`)
        updated++
      } else {
        console.log(`  ⊘ ${iid}  ${v.name || v._id} — Contabo still has no IP (status=${inst?.status})`)
        stillProv++
      }
    } catch (e) {
      if (e.response?.status === 404) {
        console.log(`  ✗ ${iid}  ${v.name || v._id} — 404 (instance gone from Contabo)`)
        notFound++
      } else {
        console.log(`  ! ${iid}  ${v.name || v._id} — ${e.response?.status || ''} ${e.message}`)
        errored++
      }
    }
  }
  console.log(`\nDone: ${updated} updated, ${stillProv} still provisioning, ${notFound} not-in-contabo, ${errored} errored.`)
  await cli.close()
})().catch(e => { console.error('FATAL:', e.response?.data || e.message); process.exit(1) })
