/**
 * Behavioral check for @hellpeaces EPERM fix — mocked axios error simulation.
 * Task 6 from the review request: simulate an axios error with HTTP 500 and
 * the exact body shape @hellpeaces encountered, then assert the helpers
 * extract and detect the EPERM correctly.
 */

const assert = require('assert')

// Set WHM_HOST before requiring cpanel-proxy
process.env.WHM_HOST = 'test.example.com'
const cpProxy = require('./js/cpanel-proxy')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`✅ ${name}`)
    passed++
  } catch (e) {
    console.error(`❌ ${name}`)
    console.error(`   ${e.message}`)
    failed++
  }
}

console.log('\n=== Behavioral Check: Mocked Axios Error ===\n')

// Simulate the exact axios error shape @hellpeaces encountered
const mockAxiosError = {
  response: {
    status: 500,
    data: {
      cpanelresult: {
        data: [{
          reason: '"/usr/local/cpanel/uapi" exited with status 1 (EPERM).'
        }]
      }
    }
  },
  message: 'Request failed with status code 500'
}

test('extractCpanelErrorFromResponse extracts the EPERM reason', () => {
  const extracted = cpProxy.extractCpanelErrorFromResponse(mockAxiosError, 'test.example.com')
  assert.strictEqual(
    extracted,
    '"/usr/local/cpanel/uapi" exited with status 1 (EPERM).',
    `Expected exact EPERM reason, got: ${extracted}`
  )
})

test('looksLikeUapiPermFailure detects the extracted EPERM', () => {
  const extracted = cpProxy.extractCpanelErrorFromResponse(mockAxiosError, 'test.example.com')
  assert.strictEqual(
    cpProxy.looksLikeUapiPermFailure(extracted),
    true,
    'Should detect EPERM in the extracted reason'
  )
})

// Benign error body (not EPERM)
const benignError = {
  response: {
    status: 400,
    data: {
      errors: ['Directory already exists']
    }
  },
  message: 'Request failed with status code 400'
}

test('looksLikeUapiPermFailure returns false for benign errors', () => {
  const extracted = cpProxy.extractCpanelErrorFromResponse(benignError, 'test.example.com')
  assert.strictEqual(
    cpProxy.looksLikeUapiPermFailure(extracted),
    false,
    'Should NOT detect EPERM in benign error'
  )
})

// Additional EPERM patterns
test('looksLikeUapiPermFailure detects "permission denied"', () => {
  assert.strictEqual(
    cpProxy.looksLikeUapiPermFailure('Operation failed: permission denied'),
    true
  )
})

test('looksLikeUapiPermFailure detects "not permitted"', () => {
  assert.strictEqual(
    cpProxy.looksLikeUapiPermFailure('Action not permitted for this user'),
    true
  )
})

test('looksLikeUapiPermFailure detects "uapi ... status 1"', () => {
  assert.strictEqual(
    cpProxy.looksLikeUapiPermFailure('uapi command exited with status 1'),
    true
  )
})

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed === 0 ? 0 : 1)
