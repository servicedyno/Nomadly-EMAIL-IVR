// Internal sanity check for the marketplace SELLER-fee redesign.
// Drives the live local webhook (localhost:5000/telegram/webhook) with synthetic
// Telegram updates and asserts DB state transitions. Uses a FAKE test chatId.
'use strict'
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') })
const http = require('http')
const { MongoClient } = require('mongodb')

const CHAT = 888800001
const CHAT_S = String(CHAT)
const WEBHOOK = 'http://127.0.0.1:5000/telegram/webhook'

function post(update) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(update)
    const req = http.request(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }))
    })
    req.on('error', reject); req.write(body); req.end()
  })
}
let uid = 1000
const msgUpdate = (text) => ({ update_id: ++uid, message: { message_id: uid, from: { id: CHAT, is_bot: false, first_name: 'Sanity', username: 'sanity_seller' }, chat: { id: CHAT, type: 'private' }, date: Math.floor(Date.now()/1000), text } })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const client = new MongoClient(process.env.MONGO_URL); await client.connect()
  const db = client.db(process.env.DB_NAME)
  const state = db.collection('state'); const access = db.collection('marketplaceAccess'); const wallet = db.collection('walletOf')
  const getAction = async () => (await state.findOne({ _id: CHAT_S }))?.action

  // ── Setup: idle user in mpHome, NO seller access, wallet balance $100 ──
  await access.deleteMany({ _id: { $in: [CHAT, CHAT_S] } })
  await state.updateOne({ _id: CHAT_S }, { $set: { _id: CHAT_S, userLanguage: 'en', action: 'mpHome', isNewUser: false, adminTakeover: false } }, { upsert: true })
  await wallet.updateOne({ _id: CHAT_S }, { $set: { _id: CHAT_S, usdIn: 100, usdOut: 0, ngnIn: 0, ngnOut: 0 } }, { upsert: true })
  let pass = 0, fail = 0
  const check = (label, cond, extra='') => { console.log(`${cond?'✅':'❌'} ${label}${extra?'  '+extra:''}`); cond?pass++:fail++ }

  // TEST 1: Unpaid user taps "Start Selling" → gated to mpSellerPaywall
  await post(msgUpdate('💰 Start Selling')); await sleep(1500)
  const a1 = await getAction()
  check('T1 list attempt (unpaid) → mpSellerPaywall', a1 === 'mpSellerPaywall', `got action=${a1}`)

  // TEST 2: Tap "Pay from Wallet" (balance $100 ≥ $50) → grant + resume to mpNewImage
  await post(msgUpdate('👛 Pay from Wallet')); await sleep(1800)
  const acc = await access.findOne({ _id: { $in: [CHAT, CHAT_S] }, paid: true })
  const a2 = await getAction()
  check('T2 wallet pay → seller access granted', !!acc, `acc=${JSON.stringify(acc)}`)
  check('T2 wallet pay → resumes to listing (mpNewImage)', a2 === 'mpNewImage', `got action=${a2}`)
  const w2 = await wallet.findOne({ _id: CHAT_S })
  check('T2 wallet charged $50 (usdOut≈50)', Math.abs((w2?.usdOut||0) - 50) < 0.01, `usdOut=${w2?.usdOut}`)

  // TEST 3: Paid user taps "Start Selling" again → goes straight to listing (no paywall)
  await state.updateOne({ _id: CHAT_S }, { $set: { action: 'mpHome' } })
  await post(msgUpdate('💰 Start Selling')); await sleep(1200)
  const a3 = await getAction()
  check('T3 list attempt (paid) → mpNewImage (no paywall)', a3 === 'mpNewImage', `got action=${a3}`)

  // TEST 4: Insufficient balance path — fresh user, $0 balance, taps wallet button
  const CHAT2 = 888800002, CHAT2_S = String(CHAT2)
  await access.deleteMany({ _id: { $in: [CHAT2, CHAT2_S] } })
  await state.updateOne({ _id: CHAT2_S }, { $set: { _id: CHAT2_S, userLanguage: 'en', action: 'mpSellerPaywall', mpPaywallIntent: 'list', isNewUser: false } }, { upsert: true })
  await wallet.updateOne({ _id: CHAT2_S }, { $set: { _id: CHAT2_S, usdIn: 0, usdOut: 0, ngnIn: 0, ngnOut: 0 } }, { upsert: true })
  await post({ update_id: ++uid, message: { message_id: uid, from: { id: CHAT2, is_bot:false, first_name:'B', username:'poor_seller' }, chat: { id: CHAT2, type:'private' }, date: Math.floor(Date.now()/1000), text: '👛 Pay from Wallet' } }); await sleep(1200)
  const acc2 = await access.findOne({ _id: { $in: [CHAT2, CHAT2_S] }, paid: true })
  const a4 = (await state.findOne({ _id: CHAT2_S }))?.action
  check('T4 insufficient balance → NOT granted', !acc2)
  check('T4 insufficient balance → stays on paywall', a4 === 'mpSellerPaywall', `got action=${a4}`)

  // ── Cleanup ──
  await access.deleteMany({ _id: { $in: [CHAT, CHAT_S, CHAT2, CHAT2_S] } })
  await state.deleteMany({ _id: { $in: [CHAT_S, CHAT2_S] } })
  await wallet.deleteMany({ _id: { $in: [CHAT_S, CHAT2_S] } })
  console.log(`\n═══ ${pass} passed, ${fail} failed ═══`)
  await client.close(); process.exit(fail === 0 ? 0 : 1)
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
