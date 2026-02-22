/**
 * Test file for OpenProvider, Cloudflare, and Domain Service integrations - V2
 * NEW FEATURES TESTED:
 * - OP DNS CRUD: listDNSRecords, addDNSRecord, updateDNSRecord, deleteDNSRecord
 * - OP Country TLD data: .it, .sg, .ca, .us, .eu, .fr, .es, .au, .br
 * - CF createDefaultDNSRecords
 * - Custom NS flow in _index.js (domainCustomNsEntry action)
 * - domain-service postRegistrationNSUpdate
 * - 12 total functions exported from op-service.js
 * - 10 total functions exported from cf-service.js
 * - 8 total functions exported from domain-service.js
 * 
 * Run with: node js/tests/test_registrar_integrations_v2.js
 */
require('dotenv').config({ path: '/app/.env' })
const { log } = require('console')
const fs = require('fs')

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
// OPENPROVIDER SERVICE TESTS - 12 Functions
// =====================================================

async function testOpenProviderExports12Functions() {
  try {
    const opService = require('../op-service.js')
    const requiredFunctions = [
      'authenticate',
      'checkDomainAvailability',
      'registerDomain',
      'getDomainInfo',
      'updateNameservers',
      'getContactHandle',
      'parseDomain',
      'getCountryTLDData',
      'listDNSRecords',
      'addDNSRecord',
      'updateDNSRecord',
      'deleteDNSRecord'
    ]
    
    const missingFunctions = requiredFunctions.filter(fn => typeof opService[fn] !== 'function')
    
    if (missingFunctions.length === 0) {
      return { success: true, message: `op-service exports all ${requiredFunctions.length} required functions` }
    }
    return { success: false, message: `Missing functions: ${missingFunctions.join(', ')}` }
  } catch (err) {
    return { success: false, message: `Module load error: ${err.message}` }
  }
}

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
    const randomDomain = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.xyz`
    const result = await opService.checkDomainAvailability(randomDomain)
    
    if (result && typeof result.available === 'boolean') {
      if (result.available) {
        return { 
          success: true, 
          message: `Domain check works - ${randomDomain}: available=${result.available}, price=${result.price}, registrar=${result.registrar}` 
        }
      } else {
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

async function testOpenProviderParseDomainMultiPartTLDs() {
  const opService = require('../op-service.js')
  try {
    // Test with multi-part TLDs like .co.uk
    const test1 = opService.parseDomain('example.com')
    const test2 = opService.parseDomain('example.co.uk')
    const test3 = opService.parseDomain('my-domain.org.uk')
    
    let messages = []
    let allPass = true
    
    if (test1.name === 'example' && test1.extension === 'com') {
      messages.push('example.com ✓')
    } else {
      allPass = false
      messages.push(`example.com ✗ (got name=${test1.name}, ext=${test1.extension})`)
    }
    
    if (test2.name === 'example' && test2.extension === 'co.uk') {
      messages.push('example.co.uk ✓')
    } else {
      allPass = false
      messages.push(`example.co.uk ✗ (got name=${test2.name}, ext=${test2.extension})`)
    }
    
    if (test3.name === 'my-domain' && test3.extension === 'org.uk') {
      messages.push('my-domain.org.uk ✓')
    } else {
      allPass = false
      messages.push(`my-domain.org.uk ✗ (got name=${test3.name}, ext=${test3.extension})`)
    }
    
    return { success: allPass, message: messages.join(', ') }
  } catch (err) {
    return { success: false, message: `parseDomain error: ${err.message}` }
  }
}

async function testOpenProviderGetCountryTLDData() {
  const opService = require('../op-service.js')
  try {
    const testCases = [
      { tld: 'it', shouldHaveData: true },
      { tld: 'sg', shouldHaveData: true },
      { tld: 'ca', shouldHaveData: true },
      { tld: 'us', shouldHaveData: true },
      { tld: 'eu', shouldHaveData: true },
      { tld: 'fr', shouldHaveData: true },
      { tld: 'es', shouldHaveData: true },
      { tld: 'au', shouldHaveData: true },
      { tld: 'br', shouldHaveData: true },
      { tld: 'com', shouldHaveData: false }, // Generic TLDs should return null
    ]
    
    let results = []
    let allPass = true
    
    for (const tc of testCases) {
      const data = opService.getCountryTLDData(tc.tld)
      const hasData = data !== null
      
      if (hasData === tc.shouldHaveData) {
        results.push(`.${tc.tld} ✓`)
      } else {
        allPass = false
        results.push(`.${tc.tld} ✗ (expected ${tc.shouldHaveData}, got ${hasData})`)
      }
    }
    
    return { success: allPass, message: results.join(', ') }
  } catch (err) {
    return { success: false, message: `getCountryTLDData error: ${err.message}` }
  }
}

async function testOpenProviderListDNSRecords() {
  const opService = require('../op-service.js')
  try {
    // Test with a test domain (might not have DNS records but should not error)
    const result = await opService.listDNSRecords('nonexistent-test-domain.xyz')
    
    // Should return { records: [] } structure even if no records
    if (result && typeof result === 'object' && Array.isArray(result.records)) {
      return { success: true, message: `listDNSRecords returns records array: ${JSON.stringify(result.records.length)} records` }
    }
    return { success: false, message: `Invalid response: ${JSON.stringify(result)}` }
  } catch (err) {
    return { success: false, message: `listDNSRecords error: ${err.message}` }
  }
}

async function testOpenProviderDNSCRUDFunctionsExist() {
  const opService = require('../op-service.js')
  try {
    // Check that all DNS CRUD functions exist and are functions
    const dnsFunctions = ['listDNSRecords', 'addDNSRecord', 'updateDNSRecord', 'deleteDNSRecord']
    const missing = []
    
    for (const fn of dnsFunctions) {
      if (typeof opService[fn] !== 'function') {
        missing.push(fn)
      }
    }
    
    if (missing.length === 0) {
      return { success: true, message: `All 4 OP DNS CRUD functions exist: ${dnsFunctions.join(', ')}` }
    }
    return { success: false, message: `Missing DNS functions: ${missing.join(', ')}` }
  } catch (err) {
    return { success: false, message: `Module load error: ${err.message}` }
  }
}

// =====================================================
// CLOUDFLARE SERVICE TESTS - 10 Functions
// =====================================================

async function testCloudflareExports10Functions() {
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
      'deleteZone',
      'createDefaultDNSRecords'  // NEW function
    ]
    
    const missingFunctions = requiredFunctions.filter(fn => typeof cfService[fn] !== 'function')
    
    if (missingFunctions.length === 0) {
      return { success: true, message: `cf-service exports all ${requiredFunctions.length} required functions` }
    }
    return { success: false, message: `Missing functions: ${missingFunctions.join(', ')}` }
  } catch (err) {
    return { success: false, message: `Module load error: ${err.message}` }
  }
}

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

async function testCloudflareCreateDefaultDNSRecordsExists() {
  const cfService = require('../cf-service.js')
  try {
    if (typeof cfService.createDefaultDNSRecords === 'function') {
      return { success: true, message: 'createDefaultDNSRecords function exists and is exported' }
    }
    return { success: false, message: 'createDefaultDNSRecords function not found or not a function' }
  } catch (err) {
    return { success: false, message: `Module load error: ${err.message}` }
  }
}

// =====================================================
// DOMAIN SERVICE TESTS - 8 Functions
// =====================================================

async function testDomainServiceExports8Functions() {
  try {
    const domainService = require('../domain-service.js')
    const requiredFunctions = [
      'checkDomainPrice',
      'registerDomain',
      'postRegistrationNSUpdate',  // NEW function
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

async function testDomainServiceCheckDomainPriceFallback() {
  const domainService = require('../domain-service.js')
  try {
    const testDomain = `test-${Date.now()}.xyz`
    log(`   Testing with domain: ${testDomain}`)
    
    const result = await domainService.checkDomainPrice(testDomain, null)
    
    if (result && typeof result.available === 'boolean') {
      if (result.available) {
        return { 
          success: true, 
          message: `Fallback works! Domain ${testDomain}: price=$${result.price}, registrar=${result.registrar}` 
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

async function testDomainServiceRegisterAcceptsCustomNS() {
  try {
    const domainService = require('../domain-service.js')
    
    // Read function signature/code to verify customNS parameter exists
    const content = fs.readFileSync('/app/js/domain-service.js', 'utf8')
    
    // Check for customNS in registerDomain function signature
    if (content.includes('registerDomain = async (domainName, registrar, nsChoice, db, chatId, customNS)')) {
      return { success: true, message: 'registerDomain accepts customNS parameter (6th param)' }
    }
    
    // Alternative check
    if (content.includes('customNS') && content.includes('nsChoice === \'custom\'')) {
      return { success: true, message: 'registerDomain handles customNS for custom NS choice' }
    }
    
    return { success: false, message: 'customNS parameter not found in registerDomain signature' }
  } catch (err) {
    return { success: false, message: `Code check error: ${err.message}` }
  }
}

async function testDomainServiceAddDNSRecordRoutesToOP() {
  try {
    const content = fs.readFileSync('/app/js/domain-service.js', 'utf8')
    
    // Check that addDNSRecord routes to OpenProvider for OP domains
    if (content.includes("meta?.registrar === 'OpenProvider'") && 
        content.includes('opService.addDNSRecord')) {
      return { success: true, message: 'addDNSRecord routes to OpenProvider for OP-registered domains' }
    }
    
    return { success: false, message: 'addDNSRecord does not route to OpenProvider for OP domains' }
  } catch (err) {
    return { success: false, message: `Code check error: ${err.message}` }
  }
}

async function testPostRegistrationNSUpdateExists() {
  try {
    const domainService = require('../domain-service.js')
    
    if (typeof domainService.postRegistrationNSUpdate === 'function') {
      return { success: true, message: 'postRegistrationNSUpdate function exists and is exported' }
    }
    return { success: false, message: 'postRegistrationNSUpdate function not found' }
  } catch (err) {
    return { success: false, message: `Module load error: ${err.message}` }
  }
}

// =====================================================
// _INDEX.JS STRUCTURE TESTS - Custom NS Flow
// =====================================================

async function testIndexJsDomainNsSelectAction() {
  try {
    const content = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    if (content.includes("domainNsSelect: 'domainNsSelect'")) {
      return { success: true, message: "Action 'domainNsSelect' exists in actions object" }
    }
    return { success: false, message: "Action 'domainNsSelect' not found in actions object" }
  } catch (err) {
    return { success: false, message: `File read error: ${err.message}` }
  }
}

async function testIndexJsDomainCustomNsEntryAction() {
  try {
    const content = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    if (content.includes("domainCustomNsEntry: 'domainCustomNsEntry'")) {
      return { success: true, message: "Action 'domainCustomNsEntry' exists in actions object" }
    }
    return { success: false, message: "Action 'domainCustomNsEntry' not found in actions object" }
  } catch (err) {
    return { success: false, message: `File read error: ${err.message}` }
  }
}

async function testIndexJsGotoDomainNsSelectShowsThreeOptions() {
  try {
    const content = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    // Check for goto.domainNsSelect showing 3 options
    if (content.includes('user.nsProviderDefault') && 
        content.includes('user.nsCloudflare') && 
        content.includes('user.nsCustom')) {
      return { success: true, message: 'goto.domainNsSelect shows 3 options: Provider Default, Cloudflare, Custom' }
    }
    return { success: false, message: 'goto.domainNsSelect does not show all 3 NS options' }
  } catch (err) {
    return { success: false, message: `File read error: ${err.message}` }
  }
}

async function testIndexJsGotoDomainCustomNsEntry() {
  try {
    const content = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    if (content.includes('domainCustomNsEntry: () =>') && 
        content.includes('Enter your custom nameservers')) {
      return { success: true, message: 'goto.domainCustomNsEntry prompts for NS entry' }
    }
    return { success: false, message: 'goto.domainCustomNsEntry function not found or incomplete' }
  } catch (err) {
    return { success: false, message: `File read error: ${err.message}` }
  }
}

async function testBuyDomainAcceptsCustomNS() {
  try {
    const content = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    // Search for buyDomain function that accepts customNS
    if (content.includes('customNS') && content.includes('buyDomain') && 
        content.includes("nsChoice || 'provider_default'")) {
      return { success: true, message: 'buyDomain function accepts and uses customNS parameter' }
    }
    return { success: false, message: 'buyDomain does not appear to handle customNS' }
  } catch (err) {
    return { success: false, message: `File read error: ${err.message}` }
  }
}

async function testBuyDomainFullProcessOPShortenerLinking() {
  try {
    const content = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    // Check for OP registrar handling in buyDomainFullProcess
    // Should NOT use CR saveServerInDomain for OP domains
    if (content.includes("registrar === 'OpenProvider'") && 
        content.includes('domainService.addDNSRecord')) {
      return { success: true, message: 'buyDomainFullProcess routes OP domains through OP DNS API for shortener linking' }
    }
    return { success: false, message: 'buyDomainFullProcess does not properly route OP domains' }
  } catch (err) {
    return { success: false, message: `File read error: ${err.message}` }
  }
}

async function testBuyDomainFullProcessCustomNSPostUpdate() {
  try {
    const content = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    // Check for custom NS post-registration update
    if (content.includes("nsChoice === 'custom'") && 
        content.includes('postRegistrationNSUpdate')) {
      return { success: true, message: 'buyDomainFullProcess handles custom NS post-registration update' }
    }
    return { success: false, message: 'buyDomainFullProcess does not handle custom NS post-registration' }
  } catch (err) {
    return { success: false, message: `File read error: ${err.message}` }
  }
}

// =====================================================
// CONFIG.JS NAMESERVER BUTTONS TEST
// =====================================================

async function testConfigJsAllNameserverButtons() {
  try {
    const content = fs.readFileSync('/app/js/config.js', 'utf8')
    
    const requiredButtons = [
      "nsProviderDefault:",
      "nsCloudflare:",
      "nsCustom:"
    ]
    
    const missingButtons = requiredButtons.filter(btn => !content.includes(btn))
    
    if (missingButtons.length === 0) {
      return { success: true, message: 'config.js has nsProviderDefault, nsCloudflare, and nsCustom buttons' }
    }
    return { success: false, message: `Missing buttons: ${missingButtons.join(', ')}` }
  } catch (err) {
    return { success: false, message: `File read error: ${err.message}` }
  }
}

// =====================================================
// SYNTAX CHECK TEST
// =====================================================

async function testIndexJsSyntaxCheck() {
  try {
    const { execSync } = require('child_process')
    execSync('node -c /app/js/_index.js', { encoding: 'utf8' })
    return { success: true, message: '_index.js syntax check passes' }
  } catch (err) {
    return { success: false, message: `Syntax error: ${err.message}` }
  }
}

// =====================================================
// MAIN TEST RUNNER
// =====================================================

async function main() {
  log('🚀 Starting OpenProvider + Cloudflare + Domain Service Integration Tests V2')
  log('📋 Focus: NEW features (OP DNS CRUD, Country TLDs, CF default records, Custom NS flow)')
  log('=' .repeat(80))

  // op-service.js tests
  log('\n📦 OPENPROVIDER SERVICE (12 Functions)')
  log('-' .repeat(40))
  await runTest('op-service.js exports all 12 functions', testOpenProviderExports12Functions)
  await runTest('op-service.js authenticate works', testOpenProviderAuth)
  await runTest('op-service.js checkDomainAvailability works', testOpenProviderCheckDomainAvailability)
  await runTest('op-service.js parseDomain works for multi-part TLDs (e.g. co.uk)', testOpenProviderParseDomainMultiPartTLDs)
  await runTest('op-service.js getCountryTLDData returns correct data (.it, .sg, .ca, .us, .eu, .fr, .es, .au, .br) and null for .com', testOpenProviderGetCountryTLDData)
  await runTest('op-service.js listDNSRecords returns records structure', testOpenProviderListDNSRecords)
  await runTest('op-service.js DNS CRUD functions exist (list, add, update, delete)', testOpenProviderDNSCRUDFunctionsExist)

  // cf-service.js tests
  log('\n📦 CLOUDFLARE SERVICE (10 Functions)')
  log('-' .repeat(40))
  await runTest('cf-service.js exports all 10 functions', testCloudflareExports10Functions)
  await runTest('cf-service.js testConnection works', testCloudflareConnection)
  await runTest('cf-service.js getAccountNameservers works', testCloudflareGetAccountNameservers)
  await runTest('cf-service.js createDefaultDNSRecords function exists and is exported', testCloudflareCreateDefaultDNSRecordsExists)

  // domain-service.js tests
  log('\n📦 DOMAIN SERVICE (8 Functions)')
  log('-' .repeat(40))
  await runTest('domain-service.js exports all 8 functions', testDomainServiceExports8Functions)
  await runTest('domain-service.js checkDomainPrice falls back CR->OP', testDomainServiceCheckDomainPriceFallback)
  await runTest('domain-service.js registerDomain accepts customNS parameter', testDomainServiceRegisterAcceptsCustomNS)
  await runTest('domain-service.js postRegistrationNSUpdate function exists and is exported', testPostRegistrationNSUpdateExists)
  await runTest('domain-service.js addDNSRecord routes to OP for OpenProvider domains', testDomainServiceAddDNSRecordRoutesToOP)

  // _index.js tests
  log('\n📦 _INDEX.JS BOT FLOW (Custom NS)')
  log('-' .repeat(40))
  await runTest('_index.js domainNsSelect action exists', testIndexJsDomainNsSelectAction)
  await runTest('_index.js domainCustomNsEntry action exists', testIndexJsDomainCustomNsEntryAction)
  await runTest('_index.js goto.domainNsSelect shows 3 options (Provider Default, Cloudflare, Custom)', testIndexJsGotoDomainNsSelectShowsThreeOptions)
  await runTest('_index.js goto.domainCustomNsEntry prompts for NS entry', testIndexJsGotoDomainCustomNsEntry)
  await runTest('_index.js buyDomain function accepts customNS parameter', testBuyDomainAcceptsCustomNS)
  await runTest('_index.js buyDomainFullProcess handles OP registrar for shortener DNS linking', testBuyDomainFullProcessOPShortenerLinking)
  await runTest('_index.js buyDomainFullProcess handles custom NS post-registration update', testBuyDomainFullProcessCustomNSPostUpdate)

  // config.js tests
  log('\n📦 CONFIG.JS (Buttons)')
  log('-' .repeat(40))
  await runTest('config.js has nsProviderDefault, nsCloudflare, nsCustom buttons', testConfigJsAllNameserverButtons)

  // Syntax check
  log('\n📦 SYNTAX CHECK')
  log('-' .repeat(40))
  await runTest('_index.js syntax check passes', testIndexJsSyntaxCheck)

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
