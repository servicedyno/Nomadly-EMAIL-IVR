/* eslint-disable no-console */
// ─────────────────────────────────────────────────────────────────────────────
// Regression tests — cPanel WHM impersonation session upload (v3)
//
// v1 (uploadFileAsRoot) — RETIRED. WHM /json-api gateway strips multipart.
// v2 (_repairCpPass)     — RETIRED. cpsrvd still denies Basic Auth after rotate.
// v3 (uploadFileViaSession, THIS FILE) — WHM create_user_session + cpsession
//     cookie against the cPanel tunnel. Multipart POST works because we're
//     hitting cPanel directly (port 2083 via CPANEL_API_URL), not going
//     through the WHM json-api gateway.
//
// Also carries over three companion fixes:
//   • uploadFile() catches HTTP-200-with-cPanel-Login-HTML  → tag AUTH-BROKEN
//   • _verifyDeleted returns null on failed listing (was: false positive gone)
//   • deleteFile only promotes to status:1 when the original op was status:1
//
// Static asserts on wiring — no real WHM traffic. Live end-to-end is a
// separate script (live_test_hhr2009_session_upload.js).
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

console.log('─── cPanel WHM session upload — regression suite (v3) ───')

// ── (1) Classifier truth table (unchanged from v1/v2) ────────────────
console.log('\n[1] looksLikeAuthFailure() truth table:')
assert(cp.looksLikeAuthFailure(401, ''),                                    '401 empty body → auth')
assert(cp.looksLikeAuthFailure(401, '<html>cPanel Login</html>'),           '401 with login HTML → auth')
assert(cp.looksLikeAuthFailure(403, 'Access denied'),                       '403 Access denied → auth')
assert(cp.looksLikeAuthFailure(403, 'access DENIED'),                       '403 case-insensitive → auth')
assert(cp.looksLikeAuthFailure(null, 'Request failed with status code 401'), 'axios generic 401 → auth')
assert(cp.looksLikeAuthFailure(null, 'Request failed with status code 403'), 'axios generic 403 → auth')

// ── (2) Non-auth cases return false ──────────────────────────────────
console.log('\n[2] Non-auth cases must return false:')
assert(!cp.looksLikeAuthFailure(200, 'OK'),                                 '200 OK → not auth')
assert(!cp.looksLikeAuthFailure(400, 'File exists'),                        '400 File exists → not auth')
assert(!cp.looksLikeAuthFailure(404, 'File not found'),                     '404 → not auth')
assert(!cp.looksLikeAuthFailure(502, 'Bad Gateway'),                        '502 → not auth')
assert(!cp.looksLikeAuthFailure(null, 'ECONNRESET'),                        'ECONNRESET → not auth')

// ── (3) EPERM vs AUTH mutual exclusion (EPERM wins) ──────────────────
console.log('\n[3] EPERM vs AUTH mutual exclusion:')
assert(cp.looksLikeUapiPermFailure('permission denied'),                             'EPERM catches "permission denied"')
assert(cp.looksLikeUapiPermFailure('uapi exited with status 1 (EPERM)'),             'EPERM catches full msg')
assert(!cp.looksLikeUapiPermFailure('Access denied'),                                'EPERM does NOT catch "Access denied"')
assert(!cp.looksLikeUapiPermFailure('File exists'),                                  'EPERM does NOT catch "File exists"')

// ── (4) Proxy exports ────────────────────────────────────────────────
console.log('\n[4] Proxy exports:')
assert(typeof cp.uploadFileViaSession === 'function',    'uploadFileViaSession exported (v3 fix)')
assert(cp.uploadFileViaSession.length === 5,             'uploadFileViaSession arity 5 (cpUser, dir, fileName, buf, whmHost)')
assert(typeof cp.uploadFileAsRoot === 'function',        'uploadFileAsRoot kept (legacy compat, not called from routes)')
assert(typeof cp.looksLikeAuthFailure === 'function',    'looksLikeAuthFailure still exported')
assert(typeof cp.looksLikeUapiPermFailure === 'function', 'looksLikeUapiPermFailure still exported')

// ── (5) uploadFileViaSession implementation greps ────────────────────
console.log('\n[5] uploadFileViaSession implementation:')
const proxySrc = fs.readFileSync(path.join(__dirname, '..', 'cpanel-proxy.js'), 'utf8')
const sessionFn = (proxySrc.match(/async\s+function\s+uploadFileViaSession[\s\S]{0,12000}?\n\}\n/) || [''])[0]
assert(sessionFn.length > 500, 'located uploadFileViaSession function body')
assert(/\/json-api\/create_user_session/.test(sessionFn),                             'step 1: calls WHM /json-api/create_user_session')
assert(/service:\s*['"]cpaneld['"]/.test(sessionFn),                                  'step 1: service=cpaneld')
assert(/whm \$\{[^}]+\}:\$\{whmToken\}/.test(sessionFn),                              'step 1: uses "whm root:$WHM_TOKEN" header format')
assert(/CPANEL_API_URL/.test(sessionFn),                                              'step 2+3: uses CPANEL_API_URL (not WHM_API_URL)')
assert(/maxRedirects\s*:\s*0/.test(sessionFn),                                        'step 2: maxRedirects:0 (critical — captures the 307 set-cookie)')
assert(/cpsession=\(\[\^;\]\+\)/.test(sessionFn),                                     'step 2: manual regex cpsession=([^;]+) (no tough-cookie)')
assert(/\/execute\/Fileman\/upload_files/.test(sessionFn),                            'step 3: posts multipart to /execute/Fileman/upload_files')
assert(/Cookie:\s*`cpsession=/.test(sessionFn),                                       'step 3: sends Cookie: cpsession=<value>')
// Retired approaches — must NOT be present in this function
assert(!/uploadFileAsRoot\(/.test(sessionFn),                                         'no self-reference to uploadFileAsRoot')
assert(!/_repairCpPass\(/.test(sessionFn),                                            'no reference to retired _repairCpPass')

// ── (6) uploadFile HTTP-200-HTML detection ───────────────────────────
console.log('\n[6] uploadFile catches HTTP-200 cPanel Login HTML:')
const uploadFn = (proxySrc.match(/async\s+function\s+uploadFile\s*\([\s\S]{0,10000}?\n\}\n/) || [''])[0]
assert(uploadFn.length > 200, 'located uploadFile function body')
assert(/<title>cPanel Login<\/title>|<!DOCTYPE html>/.test(uploadFn),                 'uploadFile checks for cPanel Login HTML')
assert(/CPANEL_AUTH_FAILURE/.test(uploadFn),                                          'uploadFile tags HTTP-200-HTML as CPANEL_AUTH_FAILURE')

// ── (7) _verifyDeleted + deleteFile false-positive fix ───────────────
console.log('\n[7] _verifyDeleted returns null on bad listing, deleteFile promotes only on original ok:')
const verifyFn = (proxySrc.match(/async\s+function\s+_verifyDeleted[\s\S]{0,1500}?\n\}\n/) || [''])[0]
assert(/listing\.status\s*!==\s*1/.test(verifyFn),         '_verifyDeleted returns null when listing.status !== 1')
assert(/!Array\.isArray\(listing\.data\)/.test(verifyFn),  '_verifyDeleted returns null when listing.data is not an array')
const deleteFn = (proxySrc.match(/async\s+function\s+deleteFile[\s\S]{0,4000}?\nasync\s+function\s+renameFile/) || [''])[0]
assert(/gone\s*===\s*true\s*&&\s*result\?\.status\s*===\s*1/.test(deleteFn), 'deleteFile only promotes to status:1 when ORIGINAL op status:1')

// ── (8) Route wiring ─────────────────────────────────────────────────
console.log('\n[8] Route wiring — /files/upload + /files/upload-chunk:')
const routesSrc = fs.readFileSync(path.join(__dirname, '..', 'cpanel-routes.js'), 'utf8')
const routeBody = (method, p) => {
  const rx = new RegExp(`router\\.${method}\\(['"]${p.replace(/\//g, '\\/')}['"][\\s\\S]{0,8000}?\\n {2}\\}\\)`)
  const m = routesSrc.match(rx)
  if (!m) return ''
  return m[0].replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1')
}
const uploadBody      = routeBody('post', '/files/upload')
const uploadChunkBody = routeBody('post', '/files/upload-chunk')
const deleteBody      = routeBody('post', '/files/delete')

assert(uploadBody.length > 100,      'located /files/upload route body')
assert(uploadChunkBody.length > 100, 'located /files/upload-chunk route body')
assert(/uploadFileViaSession\(req\.cpUser/.test(uploadBody),        '/files/upload calls uploadFileViaSession on auth-broken')
assert(/uploadFileViaSession\(req\.cpUser/.test(uploadChunkBody),   '/files/upload-chunk calls uploadFileViaSession on auth-broken')
// Retired helpers must be gone from the upload branches (comments stripped)
assert(!/uploadFileAsRoot\(/.test(uploadBody),                      '/files/upload has no uploadFileAsRoot call (retired)')
assert(!/uploadFileAsRoot\(/.test(uploadChunkBody),                 '/files/upload-chunk has no uploadFileAsRoot call (retired)')
assert(!/_repairCpPass\(/.test(uploadBody),                         '/files/upload has no _repairCpPass call (retired)')
assert(!/_repairCpPass\(/.test(uploadChunkBody),                    '/files/upload-chunk has no _repairCpPass call (retired)')
// /files/delete regression guard
assert(!/uploadFileViaSession\(/.test(deleteBody),                  '/files/delete has no uploadFileViaSession (regression guard)')

// ── (9) via: tags emitted ────────────────────────────────────────────
console.log('\n[9] Failure via: tags emitted for ops observability:')
for (const tag of ['whm-session', 'session-unavailable', 'session-create-failed', 'session-cookie-missing', 'session-upload-rejected', 'session-upload-failed', 'session-exception']) {
  assert(new RegExp(`['"]${tag}['"]`).test(proxySrc), `proxy emits via: '${tag}'`)
}

// ── (10) Env variables present on this pod ──────────────────────────
console.log('\n[10] Env sanity:')
assert(!!process.env.WHM_TOKEN,       'WHM_TOKEN present')
assert(!!process.env.WHM_HOST,        'WHM_HOST present')
assert(!!process.env.WHM_API_URL,     'WHM_API_URL present (WHM tunnel)')
assert(!!process.env.CPANEL_API_URL,  'CPANEL_API_URL present (cPanel tunnel)')

// ── (11) package.json hygiene (regression guard from user's warning) ─
console.log('\n[11] package.json hygiene — no problematic new deps:')
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'))
assert(!pkg.dependencies['tough-cookie'],           'tough-cookie NOT in dependencies (would EOVERRIDE with existing overrides.tough-cookie)')
assert(!pkg.dependencies['axios-cookiejar-support'], 'axios-cookiejar-support NOT in dependencies (unnecessary)')

console.log(`\n─── ${passed} passed, ${failed} failed ───`)
if (failed) {
  console.error('\nFailures:')
  failures.forEach(f => console.error(`  • ${f}`))
  process.exit(1)
}
console.log('✓ All WHM session upload regression tests passed.')
