/**
 * Database Cleanup Script
 * Removes empty/test collections to reduce database clutter
 */

const { MongoClient } = require('mongodb');

(async () => {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   DATABASE CLEANUP - REMOVING EMPTY COLLECTIONS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const MONGO_URL = 'mongodb://mongo:RQoOmIdwjRLFvhWMaatjidzqpvawUKcb@caboose.proxy.rlwy.net:59668';
  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db('test');

  // Collections to remove (empty or test collections)
  const collectionsToRemove = [
    'testCredentials',
    'testOtps',
    'emailCampaigns',
    'systemAlerts',
    'webhookLogs',
    'idempotencyKeys',
    'sshKeysOf',
    'emailSuppressions',
    'honeypotTriggers',
    'processedWebhooks',
    'systemMetrics'
  ];

  let removed = 0;
  let notFound = 0;
  let errors = 0;

  for (const collName of collectionsToRemove) {
    try {
      const coll = db.collection(collName);
      const count = await coll.countDocuments();
      
      if (count === 0) {
        await coll.drop();
        console.log(`✅ Removed: ${collName} (was empty)`);
        removed++;
      } else {
        console.log(`⏭️  Skipped: ${collName} (has ${count} documents - not empty)`);
      }
    } catch (error) {
      if (error.message.includes('ns not found')) {
        console.log(`⏭️  ${collName} - Collection doesn't exist`);
        notFound++;
      } else {
        console.error(`❌ Error removing ${collName}: ${error.message}`);
        errors++;
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`   CLEANUP SUMMARY`);
  console.log(`   Removed: ${removed}`);
  console.log(`   Not Found: ${notFound}`);
  console.log(`   Skipped (not empty): ${collectionsToRemove.length - removed - notFound - errors}`);
  console.log(`   Errors: ${errors}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  await client.close();
})().catch(console.error);
