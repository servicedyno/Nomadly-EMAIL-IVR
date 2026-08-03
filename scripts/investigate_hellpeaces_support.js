// READ-ONLY. Dump transactions, escalations, and file/delete-related support chats for @hellpeaces.
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('/app/node_modules/mongodb')
const CHAT = '5522767823'
const short = (v, n = 700) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s && s.length > n ? s.slice(0, n) + '…' : s }
;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  console.log('══ transactions (4) ══')
  const tx = await db.collection('transactions').find({ $or: [{ chatId: CHAT }, { chatId: Number(CHAT) }] }).sort({ _id: -1 }).toArray()
  for (const t of tx) console.log(' ', short(t, 400))

  console.log('\n══ scheduledEvents ══')
  const se = await db.collection('scheduledEvents').find({ $or: [{ chatId: CHAT }, { chatId: Number(CHAT) }] }).toArray()
  for (const s of se) console.log(' ', short(s, 400))

  console.log('\n══ escalations (8) ══')
  const esc = await db.collection('escalations').find({ $or: [{ chatId: CHAT }, { chatId: Number(CHAT) }] }).sort({ _id: -1 }).toArray()
  for (const e of esc) {
    console.log(' [%s] status=%s reason=%s', e.createdAt || e.ts || e._id, e.status, short(e.reason || e.summary || e.text, 200))
  }

  console.log('\n══ aiSupportChats mentioning file/delete/folder/permission (newest 25) ══')
  const chats = await db.collection('aiSupportChats')
    .find({ $or: [{ chatId: CHAT }, { chatId: Number(CHAT) }] })
    .sort({ _id: -1 }).limit(200).toArray()
  const rx = /delet|file|folder|remove|permission|can'?t|cannot|eperm|renew|charge|debit|75|wallet|suspend/i
  let shown = 0
  for (const c of chats) {
    const text = c.message || c.text || c.userMessage || c.content || c.q || JSON.stringify(c)
    const reply = c.reply || c.response || c.aiReply || c.a || ''
    const blob = String(text) + ' ' + String(reply)
    if (rx.test(blob)) {
      console.log(' [%s] role=%s\n   U: %s\n   A: %s', c.createdAt || c.ts || c.timestamp || '?', c.role || c.from || '', short(text, 260), short(reply, 260))
      if (++shown >= 25) break
    }
  }
  if (!shown) {
    console.log('  (no keyword match) — dumping newest 6 raw:')
    for (const c of chats.slice(0, 6)) console.log('  ', short(c, 300))
  }
  await client.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
