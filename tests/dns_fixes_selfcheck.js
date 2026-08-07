/* Plain-node self-check for the 2026-08-07 group-D DNS fixes.
 * Run: node tests/dns_fixes_selfcheck.js
 * No jest/nock needed — verifies the pure logic that createDNSRecord /
 * deleteDNSRecord / sanitizeProviderError now rely on.
 */
const assert = require('assert')
const cf = require('../js/cf-service')
const { sanitizeProviderError } = require('../js/sanitize-provider.js')

let pass = 0
const ok = (name, cond) => { assert.ok(cond, `FAIL: ${name}`); pass++; console.log('  ✓', name) }

console.log('D1 — createDNSRecord "already exists" classification')
ok('81053 already-exists', cf._classifyCreateError([{ code: 81053 }], 400).alreadyExists === true)
ok('81057 already-exists', cf._classifyCreateError([{ code: 81057 }], 400).alreadyExists === true)
ok('81058 already-exists', cf._classifyCreateError([{ code: 81058 }], 400).alreadyExists === true)
ok('403 out-of-account',  cf._classifyCreateError([{ code: 1004 }], 403).outOfAccount === true)
ok('10000 out-of-account', cf._classifyCreateError([{ code: 10000 }], 400).outOfAccount === true)
const benign = cf._classifyCreateError([{ code: 9999 }], 500)
ok('benign neither', benign.alreadyExists === false && benign.outOfAccount === false)

console.log('D2 — deleteDNSRecord 404 idempotency')
ok('404 idempotent', cf._isIdempotentDeleteStatus(404) === true)
ok('500 not idempotent', cf._isIdempotentDeleteStatus(500) === false)

console.log('D3 — registrar "domain status" lock → friendly message')
const nsOut = sanitizeProviderError('This action is prohibitted for current domain status', 'domain')
ok('maps to friendly (no "prohibit", has "Support")', /support/i.test(nsOut) && !/prohibit/i.test(nsOut))
console.log('     →', nsOut)
ok('no false positive on unrelated error',
  /already registered/i.test(sanitizeProviderError('Domain is already registered', 'domain')))

console.log(`\nALL PASSED (${pass} assertions)`)
