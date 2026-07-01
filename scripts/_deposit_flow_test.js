// Reference test: crypto wallet-top-up flow AFTER friction reduction (2026-07-01)
// + deposit-funnel instrumentation. Safe (address generation moves no money).
'use strict'
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') })
const http = require('http')
const { MongoClient } = require('mongodb')

const CHAT = 888800050, CHAT_S = String(CHAT)
const WEBHOOK = 'http://127.0.0.1:5000/telegram/webhook'
function post(text) {
  const update = { update_id: Date.now() + Math.floor(Math.random() * 1000), message: { message_id: Math.floor(Math.random() * 1e6), from: { id: CHAT, is_bot: false, first_name: 'Dep', username: 'dep_tester' }, chat: { id: CHAT, type: 'private' }, date: Math.floor(Date.now() / 1000), text } }
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(update)
    const req = http.request(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode })) })
    req.on('error', reject); req.write(body); req.end()
  })
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const client = new MongoClient(process.env.MONGO_URL); await client.connect()
  const db = client.db(process.env.DB_NAME)
  const state = db.collection('state')
  const funnel = db.collection('depositFunnel')
  const getS = async () => await state.findOne({ _id: CHAT_S })
  const bankHidden = process.env.HIDE_BANK_PAYMENT === 'true'

  await state.updateOne({ _id: CHAT_S }, { $set: { _id: CHAT_S, userLanguage: 'en', isNewUser: false, action: 'selectCurrencyToDeposit', userName: 'dep_tester' } }, { upsert: true })
  const funnelBefore = await funnel.countDocuments({ chatId: CHAT_S })
  let pass = 0, fail = 0; const chk = (l, c, e = '') => { console.log(`${c ? '✅' : '❌'} ${l}${e ? '  ' + e : ''}`); c ? pass++ : fail++ }

  // 1) preset amount "$50" (tests preset parsing) — bank hidden → straight to coin picker
  await post('$50'); await sleep(1200)
  const s1 = await getS()
  chk('preset "$50" parsed → depositAmountUsd=50', Number(s1?.depositAmountUsd) === 50, `=${s1?.depositAmountUsd}`)
  const expectedAfterAmount = bankHidden ? 'selectCryptoToDeposit' : 'depositMethodSelect'
  chk(`bank hidden(${bankHidden}) → action=${expectedAfterAmount}`, s1?.action === expectedAfterAmount, `got=${s1?.action}`)

  // If not bank-hidden, advance through method select
  if (!bankHidden) { await post('₿ Crypto'); await sleep(1000) }

  // 2) choose ETH → address generated (action resets to none) + funnel intent recorded
  await post('Ξ Ethereum (ETH)'); await sleep(6000)
  const s2 = await getS()
  chk('ETH → address generated (action reset to none)', s2?.action === 'none', `action=${s2?.action}`)
  const funnelAfter = await funnel.countDocuments({ chatId: CHAT_S })
  chk('deposit funnel INTENT recorded', funnelAfter > funnelBefore, `before=${funnelBefore} after=${funnelAfter}`)
  const fd = await funnel.find({ chatId: CHAT_S }).sort({ generatedAt: -1 }).limit(1).toArray()
  chk('funnel doc has amount=50 & status=address_generated', fd[0] && fd[0].amountUsd === 50 && fd[0].status === 'address_generated', JSON.stringify(fd[0] || {}))

  // cleanup
  await state.deleteMany({ _id: CHAT_S })
  await funnel.deleteMany({ chatId: CHAT_S })
  console.log(`\n═══ ${pass} passed, ${fail} failed ═══`)
  await client.close(); process.exit(fail === 0 ? 0 : 1)
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
