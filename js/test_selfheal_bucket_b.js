#!/usr/bin/env node
/**
 * READ-ONLY simulation of the new Bucket-B (autoRenewable=false + cancel-never-propagated).
 * Lists any production plan that would be auto-backfill-cancelled by the
 * extended self-heal guard on its next cycle.
 */
const fs = require('fs')
const { MongoClient, ServerApiVersion } = require('mongodb')
const contabo = require('./contabo-service.js')

const env = JSON.parse(fs.readFileSync('/app/memory/railway_prod_env.json', 'utf8'))

;(async () => {
  const client = new MongoClient(env.MONGO_URL, { serverApi: ServerApiVersion.v1, serverSelectionTimeoutMS: 60000 })
  await client.connect()
  const db = client.db(env.DB_NAME || 'test')
  const plans = await db.collection('vpsPlansOf').find({
    autoRenewable: false,
    status: { $in: ['RUNNING', 'running', 'INSTALLING', 'installing', 'provisioning'] },
    _contaboCancelledEarly: { $ne: true }
  }).toArray()
  console.log(`Bucket B candidates: ${plans.length}\n`)
  for (const p of plans) {
    const cid = p.contaboInstanceId ?? p.vpsId
    let live
    try { live = await contabo.getInstance(cid) }
    catch (e) { console.log(`  ${cid} chat=${p.chatId} | DB-only (Contabo 404)`); continue }
    const action = live.cancelDate ? 'already-cancelled' : (live.status === 'pending_payment' ? 'manual-needed' : 'WILL-BACKFILL-CANCEL')
    console.log(`  ${cid} chat=${p.chatId} | live=${live.status} cancelDate=${live.cancelDate || '-'} | end_time=${p.end_time} | action=${action}`)
  }
  await client.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
