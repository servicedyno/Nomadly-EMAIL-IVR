// Deep inspection of @wizardchop's phone number config
const { MongoClient } = require('mongodb');

const RAILWAY_MONGO_URL = 'mongodb://mongo:UCPkknTGVOBzrnOiXoIYyVhampeslSIR@roundhouse.proxy.rlwy.net:52715';

(async () => {
  const client = new MongoClient(RAILWAY_MONGO_URL, { serverSelectionTimeoutMS: 30000 });
  try {
    await client.connect();
    const db = client.db('test');
    const phoneColl = db.collection('phoneNumbersOf');
    const stateColl = db.collection('state');

    const chatId = '1167900472';
    const userDoc = await phoneColl.findOne({ _id: chatId });
    if (!userDoc) {
      console.log('No phone doc for', chatId);
      return;
    }

    console.log('=== User-level fields ===');
    const userVal = userDoc.val || {};
    const topKeys = Object.keys(userVal).filter(k => k !== 'numbers');
    for (const k of topKeys) {
      const v = userVal[k];
      const len = typeof v === 'string' ? v.length : (Array.isArray(v) ? v.length : null);
      console.log(`  ${k}:`, typeof v === 'object' ? JSON.stringify(v).slice(0, 200) : v);
    }

    console.log('\n=== Numbers ===');
    for (const n of (userVal.numbers || [])) {
      console.log(`\n— phoneNumber: ${n.phoneNumber}`);
      const keys = Object.keys(n);
      for (const k of keys) {
        const v = n[k];
        if (typeof v === 'object' && v !== null) {
          console.log(`  ${k}:`, JSON.stringify(v).slice(0, 300));
        } else {
          console.log(`  ${k}:`, v);
        }
      }
    }

    // Also check state doc for username
    const state = await stateColl.findOne({ _id: chatId });
    console.log('\n=== State doc ===');
    if (state) {
      console.log('  _id:', state._id);
      console.log('  username:', state.username);
      console.log('  firstName:', state.firstName);
      console.log('  userLanguage:', state.userLanguage);
    }

    // Check phoneLogs for recent entries on this number
    const logsColl = db.collection('phoneLogs');
    const recentLogs = await logsColl.find({ to: { $regex: '5162719167' } }).sort({ timestamp: -1 }).limit(20).toArray();
    console.log(`\n=== Recent phoneLogs (${recentLogs.length}) ===`);
    for (const lg of recentLogs) {
      const ts = lg.timestamp ? new Date(lg.timestamp).toISOString() : '—';
      console.log(`  [${ts}] type=${lg.type} from=${lg.from} to=${lg.to} dur=${lg.duration}s rec=${!!lg.recordingUrl}`);
    }
  } catch (e) {
    console.error('ERR', e.message, e.stack);
  } finally {
    await client.close();
  }
})();
