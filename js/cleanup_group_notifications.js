/**
 * Cleanup Script: Remove group chat entries from balanceNotifyHistory
 * Balance reminders should never be sent to groups
 */

const { MongoClient } = require('mongodb');

(async () => {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   CLEANUP: GROUP CHAT NOTIFICATION ENTRIES');
  console.log('═══════════════════════════════════════════════════════════\n');

  const MONGO_URL = 'mongodb://mongo:RQoOmIdwjRLFvhWMaatjidzqpvawUKcb@caboose.proxy.rlwy.net:59668';
  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db('test');
  const balanceNotifyHistory = db.collection('balanceNotifyHistory');

  // Find all group chat entries (negative chatIds)
  const groupEntries = await balanceNotifyHistory.find({ _id: { $lt: 0 } }).toArray();
  
  console.log(`Found ${groupEntries.length} group chat notification entries\n`);

  if (groupEntries.length === 0) {
    console.log('✅ No group chat entries to clean up!\n');
    await client.close();
    return;
  }

  console.log('Group chats that received balance reminders:');
  groupEntries.forEach(entry => {
    console.log(`  - ChatId: ${entry._id} (Last notified: ${new Date(entry.ts).toISOString()})`);
  });

  console.log('\nRemoving group chat entries...\n');

  const result = await balanceNotifyHistory.deleteMany({ _id: { $lt: 0 } });

  console.log(`✅ Removed ${result.deletedCount} group chat entries`);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   CLEANUP COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');

  await client.close();
})().catch(console.error);
