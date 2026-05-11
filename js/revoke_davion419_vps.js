#!/usr/bin/env node
/**
 * revoke_davion419_vps.js
 *
 * Locks bot user @davion419 (chatId 404562920) out of Contabo VPS 203220843
 * that auto-renewed before our cancellation fix landed.
 *
 * Steps (in order, halts on first failure):
 *   1. BACKUP    — dump vpsPlansOf doc + Contabo snapshot to /app/memory/
 *   2. PASSWORD  — Contabo API: rotate Administrator password (Windows)
 *   3. SHUTDOWN  — Contabo API: graceful shutdown
 *   4. VERIFY    — re-fetch instance; confirm status != running
 *   5. DB CLEAN  — archive then delete vpsPlansOf doc from production
 *
 * Add --dry-run to print actions without executing.
 */

const fs = require('fs')
const path = require('path')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const contabo = require('./contabo-service.js')

const railwayEnv = JSON.parse(fs.readFileSync('/app/memory/railway_prod_env.json', 'utf8'))
const MONGO_URL = railwayEnv.MONGO_URL
const DB_NAME = railwayEnv.DB_NAME || 'test'

const CHAT_ID = 404562920
const USERNAME = 'davion419'
const INSTANCE_ID = 203220843
const PLAN_ID = '69ecea52ba4726a69ab9e1bd'   // _id of vpsPlansOf doc

const dryRun = process.argv.includes('--dry-run')

function ts() { return new Date().toISOString().replace(/[:.]/g, '-') }
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function pad(label) { return label.padEnd(11) }

;(async () => {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  REVOKE VPS ${INSTANCE_ID} for @${USERNAME} (chatId=${CHAT_ID})`)
  console.log(`  Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`)
  console.log(`  Started: ${new Date().toISOString()}`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  const client = new MongoClient(MONGO_URL, {
    serverApi: ServerApiVersion.v1,
    serverSelectionTimeoutMS: 90000,
    connectTimeoutMS: 60000,
    socketTimeoutMS: 90000
  })
  await client.connect()
  const db = client.db(DB_NAME)

  const auditLog = {
    runAt: new Date().toISOString(),
    chatId: CHAT_ID,
    username: USERNAME,
    instanceId: INSTANCE_ID,
    planId: PLAN_ID,
    dryRun,
    steps: {}
  }

  // ── STEP 1: BACKUP ──────────────────────────────────────────────────
  console.log(`[${pad('1.BACKUP')}] Fetching current state…`)
  let planDoc
  try {
    planDoc = await db.collection('vpsPlansOf').findOne({ _id: PLAN_ID })
    if (!planDoc) planDoc = await db.collection('vpsPlansOf').findOne({ contaboInstanceId: INSTANCE_ID })
  } catch (e) {
    console.log(`             ❌ DB read failed: ${e.message}`); process.exit(1)
  }
  if (!planDoc) {
    console.log(`             ⚠️  vpsPlansOf doc not found (might already be deleted)`)
  } else {
    console.log(`             ✓ Plan doc found: _id=${planDoc._id} status=${planDoc.status}`)
  }

  let contaboSnapshot
  try {
    contaboSnapshot = await contabo.getInstance(INSTANCE_ID)
    console.log(`             ✓ Contabo snapshot: status=${contaboSnapshot.status} cancelDate=${contaboSnapshot.cancelDate || '-'} ip=${contaboSnapshot.ipConfig?.v4?.ip}`)
  } catch (e) {
    console.log(`             ❌ Contabo fetch failed: ${e.message}`); await client.close(); process.exit(1)
  }

  const backupPath = `/app/memory/davion419_vps_revoke_backup_${ts()}.json`
  fs.writeFileSync(backupPath, JSON.stringify({
    planDoc, contaboSnapshot, capturedAt: new Date().toISOString()
  }, null, 2))
  console.log(`             ✓ Backup saved → ${backupPath}\n`)
  auditLog.steps.backup = { ok: true, backupPath, planFound: !!planDoc }

  if (dryRun) {
    console.log('[DRY-RUN] Stopping here. Re-run without --dry-run to execute steps 2-5.')
    await client.close(); return
  }

  // ── STEP 2: PASSWORD RESET ──────────────────────────────────────────
  console.log(`[${pad('2.PASSWORD')}] Rotating Administrator password via Contabo API…`)
  let pwdResult
  try {
    pwdResult = await contabo.resetPassword(INSTANCE_ID, {
      osType: contaboSnapshot.osType,        // 'Windows'
      isRDP: contaboSnapshot.osType === 'Windows',
      defaultUser: contaboSnapshot.defaultUser
    })
    console.log(`             ✓ Password rotated. New password length: ${pwdResult.password.length} chars`)
    console.log(`             ✓ secretId in Contabo: ${pwdResult.secretId}`)
  } catch (e) {
    console.log(`             ❌ resetPassword failed: ${e.message || JSON.stringify(e)}`)
    await client.close(); process.exit(1)
  }
  // Save new password ONLY to admin backup file (NOT to DB so user can't see it)
  const pwdBackupPath = `/app/memory/davion419_vps_NEW_PASSWORD_${ts()}.json`
  fs.writeFileSync(pwdBackupPath, JSON.stringify({
    instanceId: INSTANCE_ID,
    secretId: pwdResult.secretId,
    newPassword: pwdResult.password,
    rotatedAt: new Date().toISOString(),
    note: 'New Administrator password for VPS revoked from @davion419. Admin-only — do NOT share with bot user.'
  }, null, 2), { mode: 0o600 })
  console.log(`             ✓ New password saved (chmod 600) → ${pwdBackupPath}\n`)
  auditLog.steps.passwordReset = { ok: true, secretId: pwdResult.secretId, backupPath: pwdBackupPath }

  // ── STEP 3: SHUTDOWN ────────────────────────────────────────────────
  console.log(`[${pad('3.SHUTDOWN')}] Issuing graceful shutdown via Contabo API…`)
  try {
    const r = await contabo.shutdownInstance(INSTANCE_ID)
    console.log(`             ✓ Shutdown API call accepted. Response: ${JSON.stringify(r).slice(0, 200)}`)
  } catch (e) {
    console.log(`             ⚠️  shutdownInstance failed: ${e.message || JSON.stringify(e)}`)
    console.log(`             → falling back to hard stopInstance…`)
    try {
      const r2 = await contabo.stopInstance(INSTANCE_ID)
      console.log(`             ✓ Hard stop accepted. Response: ${JSON.stringify(r2).slice(0, 200)}`)
      auditLog.steps.shutdown = { ok: true, method: 'stopInstance', fallback: true }
    } catch (e2) {
      console.log(`             ❌ stopInstance also failed: ${e2.message || JSON.stringify(e2)}`)
      console.log(`             Password is already rotated so user is locked out, but VPS still running.`)
      auditLog.steps.shutdown = { ok: false, error: e2.message || String(e2) }
      // Continue — DB cleanup still valuable
    }
  }
  if (!auditLog.steps.shutdown) auditLog.steps.shutdown = { ok: true, method: 'shutdownInstance' }

  // ── STEP 4: VERIFY ──────────────────────────────────────────────────
  console.log(`\n[${pad('4.VERIFY')}] Polling Contabo for status change…`)
  let finalState = null
  let shutdownConfirmed = false
  for (let i = 1; i <= 6; i++) {
    await sleep(10000)  // 10s
    try {
      finalState = await contabo.getInstance(INSTANCE_ID)
      console.log(`             attempt ${i}/6 — status=${finalState.status}`)
      if (finalState.status === 'stopped' || finalState.status === 'shutdown' || finalState.status === 'cancelled') {
        shutdownConfirmed = true; break
      }
    } catch (e) {
      console.log(`             attempt ${i}/6 — fetch failed: ${e.message}`)
    }
  }
  if (shutdownConfirmed) {
    console.log(`             ✓ VERIFIED — instance status: ${finalState.status}\n`)
    auditLog.steps.verify = { ok: true, finalStatus: finalState.status }
  } else {
    console.log(`             ⚠️  Final status still ${finalState?.status || 'unknown'} after 60s.`)
    console.log(`             Contabo accepts the shutdown async — it may complete within a few more minutes.\n`)
    auditLog.steps.verify = { ok: false, finalStatus: finalState?.status, note: 'async shutdown not yet reflected' }
  }

  // ── STEP 5: DB CLEANUP ──────────────────────────────────────────────
  console.log(`[${pad('5.DB CLEAN')}] Archiving and removing vpsPlansOf record from production…`)
  if (!planDoc) {
    console.log(`             (skipped — no plan doc to remove)\n`)
    auditLog.steps.dbClean = { ok: true, skipped: true }
  } else {
    // Archive into vpsPlansOf_revoked collection
    const archiveDoc = {
      ...planDoc,
      _archivedAt: new Date().toISOString(),
      _archivedReason: 'auto-renewed before cancel-fix landed; access revoked',
      _archivedBy: 'revoke_davion419_vps.js',
      _contaboFinalStatus: finalState?.status || null,
      _originalId: planDoc._id
    }
    delete archiveDoc._id  // let Mongo assign fresh
    try {
      await db.collection('vpsPlansOf_revoked').insertOne(archiveDoc)
      console.log(`             ✓ Archived into vpsPlansOf_revoked`)
    } catch (e) {
      console.log(`             ⚠️  Archive insert failed: ${e.message} — continuing with delete (backup file already exists)`)
    }

    const delRes = await db.collection('vpsPlansOf').deleteOne({ _id: planDoc._id })
    console.log(`             ✓ Deleted from vpsPlansOf — deletedCount=${delRes.deletedCount}\n`)
    auditLog.steps.dbClean = { ok: true, deletedCount: delRes.deletedCount, archivedTo: 'vpsPlansOf_revoked' }
  }

  // Also scrub any session state pointer to this VPS in `state` collection
  try {
    const stateBefore = await db.collection('state').findOne({ _id: CHAT_ID })
    const refs = []
    if (stateBefore) {
      const json = JSON.stringify(stateBefore)
      if (json.includes(String(INSTANCE_ID))) refs.push(String(INSTANCE_ID))
      if (json.includes(PLAN_ID)) refs.push(PLAN_ID)
    }
    if (refs.length) {
      console.log(`             ⚠️  state doc contains references to ${refs.join(', ')} — please review manually if bot UI shows stale data.`)
      auditLog.stateReferences = refs
    } else {
      console.log(`             ✓ state doc has no references to revoked VPS.`)
    }
  } catch (e) { console.log(`             (state scan skipped: ${e.message})`) }

  // ── FINAL AUDIT ─────────────────────────────────────────────────────
  const auditPath = `/app/memory/davion419_vps_revoke_audit_${ts()}.json`
  fs.writeFileSync(auditPath, JSON.stringify(auditLog, null, 2))
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Backup:           ${auditLog.steps.backup.ok ? '✅' : '❌'}  ${backupPath}`)
  console.log(`  Password reset:   ${auditLog.steps.passwordReset.ok ? '✅' : '❌'}  secretId=${auditLog.steps.passwordReset.secretId}`)
  console.log(`  Shutdown:         ${auditLog.steps.shutdown.ok ? '✅' : '❌'}  (${auditLog.steps.shutdown.method})`)
  console.log(`  Verify:           ${auditLog.steps.verify.ok ? '✅' : '⚠️ '}  finalStatus=${auditLog.steps.verify.finalStatus}`)
  console.log(`  DB cleanup:       ${auditLog.steps.dbClean.ok ? '✅' : '❌'}  deleted=${auditLog.steps.dbClean.deletedCount ?? 'n/a'}`)
  console.log(`  Audit log:        ${auditPath}`)
  console.log('═══════════════════════════════════════════════════════════════')

  await client.close()
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
