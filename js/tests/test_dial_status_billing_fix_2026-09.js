#!/usr/bin/env node
// Live regression for /twilio/voice-dial-status billing (prod audit 2026-09-16, F2):
//  - string chatId lookup bills the forwarded PSTN leg (was $0 for months due to parseInt)
//  - legacy numeric _id docs still resolve
//  - sip_bridge legs are NEVER billed here (charged on the Telnyx leg)
//  - pending-bill row is marked settled by the webhook
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const BASE = process.env.TEST_BASE || 'http://localhost:5000'
const ts = Date.now()
const CHAT = `DSTEST-${ts}`
const CHAT_NUM = 9900000000 + (ts % 1000000)
const NUM = '+18005550' + String(ts).slice(-3)
const NUM2 = '+18005551' + String(ts).slice(-3)
const DEST = '+14155550100'
let fails = 0
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fails++ }

async function post(query, body) {
  const r = await fetch(`${BASE}/twilio/voice-dial-status?${query}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body),
  })
  return { status: r.status, text: await r.text() }
}

;(async () => {
  const client = await MongoClient.connect(process.env.MONGO_URL)
  const db = client.db(process.env.DB_NAME)
  const phoneNumbersOf = db.collection('phoneNumbersOf'), walletOf = db.collection('walletOf')
  const ledger = db.collection('walletLedger'), pending = db.collection('pendingCallBills')
  const numDoc = (n) => ({ phoneNumber: n, provider: 'twilio', status: 'active', plan: 'business', minutesUsed: 0, features: { callForwarding: { enabled: true, mode: 'always', forwardTo: DEST } } })
  try {
    await phoneNumbersOf.insertOne({ _id: CHAT, val: { numbers: [numDoc(NUM)] } })
    await phoneNumbersOf.insertOne({ _id: CHAT_NUM, val: { numbers: [numDoc(NUM2)] } })
    await walletOf.insertOne({ _id: CHAT, usdIn: 10, usdOut: 0 })
    await walletOf.insertOne({ _id: String(CHAT_NUM), usdIn: 10, usdOut: 0 })
    const sid1 = `CADSTEST1${ts}`
    await pending.insertOne({ _id: `twilio_${sid1}`, callRef: `twilio_${sid1}`, chatId: CHAT, phoneNumber: NUM, destination: DEST, callType: 'Twilio_Forwarding', provider: 'twilio', status: 'pending', createdAt: new Date() })

    // 1. Forwarded call completed, string chatId → billed 2 min to wallet under twilio_<CallSid>
    let r = await post(`chatId=${CHAT}&from=${encodeURIComponent('+14085550123')}&to=${encodeURIComponent(NUM)}`, { DialCallStatus: 'completed', DialCallDuration: '90', CallSid: sid1 })
    ok(r.status === 200 && r.text.includes('<Hangup'), 'forward completed → 200 TwiML hangup')
    await new Promise(r => setTimeout(r, 400))
    const led1 = await ledger.findOne({ callRef: `twilio_${sid1}` })
    ok(!!led1 && led1.amount < 0, `forward completed (string chatId) billed to wallet: ${led1 ? '$' + (-led1.amount).toFixed(4) : 'NO LEDGER ROW'}`)
    const w1 = await walletOf.findOne({ _id: CHAT })
    ok(w1 && Math.abs((w1.usdOut || 0) - (led1 ? -led1.amount : 0)) < 1e-6, `wallet usdOut matches ledger (${w1?.usdOut})`)
    ok(led1 && Math.abs(-led1.amount - 2 * 0.15) < 0.031, 'charge ≈ 2 min × $0.15 (US/CA)')
    const p1 = await pending.findOne({ _id: `twilio_${sid1}` })
    ok(p1?.status === 'settled' && p1?.settledVia === 'webhook', `pending bill marked settled via webhook (${p1?.status}/${p1?.settledVia})`)

    // 2. Legacy numeric _id doc → fallback lookup still bills
    const sid2 = `CADSTEST2${ts}`
    r = await post(`chatId=${CHAT_NUM}&from=${encodeURIComponent('+14085550124')}&to=${encodeURIComponent(NUM2)}`, { DialCallStatus: 'completed', DialCallDuration: '30', CallSid: sid2 })
    await new Promise(r => setTimeout(r, 400))
    const led2 = await ledger.findOne({ callRef: `twilio_${sid2}` })
    ok(!!led2 && led2.amount < 0, `legacy numeric _id owner billed: ${led2 ? '$' + (-led2.amount).toFixed(4) : 'NO LEDGER ROW'}`)

    // 3. sip_bridge completed → NOT billed here (Telnyx leg charges it)
    const sid3 = `CADSTEST3${ts}`
    const before = (await walletOf.findOne({ _id: CHAT })).usdOut
    r = await post(`chatId=${CHAT}&from=${encodeURIComponent(DEST)}&to=${encodeURIComponent(NUM)}&type=sip_bridge`, { DialCallStatus: 'completed', DialCallDuration: '154', CallSid: sid3 })
    ok(r.status === 200, 'sip_bridge completed → 200')
    await new Promise(r => setTimeout(r, 400))
    ok(!(await ledger.findOne({ callRef: `twilio_${sid3}` })), 'sip_bridge completed → no Twilio-leg ledger row')
    // 4. sip_bridge unanswered → NOT billed here either
    const sid4 = `CADSTEST4${ts}`
    r = await post(`chatId=${CHAT}&from=${encodeURIComponent(DEST)}&to=${encodeURIComponent(NUM)}&type=sip_bridge`, { DialCallStatus: 'no-answer', DialCallDuration: '0', CallSid: sid4 })
    ok(r.status === 200 && r.text.includes('could not be completed'), 'sip_bridge no-answer → 200 with failure TwiML')
    await new Promise(r => setTimeout(r, 400))
    ok(!(await ledger.findOne({ callRef: `twilio_${sid4}` })), 'sip_bridge no-answer → no 1-min Twilio-leg charge')
    const after = (await walletOf.findOne({ _id: CHAT })).usdOut
    ok(Math.abs(after - before) < 1e-9, `wallet unchanged by bridge legs (${before} → ${after})`)

    // 5. sip_outbound (Twilio-only SIP leg) unanswered → 1-min minimum IS billed (only leg)
    const sid5 = `CADSTEST5${ts}`
    r = await post(`chatId=${CHAT}&from=${encodeURIComponent(DEST)}&to=${encodeURIComponent(NUM)}&type=sip_outbound`, { DialCallStatus: 'busy', DialCallDuration: '0', CallSid: sid5 })
    await new Promise(r => setTimeout(r, 400))
    const led5 = await ledger.findOne({ callRef: `twilio_${sid5}` })
    ok(!!led5 && Math.abs(-led5.amount - 0.15) < 0.031, `sip_outbound busy → 1-min minimum billed (${led5 ? '$' + (-led5.amount).toFixed(4) : 'none'})`)

    // 6. Idempotency: replaying the completed forward webhook does not double-bill
    r = await post(`chatId=${CHAT}&from=${encodeURIComponent('+14085550123')}&to=${encodeURIComponent(NUM)}`, { DialCallStatus: 'completed', DialCallDuration: '90', CallSid: sid1 })
    await new Promise(r => setTimeout(r, 400))
    ok((await ledger.countDocuments({ callRef: `twilio_${sid1}` })) === 1, 'duplicate webhook for same CallSid → still exactly 1 ledger row')
  } finally {
    await phoneNumbersOf.deleteMany({ _id: { $in: [CHAT, CHAT_NUM] } })
    await walletOf.deleteMany({ _id: { $in: [CHAT, String(CHAT_NUM)] } })
    await ledger.deleteMany({ chatId: { $in: [CHAT, String(CHAT_NUM), CHAT_NUM] } })
    await pending.deleteMany({ _id: { $regex: `^twilio_CADSTEST\\d${ts}` } })
    await client.close()
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
  process.exit(fails ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
