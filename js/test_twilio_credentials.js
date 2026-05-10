#!/usr/bin/env node
/**
 * test_twilio_credentials.js
 *
 * Comprehensive Twilio credential audit.
 *
 * 1. Tests the MAIN account creds (.env TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN).
 * 2. Lists every subaccount owned by the main account (via /Accounts.json).
 * 3. Pulls every subaccount SID stored in the production DB:
 *    - phoneNumbersOf collection
 *    - state collection (val.twilioSubAccountSid)
 *    - any nested numbers[].twilioSubAccountSid
 * 4. For each DB subaccount: calls /Accounts/{sid}.json with main creds and
 *    classifies as `active`, `suspended`, `closed`, `not_owned`, or `error`.
 *
 * READ-ONLY.
 */

require('dotenv').config({ path: '/app/.env' })
const axios = require('axios')
const { MongoClient } = require('mongodb')
const fs = require('fs')

const SID = process.env.TWILIO_ACCOUNT_SID
const TOKEN = process.env.TWILIO_AUTH_TOKEN
const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME

async function tw(path) {
  try {
    const r = await axios.get(`https://api.twilio.com/2010-04-01${path}`, {
      auth: { username: SID, password: TOKEN }, timeout: 15000,
    })
    return { ok: true, status: r.status, data: r.data }
  } catch (e) {
    return { ok: false, status: e.response?.status, code: e.response?.data?.code, message: e.response?.data?.message || e.message }
  }
}

function fmt(d) { try { return d ? new Date(d).toISOString().slice(0,16).replace('T',' ') : '-' } catch { return String(d) } }

async function main() {
  console.log('═════════════════════════════════════════════════════════')
  console.log('  TWILIO CREDENTIALS AUDIT — READ ONLY')
  console.log(`  Run at: ${new Date().toISOString()}`)
  console.log(`  Main SID: ${SID}`)
  console.log('═════════════════════════════════════════════════════════\n')

  // 1. Test main creds
  console.log('[1/4] Testing MAIN account creds...')
  const main = await tw(`/Accounts/${SID}.json`)
  if (main.ok) {
    console.log(`     → ✅ HTTP ${main.status} | status="${main.data.status}" | friendly_name="${main.data.friendly_name}"`)
  } else {
    console.log(`     → ❌ HTTP ${main.status} | code=${main.code} | ${main.message}`)
    console.log('     → main creds are broken — every subsequent check would fail. Stopping.')
    process.exit(2)
  }

  // 2. List subaccounts owned by main account (paginate)
  console.log('\n[2/4] Listing subaccounts owned by main account (paginated)...')
  const owned = []
  let page = 0
  let nextUri = `/Accounts.json?PageSize=100`
  while (nextUri) {
    const r = await tw(nextUri)
    if (!r.ok) { console.log(`     → page ${page} failed: ${r.message}`); break }
    const accts = r.data?.accounts || []
    for (const a of accts) {
      if (a.sid !== SID) owned.push({ sid: a.sid, status: a.status, friendly: a.friendly_name, dateCreated: a.date_created })
    }
    nextUri = r.data?.next_page_uri ? r.data.next_page_uri.replace('/2010-04-01', '') : null
    page++
    if (page > 50) break  // safety
  }
  console.log(`     → ${owned.length} subaccount(s) owned. Status distribution:`)
  const ownedByStatus = owned.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc }, {})
  for (const [k, v] of Object.entries(ownedByStatus)) console.log(`         ${k}: ${v}`)
  const ownedSet = new Set(owned.map(a => a.sid))

  // 3. Pull subaccount SIDs from production DB
  console.log('\n[3/4] Pulling subaccount SIDs from production DB...')
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(DB_NAME)

  const dbSids = new Map()  // sid -> { source, chatId, phoneNumber, ... }

  try {
    const phNums = await db.collection('phoneNumbersOf').find({}).toArray()
    for (const p of phNums) {
      const chatId = p._id
      const topSid = p.twilioSubAccountSid
      if (topSid && !dbSids.has(topSid)) dbSids.set(topSid, { source: 'phoneNumbersOf.top', chatId })
      const numbers = p.numbers || []
      for (const n of numbers) {
        if (n.twilioSubAccountSid && !dbSids.has(n.twilioSubAccountSid)) {
          dbSids.set(n.twilioSubAccountSid, { source: 'phoneNumbersOf.numbers', chatId, phoneNumber: n.phoneNumber || n.number, status: n.status })
        }
      }
    }
    console.log(`     → phoneNumbersOf: ${phNums.length} docs`)
  } catch (e) { console.log(`     → phoneNumbersOf err: ${e.message}`) }

  try {
    const states = await db.collection('state').find({ 'val.twilioSubAccountSid': { $exists: true } }).toArray()
    for (const s of states) {
      const sid = s.val?.twilioSubAccountSid
      if (sid && !dbSids.has(sid)) dbSids.set(sid, { source: 'state.val', chatId: s._id })
    }
    console.log(`     → state w/ subaccount SID: ${states.length} docs`)
  } catch (e) { console.log(`     → state err: ${e.message}`) }

  console.log(`     → Total UNIQUE subaccount SIDs in DB: ${dbSids.size}`)

  // 4. Test each DB subaccount with current main creds (limited concurrency)
  console.log('\n[4/4] Testing each DB subaccount with current main creds...')
  const buckets = { active: [], suspended: [], closed: [], not_owned_404: [], not_owned_401: [], error: [] }
  let i = 0
  const total = dbSids.size
  for (const [sid, meta] of dbSids) {
    i++
    const inOwned = ownedSet.has(sid)
    const r = await tw(`/Accounts/${sid}.json`)
    let bucket
    if (r.ok) {
      const status = r.data.status
      if (status === 'active') bucket = 'active'
      else if (status === 'suspended') bucket = 'suspended'
      else if (status === 'closed') bucket = 'closed'
      else bucket = 'error'
    } else if (r.status === 404) bucket = 'not_owned_404'
    else if (r.status === 401) bucket = 'not_owned_401'
    else bucket = 'error'
    const entry = { sid, ...meta, inOwnedList: inOwned, twilioStatus: r.ok ? r.data.status : null, httpStatus: r.status, code: r.code, message: r.message }
    if (bucket === 'error') buckets.error.push(entry)
    else buckets[bucket].push(entry)
    if (i % 10 === 0 || i === total) console.log(`     ... ${i}/${total} tested`)
  }

  // Find subaccounts owned by main account but NOT in DB (orphans on Twilio side)
  const dbSet = new Set(dbSids.keys())
  const ownedNotInDb = owned.filter(a => !dbSet.has(a.sid))

  // ── Report ──
  function printBucket(label, arr, max = 20) {
    console.log(`\n───── ${label} (${arr.length}) ─────`)
    if (!arr.length) { console.log('  (none)'); return }
    for (const e of arr.slice(0, max)) {
      const tag = e.inOwnedList ? '[owned]' : '[NOT-owned]'
      console.log(`  • ${e.sid} ${tag} | chat=${e.chatId} | phone=${e.phoneNumber || '-'} | src=${e.source} | twilio=${e.twilioStatus || '-'} | HTTP ${e.httpStatus || '-'}${e.code ? ' code='+e.code : ''}${e.message && !e.twilioStatus ? ' msg='+String(e.message).slice(0,80) : ''}`)
    }
    if (arr.length > max) console.log(`  ... and ${arr.length - max} more`)
  }
  printBucket('✅ ACTIVE', buckets.active, 20)
  printBucket('⏸️  SUSPENDED (Twilio froze the subaccount — 401-ish in PhoneMonitor)', buckets.suspended)
  printBucket('🗑️  CLOSED (subaccount deleted on Twilio)', buckets.closed)
  printBucket('🚫 401 — main creds CANNOT see this subaccount (different parent? rotated token?)', buckets.not_owned_401)
  printBucket('❓ 404 — subaccount SID does not exist on Twilio at all (typo/stale)', buckets.not_owned_404)
  printBucket('⚠️  ERROR — other failure', buckets.error)

  console.log(`\n───── 🌟 OWNED on Twilio but NOT in our DB (potential leak / forgotten subaccounts) (${ownedNotInDb.length}) ─────`)
  for (const a of ownedNotInDb.slice(0, 20)) {
    console.log(`  • ${a.sid} | status=${a.status} | "${a.friendly}" | created=${fmt(a.dateCreated)}`)
  }
  if (ownedNotInDb.length > 20) console.log(`  ... and ${ownedNotInDb.length - 20} more`)

  // Summary
  console.log('\n═════════════════════════════════════════════════════════')
  console.log('  SUMMARY')
  console.log('═════════════════════════════════════════════════════════')
  console.log(`  Main SID:                          ${SID}`)
  console.log(`  Main creds:                        ✅ working`)
  console.log(`  Subaccounts OWNED by main:         ${owned.length}`)
  console.log(`  Subaccounts referenced in DB:      ${dbSids.size}`)
  console.log(`  ─ ✅ active:                        ${buckets.active.length}`)
  console.log(`  ─ ⏸️  suspended:                     ${buckets.suspended.length}`)
  console.log(`  ─ 🗑️  closed:                        ${buckets.closed.length}`)
  console.log(`  ─ 🚫 401 (not owned / wrong parent): ${buckets.not_owned_401.length}`)
  console.log(`  ─ ❓ 404 (does not exist):           ${buckets.not_owned_404.length}`)
  console.log(`  ─ ⚠️  other errors:                  ${buckets.error.length}`)
  console.log(`  Owned-but-not-in-DB (orphans):     ${ownedNotInDb.length}`)
  console.log('═════════════════════════════════════════════════════════')

  fs.writeFileSync('/app/memory/twilio_audit.json', JSON.stringify({
    runAt: new Date().toISOString(), mainSid: SID, mainOk: true,
    counts: {
      ownedByMain: owned.length, refInDb: dbSids.size,
      active: buckets.active.length, suspended: buckets.suspended.length, closed: buckets.closed.length,
      not_owned_401: buckets.not_owned_401.length, not_owned_404: buckets.not_owned_404.length, error: buckets.error.length,
      ownedNotInDb: ownedNotInDb.length,
    },
    owned, ownedNotInDb, buckets,
  }, null, 2))
  console.log('\n📄 Saved -> /app/memory/twilio_audit.json')

  await client.close()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
