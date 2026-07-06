// Investigation script for @hhr2009 (failed hosting purchase) and
// @hellpeaces (hosting-plan issue). Read-only; no writes.
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('/app/node_modules/mongodb')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  console.log('Connected to DB:', process.env.DB_NAME)

  // ── 1. Resolve usernames to chatIds ──────────────────────────────
  const users = db.collection('users')
  const findUser = async (u) => {
    // Try many fields (Telegram usernames stored across users/state)
    const re = new RegExp('^' + u + '$', 'i')
    let doc = await users.findOne({ $or: [
      { username: re }, { userName: re }, { user_name: re },
      { first_name: re }, { last_name: re }, { fullName: re },
    ] })
    if (!doc) doc = await db.collection('state').findOne({ $or: [
      { username: re }, { userName: re }, { user_name: re },
    ] })
    return doc
  }
  const uHhr = await findUser('hhr2009')
  const uHell = await findUser('hellpeaces')
  console.log('\n── @hhr2009 lookup ──')
  console.log(uHhr ? { _id: uHhr._id, username: uHhr.username || uHhr.userName, name: uHhr.first_name || uHhr.fullName } : 'NOT FOUND in users/state')
  console.log('\n── @hellpeaces lookup ──')
  console.log(uHell ? { _id: uHell._id, username: uHell.username || uHell.userName, name: uHell.first_name || uHell.fullName } : 'NOT FOUND in users/state')

  // ── 2. Enumerate ALL collections that may contain user chat history ──
  const cols = (await db.listCollections().toArray()).map(c => c.name).sort()
  console.log('\n── Collections available (' + cols.length + '):', cols.slice(0, 60).join(', '))
  // Print collections that contain 'chat', 'support', 'ai', 'hosting', 'purchase', 'complaint', 'reply'
  const relCols = cols.filter(n => /chat|support|ai|hosting|purchase|complaint|reply|transaction|payment|log|order/i.test(n))
  console.log('Relevant:', relCols.join(', '))

  // ── 3. For each user, dump last 30 records across relevant collections ──
  const dumpFor = async (label, chatId) => {
    if (!chatId) return
    console.log('\n═══ ' + label + ' (chatId=' + chatId + ') ═══')
    for (const cn of relCols) {
      const col = db.collection(cn)
      // Try common ID field names
      const q = { $or: [
        { chatId },
        { chatId: String(chatId) },
        { userId: chatId },
        { userId: String(chatId) },
        { user_id: chatId },
        { user_id: String(chatId) },
        { user: chatId },
        { targetChatId: chatId },
        { targetChatId: String(chatId) },
        { from: chatId },
        { from: String(chatId) },
      ] }
      try {
        const cnt = await col.countDocuments(q)
        if (cnt > 0) {
          console.log('  · ' + cn + ' : ' + cnt + ' docs')
          const recent = await col.find(q).sort({ _id: -1 }).limit(5).toArray()
          recent.forEach(d => {
            // Truncate large fields for readability
            const s = JSON.stringify(d, null, 0)
            console.log('    ' + (s.length > 400 ? s.slice(0, 400) + '…' : s))
          })
        }
      } catch (e) { /* col may not support the query */ }
    }
  }

  await dumpFor('@hhr2009', uHhr && uHhr._id)
  await dumpFor('@hellpeaces', uHell && uHell._id)

  await client.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
