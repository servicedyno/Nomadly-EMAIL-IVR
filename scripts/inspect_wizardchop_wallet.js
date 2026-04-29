// Check wallet balance and recent call logs for @wizardchop (1167900472)
const { MongoClient } = require('mongodb');

const RAILWAY_MONGO_URL = 'mongodb://mongo:UCPkknTGVOBzrnOiXoIYyVhampeslSIR@roundhouse.proxy.rlwy.net:52715';

(async () => {
  const client = new MongoClient(RAILWAY_MONGO_URL, { serverSelectionTimeoutMS: 30000 });
  try {
    await client.connect();
    const db = client.db('test');
    const chatId = '1167900472';

    // Wallet
    const walletColl = db.collection('walletOf');
    const wallet = await walletColl.findOne({ _id: chatId });
    console.log('Wallet for', chatId, ':', wallet ? JSON.stringify(wallet.val || wallet) : 'NOT FOUND');

    // Recent call logs (any direction)
    const phoneLogs = db.collection('phoneLogs');
    const callLogs = await phoneLogs.find({ chatId }).sort({ timestamp: -1 }).limit(20).toArray();
    console.log(`\n=== Recent phoneLogs for chatId=${chatId} (${callLogs.length}) ===`);
    for (const lg of callLogs) {
      const ts = lg.timestamp ? new Date(lg.timestamp).toISOString() : (lg.created ? new Date(lg.created).toISOString() : '—');
      console.log(`  [${ts}] type=${lg.type} from=${lg.from} to=${lg.to} dur=${lg.duration}s phase=${lg.phase}`);
    }

    // Brute scan logs by number containing 5162719167
    const otherLogs = await phoneLogs.find({
      $or: [
        { to: { $regex: '5162719167' } },
        { from: { $regex: '5162719167' } },
      ]
    }).sort({ timestamp: -1 }).limit(20).toArray();
    console.log(`\n=== Logs by number 5162719167 (${otherLogs.length}) ===`);
    for (const lg of otherLogs) {
      const ts = lg.timestamp ? new Date(lg.timestamp).toISOString() : '—';
      console.log(`  [${ts}] type=${lg.type} from=${lg.from} to=${lg.to} dur=${lg.duration}s phase=${lg.phase}`);
    }
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    await client.close();
  }
})();
