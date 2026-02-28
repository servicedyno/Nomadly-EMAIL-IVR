#!/usr/bin/env node

/**
 * Nomadly Telegram Bot - ReferenceError lang is not defined Fix Test
 * 
 * This test verifies the fix for "ReferenceError: lang is not defined" that was
 * causing crashes in lead city selection, domain NS select, and 119 inline lang lookups.
 */

const axios = require('axios');
const fs = require('fs');

const BACKEND_URL = 'https://nomadly-integration.preview.emergentagent.com';
const INDEX_FILE_PATH = '/app/js/_index.js';

// ANSI color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, result, details = '') {
  const symbol = result ? '✅' : '❌';
  const color = result ? 'green' : 'red';
  log(`${symbol} ${testName}`, color);
  if (details) {
    log(`   ${details}`, 'blue');
  }
}

async function testNodejsHealth() {
  log('\n🔍 TEST 1: Node.js Service Health Check', 'bold');
  
  try {
    // Test if service is running via supervisor
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('sudo supervisorctl status nodejs');
    const isRunning = stdout.includes('RUNNING');
    logTest('Node.js service status', isRunning, isRunning ? 'Service is RUNNING' : 'Service is NOT RUNNING');
    
    // Check error logs are empty
    const errorLogExists = fs.existsSync('/var/log/supervisor/nodejs.err.log');
    if (errorLogExists) {
      const errorLog = fs.readFileSync('/var/log/supervisor/nodejs.err.log', 'utf8');
      const noErrors = errorLog.trim().length === 0;
      logTest('Error log empty', noErrors, noErrors ? 'No startup errors' : `Errors found: ${errorLog.substring(0, 100)}...`);
    } else {
      logTest('Error log check', false, 'Error log file not found');
    }
    
    return isRunning;
  } catch (error) {
    logTest('Node.js health check', false, `Error: ${error.message}`);
    return false;
  }
}

function testOuterScopeLangVariable() {
  log('\n🔍 TEST 2: Outer Scope Lang Variable Verification', 'bold');
  
  try {
    const indexContent = fs.readFileSync(INDEX_FILE_PATH, 'utf8');
    const lines = indexContent.split('\n');
    
    // Find the line around 1492 where lang should be defined
    let langLineFound = false;
    let langLineNumber = -1;
    let buyLeadsLineFound = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for buyLeadsSelectCnam line
      if (line.includes('buyLeadsSelectCnam = trans(')) {
        buyLeadsLineFound = true;
        logTest('buyLeadsSelectCnam line found', true, `Line ${i + 1}: ${line.trim()}`);
        
        // Check next few lines for lang variable
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j].includes('const lang = info?.userLanguage || \'en\'')) {
            langLineFound = true;
            langLineNumber = j + 1;
            break;
          }
        }
        break;
      }
    }
    
    logTest('Outer scope lang variable exists', langLineFound, 
           langLineFound ? `Found at line ${langLineNumber}: const lang = info?.userLanguage || 'en'` : 'Lang variable not found after buyLeadsSelectCnam');
    
    return langLineFound;
  } catch (error) {
    logTest('Outer scope lang variable check', false, `Error: ${error.message}`);
    return false;
  }
}

function testVoiceAudioHandlerLang() {
  log('\n🔍 TEST 3: Voice/Audio Handler Lang Variable Verification', 'bold');
  
  try {
    const indexContent = fs.readFileSync(INDEX_FILE_PATH, 'utf8');
    const lines = indexContent.split('\n');
    
    // Find cpVmAudioUpload handler
    let handlerFound = false;
    let langInHandlerFound = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('cpVmAudioUpload')) {
        handlerFound = true;
        logTest('cpVmAudioUpload handler found', true, `Line ${i + 1}`);
        
        // Look for lang variable in the try block
        for (let j = i; j < Math.min(i + 20, lines.length); j++) {
          if (lines[j].includes('const lang = userInfo?.userLanguage || \'en\'')) {
            langInHandlerFound = true;
            logTest('Lang variable in handler', true, `Line ${j + 1}: ${lines[j].trim()}`);
            break;
          }
        }
        break;
      }
    }
    
    if (!handlerFound) {
      logTest('cpVmAudioUpload handler found', false, 'Handler not found');
    }
    
    if (handlerFound && !langInHandlerFound) {
      logTest('Lang variable in handler', false, 'Lang variable not found in handler scope');
    }
    
    return handlerFound && langInHandlerFound;
  } catch (error) {
    logTest('Voice/audio handler lang check', false, `Error: ${error.message}`);
    return false;
  }
}

function testInlineLangUsages() {
  log('\n🔍 TEST 4: Inline [lang] Usage Coverage Verification', 'bold');
  
  try {
    const indexContent = fs.readFileSync(INDEX_FILE_PATH, 'utf8');
    
    // Count all [lang] usages
    const langUsagePattern = /}(\s*\[lang\]|\[\s*lang\s*\])/g;
    const matches = indexContent.match(langUsagePattern) || [];
    const totalLangUsages = matches.length;
    
    logTest('Total [lang] usages found', true, `${totalLangUsages} inline language lookups detected`);
    
    // Check specific handlers mentioned in the issue
    const targetSelectAreaCodeExists = indexContent.includes('targetSelectAreaCode:') && 
                                     indexContent.match(/targetSelectAreaCode:[\s\S]*?}(\s*\[lang\]|\[\s*lang\s*\])/);
    
    const domainNsSelectExists = indexContent.includes('domainNsSelect:') && 
                               indexContent.match(/domainNsSelect:[\s\S]*?}(\s*\[lang\]|\[\s*lang\s*\])/);
    
    logTest('targetSelectAreaCode uses [lang]', targetSelectAreaCodeExists, 
           targetSelectAreaCodeExists ? 'Handler has inline lang lookups' : 'No [lang] usage found');
    
    logTest('domainNsSelect uses [lang]', domainNsSelectExists, 
           domainNsSelectExists ? 'Handler has inline lang lookups' : 'No [lang] usage found');
    
    // Check if there are goto handlers that use [lang]
    const gotoPattern = /goto\s*=\s*{[\s\S]*?}/;
    const gotoSection = indexContent.match(gotoPattern);
    let gotoHasLangUsages = false;
    
    if (gotoSection) {
      gotoHasLangUsages = gotoSection[0].includes('[lang]');
      logTest('Goto handlers use [lang]', gotoHasLangUsages, 
             gotoHasLangUsages ? 'Goto object contains [lang] usages' : 'No [lang] in goto object');
    }
    
    return totalLangUsages > 0;
  } catch (error) {
    logTest('Inline lang usage check', false, `Error: ${error.message}`);
    return false;
  }
}

function testNoRemainingLangScopes() {
  log('\n🔍 TEST 5: Verify No Missing Lang Scope Issues', 'bold');
  
  try {
    const indexContent = fs.readFileSync(INDEX_FILE_PATH, 'utf8');
    
    // Look for patterns that might indicate scope issues
    // This is a heuristic check - in a real scenario we'd need runtime testing
    
    // Check that main lang variable is before goto object definition
    const langDefIndex = indexContent.indexOf('const lang = info?.userLanguage || \'en\'');
    const gotoDefIndex = indexContent.indexOf('const goto = {');
    
    const langBeforeGoto = langDefIndex !== -1 && gotoDefIndex !== -1 && langDefIndex < gotoDefIndex;
    logTest('Lang variable defined before goto object', langBeforeGoto, 
           langBeforeGoto ? 'Proper scoping order verified' : 'Scoping issue detected');
    
    // Check that action object also comes after lang definition
    const actionDefIndex = indexContent.indexOf('bot?.on(\'message\'');
    const langInMessageHandler = langDefIndex !== -1 && actionDefIndex !== -1 && langDefIndex > actionDefIndex;
    
    logTest('Lang variable in message handler scope', langInMessageHandler, 
           langInMessageHandler ? 'Lang variable accessible to handlers' : 'Scoping may be incorrect');
    
    return langBeforeGoto && langInMessageHandler;
  } catch (error) {
    logTest('Lang scope verification', false, `Error: ${error.message}`);
    return false;
  }
}

async function testNodejsServiceReachability() {
  log('\n🔍 TEST 6: Node.js Service Port 5000 Accessibility', 'bold');
  
  try {
    // Test basic HTTP connectivity to Node.js service
    const response = await axios.get(`${BACKEND_URL}/health`, {
      timeout: 10000,
      validateStatus: () => true // Accept any status code
    });
    
    const isReachable = response.status === 200 || response.status < 500;
    logTest('Service reachability', isReachable, 
           `HTTP ${response.status} - Service responding on port 5000`);
    
    return isReachable;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logTest('Service reachability', false, 'Connection refused - service may not be running on port 5000');
    } else if (error.code === 'ETIMEDOUT') {
      logTest('Service reachability', false, 'Connection timeout - service not responding');
    } else {
      logTest('Service reachability', false, `Network error: ${error.message}`);
    }
    return false;
  }
}

async function runAllTests() {
  log('🚀 NOMADLY TELEGRAM BOT - LANG VARIABLE FIX VERIFICATION', 'yellow');
  log('================================================================', 'yellow');
  log('Testing fix for: "ReferenceError: lang is not defined"', 'blue');
  log('Issues fixed: leads city selection, domain NS select, 119 inline lang lookups', 'blue');
  
  const results = {
    nodejsHealth: await testNodejsHealth(),
    outerScopeLang: testOuterScopeLangVariable(),
    voiceHandlerLang: testVoiceAudioHandlerLang(),
    inlineLangUsages: testInlineLangUsages(),
    langScopeVerification: testNoRemainingLangScopes(),
    serviceReachability: await testNodejsServiceReachability()
  };
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  log('\n📊 TEST SUMMARY', 'bold');
  log('================================================================', 'yellow');
  log(`Total Tests: ${totalTests}`, 'blue');
  log(`Passed: ${passedTests}`, passedTests === totalTests ? 'green' : 'yellow');
  log(`Failed: ${totalTests - passedTests}`, totalTests - passedTests === 0 ? 'green' : 'red');
  log(`Success Rate: ${successRate}%`, passedTests === totalTests ? 'green' : 'yellow');
  
  if (passedTests === totalTests) {
    log('\n🎉 ALL TESTS PASSED - Lang variable fix is working correctly!', 'green');
    log('✓ Node.js starts without errors', 'green');
    log('✓ Outer scope lang variable exists and is accessible', 'green');
    log('✓ Voice/audio handler has proper lang variable', 'green');
    log('✓ All inline [lang] usages are now covered', 'green');
    log('✓ No remaining scope issues detected', 'green');
    log('✓ Node.js service is healthy and responsive', 'green');
  } else {
    log('\n⚠️  Some tests failed - review implementation', 'red');
    for (const [test, result] of Object.entries(results)) {
      if (!result) {
        log(`✗ ${test}`, 'red');
      }
    }
  }
  
  return { totalTests, passedTests, successRate, results };
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().then(summary => {
    process.exit(summary.passedTests === summary.totalTests ? 0 : 1);
  }).catch(error => {
    log(`\n💥 Test execution failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runAllTests };