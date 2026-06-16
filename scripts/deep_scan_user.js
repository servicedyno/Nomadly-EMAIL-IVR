/**
 * Exhaustive READ-ONLY scan for chatId 6550622589 across ALL collections,
 * checking every plausible key field (chatId, _id, userId, ownerChatId,
 * fromChatId, etc.). Also looks INSIDE values for the chatId string
 * (since some collections store it nested in metadata).
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const CHAT = String(process.argv[2] || '6550622589')
const CHAT_N = Number(CHAT)

;(async () => {
  const cli = new MongoClient(process.env.MONGO_URL); await cli.connect()
  const db = cli.db()
  const cols = (await db.listCollections().toArray()).map(c => c.name)

  // Build a query that matches the chatId in ANY of these common fields
  const KEYS = ['chatId','userId','user_id','ownerChatId','owner_chat_id','from_chat_id','fromChatId','telegramId','telegram_id','tg_id','recipientChatId']
  const orChat = KEYS.flatMap(k => [{[k]: CHAT}, {[k]: CHAT_N}])
  orChat.push({_id: CHAT}, {_id: CHAT_N})

  console.log(`Scanning ${cols.length} collections for chatId=${CHAT}…\n`)
  const hits = {}
  for (const c of cols) {
    try {
      const cnt = await db.collection(c).countDocuments({$or: orChat}, { maxTimeMS: 8000 })
      if (cnt > 0) hits[c] = cnt
    } catch (_) {}
  }
  console.log('Collections with records (by explicit key fields):')
  for (const [c, n] of Object.entries(hits)) console.log(`  ${c.padEnd(35)} ${n}`)

  // ALSO scan by raw string-match (slow, only for the small-ish set of payment-y collections)
  console.log('\nDeep string-scan in payment / deposit / refund collections (slower):')
  const SCAN = ['chatIdOfPayment','chatIdOfDynopayPayment','transactions','paymentIntents','payments','walletAudit','walletLedger','welcomeBonuses','dailyCoupons','welcomeCoupons','userConversion','digitalOrders','phoneTransactions','hostingTransactions','vpsTransactions']
  for (const c of SCAN) {
    if (!cols.includes(c)) continue
    try {
      const docs = await db.collection(c).find({}, { maxTimeMS: 15000 }).toArray()
      const matched = docs.filter(d => JSON.stringify(d).includes(CHAT))
      console.log(`  ${c.padEnd(28)} total=${docs.length}  match=${matched.length}`)
      for (const d of matched.slice(0, 30)) {
        const compact = {...d}
        for (const k of ['__v','rawWebhook','rawRequest','rawResponse']) delete compact[k]
        console.log('    ' + JSON.stringify(compact).substring(0, 380))
      }
    } catch(e) { console.log(`  ${c}: error ${e.message}`) }
  }

  await cli.close()
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
