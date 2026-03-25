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

function testLowBalanceLockConstants() {
  const fs = require('fs');
  const voiceServiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  
  // Test 1: Check LOW_BALANCE_TRIGGER = 1 exists at module level
  const hasLowBalanceTrigger = voiceServiceContent.includes('LOW_BALANCE_TRIGGER = 1');
  logTest('LOW_BALANCE_TRIGGER = 1 constant exists', hasLowBalanceTrigger);
  
  // Test 2: Check LOW_BALANCE_RESUME = 50 exists at module level  
  const hasLowBalanceResume = voiceServiceContent.includes('LOW_BALANCE_RESUME = 50');
  logTest('LOW_BALANCE_RESUME = 50 constant exists', hasLowBalanceResume);
  
  // Test 3: Verify constants are around lines 53-54 (module level)
  const lines = voiceServiceContent.split('\n');
  const triggerLineIndex = lines.findIndex(line => line.includes('LOW_BALANCE_TRIGGER = 1'));
  const resumeLineIndex = lines.findIndex(line => line.includes('LOW_BALANCE_RESUME = 50'));
  
  const constantsAtModuleLevel = triggerLineIndex >= 50 && triggerLineIndex <= 60 && 
                                resumeLineIndex >= 50 && resumeLineIndex <= 60;
  logTest('Constants at module level (lines 50-60)', constantsAtModuleLevel, 
    `Trigger at line ${triggerLineIndex + 1}, Resume at line ${resumeLineIndex + 1}`);
}

function testWalletCooldownCampaignMessage() {
  const fs = require('fs');
  const voiceServiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  
  // Test 4: Check wallet cooldown sends campaign message
  const hasIsWalletRejectCooldownCheck = voiceServiceContent.includes('if (isWalletRejectCooldown(fromClean || sipUsername))');
  logTest('isWalletRejectCooldown check exists', hasIsWalletRejectCooldownCheck);
  
  // Test 5: Check cooldownEntry.chatId is read from cache
  const readsChatIdFromCooldown = voiceServiceContent.includes('cooldownEntry?.chatId');
  logTest('Reads chatId from walletRejectCooldown cache', readsChatIdFromCooldown);
  
  // Test 6: Check campaign message contains required text
  const cooldownMessageContainsLocked = voiceServiceContent.includes('Outbound Calling Locked') && 
                                       voiceServiceContent.includes('$${LOW_BALANCE_RESUME}') &&
                                       voiceServiceContent.includes('Wallet');
  logTest('Cooldown campaign message contains "Outbound Calling Locked", "$50", "Wallet"', cooldownMessageContainsLocked);
  
  // Test 7: Check message is sent BEFORE hanging up the call
  const cooldownSection = voiceServiceContent.substring(
    voiceServiceContent.indexOf('if (isWalletRejectCooldown(fromClean || sipUsername))'),
    voiceServiceContent.indexOf('return', voiceServiceContent.indexOf('if (isWalletRejectCooldown(fromClean || sipUsername))'))
  );
  const messageBeforeHangup = cooldownSection.indexOf('_bot.sendMessage') < cooldownSection.indexOf('hangupCall');
  logTest('Campaign message sent BEFORE hanging up call', messageBeforeHangup);
}

function testLowBalanceLockCheck() {
  const fs = require('fs');
  const voiceServiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  
  // Test 8: Check LOW BALANCE LOCK check exists
  const hasLowBalanceCheck = voiceServiceContent.includes('if (walletCheck.usdBal < LOW_BALANCE_TRIGGER)');
  logTest('walletCheck.usdBal < LOW_BALANCE_TRIGGER check exists', hasLowBalanceCheck);
  
  // Test 9: Check LOW BALANCE LOCK happens BEFORE insufficient funds check
  const lowBalanceIndex = voiceServiceContent.indexOf('if (walletCheck.usdBal < LOW_BALANCE_TRIGGER)');
  const insufficientIndex = voiceServiceContent.indexOf('if (!walletCheck.sufficient)');
  const lowBalanceBeforeInsufficient = lowBalanceIndex > 0 && insufficientIndex > 0 && lowBalanceIndex < insufficientIndex;
  logTest('LOW BALANCE LOCK check happens BEFORE !walletCheck.sufficient check', lowBalanceBeforeInsufficient,
    `Low balance at pos ${lowBalanceIndex}, insufficient at pos ${insufficientIndex}`);
  
  // Test 10: Check when triggered: logs "LOW BALANCE LOCK"
  const logsLowBalanceLock = voiceServiceContent.includes('LOW BALANCE LOCK');
  logTest('Logs "LOW BALANCE LOCK" when triggered', logsLowBalanceLock);
  
  // Test 11: Check calls setWalletRejectCooldown
  const callsSetWalletRejectCooldown = voiceServiceContent.includes('setWalletRejectCooldown(fromClean || sipUsername, chatId)');
  logTest('Calls setWalletRejectCooldown when triggered', callsSetWalletRejectCooldown);
  
  // Test 12: Check hangs up call
  const hangsUpCall = voiceServiceContent.includes('await _telnyxApi.hangupCall(callControlId)');
  logTest('Hangs up call when triggered', hangsUpCall);
  
  // Test 13: Check sends campaign message with current balance, $1 trigger, $50 resume
  const lockCampaignMessage = voiceServiceContent.includes('$${walletCheck.usdBal.toFixed(2)}') &&
                             voiceServiceContent.includes('$${LOW_BALANCE_TRIGGER}') &&
                             voiceServiceContent.includes('$${LOW_BALANCE_RESUME}');
  logTest('Campaign message includes current balance, $1 trigger, $50 resume', lockCampaignMessage);
}

function testCampaignMessageConsistency() {
  const fs = require('fs');
  const voiceServiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  
  // Test 14: Both campaign messages contain "Outbound Calling Locked"
  const outboundCallingLockedCount = (voiceServiceContent.match(/Outbound Calling Locked/g) || []).length;
  logTest('Both campaign messages contain "Outbound Calling Locked"', outboundCallingLockedCount >= 2,
    `Found ${outboundCallingLockedCount} occurrences`);
  
  // Test 15: Both campaign messages contain "$50" or LOW_BALANCE_RESUME
  const fiftyDollarCount = (voiceServiceContent.match(/\$50|\$\$\{LOW_BALANCE_RESUME\}/g) || []).length;
  logTest('Both campaign messages contain "$50" or LOW_BALANCE_RESUME', fiftyDollarCount >= 2,
    `Found ${fiftyDollarCount} occurrences`);
  
  // Test 16: Both campaign messages contain "Wallet"
  const walletInMessagesCount = (voiceServiceContent.match(/Use.*Wallet.*to add funds|👛.*Wallet/g) || []).length;
  logTest('Both campaign messages contain "Wallet" instruction', walletInMessagesCount >= 2,
    `Found ${walletInMessagesCount} occurrences`);
}

function testExistingFunctionalityPreserved() {
  const fs = require('fs');
  const voiceServiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  
  // Test 17: The !walletCheck.sufficient check still exists as fallback
  const hasInsufficientCheck = voiceServiceContent.includes('if (!walletCheck.sufficient)');
  logTest('!walletCheck.sufficient check still exists as fallback', hasInsufficientCheck);
  
  // Test 18: smartWalletCheck still called
  const callsSmartWalletCheck = voiceServiceContent.includes('await smartWalletCheck(');
  logTest('smartWalletCheck still called', callsSmartWalletCheck);
  
  // Test 19: sipRate/getCallRate still used
  const usesSipRate = voiceServiceContent.includes('sipRate') || voiceServiceContent.includes('getCallRate');
  logTest('sipRate/getCallRate still used', usesSipRate);
  
  // Test 20: hangupCall and sendMessage patterns intact
  const hasHangupPattern = voiceServiceContent.includes('hangupCall') && voiceServiceContent.includes('sendMessage');
  logTest('hangupCall and sendMessage patterns intact', hasHangupPattern);
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
  console.log('Testing SIP Call Spam Protection, TELNYX_DEFAULT_ANI Fallback, and Low Balance Lock features...\n');
  
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
  
  // Test 11: Low Balance Lock - Constants
  console.log('\n🔒 Testing Low Balance Lock Feature...');
  testLowBalanceLockConstants();
  
  // Test 12: Low Balance Lock - Wallet Cooldown Campaign Message
  testWalletCooldownCampaignMessage();
  
  // Test 13: Low Balance Lock - Main Check Implementation
  testLowBalanceLockCheck();
  
  // Test 14: Low Balance Lock - Campaign Message Consistency
  testCampaignMessageConsistency();
  
  // Test 15: Low Balance Lock - Existing Functionality Preserved
  testExistingFunctionalityPreserved();
  
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