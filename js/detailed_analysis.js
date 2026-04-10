const { MongoClient } = require('mongodb');

(async () => {
  const MONGO_URL = 'mongodb://mongo:RQoOmIdwjRLFvhWMaatjidzqpvawUKcb@caboose.proxy.rlwy.net:59668';
  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db('test');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   DETAILED RAILWAY LOGS & ANOMALY ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Find all users with "davion" in username
  console.log('🔍 SEARCHING FOR USER @davion419...');
  console.log('─────────────────────────────────────');
  const davionUsers = await db.collection('users').find({ 
    $or: [
      { username: /davion/i },
      { chatId: 6687923716 } // From code, this user has special treatment
    ]
  }).toArray();
  
  if (davionUsers.length > 0) {
    davionUsers.forEach(u => {
      console.log(`✓ Found User:`);
      console.log(`  Username: ${u.username || 'N/A'}`);
      console.log(`  ChatId: ${u.chatId}`);
      console.log(`  Wallet USD: $${u.walletUSD || 0}`);
      console.log(`  Created: ${u.createdAt || 'N/A'}\n`);
    });
  } else {
    console.log('⚠️  No users matching "davion" found\n');
  }

  // 2. VPS/RDP orders (check for @davion419 or recent failures)
  console.log('🖥️  VPS/RDP ORDER HISTORY');
  console.log('─────────────────────────────────────');
  const allVpsOrders = await db.collection('vpsPlans').find({}).sort({ createdAt: -1 }).toArray();
  
  if (allVpsOrders.length > 0) {
    console.log(`Total VPS orders: ${allVpsOrders.length}\n`);
    allVpsOrders.slice(0, 15).forEach((v, i) => {
      console.log(`${i + 1}. ChatId: ${v.chatId} | Plan: ${v.planName || v.productName || 'N/A'}`);
      console.log(`   Status: ${v.status || 'N/A'} | Instance: ${v.contaboInstanceId || 'pending'}`);
      console.log(`   IP: ${v.ip || 'N/A'} | Created: ${v.createdAt || 'N/A'}\n`);
    });
  } else {
    console.log('No VPS orders in database\n');
  }

  // 3. Small purchase analysis (the bypass issue)
  console.log('📊 LEAD PURCHASE BYPASS ANALYSIS (< 1000 minimum)');
  console.log('─────────────────────────────────────');
  const allPayments = await db.collection('payments').find({}).sort({ createdAt: -1 }).toArray();
  const smallPurchases = allPayments.filter(p => p.amount && p.amount < 1000 && p.amount > 0);
  
  console.log(`Total payments in DB: ${allPayments.length}`);
  console.log(`Payments with < 1000 amount: ${smallPurchases.length}\n`);
  
  if (smallPurchases.length > 0) {
    console.log('Details of small purchases:');
    smallPurchases.forEach((p, i) => {
      console.log(`\n${i + 1}. Amount: ${p.amount} leads`);
      console.log(`   Price: $${p.price || 'undefined'}`);
      console.log(`   Type/Label: ${p.type || p.label || 'N/A'}`);
      console.log(`   ChatId: ${p.chatId}`);
      console.log(`   Payment Method: ${p.paymentMethod || p.coin || 'N/A'}`);
      console.log(`   Status: ${p.status || 'N/A'}`);
      console.log(`   Created: ${p.createdAt || 'N/A'}`);
    });
  }
  console.log();

  // 4. Recent system events and bot activities
  console.log('📝 RECENT BOT ACTIVITIES (Last 20 payments)');
  console.log('─────────────────────────────────────');
  const recentPayments = allPayments.slice(0, 20);
  recentPayments.forEach((p, i) => {
    console.log(`${i + 1}. ${p.type || p.label || 'unknown'} - Amount: ${p.amount || 'N/A'} - Price: $${p.price || 'N/A'} - ChatId: ${p.chatId} - ${p.createdAt || 'N/A'}`);
  });
  console.log();

  // 5. Error patterns
  console.log('⚠️  SYSTEM ANOMALIES & ERRORS');
  console.log('─────────────────────────────────────');
  const errors = await db.collection('payments').find({
    $or: [
      { status: 'failed' },
      { status: 'error' },
      { error: { $exists: true, $ne: null } }
    ]
  }).sort({ createdAt: -1 }).limit(15).toArray();
  
  if (errors.length > 0) {
    errors.forEach((e, i) => {
      console.log(`${i + 1}. ${e.type || e.label || 'N/A'} - Error: ${e.error || e.status}`);
      console.log(`   ChatId: ${e.chatId} - Created: ${e.createdAt || 'N/A'}\n`);
    });
  } else {
    console.log('✓ No recent errors found in payments\n');
  }

  // 6. Statistical summary
  console.log('📈 STATISTICAL SUMMARY');
  console.log('─────────────────────────────────────');
  const totalUsers = await db.collection('users').countDocuments();
  const totalDomains = await db.collection('domains').countDocuments();
  const totalVps = await db.collection('vpsPlans').countDocuments();
  const totalPayments = await db.collection('payments').countDocuments();
  
  console.log(`Total Users: ${totalUsers}`);
  console.log(`Total Domains: ${totalDomains}`);
  console.log(`Total VPS Orders: ${totalVps}`);
  console.log(`Total Payments: ${totalPayments}`);
  console.log(`Small Lead Purchases (< 1000): ${smallPurchases.length} ⚠️\n`);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   ANALYSIS COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  await client.close();
})().catch(console.error);
