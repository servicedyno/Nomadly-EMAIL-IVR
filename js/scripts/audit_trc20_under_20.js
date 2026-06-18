/* global process */
/**
 * Audit recent TRC20 wallet-topups under the $20 floor — see if anyone slipped through.
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })
const { MongoClient } = require('mongodb')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)

  const since = new Date(Date.now() - 14 * 86400 * 1000)
  const txs = await db.collection('transactions').find({
    type: 'wallet-topup',
    createdAt: { $gte: since },
    'metadata.coin': { $regex: /TRC20|TRX|USDT/i }
  }).sort({ createdAt: -1 }).toArray()

  console.log(`Found ${txs.length} TRC20/USDT/TRX wallet-topups in last 14d`)
  for (const t of txs) {
    const flag = (t.amount < 20) ? '⚠️ UNDER-$20' : ''
    console.log(`${t.createdAt?.toISOString?.() || t.createdAt}  chatId=${t.chatId}  amount=$${t.amount}  coin=${t.metadata?.coin}  value=${t.metadata?.value}  ref=${t.metadata?.ref}  ${flag}`)
  }

  // Also scan blockbee path which is separate
  console.log('\n--- payments collection (any below-$20 TRC20 strings) ---')
  const payments = await db.collection('payments').find({
    val: { $regex: /TRC20|USDT/i }
  }).sort({ _id: 1 }).toArray()
  console.log(`Found ${payments.length} payment rows mentioning TRC20/USDT`)
  for (const p of payments) {
    const v = String(p.val)
    const m = v.match(/\$(\d+(?:\.\d+)?)/)
    const amt = m ? parseFloat(m[1]) : null
    const flag = (amt !== null && amt < 20) ? '⚠️ UNDER-$20' : ''
    if (flag) console.log(`${p._id} → ${v} ${flag}`)
  }

  await client.close()
})().catch(e => { console.error(e); process.exit(1) })
