require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
;(async () => {
  const uri = process.env.MONGO_URL
  const dbn = process.env.DB_NAME || 'test'
  const c = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 })
  await c.connect()
  const db = c.db(dbn)
  const results = {}

  // Try to find by username in nameOf collection
  const nameDoc = await db.collection('nameOf').findOne({ val: 'hostbay_support' })
  results.nameOf_by_val = nameDoc

  // Also try telegramUsernameOf collection
  const tuColl = await db.listCollections({ name: /username|handle|telegram/i }).toArray()
  results.username_collections = tuColl.map(c => c.name)

  // Try a case-insensitive scan
  const anyMatch = await db.collection('nameOf').find({ val: { $regex: /^hostbay_support$/i } }).limit(5).toArray()
  results.nameOf_regex = anyMatch

  // Try teleUserOf, telegramUserOf, tgUserOf
  for (const collName of ['teleUserOf', 'telegramUserOf', 'tgUserOf', 'userOf', 'usernameOf']) {
    try {
      const doc = await db.collection(collName).findOne({ val: { $regex: /hostbay_support/i } })
      if (doc) results[collName] = doc
    } catch (_) {}
  }

  console.log(JSON.stringify(results, null, 2))
  await c.close()
})().catch(e => { console.error(e.message); process.exit(1) })
