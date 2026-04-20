/**
 * RESTORE 28 OpenProvider domains for @pacelolx on Railway production database.
 *
 * - Looks up chatId via nameOf collection (val === 'pacelolx')
 * - For each domain:
 *     1. Fetches real metadata from OpenProvider (domainId, status, renewal_date, nameservers)
 *     2. Upserts domainsOf.<chatId>.<sanitizedDomain> = true  (bot's per-user KV mapping)
 *     3. Upserts registeredDomains._id=<domain> with full canonical val payload
 * - NO WALLET DEBIT (admin restoration)
 * - Auto-executes (no dry-run wait) per admin request.
 *
 * Usage:
 *   node scripts/restore-pacelolx-domains.js            # full run (auto-writes)
 *   node scripts/restore-pacelolx-domains.js --dry      # dry-run only (no writes)
 */

require('dotenv').config()
const { MongoClient } = require('mongodb')

const USERNAME = 'pacelolx'
const DRY_RUN = process.argv.includes('--dry')

const DOMAINS = [
  'chasesecurescanner.com',
  'northamericangateway.com',
  'firstsecuregateway.com',
  'etradeonlinegateway.com',
  'bmoonlinegateway.com',
  'fifththirdsecure.com',
  'securedevicecheck.com',
  'devicesecurityscan.com',
  'stocktonbusinessgateway.com',
  'simmonsonlineprofile.com',
  'secfedsecure.com',
  'gntysecure.com',
  'qbreverse.com',
  'qbreversegateway.com',
  'bofalivesupport.com',
  'livehelpportal.com',
  'fdicsecuretransport.com',
  'helpassistportal.com',
  'onlinesecureconnection.com',
  'onlinesecureapi.com',
  'americanrivieragateway.com',
  'bmoapigateway.com',
  'systemscanportal.com',
  'devicescanportal.com',
  'icloudsecurecare.com',
  'bncsecuregateway.com',
  'cashproauthentication.com',
  'harmonyonlinegateway.com',
]

// ─── Fetch prod env from Railway GraphQL API ───────────────────────────
async function fetchRailwayEnv() {
  const TOKEN = process.env.RAILWAY_PROJECT_TOKEN
  const PID = process.env.RAILWAY_PROJECT_ID
  const EID = process.env.RAILWAY_ENVIRONMENT_ID
  const SID = process.env.RAILWAY_SERVICE_ID
  if (!TOKEN || !PID || !EID || !SID) {
    throw new Error('Railway env vars missing (RAILWAY_PROJECT_TOKEN / _PROJECT_ID / _ENVIRONMENT_ID / _SERVICE_ID)')
  }
  const res = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': TOKEN },
    body: JSON.stringify({
      query: `query { variables(projectId: "${PID}", environmentId: "${EID}", serviceId: "${SID}") }`,
    }),
  })
  const data = await res.json()
  const vars = data?.data?.variables
  if (!vars) throw new Error(`Railway env fetch failed: ${JSON.stringify(data)}`)
  return vars
}

// ─── Derive nameserverType from live NS list ───────────────────────────
function deriveNsType(nameservers) {
  const list = (nameservers || []).map(n => String(n).toLowerCase())
  if (list.some(n => n.includes('cloudflare.com'))) return 'cloudflare'
  if (list.some(n => n.includes('openprovider.'))) return 'provider_default'
  if (list.length === 0) return 'provider_default'
  return 'custom'
}

;(async () => {
  console.log('═'.repeat(76))
  console.log(`  RESTORE 28 OP domains for @${USERNAME} — ${DRY_RUN ? '🟢 DRY RUN' : '🔴 WRITE MODE'}`)
  console.log('═'.repeat(76))

  // ── Step 1: Fetch prod env ────────────────────────────────────────────
  console.log('\n[1/6] Fetching prod env from Railway...')
  const env = await fetchRailwayEnv()
  const required = ['MONGO_URL', 'DB_NAME', 'OPENPROVIDER_USERNAME', 'OPENPROVIDER_PASSWORD']
  const missing = required.filter(k => !env[k])
  if (missing.length) {
    console.error(`  ❌ Missing prod env vars: ${missing.join(', ')}`)
    process.exit(1)
  }
  console.log(`  ✅ MONGO_URL host=${env.MONGO_URL.split('@')[1]?.split('/')[0]} DB=${env.DB_NAME}`)
  console.log(`  ✅ OPENPROVIDER_USERNAME=${env.OPENPROVIDER_USERNAME}`)

  // Apply env to process so op-service picks them up
  process.env.MONGO_URL = env.MONGO_URL
  process.env.DB_NAME = env.DB_NAME
  process.env.OPENPROVIDER_USERNAME = env.OPENPROVIDER_USERNAME
  process.env.OPENPROVIDER_PASSWORD = env.OPENPROVIDER_PASSWORD
  if (env.NOMADLY_SERVICE_EMAIL) process.env.NOMADLY_SERVICE_EMAIL = env.NOMADLY_SERVICE_EMAIL

  // Require op-service AFTER env is set so module-level constants read prod creds
  const opService = require('../js/op-service.js')

  // ── Step 2: Connect to prod Mongo & lookup chatId ─────────────────────
  console.log('\n[2/6] Connecting to prod Mongo & locating @pacelolx chatId...')
  const mongo = new MongoClient(env.MONGO_URL)
  await mongo.connect()
  const db = mongo.db(env.DB_NAME)

  const nameDoc = await db.collection('nameOf').findOne({
    val: { $regex: new RegExp(`^${USERNAME}$`, 'i') }
  })
  if (!nameDoc) {
    console.error(`  ❌ No nameOf entry matching /^${USERNAME}$/i. Aborting.`)
    await mongo.close(); process.exit(1)
  }
  const chatIdStr = String(nameDoc._id)
  console.log(`  ✅ Found chatId: ${chatIdStr} (type=${typeof nameDoc._id}) — nameOf.val="${nameDoc.val}"`)

  // ── Step 3: Read existing domainsOf doc to know _id type convention ──
  const existingUserDoc = await db.collection('domainsOf').findOne({ _id: nameDoc._id })
    || await db.collection('domainsOf').findOne({ _id: chatIdStr })
    || await db.collection('domainsOf').findOne({ _id: Number(chatIdStr) })

  // Preferred: whatever key format already exists for this user; else parseFloat per buyDomainFullProcess convention
  let userKey
  if (existingUserDoc) {
    userKey = existingUserDoc._id
    console.log(`  ✅ Existing domainsOf doc found (keyType=${typeof userKey}) — will $set new domain keys on it`)
  } else {
    userKey = Number.isFinite(parseFloat(chatIdStr)) ? parseFloat(chatIdStr) : chatIdStr
    console.log(`  🟡 No existing domainsOf doc — new doc will be created with _id=${userKey} (${typeof userKey})`)
  }

  // ── Step 4: Fetch real OpenProvider metadata for each domain ──────────
  console.log(`\n[3/6] Fetching live OpenProvider metadata for ${DOMAINS.length} domains...`)
  const records = []
  for (let i = 0; i < DOMAINS.length; i++) {
    const d = DOMAINS[i]
    process.stdout.write(`  (${String(i + 1).padStart(2)}/${DOMAINS.length}) ${d} ... `)
    try {
      const info = await opService.getDomainInfo(d)
      if (!info || !info.domainId) {
        console.log('❌ NOT FOUND on OpenProvider')
        records.push({ domain: d, found: false })
        continue
      }
      const nameservers = info.nameservers || []
      const nsType = deriveNsType(nameservers)
      console.log(`✅ id=${info.domainId} status=${info.status} expiry=${info.expiresAt} ns=${nameservers.join(',') || '(none)'}`)
      records.push({
        domain: d,
        found: true,
        opDomainId: info.domainId,
        status: info.status,
        expiresAt: info.expiresAt,
        nameservers,
        nsType,
      })
    } catch (e) {
      console.log(`❌ ERROR: ${e.message}`)
      records.push({ domain: d, found: false, error: e.message })
    }
  }

  const notFound = records.filter(r => !r.found)
  if (notFound.length) {
    console.log(`\n  ⚠️  ${notFound.length} domain(s) not found on OpenProvider:`)
    notFound.forEach(r => console.log(`     - ${r.domain}${r.error ? ` (${r.error})` : ''}`))
  }
  const toWrite = records.filter(r => r.found)
  console.log(`\n  ✅ Will restore ${toWrite.length}/${DOMAINS.length} domains`)

  if (toWrite.length === 0) {
    console.error('  ❌ No domains to restore. Aborting.')
    await mongo.close(); process.exit(1)
  }

  // ── Step 5: Preview payloads ──────────────────────────────────────────
  console.log('\n[4/6] Preview of writes:')
  const now = new Date()
  const domainsOfSet = {}
  const regUpdates = []
  for (const r of toWrite) {
    const sanitizedKey = r.domain.replace(/\./g, '@')
    domainsOfSet[sanitizedKey] = true
    regUpdates.push({
      _id: r.domain,
      val: {
        domain: r.domain,
        provider: 'OpenProvider',
        registrar: 'OpenProvider',
        nameserverType: r.nsType,
        nameservers: r.nameservers,
        autoRenew: true,
        ownerChatId: typeof userKey === 'number' ? userKey : parseFloat(chatIdStr),
        status: 'registered',
        registeredAt: now,
        linkedAt: now,
        cfZoneId: null,
        opDomainId: r.opDomainId,
        opStatus: r.status,
        opExpiry: r.expiresAt,
        opNameservers: r.nameservers,
        lastSyncedAt: now.toISOString(),
        _restoredAt: now.toISOString(),
        _restorationNote: 'Admin restoration — no wallet debit. Metadata synced from OpenProvider live API.',
      },
    })
  }
  console.log(`  domainsOf.${JSON.stringify(userKey)} $set keys (${Object.keys(domainsOfSet).length}):`)
  Object.keys(domainsOfSet).forEach(k => console.log(`    - ${k}`))
  console.log(`\n  registeredDomains upserts (${regUpdates.length}):`)
  regUpdates.slice(0, 2).forEach(u => {
    console.log(`    _id=${u._id}:`)
    console.log('    ' + JSON.stringify(u.val, null, 2).split('\n').join('\n    '))
  })
  if (regUpdates.length > 2) console.log(`    ... and ${regUpdates.length - 2} more (same shape)`)

  // ── Step 6: Write ─────────────────────────────────────────────────────
  console.log(`\n[5/6] ${DRY_RUN ? 'DRY RUN — skipping writes' : 'Writing to prod MongoDB...'}`)
  if (!DRY_RUN) {
    // 6a. Update domainsOf KV map
    await db.collection('domainsOf').updateOne(
      { _id: userKey },
      { $set: domainsOfSet },
      { upsert: true },
    )
    console.log(`  ✅ domainsOf.${JSON.stringify(userKey)} updated (${Object.keys(domainsOfSet).length} keys set)`)

    // 6b. Upsert each registeredDomains record
    let written = 0
    for (const u of regUpdates) {
      await db.collection('registeredDomains').updateOne(
        { _id: u._id },
        { $set: { val: u.val } },
        { upsert: true },
      )
      written++
    }
    console.log(`  ✅ registeredDomains: ${written} docs upserted`)
  }

  // ── Step 7: Read-back verification ────────────────────────────────────
  console.log(`\n[6/6] Read-back verification...`)
  const readbackUser = await db.collection('domainsOf').findOne({ _id: userKey })
  const userKeys = readbackUser ? Object.keys(readbackUser).filter(k => k !== '_id') : []
  const expectedSanitized = toWrite.map(r => r.domain.replace(/\./g, '@'))
  const missingOnUser = expectedSanitized.filter(k => !userKeys.includes(k))
  console.log(`  domainsOf.${JSON.stringify(userKey)}: ${userKeys.length} total keys, ${expectedSanitized.length - missingOnUser.length}/${expectedSanitized.length} of our domains present`)
  if (missingOnUser.length && !DRY_RUN) {
    console.log(`  ❌ Missing: ${missingOnUser.join(', ')}`)
  }

  let regOk = 0
  for (const r of toWrite) {
    const doc = await db.collection('registeredDomains').findOne({ _id: r.domain })
    if (doc?.val?.opDomainId === r.opDomainId && doc?.val?.ownerChatId) regOk++
  }
  console.log(`  registeredDomains readback: ${regOk}/${toWrite.length} docs verified with opDomainId + ownerChatId`)

  await mongo.close()
  console.log('\n' + '═'.repeat(76))
  console.log(`  ${DRY_RUN ? '🟢 DRY RUN COMPLETE' : '✅ RESTORATION COMPLETE'} — ${toWrite.length}/${DOMAINS.length} domains processed`)
  if (notFound.length) console.log(`  ⚠️  ${notFound.length} domain(s) not found on OP — review list above`)
  console.log('═'.repeat(76))
})().catch(err => {
  console.error('\n❌ FATAL:', err.message)
  console.error(err.stack)
  process.exit(2)
})
