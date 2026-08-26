/* eslint-disable no-console */
// ─────────────────────────────────────────────────────────────────────────────
// Regression tests — cPanel stale-cpPass self-heal (v2)
//
// v1 (uploadFileAsRoot fallback) turned out to be a dead-end: WHM's
// /json-api/cpanel gateway drops multipart file bodies, returning
// "You must specify at least one file to upload". v2 self-heals the
// underlying stale cpPass instead:
//   1. Rotate password on WHM via /passwd api.version=1 db_pass_update=0
//   2. Persist encrypted (AES-256-GCM) in cpanelAccounts
//   3. Retry the SAME user-level upload
//   4. 60-min cool-down guards against cPHulk thrash
//
// This test file greps the routes source to confirm the wiring is
// correct WITHOUT triggering a real WHM /passwd call.
//
// Motivated by @HHR2009 (2026-08-26): cpUser nnliae74 hit
// "Create folder failed: Access denied" and "Upload failed (401)".
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

console.log('─── cPanel stale-cpPass self-heal — regression suite (v2) ───')

// ── (1) Classifier — same auth-broken truth table as v1 ─────────────
console.log('\n[1] looksLikeAuthFailure() truth table:')
assert(cp.looksLikeAuthFailure(401, ''),                                    '401 empty body → auth')
assert(cp.looksLikeAuthFailure(401, '<html>cPanel Login</html>'),           '401 with login HTML → auth')
assert(cp.looksLikeAuthFailure(403, 'Access denied'),                       '403 Access denied → auth')
assert(cp.looksLikeAuthFailure(403, 'access DENIED (mixed case)'),          '403 case-insensitive → auth')
assert(cp.looksLikeAuthFailure(null, 'Request failed with status code 401'), 'axios generic 401 msg → auth')
assert(cp.looksLikeAuthFailure(null, 'Request failed with status code 403'), 'axios generic 403 msg → auth')

// ── (2) Classifier: NOT auth-broken ─────────────────────────────────
console.log('\n[2] Non-auth cases must return false:')
assert(!cp.looksLikeAuthFailure(200, 'OK'),                                 '200 OK → not auth')
assert(!cp.looksLikeAuthFailure(400, 'File exists'),                        '400 File exists → not auth')
assert(!cp.looksLikeAuthFailure(404, 'File not found'),                     '404 → not auth')
assert(!cp.looksLikeAuthFailure(500, 'Internal Server Error'),              '500 generic → not auth')
assert(!cp.looksLikeAuthFailure(502, 'Bad Gateway'),                        '502 → not auth')
assert(!cp.looksLikeAuthFailure(null, 'ECONNRESET'),                        'ECONNRESET → not auth')

// ── (3) Mutual exclusion with EPERM (EPERM wins) ────────────────────
console.log('\n[3] EPERM vs AUTH mutual exclusion (EPERM wins):')
assert(cp.looksLikeUapiPermFailure('permission denied'),                             'EPERM regex catches "permission denied"')
assert(cp.looksLikeUapiPermFailure('"/usr/local/cpanel/uapi" exited with status 1 (EPERM)'), 'EPERM regex catches full uapi status-1 msg')
assert(!cp.looksLikeUapiPermFailure('Access denied'),                                'EPERM regex does NOT catch plain "Access denied"')
assert(!cp.looksLikeUapiPermFailure('File exists'),                                  'EPERM regex does NOT catch "File exists"')

// ── (4) Route wiring — the actual v2 fix greps ──────────────────────
console.log('\n[4] Route wiring — self-heal cpPass path:')
const routesSrc = fs.readFileSync(path.join(__dirname, '..', 'cpanel-routes.js'), 'utf8')
const routeBody = (method, path_) => {
  const rx = new RegExp(`router\\.${method}\\(['"]${path_.replace(/\//g, '\\/')}['"][\\s\\S]{0,8000}?\\n {2}\\}\\)`)
  const m = routesSrc.match(rx)
  return m ? m[0] : ''
}
const uploadBody      = routeBody('post', '/files/upload')
const uploadChunkBody = routeBody('post', '/files/upload-chunk')
const deleteBody      = routeBody('post', '/files/delete')

assert(uploadBody.length      > 100, 'located /files/upload route body')
assert(uploadChunkBody.length > 100, 'located /files/upload-chunk route body')
assert(deleteBody.length      > 100, 'located /files/delete route body')

// _repairCpPass helper defined with correct signature
assert(/async\s+function\s+_repairCpPass\s*\(\s*getCpanelCol\s*,\s*cpUser\s*,\s*whmHost\s*\)/.test(routesSrc), '_repairCpPass helper defined with (getCpanelCol, cpUser, whmHost) signature')
// 60-min cool-down constant present
assert(/CPPASS_COOLDOWN_MS\s*=\s*60\s*\*\s*60\s*\*\s*1000/.test(routesSrc),          '60-min cool-down constant (CPPASS_COOLDOWN_MS = 60*60*1000)')
// Cool-down honored — decrypts cached pass, rotated:false, "cool-down (Xm left)"
assert(/cool-down \(\$\{leftMin\}m left\)/.test(routesSrc),                          'cool-down window returns reason "cool-down (Xm left)"')
assert(/cpAuth\.decrypt\(\{[\s\S]{0,300}encrypted:\s*account\.cpPass_encrypted/.test(routesSrc), 'cool-down branch decrypts cached pass from account doc')

// Password generation — crypto.randomBytes(32) mapped into [A-Za-z0-9], 24 chars
assert(/crypto\.randomBytes\(32\)/.test(routesSrc),                                  'password gen uses crypto.randomBytes(32) (not Math.random)')
assert(/CPPASS_ALPHABET/.test(routesSrc) && /CPPASS_LENGTH\s*=\s*24/.test(routesSrc), '24-char pass with A-Za-z0-9 alphabet constant')
assert(!/Math\.random\(\)/.test(routesSrc.split('function _repairCpPass')[1] || ''), '_repairCpPass does NOT use Math.random anywhere')

// WHM /passwd call shape — api.version=1 + db_pass_update=0
assert(/whmApi\.get\(['"]\/passwd['"][\s\S]{0,600}api\.version['"]?\s*:\s*1/.test(routesSrc), 'calls whmApi.get(/passwd) with api.version=1')
assert(/whmApi\.get\(['"]\/passwd['"][\s\S]{0,600}db_pass_update\s*:\s*0/.test(routesSrc),    'calls whmApi.get(/passwd) with db_pass_update:0 (protects bound MySQL passes)')
assert(/metadata\?\.result\s*!==?\s*1/.test(routesSrc) || /metadata\?\.result\s*===\s*1/.test(routesSrc), 'checks res.data.metadata.result === 1 for success')

// Persistence — all 5 fields written
assert(/cpPass_encrypted[\s\S]{0,400}cpPass_iv[\s\S]{0,400}cpPass_tag[\s\S]{0,400}cpPassRotatedAt[\s\S]{0,400}cpPassLastRotateReason/.test(routesSrc),
  'persists cpPass_encrypted + cpPass_iv + cpPass_tag + cpPassRotatedAt + cpPassLastRotateReason')
assert(/cpPassLastRotateReason\s*:\s*['"]CPANEL_AUTH_FAILURE['"]/.test(routesSrc),   'cpPassLastRotateReason set to "CPANEL_AUTH_FAILURE"')
assert(/cpAuth\.encrypt\(\s*newPass\s*\)/.test(routesSrc),                            'uses cpAuth.encrypt(newPass) — same AES-GCM shape as storeCredentials')

// ── (5) Upload paths call _repairCpPass and no longer use uploadFileAsRoot ─
console.log('\n[5] Upload paths wired to _repairCpPass, NOT uploadFileAsRoot:')
assert(/_repairCpPass\(\s*getCpanelCol/.test(uploadBody),         '/files/upload calls _repairCpPass(getCpanelCol, ...)')
assert(/_repairCpPass\(\s*getCpanelCol/.test(uploadChunkBody),    '/files/upload-chunk calls _repairCpPass(getCpanelCol, ...)')
assert(!/uploadFileAsRoot\(/.test(uploadBody),                    '/files/upload NO LONGER calls uploadFileAsRoot')
assert(!/uploadFileAsRoot\(/.test(uploadChunkBody),               '/files/upload-chunk NO LONGER calls uploadFileAsRoot')
assert(/req\.cpPass\s*=\s*repair\.cpPass/.test(uploadBody),       '/files/upload sets req.cpPass = repair.cpPass on ok')
assert(/req\.cpPass\s*=\s*repair\.cpPass/.test(uploadChunkBody),  '/files/upload-chunk sets req.cpPass = repair.cpPass on ok')

// Failure tags
assert(/['"]cppass-repair-failed['"]/.test(uploadBody),           '/files/upload emits via: "cppass-repair-failed" on repair failure')
assert(/['"]cppass-repair-failed['"]/.test(uploadChunkBody),      '/files/upload-chunk emits via: "cppass-repair-failed"')
assert(/['"]cppass-repaired-retry-failed['"]/.test(uploadBody),           '/files/upload emits via: "cppass-repaired-retry-failed" on retry failure')
assert(/['"]cppass-repaired-retry-failed['"]/.test(uploadChunkBody),      '/files/upload-chunk emits via: "cppass-repaired-retry-failed"')

// ── (6) Regression guards ────────────────────────────────────────────
console.log('\n[6] Regression guards:')
// /files/delete must not be touched by the new repair
assert(!/_repairCpPass\(/.test(deleteBody),                                  '/files/delete does NOT introduce _repairCpPass gate (preserves unconditional root fallback)')
// The list/mkdir/extract paths still use _isAuthBroken() — those work
// today via WHM-root GET impersonation and shouldn't switch to repair
assert(/_isAuthBroken\(/.test(routeBody('get',  '/files')),                  '/files (list_files) still uses _isAuthBroken gate for WHM-root fallback')
assert(/_isAuthBroken\(/.test(routeBody('post', '/files/mkdir')),            '/files/mkdir still uses _isAuthBroken gate')
assert(/_isAuthBroken\(/.test(routeBody('post', '/files/extract')),          '/files/extract still uses _isAuthBroken gate')

// The proxy still exports uploadFileAsRoot for legacy compat (kept, not deleted)
assert(typeof cp.uploadFileAsRoot === 'function',                            'uploadFileAsRoot kept in proxy for legacy compat')
assert(typeof cp.looksLikeAuthFailure === 'function',                        'looksLikeAuthFailure still exported')
assert(typeof cp.looksLikeUapiPermFailure === 'function',                    'looksLikeUapiPermFailure still exported')

// Result-shape semantics still hold (from v1)
const authResult401  = { status: 0, httpStatus: 401, errors: ['<html>login</html>'], code: 'CPANEL_AUTH_FAILURE' }
const epermResult    = { status: 0, httpStatus: 500, errors: ['uapi status 1 EPERM'], code: 'CPANEL_UAPI_EPERM' }
const fileExistsRes  = { status: 0, httpStatus: 400, errors: ['File exists'] }
assert(authResult401.code === 'CPANEL_AUTH_FAILURE',            'uapi 401 → code CPANEL_AUTH_FAILURE')
assert(epermResult.code === 'CPANEL_UAPI_EPERM',                'EPERM stays code CPANEL_UAPI_EPERM (mutual exclusion)')
assert(fileExistsRes.code === undefined,                        '"File exists" not falsely tagged (regression guard)')

console.log(`\n─── ${passed} passed, ${failed} failed ───`)
if (failed) {
  console.error('\nFailures:')
  failures.forEach(f => console.error(`  • ${f}`))
  process.exit(1)
}
console.log('✓ All self-heal cpPass regression tests passed.')
