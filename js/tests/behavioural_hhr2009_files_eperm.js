#!/usr/bin/env node
/**
 * Behavioral end-to-end test for @HHR2009 File Manager EPERM fix
 * 
 * Tests the GET /panel/files handler's WHM-root fallback ladder without
 * hitting real production WHM or cPanel accounts.
 * 
 * OFFLINE ONLY: Uses stubbed cpProxy.listFiles and _makeWhmApi
 */

const assert = require('assert')

// Capture console.log output for verification
const logLines = []
const originalLog = console.log
console.log = (...args) => {
  logLines.push(args.join(' '))
  originalLog(...args)
}

// Mock environment
process.env.WHM_HOST = 'test.whm.host'
process.env.WHM_TOKEN = 'test_token_stub'

// Stub the cpProxy module before requiring cpanel-routes
const Module = require('module')
const originalRequire = Module.prototype.require

let alertEpermCalls = []
let listFilesStub = null
let whmApiStub = null

Module.prototype.require = function(id) {
  if (id === './cpanel-proxy') {
    return {
      listFiles: async (...args) => {
        if (listFilesStub) return listFilesStub(...args)
        return { status: 1, data: [], errors: null }
      },
      alertEpermRepairNeeded: (opts) => {
        alertEpermCalls.push(opts)
        return true
      },
    }
  }
  if (id === './cpanel-auth') {
    return {
      signToken: (payload) => 'test_jwt_token',
      verifyToken: (token) => ({ cpUser: 'TESTUSER', cpPass: 'test_pass', whmHost: 'test.whm.host' }),
      middleware: (req, res, next) => {
        req.cpUser = 'TESTUSER'
        req.cpPass = 'test_pass'
        req.whmHost = 'test.whm.host'
        next()
      },
    }
  }
  if (id === './cf-service' || id === './safe-browsing-service' || id === './whm-service') {
    return {}
  }
  if (id === './translation') {
    return {
      translation: {
        getEpermUserMessage: (lang) => 'Friendly EPERM message',
        getEpermLocalizedMessages: () => ({
          en: 'Friendly EPERM message',
          fr: 'Message EPERM convivial',
          zh: '友好的EPERM消息',
          hi: 'मैत्रीपूर्ण EPERM संदेश',
        }),
      },
    }
  }
  if (id === './_index') {
    return {
      _db: null,
      db: null,
    }
  }
  return originalRequire.apply(this, arguments)
}

// Now require the routes module
const { createCpanelRoutes } = require('../cpanel-routes')

// Create a mock Express app
const express = require('express')
const app = express()
app.use(express.json())

// Inject _makeWhmApi stub into the routes module
const routesModule = require.cache[require.resolve('../cpanel-routes')]
if (routesModule && routesModule.exports) {
  const originalCreateRoutes = routesModule.exports
  routesModule.exports = function(...args) {
    const router = originalCreateRoutes(...args)
    
    // Monkey-patch _makeWhmApi in the module scope
    const moduleScope = routesModule.exports.toString()
    
    return router
  }
}

// Create router with stubbed _makeWhmApi
const router = createCpanelRoutes()

// Stub _makeWhmApi by patching the module's internal function
// We'll do this by intercepting axios.create calls
const axios = require('axios')
const originalAxiosCreate = axios.create

axios.create = function(config) {
  if (whmApiStub) {
    return {
      get: async (...args) => whmApiStub(...args),
    }
  }
  return originalAxiosCreate.apply(this, arguments)
}

app.use('/panel', router)

// Helper to make requests
async function makeRequest(path, query = {}) {
  return new Promise((resolve, reject) => {
    const queryString = Object.keys(query).length > 0 
      ? '?' + Object.entries(query).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
      : ''
    
    const req = {
      method: 'GET',
      url: `/panel${path}${queryString}`,
      query,
      cpUser: 'TESTUSER',
      cpPass: 'test_pass',
      whmHost: 'test.whm.host',
      headers: {},
    }
    
    const res = {
      statusCode: 200,
      _json: null,
      json: function(data) {
        this._json = data
        resolve({ status: this.statusCode, body: data })
      },
      status: function(code) {
        this.statusCode = code
        return this
      },
    }
    
    // Find the route handler
    const route = router.stack.find(layer => {
      return layer.route && layer.route.path === '/files' && layer.route.methods.get
    })
    
    if (!route) {
      reject(new Error('Route not found'))
      return
    }
    
    // Execute middleware chain
    const handlers = route.route.stack.map(layer => layer.handle)
    let index = 0
    
    const next = (err) => {
      if (err) {
        reject(err)
        return
      }
      if (index >= handlers.length) {
        resolve({ status: res.statusCode, body: res._json })
        return
      }
      const handler = handlers[index++]
      try {
        handler(req, res, next)
      } catch (e) {
        reject(e)
      }
    }
    
    next()
  })
}

// ============================================================================
// TEST CASES
// ============================================================================

async function runTests() {
  console.log('\n=== @HHR2009 File Manager EPERM Behavioral Tests ===\n')
  
  let passed = 0
  let failed = 0
  
  // ──────────────────────────────────────────────────────────────────────────
  // CASE A: Success on retry 1 (WHM fallback recovers)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[Case A] WHM fallback succeeds on retry 1')
  
  logLines.length = 0
  alertEpermCalls.length = 0
  
  // Stub: user-level fails with EPERM
  listFilesStub = async () => ({
    code: 'CPANEL_UAPI_EPERM',
    status: 0,
    errors: ['"/usr/local/cpanel/uapi" exited with status 1 (EPERM).'],
    httpStatus: 500,
  })
  
  // Stub: WHM fallback succeeds on attempt 1 (after 800ms backoff)
  let whmAttempt = 0
  whmApiStub = async (path, opts) => {
    whmAttempt++
    if (whmAttempt === 1) {
      // First attempt also fails
      return {
        data: {
          cpanelresult: {
            data: [{
              result: 0,
              reason: '"/usr/local/cpanel/uapi" exited with status 1 (EPERM).',
            }],
          },
        },
      }
    }
    // Second attempt succeeds
    return {
      data: {
        result: {
          status: 1,
          data: [
            { name: 'public_html', type: 'dir' },
            { name: 'index.html', type: 'file' },
          ],
          errors: null,
        },
      },
    }
  }
  
  try {
    const response = await makeRequest('/files', { dir: '/home/TESTUSER/public_html' })
    
    // Assertions
    assert.strictEqual(response.status, 200, 'Should return HTTP 200')
    assert.strictEqual(response.body.status, 1, 'Should return status: 1')
    assert.strictEqual(response.body.via, 'whm-fallback-retry', 'Should indicate WHM fallback retry')
    assert(Array.isArray(response.body.data), 'Should return data array')
    assert.strictEqual(response.body.data.length, 2, 'Should return 2 entries')
    assert(!response.body.code || response.body.code !== 'CPANEL_UAPI_EPERM', 'Should NOT have EPERM code in response')
    
    // Check logs
    const successLog = logLines.find(line => line.includes('list_files succeeded via WHM fallback') && line.includes('retry 1'))
    assert(successLog, 'Should log WHM fallback success with retry 1')
    assert(successLog.includes('TESTUSER'), 'Log should include cpUser for audit trail')
    
    // Should NOT call alertEpermRepairNeeded (recovered)
    assert.strictEqual(alertEpermCalls.length, 0, 'Should NOT alert ops (recovered)')
    
    console.log('  ✅ Returns HTTP 200 with status:1, via:whm-fallback-retry')
    console.log('  ✅ No CPANEL_UAPI_EPERM code in response')
    console.log('  ✅ Log contains "list_files succeeded via WHM fallback (retry 1)"')
    console.log('  ✅ Log includes cpUser (TESTUSER) for audit trail')
    console.log('  ✅ No ops alert (recovered)')
    passed += 5
  } catch (e) {
    console.error('  ❌ Case A failed:', e.message)
    failed += 5
  }
  
  // ──────────────────────────────────────────────────────────────────────────
  // CASE B: Persistent EPERM through all 3 attempts
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Case B] Persistent EPERM through all 3 attempts')
  
  logLines.length = 0
  alertEpermCalls.length = 0
  
  // Stub: user-level fails with EPERM
  listFilesStub = async () => ({
    code: 'CPANEL_UAPI_EPERM',
    status: 0,
    errors: ['"/usr/local/cpanel/uapi" exited with status 1 (EPERM).'],
    httpStatus: 500,
  })
  
  // Stub: WHM fallback also fails with EPERM on all attempts
  whmAttempt = 0
  whmApiStub = async () => {
    whmAttempt++
    return {
      data: {
        cpanelresult: {
          data: [{
            result: 0,
            reason: '"/usr/local/cpanel/uapi" exited with status 1 (EPERM).',
          }],
        },
      },
    }
  }
  
  try {
    const response = await makeRequest('/files', { dir: '/home/TESTUSER/public_html' })
    
    // Assertions
    assert.strictEqual(response.status, 200, 'Should return HTTP 200')
    assert.strictEqual(response.body.code, 'CPANEL_UAPI_EPERM', 'Should return CPANEL_UAPI_EPERM code')
    assert(response.body.error, 'Should have error message')
    assert(!response.body.error.includes('EPERM'), 'Error message should NOT contain "EPERM"')
    assert(!response.body.error.includes('uapi'), 'Error message should NOT contain "uapi"')
    assert(!response.body.error.includes('500'), 'Error message should NOT contain "500"')
    assert(response.body.localizedMessages, 'Should have localizedMessages')
    assert(response.body.localizedMessages.en, 'Should have EN message')
    assert(response.body.localizedMessages.fr, 'Should have FR message')
    assert(response.body.localizedMessages.zh, 'Should have ZH message')
    assert(response.body.localizedMessages.hi, 'Should have HI message')
    
    // Check logs
    const blockedLog = logLines.find(line => 
      line.includes('[Panel]') && 
      line.includes('open folder') && 
      line.includes('blocked by broken-homedir EPERM') &&
      line.includes('TESTUSER')
    )
    assert(blockedLog, 'Should log blocked EPERM with cpUser')
    
    // Should call alertEpermRepairNeeded exactly once
    assert.strictEqual(alertEpermCalls.length, 1, 'Should alert ops exactly once')
    assert.strictEqual(alertEpermCalls[0].op, 'open folder', 'Alert should specify "open folder" operation')
    assert.strictEqual(alertEpermCalls[0].cpUser, 'TESTUSER', 'Alert should include cpUser')
    assert.strictEqual(alertEpermCalls[0].whmHost, 'test.whm.host', 'Alert should include whmHost')
    
    console.log('  ✅ Returns HTTP 200 with code:CPANEL_UAPI_EPERM')
    console.log('  ✅ Error message is friendly (no "EPERM", "uapi", or "500")')
    console.log('  ✅ Has localizedMessages (en/fr/zh/hi)')
    console.log('  ✅ Log contains "[Panel] open folder blocked by broken-homedir EPERM (user: TESTUSER)"')
    console.log('  ✅ alertEpermRepairNeeded called exactly once with correct params')
    passed += 5
  } catch (e) {
    console.error('  ❌ Case B failed:', e.message)
    console.error('  Response:', JSON.stringify(e.response?.body || {}, null, 2))
    failed += 5
  }
  
  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70))
  if (failed === 0) {
    console.log(`✅ ALL BEHAVIORAL CHECKS PASSED (${passed}/${passed})`)
    console.log('\n@HHR2009 File Manager EPERM WHM-root fallback is working correctly.')
    process.exit(0)
  } else {
    console.log(`❌ SOME CHECKS FAILED (${passed}/${passed + failed} passed)`)
    process.exit(1)
  }
}

// Run tests
runTests().catch(e => {
  console.error('Test suite error:', e)
  process.exit(1)
})
