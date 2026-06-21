#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Escrow Seller Username Fix
 * Tests the fix to show actual Telegram @username instead of anonymized Seller#XXXX
 */

const fs = require('fs')
const http = require('http')

// Test configuration
const TEST_CONFIG = {
  NODE_JS_PORT: 5000,
  EXPECTED_HEALTH_STATUS: 'healthy',
  LANGUAGE_FILES: ['en.js', 'fr.js', 'zh.js', 'hi.js'],
  ESCROW_HANDLERS: [
    { name: 'mp:escrow handler', expectedLine: 1578 },
    { name: 'mp:escrow_product handler', expectedLine: 1610 },
    { name: '/escrow command', expectedLine: 6172 }
  ]
}

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
}

function logTest(test, status, message) {
  results.total++
  const symbol = status === 'PASS' ? '✅' : '❌'
  const detail = `${symbol} ${test}: ${message}`
  console.log(detail)
  results.details.push(detail)
  
  if (status === 'PASS') {
    results.passed++
  } else {
    results.failed++
  }
}

// Test 1: Node.js Health Check
async function testNodejsHealth() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${TEST_CONFIG.NODE_JS_PORT}/health`, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const health = JSON.parse(data)
          if (res.statusCode === 200 && health.status === TEST_CONFIG.EXPECTED_HEALTH_STATUS) {
            logTest('Node.js Health', 'PASS', `GET http://localhost:${TEST_CONFIG.NODE_JS_PORT}/health returns 200 with status: ${health.status}`)
          } else {
            logTest('Node.js Health', 'FAIL', `Expected 200 + healthy, got ${res.statusCode} + ${health.status}`)
          }
        } catch (e) {
          logTest('Node.js Health', 'FAIL', `Invalid JSON response: ${data}`)
        }
        resolve()
      })
    })
    
    req.on('error', (e) => {
      logTest('Node.js Health', 'FAIL', `Connection failed: ${e.message}`)
      resolve()
    })
    
    req.setTimeout(5000, () => {
      req.destroy()
      logTest('Node.js Health', 'FAIL', 'Request timeout')
      resolve()
    })
  })
}

// Test 2: Error Log Check
function testErrorLog() {
  try {
    const stats = fs.statSync('/var/log/supervisor/nodejs.err.log')
    if (stats.size === 0) {
      logTest('Error Log', 'PASS', '/var/log/supervisor/nodejs.err.log is empty (0 bytes)')
    } else {
      logTest('Error Log', 'FAIL', `/var/log/supervisor/nodejs.err.log has ${stats.size} bytes of errors`)
    }
  } catch (e) {
    logTest('Error Log', 'FAIL', `Cannot access error log: ${e.message}`)
  }
}

// Test 3: SellerRef Fixes in _index.js
function testSellerRefFixes() {
  try {
    const content = fs.readFileSync('/app/js/_index.js', 'utf-8')
    const lines = content.split('\n')
    
    let correctCount = 0
    
    for (const handler of TEST_CONFIG.ESCROW_HANDLERS) {
      const lineIndex = handler.expectedLine - 1 // Convert to 0-based index
      
      if (lineIndex >= lines.length) {
        logTest(`SellerRef Fix - ${handler.name}`, 'FAIL', `Line ${handler.expectedLine} doesn't exist`)
        continue
      }
      
      const line = lines[lineIndex]
      
      // Check for the core pattern - allows both product.sellerUsername and product?.sellerUsername
      if ((line.includes("product.sellerUsername && product.sellerUsername !== 'anonymous'") || 
           line.includes("product?.sellerUsername && product.sellerUsername !== 'anonymous'")) && 
          line.includes("@${product.sellerUsername}") && 
          line.includes("Seller#${String(conv.sellerId).slice(-4)}")) {
        logTest(`SellerRef Fix - ${handler.name}`, 'PASS', `Line ${handler.expectedLine} has correct sellerRef logic`)
        correctCount++
      } else {
        logTest(`SellerRef Fix - ${handler.name}`, 'FAIL', `Line ${handler.expectedLine}: ${line.trim()}`)
      }
    }
    
    // Verify all 3 fixes are present
    if (correctCount === 3) {
      logTest('All SellerRef Fixes', 'PASS', 'All 3 escrow handlers have correct sellerRef logic')
    } else {
      logTest('All SellerRef Fixes', 'FAIL', `Only ${correctCount}/3 handlers have correct sellerRef logic`)
    }
    
  } catch (e) {
    logTest('SellerRef Fixes', 'FAIL', `Cannot read _index.js: ${e.message}`)
  }
}

// Test 4: Fallback Logic Verification  
function testFallbackLogic() {
  try {
    const content = fs.readFileSync('/app/js/_index.js', 'utf-8')
    
    // Count occurrences of the fallback pattern (allows both product.sellerUsername and product?.sellerUsername)
    const fallbackMatches = content.match(/(product\??\.sellerUsername\s*&&\s*product\.sellerUsername\s*!==\s*['"`]anonymous['"`])/g)
    
    if (fallbackMatches && fallbackMatches.length === 3) {
      logTest('Fallback Logic', 'PASS', 'All 3 handlers check for missing/anonymous sellerUsername')
    } else {
      logTest('Fallback Logic', 'FAIL', `Found ${fallbackMatches ? fallbackMatches.length : 0}/3 fallback checks`)
    }
    
  } catch (e) {
    logTest('Fallback Logic', 'FAIL', `Cannot verify fallback logic: ${e.message}`)
  }
}

// Test 5: Language Files mpEscrowMsg Updates
function testLanguageFiles() {
  let correctLangFiles = 0
  
  for (const langFile of TEST_CONFIG.LANGUAGE_FILES) {
    try {
      const content = fs.readFileSync(`/app/js/lang/${langFile}`, 'utf-8')
      
      // Check if mpEscrowMsg function exists and uses sellerRef
      if (content.includes('mpEscrowMsg: (title, price, sellerRef)') &&
          content.includes('<b>${sellerRef}</b>')) {
        logTest(`Language File - ${langFile}`, 'PASS', `mpEscrowMsg uses sellerRef with bold formatting`)
        correctLangFiles++
        
        // Verify sellerRef is used in step 2 instructions
        const escrowMsgMatch = content.match(/mpEscrowMsg:.*?\n.*?`([^`]*)`/s)
        if (escrowMsgMatch && escrowMsgMatch[1].includes('${sellerRef}')) {
          logTest(`Language File - ${langFile} Step 2`, 'PASS', `Step 2 instructions include sellerRef`)
        } else {
          logTest(`Language File - ${langFile} Step 2`, 'FAIL', `Step 2 instructions missing sellerRef`)
        }
      } else {
        logTest(`Language File - ${langFile}`, 'FAIL', `mpEscrowMsg doesn't use sellerRef properly`)
      }
      
    } catch (e) {
      logTest(`Language File - ${langFile}`, 'FAIL', `Cannot read file: ${e.message}`)
    }
  }
  
  if (correctLangFiles === 4) {
    logTest('All Language Files', 'PASS', 'All 4 language files have updated mpEscrowMsg')
  } else {
    logTest('All Language Files', 'FAIL', `Only ${correctLangFiles}/4 language files updated`)
  }
}

// Test 6: No Hardcoded Anonymous Seller# References
function testNoHardcodedSellerRefs() {
  try {
    const content = fs.readFileSync('/app/js/_index.js', 'utf-8')
    
    // Look for any hardcoded Seller# patterns outside of the 3 expected fallback lines
    const hardcodedMatches = content.match(/Seller#\$\{String\([^}]*sellerId[^}]*\)\.slice\(-4\)\}/g)
    
    if (hardcodedMatches && hardcodedMatches.length === 3) {
      logTest('No Hardcoded Seller#', 'PASS', 'Only 3 expected Seller# fallback references found')
    } else {
      logTest('No Hardcoded Seller#', 'FAIL', `Found ${hardcodedMatches ? hardcodedMatches.length : 0} Seller# references (expected 3)`)
    }
    
  } catch (e) {
    logTest('No Hardcoded Seller#', 'FAIL', `Cannot verify hardcoded references: ${e.message}`)
  }
}

// Main test execution
async function runTests() {
  console.log('🔍 ESCROW SELLER USERNAME FIX - COMPREHENSIVE VERIFICATION')
  console.log('=' .repeat(60))
  console.log()
  
  // Run all tests
  await testNodejsHealth()
  testErrorLog()
  testSellerRefFixes()
  testFallbackLogic() 
  testLanguageFiles()
  testNoHardcodedSellerRefs()
  
  // Summary
  console.log()
  console.log('=' .repeat(60))
  console.log(`📊 TEST SUMMARY: ${results.passed}/${results.total} PASSED`)
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`)
  
  if (results.failed === 0) {
    console.log('🎉 ALL TESTS PASSED - ESCROW SELLER USERNAME FIX IS WORKING CORRECTLY!')
  } else {
    console.log(`⚠️  ${results.failed} TESTS FAILED - REVIEW REQUIRED`)
  }
  
  return {
    success: results.failed === 0,
    summary: `${results.passed}/${results.total} tests passed (${((results.passed / results.total) * 100).toFixed(1)}%)`,
    details: results.details
  }
}

// Export for use in other scripts
if (require.main === module) {
  runTests().then(result => {
    process.exit(result.success ? 0 : 1)
  })
} else {
  module.exports = { runTests }
}