/**
 * Test: BulkIVR Smart Wallet Requirement
 * 
 * Verifies:
 * 1. First-time users must have $50 minimum
 * 2. Returning users with zero balance must have $50 minimum
 * 3. Returning users with existing balance can start campaigns (no $50 block)
 * 4. Low balance warning shown when balance < estimated cost
 * 5. Pre-campaign estimate shown when balance is sufficient
 */

const assert = require('assert')

const BULK_CALL_RATE = 0.15
const BULK_CALL_MIN_WALLET = 50

// Mock wallet check
function smartWalletCheck(usdBal, ngnBal, requiredUsd) {
  return { sufficient: usdBal >= requiredUsd, usdBal, ngnBal }
}

// Core decision logic extracted from bulk-call-service.js
function preCampaignCheck(usdBal, ngnBal, pastCampaignCount, leadsCount) {
  const walletCheck = smartWalletCheck(usdBal, ngnBal, BULK_CALL_RATE)
  const isFirstCampaign = pastCampaignCount === 0
  const isNearZero = !walletCheck.sufficient  // can't cover even one call

  // First-time or zero-balance → enforce $50 minimum
  if (isFirstCampaign || isNearZero) {
    const fullCheck = smartWalletCheck(usdBal, ngnBal, BULK_CALL_MIN_WALLET)
    if (!fullCheck.sufficient) {
      return { blocked: true, reason: isFirstCampaign ? 'first_time' : 'zero_balance' }
    }
  }

  // Estimate check
  const minRequired = BULK_CALL_RATE * leadsCount
  const costCheck = smartWalletCheck(usdBal, ngnBal, minRequired)
  const estLeadsCovered = Math.floor(Math.max(usdBal, 0) / BULK_CALL_RATE)

  return {
    blocked: false,
    lowBalance: !costCheck.sufficient,
    estLeadsCovered,
    minRequired,
  }
}

// --- Tests ---
let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`✅ ${name}`)
    passed++
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`)
    failed++
  }
}

// Test 1: First-time user with $20 → BLOCKED
test('First-time user, $20 balance → blocked', () => {
  const result = preCampaignCheck(20, 0, 0, 50)
  assert.strictEqual(result.blocked, true)
  assert.strictEqual(result.reason, 'first_time')
})

// Test 2: First-time user with $50 → ALLOWED
test('First-time user, $50 balance → allowed', () => {
  const result = preCampaignCheck(50, 0, 0, 50)
  assert.strictEqual(result.blocked, false)
})

// Test 3: Returning user with $0 → BLOCKED (zero balance)
test('Returning user, $0 balance → blocked', () => {
  const result = preCampaignCheck(0, 0, 3, 50)
  assert.strictEqual(result.blocked, true)
  assert.strictEqual(result.reason, 'zero_balance')
})

// Test 4: Returning user with $0.10 (< one call cost) → BLOCKED
test('Returning user, $0.10 balance → blocked (cant cover one call)', () => {
  const result = preCampaignCheck(0.10, 0, 5, 50)
  assert.strictEqual(result.blocked, true)
  assert.strictEqual(result.reason, 'zero_balance')
})

// Test 5: Returning user with $5 → ALLOWED (low balance warning)
test('Returning user, $5 balance → allowed with low balance warning', () => {
  const result = preCampaignCheck(5, 0, 2, 100)
  assert.strictEqual(result.blocked, false)
  assert.strictEqual(result.lowBalance, true)
  assert.strictEqual(result.estLeadsCovered, 33)  // 5 / 0.15 = 33
})

// Test 6: Returning user with $25 → ALLOWED (smaller campaign)
test('Returning user, $25, 50 leads → allowed, no low balance', () => {
  const result = preCampaignCheck(25, 0, 4, 50)
  assert.strictEqual(result.blocked, false)
  // $25 >= 50 * 0.15 = $7.50 → sufficient
  assert.strictEqual(result.lowBalance, false)
})

// Test 7: Returning user with $3, 100 leads → ALLOWED but low balance
test('Returning user, $3, 100 leads → allowed, low balance warning', () => {
  const result = preCampaignCheck(3, 0, 1, 100)
  assert.strictEqual(result.blocked, false)
  assert.strictEqual(result.lowBalance, true)
  assert.strictEqual(result.estLeadsCovered, 20)  // 3 / 0.15 = 20
})

// Test 8: First-time user with $100 → ALLOWED, full estimate
test('First-time user, $100, 200 leads → allowed, sufficient', () => {
  const result = preCampaignCheck(100, 0, 0, 200)
  assert.strictEqual(result.blocked, false)
  assert.strictEqual(result.lowBalance, false)
})

// Test 9: Returning user, $0.15 exactly (one call) → ALLOWED
test('Returning user, $0.15 (exactly one call) → allowed', () => {
  const result = preCampaignCheck(0.15, 0, 2, 10)
  assert.strictEqual(result.blocked, false)
})

// Test 10: Returning user with $0.14 (< one call) → BLOCKED
test('Returning user, $0.14 (less than one call) → blocked', () => {
  const result = preCampaignCheck(0.14, 0, 3, 10)
  assert.strictEqual(result.blocked, true)
  assert.strictEqual(result.reason, 'zero_balance')
})

console.log(`\n========================================`)
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`)
console.log(`========================================`)
process.exit(failed > 0 ? 1 : 0)
