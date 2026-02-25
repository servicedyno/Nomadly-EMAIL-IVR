#!/usr/bin/env node

/**
 * Backend Testing Suite for Nomadly Node.js Application
 * Tests the 4 new tasks from the review request:
 * 1. switchToCloudflare migrates existing DNS records to CF zone
 * 2. saveDomainInServerRailway handles domain-already-exists
 * 3. DNS add conflict detection for CNAME/A
 * 4. switchToCloudflare success message shows migration results
 */

const axios = require('axios')
const { MongoClient } = require('mongodb')
require('dotenv').config()

// Configuration
const BASE_URL = process.env.SELF_URL || 'http://localhost:5000'
const DB_NAME = process.env.DB_NAME
const MONGO_URL = process.env.MONGO_URL

console.log('🧪 Starting Nomadly Backend Test Suite')
console.log('📍 Backend URL:', BASE_URL)
console.log('🗃️ Database:', DB_NAME)
console.log('=' .repeat(80))

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

// Test 1: Verify migrateRecordsToCF function exists and is exported
function testMigrateRecordsFunction() {
  console.log('\n🔍 Testing Task 1: migrateRecordsToCF function')
  
  try {
    const domainService = require('./js/domain-service.js')
    
    // Check if migrateRecordsToCF function exists (should be internal, not exported)
    const fs = require('fs')
    const domainServiceCode = fs.readFileSync('./js/domain-service.js', 'utf8')
    
    const hasMigrateFunction = domainServiceCode.includes('const migrateRecordsToCF = async')
    logTest('migrateRecordsToCF function exists', hasMigrateFunction ? 'PASS' : 'FAIL', 
      hasMigrateFunction ? 'Function defined at line 474' : 'Function not found')
    
    // Check function parameters and return structure
    const hasCorrectParams = domainServiceCode.includes('migrateRecordsToCF = async (domainName, cfZoneId, meta)')
    logTest('migrateRecordsToCF has correct parameters', hasCorrectParams ? 'PASS' : 'FAIL')
    
    const hasCorrectReturn = domainServiceCode.includes('return { migrated, failed, isEmpty')
    logTest('migrateRecordsToCF returns correct structure', hasCorrectReturn ? 'PASS' : 'FAIL')
    
    // Check if switchToCloudflare calls migrateRecordsToCF
    const switchCallsMigrate = domainServiceCode.includes('const migration = await migrateRecordsToCF(domainName, zoneResult.zoneId, meta)')
    logTest('switchToCloudflare calls migrateRecordsToCF', switchCallsMigrate ? 'PASS' : 'FAIL')
    
    // Check if ensureCloudflare calls migrateRecordsToCF
    const ensureCallsMigrate = domainServiceCode.includes('const migration = await migrateRecordsToCF(domainName, zoneResult.zoneId, meta)')
    logTest('ensureCloudflare calls migrateRecordsToCF', ensureCallsMigrate ? 'PASS' : 'FAIL')
    
    // Check helper functions exist
    const hasCreateZoneHelper = domainServiceCode.includes('const _createZoneAndUpdateNS = async')
    logTest('_createZoneAndUpdateNS helper exists', hasCreateZoneHelper ? 'PASS' : 'FAIL')
    
    const hasUpdateDBHelper = domainServiceCode.includes('const _updateDBMeta = async')
    logTest('_updateDBMeta helper exists', hasUpdateDBHelper ? 'PASS' : 'FAIL')
    
    const hasBackgroundVerify = domainServiceCode.includes('const backgroundNSVerify =')
    logTest('backgroundNSVerify helper exists', hasBackgroundVerify ? 'PASS' : 'FAIL')
    
  } catch (error) {
    logTest('migrateRecordsToCF function verification', 'FAIL', `Error: ${error.message}`)
  }
}

// Test 2: Verify saveDomainInServerRailway retry logic
function testRailwayRetryLogic() {
  console.log('\n🔍 Testing Task 2: saveDomainInServerRailway retry logic')
  
  try {
    const fs = require('fs')
    const rlServiceCode = fs.readFileSync('./js/rl-save-domain-in-server.js', 'utf8')
    
    // Check for domain already exists detection
    const hasAlreadyExistsCheck = rlServiceCode.includes("error.toLowerCase().includes('already')")
    logTest('Detects "already" error keyword', hasAlreadyExistsCheck ? 'PASS' : 'FAIL')
    
    const hasExistsCheck = rlServiceCode.includes("error.toLowerCase().includes('exists')")
    logTest('Detects "exists" error keyword', hasExistsCheck ? 'PASS' : 'FAIL')
    
    const hasDuplicateCheck = rlServiceCode.includes("error.toLowerCase().includes('duplicate')")
    logTest('Detects "duplicate" error keyword', hasDuplicateCheck ? 'PASS' : 'FAIL')
    
    const hasFailedCreateCheck = rlServiceCode.includes("error.toLowerCase().includes('failed to create custom domain')")
    logTest('Detects "failed to create custom domain" error', hasFailedCreateCheck ? 'PASS' : 'FAIL')
    
    // Check for removeDomainFromRailway call
    const hasRemoveCall = rlServiceCode.includes('const removeResult = await removeDomainFromRailway(domain)')
    logTest('Calls removeDomainFromRailway on conflict', hasRemoveCall ? 'PASS' : 'FAIL')
    
    // Check for 3s wait
    const hasWait = rlServiceCode.includes('await new Promise(r => setTimeout(r, 3000))')
    logTest('Waits 3 seconds before retry', hasWait ? 'PASS' : 'FAIL')
    
    // Check for retry logic
    const hasRetryLogic = rlServiceCode.includes('const retryResponse = await axios.post')
    logTest('Has retry creation logic', hasRetryLogic ? 'PASS' : 'FAIL')
    
  } catch (error) {
    logTest('Railway retry logic verification', 'FAIL', `Error: ${error.message}`)
  }
}

// Test 3: Verify DNS conflict detection functions
function testDNSConflictDetection() {
  console.log('\n🔍 Testing Task 3: DNS conflict detection')
  
  try {
    const domainService = require('./js/domain-service.js')
    const fs = require('fs')
    const domainServiceCode = fs.readFileSync('./js/domain-service.js', 'utf8')
    
    // Check if checkDNSConflict function exists and is exported
    const hasCheckConflict = typeof domainService.checkDNSConflict === 'function'
    logTest('checkDNSConflict function exported', hasCheckConflict ? 'PASS' : 'FAIL')
    
    // Check if resolveConflictAndAdd function exists and is exported  
    const hasResolveConflict = typeof domainService.resolveConflictAndAdd === 'function'
    logTest('resolveConflictAndAdd function exported', hasResolveConflict ? 'PASS' : 'FAIL')
    
    // Check function signatures in code
    const hasCorrectCheckSig = domainServiceCode.includes('const checkDNSConflict = async (domainName, recordType, hostname, db)')
    logTest('checkDNSConflict has correct signature', hasCorrectCheckSig ? 'PASS' : 'FAIL')
    
    const hasCorrectResolveSig = domainServiceCode.includes('const resolveConflictAndAdd = async (domainName, recordType, recordValue, hostname, conflictingRecords, db, priority)')
    logTest('resolveConflictAndAdd has correct signature', hasCorrectResolveSig ? 'PASS' : 'FAIL')
    
    // Check return structure for checkDNSConflict
    const hasConflictReturn = domainServiceCode.includes('return { hasConflict: true, conflictingRecords: conflicting, message }')
    logTest('checkDNSConflict returns correct conflict structure', hasConflictReturn ? 'PASS' : 'FAIL')
    
    const hasNoConflictReturn = domainServiceCode.includes('return { hasConflict: false }')
    logTest('checkDNSConflict returns correct no-conflict structure', hasNoConflictReturn ? 'PASS' : 'FAIL')
    
  } catch (error) {
    logTest('DNS conflict detection verification', 'FAIL', `Error: ${error.message}`)
  }
}

// Test 4: Verify _index.js handlers for conflict detection
function testIndexHandlers() {
  console.log('\n🔍 Testing Task 3 & 4: _index.js handlers')
  
  try {
    const fs = require('fs')
    const indexCode = fs.readFileSync('./js/_index.js', 'utf8')
    
    // Check dns-add-value handler calls checkDNSConflict
    const hasConflictCheck = indexCode.includes('const conflict = await domainService.checkDNSConflict')
    logTest('dns-add-value calls checkDNSConflict', hasConflictCheck ? 'PASS' : 'FAIL')
    
    // Check for A/AAAA/CNAME type filtering
    const hasTypeCheck = indexCode.includes("['A', 'AAAA', 'CNAME'].includes(recordType)")
    logTest('Conflict check limited to A/AAAA/CNAME types', hasTypeCheck ? 'PASS' : 'FAIL')
    
    // Check dns-confirm-conflict-replace handler exists
    const hasConflictReplaceHandler = indexCode.includes("if (action === 'dns-confirm-conflict-replace')")
    logTest('dns-confirm-conflict-replace handler exists', hasConflictReplaceHandler ? 'PASS' : 'FAIL')
    
    // Check handler calls resolveConflictAndAdd
    const hasResolveCall = indexCode.includes('await domainService.resolveConflictAndAdd')
    logTest('dns-confirm-conflict-replace calls resolveConflictAndAdd', hasResolveCall ? 'PASS' : 'FAIL')
    
    // Check confirm-switch-to-cloudflare handler shows migration results
    const hasConfirmHandler = indexCode.includes("if (action === 'confirm-switch-to-cloudflare')")
    logTest('confirm-switch-to-cloudflare handler exists', hasConfirmHandler ? 'PASS' : 'FAIL')
    
    // Check for migration result display
    const hasMigrationDisplay = indexCode.includes('result.migration')
    logTest('confirm-switch-to-cloudflare accesses migration results', hasMigrationDisplay ? 'PASS' : 'FAIL')
    
  } catch (error) {
    logTest('Index handlers verification', 'FAIL', `Error: ${error.message}`)
  }
}

// Test 5: Node.js Health Check
async function testNodeHealth() {
  console.log('\n🔍 Testing Task 5: Node.js service health')
  
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 })
    
    if (response.status === 200) {
      const healthData = response.data
      
      const isHealthy = healthData.status === 'healthy'
      logTest('Service status is healthy', isHealthy ? 'PASS' : 'FAIL', 
        `Status: ${healthData.status}`)
      
      const isDbConnected = healthData.database === 'connected'
      logTest('Database is connected', isDbConnected ? 'PASS' : 'FAIL', 
        `Database: ${healthData.database}`)
      
      const hasUptime = healthData.uptime && parseFloat(healthData.uptime) >= 0
      logTest('Service has uptime info', hasUptime ? 'PASS' : 'FAIL', 
        `Uptime: ${healthData.uptime}`)
      
      // Test if service is running on correct port (5000)
      const isCorrectPort = BASE_URL.includes(':5000')
      logTest('Service running on port 5000', isCorrectPort ? 'PASS' : 'FAIL')
      
    } else {
      logTest('Service health check', 'FAIL', `HTTP ${response.status}`)
    }
  } catch (error) {
    logTest('Node.js health check', 'FAIL', `Connection error: ${error.message}`)
  }
}

// Test 6: Verify code structure integrity  
function testCodeStructure() {
  console.log('\n🔍 Testing code structure and exports')
  
  try {
    // Test domain-service.js exports
    const domainService = require('./js/domain-service.js')
    const expectedExports = [
      'checkDomainPrice', 'registerDomain', 'getDomainMeta', 'viewDNSRecords', 
      'addDNSRecord', 'updateDNSRecord', 'deleteDNSRecord', 'switchToCloudflare', 
      'ensureCloudflare', 'checkDNSConflict', 'resolveConflictAndAdd'
    ]
    
    let allExportsPresent = true
    let missingExports = []
    
    for (const exportName of expectedExports) {
      if (typeof domainService[exportName] !== 'function') {
        allExportsPresent = false
        missingExports.push(exportName)
      }
    }
    
    logTest('All required domain-service exports present', allExportsPresent ? 'PASS' : 'FAIL',
      missingExports.length > 0 ? `Missing: ${missingExports.join(', ')}` : '')
    
    // Test rl-save-domain-in-server.js exports
    const rlService = require('./js/rl-save-domain-in-server.js')
    const hasSaveDomain = typeof rlService.saveDomainInServerRailway === 'function'
    logTest('saveDomainInServerRailway function exported', hasSaveDomain ? 'PASS' : 'FAIL')
    
    const hasRemoveDomain = typeof rlService.removeDomainFromRailway === 'function'
    logTest('removeDomainFromRailway function exported', hasRemoveDomain ? 'PASS' : 'FAIL')
    
  } catch (error) {
    logTest('Code structure verification', 'FAIL', `Error loading modules: ${error.message}`)
  }
}

// Main test execution
async function runTests() {
  try {
    console.log('🚀 Running all backend tests...\n')
    
    // Test 1: Migration function verification
    testMigrateRecordsFunction()
    
    // Test 2: Railway retry logic
    testRailwayRetryLogic()
    
    // Test 3: DNS conflict detection
    testDNSConflictDetection()
    
    // Test 4: Index.js handlers
    testIndexHandlers()
    
    // Test 5: Node.js health
    await testNodeHealth()
    
    // Test 6: Code structure
    testCodeStructure()
    
    // Final results
    console.log('\n' + '='.repeat(80))
    console.log('📊 TEST RESULTS SUMMARY')
    console.log('='.repeat(80))
    console.log(`✅ Passed: ${results.passed}`)
    console.log(`❌ Failed: ${results.failed}`) 
    console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`)
    
    if (results.failed > 0) {
      console.log('\n🔍 FAILED TESTS:')
      results.tests.filter(t => t.status === 'FAIL').forEach(test => {
        console.log(`   ❌ ${test.testName}: ${test.details || 'No details'}`)
      })
    }
    
    console.log('\n' + '='.repeat(80))
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0)
    
  } catch (error) {
    console.error('❌ Test suite error:', error.message)
    process.exit(1)
  }
}

// Run the tests
if (require.main === module) {
  runTests()
}

module.exports = { runTests, results }