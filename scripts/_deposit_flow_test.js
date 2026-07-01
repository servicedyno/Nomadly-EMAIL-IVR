// Controlled self-test: crypto wallet-top-up INITIATION flow (address generation).
// Fully safe: generating a deposit address moves no money. Uses a fake test chatId.
'use strict'
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') })
const http = require('http')
const { MongoClient } = require('mongodb')

const CHAT = 888800050, CHAT_S = String(CHAT)
const WEBHOOK = 'http://127.0.0.1:5000/telegram/webhook'
function post(text) {
  const update = { update_id: Date.now() + Math.floor(Math.random()*1000), message: { message_id: Math.floor(Math.random()*1e6), from: { id: CHAT, is_bot: false, first_name: 'Dep', username: 'dep_tester' }, chat: { id: CHAT, type: 'private' }, date: Math.floor(Date.now()/1000), text } }
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(update)
    const req = http.request(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode})) })
    req.on('error', reject); req.write(body); req.end()
  })
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const client = new MongoClient(process.env.MONGO_URL); await client.connect()
  const db = client.db(process.env.DB_NAME)
  const state = db.collection('state')
  const getS = async () => await state.findOne({ _id: CHAT_S })

  // Seed user directly at the deposit amount-entry step
  await state.updateOne({ _id: CHAT_S }, { $set: { _id: CHAT_S, userLanguage: 'en', isNewUser: false, action: 'selectCurrencyToDeposit', userName: 'dep_tester' } }, { upsert: true })
  let pass=0, fail=0; const chk=(l,c,e='')=>{console.log(`${c?'✅':'❌'} ${l}${e?'  '+e:''}`);c?pass++:fail++}

  // 1) enter amount $50
  await post('50'); await sleep(1200)
  const s1 = await getS()
  chk('amount entry $50 → depositMethodSelect', s1?.action === 'depositMethodSelect', `action=${s1?.action}`)
  chk('depositAmountUsd saved = 50', Number(s1?.depositAmountUsd) === 50, `=${s1?.depositAmountUsd}`)

  // 2) choose Crypto
  await post('₿ Crypto'); await sleep(1200)
  const s2 = await getS()
  chk('choose Crypto → selectCryptoToDeposit', s2?.action === 'selectCryptoToDeposit', `action=${s2?.action}`)

  // 3) choose Ethereum (avoids TRC20 min intercept) → address generation (real DynoPay call)
  await post('Ξ Ethereum (ETH)'); await sleep(6000)
  const s3 = await getS()
  // On success the flow resets action to 'none' after sending the deposit address.
  chk('ETH → address generated (action reset to none)', s3?.action === 'none', `action=${s3?.action}`)

  await state.deleteMany({ _id: CHAT_S })
  console.log(`\n═══ ${pass} passed, ${fail} failed ═══`)
  await client.close(); process.exit(fail===0?0:1)
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
