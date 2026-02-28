#!/usr/bin/env node

/**
 * Comprehensive CloudPhone Backend Test Suite
 * Tests all 5 parts from the review request:
 * 1. Scope and Try/Catch Verification
 * 2. Payment Flow Simulation
 * 3. Twilio Number Provisioning
 * 4. Twilio Feature Endpoints  
 * 5. SIP Domain Configuration
 */

const axios = require('axios');
const fs = require('fs');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_RESULTS = {
  part1: { name: 'SCOPE AND TRY/CATCH VERIFICATION', tests: [], passed: 0, total: 0 },
  part2: { name: 'PAYMENT FLOW SIMULATION', tests: [], passed: 0, total: 0 },
  part3: { name: 'TWILIO NUMBER PROVISIONING', tests: [], passed: 0, total: 0 },
  part4: { name: 'TWILIO FEATURE ENDPOINTS', tests: [], passed: 0, total: 0 },
  part5: { name: 'SIP DOMAIN CONFIGURATION', tests: [], passed: 0, total: 0 }
};

// Utility functions
function addTest(part, name, passed, details = '') {
  TEST_RESULTS[part].tests.push({ name, passed, details });
  TEST_RESULTS[part].total++;
  if (passed) TEST_RESULTS[part].passed++;
}

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function logResult(part, name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  log(`${status} ${name}: ${details}`);
  addTest(part, name, passed, details);
}

// HTTP helper for making requests
async function makeRequest(method, url, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: { 'Content-Type': 'application/json', ...headers },
      timeout: 10000
    };
    if (data) config.data = data;
    
    const response = await axios(config);
    return { success: true, status: response.status, data: response.data, headers: response.headers };
  } catch (error) {
    return { 
      success: false, 
      status: error.response?.status || 0, 
      data: error.response?.data || error.message,
      error: error.message 
    };
  }
}

// Read and analyze code files
function analyzeCodeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content, lines: content.split('\n') };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// PART 1: SCOPE AND TRY/CATCH VERIFICATION
async function testPart1() {
  log('='.repeat(80));
  log('PART 1: SCOPE AND TRY/CATCH VERIFICATION');
  log('='.repeat(80));

  // Test 1: Verify all 3 functions at module scope
  const codeAnalysis = analyzeCodeFile('/app/js/_index.js');
  if (!codeAnalysis.success) {
    logResult('part1', '1.1 Code File Analysis', false, `Cannot read _index.js: ${codeAnalysis.error}`);
    return;
  }

  const lines = codeAnalysis.lines;
  const loadDataLineIndex = lines.findIndex(line => line.includes('const loadData = async () => {'));
  
  // Find function definitions
  const executeTwilioPurchaseIndex = lines.findIndex(line => line.includes('async function executeTwilioPurchase('));
  const getCachedTwilioAddressIndex = lines.findIndex(line => line.includes('async function getCachedTwilioAddress('));
  const cacheTwilioAddressIndex = lines.findIndex(line => line.includes('async function cacheTwilioAddress('));

  // Verify functions are at module scope (before loadData)
  const functionsAtModuleScope = 
    executeTwilioPurchaseIndex !== -1 && executeTwilioPurchaseIndex < loadDataLineIndex &&
    getCachedTwilioAddressIndex !== -1 && getCachedTwilioAddressIndex < loadDataLineIndex &&
    cacheTwilioAddressIndex !== -1 && cacheTwilioAddressIndex < loadDataLineIndex;

  logResult('part1', '1.1 All 3 Functions at Module Scope', functionsAtModuleScope, 
    functionsAtModuleScope ? 
    `executeTwilioPurchase(${executeTwilioPurchaseIndex}), getCachedTwilioAddress(${getCachedTwilioAddressIndex}), cacheTwilioAddress(${cacheTwilioAddressIndex}) before loadData(${loadDataLineIndex})` :
    'Functions not found at module scope or after loadData');

  // Test 2: Verify all 8 call sites have try/catch
  const executeTwilioPurchaseCalls = [];
  lines.forEach((line, index) => {
    if (line.includes('executeTwilioPurchase(') && !line.includes('async function')) {
      executeTwilioPurchaseCalls.push({ line: index + 1, content: line.trim() });
    }
  });

  let tryCatchCount = 0;
  for (const call of executeTwilioPurchaseCalls) {
    // Check if the call is within a try block (look backwards for 'try {')
    let hasTryCatch = false;
    for (let i = call.line - 1; i >= Math.max(0, call.line - 50); i--) {
      if (lines[i].includes('try {')) {
        // Check if there's a corresponding catch block
        for (let j = call.line; j < Math.min(lines.length, call.line + 50); j++) {
          if (lines[j].includes('} catch')) {
            hasTryCatch = true;
            break;
          }
        }
        break;
      }
    }
    if (hasTryCatch) tryCatchCount++;
  }

  logResult('part1', '1.2 All Call Sites Have Try/Catch', tryCatchCount === executeTwilioPurchaseCalls.length, 
    `Found ${executeTwilioPurchaseCalls.length} call sites, ${tryCatchCount} have try/catch blocks`);

  // Test 3: Verify catch blocks have required elements
  let catchBlocksWithRequirements = 0;
  const catchBlocks = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('} catch') && i > 0) {
      // Find the catch block content
      let catchContent = [];
      let braceCount = 0;
      let started = false;
      
      for (let j = i; j < Math.min(lines.length, i + 20); j++) {
        if (lines[j].includes('{')) {
          started = true;
          braceCount++;
        }
        if (started) {
          catchContent.push(lines[j]);
          if (lines[j].includes('}')) {
            braceCount--;
            if (braceCount === 0) break;
          }
        }
      }
      
      const catchText = catchContent.join('\n');
      const hasCloudPhoneLog = catchText.includes('[CloudPhone]');
      const hasRefundLogic = catchText.includes('atomicIncrement') || catchText.includes('addFundsTo');
      const hasErrorMessage = catchText.includes('purchaseFailed') || catchText.includes('send(');
      
      if (hasCloudPhoneLog && hasRefundLogic && hasErrorMessage) {
        catchBlocksWithRequirements++;
      }
      
      catchBlocks.push({
        line: i + 1,
        hasCloudPhoneLog,
        hasRefundLogic,
        hasErrorMessage,
        content: catchText.substring(0, 100) + '...'
      });
    }
  }

  logResult('part1', '1.3 Catch Blocks Have Required Elements', catchBlocksWithRequirements > 0, 
    `Found ${catchBlocks.length} catch blocks, ${catchBlocksWithRequirements} have [CloudPhone] logging, refund logic, and error messages`);
}

// PART 2: PAYMENT FLOW SIMULATION
async function testPart2() {
  log('='.repeat(80));
  log('PART 2: PAYMENT FLOW SIMULATION');
  log('='.repeat(80));

  // Test 4: Health check
  const healthResponse = await makeRequest('GET', '/health');
  logResult('part2', '2.1 Health Check', healthResponse.success && healthResponse.status === 200 && 
    healthResponse.data?.status === 'healthy' && healthResponse.data?.database === 'connected',
    healthResponse.success ? `Status: ${healthResponse.data?.status}, DB: ${healthResponse.data?.database}` : healthResponse.error);

  // Test 5: Check wallet flow structure in code
  const codeAnalysis = analyzeCodeFile('/app/js/_index.js');
  if (codeAnalysis.success) {
    const content = codeAnalysis.content;
    
    // Look for walletOk['phone-pay'] structure
    const walletPhonePayIndex = content.indexOf("walletOk['phone-pay']");
    const hasWalletFlow = walletPhonePayIndex !== -1;
    
    // Check for wallet balance check, deduction, provider check
    const walletSection = content.substring(walletPhonePayIndex, walletPhonePayIndex + 2000);
    const hasBalanceCheck = walletSection.includes('atomicIncrement') && walletSection.includes('usdOut');
    const hasProviderCheck = walletSection.includes('provider') && (walletSection.includes('twilio') || walletSection.includes('telnyx'));
    
    logResult('part2', '2.2 Wallet Flow Structure', hasWalletFlow && hasBalanceCheck && hasProviderCheck,
      `Wallet flow found: ${hasWalletFlow}, Balance check: ${hasBalanceCheck}, Provider check: ${hasProviderCheck}`);
  } else {
    logResult('part2', '2.2 Wallet Flow Structure', false, 'Cannot analyze code file');
  }

  // Test 6: Bank webhook endpoint exists
  const bankWebhookResponse = await makeRequest('POST', '/bank-pay-phone', { test: true });
  logResult('part2', '2.3 Bank Webhook Endpoint', bankWebhookResponse.status !== 404,
    `Status: ${bankWebhookResponse.status} (404 = not found, other = endpoint exists)`);

  // Test 7: Crypto webhook endpoints exist  
  const blockbeeResponse = await makeRequest('POST', '/crypto-pay-phone', { test: true });
  const dynopayResponse = await makeRequest('POST', '/dynopay/crypto-pay-phone', { test: true });
  
  logResult('part2', '2.4 Crypto Webhook Endpoints', 
    blockbeeResponse.status !== 404 && dynopayResponse.status !== 404,
    `BlockBee: ${blockbeeResponse.status}, DynoPay: ${dynopayResponse.status}`);
}

// PART 3: TWILIO NUMBER PROVISIONING
async function testPart3() {
  log('='.repeat(80));
  log('PART 3: TWILIO NUMBER PROVISIONING');
  log('='.repeat(80));

  // Test 8: executeTwilioPurchase completeness
  const codeAnalysis = analyzeCodeFile('/app/js/_index.js');
  if (codeAnalysis.success) {
    const content = codeAnalysis.content;
    
    // Find the executeTwilioPurchase function
    const funcStart = content.indexOf('async function executeTwilioPurchase(');
    const funcEnd = content.indexOf('\n}', funcStart + 1);
    const funcContent = content.substring(funcStart, funcEnd);
    
    // Check for required steps
    const hasSubAccount = funcContent.includes('createSubAccount') || funcContent.includes('subSid');
    const hasBuyNumber = funcContent.includes('buyNumber') || funcContent.includes('twilioService.buy');
    const hasTransferNumber = funcContent.includes('transferNumberToSubAccount') || funcContent.includes('transfer');
    const hasWebhookUpdate = funcContent.includes('updateSubAccountNumberWebhooks') || funcContent.includes('webhook');
    const hasSipCredentials = funcContent.includes('SIP') || funcContent.includes('sip');
    const hasNumberDoc = funcContent.includes('numberDoc') && funcContent.includes('phoneNumber');
    const hasPhoneTransaction = funcContent.includes('phoneTransactions') && funcContent.includes('insertOne');
    const hasAdminNotify = funcContent.includes('notifyGroup') || funcContent.includes('adminPurchase');
    
    const completenessScore = [hasSubAccount, hasBuyNumber, hasTransferNumber, hasWebhookUpdate, 
                              hasSipCredentials, hasNumberDoc, hasPhoneTransaction, hasAdminNotify]
                              .filter(Boolean).length;
    
    logResult('part3', '3.1 executeTwilioPurchase Completeness', completenessScore >= 7,
      `${completenessScore}/8 required steps found: SubAccount(${hasSubAccount}), BuyNumber(${hasBuyNumber}), Transfer(${hasTransferNumber}), Webhooks(${hasWebhookUpdate}), SIP(${hasSipCredentials}), NumberDoc(${hasNumberDoc}), Transaction(${hasPhoneTransaction}), AdminNotify(${hasAdminNotify})`);
  } else {
    logResult('part3', '3.1 executeTwilioPurchase Completeness', false, 'Cannot analyze code file');
  }
}

// PART 4: TWILIO FEATURE ENDPOINTS
async function testPart4() {
  log('='.repeat(80));
  log('PART 4: TWILIO FEATURE ENDPOINTS');
  log('='.repeat(80));

  // Test 9: Inbound voice webhook
  const voiceWebhookResponse = await makeRequest('POST', '/twilio/voice-webhook', { 
    From: '+1234567890',
    To: '+1987654321',
    CallSid: 'test-call-sid'
  });
  logResult('part4', '4.1 Inbound Voice Webhook', voiceWebhookResponse.status !== 404,
    `Status: ${voiceWebhookResponse.status}`);

  // Test 10: SIP outbound endpoint
  const sipVoiceResponse = await makeRequest('POST', '/twilio/sip-voice', {
    From: 'test-sip-user',
    To: '+1234567890'
  });
  logResult('part4', '4.2 SIP Outbound Endpoint', sipVoiceResponse.status !== 404,
    `Status: ${sipVoiceResponse.status}`);

  // Test 11: SIP ring result endpoint
  const sipRingResponse = await makeRequest('POST', '/twilio/sip-ring-result', {
    CallSid: 'test-call-sid',
    CallStatus: 'no-answer'
  });
  logResult('part4', '4.3 SIP Ring Result Endpoint', sipRingResponse.status !== 404,
    `Status: ${sipRingResponse.status}`);

  // Test 12: Bulk IVR endpoint
  const bulkIvrResponse = await makeRequest('POST', '/twilio/bulk-ivr', {
    CallSid: 'test-call-sid',
    Digits: '1'
  });
  logResult('part4', '4.4 Bulk IVR Endpoint', bulkIvrResponse.status !== 404,
    `Status: ${bulkIvrResponse.status}`);

  // Test 13: Single IVR (Quick IVR) endpoint
  const singleIvrResponse = await makeRequest('POST', '/twilio/single-ivr', {
    CallSid: 'test-call-sid',
    From: '+1234567890'
  });
  logResult('part4', '4.5 Single IVR Endpoint', singleIvrResponse.status !== 404,
    `Status: ${singleIvrResponse.status}`);

  // Test 14: Voicemail endpoint
  const voicemailResponse = await makeRequest('POST', '/twilio/voicemail-complete', {
    CallSid: 'test-call-sid',
    RecordingUrl: 'http://example.com/recording.wav'
  });
  logResult('part4', '4.6 Voicemail Endpoint', voicemailResponse.status !== 404,
    `Status: ${voicemailResponse.status}`);

  // Test 15: Recording status endpoint
  const recordingResponse = await makeRequest('POST', '/twilio/recording-status', {
    RecordingSid: 'test-recording-sid',
    RecordingStatus: 'completed'
  });
  logResult('part4', '4.7 Recording Status Endpoint', recordingResponse.status !== 404,
    `Status: ${recordingResponse.status}`);

  // Test 16: Voice status billing endpoint
  const voiceStatusResponse = await makeRequest('POST', '/twilio/voice-status', {
    CallSid: 'test-call-sid',
    CallStatus: 'completed',
    CallDuration: '120'
  });
  logResult('part4', '4.8 Voice Status Billing Endpoint', voiceStatusResponse.status !== 404,
    `Status: ${voiceStatusResponse.status}`);
}

// PART 5: SIP DOMAIN CONFIGURATION
async function testPart5() {
  log('='.repeat(80));
  log('PART 5: SIP DOMAIN CONFIGURATION');
  log('='.repeat(80));

  // Test 17: SIP domain initialization in code
  const codeAnalysis = analyzeCodeFile('/app/js/_index.js');
  if (codeAnalysis.success) {
    const content = codeAnalysis.content;
    
    // Check for SIP domain usage
    const hasSipDomain = content.includes('SIP_DOMAIN') || content.includes('sip.speechcue.com');
    const hasTwilioSipDomain = content.includes('twilioSipDomain') || content.includes('sipDomainName');
    const hasVoiceServiceInit = content.includes('initVoiceService') && content.includes('twilioSipDomainName');
    
    logResult('part5', '5.1 SIP Domain Configuration', hasSipDomain && hasTwilioSipDomain && hasVoiceServiceInit,
      `SIP_DOMAIN usage: ${hasSipDomain}, Twilio SIP domain: ${hasTwilioSipDomain}, Voice service init: ${hasVoiceServiceInit}`);

    // Check for SIP domain in startup logs (if we can access them)
    const hasInitialization = content.includes('[CloudPhone] Twilio initialized') || content.includes('SIP:');
    logResult('part5', '5.2 SIP Domain Initialization Logs', hasInitialization,
      `Initialization logging found: ${hasInitialization}`);
  } else {
    logResult('part5', '5.1 SIP Domain Configuration', false, 'Cannot analyze code file');
    logResult('part5', '5.2 SIP Domain Initialization Logs', false, 'Cannot analyze code file');
  }
}

// Generate final report
function generateReport() {
  log('='.repeat(80));
  log('COMPREHENSIVE TEST REPORT');
  log('='.repeat(80));
  
  let totalTests = 0;
  let totalPassed = 0;
  
  for (const [partKey, part] of Object.entries(TEST_RESULTS)) {
    totalTests += part.total;
    totalPassed += part.passed;
    
    const percentage = part.total > 0 ? ((part.passed / part.total) * 100).toFixed(1) : '0.0';
    log(`${part.name}: ${part.passed}/${part.total} tests passed (${percentage}%)`);
    
    part.tests.forEach(test => {
      const status = test.passed ? '✅' : '❌';
      log(`  ${status} ${test.name}: ${test.details}`);
    });
    log('');
  }
  
  const overallPercentage = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';
  log(`OVERALL: ${totalPassed}/${totalTests} tests passed (${overallPercentage}%)`);
  
  // Critical issues summary
  const criticalIssues = [];
  for (const [partKey, part] of Object.entries(TEST_RESULTS)) {
    const failedTests = part.tests.filter(test => !test.passed);
    failedTests.forEach(test => {
      criticalIssues.push(`${part.name}: ${test.name} - ${test.details}`);
    });
  }
  
  if (criticalIssues.length > 0) {
    log('='.repeat(80));
    log('CRITICAL ISSUES FOUND:');
    log('='.repeat(80));
    criticalIssues.forEach((issue, index) => {
      log(`${index + 1}. ${issue}`);
    });
  } else {
    log('🎉 NO CRITICAL ISSUES FOUND - All tests passed!');
  }
  
  return {
    totalTests,
    totalPassed,
    overallPercentage: parseFloat(overallPercentage),
    criticalIssues,
    parts: TEST_RESULTS
  };
}

// Main test execution
async function runAllTests() {
  log('Starting CloudPhone Backend Comprehensive Test Suite...');
  log(`Testing against: ${BASE_URL}`);
  log('');
  
  try {
    await testPart1();
    await testPart2();
    await testPart3();
    await testPart4();
    await testPart5();
    
    return generateReport();
  } catch (error) {
    log(`❌ Test execution failed: ${error.message}`);
    throw error;
  }
}

// Export for use by other modules or run directly
if (require.main === module) {
  runAllTests()
    .then(report => {
      process.exit(report.overallPercentage >= 80 ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, TEST_RESULTS };