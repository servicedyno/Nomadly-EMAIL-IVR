require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const col = client.db(process.env.DB_NAME).collection('vpsPlansOf')
  const res = await col.updateMany(
    { vpsId: { $in: ['203283942', '203250431'] } },
    { $set: {
        _selfHealAttemptedAt: new Date(),
        _selfHealReason: 'contabo_404_manual_cleanup',
        _contaboCancelledEarly: true,
    } }
  )
  console.log(`stamped _selfHealAttemptedAt on ${res.modifiedCount} doc(s)`)
  const after = await col.find({ vpsId: { $in: ['203283942', '203250431'] } }).toArray()
  for (const d of after) {
    console.log(`  vpsId=${d.vpsId}  status=${d.status}  _selfHealAttemptedAt=${d._selfHealAttemptedAt?.toISOString()}  _contaboCancelledEarly=${d._contaboCancelledEarly}`)
  }
  await client.close()
})()
