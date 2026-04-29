// List all collections in the test DB and search for call-log-related ones
const { MongoClient } = require('mongodb');

const RAILWAY_MONGO_URL = 'mongodb://mongo:UCPkknTGVOBzrnOiXoIYyVhampeslSIR@roundhouse.proxy.rlwy.net:52715';

(async () => {
  const client = new MongoClient(RAILWAY_MONGO_URL, { serverSelectionTimeoutMS: 30000 });
  try {
    await client.connect();
    const db = client.db('test');
    const colls = await db.listCollections().toArray();
    console.log('=== Collections in DB "test" ===');
    for (const c of colls.slice().sort((a, b) => a.name.localeCompare(b.name))) {
      const count = await db.collection(c.name).estimatedDocumentCount();
      console.log(`  ${c.name} (${count})`);
    }
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    await client.close();
  }
})();
