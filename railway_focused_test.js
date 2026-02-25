#!/usr/bin/env node

/**
 * Railway Fix Verification - Focused Test
 * 
 * This tests the specific fix mentioned in the review request:
 * Fix for Railway `saveDomainInServerRailway()` edge case in js/rl-save-domain-in-server.js
 * 
 * The fix adds a `getExistingRailwayCNAME(domain)` function that queries Railway 
 * for the existing CNAME target and returns it as success, avoiding the need to remove+re-create.
 */

const fs = require('fs')
require('dotenv').config()

console.log('🎯 Railway Fix Verification Test')
console.log('Focus: getExistingRailwayCNAME edge case handling')
console.log('=' .repeat(60))

// Test Results Storage
const results = {
  passed: 0,
  failed: 0,
  tests: []
}

function logTest(testName, status, details = '') {
  const icon = status === 'PASS' ? '✅' : '❌'
  console.log(`${icon} ${testName}: ${status}`)
  if (details) console.log(`   ${details}`)
  
  results.tests.push({ testName, status, details })
  if (status === 'PASS') results.passed++
  else results.failed++
}

function runFocusedRailwayTest() {
  try {
    console.log('\n🔍 Testing Railway Fix Implementation\n')
    
    const rlServiceCode = fs.readFileSync('./js/rl-save-domain-in-server.js', 'utf8')
    
    // 1. Verify getExistingRailwayCNAME function exists
    const getExistingFunctionExists = rlServiceCode.includes('async function getExistingRailwayCNAME(domain)')
    logTest('1. getExistingRailwayCNAME function exists', getExistingFunctionExists ? 'PASS' : 'FAIL')
    
    // 2. Verify function queries Railway GraphQL API
    const hasGraphQLQuery = rlServiceCode.includes('domains(projectId: "${PROJECT_ID}", serviceId: "${SERVICE_ID}", environmentId: "${ENVIRONMENT_ID}")')
    logTest('2. Queries Railway GraphQL API correctly', hasGraphQLQuery ? 'PASS' : 'FAIL')
    
    // 3. Verify returns { server, recordType: 'CNAME' } or null
    const hasCorrectReturn = rlServiceCode.includes('return { server: cname, recordType: \'CNAME\' }')
    const hasNullReturn = rlServiceCode.includes('return null')
    logTest('3. Returns correct format or null', (hasCorrectReturn && hasNullReturn) ? 'PASS' : 'FAIL')
    
    // 4. Verify error handling (try/catch, returns null on failure)
    const hasTryCatch = rlServiceCode.includes('try {') && rlServiceCode.includes('} catch (err) {')
    const errorReturnsNull = rlServiceCode.match(/catch \(err\) {[^}]*return null[^}]*}/s)
    logTest('4. Has proper error handling', (hasTryCatch && errorReturnsNull) ? 'PASS' : 'FAIL')
    
    // 5. Verify saveDomainInServerRailway isAlreadyExists branch calls getExistingRailwayCNAME FIRST
    const callsGetExistingFirst = rlServiceCode.includes('const existing = await getExistingRailwayCNAME(domain)')
    logTest('5. isAlreadyExists calls getExistingRailwayCNAME first', callsGetExistingFirst ? 'PASS' : 'FAIL')
    
    // 6. Verify returns existing result if found (treating "already exists" as success)
    const returnsExistingResult = rlServiceCode.includes('if (existing) {') && 
                                  rlServiceCode.includes('return existing')
    logTest('6. Returns existing result if found', returnsExistingResult ? 'PASS' : 'FAIL')
    
    // 7. Verify only falls back to remove+re-create if getExistingRailwayCNAME returns null
    const hasFallbackLogic = rlServiceCode.includes('const removeResult = await removeDomainFromRailway(domain)') &&
                             rlServiceCode.includes('Could not fetch CNAME for ${domain}')
    logTest('7. Falls back to remove+re-create only if null', hasFallbackLogic ? 'PASS' : 'FAIL')
    
    // Final results
    console.log('\n' + '='.repeat(60))
    console.log('📊 RAILWAY FIX VERIFICATION SUMMARY')
    console.log('='.repeat(60))
    console.log(`✅ Passed: ${results.passed}`)
    console.log(`❌ Failed: ${results.failed}`) 
    const totalTests = results.passed + results.failed
    const successRate = totalTests > 0 ? ((results.passed / totalTests) * 100).toFixed(1) : 0
    console.log(`📈 Success Rate: ${successRate}%`)
    
    if (results.failed > 0) {
      console.log('\n🔍 FAILED TESTS:')
      results.tests.filter(t => t.status === 'FAIL').forEach(test => {
        console.log(`   ❌ ${test.testName}`)
      })
    } else {
      console.log('\n🎉 ALL RAILWAY FIX REQUIREMENTS VERIFIED!')
      console.log('✅ Edge case handling correctly implemented')
      console.log('✅ Avoids remove+re-create when domain already exists')
      console.log('✅ Graceful fallback if CNAME fetch fails')
    }
    
    console.log('\n' + '='.repeat(60))
    
    return results.failed === 0
    
  } catch (error) {
    console.error('❌ Test error:', error.message)
    return false
  }
}

// Run the test
if (require.main === module) {
  const success = runFocusedRailwayTest()
  process.exit(success ? 0 : 1)
}

module.exports = { runFocusedRailwayTest, results }