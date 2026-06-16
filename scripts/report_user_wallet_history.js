/**
 * READ-ONLY production wallet + transaction report for a single chatId.
 * No writes, no mutations. Pulls:
 *   - walletOf entry  → current balance (usdIn - usdOut)
 *   - walletLedger   → wallet debits (chargeWalletInUsdOnly path)
 *   - any payment/transaction collection that has a chatId-indexed record
 * Outputs a chronologically sorted human-readable history.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const MONGO = process.env.MONGO_URL
const CHAT_ID = process.argv[2] || '6550622589'

;(async () => {
  const cli = new MongoClient(MONGO, { serverSelectionTimeoutMS: 12000 })
  await cli.connect()
  const dbList = await cli.db().admin().listDatabases()
  console.log('Available DBs:', dbList.databases.map(d => `${d.name}(${d.sizeOnDisk}b)`).join(', '))
  // Telegram bot uses the default DB embedded in MONGO_URL (no DB path → "test" or similar).
  // The schema doc says collections are at root — use the URL's default db.
  const db = cli.db()
  console.log(`\nUsing database: ${db.databaseName}`)
  const cols = (await db.listCollections().toArray()).map(c => c.name)
  console.log(`Collections (${cols.length}):`, cols.join(', '))

  console.log('\n══════════════════════════════════════════════════════════')
  console.log(` User report for chatId = ${CHAT_ID}`)
  console.log('══════════════════════════════════════════════════════════')

  // ── 1. Identity ───────────────────────────────────────────────────
  const tryGet = async (col, query) => {
    if (!cols.includes(col)) return null
    return db.collection(col).findOne(query)
  }
  const idStr = String(CHAT_ID), idNum = Number(CHAT_ID)

  const wallet  = await tryGet('walletOf',     { _id: idStr }) || await tryGet('walletOf',     { _id: idNum })
  const name    = await tryGet('nameOf',       { _id: idStr }) || await tryGet('nameOf',       { _id: idNum })
  const chatMap = await tryGet('chatIdOf',     { _id: idStr }) || await tryGet('chatIdOf',     { _id: idNum })
  const login   = await tryGet('loginCountOf', { _id: idStr }) || await tryGet('loginCountOf', { _id: idNum })

  console.log(`\nIdentity:`)
  console.log(`  display name : ${name?.val || '(unknown)'}`)
  console.log(`  chatIdOf     : ${chatMap?.val ? JSON.stringify(chatMap.val).substring(0, 120) : '(none)'}`)
  console.log(`  login count  : ${login?.val || 0}   last login: ${login?.lastLogin || '-'}`)

  console.log(`\nWallet (walletOf._id=${CHAT_ID}):`)
  if (!wallet) {
    console.log('  (no walletOf record)')
  } else {
    const usdIn = wallet.usdIn || 0, usdOut = wallet.usdOut || 0
    const ngnIn = wallet.ngnIn || 0, ngnOut = wallet.ngnOut || 0
    console.log(`  usdIn  = $${usdIn.toFixed(4)}`)
    console.log(`  usdOut = $${usdOut.toFixed(4)}`)
    console.log(`  USD balance = $${(usdIn - usdOut).toFixed(4)}`)
    console.log(`  ngnIn  = ₦${ngnIn.toLocaleString()}`)
    console.log(`  ngnOut = ₦${ngnOut.toLocaleString()}`)
    console.log(`  NGN balance = ₦${(ngnIn - ngnOut).toLocaleString()}`)
  }

  // ── 2. walletLedger (deductions) ──────────────────────────────────
  if (cols.includes('walletLedger')) {
    const ledger = await db.collection('walletLedger')
      .find({ $or: [{ chatId: idStr }, { chatId: idNum }] })
      .sort({ timestamp: -1 }).toArray()
    console.log(`\nwalletLedger entries: ${ledger.length}`)
    for (const l of ledger.slice(0, 60)) {
      const ts = l.timestamp instanceof Date ? l.timestamp.toISOString() : String(l.timestamp)
      const amt = l.amount != null ? (l.amount > 0 ? '+' : '') + l.amount.toFixed(4) : '?'
      console.log(`  [${ts.substring(0,19)}] ${(l.type||'?').padEnd(22)} ${amt.padStart(10)} ${(l.currency||'').padEnd(4)} bal=$${(l.balanceAfter ?? '?')}  ${(l.description||'').substring(0,80)}`)
    }
  } else {
    console.log('\nwalletLedger collection missing')
  }

  // ── 3. Any tx collection with chatId ──────────────────────────────
  // Inspect every collection that has a `chatId` field equal to this user.
  const txCols = []
  for (const c of cols) {
    if (['walletOf','walletLedger','nameOf','chatIdOf','state','loginCountOf'].includes(c)) continue
    try {
      const sample = await db.collection(c).findOne({ $or: [{ chatId: idStr }, { chatId: idNum }] })
      if (sample) txCols.push(c)
    } catch (_) {}
  }
  console.log(`\nCollections with records for chatId=${CHAT_ID}:  ${txCols.length} → ${txCols.join(', ') || '(none)'}`)

  for (const c of txCols) {
    const rows = await db.collection(c)
      .find({ $or: [{ chatId: idStr }, { chatId: idNum }] })
      .sort({ timestamp: -1, createdAt: -1, _id: -1 })
      .limit(200)
      .toArray()
    console.log(`\n─── ${c}  (${rows.length} row${rows.length===1?'':'s'} shown) ───`)
    for (const r of rows) {
      // Pick the most relevant 6-7 fields per row for compact display
      const ts  = r.timestamp || r.createdAt || r.created_at || r.date || r._id
      const tsS = ts instanceof Date ? ts.toISOString() : String(ts).substring(0, 24)
      const summary = {}
      for (const k of ['type','status','amount','priceUsd','price','currency','paymentMethod','phoneNumber','domain','domainName','plan','description','error','refunded','duration','chargeAmount','depositAmountUsd','depositAmountNgn','txHash','address','coin','reason','source','couponCode','couponDiscount','bonusAmount']) {
        if (r[k] !== undefined && r[k] !== null && r[k] !== '') summary[k] = r[k]
      }
      // Truncate any field that is too long
      for (const k of Object.keys(summary)) {
        if (typeof summary[k] === 'string' && summary[k].length > 80) summary[k] = summary[k].substring(0, 77) + '…'
        if (typeof summary[k] === 'object') summary[k] = JSON.stringify(summary[k]).substring(0, 80)
      }
      console.log(`  [${tsS.substring(0,19)}] ${JSON.stringify(summary)}`)
    }
  }

  console.log('\n──────────────────────────── end ────────────────────────────')
  await cli.close()
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
