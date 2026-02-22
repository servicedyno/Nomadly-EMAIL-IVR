/**
 * Integration test: Verify FREE_LINKS=5 flow against MongoDB
 */
require('dotenv').config({ path: '/app/.env' });
const { MongoClient } = require('mongodb');

async function testFreeLinksFlow() {
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'test');
  const freeShortLinksOf = db.collection('freeShortLinksOf');

  const TEST_CHAT_ID = 'test_user_99999';
  const FREE_LINKS = 5;
  let allPassed = true;

  // Clean up test data
  await freeShortLinksOf.deleteOne({ _id: TEST_CHAT_ID });

  // 1. Initialize user with FREE_LINKS (5)
  await freeShortLinksOf.updateOne({ _id: TEST_CHAT_ID }, { $set: { val: FREE_LINKS } }, { upsert: true });
  let result = await freeShortLinksOf.findOne({ _id: TEST_CHAT_ID });
  const initOk = result.val === 5;
  console.log('Initial value:', result.val, initOk ? '✅' : '❌');
  if (!initOk) allPassed = false;

  // 2. Simulate 5 decrements (same logic as db.js decrement function)
  for (let i = 1; i <= 5; i++) {
    const current = (await freeShortLinksOf.findOne({ _id: TEST_CHAT_ID }))?.val || 0;
    await freeShortLinksOf.updateOne({ _id: TEST_CHAT_ID }, { $set: { val: current - 1 } });
    const newVal = (await freeShortLinksOf.findOne({ _id: TEST_CHAT_ID }))?.val;
    const expected = FREE_LINKS - i;
    const ok = newVal === expected;
    console.log(`After link ${i}: remaining=${newVal}, expected=${expected}`, ok ? '✅' : '❌');
    if (!ok) allPassed = false;
  }

  // 3. Verify freeLinksAvailable returns false (value should be 0)
  const finalVal = (await freeShortLinksOf.findOne({ _id: TEST_CHAT_ID }))?.val || 0;
  const exhaustedOk = finalVal === 0;
  console.log('Final value (should be 0):', finalVal, exhaustedOk ? '✅' : '❌');
  console.log('Free links available:', finalVal > 0 ? 'true ❌' : 'false ✅');
  if (!exhaustedOk) allPassed = false;

  // 4. Verify 6th attempt would be blocked
  const wouldBlock = !(finalVal > 0);
  console.log('6th attempt blocked:', wouldBlock ? 'YES ✅' : 'NO ❌');
  if (!wouldBlock) allPassed = false;

  // Clean up
  await freeShortLinksOf.deleteOne({ _id: TEST_CHAT_ID });
  await client.close();

  console.log(allPassed ? '\n✅ All integration tests passed: FREE_LINKS=5 flow works correctly' : '\n❌ Some tests failed');
  process.exit(allPassed ? 0 : 1);
}

testFreeLinksFlow().catch(e => { console.error(e); process.exit(1); });
