// Extended backend test: covers overpayment, idempotency, and route
// registration for the marketplace-access payment endpoints.
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const { MongoClient } = require('mongodb')

const BASE = 'http://localhost:5000'
const DB_NAME = process.env.DB_NAME
const MONGO_URL = process.env.MONGO_URL
const FEE = Number(process.env.MARKETPLACE_ACCESS_FEE_USD || 50)

const CID_OVER = '900000801'
const CID_IDEMP_CRYPTO = '900000802'
const CID_IDEMP_NGN = '900000803'
const testCids = [CID_OVER, CID_IDEMP_CRYPTO, CID_IDEMP_NGN]

const results = []
const rec = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function postDyno(ref, chatId, amountUsd) {
  return axios.post(
    `${BASE}/dynopay/crypto-pay-marketplace-access`,
    {
      event: 'payment.confirmed',
      status: 'confirmed',
      payment_id: ref + '_pid_' + Math.random().toString(36).slice(2, 8),
      currency: 'USDT',
      amount: String(amountUsd),
      base_amount: String(amountUsd),
      fee_payer: 'company',
      meta_data: { refId: ref, product_name: 'payMarketplaceAccess' },
    },
    { headers: { 'Content-Type': 'application/json' }, validateStatus: () => true },
  )
}

async function postFincra(ref, amountNgn) {
  return axios.post(
    `${BASE}/webhook`,
    {
      event: 'collection.successful',
      data: {
        merchantReference: ref,
        reference: 'fcr-ext-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        amountReceived: amountNgn,
        currency: 'NGN',
        status: 'successful',
      },
    },
    { headers: { 'Content-Type': 'application/json' }, validateStatus: () => true },
  )
}

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

  const cleanup = async () => {
    for (const c of testCids) {
      await access.deleteMany({ _id: { $in: [Number(c), String(c)] } })
      await walletOf.deleteMany({ _id: { $in: [Number(c), String(c)] } })
      await state.deleteMany({ _id: { $in: [Number(c), String(c)] } })
    }
    await dyno.deleteMany({ _id: /^mpext_/ })
    await bank.deleteMany({ _id: /^mpext_/ })
    await payments.deleteMany({ _id: /^mpext_/ })
  }
  await cleanup()

  // ── 1. Route-registration checks (no 404) ──
  try {
    const r1 = await axios.get(`${BASE}/crypto-pay-marketplace-access`, { validateStatus: () => true })
    rec('GET /crypto-pay-marketplace-access is registered (not 404)', r1.status !== 404, `status=${r1.status}`)
  } catch (e) { rec('GET /crypto-pay-marketplace-access is registered (not 404)', false, e.message) }
  try {
    const r2 = await axios.post(`${BASE}/dynopay/crypto-pay-marketplace-access`, {}, { validateStatus: () => true })
    rec('POST /dynopay/crypto-pay-marketplace-access is registered (not 404)', r2.status !== 404, `status=${r2.status}`)
  } catch (e) { rec('POST /dynopay/crypto-pay-marketplace-access is registered (not 404)', false, e.message) }
  try {
    const r3 = await axios.post(`${BASE}/webhook`, {}, { validateStatus: () => true })
    rec('POST /webhook is registered (not 404)', r3.status !== 404, `status=${r3.status}`)
  } catch (e) { rec('POST /webhook is registered (not 404)', false, e.message) }

  // ── 2. DynoPay crypto OVERPAYMENT → access granted + surplus to wallet ──
  {
    const ref = 'mpext_over_' + Date.now()
    await dyno.updateOne(
      { _id: ref },
      { $set: { val: { chatId: CID_OVER, price: FEE, product: 'Marketplace Access', action: 'payMarketplaceAccess', address: 'addr_test' } } },
      { upsert: true },
    )
    const overAmt = FEE + 25 // $75 total, expect $25 surplus
    await postDyno(ref, CID_OVER, overAmt)
    await sleep(1500)
    const doc = await access.findOne({ _id: { $in: [Number(CID_OVER), String(CID_OVER)] }, paid: true })
    rec(
      'DynoPay crypto OVER-paid → access granted (mode=crypto, amountUsd=fee)',
      !!doc && doc.mode === 'crypto' && Number(doc.amountUsd) === FEE,
      doc ? `mode=${doc.mode} amountUsd=${doc.amountUsd}` : 'no access doc',
    )
    const wallet = await walletOf.findOne({ _id: String(CID_OVER) })
    const credited = wallet?.usdIn || 0
    rec(
      'DynoPay crypto OVER-paid → surplus credited to wallet (~$25)',
      credited >= 24.99 && credited <= 25.01,
      `usdIn=${credited}`,
    )
    const sess = await dyno.findOne({ _id: ref })
    rec('DynoPay crypto OVER-paid → payment session deleted', !sess, sess ? 'session still present' : '')
  }

  // ── 3. DynoPay crypto IDEMPOTENCY → 2nd payment does NOT re-grant, credits wallet ──
  {
    const ref1 = 'mpext_idemp_c1_' + Date.now()
    await dyno.updateOne(
      { _id: ref1 },
      { $set: { val: { chatId: CID_IDEMP_CRYPTO, price: FEE, product: 'Marketplace Access', action: 'payMarketplaceAccess', address: 'addr_test' } } },
      { upsert: true },
    )
    await postDyno(ref1, CID_IDEMP_CRYPTO, FEE)
    await sleep(1500)
    const firstAccess = await access.findOne({ _id: { $in: [Number(CID_IDEMP_CRYPTO), String(CID_IDEMP_CRYPTO)] }, paid: true })
    rec('Idempotency setup: 1st crypto payment granted access', !!firstAccess, firstAccess ? `mode=${firstAccess.mode}` : 'no access')
    const firstPaidAt = firstAccess?.paidAt

    // 2nd payment attempt while already having access
    const ref2 = 'mpext_idemp_c2_' + Date.now()
    await dyno.updateOne(
      { _id: ref2 },
      { $set: { val: { chatId: CID_IDEMP_CRYPTO, price: FEE, product: 'Marketplace Access', action: 'payMarketplaceAccess', address: 'addr_test' } } },
      { upsert: true },
    )
    await postDyno(ref2, CID_IDEMP_CRYPTO, FEE)
    await sleep(1500)
    const secondAccess = await access.findOne({ _id: { $in: [Number(CID_IDEMP_CRYPTO), String(CID_IDEMP_CRYPTO)] }, paid: true })
    rec(
      'Crypto idempotency: 2nd payment did NOT re-grant (paidAt unchanged)',
      !!secondAccess && String(secondAccess.paidAt) === String(firstPaidAt),
      `firstPaidAt=${firstPaidAt} secondPaidAt=${secondAccess?.paidAt}`,
    )
    const wallet = await walletOf.findOne({ _id: String(CID_IDEMP_CRYPTO) })
    const credited = wallet?.usdIn || 0
    rec(
      'Crypto idempotency: 2nd payment credited full $50 to wallet',
      credited >= 49.99 && credited <= 50.01,
      `usdIn=${credited}`,
    )
  }

  // ── 4. Fincra NGN IDEMPOTENCY → 2nd payment does NOT re-grant, credits wallet ──
  {
    const ref1 = 'mpext_idemp_n1_' + Date.now()
    await bank.updateOne(
      { _id: ref1 },
      { $set: { val: { chatId: CID_IDEMP_NGN, price: FEE, product: 'Marketplace Access', endpoint: '/bank-pay-marketplace-access' } } },
      { upsert: true },
    )
    await postFincra(ref1, 500000) // ~$50 worth
    await sleep(1800)
    const firstAccess = await access.findOne({ _id: { $in: [Number(CID_IDEMP_NGN), String(CID_IDEMP_NGN)] }, paid: true })
    rec('Idempotency setup: 1st NGN payment granted access (mode=ngn)', !!firstAccess && firstAccess.mode === 'ngn', firstAccess ? `mode=${firstAccess.mode} amountUsd=${firstAccess.amountUsd}` : 'no access')
    const firstPaidAt = firstAccess?.paidAt
    const firstMode = firstAccess?.mode

    const ref2 = 'mpext_idemp_n2_' + Date.now()
    await bank.updateOne(
      { _id: ref2 },
      { $set: { val: { chatId: CID_IDEMP_NGN, price: FEE, product: 'Marketplace Access', endpoint: '/bank-pay-marketplace-access' } } },
      { upsert: true },
    )
    await postFincra(ref2, 500000)
    await sleep(1800)
    const secondAccess = await access.findOne({ _id: { $in: [Number(CID_IDEMP_NGN), String(CID_IDEMP_NGN)] }, paid: true })
    rec(
      'NGN idempotency: 2nd payment did NOT re-grant (paidAt/mode preserved)',
      !!secondAccess && String(secondAccess.paidAt) === String(firstPaidAt) && secondAccess.mode === firstMode,
      `firstPaidAt=${firstPaidAt} secondPaidAt=${secondAccess?.paidAt} mode=${secondAccess?.mode}`,
    )
    const wallet = await walletOf.findOne({ _id: String(CID_IDEMP_NGN) })
    const credited = wallet?.usdIn || 0
    rec(
      'NGN idempotency: 2nd payment credited USD-equivalent to wallet (>0)',
      credited > 0,
      `usdIn=${credited}`,
    )
  }

  await cleanup()
  await client.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => { console.error('TEST ERROR:', e.message); process.exit(2) })
