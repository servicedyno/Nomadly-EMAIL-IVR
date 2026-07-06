/**
 * Contabo VPS reconciliation audit.
 *
 * 1. Lists every instance on the Contabo account (INT/15074667)
 * 2. Cross-references each instanceId against Mongo `vpsPlansOf` +
 *    `vpsPlansOf_revoked` to identify:
 *     - Customer-owned (linked in Mongo) → which customer + plan
 *     - Orphaned (on Contabo but NOT in Mongo) → likely failed-checkout
 *       provisioning where instance was created but plan record never saved
 * 3. Pulls Contabo audit log per instance (creation method, time, who)
 */
require('dotenv').config({ path: '/app/.env' })
const { MongoClient } = require('mongodb')
const contabo = require('/app/js/contabo-service.js')

;(async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Contabo VPS reconciliation — Customer ${process.env.CONTABO_CLIENT_ID}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const c = new MongoClient(process.env.MONGO_URL); await c.connect()
  const db = c.db(process.env.DB_NAME || 'test')

  // 1. Pull every Mongo VPS record
  const active  = await db.collection('vpsPlansOf').find({}).toArray()
  const revoked = await db.collection('vpsPlansOf_revoked').find({}).toArray()
  const mongoById = {}
  for (const r of active)  mongoById[String(r.contaboInstanceId || r.vpsId)] = { ...r, _bucket: 'active' }
  for (const r of revoked) mongoById[String(r.contaboInstanceId || r.vpsId)] = { ...r, _bucket: 'revoked' }
  console.log(`Mongo records: ${active.length} active + ${revoked.length} revoked = ${active.length + revoked.length} total`)

  // 2. Live instance list from Contabo
  const live = await contabo.listInstances()
  console.log(`Contabo live instances: ${live.length}`)

  console.log('')
  const rows = []
  for (const inst of live) {
    const id = String(inst.instanceId)
    const m = mongoById[id]
    rows.push({
      instanceId:    id,
      name:          inst.displayName || inst.name || '-',
      product:       inst.productId,
      ip:            inst.ipv4 || (inst.ipConfig?.v4?.ip) || '-',
      status:        inst.status,
      region:        inst.region,
      created:       inst.createdDate,
      mongoBucket:   m?._bucket || '⚠️ ORPHAN',
      mongoChatId:   m?.chatId || '-',
      mongoEndDate:  m?.end_time ? new Date(m.end_time).toISOString().slice(0,10) : '-',
      mongoStatus:   m?.status || '-',
    })
  }
  console.table(rows)

  // 3. Find Contabo-side instances NOT in Mongo (orphans)
  console.log('\n=== Orphans (on Contabo but NOT in Mongo) ===')
  const orphans = rows.filter(r => r.mongoBucket === '⚠️ ORPHAN')
  if (orphans.length === 0) {
    console.log('  ✅ none — every Contabo instance is tracked in Mongo')
  } else {
    for (const o of orphans) {
      console.log(`  ⚠️ ${o.instanceId}  ${o.product}  ip=${o.ip}  status=${o.status}  created=${o.created}  name=${o.name}`)
    }
  }

  // 4. Mongo records WITHOUT a live Contabo counterpart (ghosts)
  console.log('\n=== Mongo records with no live Contabo match (likely deleted on Contabo side) ===')
  const liveIds = new Set(live.map(l => String(l.instanceId)))
  const ghostActive = active.filter(r => !liveIds.has(String(r.contaboInstanceId || r.vpsId)))
  for (const g of ghostActive) {
    console.log(`  vpsId=${g.contaboInstanceId || g.vpsId}  chatId=${g.chatId}  product=${g.productId}  status=${g.status}  host=${g.host}  end_time=${g.end_time}`)
  }
  if (ghostActive.length === 0) console.log('  ✅ none')

  await c.close()
})().catch(e => { console.error('FATAL', e?.response?.data || e.message); process.exit(1) })
