#!/usr/bin/env node
/**
 * Domain Validation Test Script
 * Tests the improved domain validation logic
 */

// Test cases
const testCases = [
  // Missing TLD
  { input: 'servicedptx', expected: 'domainMissingTLD', description: 'Missing TLD' },
  { input: 'mysite', expected: 'domainMissingTLD', description: 'No extension' },
  
  // Too short
  { input: 'ab.com', expected: 'domainTooShort', description: 'Only 2 chars' },
  { input: 'xy.net', expected: 'domainTooShort', description: 'Too short' },
  
  // Invalid characters
  { input: 'my_site.com', expected: 'domainInvalidChars', description: 'Underscore not allowed' },
  { input: 'my@domain.com', expected: 'domainInvalidChars', description: '@ symbol not allowed' },
  { input: 'site#name.com', expected: 'domainInvalidChars', description: '# symbol not allowed' },
  
  // Starts/ends with hyphen
  { input: '-mysite.com', expected: 'domainStartsEndsHyphen', description: 'Starts with hyphen' },
  { input: 'mysite-.com', expected: 'domainStartsEndsHyphen', description: 'Ends with hyphen' },
  { input: 'my--site.com', expected: 'VALID', description: 'Double hyphen in middle is OK' },
  
  // Valid domains
  { input: 'mydomain.com', expected: 'VALID', description: 'Standard domain' },
  { input: 'my-site.com', expected: 'VALID', description: 'Hyphen in middle' },
  { input: 'abc.co.uk', expected: 'VALID', description: 'Multiple TLDs' },
  { input: 'test123.net', expected: 'VALID', description: 'Numbers allowed' },
  { input: '123test.org', expected: 'VALID', description: 'Starting with number' },
]

// Validation function (extracted from _index.js)
function validateDomain(input) {
  let domain = input.toLowerCase().trim()
  domain = domain.replace('https://', '')
  domain = domain.replace('http://', '')
  domain = domain.replace(/\s+/g, '')

  // Check if domain has a TLD (extension)
  if (!domain.includes('.')) {
    return 'domainMissingTLD'
  }

  // Check if domain name (before first dot) is too short
  const parts = domain.split('.')
  if (parts[0].length < 3) {
    return 'domainTooShort'
  }

  // Check for invalid characters
  const validCharsRegex = /^[a-z0-9.-]+$/
  if (!validCharsRegex.test(domain)) {
    return 'domainInvalidChars'
  }

  // Check if domain starts or ends with hyphen
  const domainParts = domain.split('.')
  for (const part of domainParts) {
    if (part.startsWith('-') || part.endsWith('-')) {
      return 'domainStartsEndsHyphen'
    }
  }

  // Final comprehensive validation
  const domainRegex = /^(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,6}$/
  if (!domainRegex.test(domain)) {
    return 'domainInvalid'
  }

  return 'VALID'
}

// Run tests
console.log('🧪 Domain Validation Test Suite\n')
console.log('=' .repeat(70))

let passed = 0
let failed = 0

testCases.forEach((test, index) => {
  const result = validateDomain(test.input)
  const success = result === test.expected
  
  if (success) {
    passed++
    console.log(`✅ Test ${index + 1}: ${test.description}`)
    console.log(`   Input: "${test.input}" → ${result}`)
  } else {
    failed++
    console.log(`❌ Test ${index + 1}: ${test.description}`)
    console.log(`   Input: "${test.input}"`)
    console.log(`   Expected: ${test.expected}`)
    console.log(`   Got: ${result}`)
  }
  console.log('')
})

console.log('=' .repeat(70))
console.log(`\n📊 Results: ${passed}/${testCases.length} tests passed\n`)

if (failed === 0) {
  console.log('✨ All tests passed! Domain validation is working correctly.\n')
  process.exit(0)
} else {
  console.log(`⚠️  ${failed} test(s) failed. Please review the validation logic.\n`)
  process.exit(1)
}
