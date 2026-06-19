// Seeds a deterministic storefront test fixture (web user + pending top-up order).
// DB-only; cleaned up by cleanup_storetest.js.
require('/app/node_modules/dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('/app/node_modules/mongodb')
const bcrypt = require('/app/node_modules/bcryptjs')

const EMAIL = 'storetest@example.com'
const PASS = 'password1234'
const USER_ID = 'webuser-storetest-fixed'
const ORDER_ID = 'STORE-TEST-ORDER-1'

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const passwordHash = await bcrypt.hash(PASS, 10)
  await db.collection('webUsers').updateOne(
    { _id: USER_ID },
    { $set: { _id: USER_ID, email: EMAIL, passwordHash, walletUsd: 0, createdAt: new Date(), lastLogin: null, __seedTest: true } },
    { upsert: true }
  )
  await db.collection('webOrders').updateOne(
    { _id: ORDER_ID },
    { $set: {
      _id: ORDER_ID, webUserId: USER_ID, kind: 'wallet_topup', amountUsd: 25,
      coin: 'USDT-TRC20', provider: 'dynopay', status: 'pending',
      payAddress: 'TTEST_FAKE_ADDR_FOR_WEBHOOK_TEST', paymentId: null, usdCredited: 0,
      createdAt: new Date(), updatedAt: new Date(), __seedTest: true,
    } },
    { upsert: true }
  )
  console.log(`SEEDED webUser=${EMAIL} pass=${PASS} userId=${USER_ID} pendingOrder=${ORDER_ID} ($25 USDT-TRC20)`)
  await client.close()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
