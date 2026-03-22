const { MongoClient } = require('mongodb');

async function checkSpecificUser() {
  console.log('🔍 Checking Specific User Data...\n');
  
  const mongoUrl = 'mongodb://mongo:RQoOmIdwjRLFvhWMaatjidzqpvawUKcb@caboose.proxy.rlwy.net:59668';
  const dbName = 'test';
  const collectionName = 'phoneNumbersOf';
  
  let client;
  try {
    client = new MongoClient(mongoUrl);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    
    // Find the specific user
    const userData = await collection.findOne({ _id: 6604316166 });
    
    if (userData) {
      console.log(`✅ Found user 6604316166`);
      console.log(`User data structure:`);
      console.log(JSON.stringify(userData, null, 2));
    } else {
      console.log(`❌ User 6604316166 not found`);
    }
    
  } catch (error) {
    console.log('❌ Database operation failed:', error.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run the check
checkSpecificUser().catch(console.error);