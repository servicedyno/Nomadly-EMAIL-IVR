// Removes the throwaway panel test account seeded by seed_paneltest.js
require('/app/node_modules/dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('/app/node_modules/mongodb')
;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const col = client.db(process.env.DB_NAME || 'test').collection('cpanelAccounts')
  const r = await col.deleteOne({ _id: 'pnldoctest', __seedTestAccount: true })
  console.log('cleanup deletedCount=', r.deletedCount)
  await client.close()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
