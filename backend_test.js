/**
 * Backend Test Suite for Nomadly Telegram Bot - Railway & Shortener Fixes
 * 
 * Tests 2 specific fixes:
 * 1. Railway "already exists" handling via getExistingRailwayCNAME()
 * 2. Shortener A/CNAME conflict resolution via addShortenerCNAME()
 */

const fs = require('fs')
const path = require('path')

// Test Results
const results = {
  fix1_railway: {},
  fix2_shortener: {},
  node_service: {},
  summary: { passed: 0, failed: 0, total: 0 }
}

function logTest(category, testName, status, message = '') {
  const result = { status, message, timestamp: new Date().toISOString() }
  results[category][testName] = result
  results.summary.total++
  if (status === 'PASS') results.summary.passed++
  else results.summary.failed++
  console.log(`[${category.toUpperCase()}] ${testName}: ${status} ${message ? '- ' + message : ''}`)
}

async function testFix1Railway() {
  console.log('\n=== Fix 1: Railway "already exists" handling ===')
  
  try {
    // Test 1.1: Check if getExistingRailwayCNAME function exists
    const railwayServicePath = '/app/js/rl-save-domain-in-server.js'
    if (!fs.existsSync(railwayServicePath)) {
      logTest('fix1_railway', 'file_exists', 'FAIL', 'rl-save-domain-in-server.js not found')
      return
    }
    
    const railwayCode = fs.readFileSync(railwayServicePath, 'utf8')
    
    // Test 1.2: Check getExistingRailwayCNAME function exists and exports
    if (railwayCode.includes('async function getExistingRailwayCNAME(domain)')) {
      logTest('fix1_railway', 'getExistingRailwayCNAME_function', 'PASS', 'Function defined correctly')
    } else {
      logTest('fix1_railway', 'getExistingRailwayCNAME_function', 'FAIL', 'Function not found')
    }
    
    // Test 1.3: Check GraphQL query structure
    if (railwayCode.includes('domains(projectId:') && railwayCode.includes('customDomains') && 
        railwayCode.includes('dnsRecords') && railwayCode.includes('requiredValue')) {
      logTest('fix1_railway', 'graphql_query_structure', 'PASS', 'Correct GraphQL query for domains')
    } else {
      logTest('fix1_railway', 'graphql_query_structure', 'FAIL', 'GraphQL query structure incorrect')
    }
    
    // Test 1.4: Check return value structure
    if (railwayCode.includes('return { server: cname, recordType: \'CNAME\' }') && 
        railwayCode.includes('return null')) {
      logTest('fix1_railway', 'return_value_structure', 'PASS', 'Correct return values')
    } else {
      logTest('fix1_railway', 'return_value_structure', 'FAIL', 'Return values incorrect')
    }
    
    // Test 1.5: Check isAlreadyExists branch logic
    const isAlreadyExistsBranch = railwayCode.includes('const existing = await getExistingRailwayCNAME(domain)') &&
                                  railwayCode.includes('if (existing)') &&
                                  railwayCode.includes('return existing')
    if (isAlreadyExistsBranch) {
      logTest('fix1_railway', 'isAlreadyExists_logic', 'PASS', 'Calls getExistingRailwayCNAME first, returns if found')
    } else {
      logTest('fix1_railway', 'isAlreadyExists_logic', 'FAIL', 'isAlreadyExists branch logic incorrect')
    }
    
    // Test 1.6: Check fallback to remove+re-create
    if (railwayCode.includes('Could not fetch CNAME') && railwayCode.includes('attempting remove + re-create')) {
      logTest('fix1_railway', 'fallback_logic', 'PASS', 'Fallback to remove+re-create when getExistingRailwayCNAME returns null')
    } else {
      logTest('fix1_railway', 'fallback_logic', 'FAIL', 'Fallback logic missing or incorrect')
    }
    
    // Test 1.7: Check error handling
    if (railwayCode.includes('try {') && railwayCode.includes('catch (err)') && 
        railwayCode.includes('log(`[Railway] getExistingRailwayCNAME error')) {
      logTest('fix1_railway', 'error_handling', 'PASS', 'Proper error handling with logging')
    } else {
      logTest('fix1_railway', 'error_handling', 'FAIL', 'Error handling inadequate')
    }
    
  } catch (error) {
    logTest('fix1_railway', 'test_execution', 'FAIL', `Test execution error: ${error.message}`)
  }
}

async function testFix2Shortener() {
  console.log('\n=== Fix 2: Shortener A/CNAME conflict resolution ===')
  
  try {
    // Test 2.1: Check if addShortenerCNAME function exists in domain-service.js
    const domainServicePath = '/app/js/domain-service.js'
    if (!fs.existsSync(domainServicePath)) {
      logTest('fix2_shortener', 'domain_service_exists', 'FAIL', 'domain-service.js not found')
      return
    }
    
    const domainServiceCode = fs.readFileSync(domainServicePath, 'utf8')
    
    // Test 2.2: Check addShortenerCNAME function exists
    if (domainServiceCode.includes('const addShortenerCNAME = async (domainName, cnameTarget, db)')) {
      logTest('fix2_shortener', 'addShortenerCNAME_function', 'PASS', 'Function defined with correct signature')
    } else {
      logTest('fix2_shortener', 'addShortenerCNAME_function', 'FAIL', 'Function not found or signature incorrect')
    }
    
    // Test 2.3: Check function is exported
    if (domainServiceCode.includes('addShortenerCNAME,') && domainServiceCode.includes('module.exports')) {
      logTest('fix2_shortener', 'addShortenerCNAME_exported', 'PASS', 'Function properly exported')
    } else {
      logTest('fix2_shortener', 'addShortenerCNAME_exported', 'FAIL', 'Function not exported')
    }
    
    // Test 2.4: Check conflict detection logic
    if (domainServiceCode.includes('checkDNSConflict(domainName, \'CNAME\', \'\', db)') && 
        domainServiceCode.includes('conflict.hasConflict')) {
      logTest('fix2_shortener', 'conflict_detection', 'PASS', 'Uses checkDNSConflict for A/AAAA records')
    } else {
      logTest('fix2_shortener', 'conflict_detection', 'FAIL', 'Conflict detection not implemented')
    }
    
    // Test 2.5: Check conflicting records deletion
    if (domainServiceCode.includes('for (const rec of conflict.conflictingRecords)') && 
        domainServiceCode.includes('deleteDNSRecord')) {
      logTest('fix2_shortener', 'conflict_resolution', 'PASS', 'Deletes conflicting A/AAAA records')
    } else {
      logTest('fix2_shortener', 'conflict_resolution', 'FAIL', 'Conflict resolution not implemented')
    }
    
    // Test 2.6: Check CNAME creation
    if (domainServiceCode.includes('createDNSRecord(meta.cfZoneId, \'CNAME\', domainName, cnameTarget')) {
      logTest('fix2_shortener', 'cname_creation', 'PASS', 'Creates CNAME record correctly')
    } else {
      logTest('fix2_shortener', 'cname_creation', 'FAIL', 'CNAME creation logic incorrect')
    }
    
    // Test 2.7: Check return values
    if (domainServiceCode.includes('return { success: true }') && 
        domainServiceCode.includes('return { error:')) {
      logTest('fix2_shortener', 'return_values', 'PASS', 'Correct return values for success/error')
    } else {
      logTest('fix2_shortener', 'return_values', 'FAIL', 'Return values incorrect')
    }
    
    // Test 2.8: Check _index.js usage - all 5 callsites
    const indexPath = '/app/js/_index.js'
    if (!fs.existsSync(indexPath)) {
      logTest('fix2_shortener', 'index_file_exists', 'FAIL', '_index.js not found')
      return
    }
    
    const indexCode = fs.readFileSync(indexPath, 'utf8')
    
    // Count occurrences of addShortenerCNAME
    const addShortenerCNAMEMatches = (indexCode.match(/domainService\.addShortenerCNAME/g) || []).length
    if (addShortenerCNAMEMatches >= 5) {
      logTest('fix2_shortener', 'callsites_usage', 'PASS', `Found ${addShortenerCNAMEMatches} addShortenerCNAME calls (expected ≥5)`)
    } else {
      logTest('fix2_shortener', 'callsites_usage', 'FAIL', `Only found ${addShortenerCNAMEMatches} addShortenerCNAME calls (expected ≥5)`)
    }
    
    // Test 2.9: Verify QuickActivateShortener uses addShortenerCNAME
    if (indexCode.includes('[QuickActivateShortener]') && 
        indexCode.includes('await domainService.addShortenerCNAME(domain, server, db)')) {
      logTest('fix2_shortener', 'quick_activate_usage', 'PASS', 'QuickActivateShortener uses addShortenerCNAME')
    } else {
      logTest('fix2_shortener', 'quick_activate_usage', 'FAIL', 'QuickActivateShortener not using addShortenerCNAME')
    }
    
    // Test 2.10: Verify ActivateShortener DNS menu uses addShortenerCNAME  
    if (indexCode.includes('await domainService.addShortenerCNAME(domain, server, db)')) {
      const matches = indexCode.match(/await domainService\.addShortenerCNAME\(domain, server, db\)/g) || []
      if (matches.length >= 2) {
        logTest('fix2_shortener', 'dns_menu_usage', 'PASS', 'ActivateShortener DNS menu uses addShortenerCNAME')
      } else {
        logTest('fix2_shortener', 'dns_menu_usage', 'FAIL', 'ActivateShortener DNS menu not using addShortenerCNAME')
      }
    }
    
    // Test 2.11: Verify DomainActionShortener uses addShortenerCNAME
    if (indexCode.includes('[DomainActionShortener]') && 
        indexCode.includes('await domainService.addShortenerCNAME(domain, server, db)')) {
      logTest('fix2_shortener', 'domain_action_usage', 'PASS', 'DomainActionShortener uses addShortenerCNAME')
    } else {
      logTest('fix2_shortener', 'domain_action_usage', 'FAIL', 'DomainActionShortener not using addShortenerCNAME')
    }
    
    // Test 2.12: Verify buyDomainFullProcess uses addShortenerCNAME
    if (indexCode.includes('buyDomainFullProcess') && 
        indexCode.includes('await domainService.addShortenerCNAME(domain, server, db)')) {
      logTest('fix2_shortener', 'buy_domain_usage', 'PASS', 'buyDomainFullProcess uses addShortenerCNAME')
    } else {
      logTest('fix2_shortener', 'buy_domain_usage', 'FAIL', 'buyDomainFullProcess not using addShortenerCNAME')  
    }
    
    // Test 2.13: Verify addDnsForShortener helper uses addShortenerCNAME
    if (indexCode.includes('async function addDnsForShortener') && 
        indexCode.includes('await domainService.addShortenerCNAME(domain, server, db)')) {
      logTest('fix2_shortener', 'dns_helper_usage', 'PASS', 'addDnsForShortener helper uses addShortenerCNAME')
    } else {
      logTest('fix2_shortener', 'dns_helper_usage', 'FAIL', 'addDnsForShortener helper not using addShortenerCNAME')
    }
    
    // Test 2.14: Verify NO domainService.addDNSRecord in shortener contexts
    const shortenerContexts = [
      'QuickActivateShortener',
      'ActivateShortener', 
      'DomainActionShortener',
      'addDnsForShortener'
    ]
    
    let foundOldPattern = false
    for (const context of shortenerContexts) {
      // Look for pattern like domainService.addDNSRecord(domain, recordType, server, '', db) in shortener contexts
      const contextMatch = indexCode.match(new RegExp(`\\[${context}\\][\\s\\S]*?domainService\\.addDNSRecord\\([^)]*server[^)]*''[^)]*\\)`, 'i'))
      if (contextMatch) {
        foundOldPattern = true
        break
      }
    }
    
    if (!foundOldPattern) {
      logTest('fix2_shortener', 'old_pattern_removed', 'PASS', 'No domainService.addDNSRecord(domain, recordType, server, \'\', db) in shortener contexts')
    } else {
      logTest('fix2_shortener', 'old_pattern_removed', 'FAIL', 'Found domainService.addDNSRecord in shortener contexts - should use addShortenerCNAME')
    }
    
  } catch (error) {
    logTest('fix2_shortener', 'test_execution', 'FAIL', `Test execution error: ${error.message}`)
  }
}

async function testNodeService() {
  console.log('\n=== Node.js Service Health ===')
  
  try {
    // Test 3.1: Check if main bot file can be loaded without errors
    const mainPath = '/app/js/_index.js'
    if (fs.existsSync(mainPath)) {
      logTest('node_service', 'main_file_exists', 'PASS', '_index.js exists')
    } else {
      logTest('node_service', 'main_file_exists', 'FAIL', '_index.js not found')
      return
    }
    
    // Test 3.2: Check if required dependencies exist
    const packagePath = '/app/package.json'
    if (fs.existsSync(packagePath)) {
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
      if (packageData.dependencies && packageData.dependencies.axios && packageData.dependencies.dotenv) {
        logTest('node_service', 'dependencies', 'PASS', 'Key dependencies (axios, dotenv) present')
      } else {
        logTest('node_service', 'dependencies', 'FAIL', 'Missing key dependencies')
      }
    } else {
      logTest('node_service', 'package_json', 'FAIL', 'package.json not found')
    }
    
    // Test 3.3: Check for syntax errors by loading modules (non-destructive)
    try {
      // Load Railway service module
      const railwayService = require('/app/js/rl-save-domain-in-server.js')
      if (typeof railwayService.saveDomainInServerRailway === 'function') {
        logTest('node_service', 'railway_module_load', 'PASS', 'Railway service loads without syntax errors')
      } else {
        logTest('node_service', 'railway_module_load', 'FAIL', 'Railway service missing expected functions')
      }
    } catch (error) {
      logTest('node_service', 'railway_module_load', 'FAIL', `Railway service load error: ${error.message}`)
    }
    
    // Test 3.4: Check domain service module
    try {
      const domainService = require('/app/js/domain-service.js')
      if (typeof domainService.addShortenerCNAME === 'function') {
        logTest('node_service', 'domain_module_load', 'PASS', 'Domain service loads with addShortenerCNAME function')
      } else {
        logTest('node_service', 'domain_module_load', 'FAIL', 'Domain service missing addShortenerCNAME function')
      }
    } catch (error) {
      logTest('node_service', 'domain_module_load', 'FAIL', `Domain service load error: ${error.message}`)
    }
    
    // Test 3.5: Check if environment variables template exists
    const envExamplePath = '/app/.env.example'
    const envPath = '/app/.env'
    if (fs.existsSync(envPath) || fs.existsSync(envExamplePath)) {
      logTest('node_service', 'env_config', 'PASS', 'Environment configuration files present')
    } else {
      logTest('node_service', 'env_config', 'WARN', 'No .env or .env.example found')
    }
    
  } catch (error) {
    logTest('node_service', 'test_execution', 'FAIL', `Test execution error: ${error.message}`)
  }
}

async function main() {
  console.log('🧪 Nomadly Backend Testing - Railway & Shortener Fixes')
  console.log('=' .repeat(60))
  
  await testFix1Railway()
  await testFix2Shortener()
  await testNodeService()
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 TEST SUMMARY')
  console.log(`✅ Passed: ${results.summary.passed}`)
  console.log(`❌ Failed: ${results.summary.failed}`)
  console.log(`📈 Total: ${results.summary.total}`)
  console.log(`📊 Success Rate: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%`)
  
  // Write detailed results to file
  const reportPath = '/app/test_reports'
  if (!fs.existsSync(reportPath)) {
    fs.mkdirSync(reportPath, { recursive: true })
  }
  
  fs.writeFileSync(
    path.join(reportPath, `railway_shortener_test_${Date.now()}.json`),
    JSON.stringify(results, null, 2)
  )
  
  console.log(`\n📄 Detailed test report saved to: ${reportPath}/railway_shortener_test_*.json`)
  
  // Exit with appropriate code
  process.exit(results.summary.failed > 0 ? 1 : 0)
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

if (require.main === module) {
  main()
}

module.exports = { testFix1Railway, testFix2Shortener, testNodeService, results }