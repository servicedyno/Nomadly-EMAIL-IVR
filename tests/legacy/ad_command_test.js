#!/usr/bin/env node

/**
 * Test for /ad command and admin menu commands registration
 * Tests all requirements from the review request
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 TESTING: /ad command fixes and admin menu commands registration');
console.log('=' .repeat(80));

let testsPassed = 0;
let testsTotal = 0;

function test(description, testFn) {
  testsTotal++;
  try {
    const result = testFn();
    if (result) {
      console.log(`✅ TEST ${testsTotal}: ${description}`);
      testsPassed++;
    } else {
      console.log(`❌ TEST ${testsTotal}: ${description}`);
    }
  } catch (error) {
    console.log(`❌ TEST ${testsTotal}: ${description} - ERROR: ${error.message}`);
  }
}

// 1. NODE.JS HEALTH: Verify service is running healthy on port 5000 with database connected
test('Node.js service running healthy on port 5000 with database connected', () => {
  const { execSync } = require('child_process');
  
  // Check supervisor status
  const supervisorStatus = execSync('sudo supervisorctl status nodejs', { encoding: 'utf8' });
  const isNodejsRunning = supervisorStatus.includes('RUNNING');
  
  // Check for database connection in logs
  const nodeLogPath = '/var/log/supervisor/nodejs.out.log';
  const logContent = fs.readFileSync(nodeLogPath, 'utf8');
  const hasDatabaseConnection = logContent.includes('DB Connected') || logContent.includes('MongoDB connection pool ready');
  
  console.log(`   📊 Node.js status: ${isNodejsRunning ? 'RUNNING' : 'NOT RUNNING'}`);
  console.log(`   📊 Database connected: ${hasDatabaseConnection ? 'YES' : 'NO'}`);
  
  return isNodejsRunning && hasDatabaseConnection;
});

// 2. /AD COMMAND FIX: Verify that both /ad handlers use translation('l.serviceAd', 'en') NOT trans('l.serviceAd')
test('/ad and /ad post commands use correct translation function', () => {
  const indexPath = '/app/js/_index.js';
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // Find both /ad handlers
  const adHandlerMatch = indexContent.match(/if \(isAdmin\(chatId\) && message === '\/ad'\) \{[\s\S]*?return\s*\}/);
  const adPostHandlerMatch = indexContent.match(/if \(isAdmin\(chatId\) && message === '\/ad post'\) \{[\s\S]*?return\s*\}/);
  
  if (!adHandlerMatch || !adPostHandlerMatch) {
    console.log('   ❌ Could not find /ad or /ad post handlers');
    return false;
  }
  
  const adHandlerCode = adHandlerMatch[0];
  const adPostHandlerCode = adPostHandlerMatch[0];
  
  // Check that both use translation() not trans()
  const usesTranslationInAd = adHandlerCode.includes("translation('l.serviceAd', 'en')");
  const usesTranslationInAdPost = adPostHandlerCode.includes("translation('l.serviceAd', 'en')");
  
  // Check that neither uses trans()
  const usesTransInAd = adHandlerCode.includes("trans('l.serviceAd')");
  const usesTransInAdPost = adPostHandlerCode.includes("trans('l.serviceAd')");
  
  console.log(`   📊 /ad handler uses translation(): ${usesTranslationInAd ? 'YES' : 'NO'}`);
  console.log(`   📊 /ad post handler uses translation(): ${usesTranslationInAdPost ? 'YES' : 'NO'}`);
  console.log(`   📊 /ad handler uses trans(): ${usesTransInAd ? 'YES' : 'NO'} (should be NO)`);
  console.log(`   📊 /ad post handler uses trans(): ${usesTransInAdPost ? 'YES' : 'NO'} (should be NO)`);
  
  return usesTranslationInAd && usesTranslationInAdPost && !usesTransInAd && !usesTransInAdPost;
});

// 3. TRANSLATION KEY EXISTS: Verify that l.serviceAd is a valid translation key
test('Translation key l.serviceAd exists in js/lang/en.js', () => {
  const langPath = '/app/js/lang/en.js';
  const langContent = fs.readFileSync(langPath, 'utf8');
  
  // Check if serviceAd key exists in the l object
  const hasServiceAdKey = langContent.includes('serviceAd:');
  
  // More specific check - look for the l object and serviceAd inside it
  const lObjectMatch = langContent.match(/const l = \{[\s\S]*?\}/);
  let serviceAdInLObject = false;
  
  if (lObjectMatch) {
    serviceAdInLObject = lObjectMatch[0].includes('serviceAd:');
  }
  
  console.log(`   📊 serviceAd key found: ${hasServiceAdKey ? 'YES' : 'NO'}`);
  console.log(`   📊 serviceAd in l object: ${serviceAdInLObject ? 'YES' : 'NO'}`);
  
  return hasServiceAdKey && serviceAdInLObject;
});

// 4. SETMYCOMMANDS: Verify bot.setMyCommands is called correctly for default and admin commands
test('Bot commands registration - default and admin commands', () => {
  const indexPath = '/app/js/_index.js';
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // Find setupTelegramWebhook function
  const setupWebhookMatch = indexContent.match(/const setupTelegramWebhook = async \(\) => \{[\s\S]*?\n\}/);
  
  if (!setupWebhookMatch) {
    console.log('   ❌ Could not find setupTelegramWebhook function');
    return false;
  }
  
  const setupWebhookCode = setupWebhookMatch[0];
  
  // Check for default commands (start, testsip)
  const hasDefaultCommands = setupWebhookCode.includes("{ command: 'start'") && 
                            setupWebhookCode.includes("{ command: 'testsip'");
  
  // Check for admin commands (ad, orders, requests, credit, reply, close, deliver)
  const adminCommands = ['ad', 'orders', 'requests', 'credit', 'reply', 'close', 'deliver'];
  const hasAllAdminCommands = adminCommands.every(cmd => 
    setupWebhookCode.includes(`{ command: '${cmd}'`)
  );
  
  // Check for proper scoping of admin commands
  const hasProperScope = setupWebhookCode.includes('scope: JSON.stringify({ type: \'chat\', chat_id: adminChatId })');
  
  console.log(`   📊 Default commands (start, testsip): ${hasDefaultCommands ? 'YES' : 'NO'}`);
  console.log(`   📊 All admin commands present: ${hasAllAdminCommands ? 'YES' : 'NO'}`);
  console.log(`   📊 Admin commands properly scoped: ${hasProperScope ? 'YES' : 'NO'}`);
  
  return hasDefaultCommands && hasAllAdminCommands && hasProperScope;
});

// 5. STARTUP LOGS: Check for registration messages
test('Startup logs contain bot commands registration messages', () => {
  const nodeLogPath = '/var/log/supervisor/nodejs.out.log';
  const logContent = fs.readFileSync(nodeLogPath, 'utf8');
  
  const hasDefaultMessage = logContent.includes('Default bot commands registered');
  const hasAdminMessage = logContent.includes('Admin bot commands registered for chat 5590563715');
  
  console.log(`   📊 "Default bot commands registered" found: ${hasDefaultMessage ? 'YES' : 'NO'}`);
  console.log(`   📊 "Admin bot commands registered for chat 5590563715" found: ${hasAdminMessage ? 'YES' : 'NO'}`);
  
  return hasDefaultMessage && hasAdminMessage;
});

// 6. NO ERRORS: Check error logs are empty or have no critical errors
test('No critical errors in nodejs.err.log', () => {
  const nodeErrLogPath = '/var/log/supervisor/nodejs.err.log';
  
  let errLogContent = '';
  try {
    errLogContent = fs.readFileSync(nodeErrLogPath, 'utf8');
  } catch (error) {
    // If log file doesn't exist or is empty, that's good
    console.log('   📊 Error log: EMPTY (no critical errors)');
    return true;
  }
  
  const isEmpty = errLogContent.trim() === '';
  console.log(`   📊 Error log empty: ${isEmpty ? 'YES' : 'NO'}`);
  
  if (!isEmpty) {
    const lines = errLogContent.split('\n').filter(line => line.trim());
    console.log(`   📊 Error log has ${lines.length} lines`);
    // Show first few lines if any
    if (lines.length > 0) {
      console.log(`   📊 Sample errors: ${lines.slice(0, 3).join(' | ')}`);
    }
  }
  
  return isEmpty;
});

// 7. Translation function import verification
test('Translation function is properly imported at module level', () => {
  const indexPath = '/app/js/_index.js';
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // Check for translation import at line 191
  const hasTranslationImport = indexContent.includes("const { translation } = require('./translation.js')");
  
  // Find the line number of the import
  const lines = indexContent.split('\n');
  let importLineNum = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("const { translation } = require('./translation.js')")) {
      importLineNum = i + 1;
      break;
    }
  }
  
  console.log(`   📊 Translation function imported: ${hasTranslationImport ? 'YES' : 'NO'}`);
  console.log(`   📊 Import found at line: ${importLineNum > 0 ? importLineNum : 'NOT FOUND'}`);
  
  return hasTranslationImport && importLineNum > 0;
});

// 8. Temporal Dead Zone verification - trans function defined later
test('Trans function defined after /ad handlers (temporal dead zone fix)', () => {
  const indexPath = '/app/js/_index.js';
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  const lines = indexContent.split('\n');
  
  // Find line numbers
  let adHandlerLine = -1;
  let adPostHandlerLine = -1;
  let transDefinitionLine = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("message === '/ad'") && !lines[i].includes("post")) {
      adHandlerLine = i + 1;
    }
    if (lines[i].includes("message === '/ad post'")) {
      adPostHandlerLine = i + 1;
    }
    if (lines[i].includes("const trans = (key, ...args) => {")) {
      transDefinitionLine = i + 1;
    }
  }
  
  const temporalIssueFixed = transDefinitionLine > adHandlerLine && transDefinitionLine > adPostHandlerLine;
  
  console.log(`   📊 /ad handler at line: ${adHandlerLine}`);
  console.log(`   📊 /ad post handler at line: ${adPostHandlerLine}`);
  console.log(`   📊 trans function defined at line: ${transDefinitionLine}`);
  console.log(`   📊 Temporal dead zone fixed: ${temporalIssueFixed ? 'YES' : 'NO'}`);
  
  return temporalIssueFixed;
});

console.log('\n' + '='.repeat(80));
console.log(`📊 SUMMARY: ${testsPassed}/${testsTotal} tests passed`);

if (testsPassed === testsTotal) {
  console.log('✅ ALL TESTS PASSED - /ad command fix and admin menu commands are working correctly!');
} else {
  console.log('❌ SOME TESTS FAILED - Check the failing tests above');
}

console.log('='.repeat(80));