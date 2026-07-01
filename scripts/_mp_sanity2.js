// Sanity check for buyer→seller contact gating (Edits 7 & 8).
'use strict'
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') })
const http = require('http')
const { MongoClient } = require('mongodb')
const ms = require('../js/marketplace-service.js')

const SELLER = 888800010, SELLER_S = String(SELLER)
const BUYER = 888800011, BUYER_S = String(BUYER)
const WEBHOOK = 'http://127.0.0.1:5000/telegram/webhook'

function post(update) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(update)
    const req = http.request(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})) })
    req.on('error', reject); req.write(body); req.end()
  })
}
let uid = 5000
const cbUpdate = (chatId, data) => ({ update_id: ++uid, callback_query: { id: String(uid), from: { id: chatId, is_bot:false, first_name:'U', username:'u'+chatId }, message: { message_id: uid, chat: { id: chatId, type:'private' }, date: Math.floor(Date.now()/1000) }, data } })
const sleep = (ms) => new Promise(r=>setTimeout(r,ms))

async function main() {
  const client = new MongoClient(process.env.MONGO_URL); await client.connect()
  const db = client.db(process.env.DB_NAME)
  await ms.initMarketplace(db)
  const state = db.collection('state'); const access = db.collection('marketplaceAccess')
  const products = db.collection('marketplaceProducts'); const convs = db.collection('marketplaceConversations')

  // Cleanup
  await access.deleteMany({ _id: { $in: [SELLER, SELLER_S, BUYER, BUYER_S] } })
  await products.deleteMany({ sellerId: { $in: [SELLER, SELLER_S] } })
  // Seed states
  await state.updateOne({ _id: SELLER_S }, { $set: { _id: SELLER_S, userLanguage:'en', action:'none', isNewUser:false } }, { upsert: true })
  await state.updateOne({ _id: BUYER_S }, { $set: { _id: BUYER_S, userLanguage:'en', action:'none', isNewUser:false } }, { upsert: true })

  // Create an ACTIVE product owned by the UNPAID seller (seller has no access doc)
  const product = await ms.createProduct({ sellerId: SELLER_S, sellerUsername: 'u'+SELLER, title: 'Sanity Test Widget', description: 'x', price: 100, category: '🔧 Tools', images: [] })

  let pass=0, fail=0
  const check=(l,c,e='')=>{console.log(`${c?'✅':'❌'} ${l}${e?'  '+e:''}`);c?pass++:fail++}

  // TEST A: Buyer taps "Chat with Seller" → convo created; buyer in mpChat; UNPAID seller NOT auto-entered into chat
  await post(cbUpdate(BUYER, `mp:chat:${product._id}`)); await sleep(1500)
  const conv = await convs.findOne({ productId: product._id, buyerId: BUYER_S })
  check('A conversation created for buyer', !!conv, `conv=${conv?._id}`)
  const buyerState = await state.findOne({ _id: BUYER_S })
  check('A buyer entered chat (action=mpChat)', buyerState?.action === 'mpChat', `got=${buyerState?.action}`)
  const sellerState = await state.findOne({ _id: SELLER_S })
  check('A UNPAID seller NOT auto-entered into chat', sellerState?.action !== 'mpChat', `got seller action=${sellerState?.action}`)

  // TEST B: Unpaid seller taps "Reply" (from locked alert) → routed to mpSellerPaywall (intent=reply)
  if (conv) {
    await post(cbUpdate(SELLER, `mp:reply:${conv._id}`)); await sleep(1200)
    const s2 = await state.findOne({ _id: SELLER_S })
    check('B unpaid seller reply → mpSellerPaywall', s2?.action === 'mpSellerPaywall', `got=${s2?.action}`)
    check('B paywall intent=reply stored', s2?.mpPaywallIntent === 'reply', `intent=${s2?.mpPaywallIntent}`)
    check('B paywall convId stored', s2?.mpPaywallConvId === conv._id, `convId=${s2?.mpPaywallConvId}`)

    // TEST C: Grant seller access, tap reply again → enters chat
    await ms.grantMarketplaceAccess(SELLER_S, { amountUsd: 50, mode: 'wallet', txnId: 'SANITY-GRANT' })
    await state.updateOne({ _id: SELLER_S }, { $set: { action: 'none' } })
    await post(cbUpdate(SELLER, `mp:reply:${conv._id}`)); await sleep(1200)
    const s3 = await state.findOne({ _id: SELLER_S })
    check('C paid seller reply → enters chat (mpChat)', s3?.action === 'mpChat', `got=${s3?.action}`)
  }

  // Cleanup
  await access.deleteMany({ _id: { $in: [SELLER, SELLER_S, BUYER, BUYER_S] } })
  await products.deleteMany({ sellerId: { $in: [SELLER, SELLER_S] } })
  await convs.deleteMany({ productId: product._id })
  await state.deleteMany({ _id: { $in: [SELLER_S, BUYER_S] } })
  console.log(`\n═══ ${pass} passed, ${fail} failed ═══`)
  await client.close(); process.exit(fail===0?0:1)
}
main().catch(e=>{console.error('FATAL',e);process.exit(2)})
