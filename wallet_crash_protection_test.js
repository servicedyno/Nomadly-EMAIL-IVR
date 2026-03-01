// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Domain Purchase + Hosting Renewal Wallet Crash Protection Testing
// Testing: Try/catch wrappers with auto-refund for wallet protection
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const axios = require('axios')
const fs = require('fs')
const path = require('path')

// Test Configuration
const BASE_URL = 'http://localhost:5000'

// Test Results Storage
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
}

// Utility Functions
function log(message) {
  console.log(`[TEST] ${message}`)
}

function logError(message) {
  console.log(`[ERROR] ${message}`)
  testResults.errors.push(message)
}

async function logTest(testName, passed, details = '') {
  testResults.total++
  if (passed) {
    testResults.passed++
    log(`✅ ${testName} - PASSED ${details}`)
  } else {
    testResults.failed++
    logError(`❌ ${testName} - FAILED ${details}`)
  }
}

// Read and analyze _index.js file for code patterns
function analyzeCodePatterns() {
  const indexJsPath = '/app/js/_index.js'
  
  try {
    const content = fs.readFileSync(indexJsPath, 'utf8')
    return content
  } catch (error) {
    logError(`Failed to read _index.js: ${error.message}`)
    return null
  }
}

// TEST 1: HEALTH CHECK
async function testHealthCheck() {
  log('=== TEST 1: HEALTH CHECK ===')
  
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 10000 })
    
    await logTest('Health Endpoint Response', 
      response.status === 200,
      `Status: ${response.status}`)
    
    const data = response.data
    await logTest('Health Status', 
      data.status === 'healthy',
      `Status: ${data.status}`)
    
    await logTest('Database Connection', 
      data.database === 'connected',
      `Database: ${data.database}`)
    
  } catch (error) {
    await logTest('Health Check', false, `Error: ${error.message}`)
  }
}

// TEST 2: ERROR LOG VERIFICATION
async function testErrorLogs() {
  log('=== TEST 2: ERROR LOG VERIFICATION ===')
  
  try {
    const errorLogPath = '/var/log/supervisor/nodejs.err.log'
    const stats = fs.statSync(errorLogPath)
    
    await logTest('Error Log Exists', 
      fs.existsSync(errorLogPath),
      `Path: ${errorLogPath}`)
    
    await logTest('Error Log Empty', 
      stats.size === 0,
      `Size: ${stats.size} bytes`)
    
  } catch (error) {
    await logTest('Error Log Check', false, `Error: ${error.message}`)
  }
}

// TEST 3: DOMAIN PURCHASE FLOW ANALYSIS
async function testDomainPurchaseFlow() {
  log('=== TEST 3: DOMAIN PURCHASE FLOW ANALYSIS ===')
  
  const content = analyzeCodePatterns()
  if (!content) {
    await logTest('Code Analysis', false, 'Could not read _index.js file')
    return
  }
  
  // Check around line 3573 for domain-pay handler
  const domainPayPattern = /'domain-pay':\s*async\s+coin\s*=>\s*{[\s\S]*?}/
  const domainPayMatch = content.match(domainPayPattern)
  
  await logTest('Domain Pay Handler Found', 
    content.includes("'domain-pay': async coin =>"),
    'Located domain-pay handler in code')
  
  // Verify try/catch wrapper exists around buyDomainFullProcess
  const hasTryBuyDomain = /try\s*{[\s\S]*buyDomainFullProcess[\s\S]*}\s*catch\s*\(\s*domainErr\s*\)/.test(content)
  await logTest('Domain Purchase Try/Catch Wrapper', 
    hasTryBuyDomain,
    'Try/catch block wraps buyDomainFullProcess() with domainErr parameter')
  
  // Check buyDomainFullProcess is inside try block (line 3592)
  const buyDomainInTry = content.includes('const error = await buyDomainFullProcess(chatId, lang, domain)')
  await logTest('BuyDomainFullProcess in Try Block', 
    buyDomainInTry,
    'buyDomainFullProcess() call is inside try block at line 3592')
  
  // Check wallet deduction AFTER buyDomainFullProcess (lines 3597-3604)
  const walletAfterBuy = /buyDomainFullProcess[\s\S]*?if \(error\) return[\s\S]*?atomicIncrement[\s\S]*Out/.test(content)
  await logTest('Wallet Deduction After Purchase', 
    walletAfterBuy,
    'Wallet deduction happens AFTER successful domain purchase (after error check)')
  
  // Check catch block with domainErr parameter (line 3613)
  const hasDomainErrCatch = content.includes('catch (domainErr)')
  await logTest('Domain Catch Block', 
    hasDomainErrCatch,
    'Catch block uses domainErr parameter')
  
  // Check for crash logging with [Domain] prefix (line 3614)
  const hasCrashLogging = content.includes('[Domain] Purchase crashed')
  await logTest('Domain Crash Logging', 
    hasCrashLogging,
    'Catch block logs with "[Domain] Purchase crashed" prefix')
  
  // Check for user failure message (line 3615)
  const hasUserMessage = content.includes('t.purchaseFailed || \'❌ Domain purchase failed')
  await logTest('Domain User Failure Message', 
    hasUserMessage,
    'Sends user failure message (t.purchaseFailed or fallback)')
  
  // Check for admin alert to TELEGRAM_ADMIN_CHAT_ID (line 3616)
  const hasAdminAlert = /send\(TELEGRAM_ADMIN_CHAT_ID,.*Domain purchase crash/.test(content)
  await logTest('Domain Admin Alert', 
    hasAdminAlert,
    'Sends admin alert to TELEGRAM_ADMIN_CHAT_ID with crash details')
}

// TEST 4: HOSTING RENEWAL FLOW ANALYSIS  
async function testHostingRenewalFlow() {
  log('=== TEST 4: HOSTING RENEWAL FLOW ANALYSIS ===')
  
  const content = analyzeCodePatterns()
  if (!content) {
    await logTest('Code Analysis', false, 'Could not read _index.js file')
    return
  }
  
  // Find confirmRenewNow handler around line 5024
  const hasConfirmRenewNow = content.includes('if (action === a.confirmRenewNow)')
  await logTest('Hosting Renewal Handler Found', 
    hasConfirmRenewNow,
    'Located confirmRenewNow handler')
  
  // Check for try block around line 5042 
  const hasTryBlock = content.includes('// Deduct from wallet and extend expiry — protected with auto-refund\n      try {')
  await logTest('Hosting Try Block Found', 
    hasTryBlock,
    'Found try block with auto-refund comment')
  
  // Check wallet deduction is inside try block (line 5043)
  const walletInTry = /try\s*{[\s\S]*await atomicIncrement\(walletOf, chatId, 'usdOut', price\)/.test(content)
  await logTest('Hosting Wallet Deduction in Try', 
    walletInTry,
    'Wallet deduction (atomicIncrement...usdOut) is inside try block')
  
  // Check DB update is inside same try block (lines 5051-5062)
  const dbUpdateInTry = /try\s*{[\s\S]*await cpanelAccounts\.updateOne/.test(content)
  await logTest('Hosting DB Update in Try', 
    dbUpdateInTry,
    'DB update (cpanelAccounts.updateOne) is inside same try block')
  
  // Check catch block has auto-refund (line 5097-5100)
  const hasAutoRefund = content.includes('} catch (renewErr) {\n        // Auto-refund on failure')
  await logTest('Hosting Auto-Refund', 
    hasAutoRefund,
    'Catch block with renewErr parameter and auto-refund comment')
  
  // Check nested try/catch for refund (lines 5099-5102)
  const nestedRefundTryCatch = /try\s*{[\s\S]*await atomicIncrement\(walletOf, chatId, 'usdIn', price\)[\s\S]*} catch \(refundErr\)/.test(content)
  await logTest('Hosting Nested Refund Protection', 
    nestedRefundTryCatch,
    'Refund is wrapped in nested try/catch (refundErr)')
  
  // Check CRITICAL refund failure logging (line 5103)
  const criticalLogging = content.includes('[Hosting] CRITICAL: Refund failed')
  await logTest('Hosting Critical Refund Logging', 
    criticalLogging,
    'On refund failure: logs "CRITICAL: Refund failed"')
  
  // Check admin alert for refund failure (line 5104)
  const refundFailAlert = content.includes('HOSTING RENEWAL REFUND FAILED')
  await logTest('Hosting Refund Fail Alert', 
    refundFailAlert,
    'Admin alert sent with "HOSTING RENEWAL REFUND FAILED" message')
  
  // Check user failure message (line 5107)
  const userFailureMsg = content.includes('❌ Renewal failed. Your wallet has been refunded')
  await logTest('Hosting User Failure Message', 
    userFailureMsg,
    'Sends user failure message when renewal crashes')
  
  // Check admin crash alert (line 5108)
  const adminCrashAlert = content.includes('🚨 <b>Hosting renewal crash</b>')
  await logTest('Hosting Admin Crash Alert', 
    adminCrashAlert,
    'Sends admin crash alert with renewal details')
}

// TEST 5: COMPREHENSIVE PATTERN VERIFICATION
async function testComprehensivePatterns() {
  log('=== TEST 5: COMPREHENSIVE PATTERN VERIFICATION ===')
  
  const content = analyzeCodePatterns()
  if (!content) {
    await logTest('Code Analysis', false, 'Could not read _index.js file')
    return
  }
  
  // Count all try/catch blocks for wallet operations
  const tryCatchCount = (content.match(/try\s*{[\s\S]*?atomicIncrement[\s\S]*?}\s*catch/g) || []).length
  await logTest('Wallet Try/Catch Coverage', 
    tryCatchCount >= 2,
    `Found ${tryCatchCount} try/catch blocks around wallet operations`)
  
  // Check for TELEGRAM_ADMIN_CHAT_ID usage in error scenarios
  const adminAlertCount = (content.match(/TELEGRAM_ADMIN_CHAT_ID/g) || []).length
  await logTest('Admin Alert Coverage', 
    adminAlertCount >= 2,
    `Found ${adminAlertCount} admin alert notifications`)
  
  // Verify log patterns for error tracking
  const errorLogPatterns = [
    /\[Domain\].*crashed/,
    /\[Hosting\].*crashed/,
    /\[Hosting\].*CRITICAL/
  ]
  
  const errorLogCount = errorLogPatterns.reduce((count, pattern) => {
    return count + (pattern.test(content) ? 1 : 0)
  }, 0)
  
  await logTest('Error Log Patterns', 
    errorLogCount >= 3,
    `Found ${errorLogCount}/3 required error logging patterns`)
  
  // Check for proper error parameter naming
  const hasProperErrorNames = /catch\s*\([^)]*domainErr[^)]*\)/.test(content) && 
                              /catch\s*\([^)]*renewErr[^)]*\)/.test(content) &&
                              /catch\s*\([^)]*refundErr[^)]*\)/.test(content)
  
  await logTest('Error Parameter Naming', 
    hasProperErrorNames,
    'Proper error parameter names: domainErr, renewErr, refundErr')
}

// Main Test Runner
async function runAllTests() {
  log('🚀 Starting Domain Purchase + Hosting Renewal Wallet Crash Protection Testing')
  log('=' .repeat(80))
  
  // Run test suites in order
  await testHealthCheck()
  await testErrorLogs()
  await testDomainPurchaseFlow() 
  await testHostingRenewalFlow()
  await testComprehensivePatterns()
  
  // Print summary
  log('=' .repeat(80))
  log('🏁 WALLET CRASH PROTECTION TEST SUMMARY')
  log(`Total Tests: ${testResults.total}`)
  log(`✅ Passed: ${testResults.passed}`)
  log(`❌ Failed: ${testResults.failed}`)
  log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`)
  
  if (testResults.errors.length > 0) {
    log('\n🔍 ERRORS ENCOUNTERED:')
    testResults.errors.forEach((error, index) => {
      log(`${index + 1}. ${error}`)
    })
  }
  
  log('\nTesting completed!')
  
  // Return results for integration with testing framework
  return {
    total: testResults.total,
    passed: testResults.passed,
    failed: testResults.failed,
    errors: testResults.errors,
    success: testResults.failed === 0
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    logError(`Test execution failed: ${error.message}`)
    console.error(error)
    process.exit(1)
  })
}

module.exports = {
  runAllTests,
  testResults
}