const { MongoClient } = require('mongodb');

async function exploreSipCredentials() {
  console.log('🔍 Exploring SIP Credentials in Database...\n');
  
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
    
    // Get total count
    const totalCount = await collection.countDocuments();
    console.log(`📊 Total users in collection: ${totalCount}`);
    
    // Find users with SIP credentials
    const usersWithSip = await collection.find({
      'numbers.sipUsername': { $exists: true }
    }).toArray();
    
    console.log(`📊 Users with SIP credentials: ${usersWithSip.length}`);
    
    if (usersWithSip.length > 0) {
      console.log('\n🔍 Users with SIP credentials:');
      for (const user of usersWithSip) {
        console.log(`\nUser ID: ${user._id}`);
        if (user.numbers) {
          for (const num of user.numbers) {
            if (num.sipUsername) {
              console.log(`  Phone: ${num.phoneNumber || 'N/A'}`);
              console.log(`  sipUsername: ${num.sipUsername}`);
              console.log(`  telnyxSipUsername: ${num.telnyxSipUsername || 'N/A'}`);
              console.log(`  sipPassword: ${num.sipPassword ? '[PRESENT]' : '[MISSING]'}`);
              console.log(`  telnyxSipPassword: ${num.telnyxSipPassword ? '[PRESENT]' : '[MISSING]'}`);
              console.log(`  ---`);
            }
          }
        }
      }
    }
    
    // Also check for users with telnyxSipUsername specifically
    const usersWithTelnyx = await collection.find({
      'numbers.telnyxSipUsername': { $exists: true }
    }).toArray();
    
    console.log(`\n📊 Users with Telnyx SIP credentials: ${usersWithTelnyx.length}`);
    
    if (usersWithTelnyx.length > 0) {
      console.log('\n🔍 Users with Telnyx SIP credentials:');
      for (const user of usersWithTelnyx) {
        console.log(`\nUser ID: ${user._id}`);
        if (user.numbers) {
          for (const num of user.numbers) {
            if (num.telnyxSipUsername) {
              console.log(`  Phone: ${num.phoneNumber || 'N/A'}`);
              console.log(`  sipUsername: ${num.sipUsername || 'N/A'}`);
              console.log(`  telnyxSipUsername: ${num.telnyxSipUsername}`);
              console.log(`  sipPassword: ${num.sipPassword ? '[PRESENT]' : '[MISSING]'}`);
              console.log(`  telnyxSipPassword: ${num.telnyxSipPassword ? '[PRESENT]' : '[MISSING]'}`);
              console.log(`  ---`);
            }
          }
        }
      }
    }
    
    // Check if the specific user exists with different ID format
    const specificUser1 = await collection.findOne({ _id: 6604316166 }); // numeric
    const specificUser2 = await collection.findOne({ _id: "6604316166" }); // string
    
    if (specificUser1) {
      console.log(`\n✅ Found user with numeric ID: 6604316166`);
    } else if (specificUser2) {
      console.log(`\n✅ Found user with string ID: "6604316166"`);
    } else {
      console.log(`\n❌ User 6604316166 not found in either format`);
    }
    
  } catch (error) {
    console.log('❌ Database operation failed:', error.message);
    return false;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run the exploration
exploreSipCredentials().catch(console.error);