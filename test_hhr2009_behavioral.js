// Behavioral check for @HHR2009 fix — verify handler behavior with mocked registerDomainAndCreateCpanel
const assert = require('assert')

// Mock the send function
const mockSends = []
function mockSend(chatId, text) {
  mockSends.push({ chatId, text })
}

// Load the queue and handlers
const queue = require('./js/cpanel-job-queue')
const handlers = require('./js/cpanel-job-handlers')

// Capture the provision handler by intercepting registerHandler
let provisionHandler = null
const originalRegisterHandler = queue.registerHandler
queue.registerHandler = function(type, handler) {
  if (type === 'provision') {
    provisionHandler = handler
  }
  return originalRegisterHandler.call(this, type, handler)
}

// Re-require handlers to capture the provision handler
delete require.cache[require.resolve('./js/cpanel-job-handlers')]
require('./js/cpanel-job-handlers')

// Restore original registerHandler
queue.registerHandler = originalRegisterHandler

console.log('[Behavioral Check] Starting...')

// Mock registerDomainAndCreateCpanel
const mockRegisterPath = require.resolve('./js/cr-register-domain-&-create-cpanel')
const originalModule = require.cache[mockRegisterPath]

async function runTest(testName, mockReturnValue, expectations) {
  console.log(`\n[Test] ${testName}`)
  mockSends.length = 0 // Clear previous sends
  
  // Mock the module
  require.cache[mockRegisterPath] = {
    exports: async function() {
      return mockReturnValue
    }
  }
  
  // Create a mock job
  const job = {
    chatId: 1960615421,
    lang: 'en',
    domain: 'paperlesseviteguestreview.com',
    params: { info: { website_name: 'paperlesseviteguestreview.com' } }
  }
  
  const deps = {
    send: mockSend,
    db: null
  }
  
  // Call the handler
  const result = await provisionHandler({ job, deps })
  
  // Check expectations
  console.log(`  Result: ${JSON.stringify(result)}`)
  
  if (expectations.ok !== undefined) {
    assert.strictEqual(result.ok, expectations.ok, `Expected ok=${expectations.ok}, got ${result.ok}`)
    console.log(`  ✅ ok=${result.ok}`)
  }
  
  if (expectations.deferred !== undefined) {
    assert.strictEqual(result.deferred, expectations.deferred, `Expected deferred=${expectations.deferred}, got ${result.deferred}`)
    console.log(`  ✅ deferred=${result.deferred}`)
  }
  
  if (expectations.reasonMatch) {
    assert.ok(expectations.reasonMatch.test(result.reason || ''), `Expected reason to match ${expectations.reasonMatch}, got ${result.reason}`)
    console.log(`  ✅ reason matches ${expectations.reasonMatch}`)
  }
  
  if (expectations.noDeliveredDM) {
    const hasDeliveredDM = mockSends.some(s => 
      /delivered above|hosting.*ready|Login details/i.test(s.text)
    )
    assert.strictEqual(hasDeliveredDM, false, 'Expected NO "delivered above" DM')
    console.log(`  ✅ NO "delivered above" DM sent`)
  }
  
  if (expectations.hasDeliveredDM) {
    const hasDeliveredDM = mockSends.some(s => 
      /delivered above|hosting.*ready|Login details/i.test(s.text)
    )
    assert.strictEqual(hasDeliveredDM, true, 'Expected "delivered above" DM')
    console.log(`  ✅ "delivered above" DM sent`)
  }
}

async function main() {
  try {
    // Test 1: NEW-shape defer (success: false, queued: true, deferred: true, code: 'CPANEL_DOWN')
    await runTest(
      'NEW-shape defer',
      { success: false, queued: true, deferred: true, code: 'CPANEL_DOWN' },
      {
        ok: false,
        deferred: true,
        reasonMatch: /CPANEL_DOWN/,
        noDeliveredDM: true
      }
    )
    
    // Test 2: LEGACY buggy shape (success: true, queued: true)
    await runTest(
      'LEGACY buggy shape',
      { success: true, queued: true },
      {
        ok: false,
        deferred: true,
        noDeliveredDM: true
      }
    )
    
    // Test 3: TRUE success (success: true, no queued)
    await runTest(
      'TRUE success',
      { success: true },
      {
        ok: true,
        hasDeliveredDM: true
      }
    )
    
    console.log('\n✅ ALL BEHAVIORAL TESTS PASSED')
    
  } catch (err) {
    console.error(`\n❌ TEST FAILED: ${err.message}`)
    console.error(err.stack)
    process.exit(1)
  } finally {
    // Restore original module
    if (originalModule) {
      require.cache[mockRegisterPath] = originalModule
    }
  }
}

main()
