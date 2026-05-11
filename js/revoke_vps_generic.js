#!/usr/bin/env node
/**
 * revoke_vps_generic.js <chatId> <instanceId> [planId]
 *
 * Generic revoke script — same flow as revoke_davion419_vps.js but parameterised.
 * Backup → password rotate → shutdown → archive+delete vpsPlansOf doc.
 */
const fs = require('fs')
const { MongoClient, ServerApiVersion } = require('mongodb')
const contabo = require('./contabo-service.js')

const [chatIdArg, instanceIdArg, planIdArg] = process.argv.slice(2)
if (!chatIdArg || !instanceIdArg) { console.error('Usage: node revoke_vps_generic.js <chatId> <instanceId> [planId]'); process.exit(1) }
const CHAT_ID = chatIdArg
const INSTANCE_ID = Number(instanceIdArg)
const PLAN_ID = planIdArg || null

const env = JSON.parse(fs.readFileSync('/app/memory/railway_prod_env.json', 'utf8'))
const MONGO_URL = env.MONGO_URL
const DB_NAME = env.DB_NAME || 'test'

function ts() { return new Date().toISOString().replace(/[:.]/g, '-') }
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function pad(l) { return l.padEnd(11) }

;(async () => {
  console.log(`═══ REVOKE VPS ${INSTANCE_ID} for chatId=${CHAT_ID} ═══`)
  const client = new MongoClient(MONGO_URL, {
    serverApi: ServerApiVersion.v1,
    serverSelectionTimeoutMS: 90000, connectTimeoutMS: 60000, socketTimeoutMS: 90000
  })
  await client.connect()
  const db = client.db(DB_NAME)

  const audit = { runAt: new Date().toISOString(), chatId: CHAT_ID, instanceId: INSTANCE_ID, steps: {} }

  // 1) backup
  console.log(`[${pad('1.BACKUP')}]`)
  let planDoc = PLAN_ID ? await db.collection('vpsPlansOf').findOne({ _id: PLAN_ID }) : null
  if (!planDoc) planDoc = await db.collection('vpsPlansOf').findOne({ contaboInstanceId: INSTANCE_ID })
  console.log(`  plan: ${planDoc ? '_id='+planDoc._id+' status='+planDoc.status : 'NOT FOUND'}`)
  const snap = await contabo.getInstance(INSTANCE_ID)
  console.log(`  Contabo: status=${snap.status} cancelDate=${snap.cancelDate || '-'} ip=${snap.ipConfig?.v4?.ip}`)
  const backupPath = `/app/memory/revoke_backup_${INSTANCE_ID}_${ts()}.json`
  fs.writeFileSync(backupPath, JSON.stringify({ planDoc, snap, capturedAt: new Date().toISOString() }, null, 2))
  console.log(`  ✓ ${backupPath}`)
  audit.steps.backup = { ok: true, backupPath, planFound: !!planDoc }

  // 2) password rotate
  console.log(`\n[${pad('2.PASSWORD')}]`)
  let pwd
  try {
    pwd = await contabo.resetPassword(INSTANCE_ID, { osType: snap.osType, isRDP: snap.osType === 'Windows', defaultUser: snap.defaultUser })
    const pwdPath = `/app/memory/revoke_NEW_PASSWORD_${INSTANCE_ID}_${ts()}.json`
    fs.writeFileSync(pwdPath, JSON.stringify({ instanceId: INSTANCE_ID, secretId: pwd.secretId, newPassword: pwd.password, rotatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 })
    console.log(`  ✓ secretId=${pwd.secretId} pwdLen=${pwd.password.length} → ${pwdPath}`)
    audit.steps.passwordReset = { ok: true, secretId: pwd.secretId, pwdPath }
  } catch (e) {
    console.log(`  ❌ ${e.message || JSON.stringify(e)}`)
    audit.steps.passwordReset = { ok: false, error: e.message }
  }

  // 3) IMMEDIATE cancel on Contabo (stops future pre-renewals)
  console.log(`\n[${pad('3.CANCEL')}]`)
  try {
    await contabo.cancelInstance(INSTANCE_ID)
    await sleep(5000)
    const v = await contabo.getInstance(INSTANCE_ID)
    if (v.cancelDate) {
      console.log(`  ✓ cancelDate set: ${v.cancelDate}`)
      audit.steps.cancel = { ok: true, cancelDate: v.cancelDate }
    } else {
      console.log(`  ⚠️  soft-success (cancelDate not yet visible)`)
      audit.steps.cancel = { ok: false, reason: 'soft_success' }
    }
  } catch (e) {
    console.log(`  ❌ ${e.message}`)
    audit.steps.cancel = { ok: false, error: e.message }
  }

  // 4) shutdown
  console.log(`\n[${pad('4.SHUTDOWN')}]`)
  await sleep(45000)  // settle reboot from password reset
  let stopped = false
  for (let i = 1; i <= 3; i++) {
    try {
      await contabo.shutdownInstance(INSTANCE_ID)
      await sleep(10000)
      const v = await contabo.getInstance(INSTANCE_ID)
      console.log(`  attempt ${i}: status=${v.status}`)
      if (v.status === 'stopped' || v.status === 'shutdown') { stopped = true; break }
    } catch (e) {
      const msg = e?.message || ''
      if (msg.includes('already stopped')) { stopped = true; console.log(`  ✓ already stopped`); break }
      console.log(`  attempt ${i} failed: ${msg}`)
      await sleep(15000)
    }
  }
  audit.steps.shutdown = { ok: stopped }

  // 5) DB cleanup
  console.log(`\n[${pad('5.DB CLEAN')}]`)
  if (planDoc) {
    const archive = { ...planDoc, _archivedAt: new Date().toISOString(), _archivedReason: 'manual_revoke_pre_renewal_leak', _archivedBy: 'revoke_vps_generic.js', _contaboFinalStatus: stopped ? 'stopped' : snap.status, _originalId: planDoc._id, _id: undefined }
    await db.collection('vpsPlansOf_revoked').insertOne(archive)
    const r = await db.collection('vpsPlansOf').deleteOne({ _id: planDoc._id })
    console.log(`  ✓ archived + deletedCount=${r.deletedCount}`)
    audit.steps.dbClean = { ok: true, deletedCount: r.deletedCount }
  } else {
    audit.steps.dbClean = { ok: true, skipped: true }
  }

  const auditPath = `/app/memory/revoke_audit_${INSTANCE_ID}_${ts()}.json`
  fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2))
  console.log(`\nAudit → ${auditPath}`)
  console.log('\nSUMMARY')
  for (const [k, v] of Object.entries(audit.steps)) console.log(`  ${k}: ${v.ok ? '✅' : '❌'} ${JSON.stringify(v).slice(0, 200)}`)
  await client.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
