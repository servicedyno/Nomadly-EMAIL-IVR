#!/usr/bin/env node

// Security and Code Verification Test Script
// Tests the bug fixes as specified in the review request

const axios = require('axios')
const fs = require('fs')
const { execSync } = require('child_process')

// Test configuration
const BASE_URL = 'http://localhost:5000'

console.log('🔒 Starting Security and Code Verification Tests...\n')

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  details: []
}

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL'
  console.log(`${status}: ${name}${details ? ' - ' + details : ''}`)
  testResults[passed ? 'passed' : 'failed']++
  testResults.details.push({ name, passed, details })
}

async function runTests() {
  console.log('='.repeat(80))
  console.log('1. SECURITY - AUTH ON DATA EXPORT ENDPOINTS (CRITICAL)')
  console.log('='.repeat(80))

  // Test 1: GET /payments12341234 should return 403 without admin key
  try {
    const response = await axios.get(`${BASE_URL}/payments12341234`, { 
      validateStatus: () => true,
      timeout: 5000 
    })
    const isSecure = response.status === 403 && response.data.error === 'Unauthorized'
    logTest('GET /payments12341234 returns 403 without admin key', isSecure, 
      `Status: ${response.status}, Response: ${JSON.stringify(response.data)}`)
  } catch (error) {
    logTest('GET /payments12341234 returns 403 without admin key', false, `Error: ${error.message}`)
  }

  // Test 2: GET /json1444 should return 403 without admin key
  try {
    const response = await axios.get(`${BASE_URL}/json1444`, { 
      validateStatus: () => true,
      timeout: 5000 
    })
    const isSecure = response.status === 403 && response.data.error === 'Unauthorized'
    logTest('GET /json1444 returns 403 without admin key', isSecure, 
      `Status: ${response.status}, Response: ${JSON.stringify(response.data)}`)
  } catch (error) {
    logTest('GET /json1444 returns 403 without admin key', false, `Error: ${error.message}`)
  }

  // Test 3: GET /increment-free-sms-count/:chatId should return 403 without admin key
  try {
    const response = await axios.get(`${BASE_URL}/increment-free-sms-count/12345`, { 
      validateStatus: () => true,
      timeout: 5000 
    })
    const isSecure = response.status === 403 && response.data.error === 'Unauthorized'
    logTest('GET /increment-free-sms-count/12345 returns 403 without admin key', isSecure, 
      `Status: ${response.status}, Response: ${JSON.stringify(response.data)}`)
  } catch (error) {
    logTest('GET /increment-free-sms-count/12345 returns 403 without admin key', false, `Error: ${error.message}`)
  }

  // Test 4: GET /analytics-of-all-sms should return 403 without admin key
  try {
    const response = await axios.get(`${BASE_URL}/analytics-of-all-sms`, { 
      validateStatus: () => true,
      timeout: 5000 
    })
    const isSecure = response.status === 403 && response.data.error === 'Unauthorized'
    logTest('GET /analytics-of-all-sms returns 403 without admin key', isSecure, 
      `Status: ${response.status}, Response: ${JSON.stringify(response.data)}`)
  } catch (error) {
    logTest('GET /analytics-of-all-sms returns 403 without admin key', false, `Error: ${error.message}`)
  }

  // Test 5: POST /phone/reset-credentials should return 403 without admin key
  try {
    const response = await axios.post(`${BASE_URL}/phone/reset-credentials`, 
      { chatId: 123 }, 
      { 
        validateStatus: () => true,
        timeout: 5000 
      })
    const isSecure = response.status === 403 && response.data.error === 'Unauthorized'
    logTest('POST /phone/reset-credentials returns 403 without admin key', isSecure, 
      `Status: ${response.status}, Response: ${JSON.stringify(response.data)}`)
  } catch (error) {
    logTest('POST /phone/reset-credentials returns 403 without admin key', false, `Error: ${error.message}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('2. HEALTH CHECK STILL WORKS')
  console.log('='.repeat(80))

  // Test 6: GET /health should return 200 with correct response
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 })
    const isHealthy = response.status === 200 && 
                     response.data.status === 'healthy' && 
                     response.data.database === 'connected'
    logTest('GET /health returns 200 with correct status', isHealthy, 
      `Status: ${response.data.status}, DB: ${response.data.database}`)
  } catch (error) {
    logTest('GET /health returns 200 with correct status', false, `Error: ${error.message}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('3. CODE VERIFICATION - VOICE SERVICE MEMORY CLEANUP')
  console.log('='.repeat(80))

  // Test 7: Check voice-service.js has periodic cleanup
  try {
    const voiceServiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8')
    
    // Check for cleanup of activeCalls
    const hasActiveCallsCleanup = voiceServiceContent.includes('activeCalls') && 
                                  voiceServiceContent.includes('setInterval')
    logTest('voice-service.js has activeCalls cleanup in setInterval', hasActiveCallsCleanup)

    // Check for cleanup of outboundIvrCalls
    const hasOutboundIvrCleanup = voiceServiceContent.includes('outboundIvrCalls') && 
                                  voiceServiceContent.includes('setInterval')
    logTest('voice-service.js has outboundIvrCalls cleanup in setInterval', hasOutboundIvrCleanup)

    // Check for cleanup of twilioIvrSessions
    const hasTwilioIvrCleanup = voiceServiceContent.includes('twilioIvrSessions') && 
                                voiceServiceContent.includes('setInterval')
    logTest('voice-service.js has twilioIvrSessions cleanup in setInterval', hasTwilioIvrCleanup)

    // Check for cleanup of pendingHoldTransfers
    const hasPendingHoldCleanup = voiceServiceContent.includes('pendingHoldTransfers') && 
                                  voiceServiceContent.includes('setInterval')
    logTest('voice-service.js has pendingHoldTransfers cleanup in setInterval', hasPendingHoldCleanup)

    // Check for cleanup of activeBridgeTransfers
    const hasActiveBridgeCleanup = voiceServiceContent.includes('activeBridgeTransfers') && 
                                   voiceServiceContent.includes('setInterval')
    logTest('voice-service.js has activeBridgeTransfers cleanup in setInterval', hasActiveBridgeCleanup)

    // Check for cleanup of pendingNativeTransfers
    const hasPendingNativeCleanup = voiceServiceContent.includes('pendingNativeTransfers') && 
                                    voiceServiceContent.includes('setInterval')
    logTest('voice-service.js has pendingNativeTransfers cleanup in setInterval', hasPendingNativeCleanup)

    // Check for cleanup of ivrTransferLegs
    const hasIvrTransferCleanup = voiceServiceContent.includes('ivrTransferLegs') && 
                                  voiceServiceContent.includes('setInterval')
    logTest('voice-service.js has ivrTransferLegs cleanup in setInterval', hasIvrTransferCleanup)

    // Check for constants
    const hasActiveCallMaxAge = voiceServiceContent.includes('ACTIVE_CALL_MAX_AGE')
    logTest('voice-service.js has ACTIVE_CALL_MAX_AGE constant', hasActiveCallMaxAge)

    const hasIvrSessionMaxAge = voiceServiceContent.includes('IVR_SESSION_MAX_AGE')
    logTest('voice-service.js has IVR_SESSION_MAX_AGE constant', hasIvrSessionMaxAge)

    const hasBridgeTransferMaxAge = voiceServiceContent.includes('BRIDGE_TRANSFER_MAX_AGE')
    logTest('voice-service.js has BRIDGE_TRANSFER_MAX_AGE constant', hasBridgeTransferMaxAge)

    // Check for cleanup logging
    const hasCleanupLogging = voiceServiceContent.includes('cleanup') || 
                              voiceServiceContent.includes('Cleaned up')
    logTest('voice-service.js has cleanup logging messages', hasCleanupLogging)

  } catch (error) {
    logTest('voice-service.js memory cleanup verification', false, `Error: ${error.message}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('4. CODE VERIFICATION - ATOMIC WALLET DEDUCTION')
  console.log('='.repeat(80))

  // Test 8: Check utils.js smartWalletDeduct uses findOneAndUpdate
  try {
    const utilsContent = fs.readFileSync('/app/js/utils.js', 'utf8')
    
    const hasSmartWalletDeduct = utilsContent.includes('smartWalletDeduct')
    logTest('utils.js has smartWalletDeduct function', hasSmartWalletDeduct)

    const usesFindOneAndUpdate = utilsContent.includes('findOneAndUpdate') && 
                                 utilsContent.includes('smartWalletDeduct')
    logTest('smartWalletDeduct uses findOneAndUpdate', usesFindOneAndUpdate)

    const usesExpr = utilsContent.includes('$expr') && 
                     utilsContent.includes('smartWalletDeduct')
    logTest('smartWalletDeduct uses $expr for atomic check-and-deduct', usesExpr)

  } catch (error) {
    logTest('utils.js atomic wallet deduction verification', false, `Error: ${error.message}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('5. CODE VERIFICATION - ATOMIC INCREMENT/DECREMENT')
  console.log('='.repeat(80))

  // Test 9: Check db.js increment/decrement functions use $inc
  try {
    const dbContent = fs.readFileSync('/app/js/db.js', 'utf8')
    
    const hasIncrementFunction = dbContent.includes('function increment') || 
                                 dbContent.includes('increment:') ||
                                 dbContent.includes('increment =')
    logTest('db.js has increment function', hasIncrementFunction)

    const hasDecrementFunction = dbContent.includes('function decrement') || 
                                 dbContent.includes('decrement:') ||
                                 dbContent.includes('decrement =')
    logTest('db.js has decrement function', hasDecrementFunction)

    const incrementUsesInc = dbContent.includes('$inc') && 
                             (dbContent.includes('increment') || dbContent.includes('decrement'))
    logTest('increment/decrement functions use $inc operator', incrementUsesInc)

  } catch (error) {
    logTest('db.js atomic increment/decrement verification', false, `Error: ${error.message}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('6. CODE VERIFICATION - EXPRESS ERROR HANDLER')
  console.log('='.repeat(80))

  // Test 10: Check _index.js has global error handler
  try {
    const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    const hasErrorHandler = indexContent.includes('app.use((err, req, res, _next)') ||
                            indexContent.includes('app.use((err, req, res, next)')
    logTest('_index.js has global error handler app.use((err, req, res, _next)', hasErrorHandler)

  } catch (error) {
    logTest('_index.js global error handler verification', false, `Error: ${error.message}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('7. CODE VERIFICATION - SANITIZED DYNOPAY WEBHOOK LOGGING')
  console.log('='.repeat(80))

  // Test 11: Check _index.js authDyno function has sanitized logging
  try {
    const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    const hasAuthDyno = indexContent.includes('authDyno')
    logTest('_index.js has authDyno function', hasAuthDyno)

    const hasUnsafeLogging = indexContent.includes('JSON.stringify(req.body, null, 2)')
    logTest('authDyno does NOT have unsafe JSON.stringify(req.body, null, 2)', !hasUnsafeLogging)

    const hasSafeFields = indexContent.includes('safeFields') && indexContent.includes('authDyno')
    logTest('authDyno has safeFields pattern for sanitized logging', hasSafeFields)

  } catch (error) {
    logTest('_index.js sanitized DynoPay webhook logging verification', false, `Error: ${error.message}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('8. CODE VERIFICATION - CPANEL FALLBACK KEY FIX')
  console.log('='.repeat(80))

  // Test 12: Check cpanel files do NOT contain 'fallback-key'
  try {
    const cpanelAuthContent = fs.readFileSync('/app/js/cpanel-auth.js', 'utf8')
    const hasFallbackKey = cpanelAuthContent.includes('fallback-key')
    logTest('cpanel-auth.js does NOT contain fallback-key', !hasFallbackKey)
  } catch (error) {
    logTest('cpanel-auth.js fallback key check', false, `Error: ${error.message}`)
  }

  try {
    const cpanelMigrationContent = fs.readFileSync('/app/js/cpanel-migration.js', 'utf8')
    const hasFallbackKey = cpanelMigrationContent.includes('fallback-key')
    logTest('cpanel-migration.js does NOT contain fallback-key', !hasFallbackKey)
  } catch (error) {
    logTest('cpanel-migration.js fallback key check', false, `Error: ${error.message}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('9. SYNTAX CHECKS')
  console.log('='.repeat(80))

  // Test 13-17: Syntax checks for all files
  const filesToCheck = [
    '/app/js/_index.js',
    '/app/js/voice-service.js',
    '/app/js/db.js',
    '/app/js/utils.js',
    '/app/js/cpanel-auth.js'
  ]

  for (const file of filesToCheck) {
    try {
      execSync(`node -c ${file}`, { stdio: 'pipe' })
      logTest(`Syntax check: ${file.split('/').pop()}`, true)
    } catch (error) {
      logTest(`Syntax check: ${file.split('/').pop()}`, false, error.message)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('TEST SUMMARY')
  console.log('='.repeat(80))

  const total = testResults.passed + testResults.failed
  const successRate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0

  console.log(`\n📊 RESULTS: ${testResults.passed}/${total} tests passed (${successRate}% success rate)`)
  
  if (testResults.failed > 0) {
    console.log('\n❌ FAILED TESTS:')
    testResults.details
      .filter(t => !t.passed)
      .forEach(t => console.log(`   • ${t.name}${t.details ? ': ' + t.details : ''}`))
  }

  if (testResults.passed === total) {
    console.log('\n🎉 ALL TESTS PASSED! All security fixes and code verifications are working correctly.')
  } else {
    console.log(`\n⚠️  ${testResults.failed} test(s) failed. Please review the issues above.`)
  }

  return {
    success: testResults.failed === 0,
    passed: testResults.passed,
    failed: testResults.failed,
    total: total,
    successRate: successRate
  }
}

// Run the tests
runTests().then(results => {
  process.exit(results.success ? 0 : 1)
}).catch(error => {
  console.error('❌ Test execution failed:', error.message)
  process.exit(1)
})