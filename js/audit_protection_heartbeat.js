#!/usr/bin/env node
/**
 * audit_protection_heartbeat.js
 *
 * Cross-references the cPanel accounts that ProtectionHeartbeat scans every
 * hour against:
 *   1. their MongoDB lifecycle state (active / suspended / deleted)
 *   2. the live WHM listaccts API (does the cPanel account still exist?)
 *   3. whether the .user.ini + .antired-challenge.php files are intact RIGHT NOW
 *
 * Purpose: identify which entries in cpanelAccounts are stale (deleted on WHM
 * but still in DB → heartbeat tries to repair them every hour and counts them
 * as errors), and surface accounts genuinely stuck in the repair loop.
 *
 * READ-ONLY — no writes, no repairs.
 */

require('dotenv').config({ path: '/app/.env' })
const { MongoClient } = require('mongodb')
const axios = require('axios')
const https = require('https')
const fs = require('fs')

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME
const WHM_HOST = process.env.WHM_HOST
const WHM_USERNAME = process.env.WHM_USERNAME || 'root'
const WHM_TOKEN = process.env.WHM_TOKEN

const whm = WHM_HOST && WHM_TOKEN ? axios.create({
  baseURL: `https://${WHM_HOST}:2087/json-api`,
  headers: { Authorization: `whm ${WHM_USERNAME}:${WHM_TOKEN}` },
  timeout: 30000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
}) : null

async function listacctsLive() {
  if (!whm) return { error: 'WHM not configured' }
  try {
    const res = await whm.get('/listaccts', { params: { 'api.version': 1 } })
    const accts = res.data?.data?.acct || []
    return { accounts: accts }
  } catch (e) {
    return { error: e.message, status: e.response?.status }
  }
}

async function getFile(cpUsername, dir, file) {
  if (!whm) return ''
  try {
    const res = await whm.get('/cpanel', {
      params: {
        'api.version': 1,
        cpanel_jsonapi_user: cpUsername,
        cpanel_jsonapi_apiversion: 3,
        cpanel_jsonapi_module: 'Fileman',
        cpanel_jsonapi_func: 'get_file_content',
        dir, file,
      },
    })
    return { ok: true, content: res.data?.result?.data?.content || '' }
  } catch (e) {
    return { ok: false, error: e.message, status: e.response?.status }
  }
}

function isUserIniIntact(content, cpUsername) {
  if (!content) return false
  const expected = `/home/${cpUsername}/public_html/.antired-challenge.php`
  return content.includes('auto_prepend_file') && content.includes(expected)
}
function isChallengePhpIntact(content) {
  if (!content) return false
  return content.includes('ANTIRED_IP_FIXED') &&
         content.includes('CF_CONNECTING_IP') &&
         content.includes('FIL212sD')
}

function fmtDate(d) { try { return d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '-' } catch { return String(d) } }

async function main() {
  console.log('═════════════════════════════════════════════════════════')
  console.log(`  PROTECTION HEARTBEAT AUDIT — READ ONLY`)
  console.log(`  Run at: ${new Date().toISOString()}`)
  console.log(`  WHM_HOST: ${WHM_HOST}`)
  console.log('═════════════════════════════════════════════════════════\n')

  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(DB_NAME)

  // 1. Pull DB records — exact same query as runHeartbeat()
  const accts = await db.collection('cpanelAccounts').find({}).toArray()
  console.log(`[DB] cpanelAccounts collection has ${accts.length} document(s)`)

  // 2. Pull live WHM accounts
  console.log('[WHM] Calling listaccts to enumerate live accounts...')
  const live = await listacctsLive()
  if (live.error) {
    console.log(`  ❌ WHM listaccts failed: ${live.error}${live.status ? ' (HTTP '+live.status+')' : ''}`)
  } else {
    console.log(`  → WHM has ${live.accounts.length} live account(s)`)
  }
  const whmUsers = new Set((live.accounts || []).map(a => a.user))

  // 3. For each DB record, classify
  const buckets = {
    deletedInDb: [],          // DB has deleted=true → should be excluded from heartbeat
    suspendedInDb: [],        // DB has suspended=true → website offline; should not fail heartbeat repair
    notOnWhm: [],             // DB record exists but cPanel account no longer on WHM
    onWhmFilesOk: [],         // OK
    onWhmFilesMissing: [],    // Files truly missing — repair candidate
    skippedByLoop: [],        // Heartbeat would skip due to >=3 consecutive repairs
    error: [],                // other errors
  }

  for (const acct of accts) {
    const cpUsername = acct._id || acct.cpUser
    if (!cpUsername || typeof cpUsername !== 'string') {
      buckets.error.push({ ...acct, _why: 'invalid _id' })
      continue
    }
    const entry = {
      cpUser: cpUsername,
      _id: acct._id,
      domain: acct.domain || acct.cpUser,
      plan: acct.plan,
      chatId: acct.chatId,
      deleted: !!acct.deleted,
      suspended: !!acct.suspended,
      expiryDate: fmtDate(acct.expiryDate),
      deletedAt: fmtDate(acct.deletedAt),
      suspendedAt: fmtDate(acct.suspendedAt),
      createdAt: fmtDate(acct.createdAt || acct._createdAt),
    }

    if (acct.deleted) { buckets.deletedInDb.push(entry); continue }
    if (acct.suspended) entry._suspended = true

    if (live.error) {
      // Can't compare — skip WHM existence check
    } else if (!whmUsers.has(cpUsername)) {
      buckets.notOnWhm.push(entry)
      continue
    }

    // Live on WHM — check files
    const [ini, php] = await Promise.all([
      getFile(cpUsername, '/public_html', '.user.ini'),
      getFile(cpUsername, '/public_html', '.antired-challenge.php'),
    ])
    if (!ini.ok || !php.ok) {
      entry._fetchErr = `ini=${ini.error || 'ok'} | php=${php.error || 'ok'}`
      entry._fetchStatus = `ini=${ini.status || ''} php=${php.status || ''}`
      buckets.error.push(entry)
      continue
    }
    const iniOk = isUserIniIntact(ini.content || '', cpUsername)
    const phpOk = isChallengePhpIntact(php.content || '')
    entry._iniOk = iniOk
    entry._phpOk = phpOk
    entry._iniLen = (ini.content || '').length
    entry._phpLen = (php.content || '').length

    if (acct.suspended) {
      buckets.suspendedInDb.push(entry)
    } else if (iniOk && phpOk) {
      buckets.onWhmFilesOk.push(entry)
    } else {
      buckets.onWhmFilesMissing.push(entry)
    }
  }

  // ── Report ──
  function bucket(label, arr, cb) {
    console.log(`\n───── ${label} (${arr.length}) ─────`)
    if (!arr.length) { console.log('  (none)'); return }
    for (const e of arr) cb(e)
  }

  bucket('🗑️  DELETED in DB but still in cpanelAccounts (heartbeat tries to repair these every hour — leak)', buckets.deletedInDb, e => {
    console.log(`  • ${e.cpUser} | ${e.domain} | plan=${e.plan} | chat=${e.chatId} | deletedAt=${e.deletedAt}`)
  })
  bucket('⏸️  SUSPENDED in DB (still attempted by heartbeat — usually ok if files exist)', buckets.suspendedInDb, e => {
    console.log(`  • ${e.cpUser} | ${e.domain} | plan=${e.plan} | chat=${e.chatId} | suspendedAt=${e.suspendedAt} | iniOk=${e._iniOk} phpOk=${e._phpOk}`)
  })
  bucket('👻 NOT on WHM (account no longer exists on the server)', buckets.notOnWhm, e => {
    console.log(`  • ${e.cpUser} | ${e.domain} | plan=${e.plan} | chat=${e.chatId} | deleted=${e.deleted} suspended=${e.suspended} | expiryDate=${e.expiryDate}`)
  })
  bucket('❌ ERROR fetching files from WHM', buckets.error, e => {
    console.log(`  • ${e.cpUser} | ${e.domain} | plan=${e.plan} | chat=${e.chatId} | err=${e._fetchErr || e._why}`)
    if (e._fetchStatus) console.log(`      status: ${e._fetchStatus}`)
  })
  bucket('⚠️  ON WHM but FILES MISSING/WRONG (genuine repair candidates)', buckets.onWhmFilesMissing, e => {
    console.log(`  • ${e.cpUser} | ${e.domain} | iniOk=${e._iniOk} (len=${e._iniLen}) | phpOk=${e._phpOk} (len=${e._phpLen})`)
  })
  bucket('✅ ON WHM and FILES OK', buckets.onWhmFilesOk, e => {
    console.log(`  • ${e.cpUser} | ${e.domain}`)
  })

  // Summary
  console.log('\n═════════════════════════════════════════════════════════')
  console.log('  SUMMARY')
  console.log('═════════════════════════════════════════════════════════')
  console.log(`  cpanelAccounts total:        ${accts.length}`)
  console.log(`  live on WHM:                 ${live.accounts ? live.accounts.length : 'unknown'}`)
  console.log(`  DELETED in DB (leak):        ${buckets.deletedInDb.length}  ← exclude from heartbeat`)
  console.log(`  NOT on WHM (stale):          ${buckets.notOnWhm.length}     ← exclude from heartbeat`)
  console.log(`  SUSPENDED in DB:             ${buckets.suspendedInDb.length}`)
  console.log(`  ON WHM, files OK:            ${buckets.onWhmFilesOk.length}`)
  console.log(`  ON WHM, files MISSING:       ${buckets.onWhmFilesMissing.length}`)
  console.log(`  ERROR fetching files:        ${buckets.error.length}`)
  console.log('═════════════════════════════════════════════════════════')

  fs.writeFileSync('/app/memory/protection_heartbeat_audit.json', JSON.stringify({
    runAt: new Date().toISOString(),
    whmHost: WHM_HOST,
    counts: {
      dbTotal: accts.length,
      whmLive: live.accounts ? live.accounts.length : null,
      deletedInDb: buckets.deletedInDb.length,
      notOnWhm: buckets.notOnWhm.length,
      suspendedInDb: buckets.suspendedInDb.length,
      onWhmFilesOk: buckets.onWhmFilesOk.length,
      onWhmFilesMissing: buckets.onWhmFilesMissing.length,
      error: buckets.error.length,
    },
    buckets,
  }, null, 2))
  console.log('\n📄 Saved -> /app/memory/protection_heartbeat_audit.json')

  await client.close()
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
