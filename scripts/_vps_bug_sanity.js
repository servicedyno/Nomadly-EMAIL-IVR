// Sanity check for the @Hostbay_support VPS auto-deploy bug fix.
// Reproduces the stale-VPS-cart state, then fires the "Top up Wallet" quick
// callback and asserts the pending VPS confirmation action is CLEARED so a
// subsequent "Yes" tap can NOT re-confirm a VPS deploy.
// SAFETY: we never send "Yes" — we only assert the action was neutralised.
'use strict'
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') })
const http = require('http')
const { MongoClient } = require('mongodb')

const CHAT = 888800030, CHAT_S = String(CHAT)
const WEBHOOK = 'http://127.0.0.1:5000/telegram/webhook'
function post(update) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(update)
    const req = http.request(WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} }, (res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>resolve({status:res.statusCode,body:d}))})
    req.on('error', reject); req.write(body); req.end()
  })
}
const sleep = ms => new Promise(r=>setTimeout(r,ms))
let uid = 7000
const cb = (data) => ({ update_id: ++uid, callback_query: { id:String(uid), from:{id:CHAT,is_bot:false,first_name:'V',username:'vbug'}, message:{ message_id: uid, chat:{id:CHAT,type:'private'}, date:Math.floor(Date.now()/1000) }, data } })

async function main() {
  const client = new MongoClient(process.env.MONGO_URL); await client.connect()
  const db = client.db(process.env.DB_NAME)
  const state = db.collection('state'); const wallet = db.collection('walletOf')
  const vpsPlans = db.collection('vpsPlansOf'); const vpsTx = db.collection('vpsTransactions')

  // Seed the DANGEROUS pre-fix state: user sitting on a VPS payment confirmation
  // with a fully-configured cart, and a funded wallet.
  await state.updateOne({ _id: CHAT_S }, { $set: {
    _id: CHAT_S, userLanguage:'en', isNewUser:false, adminTakeover:false,
    action: 'proceedWithVpsPayment',
    vpsDetails: { productId:'s-1vcpu-1gb', region:'EU', totalPrice: 18, isRDP:false, _prevNavStep:'sshSkipped', displayName:'sanity-should-not-deploy' },
  } }, { upsert: true })
  await wallet.updateOne({ _id: CHAT_S }, { $set: { _id: CHAT_S, usdIn: 100, usdOut: 0, ngnIn:0, ngnOut:0 } }, { upsert: true })
  const vpsBefore = await vpsPlans.countDocuments({ _id: { $in: [CHAT, CHAT_S] } })
  const txBefore = await vpsTx.countDocuments({ chatId: { $in: [CHAT, CHAT_S] } })

  let pass=0, fail=0
  const check=(l,c,e='')=>{console.log(`${c?'✅':'❌'} ${l}${e?'  '+e:''}`);c?pass++:fail++}

  // Fire the "Top up Wallet" quick callback (the exact button from the paywall).
  const r = await post(cb('wallet_topup_quick')); await sleep(1500)
  const s1 = await state.findOne({ _id: CHAT_S })
  check('callback accepted (HTTP 200)', r.status === 200, `status=${r.status}`)
  check('stale VPS confirm action CLEARED (not proceedWithVpsPayment)', s1?.action !== 'proceedWithVpsPayment', `action=${s1?.action}`)
  check('wallet NOT charged (usdOut=0)', (s1 && (await wallet.findOne({_id:CHAT_S}))?.usdOut === 0), `usdOut=${(await wallet.findOne({_id:CHAT_S}))?.usdOut}`)
  const vpsAfter = await vpsPlans.countDocuments({ _id: { $in: [CHAT, CHAT_S] } })
  const txAfter = await vpsTx.countDocuments({ chatId: { $in: [CHAT, CHAT_S] } })
  check('no VPS plan created', vpsAfter === vpsBefore, `before=${vpsBefore} after=${vpsAfter}`)
  check('no VPS transaction created', txAfter === txBefore, `before=${txBefore} after=${txAfter}`)

  // Cleanup
  await state.deleteMany({ _id: CHAT_S }); await wallet.deleteMany({ _id: CHAT_S })
  console.log(`\n═══ ${pass} passed, ${fail} failed ═══`)
  await client.close(); process.exit(fail===0?0:1)
}
main().catch(e=>{console.error('FATAL',e);process.exit(2)})
