/**
 * Backend Test Suite for Nomadly Application
 * Testing SIP Call Spam Protection and TELNYX_DEFAULT_ANI Fallback fixes
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const HEALTH_ENDPOINT = `${BASE_URL}/health`;

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  details: []
};

function logTest(testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${testName}${details ? ' - ' + details : ''}`);
  testResults.details.push({ test: testName, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

async function testHealthEndpoint() {
  try {
    const response = await axios.get(HEALTH_ENDPOINT, { timeout: 5000 });
    const isHealthy = response.status === 200 && 
                     response.data.status === 'healthy' && 
                     response.data.database === 'connected';
    logTest('Health Endpoint', isHealthy, `Status: ${response.data.status}, DB: ${response.data.database}`);
    return isHealthy;
  } catch (error) {
    logTest('Health Endpoint', false, `Error: ${error.message}`);
    return false;
  }
}

function testSipSpamProtectionConstants() {
  const fs = require('fs');
  const voiceServiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  
  // Test 1: Check constants exist with correct values
  const hasGlobalRateMax = voiceServiceContent.includes('SIP_GLOBAL_RATE_MAX = 10');
  const hasGlobalRateWindow = voiceServiceContent.includes('SIP_GLOBAL_RATE_WINDOW = 300000');
  const hasWalletCooldown = voiceServiceContent.includes('WALLET_REJECT_COOLDOWN_MS = 300000');
  
  logTest('SIP_GLOBAL_RATE_MAX = 10', hasGlobalRateMax);
  logTest('SIP_GLOBAL_RATE_WINDOW = 300000', hasGlobalRateWindow);
  logTest('WALLET_REJECT_COOLDOWN_MS = 300000', hasWalletCooldown);
  
  return hasGlobalRateMax && hasGlobalRateWindow && hasWalletCooldown;
}

function testSipSpamProtectionObjects() {
  const fs = require('fs');
  const voiceServiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  
  // Test 2: Check objects exist at module level
  const hasSipGlobalRateLimit = voiceServiceContent.includes('const sipGlobalRateLimit = {}');
  const hasWalletRejectCooldown = voiceServiceContent.includes('const walletRejectCooldown = {}');
  
  logTest('sipGlobalRateLimit object exists', hasSipGlobalRateLimit);
  logTest('walletRejectCooldown object exists', hasWalletRejectCooldown);
  
  return hasSipGlobalRateLimit && hasWalletRejectCooldown;
}

function testSipSpamProtectionFunctions() {
  const fs = require('fs');
  const voiceServiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  
  // Test 3: Check functions exist
  const hasCheckSipGlobalRateLimit = voiceServiceContent.includes('function checkSipGlobalRateLimit(sipUsername)');
  const hasIsWalletRejectCooldown = voiceServiceContent.includes('function isWalletRejectCooldown(fromNumber)');
  const hasSetWalletRejectCooldown = voiceServiceContent.includes('function setWalletRejectCooldown(fromNumber, chatId)');
  
  logTest('checkSipGlobalRateLimit function exists', hasCheckSipGlobalRateLimit);
  logTest('isWalletRejectCooldown function exists', hasIsWalletRejectCooldown);
  logTest('setWalletRejectCooldown function exists', hasSetWalletRejectCooldown);
  
  return hasCheckSipGlobalRateLimit && hasIsWalletRejectCooldown && hasSetWalletRejectCooldown;
}

function testSipSpamProtectionExecutionOrder() {
  const fs = require('fs');
  const voiceServiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  
  // Test 4: Check execution order in handleOutboundSipCall
  // Find the handleOutboundSipCall function and check the order of calls
  const handleOutboundSipCallMatch = voiceServiceContent.match(/async function handleOutboundSipCall\(payload\) \{[\s\S]*?^}/m);
  
  if (!handleOutboundSipCallMatch) {
    logTest('handleOutboundSipCall function found', false);
    return false;
  }
  
  const functionContent = handleOutboundSipCallMatch[0];
  
  // Check that checkSipGlobalRateLimit is called AFTER checkSipRateLimit
  const checkSipRateLimitIndex = functionContent.indexOf('checkSipRateLimit(');
  const checkSipGlobalRateLimitIndex = functionContent.indexOf('checkSipGlobalRateLimit(');
  const isWalletRejectCooldownIndex = functionContent.indexOf('isWalletRejectCooldown(');
  const findNumberBySipUserIndex = functionContent.indexOf('findNumberBySipUser(');
  
  const correctOrder = checkSipRateLimitIndex < checkSipGlobalRateLimitIndex && 
                      checkSipGlobalRateLimitIndex < isWalletRejectCooldownIndex &&
                      isWalletRejectCooldownIndex < findNumberBySipUserIndex;
  
  logTest('SIP spam protection execution order', correctOrder, 
    `checkSipRateLimit(${checkSipRateLimitIndex}) → checkSipGlobalRateLimit(${checkSipGlobalRateLimitIndex}) → isWalletRejectCooldown(${isWalletRejectCooldownIndex}) → findNumberBySipUser(${findNumberBySipUserIndex})`);
  
  // Check that setWalletRejectCooldown is called in wallet-too-low block
  const hasSetWalletRejectInWalletBlock = functionContent.includes('wallet too low') && 
                                         functionContent.includes('setWalletRejectCooldown(');
  
  logTest('setWalletRejectCooldown called in wallet-too-low block', hasSetWalletRejectInWalletBlock);
  
  return correctOrder && hasSetWalletRejectInWalletBlock;
}

function testSipSpamProtectionCleanup() {
  const fs = require('fs');
  const voiceServiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  
  // Test 5: Check cleanup interval covers all 3 caches
  const cleanupIntervalMatch = voiceServiceContent.match(/setInterval\(\(\) => \{[\s\S]*?\}, 300000\)/);
  
  if (!cleanupIntervalMatch) {
    logTest('Cleanup interval exists', false);
    return false;
  }
  
  const cleanupContent = cleanupIntervalMatch[0];
  const cleansSipRateLimit = cleanupContent.includes('sipRateLimit');
  const cleansSipGlobalRateLimit = cleanupContent.includes('sipGlobalRateLimit');
  const cleansWalletRejectCooldown = cleanupContent.includes('walletRejectCooldown');
  
  logTest('Cleanup covers sipRateLimit', cleansSipRateLimit);
  logTest('Cleanup covers sipGlobalRateLimit', cleansSipGlobalRateLimit);
  logTest('Cleanup covers walletRejectCooldown', cleansWalletRejectCooldown);
  
  return cleansSipRateLimit && cleansSipGlobalRateLimit && cleansWalletRejectCooldown;
}

function testTelnyxDefaultAniFallback() {
  const fs = require('fs');
  const voiceServiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  
  // Test 6: Check TELNYX_DEFAULT_ANI fallback in findNumberBySipUser
  const findNumberBySipUserMatch = voiceServiceContent.match(/async function findNumberBySipUser[\s\S]*?^}/m);
  
  if (!findNumberBySipUserMatch) {
    logTest('findNumberBySipUser function found', false);
    return false;
  }
  
  const functionContent = findNumberBySipUserMatch[0];
  
  // Check for TELNYX_DEFAULT_ANI fallback logic
  const hasTelnyxDefaultAni = functionContent.includes('process.env.TELNYX_DEFAULT_ANI');
  const hasVirtualTestNumber = functionContent.includes('_isVirtualTestNumber: true');
  const hasProviderTelnyx = functionContent.includes("provider: 'telnyx'");
  const hasStatusActive = functionContent.includes("status: 'active'");
  const hasPlanTest = functionContent.includes("plan: 'test'");
  
  logTest('TELNYX_DEFAULT_ANI fallback exists', hasTelnyxDefaultAni);
  logTest('Virtual test number creation', hasVirtualTestNumber);
  logTest('Virtual number has provider: telnyx', hasProviderTelnyx);
  logTest('Virtual number has status: active', hasStatusActive);
  logTest('Virtual number has plan: test', hasPlanTest);
  
  // Check that old log message is conditional
  const hasConditionalLogging = functionContent.includes('has no active number and no TELNYX_DEFAULT_ANI');
  logTest('Conditional logging for no fallback', hasConditionalLogging);
  
  return hasTelnyxDefaultAni && hasVirtualTestNumber && hasProviderTelnyx && 
         hasStatusActive && hasPlanTest && hasConditionalLogging;
}

function testPhoneTestRoutesFallback() {
  const fs = require('fs');
  const phoneTestContent = fs.readFileSync('/app/js/phone-test-routes.js', 'utf8');
  
  // Test 7: Check TELNYX_DEFAULT_ANI fallback pattern in phone-test-routes.js
  const hasCallerNumberFallback = phoneTestContent.includes('testNum?.phoneNumber || process.env.TELNYX_DEFAULT_ANI || \'\'');
  
  logTest('phone-test-routes.js TELNYX_DEFAULT_ANI fallback', hasCallerNumberFallback);
  
  return hasCallerNumberFallback;
}

function testEnvironmentVariables() {
  const fs = require('fs');
  const envContent = fs.readFileSync('/app/backend/.env', 'utf8');
  
  // Test 8: Check TELNYX_DEFAULT_ANI exists in .env
  const hasTelnyxDefaultAni = envContent.includes('TELNYX_DEFAULT_ANI=');
  
  logTest('TELNYX_DEFAULT_ANI in backend/.env', hasTelnyxDefaultAni);
  
  return hasTelnyxDefaultAni;
}

function testRegressionChecks() {
  const fs = require('fs');
  const voiceServiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  
  // Test 9: Check regression - smartWallet functions still imported
  const hasSmartWalletImports = voiceServiceContent.includes('smartWalletDeduct, smartWalletCheck');
  
  logTest('smartWallet functions still imported', hasSmartWalletImports);
  
  // Test 10: Check regression - outboundIvrCalls check still present
  const hasOutboundIvrCheck = voiceServiceContent.includes('if (outboundIvrCalls[callControlId])');
  
  logTest('outboundIvrCalls check still present', hasOutboundIvrCheck);
  
  return hasSmartWalletImports && hasOutboundIvrCheck;
}

async function runAllTests() {
  console.log('🧪 Starting Backend Test Suite for Nomadly Application\n');
  console.log('Testing SIP Call Spam Protection and TELNYX_DEFAULT_ANI Fallback fixes...\n');
  
  // Test 1: Health endpoint
  await testHealthEndpoint();
  
  // Test 2: SIP Spam Protection - Constants
  testSipSpamProtectionConstants();
  
  // Test 3: SIP Spam Protection - Objects
  testSipSpamProtectionObjects();
  
  // Test 4: SIP Spam Protection - Functions
  testSipSpamProtectionFunctions();
  
  // Test 5: SIP Spam Protection - Execution Order
  testSipSpamProtectionExecutionOrder();
  
  // Test 6: SIP Spam Protection - Cleanup
  testSipSpamProtectionCleanup();
  
  // Test 7: TELNYX_DEFAULT_ANI Fallback in voice-service.js
  testTelnyxDefaultAniFallback();
  
  // Test 8: TELNYX_DEFAULT_ANI Fallback in phone-test-routes.js
  testPhoneTestRoutesFallback();
  
  // Test 9: Environment Variables
  testEnvironmentVariables();
  
  // Test 10: Regression Checks
  testRegressionChecks();
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.details.filter(t => !t.passed).forEach(t => {
      console.log(`   • ${t.test}${t.details ? ' - ' + t.details : ''}`);
    });
  }
  
  return testResults.failed === 0;
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };