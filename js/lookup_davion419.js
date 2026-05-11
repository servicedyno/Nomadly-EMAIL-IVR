#!/usr/bin/env node
/**
 * lookup_davion419.js
 *
 * Connects to PRODUCTION MongoDB (via Railway-exported MONGO_URL) and inspects
 * the VPS / user state for the bot user with Telegram username `davion419`.
 *
 * READ ONLY.
 */

const fs = require('fs')
const { MongoClient, ServerApiVersion } = require('mongodb')
const contabo = require('./contabo-service.js')

const env = JSON.parse(fs.readFileSync('/app/memory/railway_prod_env.json', 'utf8'))
const MONGO_URL = env.MONGO_URL
const DB_NAME = env.DB_NAME || 'test'
const USERNAME = 'davion419'

function fmt(d) {
  if (!d) return 'N/A'
  try { return new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' } catch { return String(d) }
}

;(async () => {
  console.log(`═════ Production lookup: @${USERNAME} ═════\n`)
  const client = new MongoClient(MONGO_URL, { serverApi: ServerApiVersion.v1 })
  await client.connect()
  const db = client.db(DB_NAME)

  // 1. Find user document
  const users = db.collection('users')
  const userQuery = { $or: [
    { username: USERNAME },
    { username: new RegExp(`^${USERNAME}$`, 'i') },
    { telegramUsername: USERNAME },
    { tg_username: USERNAME },
    { handle: USERNAME },
  ] }
  let userDocs = await users.find(userQuery).toArray()
  if (!userDocs.length) {
    // fallback: scan any user collection
    const cols = await db.listCollections().toArray()
    console.log('No match in `users`. Looking in alt collections…')
    for (const c of cols) {
      try {
        const found = await db.collection(c.name).find({ username: USERNAME }).limit(5).toArray()
        if (found.length) {
          console.log(`Found in ${c.name}: ${found.length} doc(s)`)
          userDocs.push(...found.map(d => ({ _foundIn: c.name, ...d })))
        }
      } catch {}
    }
  }

  if (!userDocs.length) {
    console.log(`❌ No user named @${USERNAME} found in any collection.`)
    await client.close()
    return
  }

  for (const u of userDocs) {
    console.log(`👤 User doc (in ${u._foundIn || 'users'}):`)
    console.log(`   chatId/_id: ${u.chatId || u.chat_id || u._id}`)
    console.log(`   username:   ${u.username}`)
    console.log(`   firstName:  ${u.firstName || u.first_name || '-'}`)
    console.log(`   lastName:   ${u.lastName || u.last_name || '-'}`)
    console.log(`   balance:    ${u.balance ?? u.wallet ?? '-'}`)
    console.log(`   createdAt:  ${fmt(u.createdAt || u.created_at)}`)
  }

  const chatIds = [...new Set(userDocs.map(u => u.chatId || u.chat_id).filter(Boolean))]
  if (!chatIds.length) {
    console.log('No chatId derivable from user docs.')
    await client.close()
    return
  }

  // 2. Find VPS plans
  console.log(`\n📦 vpsPlansOf for chatId(s) ${chatIds.join(', ')}:`)
  const vpsCol = db.collection('vpsPlansOf')
  const plans = await vpsCol.find({ $or: [
    { chatId: { $in: chatIds } },
    { chat_id: { $in: chatIds } },
    { chatId: { $in: chatIds.map(String) } },
  ] }).toArray()

  if (!plans.length) {
    console.log('   (no VPS plan records)')
  }
  for (const p of plans) {
    console.log(`\n   • VPS plan id=${p._id}`)
    console.log(`     contaboInstanceId: ${p.contaboInstanceId ?? p.vpsId ?? '-'}`)
    console.log(`     label:             ${p.label || p.name || '-'}`)
    console.log(`     status:            ${p.status}`)
    console.log(`     productId/region:  ${p.productId || '-'} / ${p.region || '-'}`)
    console.log(`     planPrice:         $${p.planPrice}`)
    console.log(`     autoRenewable:     ${p.autoRenewable}`)
    console.log(`     start_time:        ${fmt(p.start_time)}`)
    console.log(`     end_time:          ${fmt(p.end_time)}`)
    console.log(`     createdAt:         ${fmt(p.createdAt || p.created_at)}`)
    console.log(`     cancelledAt:       ${fmt(p.cancelledAt)}`)
    console.log(`     deletedAt:         ${fmt(p.deletedAt)}`)
    console.log(`     renewalAttempts:   ${p.renewalAttempts ?? '-'}`)
    console.log(`     lastRenewalError:  ${p.lastRenewalError || '-'}`)
    console.log(`     pendingCancelAt:   ${fmt(p.pendingCancelAt)}`)
    console.log(`     contaboCancelDate: ${p.contaboCancelDate || '-'}`)

    // 3. Cross-check live Contabo state for this instance
    const cid = p.contaboInstanceId ?? p.vpsId
    if (cid) {
      try {
        const live = await contabo.getInstance(cid)
        console.log(`     ── live Contabo state for ${cid} ──`)
        console.log(`        status:     ${live.status}`)
        console.log(`        cancelDate: ${live.cancelDate || '-'}`)
        console.log(`        productId:  ${live.productId}`)
        console.log(`        region:     ${live.region}`)
        console.log(`        ip:         ${live.ipConfig?.v4?.ip || 'pending'}`)
        console.log(`        createdAt:  ${fmt(live.createdDate)}`)
      } catch (e) {
        console.log(`     ⚠️  Contabo lookup failed: ${e.message}`)
      }
    }
  }

  // 4. Recent transactions / audit for this user
  console.log(`\n💳 Recent transactions / audit:`)
  for (const colName of ['transactions', 'walletHistory', 'auditLog', 'vpsAuditLog', 'orderHistory']) {
    try {
      const exists = await db.listCollections({ name: colName }).hasNext()
      if (!exists) continue
      const recent = await db.collection(colName).find({ $or: [
        { chatId: { $in: chatIds } }, { chat_id: { $in: chatIds } }
      ] }).sort({ createdAt: -1, created_at: -1, timestamp: -1 }).limit(8).toArray()
      if (recent.length) {
        console.log(`\n  [${colName}]`)
        for (const r of recent) {
          const ts = r.createdAt || r.created_at || r.timestamp
          console.log(`    ${fmt(ts)} | ${r.type || r.action || r.event || '-'} | amt=${r.amount ?? '-'} | ${r.note || r.message || r.description || ''}`)
        }
      }
    } catch {}
  }

  await client.close()
  console.log('\n═════ done ═════')
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
