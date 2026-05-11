#!/usr/bin/env node
/**
 * READ-ONLY simulation of reconcileContaboBillingDrift() against production.
 * Just prints what the daily drift check would do — no writes, no Contabo
 * calls beyond getInstance.
 */
const fs = require('fs')
const { MongoClient, ServerApiVersion } = require('mongodb')
const contabo = require('./contabo-service.js')

const env = JSON.parse(fs.readFileSync('/app/memory/railway_prod_env.json', 'utf8'))

;(async () => {
  const client = new MongoClient(env.MONGO_URL, { serverApi: ServerApiVersion.v1, serverSelectionTimeoutMS: 60000 })
  await client.connect()
  const db = client.db(env.DB_NAME || 'test')
  const vpsPlansOf = db.collection('vpsPlansOf')

  console.log('Bucket A: autoRenewable=false missing Contabo cancelDate')
  const a = await vpsPlansOf.find({
    autoRenewable: false,
    status: { $in: ['RUNNING','running','INSTALLING','installing','provisioning'] },
    _contaboCancelledEarly: { $ne: true }
  }).toArray()
  console.log(`  ${a.length} candidate(s)`)
  for (const p of a) {
    const cid = p.contaboInstanceId ?? p.vpsId
    try {
      const live = await contabo.getInstance(cid)
      let act = 'noop'
      if (live.cancelDate) act = 'sync-flag (already cancelled on Contabo)'
      else if (live.status === 'pending_payment') act = 'skip (pending_payment)'
      else if (live.status === 'cancelled' || live.status === 'stopped') act = 'skip (already off)'
      else act = 'WOULD CALL /cancel'
      console.log(`  ${cid} chat=${p.chatId} live=${live.status} cancelDate=${live.cancelDate || '-'} → ${act}`)
    } catch (e) { console.log(`  ${cid} fetch err: ${e.message}`) }
  }

  console.log('\nBucket B: _uncancelPending=true (admin Resume Subscription needed)')
  const b = await vpsPlansOf.find({ _uncancelPending: true }).toArray()
  console.log(`  ${b.length} candidate(s)`)
  for (const p of b) {
    const cid = p.contaboInstanceId ?? p.vpsId
    try {
      const live = await contabo.getInstance(cid)
      const act = !live.cancelDate ? 'clear-flag (admin already resumed)' : 'WOULD NAG ADMIN'
      console.log(`  ${cid} chat=${p.chatId} cancelDate=${live.cancelDate || '-'} → ${act}`)
    } catch (e) { console.log(`  ${cid} fetch err: ${e.message}`) }
  }
  await client.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
