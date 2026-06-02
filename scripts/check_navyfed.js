// Look up homepage-navyfed.com state and recent toggle history
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '/app/backend/.env' });

(async () => {
  const url = process.env.RAILWAY_MONGO_URL;
  const client = new MongoClient(url, { directConnection: true, serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db('nomadly');
  console.log('Connected to production MongoDB\n');

  const target = 'homepage-navyfed.com';
  const doc = await db.collection('registeredDomains').findOne({ _id: target });
  console.log(`=== registeredDomains[_id="${target}"] ===`);
  if (!doc) {
    console.log('NOT FOUND');
  } else {
    console.log(JSON.stringify(doc, null, 2));
  }

  // Also check the user @night_ismine
  console.log('\n=== users matching night_ismine ===');
  const users = await db.collection('users').find({
    $or: [
      { 'val.username': { $regex: /night.?ismine/i } },
      { 'val.tgUsername': { $regex: /night.?ismine/i } },
    ],
  }).limit(5).toArray();
  console.log(`Found ${users.length} users`);
  for (const u of users) {
    console.log({ _id: u._id, username: u.val?.username || u.val?.tgUsername, plan: u.val?.plan, cpUsername: u.val?.cpUsername });
  }

  // Any worker route status notes
  console.log('\n=== Worker route check via CF API (homepage-navyfed.com) ===');
  // Will need zoneId from doc
  if (doc?.val?.cfZoneId) {
    const axios = require('axios');
    try {
      const r = await axios.get(
        `https://api.cloudflare.com/client/v4/zones/${doc.val.cfZoneId}/workers/routes`,
        { headers: { 'X-Auth-Email': process.env.CLOUDFLARE_EMAIL, 'X-Auth-Key': process.env.CLOUDFLARE_API_KEY }, timeout: 10000 }
      );
      console.log(JSON.stringify(r.data?.result, null, 2));
    } catch (e) {
      console.log('CF zone route fetch error:', e.message);
    }
  }

  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
