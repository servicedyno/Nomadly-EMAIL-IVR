// Backend E2E test for direct Crypto/NGN Marketplace-access payments.
// Seeds payment sessions in Mongo, drives the live webhook endpoints on
// localhost:5000, then asserts marketplaceAccess + wallet state. Cleans up.
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const { MongoClient } = require('mongodb')

const BASE = 'http://localhost:5000'
const DB_NAME = process.env.DB_NAME
const MONGO_URL = process.env.MONGO_URL

const CID_CRYPTO_OK = '900000701'
const CID_CRYPTO_UNDER = '900000702'
const CID_NGN_OK = '900000703'
const FEE = Number(process.env.MARKETPLACE_ACCESS_FEE_USD || 50)

const results = []
const rec = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`) }

async function main() {
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(DB_NAME)
  const dyno = db.collection('chatIdOfDynopayPayment')
  const bank = db.collection('chatIdOfPayment')
  const access = db.collection('marketplaceAccess')
  const walletOf = db.collection('walletOf')
  const payments = db.collection('payments')
  const state = db.collection('state')

  const testCids = [CID_CRYPTO_OK, CID_CRYPTO_UNDER, CID_NGN_OK]
  const cleanup = async () => {
    for (const c of testCids) {
      await access.deleteMany({ _id: { $in: [Number(c), String(c)] } })
      await walletOf.deleteMany({ _id: { $in: [Number(c), String(c)] } })
      await state.deleteMany({ _id: { $in: [Number(c), String(c)] } })
    }
    await dyno.deleteMany({ _id: /^mptest_/ })
    await bank.deleteMany({ _id: /^mptest_/ })
    await payments.deleteMany({ _id: /^mptest_/ })
  }
  await cleanup()

  // ── 1. DynoPay crypto — exact payment → access granted ──
  {
    const ref = 'mptest_crypto_ok_' + Date.now()
    await dyno.updateOne({ _id: ref }, { $set: { val: { chatId: CID_CRYPTO_OK, price: FEE, product: 'Marketplace Access', action: 'payMarketplaceAccess', address: 'addr_test' } } }, { upsert: true })
    await axios.post(`${BASE}/dynopay/crypto-pay-marketplace-access`, {
      event: 'payment.confirmed', status: 'confirmed', payment_id: ref + '_pid',
      currency: 'USDT', amount: '50', base_amount: String(FEE), fee_payer: 'company',
      meta_data: { refId: ref, product_name: 'payMarketplaceAccess' },
    }, { headers: { 'Content-Type': 'application/json' } })
    await new Promise(r => setTimeout(r, 1200))
    const doc = await access.findOne({ _id: { $in: [Number(CID_CRYPTO_OK), String(CID_CRYPTO_OK)] }, paid: true })
    rec('DynoPay crypto exact → access granted', !!doc && doc.mode === 'crypto' && Number(doc.amountUsd) === FEE, doc ? `mode=${doc.mode} amountUsd=${doc.amountUsd}` : 'no access doc')
    const sess = await dyno.findOne({ _id: ref })
    rec('DynoPay crypto → payment session deleted', !sess, sess ? 'session still present' : '')
    const st = await state.findOne({ _id: String(CID_CRYPTO_OK) })
    rec('DynoPay crypto → state action set to mpHome', st && st.action === 'mpHome', st ? `action=${st.action}` : 'no state doc')
  }

  // ── 2. DynoPay crypto — underpaid → NO access, wallet credited ──
  {
    const ref = 'mptest_crypto_under_' + Date.now()
    await dyno.updateOne({ _id: ref }, { $set: { val: { chatId: CID_CRYPTO_UNDER, price: FEE, product: 'Marketplace Access', action: 'payMarketplaceAccess', address: 'addr_test' } } }, { upsert: true })
    await axios.post(`${BASE}/dynopay/crypto-pay-marketplace-access`, {
      event: 'payment.confirmed', status: 'confirmed', payment_id: ref + '_pid',
      currency: 'USDT', amount: '10', base_amount: '10', fee_payer: 'company',
      meta_data: { refId: ref, product_name: 'payMarketplaceAccess' },
    }, { headers: { 'Content-Type': 'application/json' } })
    await new Promise(r => setTimeout(r, 1200))
    const doc = await access.findOne({ _id: { $in: [Number(CID_CRYPTO_UNDER), String(CID_CRYPTO_UNDER)] }, paid: true })
    const wallet = await walletOf.findOne({ _id: String(CID_CRYPTO_UNDER) })
    const credited = (wallet?.usdIn || 0)
    rec('DynoPay crypto underpaid → NO access', !doc, doc ? 'access wrongly granted' : '')
    rec('DynoPay crypto underpaid → wallet credited', credited >= 9.99, `usdIn=${credited}`)
  }

  // ── 3. Fincra NGN bank — sufficient → access granted ──
  {
    const ref = 'mptest_ngn_ok_' + Date.now()
    await bank.updateOne({ _id: ref }, { $set: { val: { chatId: CID_NGN_OK, price: FEE, product: 'Marketplace Access', endpoint: '/bank-pay-marketplace-access' } } }, { upsert: true })
    await axios.post(`${BASE}/webhook`, {
      event: 'collection.successful',
      data: { merchantReference: ref, reference: 'fcr-test-' + Date.now(), amountReceived: 500000, currency: 'NGN', status: 'successful' },
    }, { headers: { 'Content-Type': 'application/json' } })
    await new Promise(r => setTimeout(r, 1500))
    const doc = await access.findOne({ _id: { $in: [Number(CID_NGN_OK), String(CID_NGN_OK)] }, paid: true })
    rec('Fincra NGN sufficient → access granted', !!doc && doc.mode === 'ngn', doc ? `mode=${doc.mode} amountUsd=${doc.amountUsd}` : 'no access doc (check NGN→USD rate / amount)')
  }

  await cleanup()
  await client.close()
  const failed = results.filter(r => !r.pass)
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`)
  process.exit(failed.length ? 1 : 0)
}

main().catch(e => { console.error('TEST ERROR:', e.message); process.exit(2) })
