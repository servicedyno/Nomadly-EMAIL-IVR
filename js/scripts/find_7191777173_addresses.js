/* global process */
/**
 * Find wallet addresses shared with user 7191777173 + on-chain amounts.
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })
const { MongoClient } = require('mongodb')
const axios = require('axios')

const CHAT_ID = '7191777173'
const REFS = ['z02SZ', 'drKee']
const PAYMENT_IDS = [
  '2fd3c05b-0654-48b1-a201-f165e587dcb8',
  'a2b3a5a8-c103-4d63-bf89-8df4e5c1aadd',
]

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)

  // 1. paymentIntents
  console.log('=== paymentIntents for chatId ===')
  const pi = await db.collection('paymentIntents').find({
    $or: [{ chatId: CHAT_ID }, { chatId: Number(CHAT_ID) }, { 'val.chatId': CHAT_ID }, { 'val.chatId': Number(CHAT_ID) }]
  }).toArray()
  console.log(JSON.stringify(pi, null, 2))

  // 2. chatIdOfPayment / chatIdOfDynopayPayment for refs (any leftovers)
  console.log('\n=== chatIdOfDynopayPayment for refs ===')
  for (const ref of REFS) {
    const p = await db.collection('chatIdOfDynopayPayment').findOne({ _id: ref })
    console.log(ref, '→', JSON.stringify(p, null, 2))
  }
  console.log('\n=== chatIdOfPayment for refs ===')
  for (const ref of REFS) {
    const p = await db.collection('chatIdOfPayment').findOne({ _id: ref })
    console.log(ref, '→', JSON.stringify(p, null, 2))
  }

  // 3. Scan for any address-like string in transactions / payments metadata
  console.log('\n=== Any collection with address/wallet address for chatId ===')
  const colls = await db.listCollections().toArray()
  for (const c of colls) {
    if (!/payment|wallet|deposit|crypto|dyno|address/i.test(c.name)) continue
    try {
      const sample = await db.collection(c.name).find({
        $or: [{ chatId: CHAT_ID }, { chatId: Number(CHAT_ID) }, { 'val.chatId': CHAT_ID }]
      }).limit(5).toArray()
      if (sample.length > 0) {
        console.log(`-- ${c.name} (${sample.length} matches) --`)
        for (const s of sample) console.log(JSON.stringify(s), '\n')
      }
    } catch (e) { /* skip */ }
  }

  // 4. Also scan payments collection for any address fields
  console.log('\n=== payments collection rows for refs ===')
  for (const ref of REFS) {
    const p = await db.collection('payments').findOne({ _id: ref })
    console.log(ref, '→', JSON.stringify(p, null, 2))
  }

  // 5. Try the DynoPay API again — different endpoint shapes
  console.log('\n=== DynoPay API probes ===')
  const baseUrl = process.env.DYNO_PAY_BASE_URL
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-api-key': process.env.DYNO_PAY_API_KEY,
    Authorization: `Bearer ${process.env.DYNO_PAY_WALLET_TOKEN}`,
  }

  for (const pid of PAYMENT_IDS) {
    console.log(`\n--- payment_id: ${pid} ---`)
    // (a) getSingleTransaction
    try {
      const r = await axios.get(`${baseUrl}/user/getSingleTransaction/${pid}`, { headers, timeout: 8000 })
      console.log('  getSingleTransaction OK:', JSON.stringify(r.data, null, 2))
    } catch (e) { console.log('  getSingleTransaction err:', e?.response?.data?.message || e.message) }

    // (b) get by address — we'd need the address; skip unless we find it
    // (c) try /payments/{id} or /transactions/{id}
    for (const ep of [
      `/user/getTransaction/${pid}`,
      `/user/transaction/${pid}`,
      `/user/payment/${pid}`,
      `/user/payments/${pid}`,
      `/payment/${pid}`,
      `/user/getCryptoTransaction/${pid}`,
    ]) {
      try {
        const r = await axios.get(`${baseUrl}${ep}`, { headers, timeout: 6000 })
        console.log(`  ${ep} OK:`, JSON.stringify(r.data, null, 2).slice(0, 600))
      } catch (e) {
        const msg = e?.response?.data?.message || e?.response?.status || e.message
        if (msg !== 'Please provide a valid transaction_id!' && msg !== 404) {
          console.log(`  ${ep} ${msg}`)
        }
      }
    }
  }

  // 6. List ALL user-facing transaction list endpoint
  try {
    console.log('\n--- DynoPay /user/getAllTransactions (look for our refs) ---')
    const r = await axios.get(`${baseUrl}/user/getAllTransactions`, { headers, timeout: 15000 })
    const items = r.data?.data || r.data || []
    const arr = Array.isArray(items) ? items : (items?.transactions || items?.data || [])
    console.log(`  total: ${arr.length}`)
    const ours = arr.filter(t => {
      const s = JSON.stringify(t)
      return PAYMENT_IDS.some(p => s.includes(p)) || REFS.some(r => s.includes(r))
    })
    console.log('  matching ours:', JSON.stringify(ours, null, 2))
  } catch (e) {
    console.log('  getAllTransactions err:', e?.response?.data?.message || e.message)
  }

  await client.close()
})().catch(e => { console.error(e); process.exit(1) })
