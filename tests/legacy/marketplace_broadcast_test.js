// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Nomadly Node.js Backend - Marketplace Listing Broadcast Testing
// Testing: Marketplace broadcastNewListing feature implementation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const axios = require('axios')
const fs = require('fs')

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

// TEST 1: Node.js Health Check
async function testNodeJsHealth() {
  log('=== TEST 1: NODE.JS HEALTH CHECK ===')
  
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 10000 })
    const isHealthy = response.status === 200 && response.data?.status === 'healthy'
    await logTest('Node.js Health Endpoint', isHealthy, 
      `Status: ${response.data?.status}, Database: ${response.data?.database}`)
  } catch (error) {
    await logTest('Node.js Health Endpoint', false, `Error: ${error.message}`)
  }
}

// TEST 2: Error Log Check
async function testErrorLogs() {
  log('=== TEST 2: ERROR LOG CHECK ===')
  
  try {
    // Check if error log exists and get its size
    const { execSync } = require('child_process')
    
    // Get new errors related to broadcastNewListing or marketplace
    const logCheck = execSync('tail -n 50 /var/log/supervisor/nodejs.err.log | grep -E "(broadcastNewListing|marketplace)" || echo "NO_ERRORS_FOUND"', { encoding: 'utf8' })
    
    const hasNewErrors = logCheck.trim() !== 'NO_ERRORS_FOUND' && logCheck.trim() !== ''
    await logTest('No New Broadcast/Marketplace Errors', !hasNewErrors,
      hasNewErrors ? `Found errors: ${logCheck.trim()}` : 'Error log clean for broadcast/marketplace')
    
    // Check overall error log size
    const errorLogSize = execSync('wc -c < /var/log/supervisor/nodejs.err.log', { encoding: 'utf8' })
    await logTest('Error Log Size Check', true, `Log size: ${errorLogSize.trim()} bytes`)
    
  } catch (error) {
    await logTest('Error Log Check', false, `Error: ${error.message}`)
  }
}

// TEST 3: broadcastNewListing Function Verification
async function testBroadcastFunction() {
  log('=== TEST 3: BROADCAST FUNCTION VERIFICATION ===')
  
  try {
    // Check utils.js for broadcastNewListing function around line 447
    const utilsContent = fs.readFileSync('/app/js/utils.js', 'utf8')
    const lines = utilsContent.split('\n')
    
    // Find the function definition
    let foundFunction = false
    let functionLine = -1
    for (let i = 440; i < 460; i++) {
      if (lines[i] && lines[i].includes('const broadcastNewListing = async (bot, product, nameOf, db)')) {
        foundFunction = true
        functionLine = i + 1
        break
      }
    }
    
    await logTest('broadcastNewListing Function Exists', foundFunction,
      foundFunction ? `Found at line ${functionLine}` : 'Function not found around line 447')
    
    if (foundFunction) {
      // Check function parameters
      const hasCorrectParams = lines[functionLine - 1].includes('(bot, product, nameOf, db)')
      await logTest('Function Parameters Correct', hasCorrectParams,
        'Takes (bot, product, nameOf, db) parameters')
      
      // Check for seller filtering
      const hasSellFiltering = utilsContent.includes('chatIds.filter(id => String(id) !== String(product.sellerId))')
      await logTest('Seller Filtering Logic', hasSellFiltering,
        'Filters out seller\'s own chatId')
      
      // Check for dead user filtering
      const hasDeadUserFiltering = utilsContent.includes('promoOptOut') && utilsContent.includes('user_deactivated')
      await logTest('Dead User Pre-filtering', hasDeadUserFiltering,
        'Pre-filters dead users from promoOptOut collection')
      
      // Check BROADCAST_CONFIG usage
      const usesBroadcastConfig = utilsContent.includes('const { BATCH_SIZE, DELAY_BETWEEN_BATCHES, DELAY_BETWEEN_MESSAGES, MAX_RETRIES, RETRY_DELAY } = BROADCAST_CONFIG')
      await logTest('BROADCAST_CONFIG Usage', usesBroadcastConfig,
        'Uses BROADCAST_CONFIG for batch settings')
      
      // Check for sendPhoto and sendMessage calls
      const hasSendPhoto = utilsContent.includes('bot.sendPhoto(cid, product.images[0].fileId')
      const hasSendMessage = utilsContent.includes('bot.sendMessage(cid, caption')
      await logTest('Bot Send Methods', hasSendPhoto && hasSendMessage,
        'Has both sendPhoto (with images) and sendMessage (no images) calls')
      
      // Check error handling with dead-user marking
      const hasErrorHandling = utilsContent.includes('user is deactivated') && utilsContent.includes('chat not found')
      await logTest('Error Handling with Dead-User Marking', hasErrorHandling,
        'Handles errors and marks dead users')
      
      // Check caption content
      const hasCorrectCaption = utilsContent.includes('product.title') && 
                               utilsContent.includes('product.description') && 
                               utilsContent.includes('product.price') && 
                               utilsContent.includes('product.category') && 
                               utilsContent.includes('product.sellerUsername') && 
                               utilsContent.includes('Escrow Protected')
      await logTest('Caption Content', hasCorrectCaption,
        'Caption includes title, description, price, category, sellerUsername, escrow protection')
      
      // Check inline keyboard buttons
      const hasCorrectButtons = utilsContent.includes('💬 Chat with Seller') && 
                               utilsContent.includes('🔒 Start Escrow') && 
                               utilsContent.includes('mp:chat:') && 
                               utilsContent.includes('mp:escrow_product:')
      await logTest('Inline Keyboard Buttons', hasCorrectButtons,
        'Has "Chat with Seller" and "Start Escrow" buttons with correct callbacks')
    }
    
  } catch (error) {
    await logTest('broadcastNewListing Function Check', false, `Error: ${error.message}`)
  }
}

// TEST 4: Function Export Verification
async function testFunctionExport() {
  log('=== TEST 4: FUNCTION EXPORT VERIFICATION ===')
  
  try {
    // Check if broadcastNewListing is exported around line 791
    const utilsContent = fs.readFileSync('/app/js/utils.js', 'utf8')
    const lines = utilsContent.split('\n')
    
    let foundExport = false
    for (let i = 785; i < 795; i++) {
      if (lines[i] && lines[i].includes('broadcastNewListing,')) {
        foundExport = true
        break
      }
    }
    
    await logTest('broadcastNewListing Export', foundExport,
      'Function is exported from utils.js around line 791')
    
  } catch (error) {
    await logTest('Function Export Check', false, `Error: ${error.message}`)
  }
}

// TEST 5: Function Import in _index.js
async function testFunctionImport() {
  log('=== TEST 5: FUNCTION IMPORT VERIFICATION ===')
  
  try {
    // Check if broadcastNewListing is imported at line 132
    const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8')
    const lines = indexContent.split('\n')
    
    let foundImport = false
    for (let i = 130; i < 135; i++) {
      if (lines[i] && lines[i].includes('broadcastNewListing,')) {
        foundImport = true
        break
      }
    }
    
    await logTest('broadcastNewListing Import', foundImport,
      'Function is imported in _index.js at line 132')
    
  } catch (error) {
    await logTest('Function Import Check', false, `Error: ${error.message}`)
  }
}

// TEST 6: mpNewConfirm Handler Verification
async function testMpNewConfirmHandler() {
  log('=== TEST 6: MPNEWCONFIRM HANDLER VERIFICATION ===')
  
  try {
    // Check mpNewConfirm handler around line 6556
    const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    // Find mpNewConfirm handler
    const hasMpNewConfirm = indexContent.includes("if (action === a.mpNewConfirm)")
    await logTest('mpNewConfirm Handler Exists', hasMpNewConfirm,
      'Handler for mpNewConfirm action exists')
    
    if (hasMpNewConfirm) {
      // Check for broadcastNewListing call as fire-and-forget
      const hasFireAndForget = indexContent.includes('broadcastNewListing(bot, product, nameOf, db).catch(')
      await logTest('Fire-and-Forget Call', hasFireAndForget,
        'broadcastNewListing called as fire-and-forget with .catch()')
      
      // Check call happens AFTER product creation
      const codeSection = indexContent.substring(
        indexContent.indexOf("if (action === a.mpNewConfirm)"),
        indexContent.indexOf("if (action === a.mpNewConfirm)") + 2000
      )
      
      const productCreatedFirst = codeSection.indexOf('createProduct') < codeSection.indexOf('broadcastNewListing')
      await logTest('Call Order - After Product Creation', productCreatedFirst,
        'broadcastNewListing called AFTER product creation')
      
      // Check call happens AFTER seller confirmation
      const sellerConfirmFirst = codeSection.indexOf('t.mpProductPublished') < codeSection.indexOf('broadcastNewListing')
      await logTest('Call Order - After Seller Confirmation', sellerConfirmFirst,
        'Call happens AFTER send(chatId, t.mpProductPublished)')
      
      // Check call happens AFTER admin notification
      const adminNotifyFirst = codeSection.indexOf('TELEGRAM_ADMIN_CHAT_ID') < codeSection.indexOf('broadcastNewListing')
      await logTest('Call Order - After Admin Notification', adminNotifyFirst,
        'Call happens AFTER admin notification')
      
      // Check call happens BEFORE return goto.marketplace()
      const beforeReturn = codeSection.indexOf('broadcastNewListing') < codeSection.indexOf('return goto.marketplace()')
      await logTest('Call Order - Before Return', beforeReturn,
        'Call happens BEFORE return goto.marketplace()')
    }
    
  } catch (error) {
    await logTest('mpNewConfirm Handler Check', false, `Error: ${error.message}`)
  }
}

// TEST 7: BROADCAST_CONFIG Verification
async function testBroadcastConfig() {
  log('=== TEST 7: BROADCAST_CONFIG VERIFICATION ===')
  
  try {
    const configContent = fs.readFileSync('/app/js/broadcast-config.js', 'utf8')
    
    // Check for required config keys
    const requiredKeys = ['BATCH_SIZE', 'DELAY_BETWEEN_BATCHES', 'DELAY_BETWEEN_MESSAGES', 'MAX_RETRIES', 'RETRY_DELAY']
    let allKeysPresent = true
    
    for (const key of requiredKeys) {
      if (!configContent.includes(`${key}:`)) {
        allKeysPresent = false
        break
      }
    }
    
    await logTest('BROADCAST_CONFIG Keys', allKeysPresent,
      'All required keys (BATCH_SIZE, DELAY_BETWEEN_BATCHES, DELAY_BETWEEN_MESSAGES, MAX_RETRIES, RETRY_DELAY) present')
    
    // Check if config is properly exported
    const isExported = configContent.includes('module.exports = BROADCAST_CONFIG')
    await logTest('BROADCAST_CONFIG Export', isExported,
      'BROADCAST_CONFIG is properly exported')
    
  } catch (error) {
    await logTest('BROADCAST_CONFIG Check', false, `Error: ${error.message}`)
  }
}

// Main Test Runner
async function runAllTests() {
  log('🚀 Starting Marketplace Listing Broadcast Feature Testing')
  log('=' .repeat(80))
  
  // Run all test suites
  await testNodeJsHealth()
  await testErrorLogs()
  await testBroadcastFunction()
  await testFunctionExport()
  await testFunctionImport()
  await testMpNewConfirmHandler()
  await testBroadcastConfig()
  
  // Print summary
  log('=' .repeat(80))
  log('🏁 TEST SUMMARY')
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
  
  log('Testing completed!')
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0)
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