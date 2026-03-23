const axios = require('axios')
const fs = require('fs')
require('dotenv').config()

// Test configuration
const BACKEND_URL = 'http://localhost:5000'
const TEST_CHAT_ID = 7366890787

let testResults = {
  health: { passed: false, details: '' },
  utilsNgnFunctions: { passed: false, details: '' },
  utilsSmartWalletFunctions: { passed: false, details: '' },
  indexWalletHandlers: { passed: false, details: '' },
  indexNullGuards: { passed: false, details: '' },
  hostingScheduler: { passed: false, details: '' },
  phoneScheduler: { passed: false, details: '' },
  voiceService: { passed: false, details: '' },
  smsService: { passed: false, details: '' },
  bulkCallService: { passed: false, details: '' },
  langStrings: { passed: false, details: '' },
  syntaxCheck: { passed: false, details: '' }
}

async function runTests() {
  console.log('🔍 Starting NGN Wallet Support Implementation Testing...\n')

  // Test 1: Health Check
  await testHealth()

  // Test 2: Utils.js NGN functions
  await testUtilsNgnFunctions()

  // Test 3: Utils.js Smart Wallet functions
  await testUtilsSmartWalletFunctions()

  // Test 4: _index.js wallet handlers
  await testIndexWalletHandlers()

  // Test 5: _index.js null guards
  await testIndexNullGuards()

  // Test 6: hosting-scheduler.js
  await testHostingScheduler()

  // Test 7: phone-scheduler.js
  await testPhoneScheduler()

  // Test 8: voice-service.js
  await testVoiceService()

  // Test 9: sms-service.js
  await testSmsService()

  // Test 10: bulk-call-service.js
  await testBulkCallService()

  // Test 11: lang/en.js strings
  await testLangStrings()

  // Test 12: Syntax check all files
  await testSyntaxCheck()

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('📊 NGN WALLET SUPPORT TEST RESULTS')
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

async function testHealth() {
  console.log('🏥 Testing Health Endpoint...')
  
  try {
    const response = await axios.get(`${BACKEND_URL}/health`)
    
    if (response.status === 200 && response.data.status === 'healthy') {
      testResults.health.passed = true
      testResults.health.details = `Health endpoint OK: ${JSON.stringify(response.data)}`
    } else {
      testResults.health.details = `Unexpected response: ${JSON.stringify(response.data)}`
    }
  } catch (error) {
    testResults.health.details = `Health check failed: ${error.message}`
  }
  
  console.log(`   ${testResults.health.passed ? '✅' : '❌'} ${testResults.health.details}\n`)
}

async function testUtilsNgnFunctions() {
  console.log('💱 Testing js/utils.js NGN functions...')
  
  const utilsContent = fs.readFileSync('/app/js/utils.js', 'utf8')
  
  const checks = [
    {
      name: 'usdToNgn returns null when API key invalid',
      pattern: /usdToNgn.*async.*function.*\{[\s\S]*?const rate = await _fetchNgnRate\(\)[\s\S]*?if \(!rate\) return null/,
      required: true
    },
    {
      name: '_fetchNgnRate has 10-minute cache mechanism',
      pattern: /const NGN_RATE_CACHE_TTL = 10 \* 60 \* 1000/,
      required: true
    },
    {
      name: '_fetchNgnRate checks cache before API call',
      pattern: /if \(_cachedNgnRate && \(now - _cachedNgnRateAt\) < NGN_RATE_CACHE_TTL\) return _cachedNgnRate/,
      required: true
    },
    {
      name: '_fetchNgnRate returns null on API failure',
      pattern: /_fetchNgnRate[\s\S]*?catch[\s\S]*?return null/,
      required: true
    },
    {
      name: 'smartWalletDeduct function exists',
      pattern: /async function smartWalletDeduct\(walletOf, chatId, amountUsd\)/,
      required: true
    },
    {
      name: 'smartWalletDeduct tries USD first then NGN',
      pattern: /smartWalletDeduct[\s\S]*?if \(usdBal >= amountUsd\)[\s\S]*?const amountNgn = await usdToNgn\(amountUsd\)/,
      required: true
    },
    {
      name: 'smartWalletCheck function exists',
      pattern: /async function smartWalletCheck\(walletOf, chatId, amountUsd\)/,
      required: true
    },
    {
      name: 'smartWalletCheck checks both currencies',
      pattern: /smartWalletCheck[\s\S]*?if \(usdBal >= amountUsd\)[\s\S]*?const amountNgn = await usdToNgn\(amountUsd\)/,
      required: true
    }
  ]
  
  let passedChecks = 0
  let failedChecks = []
  
  for (const check of checks) {
    if (check.pattern.test(utilsContent)) {
      passedChecks++
      console.log(`   ✅ ${check.name}`)
    } else {
      failedChecks.push(check.name)
      console.log(`   ❌ ${check.name}`)
    }
  }
  
  if (passedChecks === checks.length) {
    testResults.utilsNgnFunctions.passed = true
    testResults.utilsNgnFunctions.details = `All ${checks.length} utils.js NGN function requirements verified`
  } else {
    testResults.utilsNgnFunctions.details = `${passedChecks}/${checks.length} checks passed. Failed: ${failedChecks.join(', ')}`
  }
  
  console.log(`\n   Result: ${testResults.utilsNgnFunctions.passed ? '✅ PASS' : '❌ FAIL'} - ${testResults.utilsNgnFunctions.details}\n`)
}

async function testUtilsSmartWalletFunctions() {
  console.log('🧠 Testing js/utils.js Smart Wallet functions...')
  
  const utilsContent = fs.readFileSync('/app/js/utils.js', 'utf8')
  
  const checks = [
    {
      name: 'smartWalletDeduct exported in module.exports',
      pattern: /module\.exports = \{[\s\S]*?smartWalletDeduct[\s\S]*?\}/,
      required: true
    },
    {
      name: 'smartWalletCheck exported in module.exports',
      pattern: /module\.exports = \{[\s\S]*?smartWalletCheck[\s\S]*?\}/,
      required: true
    },
    {
      name: 'smartWalletDeduct returns success/currency/charged object',
      pattern: /return \{ success: true, currency: 'usd', charged: amountUsd \}/,
      required: true
    },
    {
      name: 'smartWalletDeduct returns NGN fallback result',
      pattern: /return \{ success: true, currency: 'ngn', charged: amountUsd, chargedNgn: amountNgn \}/,
      required: true
    },
    {
      name: 'smartWalletCheck returns sufficient/currency/balances object',
      pattern: /return \{ sufficient: true, currency: 'usd', usdBal, ngnBal \}/,
      required: true
    },
    {
      name: 'smartWalletCheck returns NGN sufficient result',
      pattern: /return \{ sufficient: true, currency: 'ngn', amountNgn, usdBal, ngnBal \}/,
      required: true
    }
  ]
  
  let passedChecks = 0
  let failedChecks = []
  
  for (const check of checks) {
    if (check.pattern.test(utilsContent)) {
      passedChecks++
      console.log(`   ✅ ${check.name}`)
    } else {
      failedChecks.push(check.name)
      console.log(`   ❌ ${check.name}`)
    }
  }
  
  if (passedChecks === checks.length) {
    testResults.utilsSmartWalletFunctions.passed = true
    testResults.utilsSmartWalletFunctions.details = `All ${checks.length} smart wallet function requirements verified`
  } else {
    testResults.utilsSmartWalletFunctions.details = `${passedChecks}/${checks.length} checks passed. Failed: ${failedChecks.join(', ')}`
  }
  
  console.log(`\n   Result: ${testResults.utilsSmartWalletFunctions.passed ? '✅ PASS' : '❌ FAIL'} - ${testResults.utilsSmartWalletFunctions.details}\n`)
}

async function testIndexWalletHandlers() {
  console.log('💳 Testing js/_index.js wallet payment handlers...')
  
  const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8')
  
  const checks = [
    {
      name: 'walletSelectCurrency checks NGN conversion availability',
      pattern: /walletSelectCurrency[\s\S]*?const priceNgn = await usdToNgn[\s\S]*?if \(!priceNgn\)/,
      required: true
    },
    {
      name: 'walletSelectCurrencyConfirm guards against null NGN conversion',
      pattern: /walletSelectCurrencyConfirm[\s\S]*?if \(!priceNgn\)/,
      required: true
    },
    {
      name: 'confirmUpgradeHostingPay action exists in actions enum',
      pattern: /confirmUpgradeHostingPay/,
      required: true
    },
    {
      name: 'Hosting manual renewal shows both USD/NGN buttons',
      pattern: /renewHostingPlan[\s\S]*?walletSelectCurrency/,
      required: true
    },
    {
      name: 'Email blast payment shows both USD/NGN wallet buttons',
      pattern: /email.*blast[\s\S]*?walletSelectCurrency/i,
      required: true
    },
    {
      name: 'Bank payment flows have null guard for priceNGN',
      pattern: /if \(!_rawNgn \|\| isNaN\(priceNGN\) \|\| priceNGN <= 0\) return send/,
      required: true
    }
  ]
  
  let passedChecks = 0
  let failedChecks = []
  
  for (const check of checks) {
    if (check.pattern.test(indexContent)) {
      passedChecks++
      console.log(`   ✅ ${check.name}`)
    } else {
      failedChecks.push(check.name)
      console.log(`   ❌ ${check.name}`)
    }
  }
  
  if (passedChecks === checks.length) {
    testResults.indexWalletHandlers.passed = true
    testResults.indexWalletHandlers.details = `All ${checks.length} wallet handler requirements verified`
  } else {
    testResults.indexWalletHandlers.details = `${passedChecks}/${checks.length} checks passed. Failed: ${failedChecks.join(', ')}`
  }
  
  console.log(`\n   Result: ${testResults.indexWalletHandlers.passed ? '✅ PASS' : '❌ FAIL'} - ${testResults.indexWalletHandlers.details}\n`)
}

async function testIndexNullGuards() {
  console.log('🛡️ Testing js/_index.js null guards in walletOk handlers...')
  
  const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8')
  
  const walletOkHandlers = [
    'plan-pay', 'hosting-pay', 'domain-pay', 'vps-plan-pay', 'vps-upgrade-plan-pay',
    'phone-pay', 'digital-product-pay', 'virtual-card-pay', 'leads', 'shortener', 'bundleConfirm'
  ]
  
  let passedChecks = 0
  let failedChecks = []
  
  for (const handler of walletOkHandlers) {
    const nullGuardPattern = new RegExp(`${handler}[\\s\\S]*?if \\(coin === u\\.ngn && \\(!priceNgn \\|\\| ngnBal < priceNgn\\)\\)`, 'i')
    
    if (nullGuardPattern.test(indexContent)) {
      passedChecks++
      console.log(`   ✅ ${handler} has null guard`)
    } else {
      failedChecks.push(handler)
      console.log(`   ❌ ${handler} missing null guard`)
    }
  }
  
  if (passedChecks === walletOkHandlers.length) {
    testResults.indexNullGuards.passed = true
    testResults.indexNullGuards.details = `All ${walletOkHandlers.length} walletOk handlers have null guards`
  } else {
    testResults.indexNullGuards.details = `${passedChecks}/${walletOkHandlers.length} handlers have null guards. Missing: ${failedChecks.join(', ')}`
  }
  
  console.log(`\n   Result: ${testResults.indexNullGuards.passed ? '✅ PASS' : '❌ FAIL'} - ${testResults.indexNullGuards.details}\n`)
}

async function testHostingScheduler() {
  console.log('🏠 Testing js/hosting-scheduler.js...')
  
  const schedulerContent = fs.readFileSync('/app/js/hosting-scheduler.js', 'utf8')
  
  const checks = [
    {
      name: 'smartWalletDeduct imported',
      pattern: /const \{ smartWalletDeduct[\s\S]*?\} = require\('\.\/utils'\)/,
      required: true
    },
    {
      name: 'smartWalletDeduct used instead of old functions',
      pattern: /const result = await smartWalletDeduct\(walletOf, chatId, price\)/,
      required: true
    },
    {
      name: 'Old getWalletBalance/deductWallet functions removed',
      pattern: /(?!.*getWalletBalance)(?!.*deductWallet)/,
      required: false // This is a negative check - we want these NOT to exist
    }
  ]
  
  let passedChecks = 0
  let failedChecks = []
  
  for (const check of checks) {
    const testResult = check.required ? check.pattern.test(schedulerContent) : !check.pattern.test(schedulerContent)
    
    if (testResult) {
      passedChecks++
      console.log(`   ✅ ${check.name}`)
    } else {
      failedChecks.push(check.name)
      console.log(`   ❌ ${check.name}`)
    }
  }
  
  if (passedChecks === checks.length) {
    testResults.hostingScheduler.passed = true
    testResults.hostingScheduler.details = `All ${checks.length} hosting scheduler requirements verified`
  } else {
    testResults.hostingScheduler.details = `${passedChecks}/${checks.length} checks passed. Failed: ${failedChecks.join(', ')}`
  }
  
  console.log(`\n   Result: ${testResults.hostingScheduler.passed ? '✅ PASS' : '❌ FAIL'} - ${testResults.hostingScheduler.details}\n`)
}

async function testPhoneScheduler() {
  console.log('📞 Testing js/phone-scheduler.js...')
  
  const phoneContent = fs.readFileSync('/app/js/phone-scheduler.js', 'utf8')
  
  const checks = [
    {
      name: 'smartWalletDeduct imported',
      pattern: /const \{ getBalance, smartWalletDeduct \} = require\('\.\/utils\.js'\)/,
      required: true
    },
    {
      name: 'smartWalletDeduct used in attemptAutoRenew',
      pattern: /attemptAutoRenew[\s\S]*?const result = await smartWalletDeduct\(_walletOf, chatId, price\)/,
      required: true
    }
  ]
  
  let passedChecks = 0
  let failedChecks = []
  
  for (const check of checks) {
    if (check.pattern.test(phoneContent)) {
      passedChecks++
      console.log(`   ✅ ${check.name}`)
    } else {
      failedChecks.push(check.name)
      console.log(`   ❌ ${check.name}`)
    }
  }
  
  if (passedChecks === checks.length) {
    testResults.phoneScheduler.passed = true
    testResults.phoneScheduler.details = `All ${checks.length} phone scheduler requirements verified`
  } else {
    testResults.phoneScheduler.details = `${passedChecks}/${checks.length} checks passed. Failed: ${failedChecks.join(', ')}`
  }
  
  console.log(`\n   Result: ${testResults.phoneScheduler.passed ? '✅ PASS' : '❌ FAIL'} - ${testResults.phoneScheduler.details}\n`)
}

async function testVoiceService() {
  console.log('🎤 Testing js/voice-service.js...')
  
  const voiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8')
  
  const checks = [
    {
      name: 'smartWalletDeduct and smartWalletCheck imported',
      pattern: /const \{ getBalance, smartWalletDeduct, smartWalletCheck \} = require\('\.\/utils\.js'\)/,
      required: true
    },
    {
      name: 'Inbound overage check uses smartWalletCheck',
      pattern: /const check = await smartWalletCheck\(_walletOf, chatId, inboundRate\)/,
      required: true
    },
    {
      name: 'Mid-call overage billing uses smartWalletDeduct',
      pattern: /const deductResult = await smartWalletDeduct\(_walletOf, chatId, rate\)/,
      required: true
    },
    {
      name: 'Outbound SIP wallet check uses smartWalletCheck',
      pattern: /const walletCheck = await smartWalletCheck\(_walletOf, chatId, sipRate\)/,
      required: true
    },
    {
      name: 'billCallMinutesUnified uses smartWalletDeduct',
      pattern: /billCallMinutesUnified[\s\S]*?const deductResult = await smartWalletDeduct\(_walletOf, chatId, totalCharge\)/,
      required: true
    }
  ]
  
  let passedChecks = 0
  let failedChecks = []
  
  for (const check of checks) {
    if (check.pattern.test(voiceContent)) {
      passedChecks++
      console.log(`   ✅ ${check.name}`)
    } else {
      failedChecks.push(check.name)
      console.log(`   ❌ ${check.name}`)
    }
  }
  
  if (passedChecks === checks.length) {
    testResults.voiceService.passed = true
    testResults.voiceService.details = `All ${checks.length} voice service requirements verified`
  } else {
    testResults.voiceService.details = `${passedChecks}/${checks.length} checks passed. Failed: ${failedChecks.join(', ')}`
  }
  
  console.log(`\n   Result: ${testResults.voiceService.passed ? '✅ PASS' : '❌ FAIL'} - ${testResults.voiceService.details}\n`)
}

async function testSmsService() {
  console.log('📱 Testing js/sms-service.js...')
  
  const smsContent = fs.readFileSync('/app/js/sms-service.js', 'utf8')
  
  const checks = [
    {
      name: 'smartWalletDeduct imported',
      pattern: /const \{ getBalance, smartWalletDeduct \} = require\('\.\/utils\.js'\)/,
      required: true
    },
    {
      name: 'smartWalletDeduct used for SMS overage',
      pattern: /const deductResult = await smartWalletDeduct\(_walletOf, ownerChatId, OVERAGE_RATE_SMS\)/,
      required: true
    }
  ]
  
  let passedChecks = 0
  let failedChecks = []
  
  for (const check of checks) {
    if (check.pattern.test(smsContent)) {
      passedChecks++
      console.log(`   ✅ ${check.name}`)
    } else {
      failedChecks.push(check.name)
      console.log(`   ❌ ${check.name}`)
    }
  }
  
  if (passedChecks === checks.length) {
    testResults.smsService.passed = true
    testResults.smsService.details = `All ${checks.length} SMS service requirements verified`
  } else {
    testResults.smsService.details = `${passedChecks}/${checks.length} checks passed. Failed: ${failedChecks.join(', ')}`
  }
  
  console.log(`\n   Result: ${testResults.smsService.passed ? '✅ PASS' : '❌ FAIL'} - ${testResults.smsService.details}\n`)
}

async function testBulkCallService() {
  console.log('📞 Testing js/bulk-call-service.js...')
  
  const bulkContent = fs.readFileSync('/app/js/bulk-call-service.js', 'utf8')
  
  const checks = [
    {
      name: 'smartWalletDeduct and smartWalletCheck imported',
      pattern: /const \{ getBalance, smartWalletDeduct, smartWalletCheck \} = require\('\.\/utils\.js'\)/,
      required: true
    },
    {
      name: 'Pre-campaign credit check uses smartWalletCheck',
      pattern: /const walletCheck = await smartWalletCheck\(_walletOf, campaign\.chatId, BULK_CALL_MIN_WALLET\)/,
      required: true
    },
    {
      name: 'Per-batch credit check uses smartWalletCheck',
      pattern: /const walletCheck = await smartWalletCheck\(_walletOf, campaign\.chatId, BULK_CALL_RATE\)/,
      required: true
    },
    {
      name: 'Billing uses smartWalletDeduct',
      pattern: /const deductResult = await smartWalletDeduct\(_walletOf, freshCampaign\.chatId, charge\)/,
      required: true
    },
    {
      name: 'Post-billing check uses smartWalletCheck',
      pattern: /const postCheck = await smartWalletCheck\(_walletOf, freshCampaign\.chatId, BULK_CALL_RATE\)/,
      required: true
    }
  ]
  
  let passedChecks = 0
  let failedChecks = []
  
  for (const check of checks) {
    if (check.pattern.test(bulkContent)) {
      passedChecks++
      console.log(`   ✅ ${check.name}`)
    } else {
      failedChecks.push(check.name)
      console.log(`   ❌ ${check.name}`)
    }
  }
  
  if (passedChecks === checks.length) {
    testResults.bulkCallService.passed = true
    testResults.bulkCallService.details = `All ${checks.length} bulk call service requirements verified`
  } else {
    testResults.bulkCallService.details = `${passedChecks}/${checks.length} checks passed. Failed: ${failedChecks.join(', ')}`
  }
  
  console.log(`\n   Result: ${testResults.bulkCallService.passed ? '✅ PASS' : '❌ FAIL'} - ${testResults.bulkCallService.details}\n`)
}

async function testLangStrings() {
  console.log('🌐 Testing js/lang/en.js language strings...')
  
  const langContent = fs.readFileSync('/app/js/lang/en.js', 'utf8')
  
  const checks = [
    {
      name: 'walletBalanceLowNgn function exists',
      pattern: /walletBalanceLowNgn:\s*\(needed,\s*balance\)\s*=>/,
      required: true
    },
    {
      name: 'ngnUnavailable string exists',
      pattern: /ngnUnavailable:\s*`.*NGN payment is temporarily unavailable.*exchange rate service is down.*`/,
      required: true
    }
  ]
  
  let passedChecks = 0
  let failedChecks = []
  
  for (const check of checks) {
    if (check.pattern.test(langContent)) {
      passedChecks++
      console.log(`   ✅ ${check.name}`)
    } else {
      failedChecks.push(check.name)
      console.log(`   ❌ ${check.name}`)
    }
  }
  
  if (passedChecks === checks.length) {
    testResults.langStrings.passed = true
    testResults.langStrings.details = `All ${checks.length} language string requirements verified`
  } else {
    testResults.langStrings.details = `${passedChecks}/${checks.length} checks passed. Failed: ${failedChecks.join(', ')}`
  }
  
  console.log(`\n   Result: ${testResults.langStrings.passed ? '✅ PASS' : '❌ FAIL'} - ${testResults.langStrings.details}\n`)
}

async function testSyntaxCheck() {
  console.log('✅ Testing syntax check for all files...')
  
  const filesToCheck = [
    '/app/js/utils.js',
    '/app/js/_index.js',
    '/app/js/hosting-scheduler.js',
    '/app/js/phone-scheduler.js',
    '/app/js/voice-service.js',
    '/app/js/sms-service.js',
    '/app/js/bulk-call-service.js',
    '/app/js/lang/en.js'
  ]
  
  let passedChecks = 0
  let failedChecks = []
  
  for (const file of filesToCheck) {
    try {
      const { execSync } = require('child_process')
      execSync(`node -c ${file}`, { stdio: 'pipe' })
      passedChecks++
      console.log(`   ✅ ${file} syntax OK`)
    } catch (error) {
      failedChecks.push(file)
      console.log(`   ❌ ${file} syntax error: ${error.message}`)
    }
  }
  
  if (passedChecks === filesToCheck.length) {
    testResults.syntaxCheck.passed = true
    testResults.syntaxCheck.details = `All ${filesToCheck.length} files pass syntax check`
  } else {
    testResults.syntaxCheck.details = `${passedChecks}/${filesToCheck.length} files pass syntax check. Failed: ${failedChecks.join(', ')}`
  }
  
  console.log(`\n   Result: ${testResults.syntaxCheck.passed ? '✅ PASS' : '❌ FAIL'} - ${testResults.syntaxCheck.details}\n`)
}

// Run the tests
runTests().then(results => {
  process.exit(results.passedTests === results.totalTests ? 0 : 1)
}).catch(error => {
  console.error('Test execution failed:', error)
  process.exit(1)
})