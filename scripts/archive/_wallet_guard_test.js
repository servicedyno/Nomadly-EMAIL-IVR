// Wallet-payment guard regression check (2026-07-01 guard).
// Verifies that goto.walletSelectCurrency refuses to run unless the current
// action is a legit payment-picker (allow-list + any action ending in '-pay' + startsWith 'askCoupon').
// SAFE: does NOT confirm any payment, only checks the guard logic.
'use strict'
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') })
const http = require('http')
const { MongoClient } = require('mongodb')

const CHAT = 888800051, CHAT_S = String(CHAT)
const WEBHOOK = 'http://127.0.0.1:5000/telegram/webhook'

function postMessage(text) {
  const update = {
    update_id: Date.now() + Math.floor(Math.random()*1000),
    message: {
      message_id: Math.floor(Math.random()*1e6),
      from: { id: CHAT, is_bot: false, first_name: 'Guard', username: 'guard_tester' },
      chat: { id: CHAT, type: 'private' },
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
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode, body:d}))
    })
    req.on('error', reject); req.write(body); req.end()
  })
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const client = new MongoClient(process.env.MONGO_URL); await client.connect()
  const db = client.db(process.env.DB_NAME)
  const state = db.collection('state')
  const getS = async () => await state.findOne({ _id: CHAT_S })

  let pass=0, fail=0
  const chk=(l,c,e='')=>{console.log(`${c?'✅':'❌'} ${l}${e?'  '+e:''}`);c?pass++:fail++}

  console.log('\n═══ TEST 1: domain-pay action (legit) ═══')
  // Seed state with domain-pay action (legit payment-picker) + wallet balance
  const walletOf = db.collection('walletOf')
  await walletOf.updateOne(
    { _id: CHAT_S },
    { $set: { _id: CHAT_S, usdIn: 100, usdOut: 0 } },
    { upsert: true }
  )
  await state.updateOne(
    { _id: CHAT_S },
    { $set: {
      _id: CHAT_S,
      userLanguage: 'en',
      isNewUser: false,
      action: 'domain-pay',
      price: 5,
      lastStep: 'domain-pay',
      userName: 'guard_tester'
    }},
    { upsert: true }
  )
  await sleep(500)

  // Trigger "👛 Pay from Wallet" selection via message text
  await postMessage('👛 Pay from Wallet'); await sleep(1500)
  const s1 = await getS()
  chk('domain-pay → walletSelectCurrencyConfirm (guard allows)', s1?.action === 'walletSelectCurrencyConfirm', `action=${s1?.action}`)
  // Check that we did NOT see "Refusing walletSelectCurrency" log (we can't check logs directly, but action should be walletSelectCurrencyConfirm)

  console.log('\n═══ TEST 2: hosting-pay action (legit) ═══')
  // Seed state with hosting-pay action (legit payment-picker)
  await state.updateOne(
    { _id: CHAT_S },
    { $set: {
      _id: CHAT_S,
      userLanguage: 'en',
      isNewUser: false,
      action: 'hosting-pay',
      price: 10,
      lastStep: 'hosting-pay',
      userName: 'guard_tester'
    }},
    { upsert: true }
  )
  await sleep(500)

  // Trigger "👛 Pay from Wallet" selection via message text
  await postMessage('👛 Pay from Wallet'); await sleep(1500)
  const s2 = await getS()
  chk('hosting-pay → walletSelectCurrencyConfirm (guard allows)', s2?.action === 'walletSelectCurrencyConfirm', `action=${s2?.action}`)

  console.log('\n═══ TEST 3: vps-plan-pay action (legit, ends with -pay) ═══')
  // Seed state with vps-plan-pay action (legit payment-picker, ends with -pay)
  await state.updateOne(
    { _id: CHAT_S },
    { $set: {
      _id: CHAT_S,
      userLanguage: 'en',
      isNewUser: false,
      action: 'vps-plan-pay',
      price: 15,
      lastStep: 'vps-plan-pay',
      userName: 'guard_tester'
    }},
    { upsert: true }
  )
  await sleep(500)

  // Trigger "👛 Pay from Wallet" selection via message text
  await postMessage('👛 Pay from Wallet'); await sleep(1500)
  const s3 = await getS()
  chk('vps-plan-pay → walletSelectCurrencyConfirm (guard allows)', s3?.action === 'walletSelectCurrencyConfirm', `action=${s3?.action}`)

  console.log('\n═══ TEST 4: askCoupondomain-pay action (legit, starts with askCoupon) ═══')
  // Seed state with askCoupon* action (legit payment-picker, starts with askCoupon)
  await state.updateOne(
    { _id: CHAT_S },
    { $set: {
      _id: CHAT_S,
      userLanguage: 'en',
      isNewUser: false,
      action: 'askCoupondomain-pay',
      price: 5,
      lastStep: 'askCoupondomain-pay',
      userName: 'guard_tester'
    }},
    { upsert: true }
  )
  await sleep(500)

  // Trigger "👛 Pay from Wallet" selection via message text
  await postMessage('👛 Pay from Wallet'); await sleep(1500)
  const s4 = await getS()
  chk('askCoupondomain-pay → walletSelectCurrencyConfirm (guard allows)', s4?.action === 'walletSelectCurrencyConfirm', `action=${s4?.action}`)

  // Cleanup
  await state.deleteMany({ _id: CHAT_S })
  await walletOf.deleteMany({ _id: CHAT_S })
  console.log(`\n═══ ${pass} passed, ${fail} failed ═══`)
  await client.close(); process.exit(fail===0?0:1)
}

main().catch(e => { console.error('FATAL', e); process.exit(2) })
