// Integration test for the DEFERRED coupon-burn fix.
// Scenario (the @Grrt2231 bug): apply coupon → purchase FAILS → re-apply must still work
// (coupon NOT burned at apply-time) → purchase COMPLETES → coupon burned → single-use/day preserved.
// Uses the REAL daily-coupons module + a throwaway TEST code in today's doc (cleaned up after).
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

async function main() {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)
  const dailyCol = db.collection('dailyCoupons')
  const stateCol = db.collection('state')
  const today = new Date().toISOString().slice(0, 10)
  const CODE = 'TESTDEFER_ZZ'
  const CHAT = 'TESTCHAT_DEFER_9999'

  // seed a throwaway test code into today's doc
  await dailyCol.updateOne({ date: today }, { $set: { date: today, [`codes.${CODE}`]: { discount: 10, usedBy: [] } } }, { upsert: true })

  // init the REAL daily-coupons module (only needs db)
  const { initDailyCoupons } = require('../daily-coupons.js')
  const daily = initDailyCoupons(db, { sendMessage: async () => {} }, db.collection('nameOf'), stateCol)

  // replicate the (non-exported) redeemPendingCoupon logic against real modules
  async function redeemPendingCoupon(chatId) {
    const cid = String(chatId)
    const st = await stateCol.findOne({ _id: cid })
    const code = st?.pendingCouponCode, type = st?.pendingCouponType
    if (!code || !type) return
    if (type === 'daily') await daily.markCouponUsed(code, cid)
    await stateCol.updateOne({ _id: cid }, { $unset: { pendingCouponCode: '', pendingCouponType: '' } })
  }

  const results = {}

  // 1) APPLY: validate (should give discount) + store pending (NOT burned)
  const v1 = await daily.validateDailyCoupon(CODE, CHAT)
  results.applyValid = v1 && v1.discount === 10 && !v1.error
  await stateCol.updateOne({ _id: CHAT }, { $set: { pendingCouponCode: CODE, pendingCouponType: 'daily', couponApplied: true } }, { upsert: true })

  // 2) PURCHASE FAILS → user RE-APPLIES same coupon. Must STILL be valid (the bug fix).
  const v2 = await daily.validateDailyCoupon(CODE, CHAT)
  results.reapplyAfterFailWorks = v2 && v2.discount === 10 && !v2.error

  // 3) PURCHASE COMPLETES → redeem (burn)
  await redeemPendingCoupon(CHAT)
  const doc = await dailyCol.findOne({ date: today })
  results.burnedOnCompletion = (doc.codes[CODE].usedBy || []).includes(CHAT)
  const st = await stateCol.findOne({ _id: CHAT })
  results.pendingClearedAfterRedeem = !st.pendingCouponCode && !st.pendingCouponType

  // 4) SINGLE-USE PRESERVED: trying to use again → already_used
  const v3 = await daily.validateDailyCoupon(CODE, CHAT)
  results.singleUsePreserved = v3 && v3.error === 'already_used'

  // 5) IDEMPOTENT: a duplicate completion must not double-add (addToSet) and no-op on cleared pending
  await redeemPendingCoupon(CHAT)
  const doc2 = await dailyCol.findOne({ date: today })
  results.idempotentNoDup = (doc2.codes[CODE].usedBy || []).filter(x => x === CHAT).length === 1

  console.log(JSON.stringify(results, null, 2))
  const pass = Object.values(results).every(Boolean)
  console.log(pass ? '\nRESULT: PASS ✅' : '\nRESULT: FAIL ❌')

  // cleanup: remove test code + test state
  await dailyCol.updateOne({ date: today }, { $unset: { [`codes.${CODE}`]: '' } })
  await stateCol.deleteOne({ _id: CHAT })
  await client.close()
  process.exit(pass ? 0 : 1)
}
main().catch(e => { console.error('ERR', e.message); process.exit(1) })
