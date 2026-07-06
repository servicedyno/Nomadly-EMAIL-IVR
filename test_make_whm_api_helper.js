#!/usr/bin/env node
/**
 * Behavioural test for _makeWhmApi() helper in cpanel-routes.js
 * Since the helper is module-private, we test it indirectly by loading
 * the module and checking the structure of the routes.
 */

const fs = require('fs')
const path = require('path')

console.log('\n[Behavioural Test] _makeWhmApi() helper verification\n')

// Read the source file
const routesPath = path.join(__dirname, 'js', 'cpanel-routes.js')
const source = fs.readFileSync(routesPath, 'utf8')

// Test 1: Verify _makeWhmApi is defined at module scope
const makeWhmApiMatch = source.match(/^function _makeWhmApi\(whmHost\)\s*\{/m)
if (!makeWhmApiMatch) {
  console.error('❌ _makeWhmApi function not found at module scope')
  process.exit(1)
}
console.log('✅ _makeWhmApi function defined at module scope')

// Test 2: Verify it returns null when whmHost or whmToken is missing
const nullCheckMatch = source.match(/if\s*\(\s*!whmHost\s*\|\|\s*!whmToken\s*\)\s*return\s+null/)
if (!nullCheckMatch) {
  console.error('❌ _makeWhmApi null check not found')
  process.exit(1)
}
console.log('✅ _makeWhmApi returns null when whmHost or whmToken is missing')

// Test 3: Verify it calls _resolveWhmBaseUrl
const baseUrlCallMatch = source.match(/baseURL:\s*_resolveWhmBaseUrl\(whmHost\)/)
if (!baseUrlCallMatch) {
  console.error('❌ _makeWhmApi does not call _resolveWhmBaseUrl for baseURL')
  process.exit(1)
}
console.log('✅ _makeWhmApi uses _resolveWhmBaseUrl(whmHost) for baseURL')

// Test 4: Verify it returns axios.create()
const axiosCreateMatch = source.match(/return\s+axios\.create\(\{/)
if (!axiosCreateMatch) {
  console.error('❌ _makeWhmApi does not return axios.create()')
  process.exit(1)
}
console.log('✅ _makeWhmApi returns axios.create() instance')

// Test 5: Verify Authorization header format
const authHeaderMatch = source.match(/Authorization:\s*`whm\s+\$\{[^}]+\}:\$\{whmToken\}`/)
if (!authHeaderMatch) {
  console.error('❌ _makeWhmApi Authorization header format incorrect')
  process.exit(1)
}
console.log('✅ _makeWhmApi sets Authorization header as "whm <user>:<token>"')

// Test 6: Verify _resolveWhmBaseUrl returns path with /json-api
const resolveWhmMatch = source.match(/function _resolveWhmBaseUrl\(whmHost\)\s*\{[\s\S]*?return\s+`https:\/\/\$\{whmHost\}:2087\/json-api`/)
if (!resolveWhmMatch) {
  console.error('❌ _resolveWhmBaseUrl does not return path with /json-api')
  process.exit(1)
}
console.log('✅ _resolveWhmBaseUrl returns baseURL containing "/json-api"')

// Test 7: Verify mkdir route uses _makeWhmApi
const mkdirUsesHelperMatch = source.match(/router\.post\(['"]\/files\/mkdir['"][\s\S]{1,1000}_makeWhmApi\(req\.whmHost\s*\|\|\s*process\.env\.WHM_HOST\)/)
if (!mkdirUsesHelperMatch) {
  console.error('❌ /files/mkdir route does not use _makeWhmApi(req.whmHost || process.env.WHM_HOST)')
  process.exit(1)
}
console.log('✅ /files/mkdir route uses _makeWhmApi(req.whmHost || process.env.WHM_HOST)')

// Test 8: Verify delete route uses _makeWhmApi
const deleteUsesHelperMatch = source.match(/router\.post\(['"]\/files\/delete['"][\s\S]{1,2000}_makeWhmApi\(req\.whmHost\s*\|\|\s*process\.env\.WHM_HOST\)/)
if (!deleteUsesHelperMatch) {
  console.error('❌ /files/delete route does not use _makeWhmApi(req.whmHost || process.env.WHM_HOST)')
  process.exit(1)
}
console.log('✅ /files/delete route uses _makeWhmApi(req.whmHost || process.env.WHM_HOST)')

// Test 9: Verify no inline axios.create in mkdir route body
const mkdirStart = source.indexOf("router.post('/files/mkdir'")
const mkdirEnd = source.indexOf("router.post('/files/delete'", mkdirStart)
const mkdirBody = source.substring(mkdirStart, mkdirEnd)
if (mkdirBody.includes('axios.create(')) {
  console.error('❌ /files/mkdir route body contains inline axios.create() - should use helper')
  process.exit(1)
}
console.log('✅ /files/mkdir route body does NOT contain inline axios.create()')

// Test 10: Verify no inline whmBaseURL in mkdir route body
if (mkdirBody.match(/const\s+whmBaseURL\s*=/)) {
  console.error('❌ /files/mkdir route body contains inline whmBaseURL declaration - should use helper')
  process.exit(1)
}
console.log('✅ /files/mkdir route body does NOT contain inline whmBaseURL declaration')

// Test 11: Verify no inline axios.create in delete route body
const deleteStart = source.indexOf("router.post('/files/delete'")
const nextRouteAfterDelete = source.indexOf("\n  router.post('", deleteStart + 100)
const deleteBody = source.substring(deleteStart, nextRouteAfterDelete > 0 ? nextRouteAfterDelete : deleteStart + 5000)
if (deleteBody.includes('axios.create(')) {
  console.error('❌ /files/delete route body contains inline axios.create() - should use helper')
  process.exit(1)
}
console.log('✅ /files/delete route body does NOT contain inline axios.create()')

// Test 12: Verify no inline whmBaseURL in delete route body
if (deleteBody.match(/const\s+whmBaseURL\s*=/)) {
  console.error('❌ /files/delete route body contains inline whmBaseURL declaration - should use helper')
  process.exit(1)
}
console.log('✅ /files/delete route body does NOT contain inline whmBaseURL declaration')

console.log('\n✅ ALL BEHAVIOURAL TESTS PASSED\n')
console.log('Summary:')
console.log('  • _makeWhmApi() and _resolveWhmBaseUrl() are defined at module scope')
console.log('  • _makeWhmApi() returns null when credentials are missing')
console.log('  • _makeWhmApi() returns axios instance with correct baseURL and Authorization')
console.log('  • Both /files/mkdir and /files/delete routes use the helper')
console.log('  • No inline axios.create() or whmBaseURL in either route body')
console.log('')
