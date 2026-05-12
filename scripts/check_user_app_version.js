/**
 * Quick lookup of a user's installed Nomadly SMS app version.
 * Usage: node /app/scripts/check_user_app_version.js <chatId>
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');

const env = JSON.parse(fs.readFileSync('/app/memory/railway_prod_env.json', 'utf8'));
const MONGO_URL = env.MONGO_URL;
const DB_NAME = env.DB_NAME || 'test';
const chatId = process.argv[2] || '7080940684';

(async () => {
  const client = new MongoClient(MONGO_URL);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Try a few likely collections
    const collections = ['smsAppLogins', 'usersCol', 'users', 'smsCampaigns'];
    const found = {};
    for (const cn of collections) {
      try {
        const exists = await db.listCollections({ name: cn }).toArray();
        if (exists.length === 0) continue;
        if (cn === 'smsCampaigns') {
          // Get the 5 most recent campaigns for this chatId
          const docs = await db.collection(cn)
            .find({ chatId: String(chatId) })
            .sort({ createdAt: -1 })
            .limit(5)
            .toArray();
          if (docs.length) found[cn + ' (last 5)'] = docs;
          continue;
        }
        const q = [{ chatId: String(chatId) }, { chatId: Number(chatId) }, { 'val.chatId': String(chatId) }, { _id: String(chatId) }];
        for (const filter of q) {
          const doc = await db.collection(cn).findOne(filter);
          if (doc) {
            found[cn] = doc;
            break;
          }
        }
      } catch (e) { /* skip */ }
    }

    if (!Object.keys(found).length) {
      console.log(`No record found for chatId ${chatId}`);
      // List smsAppLogins for context
      const sample = await db.collection('smsAppLogins').find().limit(3).toArray().catch(() => []);
      if (sample.length) {
        console.log('Sample smsAppLogins record shape:');
        const cleaned = { ...sample[0] };
        delete cleaned._id;
        console.log(JSON.stringify(cleaned, null, 2).slice(0, 2000));
      }
      return;
    }

    for (const [cn, val] of Object.entries(found)) {
      console.log(`\n=== ${cn} ===`);
      const arr = Array.isArray(val) ? val : [val];
      for (const doc of arr) {
        const cleaned = { ...doc };
        delete cleaned._id;
        if (cleaned.results) cleaned.results = `[${cleaned.results.length} items]`;
        if (cleaned.contacts) {
          if (Array.isArray(cleaned.contacts)) {
            cleaned.contactsSample = cleaned.contacts.slice(0, 3);
            cleaned.contacts = `[${cleaned.contacts.length} contacts]`;
          }
        }
        console.log(JSON.stringify(cleaned, null, 2).slice(0, 4000));
        console.log('---');
      }
    }
  } finally {
    await client.close();
  }
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
