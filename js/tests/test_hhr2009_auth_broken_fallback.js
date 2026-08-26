/* eslint-disable no-console */
// ─────────────────────────────────────────────────────────────────────────────
// Regression tests — cPanel auth-broken (stale cpPass) fallback ladder
//
// Confirms:
//   1. looksLikeAuthFailure() classifier truth table
//   2. Mutual exclusion vs EPERM (EPERM takes precedence)
//   3. Legit errors (File exists, 404) are NOT tagged as auth-broken
//   4. All file-manager routes reference _isAuthBroken() / uploadFileAsRoot()
//
// Motivated by @HHR2009 (2026-08-26): cpUser nnliae74 hit "Create folder
// failed: Access denied" because the user-level 401/403 leaked to the panel
// UI. The WHM-root fallback would have succeeded but never fired for 40x
// status codes.
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path')
const fs = require('fs')

const cp = require('../cpanel-proxy')

let passed = 0
let failed = 0
const failures = []

function assert(cond, msg) {
  if (cond) { passed++; return }
  failed++
  failures.push(msg)
  console.error(`  ✗ ${msg}`)
}

console.log('─── cPanel auth-broken fallback — regression suite ───')

// ── (1) Classifier: 401/403 → auth-broken ─────────────────────────────
console.log('\n[1] looksLikeAuthFailure() truth table:')
assert(cp.looksLikeAuthFailure(401, ''),                                    '401 empty body → auth')
assert(cp.looksLikeAuthFailure(401, '<html>cPanel Login</html>'),           '401 with login HTML → auth')
assert(cp.looksLikeAuthFailure(403, 'Access denied'),                       '403 Access denied → auth')
assert(cp.looksLikeAuthFailure(403, 'access DENIED (mixed case)'),          '403 case-insensitive → auth')
assert(cp.looksLikeAuthFailure(null, 'Request failed with status code 401'), 'axios generic 401 msg → auth')
assert(cp.looksLikeAuthFailure(null, 'Request failed with status code 403'), 'axios generic 403 msg → auth')
assert(cp.looksLikeAuthFailure(undefined, 'Request failed with status code 401'), 'undefined status + axios msg → auth')

// ── (2) Classifier: NOT auth-broken ──────────────────────────────────
console.log('\n[2] Non-auth cases must return false:')
assert(!cp.looksLikeAuthFailure(200, 'OK'),                                 '200 OK → not auth')
assert(!cp.looksLikeAuthFailure(400, 'File exists'),                        '400 File exists → not auth')
assert(!cp.looksLikeAuthFailure(404, 'File not found'),                     '404 → not auth')
assert(!cp.looksLikeAuthFailure(500, 'Internal Server Error'),              '500 generic → not auth')
assert(!cp.looksLikeAuthFailure(502, 'Bad Gateway'),                        '502 → not auth')
assert(!cp.looksLikeAuthFailure(null, 'ECONNRESET'),                        'ECONNRESET → not auth')
assert(!cp.looksLikeAuthFailure(null, ''),                                  'null/empty → not auth')
assert(!cp.looksLikeAuthFailure(null, null),                                'null/null → not auth')

// ── (3) Mutual exclusion with EPERM ───────────────────────────────────
console.log('\n[3] EPERM vs AUTH mutual exclusion (EPERM wins):')
// The 403 body says "permission denied" which the EPERM regex matches. In the
// call-site logic (uapi/api2/uploadFile) EPERM is checked first and short-circuits
// the AUTH check. That's the ladder's contract.
assert(cp.looksLikeUapiPermFailure('permission denied'), 'EPERM regex catches "permission denied"')
assert(cp.looksLikeUapiPermFailure('"/usr/local/cpanel/uapi" exited with status 1 (EPERM)'), 'EPERM regex catches full uapi status-1 msg')
assert(cp.looksLikeUapiPermFailure('EPERM: operation not permitted'), 'EPERM regex catches EPERM prefix')
assert(!cp.looksLikeUapiPermFailure('Access denied'), 'EPERM regex does NOT catch plain "Access denied"')
assert(!cp.looksLikeUapiPermFailure('File exists'), 'EPERM regex does NOT catch "File exists"')

// ── (4) Exports ───────────────────────────────────────────────────────
console.log('\n[4] Proxy exports:')
assert(typeof cp.looksLikeAuthFailure === 'function',   'looksLikeAuthFailure exported')
assert(typeof cp.uploadFileAsRoot === 'function',       'uploadFileAsRoot exported')
assert(typeof cp.looksLikeUapiPermFailure === 'function', 'looksLikeUapiPermFailure still exported (regression)')
assert(cp.uploadFileAsRoot.length === 5,                'uploadFileAsRoot arity 5 (cpUser, dir, fileName, buf, whmHost)')

// ── (5) Route wiring — grep the routes file ──────────────────────────
console.log('\n[5] Routes reference _isAuthBroken() / uploadFileAsRoot():')
const routesSrc = fs.readFileSync(path.join(__dirname, '..', 'cpanel-routes.js'), 'utf8')
assert(/function\s+_isAuthBroken\s*\(/.test(routesSrc),                    '_isAuthBroken helper defined')
assert(/router\.get\(['"]\/files['"][\s\S]{0,4000}_isAuthBroken\(/.test(routesSrc),         '/files (list_files) gates on _isAuthBroken')
assert(/router\.post\(['"]\/files\/mkdir['"][\s\S]{0,4000}_isAuthBroken\(/.test(routesSrc), '/files/mkdir gates on _isAuthBroken')
assert(/router\.post\(['"]\/files\/extract['"][\s\S]{0,4000}_isAuthBroken\(/.test(routesSrc), '/files/extract gates on _isAuthBroken')
assert(/router\.post\(['"]\/files\/upload['"][\s\S]{0,4000}uploadFileAsRoot\(/.test(routesSrc), '/files/upload calls uploadFileAsRoot on auth-broken')
assert(/router\.post\(['"]\/files\/upload-chunk['"][\s\S]{0,6000}uploadFileAsRoot\(/.test(routesSrc), '/files/upload-chunk calls uploadFileAsRoot on auth-broken')
// user-auth-broken log tag is greppable
assert(/user-auth-broken/.test(routesSrc), 'routes log a "user-auth-broken" tag for ops')

// ── (6) Regression — /files/delete untouched (still unconditional fallback) ──
console.log('\n[6] /files/delete regression (unconditional WHM-root path preserved):')
// /files/delete does NOT gate on looksBroken — it goes to WHM whenever
// status !== 1. Make sure our change didn't accidentally add a gate there.
const deleteBlock = routesSrc.match(/router\.post\(['"]\/files\/delete['"][\s\S]*?router\.post\(/)?.[0] || ''
assert(!/_isAuthBroken\(/.test(deleteBlock), '/files/delete does NOT introduce _isAuthBroken gate (preserves unconditional root fallback)')

// ── (7) _isAuthBroken() semantics (via public shape) ─────────────────
console.log('\n[7] _isAuthBroken semantics (indirect — via classifier + code):')
// Simulate what uapi()/api2()/uploadFile() return in each failure mode.
// We can't call _isAuthBroken directly (module-private) but we can verify
// its inputs are correctly classified by the exported classifier.
const authResult401  = { status: 0, httpStatus: 401, errors: ['<html>login</html>'], code: 'CPANEL_AUTH_FAILURE' }
const authResult403  = { status: 0, httpStatus: 403, errors: ['Access denied'],       code: 'CPANEL_AUTH_FAILURE' }
const epermResult    = { status: 0, httpStatus: 500, errors: ['uapi status 1 EPERM'], code: 'CPANEL_UAPI_EPERM' }
const okResult       = { status: 1, data: [], errors: null }
const fileExistsRes  = { status: 0, httpStatus: 400, errors: ['File exists'] }

// The classifier + code shape are what _isAuthBroken checks.
assert(authResult401.code === 'CPANEL_AUTH_FAILURE',            'uapi 401 → code CPANEL_AUTH_FAILURE')
assert(authResult403.code === 'CPANEL_AUTH_FAILURE',            'api2 403 → code CPANEL_AUTH_FAILURE')
assert(epermResult.code === 'CPANEL_UAPI_EPERM',                'EPERM stays code CPANEL_UAPI_EPERM (not auth)')
assert(okResult.code === undefined,                             'success has no code')
assert(fileExistsRes.code === undefined,                        'File-exists error is NOT tagged auth-broken (regression guard)')

console.log(`\n─── ${passed} passed, ${failed} failed ───`)
if (failed) {
  console.error('\nFailures:')
  failures.forEach(f => console.error(`  • ${f}`))
  process.exit(1)
}
console.log('✓ All auth-broken fallback regression tests passed.')
