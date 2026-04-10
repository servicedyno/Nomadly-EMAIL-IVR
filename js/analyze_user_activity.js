const { MongoClient } = require('mongodb');

(async () => {
  const MONGO_URL = 'mongodb://mongo:RQoOmIdwjRLFvhWMaatjidzqpvawUKcb@caboose.proxy.rlwy.net:59668';
  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db('test');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   RAILWAY LOGS & USER ACTIVITY ANALYSIS REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Find user @davion419
  const users = await db.collection('users').find({ username: 'davion419' }).toArray();
  if (users.length > 0) {
    console.log('🔍 USER: @davion419 Details');
    console.log('─────────────────────────────────────');
    users.forEach(u => {
      console.log(`ChatId: ${u.chatId}`);
      console.log(`Wallet USD: $${u.walletUSD || 0}`);
      console.log(`Wallet NGN: ₦${u.walletNGN || 0}`);
      console.log(`Created: ${u.createdAt || 'N/A'}`);
    });
    console.log();
  } else {
    console.log('⚠️  User @davion419 not found in database\n');
  }

  // Check for small amount purchases (< 1000 leads)
  console.log('📊 SMALL LEAD PURCHASES (< 1000 leads)');
  console.log('─────────────────────────────────────');
  const smallLeadPayments = await db.collection('payments')
    .find({ 
      amount: { $lt: 1000, $gt: 0 },
      $or: [
        { type: 'leads' },
        { type: 'validator' },
        { label: { $regex: /lead|validat/i } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();

  if (smallLeadPayments.length > 0) {
    smallLeadPayments.forEach((p, i) => {
      console.log(`\n${i + 1}. Amount: ${p.amount} leads`);
      console.log(`   Price: $${p.price || 'N/A'}`);
      console.log(`   Type: ${p.type || p.label || 'N/A'}`);
      console.log(`   ChatId: ${p.chatId}`);
      console.log(`   Payment Method: ${p.paymentMethod || 'N/A'}`);
      console.log(`   Status: ${p.status || 'N/A'}`);
      console.log(`   Created: ${p.createdAt || 'N/A'}`);
    });
  } else {
    console.log('No small lead purchases found');
  }
  console.log();

  // Check VPS orders for @davion419
  console.log('🖥️  VPS/RDP ORDERS');
  console.log('─────────────────────────────────────');
  const vpsOrders = await db.collection('vpsPlans')
    .find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  if (vpsOrders.length > 0) {
    vpsOrders.forEach((v, i) => {
      console.log(`\n${i + 1}. ChatId: ${v.chatId}`);
      console.log(`   Plan: ${v.planName || v.productName || 'N/A'}`);
      console.log(`   Status: ${v.status || 'N/A'}`);
      console.log(`   Instance ID: ${v.contaboInstanceId || 'N/A'}`);
      console.log(`   Created: ${v.createdAt || 'N/A'}`);
    });
  } else {
    console.log('No VPS orders found');
  }
  console.log();

  // Recent system-wide errors or anomalies
  console.log('⚠️  RECENT PAYMENT ANOMALIES');
  console.log('─────────────────────────────────────');
  const failedPayments = await db.collection('payments')
    .find({ 
      $or: [
        { status: 'failed' },
        { status: 'error' },
        { error: { $exists: true } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  if (failedPayments.length > 0) {
    failedPayments.forEach((p, i) => {
      console.log(`\n${i + 1}. Type: ${p.type || p.label || 'N/A'}`);
      console.log(`   Amount: ${p.amount || 'N/A'}`);
      console.log(`   Status: ${p.status || 'N/A'}`);
      console.log(`   Error: ${p.error || 'N/A'}`);
      console.log(`   ChatId: ${p.chatId}`);
      console.log(`   Created: ${p.createdAt || 'N/A'}`);
    });
  } else {
    console.log('No failed payments found');
  }
  console.log();

  // Check for any bypass patterns
  console.log('🔐 MINIMUM PURCHASE LIMIT BYPASS ANALYSIS');
  console.log('─────────────────────────────────────');
  const bypassCount = await db.collection('payments').countDocuments({
    amount: { $lt: 1000, $gt: 0 }
  });
  console.log(`Total purchases with < 1000 leads: ${bypassCount}`);
  
  const recentSmall = await db.collection('payments')
    .find({ amount: { $lt: 1000, $gt: 0 } })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  
  if (recentSmall.length > 0) {
    console.log('\nMost Recent Small Purchases:');
    recentSmall.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.amount} leads @ $${p.price} - ChatId: ${p.chatId} - ${p.createdAt || 'N/A'}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   END OF REPORT');
  console.log('═══════════════════════════════════════════════════════════════');

  await client.close();
})().catch(console.error);
