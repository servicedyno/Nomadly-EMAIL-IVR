const axios = require('axios')
const { MongoClient } = require('mongodb')
require('dotenv').config()

// Test configuration
const BACKEND_URL = 'http://localhost:5000'
const TEST_CHAT_ID = 7366890787

let testResults = {
  health: { passed: false, details: '' },
  startHandlerAutoCleanup: { passed: false, details: '' },
  bundleRejectedHandler: { passed: false, details: '' },
  bundleCheckerDuplicateSkip: { passed: false, details: '' },
  aqx1kSessionState: { passed: false, details: '' }
}

async function runTests() {
  console.log('🔍 Starting Auto-cleanup for rejected compliance sessions testing...\n')

  // Test 1: Node.js Health Check
  await testNodejsHealth()

  // Test 2: /start handler auto-cleanup verification
  await testStartHandlerAutoCleanup()

  // Test 3: bundleRejectedAction handler verification 
  await testBundleRejectedHandler()

  // Test 4: BundleChecker duplicate skip verification
  await testBundleCheckerDuplicateSkip()

  // Test 5: @AQX1K Session State verification
  await testAqx1kSessionState()

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('📊 TEST RESULTS SUMMARY')
  console.log('='.repeat(80))

  let totalTests = 0
  let passedTests = 0

  for (const [testName, result] of Object.entries(testResults)) {
    totalTests++
    if (result.passed) passedTests++
    
    const status = result.passed ? '✅ PASS' : '❌ FAIL'
    console.log(`${status} ${testName}: ${result.details}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log(`📈 Overall Success Rate: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`)
  console.log('='.repeat(80))

  return { totalTests, passedTests, testResults }
}

async function testNodejsHealth() {
  console.log('🏥 Testing Node.js Health...')
  
  try {
    // Check health endpoint
    const response = await axios.get(`${BACKEND_URL}/health`)
    
    if (response.status === 200 && 
        response.data.status === 'healthy' && 
        response.data.database === 'connected') {
      
      // Check error log is empty
      const fs = require('fs')
      const errorLogPath = '/var/log/supervisor/nodejs.err.log'
      const stats = fs.statSync(errorLogPath)
      
      if (stats.size === 0) {
        testResults.health.passed = true
        testResults.health.details = `Health endpoint OK (${JSON.stringify(response.data)}), error log empty (${stats.size} bytes)`
      } else {
        testResults.health.details = `Health OK but error log not empty (${stats.size} bytes)`
      }
    } else {
      testResults.health.details = `Unexpected response: ${JSON.stringify(response.data)}`
    }
  } catch (error) {
    testResults.health.details = `Health check failed: ${error.message}`
  }
  
  console.log(`   ${testResults.health.passed ? '✅' : '❌'} ${testResults.health.details}\n`)
}

async function testStartHandlerAutoCleanup() {
  console.log('🔄 Testing /start handler auto-cleanup (around line 5610)...')
  
  const fs = require('fs')
  const indexJsContent = fs.readFileSync('/app/js/_index.js', 'utf8')
  
  const checks = [
    {
      name: 'Auto-cleanup comment exists',
      pattern: /Auto-cleanup.*clear stale compliance sessions/i,
      required: true
    },
    {
      name: 'Try/catch block exists',
      pattern: /try\s*\{[\s\S]*?Auto-cleanup[\s\S]*?catch/,
      required: true
    },
    {
      name: 'Query twilio-rejected bundles with string chatId',
      pattern: /pendingBundles\.find\(\s*\{\s*chatId:\s*String\(chatId\),\s*status:\s*['"`]twilio-rejected['"`]/,
      required: true
    },
    {
      name: 'Query twilio-rejected bundles with numeric chatId',
      pattern: /pendingBundles\.find\(\s*\{\s*chatId,\s*status:\s*['"`]twilio-rejected['"`]/,
      required: true
    },
    {
      name: 'Deduplication by _id',
      pattern: /\.filter\(\(b, i, arr\) => arr\.findIndex\(x => String\(x\._id\) === String\(b\._id\)\) === i\)/,
      required: true
    },
    {
      name: 'Atomic refund via atomicIncrement',
      pattern: /atomicIncrement\(walletOf,\s*chatId,\s*['"`]usdIn['"`]/,
      required: true
    },
    {
      name: 'Update bundle status to auto-cleaned-refunded',
      pattern: /status:\s*['"`]auto-cleaned-refunded['"`]/,
      required: true
    },
    {
      name: 'User message about auto-refund',
      pattern: /Auto-refunded.*rejected verification/,
      required: true
    },
    {
      name: 'Clear docSessions with submitted/failed status',
      pattern: /docSessions\.updateMany[\s\S]*status:\s*\{\s*\$in:\s*\[['"`]submitted['"`],\s*['"`]failed['"`]\]/,
      required: true
    },
    {
      name: 'Clear docSessions to auto-cleaned status',
      pattern: /status:\s*['"`]auto-cleaned['"`]/,
      required: true
    },
    {
      name: 'Cancel stale collecting sessions >24h',
      pattern: /regulatoryFlow\.cancelAndRefund/,
      required: true
    }
  ]
  
  let passedChecks = 0
  let failedChecks = []
  
  for (const check of checks) {
    if (check.pattern.test(indexJsContent)) {
      passedChecks++
      console.log(`   ✅ ${check.name}`)
    } else {
      failedChecks.push(check.name)
      console.log(`   ❌ ${check.name}`)
    }
  }
  
  if (passedChecks === checks.length) {
    testResults.startHandlerAutoCleanup.passed = true
    testResults.startHandlerAutoCleanup.details = `All ${checks.length} auto-cleanup requirements verified in /start handler`
  } else {
    testResults.startHandlerAutoCleanup.details = `${passedChecks}/${checks.length} checks passed. Failed: ${failedChecks.join(', ')}`
  }
  
  console.log(`\n   Result: ${testResults.startHandlerAutoCleanup.passed ? '✅ PASS' : '❌ FAIL'} - ${testResults.startHandlerAutoCleanup.details}\n`)
}

async function testBundleRejectedHandler() {
  console.log('📄 Testing bundleRejectedAction handler (around line 12896)...')
  
  const fs = require('fs')
  const indexJsContent = fs.readFileSync('/app/js/_index.js', 'utf8')
  
  const checks = [
    {
      name: 'bundleRejectedAction handler exists',
      pattern: /action === ['"`]bundleRejectedAction['"`]/,
      required: true
    },
    {
      name: 'Three buttons defined: reuploadBtn, refundBtn, startFreshBtn',
      pattern: /reuploadBtn.*refundBtn.*startFreshBtn/s,
      required: true
    },
    {
      name: 'startFreshBtn has correct text "🔄 Start Fresh (Refund All)"',
      pattern: /startFreshBtn.*🔄 Start Fresh \(Refund All\)/,
      required: true
    },
    {
      name: 'startFreshBtn handler exists',
      pattern: /message === startFreshBtn/,
      required: true
    },
    {
      name: 'Find ALL rejected bundles with $or query',
      pattern: /\$or:\s*\[\s*\{\s*chatId:\s*String\(chatId\)\s*\},\s*\{\s*chatId\s*\}\s*\]/,
      required: true
    },
    {
      name: 'Query for twilio-rejected status in startFresh',
      pattern: /status:\s*['"`]twilio-rejected['"`]/,
      required: true
    },
    {
      name: 'Deduplication by _id in startFresh',
      pattern: /\.filter\(\(b, i, arr\) => arr\.findIndex\(x => String\(x\._id\) === String\(b\._id\)\) === i\)/,
      required: true
    },
    {
      name: 'Refund each bundle via atomicIncrement',
      pattern: /atomicIncrement\(walletOf,\s*chatId,\s*['"`]usdIn['"`]/,
      required: true
    },
    {
      name: 'Mark bundles as start-fresh-refunded',
      pattern: /status:\s*['"`]start-fresh-refunded['"`]/,
      required: true
    },
    {
      name: 'Clear docSessions with multiple statuses',
      pattern: /status:\s*\{\s*\$in:\s*\[['"`]submitted['"`],\s*['"`]failed['"`],\s*['"`]collecting['"`],\s*['"`]awaiting_address['"`]\]/,
      required: true
    },
    {
      name: 'Set docSessions to start-fresh-cleaned',
      pattern: /status:\s*['"`]start-fresh-cleaned['"`]/,
      required: true
    },
    {
      name: 'Reset state action to none',
      pattern: /set\(state,\s*chatId,\s*['"`]action['"`],\s*['"`]none['"`]\)/,
      required: true
    },
    {
      name: 'Reset processingPayment to false',
      pattern: /set\(state,\s*chatId,\s*['"`]processingPayment['"`],\s*false\)/,
      required: true
    },
    {
      name: 'Send refund summary message to user',
      pattern: /Fresh Start.*Cleared.*refunded.*wallet/s,
      required: true
    },
    {
      name: 'Re-show options keyboard has 3 buttons in 3 rows',
      pattern: /keyboard:\s*\[\s*\[reuploadBtn\],\s*\[refundBtn\],\s*\[startFreshBtn\]\s*\]/,
      required: true
    }
  ]
  
  let passedChecks = 0
  let failedChecks = []
  
  for (const check of checks) {
    if (check.pattern.test(indexJsContent)) {
      passedChecks++
      console.log(`   ✅ ${check.name}`)
    } else {
      failedChecks.push(check.name)
      console.log(`   ❌ ${check.name}`)
    }
  }
  
  if (passedChecks === checks.length) {
    testResults.bundleRejectedHandler.passed = true
    testResults.bundleRejectedHandler.details = `All ${checks.length} bundleRejectedAction requirements verified`
  } else {
    testResults.bundleRejectedHandler.details = `${passedChecks}/${checks.length} checks passed. Failed: ${failedChecks.join(', ')}`
  }
  
  console.log(`\n   Result: ${testResults.bundleRejectedHandler.passed ? '✅ PASS' : '❌ FAIL'} - ${testResults.bundleRejectedHandler.details}\n`)
}

async function testBundleCheckerDuplicateSkip() {
  console.log('🔍 Testing BundleChecker duplicate skip (around line 1235)...')
  
  const fs = require('fs')
  const indexJsContent = fs.readFileSync('/app/js/_index.js', 'utf8')
  
  const checks = [
    {
      name: 'twilio-rejected status check in BundleChecker',
      pattern: /newStatus === ['"`]twilio-rejected['"`]/,
      required: true
    },
    {
      name: 'Get user state with get(state, pb.chatId)',
      pattern: /userState = await get\(state,\s*pb\.chatId\)/,
      required: true
    },
    {
      name: 'Check if action is bundleRejectedAction',
      pattern: /userState\?\.action === ['"`]bundleRejectedAction['"`]/,
      required: true
    },
    {
      name: 'Skip notification with continue statement',
      pattern: /continue.*Skip.*don't re-send/i,
      required: true
    },
    {
      name: 'Log message about skipping duplicate',
      pattern: /skipping duplicate notification/i,
      required: true
    },
    {
      name: 'BundleChecker rejection keyboard has startFreshBtn',
      pattern: /startFreshBtn.*🔄 Start Fresh/,
      required: true
    },
    {
      name: 'Rejection keyboard has 3 rows with 3 buttons',
      pattern: /keyboard:\s*\[\s*\[reuploadBtn\],\s*\[refundBtn\],\s*\[startFreshBtn\]\s*\]/,
      required: true
    }
  ]
  
  let passedChecks = 0
  let failedChecks = []
  
  for (const check of checks) {
    if (check.pattern.test(indexJsContent)) {
      passedChecks++
      console.log(`   ✅ ${check.name}`)
    } else {
      failedChecks.push(check.name)
      console.log(`   ❌ ${check.name}`)
    }
  }
  
  if (passedChecks === checks.length) {
    testResults.bundleCheckerDuplicateSkip.passed = true
    testResults.bundleCheckerDuplicateSkip.details = `All ${checks.length} BundleChecker duplicate skip requirements verified`
  } else {
    testResults.bundleCheckerDuplicateSkip.details = `${passedChecks}/${checks.length} checks passed. Failed: ${failedChecks.join(', ')}`
  }
  
  console.log(`\n   Result: ${testResults.bundleCheckerDuplicateSkip.passed ? '✅ PASS' : '❌ FAIL'} - ${testResults.bundleCheckerDuplicateSkip.details}\n`)
}

async function testAqx1kSessionState() {
  console.log('🔐 Testing @AQX1K Session State (MongoDB verification)...')
  
  try {
    // Connect to MongoDB
    require('dotenv').config()
    const client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    const db = client.db('test')
    
    const checks = []
    
    // Check state collection for chatId 7366890787
    const stateCollection = db.collection('state')
    const userState = await stateCollection.findOne({ _id: TEST_CHAT_ID })
    
    if (userState) {
      if (userState.action === 'none') {
        checks.push({ name: 'User state action is "none"', passed: true })
      } else {
        checks.push({ name: `User state action is "${userState.action}", expected "none"`, passed: false })
      }
    } else {
      checks.push({ name: 'User state not found in state collection', passed: false })
    }
    
    // Check pendingBundles for no twilio-rejected status
    const pendingBundlesCollection = db.collection('pendingBundles')
    const rejectedBundles = await pendingBundlesCollection.find({ 
      $or: [{ chatId: String(TEST_CHAT_ID) }, { chatId: TEST_CHAT_ID }], 
      status: 'twilio-rejected' 
    }).toArray()
    
    if (rejectedBundles.length === 0) {
      checks.push({ name: 'No pendingBundles with twilio-rejected status found', passed: true })
    } else {
      checks.push({ name: `Found ${rejectedBundles.length} pendingBundles with twilio-rejected status`, passed: false })
    }
    
    await client.close()
    
    const passedChecks = checks.filter(c => c.passed).length
    
    if (passedChecks === checks.length) {
      testResults.aqx1kSessionState.passed = true
      testResults.aqx1kSessionState.details = `MongoDB verification complete: ${checks.map(c => c.name).join(', ')}`
    } else {
      testResults.aqx1kSessionState.details = `${passedChecks}/${checks.length} MongoDB checks passed`
    }
    
    for (const check of checks) {
      console.log(`   ${check.passed ? '✅' : '❌'} ${check.name}`)
    }
    
  } catch (error) {
    testResults.aqx1kSessionState.details = `MongoDB connection error: ${error.message}`
    console.log(`   ❌ ${error.message}`)
  }
  
  console.log(`\n   Result: ${testResults.aqx1kSessionState.passed ? '✅' : '❌ FAIL'} - ${testResults.aqx1kSessionState.details}\n`)
}

// Run the tests
runTests().then(results => {
  process.exit(results.passedTests === results.totalTests ? 0 : 1)
}).catch(error => {
  console.error('Test execution failed:', error)
  process.exit(1)
})