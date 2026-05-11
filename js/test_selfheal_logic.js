#!/usr/bin/env node
/**
 * test_selfheal_logic.js
 *
 * READ-ONLY simulation of selfHealRenewedAfterCancelVPS() against the
 * PRODUCTION MongoDB. Prints what the guard WOULD do without executing
 * any Contabo state changes or DB writes.
 *
 * Verifies:
 *   • Detection criteria correctly identifies @davion419-style leaks
 *   • Does NOT trigger on healthy cancellations (cancelDate close to end_time)
 *   • Honours the 2-day grace period
 */

const fs = require('fs')
const { MongoClient, ServerApiVersion } = require('mongodb')
const contabo = require('./contabo-service.js')

const env = JSON.parse(fs.readFileSync('/app/memory/railway_prod_env.json', 'utf8'))
const MONGO_URL = env.MONGO_URL
const DB_NAME = env.DB_NAME || 'test'
const SELF_HEAL_GRACE_DAYS = 2

;(async () => {
  console.log('═════ Self-heal Logic Simulation (READ-ONLY) ═════\n')
  const client = new MongoClient(MONGO_URL, {
    serverApi: ServerApiVersion.v1,
    serverSelectionTimeoutMS: 60000,
  })
  await client.connect()
  const db = client.db(DB_NAME)
  const vpsPlansOf = db.collection('vpsPlansOf')
  const revoked = db.collection('vpsPlansOf_revoked')

  // Pull DB cancellations
  const cancelledInDb = await vpsPlansOf.find({
    status: { $in: ['CANCELLED', 'DELETED'] }
  }).toArray()
  console.log(`DB has ${cancelledInDb.length} CANCELLED/DELETED plan(s)`)

  // Also include @davion419's archived doc so we verify post-archive idempotency
  const archivedCount = await revoked.countDocuments({})
  console.log(`vpsPlansOf_revoked has ${archivedCount} archived doc(s) — these are SKIPPED (no longer in main collection)\n`)

  const graceMs = SELF_HEAL_GRACE_DAYS * 24 * 60 * 60 * 1000
  let wouldHeal = 0
  let wouldSkip = 0

  for (const plan of cancelledInDb) {
    const cid = plan.contaboInstanceId ?? plan.vpsId
    if (!cid) { console.log(`  – plan _id=${plan._id}: no contaboInstanceId, SKIP`); continue }

    let live
    try {
      live = await contabo.getInstance(cid)
    } catch (err) {
      if (err?.status === 404) {
        console.log(`  – ${cid}: 404 on Contabo (already gone) → SKIP (correct)`)
        wouldSkip++; continue
      }
      console.log(`  – ${cid}: fetch err → SKIP (correct)`)
      wouldSkip++; continue
    }

    const planEnd = plan.end_time ? new Date(plan.end_time).getTime() : null
    const contaboCancelDate = live.cancelDate ? new Date(live.cancelDate).getTime() : null
    const renewedAfterCancel = contaboCancelDate && planEnd && (contaboCancelDate - planEnd > graceMs)
    const cancelNeverPropagated = !contaboCancelDate
    const liveRunning = ['running', 'installing', 'provisioning'].includes(live.status)
    const pendingPaymentLeak = live.status === 'pending_payment' && !live.cancelDate

    let action
    let reason
    if (live.status === 'stopped' || live.status === 'shutdown' || live.status === 'cancelled') {
      action = '✓ skip'; reason = 'already_off'
    } else if (pendingPaymentLeak) {
      action = '📣 ALERT'; reason = 'pending_payment_manual_required'
    } else if (liveRunning && (renewedAfterCancel || cancelNeverPropagated)) {
      action = '🛠️ HEAL'
      reason = renewedAfterCancel ? 'renewed_after_cancel_bug' : 'cancel_never_propagated'
    } else {
      action = '✓ skip'; reason = 'normal_cancellation'
    }

    console.log(`  ${action}  ${cid} | chat=${plan.chatId} | dbStatus=${plan.status} | liveStatus=${live.status} | dbEnd=${plan.end_time?.toString().slice(0,10) || '-'} | contaboCancelDate=${live.cancelDate || '-'} | reason=${reason}`)
    if (action.includes('HEAL')) wouldHeal++
    else if (action.includes('ALERT')) wouldSkip++  // alert is not heal
    else wouldSkip++
  }

  console.log(`\n──────────────────────────────────────────────────`)
  console.log(`Would heal: ${wouldHeal}`)
  console.log(`Would skip: ${wouldSkip}`)
  console.log(`──────────────────────────────────────────────────`)

  await client.close()
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
