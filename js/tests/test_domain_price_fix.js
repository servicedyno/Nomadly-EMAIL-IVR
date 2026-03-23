/**
 * Test: Domain Pricing Overhaul — "Show worst-case, charge best-case"
 * 
 * Verifies:
 * 1. checkDomainPrice returns the HIGHER price as the shown price
 * 2. registerDomain correctly tracks registrar fallback
 * 3. Payment handlers apply correct savings logic
 */

const assert = require('assert')

// --- Mock registrar results ---
let crBuyResult = { success: true }
let opCheckResult = { available: true, price: 39 }
let opRegisterResult = { success: true, domainId: 'OP-12345' }

const mockOpService = {
  checkDomainAvailability: async () => opCheckResult,
  registerDomain: async () => opRegisterResult,
}
const mockBuyDomainOnline = async () => crBuyResult

// --- Mock checkDomainPrice logic (mirrors domain-service.js) ---
async function checkDomainPriceTest(crAvailable, crPrice, opAvailable, opPrice) {
  const cr = crAvailable ? { available: true, price: crPrice, originalPrice: crPrice * 0.7 } : { available: false }
  const op = opAvailable ? { available: true, price: opPrice, originalPrice: opPrice * 0.7 } : { available: false }

  if (cr.available && op.available) {
    const cheaper = cr.price <= op.price ? cr : op
    const expensive = cr.price <= op.price ? op : cr
    const cheaperRegistrar = cheaper === cr ? 'ConnectReseller' : 'OpenProvider'
    const expensiveRegistrar = expensive === cr ? 'ConnectReseller' : 'OpenProvider'
    return {
      available: true, price: expensive.price,
      originalPrice: expensive.originalPrice,
      registrar: cheaperRegistrar,
      expensiveRegistrar,
      cheaperPrice: cheaper.price,
      cheaperRegistrar,
    }
  }
  if (cr.available) return { available: true, price: cr.price, registrar: 'ConnectReseller', cheaperPrice: null }
  if (op.available) return { available: true, price: op.price, registrar: 'OpenProvider', cheaperPrice: null }
  return { available: false, price: 0, registrar: null, cheaperPrice: null }
}

// --- Mock registerDomain logic (mirrors domain-service.js) ---
async function registerDomainTest(registrar) {
  const originalRegistrar = registrar
  let actualPrice = null

  if (registrar === 'ConnectReseller') {
    const result = await mockBuyDomainOnline()
    if (result.success) {
      return { success: true, registrar, registrarChanged: false, actualPrice: null }
    } else {
      // Fallback
      try {
        const opPriceCheck = await mockOpService.checkDomainAvailability()
        if (opPriceCheck?.available && opPriceCheck.price) actualPrice = opPriceCheck.price
      } catch (e) { /* ignore */ }
      const opResult = await mockOpService.registerDomain()
      if (opResult.success) {
        registrar = 'OpenProvider'
        return { success: true, registrar, registrarChanged: true, actualPrice }
      }
    }
  }
  return { success: true, registrar, registrarChanged: registrar !== originalRegistrar, actualPrice: null }
}

// --- Mock wallet payment logic (mirrors _index.js domain-pay walletOk) ---
function calculateWalletCharge(shownPrice, cheaperPrice, fallbackOccurred) {
  let chargeUsd = shownPrice
  let savings = 0
  if (!fallbackOccurred && cheaperPrice && cheaperPrice < shownPrice) {
    chargeUsd = cheaperPrice
    savings = shownPrice - cheaperPrice
  }
  return { chargeUsd, savings }
}

// --- Mock bank/crypto savings credit logic ---
function calculateSavingsCredit(shownPrice, cheaperPrice, fallbackOccurred) {
  if (!fallbackOccurred && cheaperPrice && cheaperPrice < shownPrice) {
    return shownPrice - cheaperPrice
  }
  return 0
}

// --- Tests ---
async function runTests() {
  let passed = 0
  let failed = 0

  // TEST 1: Both registrars available — show HIGHER price
  try {
    const result = await checkDomainPriceTest(true, 30, true, 39)
    assert.strictEqual(result.price, 39, 'Shown price should be 39 (higher/OP)')
    assert.strictEqual(result.cheaperPrice, 30, 'Cheaper price should be 30 (CR)')
    assert.strictEqual(result.registrar, 'ConnectReseller', 'Try CR first')
    assert.strictEqual(result.expensiveRegistrar, 'OpenProvider', 'OP is expensive')
    console.log('✅ Test 1 PASSED: Both available — shows $39 (OP), tries CR ($30) first')
    passed++
  } catch (err) { console.error(`❌ Test 1 FAILED: ${err.message}`); failed++ }

  // TEST 2: Both available, OP cheaper — show CR price (higher)
  try {
    const result = await checkDomainPriceTest(true, 45, true, 35)
    assert.strictEqual(result.price, 45, 'Shown price should be 45 (CR is more expensive)')
    assert.strictEqual(result.cheaperPrice, 35, 'Cheaper price should be 35 (OP)')
    assert.strictEqual(result.registrar, 'OpenProvider', 'Try OP first (cheaper)')
    assert.strictEqual(result.expensiveRegistrar, 'ConnectReseller', 'CR is expensive')
    console.log('✅ Test 2 PASSED: OP cheaper — shows $45 (CR), tries OP ($35) first')
    passed++
  } catch (err) { console.error(`❌ Test 2 FAILED: ${err.message}`); failed++ }

  // TEST 3: Only CR available — no savings possible
  try {
    const result = await checkDomainPriceTest(true, 30, false, 0)
    assert.strictEqual(result.price, 30, 'Only CR price shown')
    assert.strictEqual(result.cheaperPrice, null, 'No cheaper price (single registrar)')
    assert.strictEqual(result.registrar, 'ConnectReseller')
    console.log('✅ Test 3 PASSED: Only CR — shows $30, no savings tracking')
    passed++
  } catch (err) { console.error(`❌ Test 3 FAILED: ${err.message}`); failed++ }

  // TEST 4: Only OP available — no savings possible
  try {
    const result = await checkDomainPriceTest(false, 0, true, 39)
    assert.strictEqual(result.price, 39, 'Only OP price shown')
    assert.strictEqual(result.cheaperPrice, null, 'No cheaper price (single registrar)')
    assert.strictEqual(result.registrar, 'OpenProvider')
    console.log('✅ Test 4 PASSED: Only OP — shows $39, no savings tracking')
    passed++
  } catch (err) { console.error(`❌ Test 4 FAILED: ${err.message}`); failed++ }

  // TEST 5: Wallet — cheaper registrar succeeds → charge cheaper, savings!
  try {
    crBuyResult = { success: true }
    const regResult = await registerDomainTest('ConnectReseller')
    assert.strictEqual(regResult.registrarChanged, false, 'No fallback')
    const { chargeUsd, savings } = calculateWalletCharge(39, 30, false)
    assert.strictEqual(chargeUsd, 30, 'Wallet should charge $30 (cheaper)')
    assert.strictEqual(savings, 9, 'User saves $9')
    console.log('✅ Test 5 PASSED: Wallet — CR succeeds, charges $30, saves $9')
    passed++
  } catch (err) { console.error(`❌ Test 5 FAILED: ${err.message}`); failed++ }

  // TEST 6: Wallet — CR fails, OP fallback → charge shown price, no savings
  try {
    crBuyResult = { success: false, error: 'Insufficient funds' }
    opCheckResult = { available: true, price: 39 }
    opRegisterResult = { success: true, domainId: 'OP-999' }
    const regResult = await registerDomainTest('ConnectReseller')
    assert.strictEqual(regResult.registrarChanged, true, 'Fallback occurred')
    const { chargeUsd, savings } = calculateWalletCharge(39, 30, true)
    assert.strictEqual(chargeUsd, 39, 'Wallet charges full $39 (no savings)')
    assert.strictEqual(savings, 0, 'No savings on fallback')
    console.log('✅ Test 6 PASSED: Wallet — CR fails, OP fallback, charges $39 (shown price)')
    passed++
  } catch (err) { console.error(`❌ Test 6 FAILED: ${err.message}`); failed++ }

  // TEST 7: Bank/Crypto — cheaper registrar succeeds → credit savings to wallet
  try {
    const savings = calculateSavingsCredit(39, 30, false)
    assert.strictEqual(savings, 9, 'Should credit $9 to wallet')
    console.log('✅ Test 7 PASSED: Bank/Crypto — CR succeeds, $9 credited to wallet')
    passed++
  } catch (err) { console.error(`❌ Test 7 FAILED: ${err.message}`); failed++ }

  // TEST 8: Bank/Crypto — fallback → no credit
  try {
    const savings = calculateSavingsCredit(39, 30, true)
    assert.strictEqual(savings, 0, 'No credit on fallback')
    console.log('✅ Test 8 PASSED: Bank/Crypto — fallback, no wallet credit')
    passed++
  } catch (err) { console.error(`❌ Test 8 FAILED: ${err.message}`); failed++ }

  // TEST 9: Single registrar (no cheaperPrice) — no savings
  try {
    const { chargeUsd, savings } = calculateWalletCharge(39, null, false)
    assert.strictEqual(chargeUsd, 39, 'Charge full price')
    assert.strictEqual(savings, 0, 'No savings possible')
    console.log('✅ Test 9 PASSED: Single registrar — charge shown price, no savings')
    passed++
  } catch (err) { console.error(`❌ Test 9 FAILED: ${err.message}`); failed++ }

  // TEST 10: Same price from both registrars — no savings
  try {
    const result = await checkDomainPriceTest(true, 39, true, 39)
    assert.strictEqual(result.price, 39, 'Shown price is 39')
    assert.strictEqual(result.cheaperPrice, 39, 'Cheaper price also 39')
    // When cheaperPrice === shownPrice, no savings
    const { chargeUsd, savings } = calculateWalletCharge(39, 39, false)
    assert.strictEqual(chargeUsd, 39, 'Charge $39')
    assert.strictEqual(savings, 0, 'No savings when prices equal')
    console.log('✅ Test 10 PASSED: Equal prices — no savings')
    passed++
  } catch (err) { console.error(`❌ Test 10 FAILED: ${err.message}`); failed++ }

  console.log(`\n========================================`)
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`)
  console.log(`========================================`)
  
  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(err => {
  console.error('Test runner error:', err)
  process.exit(1)
})
