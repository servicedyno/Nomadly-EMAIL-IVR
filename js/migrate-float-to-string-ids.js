/* global process */
/**
 * Migration Script: Convert Float/Numeric IDs to String IDs
 * Fixes wallet ID type inconsistency issues
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') })
const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'test'

async function migrateIds() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')
    
    const db = client.db(DB_NAME)
    
    // Collections to migrate
    const collections = ['nameOf', 'walletOf', 'chatIdOf']
    
    for (const collName of collections) {
      const coll = db.collection(collName)
      
      console.log(`\n🔧 Migrating ${collName}...`)
      
      // Find all documents with non-string _id
      const docs = await coll.find({}).toArray()
      let migrated = 0
      let skipped = 0
      
      for (const doc of docs) {
        const oldId = doc._id
        const idType = typeof oldId
        
        // Skip if already string
        if (idType === 'string') {
          skipped++
          continue
        }
        
        // Convert to string
        const newId = String(oldId)
        
        // Check if string version already exists
        const existing = await coll.findOne({ _id: newId })
        
        if (existing) {
          console.log(`  ⚠️  String ID already exists for ${oldId}, merging...`)
          
          // For walletOf, merge balances
          if (collName === 'walletOf') {
            const mergedDoc = {
              _id: newId,
              usdIn: (existing.usdIn || 0) + (doc.usdIn || 0),
              usdOut: (existing.usdOut || 0) + (doc.usdOut || 0),
              ngnIn: (existing.ngnIn || 0) + (doc.ngnIn || 0),
              ngnOut: (existing.ngnOut || 0) + (doc.ngnOut || 0),
            }
            await coll.replaceOne({ _id: newId }, mergedDoc)
            console.log(`     Merged wallet: USD ${mergedDoc.usdIn - mergedDoc.usdOut}`)
          }
          
          // Delete the old numeric ID document
          await coll.deleteOne({ _id: oldId })
          migrated++
        } else {
          // No conflict, just update the _id
          const newDoc = { ...doc, _id: newId }
          await coll.deleteOne({ _id: oldId })
          await coll.insertOne(newDoc)
          migrated++
        }
        
        console.log(`  ✅ ${oldId} (${idType}) → "${newId}" (string)`)
      }
      
      console.log(`  📊 ${collName}: ${migrated} migrated, ${skipped} skipped`)
    }
    
    console.log('\n🎉 Migration complete!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
  } finally {
    await client.close()
  }
}

// Run migration
migrateIds()
