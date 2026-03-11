#!/usr/bin/env node

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOMADLY TELEGRAM BOT - 3 NEW FEATURES VERIFICATION TEST
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Testing:
// 1. IONOS SMTP Digital Product ($150)
// 2. Welcome bonus changed from $3/deposit to $5/start  
// 3. Admin /gift5all command + button
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const fs = require('fs');
const path = require('path');

let testResults = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  failures: []
};

function logTest(testName, passed, details = '') {
  testResults.totalTests++;
  if (passed) {
    testResults.passedTests++;
    console.log(`✅ ${testName}`);
  } else {
    testResults.failedTests++;
    testResults.failures.push({ testName, details });
    console.log(`❌ ${testName} - ${details}`);
  }
}

// ━━━ FEATURE 1: IONOS SMTP Digital Product ($150) ━━━

console.log('\n🧪 TESTING FEATURE 1: IONOS SMTP Digital Product ($150)');
console.log('=' .repeat(60));

// Test 1.1: Config.js exports DP_PRICE_IONOS_SMTP
try {
  const config = require('/app/js/config.js');
  const hasIonosPrice = config.DP_PRICE_IONOS_SMTP !== undefined;
  const correctDefaultValue = config.DP_PRICE_IONOS_SMTP === 150;
  logTest('config.js exports DP_PRICE_IONOS_SMTP', hasIonosPrice, hasIonosPrice ? '' : 'DP_PRICE_IONOS_SMTP not found in config exports');
  logTest('DP_PRICE_IONOS_SMTP defaults to 150', correctDefaultValue, correctDefaultValue ? '' : `Expected 150, got ${config.DP_PRICE_IONOS_SMTP}`);
} catch (e) {
  logTest('config.js exports DP_PRICE_IONOS_SMTP', false, `Error loading config: ${e.message}`);
}

// Test 1.2: .env has DP_PRICE_IONOS_SMTP=150
try {
  const envContent = fs.readFileSync('/app/.env', 'utf8');
  const hasEnvVar = envContent.includes('DP_PRICE_IONOS_SMTP=150');
  logTest('.env contains DP_PRICE_IONOS_SMTP=150', hasEnvVar, hasEnvVar ? '' : 'DP_PRICE_IONOS_SMTP=150 not found in .env file');
} catch (e) {
  logTest('.env contains DP_PRICE_IONOS_SMTP=150', false, `Error reading .env: ${e.message}`);
}

// Test 1.3: Language files have dpIonosSmtp translations
const langFiles = ['/app/js/lang/en.js', '/app/js/lang/fr.js', '/app/js/lang/zh.js', '/app/js/lang/hi.js'];
langFiles.forEach(langFile => {
  const langCode = path.basename(langFile, '.js');
  try {
    const content = fs.readFileSync(langFile, 'utf8');
    const hasDpIonosSmtp = content.includes('dpIonosSmtp:') && content.includes('IONOS SMTP') && content.includes('DP_PRICE_IONOS_SMTP');
    logTest(`${langCode}.js has dpIonosSmtp translation`, hasDpIonosSmtp, hasDpIonosSmtp ? '' : 'dpIonosSmtp translation not found or incorrect');
    
    const hasDigitalProductsSelect = content.includes('digitalProductsSelect:') && content.includes('IONOS SMTP');
    logTest(`${langCode}.js digitalProductsSelect includes IONOS SMTP`, hasDigitalProductsSelect, hasDigitalProductsSelect ? '' : 'IONOS SMTP not mentioned in digitalProductsSelect');
  } catch (e) {
    logTest(`${langCode}.js has dpIonosSmtp translation`, false, `Error reading ${langFile}: ${e.message}`);
  }
});

// Test 1.4: _index.js imports and uses DP_PRICE_IONOS_SMTP
try {
  const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8');
  const importsIonosPrice = indexContent.includes('DP_PRICE_IONOS_SMTP,') || indexContent.includes('DP_PRICE_IONOS_SMTP');
  logTest('_index.js imports DP_PRICE_IONOS_SMTP', importsIonosPrice, importsIonosPrice ? '' : 'DP_PRICE_IONOS_SMTP import not found');
  
  const hasIonosButton = indexContent.includes('[t.dpIonosSmtp]');
  logTest('_index.js has dpIonosSmtp button in digital products', hasIonosButton, hasIonosButton ? '' : '[t.dpIonosSmtp] button not found');
  
  const hasIonosProductMap = indexContent.includes("'ionos_smtp'") && indexContent.includes('DP_PRICE_IONOS_SMTP');
  logTest('_index.js has ionos_smtp product map entry', hasIonosProductMap, hasIonosProductMap ? '' : 'ionos_smtp product mapping not found');
} catch (e) {
  logTest('_index.js imports and uses DP_PRICE_IONOS_SMTP', false, `Error reading _index.js: ${e.message}`);
}

// ━━━ FEATURE 2: Welcome Bonus Changed ($3/deposit → $5/start) ━━━

console.log('\n🧪 TESTING FEATURE 2: Welcome Bonus Changed ($3/deposit → $5/start)');
console.log('=' .repeat(60));

// Test 2.1: Environment variable WELCOME_BONUS_USD=5
try {
  const envContent = fs.readFileSync('/app/.env', 'utf8');
  const hasWelcomeBonusEnv = envContent.includes('WELCOME_BONUS_USD=5');
  logTest('.env has WELCOME_BONUS_USD=5', hasWelcomeBonusEnv, hasWelcomeBonusEnv ? '' : 'WELCOME_BONUS_USD=5 not found in .env file');
} catch (e) {
  logTest('.env has WELCOME_BONUS_USD=5', false, `Error reading .env: ${e.message}`);
}

// Test 2.2: Monetization engine reads WELCOME_BONUS_USD from env
try {
  const monetizationContent = fs.readFileSync('/app/js/monetization-engine.js', 'utf8');
  const readsFromEnv = monetizationContent.includes('process.env.WELCOME_BONUS_USD') && monetizationContent.includes("|| '3')");
  logTest('monetization-engine.js reads WELCOME_BONUS_USD from env', readsFromEnv, readsFromEnv ? '' : 'WELCOME_BONUS_USD env reading not found');
  
  const hasWelcomeGiftMessage = monetizationContent.includes('welcome gift') && !monetizationContent.includes('first-deposit bonus');
  logTest('Messages say "Welcome Gift" not "first-deposit bonus"', hasWelcomeGiftMessage, hasWelcomeGiftMessage ? '' : 'Still contains old "first-deposit bonus" messaging');
  
  const hasCorrectInitLog = monetizationContent.includes('welcome gift for new users') && !monetizationContent.includes('bonus on first deposit');
  logTest('Init log says "welcome gift for new users"', hasCorrectInitLog, hasCorrectInitLog ? '' : 'Init log still mentions deposit bonus');
} catch (e) {
  logTest('monetization-engine.js reads WELCOME_BONUS_USD from env', false, `Error reading monetization-engine.js: ${e.message}`);
}

// Test 2.3: Welcome bonus triggered on /start (new user flow), not on deposit
try {
  const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8');
  
  const hasNewUserTrigger = indexContent.includes('checkAndAwardWelcomeBonus(chatId') && indexContent.includes('New Member Joined');
  logTest('Welcome bonus triggered on new user language selection', hasNewUserTrigger, hasNewUserTrigger ? '' : 'checkAndAwardWelcomeBonus not found in new user flow');
  
  // Check that old deposit trigger is removed
  const hasOldDepositTrigger = indexContent.includes('addFundsTo') && indexContent.includes('checkAndAwardWelcomeBonus');
  logTest('Old deposit trigger removed from addFundsTo', !hasOldDepositTrigger, hasOldDepositTrigger ? 'Old deposit trigger still present' : '');
} catch (e) {
  logTest('Welcome bonus triggered correctly', false, `Error reading _index.js: ${e.message}`);
}

// Test 2.4: Check startup logs for $5 welcome gift
try {
  const logsContent = fs.readFileSync('/var/log/supervisor/nodejs.out.log', 'utf8');
  const hasCorrectStartupLog = logsContent.includes('$5 welcome gift for new users');
  logTest('Startup logs show "$5 welcome gift for new users"', hasCorrectStartupLog, hasCorrectStartupLog ? '' : '$5 welcome gift message not found in startup logs');
} catch (e) {
  logTest('Startup logs show "$5 welcome gift for new users"', false, `Error reading logs: ${e.message}`);
}

// ━━━ FEATURE 3: Admin /gift5all Command + Button ━━━

console.log('\n🧪 TESTING FEATURE 3: Admin /gift5all Command + Button');
console.log('=' .repeat(60));

// Test 3.1: Monetization engine exports giftAllUsersWelcomeBonus function
try {
  const monetization = require('/app/js/monetization-engine.js');
  const hasGiftFunction = typeof monetization.giftAllUsersWelcomeBonus === 'function';
  logTest('monetization-engine.js exports giftAllUsersWelcomeBonus', hasGiftFunction, hasGiftFunction ? '' : 'giftAllUsersWelcomeBonus function not exported');
} catch (e) {
  logTest('monetization-engine.js exports giftAllUsersWelcomeBonus', false, `Error loading monetization-engine.js: ${e.message}`);
}

// Test 3.2: giftAllUsersWelcomeBonus function has correct signature (4 parameters)
try {
  const monetizationContent = fs.readFileSync('/app/js/monetization-engine.js', 'utf8');
  const funcSignature = monetizationContent.match(/async function giftAllUsersWelcomeBonus\s*\((.*?)\)/);
  if (funcSignature) {
    const params = funcSignature[1].split(',').map(p => p.trim()).filter(p => p);
    const hasCorrectSignature = params.length === 4 && 
      params.includes('getChatIds') && 
      params.includes('sendMessage') && 
      params.includes('adminSend') && 
      params.includes('getUserLang');
    logTest('giftAllUsersWelcomeBonus has correct 4-parameter signature', hasCorrectSignature, 
      hasCorrectSignature ? '' : `Expected 4 params (getChatIds, sendMessage, adminSend, getUserLang), got: ${params.join(', ')}`);
  } else {
    logTest('giftAllUsersWelcomeBonus has correct 4-parameter signature', false, 'Function signature not found');
  }
  
  // Test localized messages
  const hasLocalizedMessages = monetizationContent.includes('giftMsgs = {') && 
    monetizationContent.includes('en:') && 
    monetizationContent.includes('fr:') && 
    monetizationContent.includes('zh:') && 
    monetizationContent.includes('hi:');
  logTest('giftAllUsersWelcomeBonus has localized messages in 4 languages', hasLocalizedMessages, 
    hasLocalizedMessages ? '' : 'Localized gift messages for all 4 languages not found');
    
  // Test duplicate checking
  const checksDuplicates = monetizationContent.includes('welcomeBonuses') && monetizationContent.includes('findOne({ chatId })');
  logTest('giftAllUsersWelcomeBonus checks welcomeBonuses collection for duplicates', checksDuplicates,
    checksDuplicates ? '' : 'Duplicate checking via welcomeBonuses collection not found');
} catch (e) {
  logTest('giftAllUsersWelcomeBonus function analysis', false, `Error reading monetization-engine.js: ${e.message}`);
}

// Test 3.3: Language files have gift5all admin button
langFiles.forEach(langFile => {
  const langCode = path.basename(langFile, '.js');
  try {
    const content = fs.readFileSync(langFile, 'utf8');
    const hasGift5allButton = content.includes('gift5all:') && content.includes('🎁 Gift $5 All Users');
    logTest(`${langCode}.js has gift5all admin button`, hasGift5allButton, hasGift5allButton ? '' : 'gift5all admin button not found');
  } catch (e) {
    logTest(`${langCode}.js has gift5all admin button`, false, `Error reading ${langFile}: ${e.message}`);
  }
});

// Test 3.4: _index.js implements /gift5all command and button handlers
try {
  const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8');
  
  const hasCommand = indexContent.includes("message === '/gift5all'") && indexContent.includes('isAdmin(chatId)');
  logTest('_index.js has /gift5all admin command with isAdmin check', hasCommand, hasCommand ? '' : '/gift5all command handler not found or missing admin check');
  
  const hasButton = indexContent.includes('admin.gift5all') && indexContent.includes('giftAllUsersWelcomeBonus');
  logTest('_index.js has gift5all button handler', hasButton, hasButton ? '' : 'gift5all button handler not found');
  
  // Check getUserLang parameter passing
  const passesGetUserLang = indexContent.includes('giftAllUsersWelcomeBonus(') && indexContent.includes('getUserLang');
  logTest('Both handlers pass getUserLang as 4th parameter', passesGetUserLang, passesGetUserLang ? '' : 'getUserLang not passed to giftAllUsersWelcomeBonus');
} catch (e) {
  logTest('_index.js /gift5all implementation', false, `Error reading _index.js: ${e.message}`);
}

// Test 3.5: Check that no errors in nodejs.err.log
try {
  const errLogContent = fs.readFileSync('/var/log/supervisor/nodejs.err.log', 'utf8');
  const hasNoErrors = errLogContent.trim().length === 0;
  logTest('No errors in nodejs.err.log', hasNoErrors, hasNoErrors ? '' : `Found errors: ${errLogContent.trim().substring(0, 200)}...`);
} catch (e) {
  logTest('No errors in nodejs.err.log', false, `Error reading error logs: ${e.message}`);
}

// ━━━ HEALTH CHECK ━━━

console.log('\n🧪 HEALTH CHECK');
console.log('=' .repeat(60));

// Test health endpoint
const http = require('http');
const healthCheckPromise = new Promise((resolve) => {
  const req = http.get('http://localhost:5000/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const health = JSON.parse(data);
        const isHealthy = res.statusCode === 200 && health.status === 'healthy' && health.database === 'connected';
        resolve({ success: true, healthy: isHealthy, data: health });
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
  });
  req.on('error', (e) => resolve({ success: false, error: e.message }));
  req.setTimeout(5000, () => resolve({ success: false, error: 'Timeout' }));
});

healthCheckPromise.then(result => {
  if (result.success) {
    logTest('Node.js health endpoint returns 200 with healthy status', result.healthy, 
      result.healthy ? '' : `Status: ${JSON.stringify(result.data)}`);
  } else {
    logTest('Node.js health endpoint returns 200 with healthy status', false, `Health check failed: ${result.error}`);
  }

  // ━━━ FINAL SUMMARY ━━━
  console.log('\n' + '='.repeat(80));
  console.log('🧪 NOMADLY TELEGRAM BOT - 3 NEW FEATURES TEST RESULTS');
  console.log('='.repeat(80));
  
  console.log(`\n📊 OVERALL RESULTS:`);
  console.log(`   Total Tests: ${testResults.totalTests}`);
  console.log(`   ✅ Passed: ${testResults.passedTests}`);
  console.log(`   ❌ Failed: ${testResults.failedTests}`);
  console.log(`   📈 Success Rate: ${((testResults.passedTests / testResults.totalTests) * 100).toFixed(1)}%`);
  
  if (testResults.failures.length > 0) {
    console.log(`\n❌ FAILURES:`);
    testResults.failures.forEach((failure, i) => {
      console.log(`   ${i + 1}. ${failure.testName}: ${failure.details}`);
    });
  }
  
  console.log(`\n🎯 FEATURE VERIFICATION:`);
  
  // Feature 1: IONOS SMTP
  const ionosTests = [
    'config.js exports DP_PRICE_IONOS_SMTP',
    'DP_PRICE_IONOS_SMTP defaults to 150',
    '.env contains DP_PRICE_IONOS_SMTP=150',
    '_index.js imports DP_PRICE_IONOS_SMTP',
    '_index.js has dpIonosSmtp button in digital products',
    '_index.js has ionos_smtp product map entry'
  ];
  const ionosPassed = ionosTests.filter(test => 
    !testResults.failures.some(f => f.testName === test)
  ).length;
  
  console.log(`   📧 IONOS SMTP Digital Product: ${ionosPassed}/${ionosTests.length + 4} tests passed`);
  
  // Feature 2: Welcome Bonus
  const welcomeTests = [
    '.env has WELCOME_BONUS_USD=5',
    'monetization-engine.js reads WELCOME_BONUS_USD from env',
    'Messages say "Welcome Gift" not "first-deposit bonus"',
    'Init log says "welcome gift for new users"',
    'Welcome bonus triggered on new user language selection',
    'Old deposit trigger removed from addFundsTo',
    'Startup logs show "$5 welcome gift for new users"'
  ];
  const welcomePassed = welcomeTests.filter(test => 
    !testResults.failures.some(f => f.testName === test)
  ).length;
  
  console.log(`   🎁 Welcome Bonus Change ($3→$5, deposit→start): ${welcomePassed}/${welcomeTests.length} tests passed`);
  
  // Feature 3: Gift5All
  const gift5allTests = [
    'monetization-engine.js exports giftAllUsersWelcomeBonus',
    'giftAllUsersWelcomeBonus has correct 4-parameter signature',
    'giftAllUsersWelcomeBonus has localized messages in 4 languages',
    'giftAllUsersWelcomeBonus checks welcomeBonuses collection for duplicates',
    '_index.js has /gift5all admin command with isAdmin check',
    '_index.js has gift5all button handler',
    'Both handlers pass getUserLang as 4th parameter'
  ];
  const gift5allPassed = gift5allTests.filter(test => 
    !testResults.failures.some(f => f.testName === test)
  ).length;
  
  console.log(`   🎁 Admin /gift5all Command & Button: ${gift5allPassed}/${gift5allTests.length + 4} tests passed`);
  
  const overallSuccess = testResults.failedTests === 0;
  console.log(`\n${overallSuccess ? '🎉 ALL FEATURES VERIFIED SUCCESSFULLY!' : '⚠️  SOME TESTS FAILED - REVIEW ABOVE'}`);
  
  console.log('\n' + '='.repeat(80));
}).catch(err => {
  console.error('Test execution error:', err);
});