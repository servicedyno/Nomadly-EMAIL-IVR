// READ-ONLY investigation for @hellpeaces cPanel renewal + file-delete issue.
// No writes. Usage: node scripts/investigate_hellpeaces_renewal.js
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('/app/node_modules/mongodb')

const CHAT = '5522767823' // @hellpeaces per cpanel-routes.js code comments

function short(v, n = 500) {
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s && s.length > n ? s.slice(0, n) + '…' : s
}

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  console.log('DB:', process.env.DB_NAME || 'test', '\n')

  // 1. Resolve user identity
  const state = await db.collection('state').findOne({ _id: CHAT })
  const users = await db.collection('users').findOne({ _id: CHAT }).catch(() => null)
  console.log('══ USER IDENTITY (chatId ' + CHAT + ') ══')
  console.log('state.username:', state?.username || state?.userName)
  console.log('state.userLanguage:', state?.userLanguage)
  console.log('users doc:', users ? short(users, 300) : 'none')

  // 2. cPanel / hosting accounts
  console.log('\n══ cpanelAccounts (all, incl. terminated) ══')
  const cpAll = await db.collection('cpanelAccounts')
    .find({ $or: [{ chatId: CHAT }, { chatId: Number(CHAT) }] }).toArray()
  for (const a of cpAll) {
    console.log('\n • domain=%s cpUser=%s plan=%s', a.domain, a.cpUser, a.plan)
    console.log('   _id=%s whmHost=%s', a._id, a.whmHost)
    console.log('   expiryDate=%s  lastRenewedAt=%s  renewalCount=%s', a.expiryDate, a.lastRenewedAt, a.renewalCount)
    console.log('   renewalPriceUsd=%s  autoRenew=%s  suspended=%s  suspendedAt=%s', a.renewalPriceUsd, a.autoRenew, a.suspended, a.suspendedAt)
    console.log('   deleted=%s  terminatedOnWhm=%s  createdAt=%s', a.deleted, a.terminatedOnWhm, a.createdAt || a.created)
    console.log('   FULL:', short(a, 1200))
  }
  if (!cpAll.length) console.log('  (none)')

  // 3. Wallet
  console.log('\n══ walletOf ══')
  const w = await db.collection('walletOf').findOne({ $or: [{ _id: CHAT }, { _id: Number(CHAT) }] })
  if (w) {
    const bal = (w.usdIn || 0) - (w.usdOut || 0)
    console.log('  usdIn=%s usdOut=%s  → balance=$%s', w.usdIn, w.usdOut, bal.toFixed(4))
    console.log('  FULL:', short(w, 600))
  } else console.log('  (no wallet)')

  // 4. walletLedger — recent debits (auto-renew path writes here)
  console.log('\n══ walletLedger (last 40 for chatId, newest first) ══')
  const led = await db.collection('walletLedger')
    .find({ $or: [{ chatId: CHAT }, { chatId: Number(CHAT) }] })
    .sort({ timestamp: -1 }).limit(40).toArray()
  for (const l of led) {
    console.log('  [%s] type=%s amount=%s balAfter=%s desc=%s', 
      (l.timestamp instanceof Date ? l.timestamp.toISOString() : l.timestamp), l.type, l.amount, l.balanceAfter, short(l.description, 120))
  }
  if (!led.length) console.log('  (none)')

  // 5. payments legacy — manual renew writes "Wallet,HostingRenew,..."
  console.log('\n══ payments (legacy) matching chatId & Renew/Hosting ══')
  const pays = await db.collection('payments')
    .find({ $or: [
      { val: { $regex: CHAT } },
      { value: { $regex: CHAT } },
    ] }).sort({ _id: -1 }).limit(60).toArray().catch(() => [])
  const relPays = pays.filter(p => {
    const v = String(p.val || p.value || '')
    return /renew|hosting|cpanel/i.test(v)
  })
  for (const p of relPays) console.log('  _id=%s val=%s', p._id, short(p.val || p.value, 200))
  if (!relPays.length) console.log('  (none matched renew/hosting; total payments w/ chatId=' + pays.length + ')')

  // 6. hostingTransactions
  console.log('\n══ hostingTransactions (last 30) ══')
  const ht = await db.collection('hostingTransactions')
    .find({ $or: [{ chatId: CHAT }, { chatId: Number(CHAT) }] })
    .sort({ _id: -1 }).limit(30).toArray().catch(() => [])
  for (const t of ht) console.log('  ', short(t, 250))
  if (!ht.length) console.log('  (none)')

  // 7. Scan ALL collections for any doc referencing this chatId updated recently
  console.log('\n══ Collections containing this chatId ══')
  const cols = (await db.listCollections().toArray()).map(c => c.name)
  for (const cn of cols) {
    try {
      const cnt = await db.collection(cn).countDocuments({ $or: [
        { chatId: CHAT }, { chatId: Number(CHAT) },
        { userId: CHAT }, { user_id: CHAT },
      ] })
      if (cnt > 0) console.log('  · %s : %d', cn, cnt)
    } catch (_) {}
  }

  await client.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
