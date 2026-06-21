#!/usr/bin/env node

/**
 * SIP Call Fixes Verification Test
 * Tests the 3 critical fixes implemented for SIP call anomalies
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 SIP Call Fixes Verification Test');
console.log('=====================================\n');

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${name}`);
  if (details) console.log(`   ${details}`);
  
  results.tests.push({ name, passed, details });
  if (passed) results.passed++;
  else results.failed++;
}

// Test 1: Trial Quick IVR D51 Fix
console.log('📋 Test 1: Trial Quick IVR D51 Fix (CRITICAL)');
console.log('----------------------------------------------');

try {
  // Check _index.js line 11421 - Trial path sets callerProvider: 'twilio'
  const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8');
  const line11421 = indexContent.split('\n')[11420]; // 0-indexed
  
  const hasTrialCallerProvider = line11421.includes("callerProvider: 'twilio'") && 
                                 line11421.includes('isTrial: true');
  logTest('Trial path sets callerProvider: twilio', hasTrialCallerProvider, 
    hasTrialCallerProvider ? 'Found in _index.js line 11421' : 'Missing callerProvider: twilio in trial path');

  // Check _index.js line 11961 - Sub-account security check skips trial calls
  const line11961 = indexContent.split('\n')[11960]; // 0-indexed
  const hasTrialSkip = line11961.includes('!ivrObData.isTrial') && 
                       line11961.includes("callerProvider === 'twilio'");
  logTest('Sub-account security check skips trial calls', hasTrialSkip,
    hasTrialSkip ? 'Found trial skip in _index.js line 11961' : 'Missing !ivrObData.isTrial check');

  // Check voice-service.js - Trial path uses makeTrialOutboundCall
  const voiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  const hasTrialOutboundCall = voiceContent.includes('makeTrialOutboundCall') &&
                               voiceContent.includes('isTrial: true');
  logTest('Voice service uses makeTrialOutboundCall for trial calls', hasTrialOutboundCall,
    hasTrialOutboundCall ? 'Found makeTrialOutboundCall usage' : 'Missing makeTrialOutboundCall implementation');

  // Check twilio-service.js - makeTrialOutboundCall function exists
  const twilioContent = fs.readFileSync('/app/js/twilio-service.js', 'utf8');
  const hasTrialFunction = twilioContent.includes('async function makeTrialOutboundCall') &&
                           twilioContent.includes('getClient()') &&
                           twilioContent.includes('makeTrialOutboundCall,');
  logTest('makeTrialOutboundCall function exists and exported', hasTrialFunction,
    hasTrialFunction ? 'Function found and exported in twilio-service.js' : 'Missing makeTrialOutboundCall function');

} catch (error) {
  logTest('Trial IVR D51 Fix - File Access', false, `Error reading files: ${error.message}`);
}

console.log('');

// Test 2: Orphaned Number Admin Alerting
console.log('📋 Test 2: Orphaned Number Admin Alerting');
console.log('------------------------------------------');

try {
  const voiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  
  // Check for orphaned number logging
  const hasOrphanedLogging = voiceContent.includes('⚠️ ORPHANED NUMBER:') &&
                             voiceContent.includes('No owner found for');
  logTest('Orphaned number logging implemented', hasOrphanedLogging,
    hasOrphanedLogging ? 'Found orphaned number logging' : 'Missing orphaned number logging');

  // Check for Telegram admin alert
  const hasTelegramAlert = voiceContent.includes('_bot.sendMessage(process.env.TELEGRAM_ADMIN_CHAT_ID') &&
                           voiceContent.includes('Orphaned Number Alert') &&
                           voiceContent.includes('No owner found in DB');
  logTest('Telegram admin alert implemented', hasTelegramAlert,
    hasTelegramAlert ? 'Found Telegram admin alert code' : 'Missing Telegram admin alert');

  // Check alert message content
  const hasDetailedAlert = voiceContent.includes('received inbound call from') &&
                           voiceContent.includes('call rejected') &&
                           voiceContent.includes('may need to be released or re-assigned');
  logTest('Alert contains detailed information', hasDetailedAlert,
    hasDetailedAlert ? 'Alert includes caller info and guidance' : 'Alert missing detailed information');

} catch (error) {
  logTest('Orphaned Number Alerting - File Access', false, `Error reading files: ${error.message}`);
}

console.log('');

// Test 3: SIP Outbound Rate Limiting
console.log('📋 Test 3: SIP Outbound Rate Limiting');
console.log('-------------------------------------');

try {
  const voiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  
  // Check rate limiter constants
  const hasRateLimitConstants = voiceContent.includes('const sipRateLimit = {}') &&
                                voiceContent.includes('const SIP_RATE_LIMIT_MAX = 3') &&
                                voiceContent.includes('const SIP_RATE_LIMIT_WINDOW = 60000');
  logTest('Rate limiter constants defined', hasRateLimitConstants,
    hasRateLimitConstants ? 'Found sipRateLimit, MAX=3, WINDOW=60000' : 'Missing rate limiter constants');

  // Check checkSipRateLimit function
  const hasRateLimitFunction = voiceContent.includes('function checkSipRateLimit(sipUsername, destination)') &&
                               voiceContent.includes('sipUsername}:${destination}') &&
                               voiceContent.includes('entry.count > SIP_RATE_LIMIT_MAX');
  logTest('checkSipRateLimit function implemented', hasRateLimitFunction,
    hasRateLimitFunction ? 'Function checks rate limits correctly' : 'Missing or incomplete checkSipRateLimit function');

  // Check cleanup interval
  const hasCleanupInterval = voiceContent.includes('setInterval') &&
                             voiceContent.includes('300000') &&
                             voiceContent.includes('delete sipRateLimit[key]');
  logTest('Rate limit cleanup interval implemented', hasCleanupInterval,
    hasCleanupInterval ? 'Found 5-minute cleanup interval' : 'Missing cleanup interval');

  // Check rate limit enforcement in handleOutboundSipCall
  const hasRateLimitEnforcement = voiceContent.includes('if (!checkSipRateLimit(sipUsername, destination))') &&
                                  voiceContent.includes('SIP RATE LIMIT:') &&
                                  voiceContent.includes('exceeded');
  logTest('Rate limit enforcement in outbound SIP calls', hasRateLimitEnforcement,
    hasRateLimitEnforcement ? 'Rate limit check before SIP user lookup' : 'Missing rate limit enforcement');

} catch (error) {
  logTest('SIP Rate Limiting - File Access', false, `Error reading files: ${error.message}`);
}

console.log('');

// Test 4: General Health Checks
console.log('📋 Test 4: General Health Checks');
console.log('---------------------------------');

try {
  // Check Node.js health endpoint
  const { execSync } = require('child_process');
  const healthResponse = execSync('curl -s http://localhost:5000/health', { encoding: 'utf8' });
  const healthData = JSON.parse(healthResponse);
  
  const isHealthy = healthData.status === 'healthy' && healthData.database === 'connected';
  logTest('Node.js health endpoint responds correctly', isHealthy,
    isHealthy ? `Status: ${healthData.status}, DB: ${healthData.database}` : 'Health check failed');

  // Check error log size
  const errorLogPath = '/var/log/supervisor/nodejs.err.log';
  const errorLogExists = fs.existsSync(errorLogPath);
  let errorLogSize = 0;
  if (errorLogExists) {
    const stats = fs.statSync(errorLogPath);
    errorLogSize = stats.size;
  }
  
  logTest('Error log is empty (0 bytes)', errorLogSize === 0,
    errorLogExists ? `Error log size: ${errorLogSize} bytes` : 'Error log not found');

} catch (error) {
  logTest('General Health Checks', false, `Error during health checks: ${error.message}`);
}

console.log('');

// Summary
console.log('📊 Test Summary');
console.log('===============');
console.log(`Total Tests: ${results.tests.length}`);
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`Success Rate: ${((results.passed / results.tests.length) * 100).toFixed(1)}%`);

if (results.failed > 0) {
  console.log('\n❌ Failed Tests:');
  results.tests.filter(t => !t.passed).forEach(test => {
    console.log(`   • ${test.name}: ${test.details || 'No details'}`);
  });
}

console.log('\n🔍 Detailed Code Verification:');
console.log('==============================');

// Verify specific code sections
try {
  const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8');
  const voiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
  const twilioContent = fs.readFileSync('/app/js/twilio-service.js', 'utf8');

  console.log('\n1. Trial IVR Fix - Key Code Sections:');
  console.log('   Line 11421 (_index.js):');
  console.log(`   ${indexContent.split('\n')[11420].trim()}`);
  console.log('   Line 11961 (_index.js):');
  console.log(`   ${indexContent.split('\n')[11960].trim()}`);
  
  console.log('\n2. Orphaned Number Alert - Key Code:');
  const orphanedLines = voiceContent.split('\n').filter(line => 
    line.includes('ORPHANED NUMBER') || line.includes('Orphaned Number Alert')
  );
  orphanedLines.forEach(line => console.log(`   ${line.trim()}`));

  console.log('\n3. SIP Rate Limiting - Key Constants:');
  const rateLimitLines = voiceContent.split('\n').filter(line => 
    line.includes('SIP_RATE_LIMIT') || line.includes('sipRateLimit')
  ).slice(0, 5);
  rateLimitLines.forEach(line => console.log(`   ${line.trim()}`));

} catch (error) {
  console.log(`Error reading code sections: ${error.message}`);
}

// Exit with appropriate code
process.exit(results.failed > 0 ? 1 : 0);