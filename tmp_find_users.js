// Find user chatIds by Telegram username in prod DB
require('dotenv').config({ path: '/app/backend/.env' });
const { MongoClient } = require('mongodb');

async function findUsers() {
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'test');

  const usernames = ['HHR2009', 'FreemanHuey0', 'hhr2009', 'freemanhuey0'];

  for (const uname of usernames) {
    console.log(`\n=== Looking for @${uname} ===`);
    // Users store their username in nameOf collection (val = username)
    const rec = await db.collection('nameOf').findOne({ val: uname });
    if (rec) {
      console.log('  nameOf →', JSON.stringify(rec));
    } else {
      // Try case-insensitive
      const ci = await db.collection('nameOf').findOne({
        val: { $regex: `^${uname}$`, $options: 'i' }
      });
      if (ci) {
        console.log('  nameOf (CI) →', JSON.stringify(ci));
      } else {
        console.log('  Not found in nameOf');
      }
    }
  }

  await client.close();
}

findUsers().catch(e => { console.error(e); process.exit(1); });
