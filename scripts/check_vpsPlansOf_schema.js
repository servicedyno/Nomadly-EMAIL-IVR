/**
 * Check vpsPlansOf schema and find all records
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  const count = await db.collection('vpsPlansOf').countDocuments()
  console.log(`Total vpsPlansOf records: ${count}`)

  const sample = await db.collection('vpsPlansOf').find().limit(3).toArray()
  console.log('\nFirst 3 records:')
  for (const r of sample) {
    console.log(JSON.stringify(r, null, 2))
    console.log('---')
  }

  // Look for instance 203251506 with all possible field names
  const queries = [
    { 'val.instanceId': 203251506 },
    { 'val.instanceId': '203251506' },
    { 'val.id': 203251506 },
    { 'val.id': '203251506' },
    { 'val._id': '203251506' },
    { 'val._id': 203251506 },
    { instanceId: 203251506 },
    { instanceId: '203251506' },
    { _id: '203251506' },
    { 'val.name': 'nomadly-1137258806-1776885840779' },
    { 'val.displayName': 'nomadly-1137258806-1776885840779' },
  ]
  for (const q of queries) {
    const r = await db.collection('vpsPlansOf').findOne(q)
    if (r) {
      console.log(`\n✓ matched ${JSON.stringify(q)}`)
      console.log(JSON.stringify(r, null, 2))
    }
  }

  // Find anything mentioning 1137258806
  console.log('\n\nAll vpsPlansOf with chatId 1137258806:')
  const byChat = await db.collection('vpsPlansOf').find({ chatId: '1137258806' }).toArray()
  console.log(`Count: ${byChat.length}`)
  for (const r of byChat) console.log(JSON.stringify(r, null, 2))

  // Look for anyone with this contabo instance # ANYWHERE
  console.log('\n\nFull-text search for "203251506" across vpsPlansOf:')
  const allDocs = await db.collection('vpsPlansOf').find({}).toArray()
  for (const d of allDocs) {
    const s = JSON.stringify(d)
    if (s.includes('203251506')) console.log(' -', JSON.stringify(d, null, 2))
  }
  console.log(`Total docs scanned: ${allDocs.length}`)

  await client.close()
})().catch(e => { console.error('Fatal:', e); process.exit(1) })
