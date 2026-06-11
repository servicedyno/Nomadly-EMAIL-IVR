require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  // Look in `users` for username davion419 and various derivatives
  console.log('=== Search users by username ===')
  const users = await db.collection('users').find({
    $or: [
      { username: /davion419/i },
      { 'val.username': /davion419/i },
      { firstName: /davion419/i },
      { 'val.firstName': /davion419/i },
    ]
  }).toArray()
  // Also pull state matches by username (the @davion419 was found there)
  const stateMatches = await db.collection('state').find({
    $or: [
      { 'val.username': /davion419/i },
      { 'username': /davion419/i },
    ]
  }).limit(5).toArray()
  console.log(`Direct user matches: ${users.length}, state matches: ${stateMatches.length}`)

  const chatIds = new Set()
  for (const u of users) chatIds.add(String(u._id))
  for (const s of stateMatches) chatIds.add(String(s._id))

  for (const chatId of chatIds) {
    console.log(`\n=== chatId=${chatId} ===`)
    const state = await db.collection('state').findOne({ _id: String(chatId) })
    console.log(`  state.action: ${state?.val?.action || state?.action || '(none)'}`)
    console.log(`  state.userVPSDetails:`, JSON.stringify(state?.val?.userVPSDetails || state?.userVPSDetails || null).substring(0, 400))
    const vps = await db.collection('vpsPlansOf').find({ chatId: String(chatId) }).toArray()
    console.log(`  vpsPlansOf entries: ${vps.length}`)
    for (const v of vps) {
      console.log(`    - id=${v._id} productId=${v.productId} status=${v.status} contaboId=${v.contaboInstanceId || '?'} createdAt=${v.createdAt} valid_until=${v.valid_until}`)
    }
    // Look in deposit / transaction history
    const wallet = await db.collection('wallet').findOne({ _id: String(chatId) })
    console.log(`  wallet balance: ${wallet?.val?.balance || wallet?.balance || 0}`)
    // Recent VPS-related messages? Check state.userVPSDetails or deposit history
    const txs = await db.collection('transactions').find({ chatId: String(chatId) }).sort({ createdAt: -1 }).limit(8).toArray()
    console.log(`  recent transactions: ${txs.length}`)
    for (const t of txs) console.log(`    - ${t.createdAt} ${t.type} ${t.amount} ${t.description || t.note || ''}`)
  }

  await client.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
