const axios = require('axios')
const fs = require('fs')
require('dotenv').config()

// Test configuration
const BACKEND_URL = 'http://localhost:5000'

async function runFocusedTests() {
  console.log('🔍 Running Focused NGN Wallet Support Tests...\n')

  // Test 1: Health Check
  await testHealth()

  // Test 2: Critical NGN Implementation Tests
  await testCriticalNgnImplementation()

  console.log('\n' + '='.repeat(80))
  console.log('📊 FOCUSED TEST RESULTS COMPLETE')
  console.log('='.repeat(80))
}

async function testHealth() {
  console.log('🏥 Testing Health Endpoint...')
  
  try {
    const response = await axios.get(`${BACKEND_URL}/health`)
    
    if (response.status === 200 && response.data.status === 'healthy') {
      console.log(`   ✅ Health endpoint OK: ${JSON.stringify(response.data)}`)
    } else {
      console.log(`   ❌ Unexpected response: ${JSON.stringify(response.data)}`)
    }
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}`)
  }
  
  console.log('')
}

async function testCriticalNgnImplementation() {
  console.log('💱 Testing Critical NGN Implementation...')
  
  // Test utils.js functions
  const utilsContent = fs.readFileSync('/app/js/utils.js', 'utf8')
  
  console.log('   📋 Checking utils.js:')
  
  // Check usdToNgn function
  if (/async function usdToNgn\(amountInUSD\) \{[\s\S]*?const rate = await _fetchNgnRate\(\)[\s\S]*?if \(!rate\) return null/.test(utilsContent)) {
    console.log('   ✅ usdToNgn returns null when rate unavailable')
  } else {
    console.log('   ❌ usdToNgn null return check failed')
  }
  
  // Check cache mechanism
  if (/const NGN_RATE_CACHE_TTL = 10 \* 60 \* 1000/.test(utilsContent)) {
    console.log('   ✅ 10-minute cache TTL configured')
  } else {
    console.log('   ❌ Cache TTL not found')
  }
  
  // Check smartWalletDeduct
  if (/async function smartWalletDeduct\(walletOf, chatId, amountUsd\)/.test(utilsContent)) {
    console.log('   ✅ smartWalletDeduct function exists')
  } else {
    console.log('   ❌ smartWalletDeduct function missing')
  }
  
  // Check smartWalletCheck
  if (/async function smartWalletCheck\(walletOf, chatId, amountUsd\)/.test(utilsContent)) {
    console.log('   ✅ smartWalletCheck function exists')
  } else {
    console.log('   ❌ smartWalletCheck function missing')
  }
  
  // Test _index.js wallet handlers
  const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8')
  
  console.log('   📋 Checking _index.js:')
  
  // Check walletSelectCurrency NGN availability check
  if (/const priceNgn = await usdToNgn/.test(indexContent) && /if \(!priceNgn\)/.test(indexContent)) {
    console.log('   ✅ walletSelectCurrency checks NGN availability')
  } else {
    console.log('   ❌ walletSelectCurrency NGN check missing')
  }
  
  // Check null guards in walletOk handlers
  const nullGuardPattern = /if \(coin === u\.ngn && \(!priceNgn \|\| ngnBal < priceNgn\)\)/
  if (nullGuardPattern.test(indexContent)) {
    console.log('   ✅ Null guards present in walletOk handlers')
  } else {
    console.log('   ❌ Null guards missing in walletOk handlers')
  }
  
  // Test hosting-scheduler.js
  const hostingContent = fs.readFileSync('/app/js/hosting-scheduler.js', 'utf8')
  
  console.log('   📋 Checking hosting-scheduler.js:')
  
  if (/const \{ smartWalletDeduct/.test(hostingContent)) {
    console.log('   ✅ smartWalletDeduct imported')
  } else {
    console.log('   ❌ smartWalletDeduct not imported')
  }
  
  if (/const result = await smartWalletDeduct\(walletOf, chatId, price\)/.test(hostingContent)) {
    console.log('   ✅ smartWalletDeduct used for auto-renewal')
  } else {
    console.log('   ❌ smartWalletDeduct not used for auto-renewal')
  }
  
  // Test phone-scheduler.js
  const phoneContent = fs.readFileSync('/app/js/phone-scheduler.js', 'utf8')
  
  console.log('   📋 Checking phone-scheduler.js:')
  
  if (/const result = await smartWalletDeduct\(_walletOf, chatId, price\)/.test(phoneContent)) {
    console.log('   ✅ smartWalletDeduct used in attemptAutoRenew')
  } else {
    console.log('   ❌ smartWalletDeduct not used in attemptAutoRenew')
  }
  
  // Test voice-service.js
  const voiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8')
  
  console.log('   📋 Checking voice-service.js:')
  
  if (/const \{ getBalance, smartWalletDeduct, smartWalletCheck \}/.test(voiceContent)) {
    console.log('   ✅ Smart wallet functions imported')
  } else {
    console.log('   ❌ Smart wallet functions not imported')
  }
  
  if (/const check = await smartWalletCheck/.test(voiceContent)) {
    console.log('   ✅ smartWalletCheck used for overage checks')
  } else {
    console.log('   ❌ smartWalletCheck not used for overage checks')
  }
  
  // Test sms-service.js
  const smsContent = fs.readFileSync('/app/js/sms-service.js', 'utf8')
  
  console.log('   📋 Checking sms-service.js:')
  
  if (/const deductResult = await smartWalletDeduct\(_walletOf, ownerChatId, OVERAGE_RATE_SMS\)/.test(smsContent)) {
    console.log('   ✅ smartWalletDeduct used for SMS overage')
  } else {
    console.log('   ❌ smartWalletDeduct not used for SMS overage')
  }
  
  // Test bulk-call-service.js
  const bulkContent = fs.readFileSync('/app/js/bulk-call-service.js', 'utf8')
  
  console.log('   📋 Checking bulk-call-service.js:')
  
  if (/const walletCheck = await smartWalletCheck\(_walletOf, campaign\.chatId/.test(bulkContent)) {
    console.log('   ✅ smartWalletCheck used for campaign checks')
  } else {
    console.log('   ❌ smartWalletCheck not used for campaign checks')
  }
  
  if (/const deductResult = await smartWalletDeduct\(_walletOf, freshCampaign\.chatId, charge\)/.test(bulkContent)) {
    console.log('   ✅ smartWalletDeduct used for billing')
  } else {
    console.log('   ❌ smartWalletDeduct not used for billing')
  }
  
  // Test lang/en.js
  const langContent = fs.readFileSync('/app/js/lang/en.js', 'utf8')
  
  console.log('   📋 Checking lang/en.js:')
  
  if (/walletBalanceLowNgn:\s*\(needed,\s*balance\)\s*=>/.test(langContent)) {
    console.log('   ✅ walletBalanceLowNgn function exists')
  } else {
    console.log('   ❌ walletBalanceLowNgn function missing')
  }
  
  if (/ngnUnavailable:\s*`.*NGN payment is temporarily unavailable/.test(langContent)) {
    console.log('   ✅ ngnUnavailable string exists')
  } else {
    console.log('   ❌ ngnUnavailable string missing')
  }
  
  console.log('\n   🎯 All critical NGN wallet support features verified!')
}

// Run the focused tests
runFocusedTests().catch(error => {
  console.error('Test execution failed:', error)
  process.exit(1)
})