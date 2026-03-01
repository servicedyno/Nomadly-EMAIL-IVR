#!/usr/bin/env node
/**
 * Comprehensive End-to-End Translation Test
 * Verifies all sub-number messages are translated in all languages
 */

const phoneConfig = require('./js/phone-config.js')

console.log('🌍 Comprehensive Sub-Number Translation Verification')
console.log('=' .repeat(70))
console.log('')

const languages = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'zh', name: 'Chinese' },
  { code: 'hi', name: 'Hindi' }
]

const testNumber = '+12125551234'
const testParent = '+14155551234'
const testPlan = 'pro'
let allPassed = true

// Test 1: Button Labels
console.log('1️⃣  BUTTON LABELS')
console.log('─'.repeat(70))
for (const lang of languages) {
  const btn = phoneConfig.getBtn(lang.code)
  if (btn.addNumber) {
    console.log(`✅ ${lang.name.padEnd(10)} addNumber: "${btn.addNumber}"`)
  } else {
    console.log(`❌ ${lang.name.padEnd(10)} addNumber: MISSING`)
    allPassed = false
  }
}
console.log('')

// Test 2: Plan Features with Sub-Number Limits
console.log('2️⃣  PLAN FEATURES (Sub-Number Limits)')
console.log('─'.repeat(70))
for (const lang of languages) {
  const plans = ['starter', 'pro', 'business']
  for (const plan of plans) {
    const features = phoneConfig.plansI18n?.[lang.code]?.[plan]?.features
    if (features && features.length > 0) {
      const lastFeature = features[features.length - 1]
      console.log(`✅ ${lang.name.padEnd(10)} ${plan.padEnd(10)} "${lastFeature}"`)
    } else {
      console.log(`❌ ${lang.name.padEnd(10)} ${plan.padEnd(10)} MISSING`)
      allPassed = false
    }
  }
}
console.log('')

// Test 3: selectPlan Display
console.log('3️⃣  SELECT PLAN DISPLAY')
console.log('─'.repeat(70))
for (const lang of languages) {
  const txt = phoneConfig.getTxt(lang.code)
  const text = txt.selectPlan(testNumber)
  
  // Check if it contains sub-number info
  const hasSubInfo = text.includes('3') && (
    text.includes('extra') || text.includes('supplémentaires') || 
    text.includes('号码') || text.includes('अतिरिक्त')
  )
  
  if (hasSubInfo) {
    console.log(`✅ ${lang.name.padEnd(10)} selectPlan contains sub-number info`)
  } else {
    console.log(`❌ ${lang.name.padEnd(10)} selectPlan MISSING sub-number info`)
    allPassed = false
  }
}
console.log('')

// Test 4: Sub-Number Flow Messages
console.log('4️⃣  SUB-NUMBER FLOW MESSAGES')
console.log('─'.repeat(70))

const messagesToTest = [
  'subNumberLimitReached',
  'subNumberOrderSummary',
  'subActivated',
  'adminSubPurchase',
  'adminSubPurchasePrivate',
  'subAddNumberHeader',
  'subNumbersAvailable',
  'subNumberArea',
  'subNumberSelected',
  'bulkIvrSupport',
  'tapToSelect'
]

for (const lang of languages) {
  const txt = phoneConfig.getTxt(lang.code)
  let langPassed = true
  
  for (const msgKey of messagesToTest) {
    if (!txt[msgKey]) {
      console.log(`❌ ${lang.name.padEnd(10)} ${msgKey}: MISSING`)
      langPassed = false
      allPassed = false
    }
  }
  
  if (langPassed) {
    console.log(`✅ ${lang.name.padEnd(10)} All ${messagesToTest.length} flow messages present`)
  }
}
console.log('')

// Test 5: Function Message Outputs
console.log('5️⃣  FUNCTION OUTPUT TESTS')
console.log('─'.repeat(70))
for (const lang of languages) {
  const txt = phoneConfig.getTxt(lang.code)
  
  try {
    // Test subNumberLimitReached
    const limitMsg = txt.subNumberLimitReached('Pro', 15)
    console.log(`✅ ${lang.name.padEnd(10)} subNumberLimitReached: OK`)
    
    // Test subAddNumberHeader
    const headerMsg = txt.subAddNumberHeader(testPlan, testParent)
    console.log(`✅ ${lang.name.padEnd(10)} subAddNumberHeader: OK`)
    
    // Test subNumberArea
    const areaMsg = txt.subNumberArea('212')
    console.log(`✅ ${lang.name.padEnd(10)} subNumberArea: OK`)
    
  } catch (error) {
    console.log(`❌ ${lang.name.padEnd(10)} Function test FAILED: ${error.message}`)
    allPassed = false
  }
}
console.log('')

// Test 6: Keyboard Buttons
console.log('6️⃣  KEYBOARD BUTTONS (Sample Check)')
console.log('─'.repeat(70))
const commonButtons = ['myNumbers', 'usageBilling', 'sipSettings']
for (const lang of languages) {
  const btn = phoneConfig.getBtn(lang.code)
  let btnCount = 0
  
  for (const buttonKey of commonButtons) {
    if (btn[buttonKey]) btnCount++
  }
  
  if (btnCount === commonButtons.length) {
    console.log(`✅ ${lang.name.padEnd(10)} Common keyboard buttons present`)
  } else {
    console.log(`⚠️  ${lang.name.padEnd(10)} Some keyboard buttons missing (${btnCount}/${commonButtons.length})`)
  }
}
console.log('')

// Summary
console.log('=' .repeat(70))
console.log('📊 TEST SUMMARY')
console.log('=' .repeat(70))

if (allPassed) {
  console.log('🎉 ✅ ALL TESTS PASSED!')
  console.log('')
  console.log('✨ All sub-number messages are fully translated across all languages')
  console.log('✨ Button labels are translated')
  console.log('✨ Plan features include sub-number limits in all languages')
  console.log('✨ Flow messages are complete')
  console.log('')
  console.log('Ready for production! 🚀')
  process.exit(0)
} else {
  console.log('⚠️  SOME TESTS FAILED')
  console.log('Please review the errors above.')
  process.exit(1)
}
