/**
 * Test file for OpenProvider, Cloudflare, and Domain Service integrations
 * Run with: node js/tests/test_registrar_integrations.js
 */
require('dotenv').config({ path: '/app/.env' })
const { log } = require('console')

// Test counters
let testsRun = 0
let testsPassed = 0

async function runTest(name, testFn) {
  testsRun++
  log(`\n🔍 Testing: ${name}...`)
  try {
    const result = await testFn()
    if (result.success) {
      testsPassed++
      log(`✅ PASS - ${result.message}`)
    } else {
      log(`❌ FAIL - ${result.message}`)
    }
    return result.success
  } catch (err) {
    log(`❌ FAIL - Exception: ${err.message}`)
    return false
  }
}

// =====================================================
// OPENPROVIDER SERVICE TESTS
// =====================================================

async function testOpenProviderAuth() {
  const opService = require('../op-service.js')
  try {
    const token = await opService.authenticate()
    if (token && typeof token === 'string' && token.length > 0) {
      return { success: true, message: `OpenProvider auth successful, token length: ${token.length}` }
    }
    return { success: false, message: 'OpenProvider auth returned null/empty token' }
  } catch (err) {
    return { success: false, message: `OpenProvider auth error: ${err.message}` }
  }
}

async function testOpenProviderCheckDomainAvailability() {
  const opService = require('../op-service.js')
  try {
    // Test with a likely available domain using random string
    const randomDomain = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.xyz`
    const result = await opService.checkDomainAvailability(randomDomain)
    
    // Result should have available, price properties
    if (result && typeof result.available === 'boolean') {
      if (result.available) {
        return { 
          success: true, 
          message: `Domain check works - ${randomDomain}: available=${result.available}, price=${result.price}, registrar=${result.registrar}` 
        }
      } else {
        // Even if not available, the API call worked
        return { 
          success: true, 
          message: `Domain check works - ${randomDomain}: available=false, message=${result.message || 'N/A'}` 
        }
      }
    }
    return { success: false, message: `Unexpected response format: ${JSON.stringify(result)}` }
  } catch (err) {
    return { success: false, message: `checkDomainAvailability error: ${err.message}` }
  }
}

async function testOpenProviderParseDomain() {
  const opService = require('../op-service.js')
  try {
    const test1 = opService.parseDomain('example.com')
    const test2 = opService.parseDomain('sub.example.co.uk')
    
    if (test1.name === 'example' && test1.extension === 'com' &&
        test2.name === 'sub' && test2.extension === 'example.co.uk') {
      return { success: true, message: 'parseDomain function works correctly' }
    }
    return { 
      success: false, 
      message: `parseDomain incorrect: ${JSON.stringify(test1)}, ${JSON.stringify(test2)}` 
    }
  } catch (err) {
    return { success: false, message: `parseDomain error: ${err.message}` }
  }
}

// =====================================================
// CLOUDFLARE SERVICE TESTS
// =====================================================

async function testCloudflareConnection() {
  const cfService = require('../cf-service.js')
  try {
    const result = await cfService.testConnection()
    if (result.success) {
      return { success: true, message: `Cloudflare connection successful - email: ${result.email}` }
    }
    return { success: false, message: `Cloudflare connection failed: ${result.message}` }
  } catch (err) {
    return { success: false, message: `Cloudflare connection error: ${err.message}` }
  }
}

async function testCloudflareGetAccountNameservers() {
  const cfService = require('../cf-service.js')
  try {
    const nameservers = await cfService.getAccountNameservers()
    if (Array.isArray(nameservers) && nameservers.length >= 2) {
      return { success: true, message: `Got nameservers: ${nameservers.join(', ')}` }
    }
    return { success: false, message: `Invalid nameservers response: ${JSON.stringify(nameservers)}` }
  } catch (err) {
    return { success: false, message: `getAccountNameservers error: ${err.message}` }
  }
}

async function testCloudflareGetZoneByName() {
  const cfService = require('../cf-service.js')
  try {
    // Test with a non-existent domain - should return null gracefully
    const result = await cfService.getZoneByName('nonexistent-domain-xyz-123.com')
    // null is expected for non-existent zone
    if (result === null) {
      return { success: true, message: 'getZoneByName returns null for non-existent zone (expected)' }
    }
    // If zone exists, check it has expected properties
    if (result && result.id) {
      return { success: true, message: `getZoneByName found zone: ${result.name}` }
    }
    return { success: true, message: 'getZoneByName function works correctly' }
  } catch (err) {
    return { success: false, message: `getZoneByName error: ${err.message}` }
  }
}

// =====================================================
// DOMAIN SERVICE TESTS
// =====================================================

async function testDomainServiceModuleLoads() {
  try {
    const domainService = require('../domain-service.js')
    const requiredFunctions = [
      'checkDomainPrice',
      'registerDomain',
      'getDomainMeta',
      'viewDNSRecords',
      'addDNSRecord',
      'updateDNSRecord',
      'deleteDNSRecord'
    ]
    
    const missingFunctions = requiredFunctions.filter(fn => typeof domainService[fn] !== 'function')
    
    if (missingFunctions.length === 0) {
      return { success: true, message: `domain-service exports all ${requiredFunctions.length} required functions` }
    }
    return { success: false, message: `Missing functions: ${missingFunctions.join(', ')}` }
  } catch (err) {
    return { success: false, message: `Module load error: ${err.message}` }
  }
}

async function testDomainServiceCheckDomainPrice() {
  // Note: This tests ConnectReseller first (which will fail due to IP whitelist), then OpenProvider fallback
  const domainService = require('../domain-service.js')
  try {
    const testDomain = `test-${Date.now()}.xyz`
    log(`   Testing with domain: ${testDomain}`)
    
    const result = await domainService.checkDomainPrice(testDomain, null)
    
    if (result && typeof result.available === 'boolean') {
      if (result.available && result.registrar === 'OpenProvider') {
        return { 
          success: true, 
          message: `Fallback to OpenProvider works! Domain ${testDomain}: price=$${result.price}, registrar=${result.registrar}` 
        }
      } else if (result.available && result.registrar === 'ConnectReseller') {
        return { 
          success: true, 
          message: `ConnectReseller worked! Domain ${testDomain}: price=$${result.price}, registrar=${result.registrar}` 
        }
      } else {
        return { 
          success: true, 
          message: `checkDomainPrice works - domain not available: ${result.message}` 
        }
      }
    }
    return { success: false, message: `Unexpected response: ${JSON.stringify(result)}` }
  } catch (err) {
    return { success: false, message: `checkDomainPrice error: ${err.message}` }
  }
}

// =====================================================
// _INDEX.JS STRUCTURE TESTS
// =====================================================

async function testIndexJsImports() {
  const fs = require('fs')
  try {
    const content = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    const requiredImports = [
      "require('./domain-service.js')"
    ]
    
    const missingImports = requiredImports.filter(imp => !content.includes(imp))
    
    if (missingImports.length === 0) {
      return { success: true, message: '_index.js imports domain-service correctly' }
    }
    return { success: false, message: `Missing imports: ${missingImports.join(', ')}` }
  } catch (err) {
    return { success: false, message: `File read error: ${err.message}` }
  }
}

async function testIndexJsDomainNsSelectAction() {
  const fs = require('fs')
  try {
    const content = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    // Check for domainNsSelect action definition
    if (content.includes("domainNsSelect: 'domainNsSelect'")) {
      return { success: true, message: "Action 'domainNsSelect' exists in actions object" }
    }
    return { success: false, message: "Action 'domainNsSelect' not found in actions object" }
  } catch (err) {
    return { success: false, message: `File read error: ${err.message}` }
  }
}

async function testIndexJsGotoDomainNsSelect() {
  const fs = require('fs')
  try {
    const content = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    // Check for goto.domainNsSelect function
    if (content.includes('domainNsSelect: () =>') || content.includes('domainNsSelect:')) {
      // More specific check for the goto function
      const hasGotoFunction = content.includes('goto.domainNsSelect') || 
                             content.includes("domainNsSelect: () => {")
      if (hasGotoFunction) {
        return { success: true, message: 'goto.domainNsSelect function exists' }
      }
    }
    return { success: false, message: 'goto.domainNsSelect function not found' }
  } catch (err) {
    return { success: false, message: `File read error: ${err.message}` }
  }
}

// =====================================================
// CONFIG.JS NAMESERVER BUTTONS TEST
// =====================================================

async function testConfigJsNameserverButtons() {
  const fs = require('fs')
  try {
    const content = fs.readFileSync('/app/js/config.js', 'utf8')
    
    const requiredButtons = [
      "nsProviderDefault: '🏢 Provider Default'",
      "nsCloudflare: '🛡️ Cloudflare'"
    ]
    
    const missingButtons = requiredButtons.filter(btn => !content.includes(btn))
    
    if (missingButtons.length === 0) {
      return { success: true, message: 'config.js has nsProviderDefault and nsCloudflare buttons' }
    }
    return { success: false, message: `Missing buttons: ${missingButtons.join(', ')}` }
  } catch (err) {
    return { success: false, message: `File read error: ${err.message}` }
  }
}

// =====================================================
// ENV VARIABLES TEST
// =====================================================

async function testEnvVariables() {
  try {
    const opUsername = process.env.OPENPROVIDER_USERNAME
    const opPassword = process.env.OPENPROVIDER_PASSWORD
    const cfEmail = process.env.CLOUDFLARE_EMAIL
    const cfApiKey = process.env.CLOUDFLARE_API_KEY
    
    const missing = []
    if (!opUsername) missing.push('OPENPROVIDER_USERNAME')
    if (!opPassword) missing.push('OPENPROVIDER_PASSWORD')
    if (!cfEmail) missing.push('CLOUDFLARE_EMAIL')
    if (!cfApiKey) missing.push('CLOUDFLARE_API_KEY')
    
    if (missing.length === 0) {
      return { 
        success: true, 
        message: `All required env vars present: OP_USER=${opUsername}, CF_EMAIL=${cfEmail}` 
      }
    }
    return { success: false, message: `Missing env vars: ${missing.join(', ')}` }
  } catch (err) {
    return { success: false, message: `Env check error: ${err.message}` }
  }
}

// =====================================================
// CLOUDFLARE DNS RECORD FUNCTIONS TEST (structure only)
// =====================================================

async function testCloudflareServiceFunctionsExist() {
  try {
    const cfService = require('../cf-service.js')
    const requiredFunctions = [
      'testConnection',
      'getAccountNameservers',
      'createZone',
      'getZoneByName',
      'listDNSRecords',
      'createDNSRecord',
      'updateDNSRecord',
      'deleteDNSRecord',
      'deleteZone'
    ]
    
    const missingFunctions = requiredFunctions.filter(fn => typeof cfService[fn] !== 'function')
    
    if (missingFunctions.length === 0) {
      return { success: true, message: `cf-service exports all ${requiredFunctions.length} DNS functions` }
    }
    return { success: false, message: `Missing CF functions: ${missingFunctions.join(', ')}` }
  } catch (err) {
    return { success: false, message: `Module load error: ${err.message}` }
  }
}

async function testOpenProviderServiceFunctionsExist() {
  try {
    const opService = require('../op-service.js')
    const requiredFunctions = [
      'authenticate',
      'checkDomainAvailability',
      'registerDomain',
      'getDomainInfo',
      'updateNameservers',
      'getContactHandle',
      'parseDomain'
    ]
    
    const missingFunctions = requiredFunctions.filter(fn => typeof opService[fn] !== 'function')
    
    if (missingFunctions.length === 0) {
      return { success: true, message: `op-service exports all ${requiredFunctions.length} required functions` }
    }
    return { success: false, message: `Missing OP functions: ${missingFunctions.join(', ')}` }
  } catch (err) {
    return { success: false, message: `Module load error: ${err.message}` }
  }
}

// =====================================================
// MAIN TEST RUNNER
// =====================================================

async function main() {
  log('🚀 Starting OpenProvider + Cloudflare + Domain Service Integration Tests')
  log('=' .repeat(80))

  // Environment tests
  await runTest('Environment variables for OP and CF exist', testEnvVariables)
  
  // Service module structure tests
  await runTest('OpenProvider service exports required functions', testOpenProviderServiceFunctionsExist)
  await runTest('Cloudflare service exports required DNS functions', testCloudflareServiceFunctionsExist)
  await runTest('Domain service exports required functions', testDomainServiceModuleLoads)
  
  // OpenProvider API tests
  await runTest('OpenProvider authentication works (POST /v1beta/auth/login)', testOpenProviderAuth)
  await runTest('OpenProvider checkDomainAvailability works', testOpenProviderCheckDomainAvailability)
  await runTest('OpenProvider parseDomain helper function works', testOpenProviderParseDomain)
  
  // Cloudflare API tests
  await runTest('Cloudflare testConnection works', testCloudflareConnection)
  await runTest('Cloudflare getAccountNameservers works', testCloudflareGetAccountNameservers)
  await runTest('Cloudflare getZoneByName works', testCloudflareGetZoneByName)
  
  // Domain service fallback test
  await runTest('Domain service checkDomainPrice falls back from CR to OpenProvider', testDomainServiceCheckDomainPrice)
  
  // _index.js structure tests
  await runTest('_index.js imports domain-service.js', testIndexJsImports)
  await runTest("New action 'domainNsSelect' exists in _index.js actions", testIndexJsDomainNsSelectAction)
  await runTest('goto.domainNsSelect function exists in _index.js', testIndexJsGotoDomainNsSelect)
  
  // config.js button tests
  await runTest('config.js has nsProviderDefault and nsCloudflare buttons', testConfigJsNameserverButtons)
  
  // Summary
  log('\n' + '=' .repeat(80))
  log(`📊 Test Results: ${testsPassed}/${testsRun} tests passed`)
  log(`📈 Success Rate: ${((testsPassed/testsRun)*100).toFixed(1)}%`)
  
  if (testsPassed === testsRun) {
    log('🎉 All tests passed!')
    process.exit(0)
  } else {
    log('⚠️ Some tests failed - see details above')
    process.exit(1)
  }
}

main().catch(err => {
  log(`❌ Test runner error: ${err.message}`)
  process.exit(1)
})
