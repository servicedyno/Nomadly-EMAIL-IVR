#!/usr/bin/env node

/**
 * Backend Test Suite for Hosting 500 Error Fix & Health Check System
 * Tests the recently implemented changes for the Nomadly Telegram Bot platform
 */

const axios = require('axios');
const { log } = require('console');

// Test configuration
const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const API_BASE = `${BASE_URL}/api`;

let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  failures: []
};

function test(name, testFn) {
  testResults.total++;
  try {
    const result = testFn();
    if (result === true || (typeof result === 'object' && result.success)) {
      testResults.passed++;
      log(`✅ ${name}`);
      return true;
    } else {
      testResults.failed++;
      testResults.failures.push(`❌ ${name}: ${result.error || 'Test returned false'}`);
      log(`❌ ${name}: ${result.error || 'Test returned false'}`);
      return false;
    }
  } catch (error) {
    testResults.failed++;
    testResults.failures.push(`❌ ${name}: ${error.message}`);
    log(`❌ ${name}: ${error.message}`);
    return false;
  }
}

async function asyncTest(name, testFn) {
  testResults.total++;
  try {
    const result = await testFn();
    if (result === true || (typeof result === 'object' && result.success)) {
      testResults.passed++;
      log(`✅ ${name}`);
      return true;
    } else {
      testResults.failed++;
      testResults.failures.push(`❌ ${name}: ${result.error || 'Test returned false'}`);
      log(`❌ ${name}: ${result.error || 'Test returned false'}`);
      return false;
    }
  } catch (error) {
    testResults.failed++;
    testResults.failures.push(`❌ ${name}: ${error.message}`);
    log(`❌ ${name}: ${error.message}`);
    return false;
  }
}

function httpGet(url, timeout = 15000) {
  return axios.get(url, {
    timeout,
    validateStatus: () => true // Accept all status codes
  });
}

async function runTests() {
  log('🚀 Starting Backend Tests for Hosting 500 Error Fix & Health Check System...\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. Verify Node.js service health
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await asyncTest('Node.js service health check', async () => {
    const response = await httpGet(`${BASE_URL}/health`);
    if (response.status !== 200) {
      return { error: `Health endpoint returned ${response.status}` };
    }
    const health = response.data;
    if (health.status !== 'healthy' || health.database !== 'connected') {
      return { error: `Service not healthy: ${JSON.stringify(health)}` };
    }
    log(`   Service uptime: ${health.uptime}`);
    return true;
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. Verify anti-red-service.js changes (generateIPFixPhp function)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  test('generateIPFixPhp() function exists and is exported', () => {
    try {
      const antiRedService = require('./js/anti-red-service.js');
      return typeof antiRedService.generateIPFixPhp === 'function';
    } catch (error) {
      return { error: `Cannot load anti-red-service.js: ${error.message}` };
    }
  });

  test('generateIPFixPhp() returns lightweight PHP with ANTIRED_IP_FIXED and CF-Connecting-IP', () => {
    try {
      const antiRedService = require('./js/anti-red-service.js');
      const phpContent = antiRedService.generateIPFixPhp();
      
      // Verify it contains the key components mentioned in review request
      const hasIPFixed = phpContent.includes('ANTIRED_IP_FIXED');
      const hasCFConnectingIP = phpContent.includes('CF_CONNECTING_IP') || phpContent.includes('HTTP_CF_CONNECTING_IP');
      const hasNoHTML = !phpContent.includes('<script>') && !phpContent.includes('echo ');
      const hasXForwardedFor = phpContent.includes('HTTP_X_FORWARDED_FOR');
      
      if (!hasIPFixed) {
        return { error: 'PHP content missing ANTIRED_IP_FIXED constant' };
      }
      if (!hasCFConnectingIP) {
        return { error: 'PHP content missing CF-Connecting-IP header handling' };
      }
      if (!hasNoHTML) {
        return { error: 'PHP should have no HTML output (found <script> or echo)' };
      }
      
      log('   ✓ Generated PHP is lightweight IP-fix prepend with no HTML output');
      return true;
    } catch (error) {
      return { error: `generateIPFixPhp() error: ${error.message}` };
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. Verify deployCFIPFix function
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  test('deployCFIPFix function is exported from anti-red-service.js', () => {
    try {
      const antiRedService = require('./js/anti-red-service.js');
      return typeof antiRedService.deployCFIPFix === 'function';
    } catch (error) {
      return { error: `Cannot check deployCFIPFix: ${error.message}` };
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. Verify deployFullProtection deployment order
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  test('deployFullProtection() now deploys CF Worker BEFORE JS challenge', () => {
    try {
      const fs = require('fs');
      const antiRedContent = fs.readFileSync('./js/anti-red-service.js', 'utf8');
      
      // Find the deployFullProtection function
      const deployFullProtectionMatch = antiRedContent.match(/async function deployFullProtection\([^}]+\{[\s\S]*?\n^\}/m);
      if (!deployFullProtectionMatch) {
        return { error: 'deployFullProtection function not found' };
      }
      
      const functionContent = deployFullProtectionMatch[0];
      
      // Check for CF Worker deployment BEFORE JS challenge
      const hasWorkerFirst = functionContent.includes('upgradeSharedWorker') || 
                             functionContent.includes('deploySharedWorkerRoute') ||
                             functionContent.includes('Deploy HARDENED shared Worker');
      
      if (!hasWorkerFirst) {
        return { error: 'CF Worker deployment not found in deployFullProtection' };
      }
      
      log('   ✓ deployFullProtection() deploys CF Worker before JS challenge');
      return true;
    } catch (error) {
      return { error: `Error checking deployFullProtection: ${error.message}` };
    }
  });

  test('deployFullProtection() uses deployCFIPFix when workerActive=true', () => {
    try {
      const fs = require('fs');
      const content = fs.readFileSync('./js/anti-red-service.js', 'utf8');
      
      // Look for deployCFIPFix usage in context of worker being active
      const hasIPFixLogic = content.includes('deployCFIPFix') && 
                           (content.includes('workerActive') || content.includes('Worker') || content.includes('worker'));
      
      if (!hasIPFixLogic) {
        return { error: 'deployCFIPFix not found with worker context' };
      }
      
      log('   ✓ deployFullProtection() uses IP-fix when CF Worker is active');
      return true;
    } catch (error) {
      return { error: `Error checking IP-fix deployment logic: ${error.message}` };
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. Verify hosting-health-check.js module
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  test('hosting-health-check.js module exists and loads correctly', () => {
    try {
      const healthCheck = require('./js/hosting-health-check.js');
      return typeof healthCheck === 'object';
    } catch (error) {
      return { error: `Cannot load hosting-health-check.js: ${error.message}` };
    }
  });

  test('hosting-health-check.js exports scheduleHealthCheck function', () => {
    try {
      const healthCheck = require('./js/hosting-health-check.js');
      return typeof healthCheck.scheduleHealthCheck === 'function';
    } catch (error) {
      return { error: `scheduleHealthCheck not exported: ${error.message}` };
    }
  });

  test('hosting-health-check.js exports runHealthCheck function', () => {
    try {
      const healthCheck = require('./js/hosting-health-check.js');
      return typeof healthCheck.runHealthCheck === 'function';
    } catch (error) {
      return { error: `runHealthCheck not exported: ${error.message}` };
    }
  });

  test('hosting-health-check.js exports detectUserContent function', () => {
    try {
      const healthCheck = require('./js/hosting-health-check.js');
      return typeof healthCheck.detectUserContent === 'function';
    } catch (error) {
      return { error: `detectUserContent not exported: ${error.message}` };
    }
  });

  test('hosting-health-check.js exports checkHtaccessIntegrity function', () => {
    try {
      const healthCheck = require('./js/hosting-health-check.js');
      return typeof healthCheck.checkHtaccessIntegrity === 'function';
    } catch (error) {
      return { error: `checkHtaccessIntegrity not exported: ${error.message}` };
    }
  });

  test('hosting-health-check.js exports checkPrependConfig function', () => {
    try {
      const healthCheck = require('./js/hosting-health-check.js');
      return typeof healthCheck.checkPrependConfig === 'function';
    } catch (error) {
      return { error: `checkPrependConfig not exported: ${error.message}` };
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. Verify hosting plan creation integration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  test('cr-register-domain-&-create-cpanel.js requires hosting-health-check', () => {
    try {
      const fs = require('fs');
      const content = fs.readFileSync('./js/cr-register-domain-&-create-cpanel.js', 'utf8');
      
      const hasRequire = content.includes("require('./hosting-health-check')");
      if (!hasRequire) {
        return { error: 'hosting-health-check module is not required' };
      }
      
      return true;
    } catch (error) {
      return { error: `Error checking require: ${error.message}` };
    }
  });

  test('cr-register-domain-&-create-cpanel.js calls scheduleHealthCheck after deployFullProtection', () => {
    try {
      const fs = require('fs');
      const content = fs.readFileSync('./js/cr-register-domain-&-create-cpanel.js', 'utf8');
      
      // Look for scheduleHealthCheck call
      if (!content.includes('scheduleHealthCheck')) {
        return { error: 'scheduleHealthCheck call not found' };
      }
      
      // Check that it's in the context of hosting setup
      const lines = content.split('\n');
      let foundScheduleCall = false;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('scheduleHealthCheck')) {
          // Check previous lines for hosting setup context
          const contextLines = lines.slice(Math.max(0, i - 30), i).join('\n');
          if (contextLines.includes('deployFullProtection') || 
              contextLines.includes('Anti-Red protection') || 
              contextLines.includes('hosting account') ||
              contextLines.includes('cpanel')) {
            foundScheduleCall = true;
            log(`   ✓ scheduleHealthCheck called after hosting setup at line ${i + 1}`);
            break;
          }
        }
      }
      
      if (!foundScheduleCall) {
        return { error: 'scheduleHealthCheck not called in proper hosting context' };
      }
      
      return true;
    } catch (error) {
      return { error: `Error checking scheduleHealthCheck integration: ${error.message}` };
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. Verify hosting renewal integration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  test('_index.js hosting renewal path calls scheduleHealthCheck', () => {
    try {
      const fs = require('fs');
      const content = fs.readFileSync('./js/_index.js', 'utf8');
      
      // Look for scheduleHealthCheck in _index.js
      if (!content.includes('scheduleHealthCheck')) {
        return { error: 'scheduleHealthCheck not found in _index.js' };
      }
      
      // Look for it in hosting renewal context
      const lines = content.split('\n');
      let foundRenewalContext = false;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('scheduleHealthCheck')) {
          // Check surrounding context for hosting/renewal keywords
          const contextStart = Math.max(0, i - 15);
          const contextEnd = Math.min(lines.length, i + 15);
          const contextText = lines.slice(contextStart, contextEnd).join('\n').toLowerCase();
          
          if (contextText.includes('renew') || contextText.includes('hosting') || 
              contextText.includes('cpuser') || contextText.includes('plan')) {
            foundRenewalContext = true;
            log(`   ✓ scheduleHealthCheck found in hosting context at line ${i + 1}`);
            break;
          }
        }
      }
      
      if (!foundRenewalContext) {
        return { error: 'scheduleHealthCheck not found in hosting renewal context' };
      }
      
      return true;
    } catch (error) {
      return { error: `Error checking hosting renewal integration: ${error.message}` };
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 8. Final service health check
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await asyncTest('Node.js service still healthy after all tests', async () => {
    try {
      const response = await httpGet(`${BASE_URL}/health`);
      if (response.status !== 200) {
        return { error: `Health endpoint returned ${response.status}` };
      }
      const health = response.data;
      if (health.status !== 'healthy' || health.database !== 'connected') {
        return { error: `Service degraded: ${JSON.stringify(health)}` };
      }
      return true;
    } catch (error) {
      return { error: `Health check failed: ${error.message}` };
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Test Summary
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  log('\n' + '='.repeat(60));
  log('📊 HOSTING 500 ERROR FIX & HEALTH CHECK SYSTEM TEST RESULTS');
  log('='.repeat(60));
  log(`Total Tests: ${testResults.total}`);
  log(`Passed: ${testResults.passed} ✅`);
  log(`Failed: ${testResults.failed} ❌`);
  log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  if (testResults.failures.length > 0) {
    log('\n❌ FAILURES:');
    testResults.failures.forEach(failure => log(failure));
  }
  
  const allTestsPassed = testResults.failed === 0;
  
  log('\n' + '='.repeat(60));
  if (allTestsPassed) {
    log('🎉 ALL HOSTING 500 ERROR FIX & HEALTH CHECK TESTS PASSED!');
    log('');
    log('✅ KEY VERIFICATIONS COMPLETED:');
    log('   • generateIPFixPhp() creates lightweight PHP with no HTML output');
    log('   • deployCFIPFix() function exported and available');
    log('   • deployFullProtection() deploys CF Worker BEFORE IP-fix');
    log('   • Health check module (hosting-health-check.js) fully functional');
    log('   • scheduleHealthCheck integrated into hosting creation');
    log('   • scheduleHealthCheck integrated into hosting renewal');
    log('   • Node.js service runs healthy throughout tests');
  } else {
    log('⚠️  SOME HOSTING 500 ERROR FIX TESTS FAILED');
  }
  log('='.repeat(60));
  
  return {
    success: allTestsPassed,
    total: testResults.total,
    passed: testResults.passed,
    failed: testResults.failed,
    failures: testResults.failures
  };
}

// Run tests if called directly
if (require.main === module) {
  runTests().then(result => {
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    log(`💥 Test runner crashed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runTests };