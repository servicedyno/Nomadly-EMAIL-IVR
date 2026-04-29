// Get most recent phoneLogs to see what's happening on production
const { MongoClient } = require('mongodb');

const RAILWAY_MONGO_URL = 'mongodb://mongo:UCPkknTGVOBzrnOiXoIYyVhampeslSIR@roundhouse.proxy.rlwy.net:52715';

(async () => {
  const client = new MongoClient(RAILWAY_MONGO_URL, { serverSelectionTimeoutMS: 30000 });
  try {
    await client.connect();
    const db = client.db('test');
    const coll = db.collection('phoneLogs');
    const recent = await coll.find({}).sort({ timestamp: -1 }).limit(20).toArray();
    console.log('Most recent phoneLogs:');
    for (const r of recent) {
      const ts = r.timestamp ? new Date(r.timestamp).toISOString() : (r.created ? new Date(r.created).toISOString() : '—');
      console.log(`  [${ts}] type=${r.type} chatId=${r.chatId} from=${r.from} to=${r.to} dur=${r.duration}s`);
    }
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    await client.close();
  }
})();
