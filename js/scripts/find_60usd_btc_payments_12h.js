/* global process */
/**
 * Find all BTC crypto payments totaling ~$60 USD in last 12 hours.
 * Searches transactions + payments + hostingTransactions + vpsTransactions + domainTransactions.
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })
const { MongoClient } = require('mongodb')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)

  const since = new Date(Date.now() - 12 * 3600 * 1000)
  console.log(`Searching since ${since.toISOString()} (last 12h)`)
  console.log('Target: ~$60 USD payments using BTC\n')

  // 1) transactions: wallet-topup or any with coin = BTC near $60
  console.log('=== transactions (any type, coin BTC, $58-$62) ===')
  const txs = await db.collection('transactions').find({
    createdAt: { $gte: since },
    $and: [
      {
        $or: [
          { 'metadata.coin': { $regex: /^BTC$|bitcoin/i } },
          { 'metadata.currency': { $regex: /^BTC$|bitcoin/i } },
        ],
      },
      { amount: { $gte: 58, $lte: 62 } },
    ],
  }).sort({ createdAt: -1 }).toArray()
  console.log(`Found ${txs.length}`)
  for (const t of txs) {
    console.log(`  ${t.createdAt?.toISOString?.() || t.createdAt}  chatId=${t.chatId}  type=${t.type}  amount=$${t.amount}  coin=${t.metadata?.coin}  value=${t.metadata?.value}  ref=${t.metadata?.ref || t._id}`)
  }

  // 2) Same window any BTC payment regardless of amount (in case the user spread it)
  console.log('\n=== ALL transactions with BTC in last 12h (regardless of amount) ===')
  const allBtc = await db.collection('transactions').find({
    createdAt: { $gte: since },
    $or: [
      { 'metadata.coin': { $regex: /^BTC$|bitcoin/i } },
      { 'metadata.currency': { $regex: /^BTC$|bitcoin/i } },
    ],
  }).sort({ createdAt: -1 }).toArray()
  console.log(`Found ${allBtc.length}`)
  // Group by chatId, sum amounts
  const byUser = {}
  for (const t of allBtc) {
    if (!byUser[t.chatId]) byUser[t.chatId] = { count: 0, total: 0, rows: [] }
    byUser[t.chatId].count++
    byUser[t.chatId].total += Number(t.amount || 0)
    byUser[t.chatId].rows.push(`${t.createdAt?.toISOString?.()} type=${t.type} $${t.amount} value=${t.metadata?.value}BTC ref=${t.metadata?.ref || t._id}`)
  }
  for (const [chatId, info] of Object.entries(byUser).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`\n  chatId=${chatId}  ${info.count}x txs  total=$${info.total}`)
    for (const r of info.rows) console.log(`    ${r}`)
  }

  // 3) payments collection for last 12h that mention BTC and $60
  console.log('\n=== payments CSV strings mentioning BTC + $60 ===')
  const pays = await db.collection('payments').find({
    val: { $regex: /BTC/i, $not: /USDT|TRC20|ETH|LTC|DOGE/i },
  }).sort({ _id: -1 }).limit(1000).toArray()
  const matches = pays.filter(p => /\$60(\b|,)/.test(p.val))
  console.log(`Found ${matches.length} payments rows with BTC and $60`)
  for (const p of matches) console.log(`  ${p._id}: ${p.val}`)

  // 4) Hosting/VPS/Domain transactions paid via BTC in this window
  for (const coll of ['hostingTransactions', 'vpsTransactions']) {
    try {
      const rows = await db.collection(coll).find({
        timestamp: { $gte: since.toISOString() },
        $or: [
          { paymentMethod: { $regex: /crypto|btc|bitcoin/i } },
          { gatewayData: { $regex: /BTC/i } },
        ],
      }).limit(100).toArray()
      if (rows.length) {
        console.log(`\n=== ${coll} BTC payments in 12h (${rows.length}) ===`)
        for (const r of rows) console.log(`  ${r.timestamp}  chatId=${r.chatId}  amount=$${r.amount}  hostingType=${r.hostingType}  plan=${r.plan}`)
      }
    } catch (e) { /* skip */ }
  }

  // 5) Newly populated dynopayWebhooks (after my patch) — show any recent BTC events
  try {
    const wh = await db.collection('dynopayWebhooks').find({
      receivedAt: { $gte: since },
      currency: { $regex: /^BTC$|bitcoin/i },
    }).sort({ receivedAt: -1 }).toArray()
    if (wh.length) {
      console.log(`\n=== dynopayWebhooks BTC events in 12h (${wh.length}) ===`)
      for (const w of wh) {
        console.log(`  ${w.receivedAt?.toISOString?.()}  endpoint=${w.endpoint}  refId=${w.refId}  paymentId=${w.paymentId}  amount=${w.amount}BTC  base_amount=$${w.baseAmount}  address=${w.address}`)
      }
    }
  } catch (e) { /* coll may not exist yet */ }

  await client.close()
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
