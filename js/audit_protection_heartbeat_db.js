#!/usr/bin/env node
/**
 * audit_protection_heartbeat_db.js
 *
 * DB-only audit (WHM is firewalled to Railway's egress IP — we can't curl it
 * from this pod). Cross-references the cpanelAccounts collection against
 * the ProtectionHeartbeat DIAG / REPAIRED log lines pulled from Railway to
 * understand which of the 14 accounts are stuck.
 *
 * READ-ONLY.
 */
require('dotenv').config({ path: '/app/.env' })
const { MongoClient } = require('mongodb')
const fs = require('fs')

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME

function fmtDate(d) { try { return d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '-' } catch { return String(d) } }

async function main() {
  console.log('═════════════════════════════════════════════════════════')
  console.log('  PROTECTION HEARTBEAT — DB AUDIT')
  console.log(`  Run at: ${new Date().toISOString()}`)
  console.log('═════════════════════════════════════════════════════════\n')

  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(DB_NAME)

  // Same query as runHeartbeat()
  const accts = await db.collection('cpanelAccounts').find({}).toArray()
  console.log(`[DB] cpanelAccounts has ${accts.length} document(s) — heartbeat scans ALL of these.\n`)

  // Cross-reference the latest Railway log file for ProtectionHeartbeat DIAG and REPAIRED lines
  const logTxt = fs.existsSync('/app/memory/railway_logs_full.txt')
    ? fs.readFileSync('/app/memory/railway_logs_full.txt', 'utf8') : ''
  const diagByUser = {}
  const repairedByUser = {}
  const errorByUser = {}
  for (const line of logTxt.split('\n')) {
    let m
    if ((m = line.match(/\[ProtectionHeartbeat\] DIAG (\S+):\s*(.+)/))) {
      const u = m[1]; (diagByUser[u] = diagByUser[u] || []).push(m[2].slice(0, 200))
    }
    if ((m = line.match(/\[ProtectionHeartbeat\] REPAIRED (\S+) /))) {
      const u = m[1]; repairedByUser[u] = (repairedByUser[u] || 0) + 1
    }
    if ((m = line.match(/\[ProtectionHeartbeat\] (Repair error|⚠️) (\S+) /))) {
      const u = m[2]; (errorByUser[u] = errorByUser[u] || []).push(line.slice(40, 200))
    }
  }

  const buckets = {
    deletedInDb: [],          // DB has deleted=true → should be excluded from heartbeat
    suspendedInDb: [],        // DB has suspended=true
    pastExpiryNotDeleted: [], // expired but not yet deleted
    activeNoIssues: [],       // active and not flagged
  }

  const now = new Date()
  for (const a of accts) {
    const cpUser = a._id || a.cpUser
    const entry = {
      cpUser,
      domain: a.domain || cpUser,
      plan: a.plan,
      chatId: a.chatId,
      deleted: !!a.deleted,
      suspended: !!a.suspended,
      expiryDate: fmtDate(a.expiryDate),
      deletedAt: fmtDate(a.deletedAt),
      suspendedAt: fmtDate(a.suspendedAt),
      logRepairs: repairedByUser[cpUser] || 0,
      logDiagSamples: (diagByUser[cpUser] || []).slice(-2),
      logErrors: (errorByUser[cpUser] || []).slice(-2),
    }
    if (a.deleted) buckets.deletedInDb.push(entry)
    else if (a.suspended) buckets.suspendedInDb.push(entry)
    else if (a.expiryDate && new Date(a.expiryDate) < now) buckets.pastExpiryNotDeleted.push(entry)
    else buckets.activeNoIssues.push(entry)
  }

  function printBucket(label, arr) {
    console.log(`\n───── ${label} (${arr.length}) ─────`)
    if (!arr.length) { console.log('  (none)'); return }
    for (const e of arr) {
      console.log(`  • ${e.cpUser.padEnd(12)} | ${(e.domain || '').padEnd(40)} | plan=${e.plan || '-'}`)
      console.log(`      chat=${e.chatId} | expiry=${e.expiryDate} | suspended=${e.suspended}${e.suspendedAt !== '-' ? '@'+e.suspendedAt : ''} | deleted=${e.deleted}${e.deletedAt !== '-' ? '@'+e.deletedAt : ''}`)
      console.log(`      log: repairs=${e.logRepairs}${e.logDiagSamples.length ? ' | last DIAG: ' + e.logDiagSamples[e.logDiagSamples.length - 1] : ''}`)
      if (e.logErrors.length) console.log(`      log errors: ${e.logErrors[e.logErrors.length - 1]}`)
    }
  }

  printBucket('🗑️  DELETED in DB but still in cpanelAccounts (LEAK — heartbeat keeps trying every hour)', buckets.deletedInDb)
  printBucket('⏸️  SUSPENDED in DB (heartbeat scans but cPanel suspended → 401/empty file fetches)', buckets.suspendedInDb)
  printBucket('⏰ PAST EXPIRY (not flagged deleted nor suspended — scheduler gap?)', buckets.pastExpiryNotDeleted)
  printBucket('✅ ACTIVE, within contract', buckets.activeNoIssues)

  console.log('\n═════════════════════════════════════════════════════════')
  console.log('  SUMMARY')
  console.log('═════════════════════════════════════════════════════════')
  console.log(`  cpanelAccounts total:           ${accts.length}`)
  console.log(`  DELETED in DB (LEAK):           ${buckets.deletedInDb.length}`)
  console.log(`  SUSPENDED:                      ${buckets.suspendedInDb.length}`)
  console.log(`  PAST EXPIRY but not deleted:    ${buckets.pastExpiryNotDeleted.length}`)
  console.log(`  ACTIVE:                         ${buckets.activeNoIssues.length}`)
  console.log('═════════════════════════════════════════════════════════')

  fs.writeFileSync('/app/memory/protection_heartbeat_audit.json', JSON.stringify({
    runAt: new Date().toISOString(),
    counts: {
      dbTotal: accts.length,
      deletedInDb: buckets.deletedInDb.length,
      suspendedInDb: buckets.suspendedInDb.length,
      pastExpiryNotDeleted: buckets.pastExpiryNotDeleted.length,
      activeNoIssues: buckets.activeNoIssues.length,
    },
    buckets,
  }, null, 2))
  console.log('\n📄 Saved -> /app/memory/protection_heartbeat_audit.json')

  await client.close()
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
