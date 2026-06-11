/**
 * Build a complete orphan VPS map: every Contabo instance vs vpsPlansOf vs state.
 * Uses CORRECT field name: contaboInstanceId (not val.instanceId).
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const contabo = require('/app/js/contabo-service.js')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  const allInstances = await contabo.listInstances()
  console.log(`\n=== ${allInstances.length} live Contabo instances ===\n`)

  const orphans = []
  for (const i of allInstances) {
    const dbRec = await db.collection('vpsPlansOf').findOne({ contaboInstanceId: i.instanceId })
    const dbStr = dbRec ? `chatId=${dbRec.chatId} status=${dbRec.status}` : '— NO DB MATCH —'

    // Extract chatId from displayName: nomadly-<chatId>-<timestamp>
    let chatIdFromName = null
    const m = (i.displayName || '').match(/nomadly-(\d+)-/)
    if (m) chatIdFromName = m[1]

    // Check user state if we can extract chatId
    let stateInfo = null
    if (chatIdFromName) {
      const state = await db.collection('state').findOne({ _id: chatIdFromName })
      const vd = state?.val?.vpsDetails || state?.vpsDetails
      stateInfo = vd?._id == String(i.instanceId) ? `state matches` : `state diverges (state._id=${vd?._id})`
    }

    const orphan = !dbRec
    if (orphan) orphans.push({ instance: i, chatId: chatIdFromName, stateInfo })

    console.log(`${orphan ? '⚠️ ' : '✓ '}${i.instanceId} | ${i.status.padEnd(10)} | ${i.displayName?.padEnd(35) || ''} | cancelDate=${i.cancelDate || '—'} | nameChatId=${chatIdFromName || '—'} | ${dbStr}${stateInfo ? ' | ' + stateInfo : ''}`)
  }

  console.log(`\n=== Summary: ${orphans.length} orphan instances ===`)
  for (const o of orphans) {
    console.log(`  - #${o.instance.instanceId} | ${o.instance.status} | chatId=${o.chatId || '?'} | product=${o.instance.productId} | ip=${o.instance.ipConfig?.v4?.ip || '?'} | cancelDate=${o.instance.cancelDate || '—'} | ${o.stateInfo}`)
  }

  // Audit: how many vpsPlansOf records are orphaned (not in Contabo)?
  console.log(`\n=== vpsPlansOf records NOT matching any live Contabo instance ===`)
  const allDbVps = await db.collection('vpsPlansOf').find({}).toArray()
  const liveIds = new Set(allInstances.map(i => i.instanceId))
  for (const r of allDbVps) {
    if (!liveIds.has(r.contaboInstanceId)) {
      console.log(`  - DB instance #${r.contaboInstanceId} | chatId=${r.chatId} | status=${r.status} | deletedAt=${r.deletedAt || '—'} | name=${r.name}`)
    }
  }

  await client.close()
})().catch(e => { console.error('Fatal:', e); process.exit(1) })
