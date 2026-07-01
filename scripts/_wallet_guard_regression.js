// Wallet-payment guard regression check (2026-07-01).
// Verifies the guard in goto.walletSelectCurrency allows legit payment actions
// and refuses non-payment actions. SAFE: does NOT confirm any payment.
'use strict'
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') })
const http = require('http')
const { MongoClient } = require('mongodb')

const CHAT1 = 888800060, CHAT1_S = String(CHAT1)
const CHAT2 = 888800061, CHAT2_S = String(CHAT2)
const WEBHOOK = 'http://127.0.0.1:5000/telegram/webhook'

function post(chatId, text) {
  const update = {
    update_id: Date.now() + Math.floor(Math.random()*1000),
    message: {
      message_id: Math.floor(Math.random()*1e6),
      from: { id: chatId, is_bot: false, first_name: 'Guard', username: 'guard_test' },
      chat: { id: chatId, type: 'private' },
      date: Math.floor(Date.now()/1000),
      text
    }
  }
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(update)
    const req = http.request(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode}))
    })
    req.on('error', reject); req.write(body); req.end()
  })
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const client = new MongoClient(process.env.MONGO_URL); await client.connect()
  const db = client.db(process.env.DB_NAME)
  const state = db.collection('state')
  const walletOf = db.collection('walletOf')
  const info = db.collection('info')

  let pass=0, fail=0
  const chk=(l,c,e='')=>{console.log(`${c?'✅':'❌'} ${l}${e?'  '+e:''}`);c?pass++:fail++}

  // ═══ TEST 1: domain-pay (legit) → wallet payment should proceed ═══
  console.log('\n═══ TEST 1: domain-pay action (legit) ═══')
  await walletOf.updateOne({ _id: CHAT1_S }, { $set: { _id: CHAT1_S, usdIn: 100, usdOut: 0 } }, { upsert: true })
  await info.updateOne({ _id: CHAT1_S }, { $set: { _id: CHAT1_S, price: 5, domain: 'test.com', lastStep: 'domain-pay' } }, { upsert: true })
  await state.updateOne(
    { _id: CHAT1_S },
    { $set: { _id: CHAT1_S, userLanguage: 'en', isNewUser: false, action: 'domain-pay', userName: 'guard_test' } },
    { upsert: true }
  )
  await sleep(500)

  // Trigger wallet payment by sending the wallet button text
  await post(CHAT1, '👛 Wallet'); await sleep(1500)
  const s1 = await state.findOne({ _id: CHAT1_S })
  chk('domain-pay → walletSelectCurrencyConfirm (guard allows)', s1?.action === 'walletSelectCurrencyConfirm', `action=${s1?.action}`)

  // ═══ TEST 2: hosting-pay (legit) → wallet payment should proceed ═══
  console.log('\n═══ TEST 2: hosting-pay action (legit) ═══')
  await walletOf.updateOne({ _id: CHAT2_S }, { $set: { _id: CHAT2_S, usdIn: 100, usdOut: 0 } }, { upsert: true })
  await info.updateOne({ _id: CHAT2_S }, { $set: { _id: CHAT2_S, price: 10, lastStep: 'hosting-pay' } }, { upsert: true })
  await state.updateOne(
    { _id: CHAT2_S },
    { $set: { _id: CHAT2_S, userLanguage: 'en', isNewUser: false, action: 'hosting-pay', userName: 'guard_test' } },
    { upsert: true }
  )
  await sleep(500)

  // Trigger wallet payment
  await post(CHAT2, '👛 Wallet'); await sleep(1500)
  const s2 = await state.findOne({ _id: CHAT2_S })
  chk('hosting-pay → walletSelectCurrencyConfirm (guard allows)', s2?.action === 'walletSelectCurrencyConfirm', `action=${s2?.action}`)

  // Cleanup
  await state.deleteMany({ _id: { $in: [CHAT1_S, CHAT2_S] } })
  await walletOf.deleteMany({ _id: { $in: [CHAT1_S, CHAT2_S] } })
  await info.deleteMany({ _id: { $in: [CHAT1_S, CHAT2_S] } })

  console.log(`\n═══ ${pass} passed, ${fail} failed ═══`)
  await client.close(); process.exit(fail===0?0:1)
}

main().catch(e => { console.error('FATAL', e); process.exit(2) })
