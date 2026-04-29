// Inspect phoneNumbersOf for +15162719167 (used by @wizardchop)
const { MongoClient } = require('mongodb');

const RAILWAY_MONGO_URL = 'mongodb://mongo:UCPkknTGVOBzrnOiXoIYyVhampeslSIR@roundhouse.proxy.rlwy.net:52715';

(async () => {
  const client = new MongoClient(RAILWAY_MONGO_URL, { serverSelectionTimeoutMS: 30000 });
  try {
    await client.connect();
    const db = client.db('test');
    const coll = db.collection('phoneNumbersOf');
    const target = '+15162719167';
    const cleanTarget = target.replace(/[^+\d]/g, '');

    console.log('Looking for', cleanTarget);

    // Try multiple lookups
    const r1 = await coll.findOne({ 'val.numbers.phoneNumber': cleanTarget });
    console.log('\nMatch by val.numbers.phoneNumber (exact +15162719167):', r1 ? `FOUND chatId=${r1._id}` : 'NOT FOUND');

    const r2 = await coll.findOne({ 'val.numbers.phoneNumber': '15162719167' });
    console.log('Match by phoneNumber (no +):', r2 ? `FOUND chatId=${r2._id}` : 'NOT FOUND');

    const r3 = await coll.findOne({ 'val.numbers.phoneNumber': { $regex: '5162719167' } });
    console.log('Match by regex 5162719167:', r3 ? `FOUND chatId=${r3._id}` : 'NOT FOUND');

    if (r3) {
      const num = (r3.val?.numbers || []).find(n => (n.phoneNumber || '').includes('5162719167'));
      console.log('  Stored phoneNumber raw:', JSON.stringify(num?.phoneNumber));
      console.log('  Status:', num?.status);
      console.log('  Plan:', num?.plan);
      console.log('  forwardTo:', num?.forwardTo, 'forwardingMode:', num?.forwardingMode);
      console.log('  ivrEnabled:', num?.ivrEnabled);
      console.log('  ivrTree (truncated):', num?.ivrTree ? Object.keys(num.ivrTree) : null);
    }

    // Also do a brute scan to see what raw formats exist
    console.log('\n=== Brute scan: all numbers containing 5162719167 ===');
    const all = await coll.find({}).toArray();
    let totalDocs = all.length;
    let matched = 0;
    for (const u of all) {
      const numbers = u.val?.numbers || [];
      for (const n of numbers) {
        if ((n.phoneNumber || '').replace(/[^+\d]/g, '').includes('5162719167')) {
          matched++;
          console.log(`  ${u._id} | phoneNumber=${JSON.stringify(n.phoneNumber)} | status=${n.status} | plan=${n.plan}`);
        }
      }
    }
    console.log(`Scanned ${totalDocs} docs. Matched ${matched}.`);

    // Also check @wizardchop username if there is a state collection mapping
    const stateColl = db.collection('state');
    const wiz = await stateColl.findOne({ username: 'wizardchop' });
    if (wiz) {
      console.log('\n@wizardchop chatId:', wiz._id);
      const wizPhones = await coll.findOne({ _id: wiz._id });
      if (wizPhones) {
        console.log('Phones for wizardchop:');
        for (const n of wizPhones.val?.numbers || []) {
          console.log(`  - phoneNumber=${JSON.stringify(n.phoneNumber)} status=${n.status} plan=${n.plan} forwardTo=${n.forwardTo} forwardingMode=${n.forwardingMode}`);
        }
      } else {
        console.log('No phoneNumbers doc for', wiz._id);
      }
    } else {
      console.log('\nNo state doc found for username=wizardchop (case sensitive)');
      const wizCi = await stateColl.findOne({ username: { $regex: '^wizardchop$', $options: 'i' } });
      if (wizCi) console.log('Case-insensitive match:', wizCi._id, 'username=', wizCi.username);
    }
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    await client.close();
  }
})();
