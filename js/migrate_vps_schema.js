/**
 * VPS Schema Migration Script
 * Adds missing RDP management fields to old VPS records
 */

const { MongoClient } = require('mongodb');

(async () => {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   VPS SCHEMA MIGRATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  const MONGO_URL = 'mongodb://mongo:RQoOmIdwjRLFvhWMaatjidzqpvawUKcb@caboose.proxy.rlwy.net:59668';
  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db('test');
  const vpsPlansOf = db.collection('vpsPlansOf');

  // Find records missing RDP fields
  const oldRecords = await vpsPlansOf.find({
    $or: [
      { isRDP: { $exists: false } },
      { osType: { $exists: false } }
    ]
  }).toArray();

  console.log(`Found ${oldRecords.length} records needing migration\n`);

  if (oldRecords.length === 0) {
    console.log('✅ All records already migrated!\n');
    await client.close();
    return;
  }

  let updated = 0;
  let errors = 0;

  for (const record of oldRecords) {
    try {
      const updateFields = {};

      // Set default values for missing fields
      if (!record.isRDP) {
        updateFields.isRDP = false; // Default to Linux VPS
      }

      if (!record.osType) {
        updateFields.osType = 'Linux'; // Default OS type
      }

      // Don't add rootPasswordSecretId for Linux VPS
      // Only Windows RDP instances need it

      await vpsPlansOf.updateOne(
        { _id: record._id },
        { $set: updateFields }
      );

      console.log(`✅ Updated record ${record._id} (${record.name || record.label})`);
      console.log(`   Added: ${Object.keys(updateFields).join(', ')}`);
      updated++;

    } catch (error) {
      console.error(`❌ Failed to update ${record._id}:`, error.message);
      errors++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`   MIGRATION COMPLETE`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Errors: ${errors}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  await client.close();
})().catch(console.error);
