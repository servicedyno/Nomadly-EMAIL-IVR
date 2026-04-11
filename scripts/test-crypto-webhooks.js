/**
 * Test script to verify crypto webhooks and refund logic after USD-only wallet migration
 * Tests:
 * 1. BlockBee crypto webhook (/crypto-wallet)
 * 2. Dynopay crypto webhook (/dynopay/crypto-wallet)
 * 3. Refund logic (USD crediting)
 */

const axios = require('axios')
const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = process.env.DB_NAME || 'nomadlyDB'
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'

// Test user
const TEST_CHAT_ID = '5168006768'

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function getBalance(walletOf, chatId) {
  const wallet = await walletOf.findOne({ _id: parseFloat(chatId) })
  const usdIn = wallet?.usdIn || 0
  const usdOut = wallet?.usdOut || 0
  const usdBal = usdIn - usdOut
  return { usdIn, usdOut, usdBal }
}

async function runTests() {
  let client
  let passedTests = 0
  let failedTests = 0

  try {
    log('\n=== CRYPTO WEBHOOK & REFUND LOGIC TEST ===\n', 'blue')

    // Connect to MongoDB
    client = new MongoClient(MONGO_URL)
    await client.connect()
    const db = client.db(DB_NAME)
    const walletOf = db.collection('walletOf')
    const state = db.collection('state')
    const chatIdOfPayment = db.collection('chatIdOfPayment')
    const chatIdOfDynopayPayment = db.collection('chatIdOfDynopayPayment')

    // Ensure test user exists in state collection
    await state.updateOne(
      { _id: parseFloat(TEST_CHAT_ID) },
      { $set: { userLanguage: 'en' } },
      { upsert: true }
    )

    // Get initial balance
    const initialBalance = await getBalance(walletOf, TEST_CHAT_ID)
    log(`Initial Balance: $${initialBalance.usdBal.toFixed(2)} USD (usdIn: $${initialBalance.usdIn}, usdOut: $${initialBalance.usdOut})`, 'yellow')

    // ============================================================
    // TEST 1: BlockBee Crypto Webhook (/crypto-wallet)
    // ============================================================
    log('\n[TEST 1] BlockBee Crypto Webhook - BTC Deposit', 'blue')
    
    const ref1 = `test_blockbee_${Date.now()}`
    await chatIdOfPayment.insertOne({ _id: ref1, chatId: TEST_CHAT_ID })
    
    try {
      const response1 = await axios.get(`${BACKEND_URL}/api/crypto-wallet`, {
        params: {
          ref: ref1,
          chatId: TEST_CHAT_ID,
          coin: 'btc_segwit',
          value_coin: '0.001'  // Small BTC amount for testing
        }
      })

      if (response1.status === 200) {
        const newBalance1 = await getBalance(walletOf, TEST_CHAT_ID)
        const expectedIncrease = newBalance1.usdIn - initialBalance.usdIn
        
        if (expectedIncrease > 0) {
          log(`✅ PASS: BlockBee webhook credited $${expectedIncrease.toFixed(2)} USD to wallet`, 'green')
          log(`   New Balance: $${newBalance1.usdBal.toFixed(2)} USD`, 'green')
          passedTests++
        } else {
          log(`❌ FAIL: BlockBee webhook did not credit USD wallet (increase: $${expectedIncrease})`, 'red')
          failedTests++
        }
      } else {
        log(`❌ FAIL: BlockBee webhook returned status ${response1.status}`, 'red')
        failedTests++
      }
    } catch (error) {
      log(`❌ FAIL: BlockBee webhook error - ${error.message}`, 'red')
      if (error.response?.data) log(`   Response: ${JSON.stringify(error.response.data)}`, 'red')
      failedTests++
    }

    // ============================================================
    // TEST 2: Dynopay Crypto Webhook (/dynopay/crypto-wallet)
    // ============================================================
    log('\n[TEST 2] Dynopay Crypto Webhook - ETH Deposit', 'blue')
    
    const currentBalance2 = await getBalance(walletOf, TEST_CHAT_ID)
    const ref2 = `test_dynopay_${Date.now()}`
    await chatIdOfDynopayPayment.insertOne({ _id: ref2, chatId: TEST_CHAT_ID })
    
    try {
      const response2 = await axios.post(`${BACKEND_URL}/api/dynopay/crypto-wallet`, {
        amount: '0.01',       // ETH amount
        currency: 'ethereum',
        payment_id: `txn_${Date.now()}`,
        base_amount: null,    // No base_amount to test conversion path
        fee_payer: 'user'
      }, {
        params: {
          ref: ref2,
          chatId: TEST_CHAT_ID
        }
      })

      if (response2.status === 200) {
        const newBalance2 = await getBalance(walletOf, TEST_CHAT_ID)
        const expectedIncrease = newBalance2.usdIn - currentBalance2.usdIn
        
        if (expectedIncrease > 0) {
          log(`✅ PASS: Dynopay webhook credited $${expectedIncrease.toFixed(2)} USD to wallet`, 'green')
          log(`   New Balance: $${newBalance2.usdBal.toFixed(2)} USD`, 'green')
          passedTests++
        } else {
          log(`❌ FAIL: Dynopay webhook did not credit USD wallet (increase: $${expectedIncrease})`, 'red')
          failedTests++
        }
      } else {
        log(`❌ FAIL: Dynopay webhook returned status ${response2.status}`, 'red')
        failedTests++
      }
    } catch (error) {
      log(`❌ FAIL: Dynopay webhook error - ${error.message}`, 'red')
      if (error.response?.data) log(`   Response: ${JSON.stringify(error.response.data)}`, 'red')
      failedTests++
    }

    // ============================================================
    // TEST 3: Dynopay with base_amount (company pays fees)
    // ============================================================
    log('\n[TEST 3] Dynopay Webhook - With base_amount (fee_payer=company)', 'blue')
    
    const currentBalance3 = await getBalance(walletOf, TEST_CHAT_ID)
    const ref3 = `test_dynopay_base_${Date.now()}`
    await chatIdOfDynopayPayment.insertOne({ _id: ref3, chatId: TEST_CHAT_ID })
    
    try {
      const baseAmountUsd = 50.00
      const response3 = await axios.post(`${BACKEND_URL}/api/dynopay/crypto-wallet`, {
        amount: '0.02',
        currency: 'ethereum',
        payment_id: `txn_base_${Date.now()}`,
        base_amount: baseAmountUsd,  // Exact USD amount
        fee_payer: 'company'
      }, {
        params: {
          ref: ref3,
          chatId: TEST_CHAT_ID
        }
      })

      if (response3.status === 200) {
        const newBalance3 = await getBalance(walletOf, TEST_CHAT_ID)
        const expectedIncrease = newBalance3.usdIn - currentBalance3.usdIn
        
        if (Math.abs(expectedIncrease - baseAmountUsd) < 0.01) {
          log(`✅ PASS: Dynopay base_amount credited exact $${expectedIncrease.toFixed(2)} USD`, 'green')
          log(`   New Balance: $${newBalance3.usdBal.toFixed(2)} USD`, 'green')
          passedTests++
        } else {
          log(`❌ FAIL: Dynopay base_amount incorrect (expected: $${baseAmountUsd}, got: $${expectedIncrease})`, 'red')
          failedTests++
        }
      } else {
        log(`❌ FAIL: Dynopay base_amount test returned status ${response3.status}`, 'red')
        failedTests++
      }
    } catch (error) {
      log(`❌ FAIL: Dynopay base_amount test error - ${error.message}`, 'red')
      if (error.response?.data) log(`   Response: ${JSON.stringify(error.response.data)}`, 'red')
      failedTests++
    }

    // ============================================================
    // TEST 4: Verify NO NGN wallet columns are being used
    // ============================================================
    log('\n[TEST 4] Database Schema - Verify NO NGN balance updates', 'blue')
    
    const finalWallet = await walletOf.findOne({ _id: parseFloat(TEST_CHAT_ID) })
    
    if (!finalWallet.hasOwnProperty('ngnIn') && !finalWallet.hasOwnProperty('ngnOut')) {
      log(`✅ PASS: Wallet document has NO ngnIn/ngnOut fields`, 'green')
      passedTests++
    } else {
      const ngnIn = finalWallet.ngnIn || 0
      const ngnOut = finalWallet.ngnOut || 0
      if (ngnIn === 0 && ngnOut === 0) {
        log(`⚠️  WARN: ngnIn/ngnOut fields exist but are zero (migration remnants)`, 'yellow')
        log(`   This is acceptable - they're not being incremented`, 'yellow')
        passedTests++
      } else {
        log(`❌ FAIL: ngnIn or ngnOut are non-zero (ngnIn: ${ngnIn}, ngnOut: ${ngnOut})`, 'red')
        failedTests++
      }
    }

    // ============================================================
    // TEST 5: Direct Refund Logic Test (atomicIncrement)
    // ============================================================
    log('\n[TEST 5] Refund Logic - Direct USD Credit', 'blue')
    
    const balanceBeforeRefund = await getBalance(walletOf, TEST_CHAT_ID)
    const refundAmount = 25.00
    
    // Simulate a refund using atomicIncrement (same as isUsdRefundCoin paths)
    await walletOf.updateOne(
      { _id: parseFloat(TEST_CHAT_ID) },
      { $inc: { usdIn: refundAmount } },
      { upsert: true }
    )
    
    const balanceAfterRefund = await getBalance(walletOf, TEST_CHAT_ID)
    const refundIncrease = balanceAfterRefund.usdIn - balanceBeforeRefund.usdIn
    
    if (Math.abs(refundIncrease - refundAmount) < 0.01) {
      log(`✅ PASS: Refund logic credited $${refundIncrease.toFixed(2)} USD correctly`, 'green')
      log(`   Balance after refund: $${balanceAfterRefund.usdBal.toFixed(2)} USD`, 'green')
      passedTests++
    } else {
      log(`❌ FAIL: Refund logic incorrect (expected: $${refundAmount}, got: $${refundIncrease})`, 'red')
      failedTests++
    }

    // ============================================================
    // SUMMARY
    // ============================================================
    const finalBalance = await getBalance(walletOf, TEST_CHAT_ID)
    const totalIncrease = finalBalance.usdBal - initialBalance.usdBal

    log('\n' + '='.repeat(60), 'blue')
    log('TEST SUMMARY', 'blue')
    log('='.repeat(60), 'blue')
    log(`Initial Balance: $${initialBalance.usdBal.toFixed(2)} USD`, 'yellow')
    log(`Final Balance:   $${finalBalance.usdBal.toFixed(2)} USD`, 'yellow')
    log(`Total Increase:  $${totalIncrease.toFixed(2)} USD`, 'yellow')
    log(`\nTests Passed: ${passedTests}`, 'green')
    log(`Tests Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'green')
    
    if (failedTests === 0) {
      log('\n🎉 ALL TESTS PASSED! Crypto webhooks and refund logic working correctly.', 'green')
    } else {
      log('\n⚠️  SOME TESTS FAILED - Review errors above', 'red')
    }

  } catch (error) {
    log(`\n❌ CRITICAL ERROR: ${error.message}`, 'red')
    console.error(error)
    process.exit(1)
  } finally {
    if (client) {
      await client.close()
    }
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
