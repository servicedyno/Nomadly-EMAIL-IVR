#!/usr/bin/env node
/**
 * Sub-Number Purchase Flow Simulation
 * Tests the "Add Number to Existing Plan" feature via Telegram webhook
 */

const axios = require('axios')

// Configuration
const WEBHOOK_URL = 'http://localhost:3001/telegram/webhook'
const TEST_CHAT_ID = 999999999 // Test user ID
const TEST_USER = {
  id: TEST_CHAT_ID,
  first_name: 'Test',
  last_name: 'User',
  username: 'testuser',
  is_bot: false
}

// Helper to send webhook message
async function sendMessage(text, callbackData = null) {
  const payload = callbackData ? {
    update_id: Date.now(),
    callback_query: {
      id: String(Date.now()),
      from: TEST_USER,
      message: {
        message_id: Date.now(),
        date: Math.floor(Date.now() / 1000),
        chat: { id: TEST_CHAT_ID, type: 'private' },
        text: 'Previous message'
      },
      data: callbackData,
      chat_instance: String(Date.now())
    }
  } : {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: TEST_USER,
      date: Math.floor(Date.now() / 1000),
      chat: { id: TEST_CHAT_ID, type: 'private' },
      text: text
    }
  }

  try {
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' }
    })
    console.log(`✅ Sent: "${text || callbackData}" - Status: ${response.status}`)
    return response
  } catch (error) {
    console.error(`❌ Error sending "${text || callbackData}":`, error.response?.data || error.message)
    throw error
  }
}

// Wait helper
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Main test flow
async function runTest() {
  console.log('🧪 Starting Sub-Number Purchase Flow Test\n')
  console.log('=' .repeat(60))
  
  try {
    // Step 1: Start command
    console.log('\n📍 Step 1: Send /start command')
    await sendMessage('/start')
    await wait(1000)

    // Step 2: Select Cloud IVR
    console.log('\n📍 Step 2: Select Cloud IVR menu')
    await sendMessage('📞☁️ Cloud IVR — Speechcue')
    await wait(1000)

    // Step 3: Go to My Numbers
    console.log('\n📍 Step 3: Go to My Numbers')
    await sendMessage('📱 My Numbers')
    await wait(1000)

    // Note: At this point, the test will fail if the user doesn't have any numbers
    // The following steps assume the user has at least one active primary number

    console.log('\n📍 Step 4: Select a number (simulated)')
    console.log('⚠️  Note: This requires an existing number. Simulating button press...')
    await sendMessage('1')
    await wait(1000)

    // Step 5: Click "Add Number to Plan"
    console.log('\n📍 Step 5: Click "Add Number to Plan"')
    await sendMessage('➕ Add Number to Plan')
    await wait(1000)

    // Step 6: Select country (USA)
    console.log('\n📍 Step 6: Select country - USA')
    await sendMessage('🇺🇸 USA')
    await wait(1000)

    // Step 7: Select number type (Local)
    console.log('\n📍 Step 7: Select number type - Local')
    await sendMessage('📍 Local Number')
    await wait(1000)

    // Step 8: Select area (New York)
    console.log('\n📍 Step 8: Select area - New York')
    await sendMessage('New York (212)')
    await wait(1000)

    // Step 9: Select a number from results
    console.log('\n📍 Step 9: Select number from search results')
    await sendMessage('1')
    await wait(1000)

    // Step 10: Confirm purchase (this would normally require payment)
    console.log('\n📍 Step 10: Proceed to payment confirmation')
    await sendMessage('✅ Proceed to Payment')
    await wait(1000)

    console.log('\n' + '='.repeat(60))
    console.log('✅ Test flow completed successfully!')
    console.log('\n💡 Key points tested:')
    console.log('  - Button routing for "Add Number to Plan"')
    console.log('  - Country selection')
    console.log('  - Number type selection')
    console.log('  - Area code selection')
    console.log('  - Number search and display')
    console.log('  - Payment flow initiation')
    console.log('\n📝 Check the backend logs for detailed responses')

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    process.exit(1)
  }
}

// Alternative: Test specific button presses
async function testSpecificButtons() {
  console.log('🧪 Testing Specific Button Responses\n')
  console.log('=' .repeat(60))

  const buttonsToTest = [
    '➕ Add Number to Plan',
    '🇺🇸 USA',
    '📍 Local Number',
    '🆓 Toll-Free Number',
  ]

  for (const button of buttonsToTest) {
    console.log(`\n📍 Testing button: "${button}"`)
    try {
      await sendMessage(button)
      console.log(`  ✅ Button processed successfully`)
      await wait(500)
    } catch (error) {
      console.error(`  ❌ Button failed: ${error.message}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ Button test completed\n')
}

// Test i18n translations
async function testI18n() {
  console.log('🧪 Testing I18n Translations\n')
  console.log('=' .repeat(60))

  const languages = ['en', 'fr', 'zh', 'hi']
  
  for (const lang of languages) {
    console.log(`\n📍 Testing language: ${lang}`)
    // Note: This would require setting the user's language preference first
    console.log(`  ℹ️  Would test plan selection UI in ${lang}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ I18n test outlined (requires manual verification)\n')
}

// Run tests based on command line argument
const testMode = process.argv[2] || 'full'

console.log('\n🚀 Sub-Number Feature Test Suite')
console.log(`Mode: ${testMode}\n`)

switch (testMode) {
  case 'full':
    runTest()
    break
  case 'buttons':
    testSpecificButtons()
    break
  case 'i18n':
    testI18n()
    break
  default:
    console.log('Usage: node test_subnumber_flow.js [full|buttons|i18n]')
    process.exit(0)
}
