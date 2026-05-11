#!/usr/bin/env node
const fs = require('fs')
const { MongoClient, ServerApiVersion } = require('mongodb')
const contabo = require('./contabo-service.js')

const env = JSON.parse(fs.readFileSync('/app/memory/railway_prod_env.json', 'utf8'))
const MONGO_URL = env.MONGO_URL
const DB_NAME = env.DB_NAME || 'test'
const CHAT_ID = 404562920
const USERNAME = 'davion419'

function fmt(d) { if (!d) return 'N/A'; try { return new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' } catch { return String(d) } }
function ago(d) { if (!d) return ''; const diff = (Date.now() - new Date(d).getTime()) / 1000; if (diff < 0) return `(in ${Math.abs(diff/3600).toFixed(1)}h)`; const h = diff/3600; if (h < 48) return `(${h.toFixed(1)}h ago)`; return `(${(h/24).toFixed(1)}d ago)` }

;(async () => {
  console.log(`═════ Production lookup: @${USERNAME} (chatId=${CHAT_ID}) ═════\n`)
  const client = new MongoClient(MONGO_URL, { serverApi: ServerApiVersion.v1 })
  await client.connect()
  const db = client.db(DB_NAME)

  // STATE
  const state = await db.collection('state').findOne({ _id: CHAT_ID })
  if (state) {
    console.log('👤 state document:')
    console.log('   username:', state.username)
    console.log('   firstName:', state.firstName || state.first_name)
    console.log('   balance:', state.balance)
    console.log('   blocked:', state.blocked)
    console.log('   lastSeen:', fmt(state.lastSeen || state.last_seen))
  }

  // candidate chatId variants
  const idVariants = [CHAT_ID, String(CHAT_ID)]

  // VPS PLANS
  const vpsCol = db.collection('vpsPlansOf')
  const plans = await vpsCol.find({ $or: [
    { chatId: { $in: idVariants } },
    { chat_id: { $in: idVariants } },
  ] }).toArray()

  console.log(`\n📦 vpsPlansOf records for ${CHAT_ID}: ${plans.length}`)
  for (const p of plans) {
    console.log(`\n   ─ VPS plan _id=${p._id}`)
    console.log(`     contaboInstanceId: ${p.contaboInstanceId ?? p.vpsId ?? '-'}`)
    console.log(`     label:             ${p.label || p.name || '-'}`)
    console.log(`     status:            ${p.status}`)
    console.log(`     productId/region:  ${p.productId || '-'} / ${p.region || '-'}`)
    console.log(`     osType:            ${p.osType || '-'}`)
    console.log(`     planPrice:         $${p.planPrice}`)
    console.log(`     autoRenewable:     ${p.autoRenewable}`)
    console.log(`     start_time:        ${fmt(p.start_time)} ${ago(p.start_time)}`)
    console.log(`     end_time:          ${fmt(p.end_time)} ${ago(p.end_time)}`)
    console.log(`     createdAt:         ${fmt(p.createdAt || p.created_at)}`)
    console.log(`     cancelledAt:       ${fmt(p.cancelledAt)}`)
    console.log(`     deletedAt:         ${fmt(p.deletedAt)}`)
    console.log(`     renewalAttempts:   ${p.renewalAttempts ?? '-'}`)
    console.log(`     lastRenewalError:  ${p.lastRenewalError || '-'}`)
    console.log(`     pendingCancelAt:   ${fmt(p.pendingCancelAt)}`)
    console.log(`     contaboCancelDate: ${p.contaboCancelDate || '-'}`)

    const cid = p.contaboInstanceId ?? p.vpsId
    if (cid) {
      try {
        const live = await contabo.getInstance(cid)
        console.log(`     ── live Contabo (${cid}) ──`)
        console.log(`        status:           ${live.status}`)
        console.log(`        cancelDate:       ${live.cancelDate || '-'}`)
        console.log(`        productId/region: ${live.productId}/${live.region}`)
        console.log(`        ip:               ${live.ipConfig?.v4?.ip || 'pending'}`)
        console.log(`        createdDate:      ${fmt(live.createdDate)}`)
        console.log(`        name:             ${live.name || live.displayName}`)
      } catch (e) {
        console.log(`     ⚠️  Contabo lookup failed: ${e.message}`)
      }
    }
  }

  // Audit / order history
  for (const colName of ['transactions', 'walletHistory', 'auditLog', 'vpsAuditLog', 'orderHistory', 'paymentHistory', 'vpsCancellationLog']) {
    try {
      const exists = await db.listCollections({ name: colName }).hasNext()
      if (!exists) continue
      const recent = await db.collection(colName).find({ $or: [
        { chatId: { $in: idVariants } }, { chat_id: { $in: idVariants } }
      ] }).sort({ createdAt: -1 }).limit(10).toArray()
      if (recent.length) {
        console.log(`\n  [${colName}] last ${recent.length}`)
        for (const r of recent) {
          const ts = r.createdAt || r.created_at || r.timestamp
          console.log(`    ${fmt(ts)} | ${r.type || r.action || r.event || '-'} | amt=${r.amount ?? '-'} | ${(r.note || r.message || r.description || '').toString().slice(0,120)}`)
        }
      }
    } catch (e) {}
  }

  await client.close()
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
