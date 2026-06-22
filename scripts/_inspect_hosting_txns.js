#!/usr/bin/env node
require('dotenv').config({ path: '/app/backend/.env' });
const { MongoClient } = require('mongodb');
(async () => {
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'test_database');
  const start = new Date(Date.now() - 21*86400000);

  // List all hostingTransactions in window with raw fields
  const all = await db.collection('hostingTransactions').find({}).sort({_id:-1}).limit(40).toArray();
  console.log(`Got ${all.length} latest hostingTransactions`);
  const samples = {};
  for (const t of all) {
    const s = t.status || 'NO_STATUS';
    samples[s] = (samples[s] || 0) + 1;
  }
  console.log('Status mix among latest 40:', samples);

  // Find every doc with status NOT success
  const nonSuccess = all.filter(t => t.status !== 'success');
  console.log(`\nNon-success (${nonSuccess.length}):`);
  for (const t of nonSuccess) {
    console.log(`\n--- ${t._id} ---`);
    console.log(JSON.stringify(t, null, 2));
  }

  // Try possible date fields
  for (const field of ['createdAt', 'created_at', 'timestamp', 'queuedAt', 'completedAt', 'updatedAt']) {
    const c = await db.collection('hostingTransactions').countDocuments({ [field]: { $gte: start } });
    if (c > 0) console.log(`field "${field}" → ${c} docs in last 21d`);
  }

  // Show 1 sample doc fully
  const one = await db.collection('hostingTransactions').findOne({});
  console.log(`\nSAMPLE hostingTransaction doc structure:`);
  console.log(JSON.stringify(one, null, 2));

  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
