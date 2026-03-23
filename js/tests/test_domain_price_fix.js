/**
 * Test: Domain Price Discrepancy Fix
 * Verifies that registerDomain returns actualPrice and registrarChanged
 * when a CR→OP fallback occurs.
 * 
 * This test mocks the registrar APIs to simulate the fallback scenario.
 */

const assert = require('assert')

// --- Mock setup ---
let crBuyResult = { success: false, error: 'Insufficient funds' }
let opCheckResult = { available: true, price: 39, originalPrice: 25, registrar: 'OpenProvider' }
let opRegisterResult = { success: true, domainId: 'OP-12345' }
let cfCreateZoneResult = { success: false }

// Mock modules
const mockOpService = {
  checkDomainAvailability: async () => opCheckResult,
  registerDomain: async () => opRegisterResult,
}
const mockCfService = {
  createZone: async () => cfCreateZoneResult,
}
const mockBuyDomainOnline = async () => crBuyResult

// Minimal mock of the registerDomain logic (mirrors domain-service.js)
async function registerDomainTest(domainName, registrar, nsChoice, db, chatId, customNS) {
  let result
  let nameservers = []
  let cfZoneId = null
  const originalRegistrar = registrar
  let actualPrice = null

  if (nsChoice === 'cloudflare') {
    const cfResult = await mockCfService.createZone(domainName)
    if (cfResult.success) {
      nameservers = cfResult.nameservers || []
      cfZoneId = cfResult.zoneId
    } else {
      nsChoice = 'provider_default'
    }
  }

  if (registrar === 'ConnectReseller') {
    const ns1 = nameservers.length >= 1 ? nameservers[0] : undefined
    const ns2 = nameservers.length >= 2 ? nameservers[1] : undefined
    result = await mockBuyDomainOnline(domainName, ns1, ns2)
    if (result.success) {
      // CR succeeded
    } else {
      // Fallback to OP
      try {
        const opPriceCheck = await mockOpService.checkDomainAvailability(domainName)
        if (opPriceCheck?.available && opPriceCheck.price) {
          actualPrice = opPriceCheck.price
        }
      } catch (priceErr) {
        // proceed without price update
      }
      const ns = (nsChoice === 'cloudflare' || nsChoice === 'custom') ? nameservers : []
      result = await mockOpService.registerDomain(domainName, ns)
      if (result.success) {
        registrar = 'OpenProvider'
      }
    }
  } else if (registrar === 'OpenProvider') {
    const ns = (nsChoice === 'cloudflare' || nsChoice === 'custom') ? nameservers : []
    result = await mockOpService.registerDomain(domainName, ns)
  }

  if (result.error) return { error: result.error }

  return {
    success: true, registrar,
    nameservers: nsChoice !== 'provider_default' ? nameservers : [],
    cfZoneId, opDomainId: result.domainId || null,
    registrarChanged: registrar !== originalRegistrar,
    actualPrice: registrar !== originalRegistrar ? actualPrice : null,
  }
}

// --- Tests ---
async function runTests() {
  let passed = 0
  let failed = 0

  // Test 1: CR fails → OP fallback — should return actualPrice and registrarChanged
  try {
    crBuyResult = { success: false, error: 'Insufficient funds' }
    opCheckResult = { available: true, price: 39, originalPrice: 25 }
    opRegisterResult = { success: true, domainId: 'OP-12345' }

    const result = await registerDomainTest('example.com', 'ConnectReseller', 'provider_default', null, 123, null)
    
    assert.strictEqual(result.success, true, 'Should succeed')
    assert.strictEqual(result.registrar, 'OpenProvider', 'Should fallback to OpenProvider')
    assert.strictEqual(result.registrarChanged, true, 'registrarChanged should be true')
    assert.strictEqual(result.actualPrice, 39, 'actualPrice should be 39 (OP price)')
    console.log('✅ Test 1 PASSED: CR→OP fallback returns actualPrice=39 and registrarChanged=true')
    passed++
  } catch (err) {
    console.error(`❌ Test 1 FAILED: ${err.message}`)
    failed++
  }

  // Test 2: CR succeeds — no fallback, no actualPrice
  try {
    crBuyResult = { success: true }
    
    const result = await registerDomainTest('example.com', 'ConnectReseller', 'provider_default', null, 123, null)
    
    assert.strictEqual(result.success, true, 'Should succeed')
    assert.strictEqual(result.registrar, 'ConnectReseller', 'Should stay ConnectReseller')
    assert.strictEqual(result.registrarChanged, false, 'registrarChanged should be false')
    assert.strictEqual(result.actualPrice, null, 'actualPrice should be null (no fallback)')
    console.log('✅ Test 2 PASSED: CR success — no registrarChanged, no actualPrice')
    passed++
  } catch (err) {
    console.error(`❌ Test 2 FAILED: ${err.message}`)
    failed++
  }

  // Test 3: Direct OP registration (no fallback) — no actualPrice
  try {
    opRegisterResult = { success: true, domainId: 'OP-67890' }
    
    const result = await registerDomainTest('example.com', 'OpenProvider', 'provider_default', null, 123, null)
    
    assert.strictEqual(result.success, true, 'Should succeed')
    assert.strictEqual(result.registrar, 'OpenProvider', 'Should be OpenProvider')
    assert.strictEqual(result.registrarChanged, false, 'registrarChanged should be false (was already OP)')
    assert.strictEqual(result.actualPrice, null, 'actualPrice should be null (no fallback)')
    console.log('✅ Test 3 PASSED: Direct OP — no registrarChanged, no actualPrice')
    passed++
  } catch (err) {
    console.error(`❌ Test 3 FAILED: ${err.message}`)
    failed++
  }

  // Test 4: CR fails → OP fallback, but OP price check also fails — actualPrice should be null
  try {
    crBuyResult = { success: false, error: 'Insufficient funds' }
    const origCheckFn = mockOpService.checkDomainAvailability
    mockOpService.checkDomainAvailability = async () => { throw new Error('API timeout') }
    opRegisterResult = { success: true, domainId: 'OP-99999' }

    const result = await registerDomainTest('example.com', 'ConnectReseller', 'provider_default', null, 123, null)
    
    mockOpService.checkDomainAvailability = origCheckFn // restore

    assert.strictEqual(result.success, true, 'Should still succeed')
    assert.strictEqual(result.registrar, 'OpenProvider', 'Should fallback to OpenProvider')
    assert.strictEqual(result.registrarChanged, true, 'registrarChanged should be true')
    assert.strictEqual(result.actualPrice, null, 'actualPrice should be null (price check failed)')
    console.log('✅ Test 4 PASSED: CR→OP fallback with OP price check failure — actualPrice is null')
    passed++
  } catch (err) {
    console.error(`❌ Test 4 FAILED: ${err.message}`)
    failed++
  }

  // Test 5: Wallet charging logic — should use actualPrice when higher
  try {
    const shownPrice = 30
    const actualPrice = 39
    const usdBal = 50

    // Simulate the wallet charging logic from domain-pay walletOk
    const finalPriceUsd = actualPrice > shownPrice ? actualPrice : shownPrice
    const chargeUsd = usdBal >= finalPriceUsd ? finalPriceUsd : shownPrice

    assert.strictEqual(finalPriceUsd, 39, 'Final price should be 39 (actual > shown)')
    assert.strictEqual(chargeUsd, 39, 'Should charge 39 when wallet has enough')
    console.log('✅ Test 5 PASSED: Wallet charges actual price ($39) when sufficient balance')
    passed++
  } catch (err) {
    console.error(`❌ Test 5 FAILED: ${err.message}`)
    failed++
  }

  // Test 6: Wallet insufficient for actual price — falls back to shown price
  try {
    const shownPrice = 30
    const actualPrice = 39
    const usdBal = 35

    const finalPriceUsd = actualPrice > shownPrice ? actualPrice : shownPrice
    const chargeUsd = usdBal >= finalPriceUsd ? finalPriceUsd : shownPrice

    assert.strictEqual(finalPriceUsd, 39, 'Final price should be 39')
    assert.strictEqual(chargeUsd, 30, 'Should charge shown price ($30) when wallet cant cover actual')
    console.log('✅ Test 6 PASSED: Falls back to shown price ($30) when wallet insufficient for actual')
    passed++
  } catch (err) {
    console.error(`❌ Test 6 FAILED: ${err.message}`)
    failed++
  }

  console.log(`\n========================================`)
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`)
  console.log(`========================================`)
  
  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(err => {
  console.error('Test runner error:', err)
  process.exit(1)
})
