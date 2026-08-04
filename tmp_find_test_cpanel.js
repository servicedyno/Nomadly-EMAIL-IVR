// Look for any existing test/dev cPanel accounts
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

async function main() {
  const c = new MongoClient(process.env.MONGO_URL)
  await c.connect()
  const db = c.db(process.env.DB_NAME || 'test')

  // Look for test-like cpUsers
  const testish = await db.collection('cpanelAccounts').find({
    $or: [
      { cpUser: { $regex: /^(test|dev|admin|demo|sample)/i } },
      { domain: { $regex: /(test|dev|example|demo|sample)/i } },
      { chatId: { $regex: /^(TEST|DEV|test)/ } },
    ],
    deleted: { $ne: true },
  }).limit(15).toArray()

  console.log(`Found ${testish.length} test-like accounts:`)
  testish.forEach(a => console.log('  →', JSON.stringify({
    cpUser: a.cpUser, domain: a.domain, chatId: a.chatId,
    plan: a.plan, createdAt: a.createdAt, whmHost: a.whmHost, deleted: a.deleted,
  })))

  // Also look at chatId 5590563715 (admin)
  const admin = await db.collection('cpanelAccounts').find({ chatId: '5590563715', deleted: { $ne: true } }).toArray()
  console.log(`\nAdmin (5590563715) cPanels (${admin.length}):`)
  admin.forEach(a => console.log('  →', JSON.stringify({
    cpUser: a.cpUser, domain: a.domain, plan: a.plan, whmHost: a.whmHost,
  })))

  await c.close()
}
main().catch(e => { console.error(e); process.exit(1) })
