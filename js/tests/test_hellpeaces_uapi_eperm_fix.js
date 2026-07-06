/**
 * Regression test — @hellpeaces cPanel "Create folder failed: Request failed
 * with status code 500" / uapi EPERM fix (2026-07-06).
 *
 * Production audit (Railway deployment 1a3f8d68-f57e-4126-a57b-d3b46aac9e61)
 * showed user @hellpeaces (chatId 5522767823) hitting HTTP 500 in the panel
 * File Manager while creating a folder. The real cPanel error embedded in
 * the response body was:
 *   "/usr/local/cpanel/uapi" exited with status 1 (EPERM).
 * ... but the panel surfaced "Create folder failed: Request failed with
 * status code 500" because api2()/uapi() in cpanel-proxy.js caught the axios
 * error and returned err.message instead of digging out the real cPanel
 * reason. On top of that, /files/mkdir had NO WHM-root fallback (delete
 * did), so there was no way to route around a user-level EPERM.
 *
 * This test asserts:
 *   1. extractCpanelErrorFromResponse() returns the real uapi/EPERM reason
 *      out of the HTTP 500 response body @hellpeaces got.
 *   2. looksLikeUapiPermFailure() flags the extracted string as EPERM.
 *   3. Both helpers are exported for /files/mkdir route to consume for the
 *      WHM-root fallback decision.
 *   4. The public export surface has not regressed — createDirectory, uapi
 *      and the diagnostic helpers all still present.
 */

const assert = require('assert')

process.env.WHM_HOST = 'whm.test.local'
const cp = require('../cpanel-proxy')

let failures = 0
function check(name, cond, detail) {
  if (cond) {
    console.log(`  ✅ ${name}`)
  } else {
    failures++
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// ── 1. Diagnostic helpers exported ──
console.log('\n[1] Diagnostic helpers exported')
check('extractCpanelErrorFromResponse is a function', typeof cp.extractCpanelErrorFromResponse === 'function')
check('looksLikeUapiPermFailure is a function', typeof cp.looksLikeUapiPermFailure === 'function')
check('createDirectory still exported', typeof cp.createDirectory === 'function')
check('uapi still exported', typeof cp.uapi === 'function')

// ── 2. Extractor pulls the real uapi EPERM message @hellpeaces got ──
console.log('\n[2] Extractor recovers real cPanel error from HTTP 500 body')
const HELLPEACES_ERROR = '"/usr/local/cpanel/uapi" exited with status 1 (EPERM).'
const axiosErr500 = {
  response: {
    status: 500,
    data: {
      cpanelresult: {
        event: { result: 0 },
        data: [{ result: 0, reason: HELLPEACES_ERROR }],
        error: HELLPEACES_ERROR,
      },
    },
  },
  message: 'Request failed with status code 500',
}
const extracted = cp.extractCpanelErrorFromResponse(axiosErr500, 'test.host')
check('extracts the exact uapi EPERM reason', extracted === HELLPEACES_ERROR, `got: ${JSON.stringify(extracted)}`)

// ── 3. EPERM detector flags the extracted string ──
console.log('\n[3] EPERM detector flags the extracted string')
check('looksLikeUapiPermFailure(extracted) === true', cp.looksLikeUapiPermFailure(extracted) === true)
check('looksLikeUapiPermFailure("normal error") === false', cp.looksLikeUapiPermFailure('normal error') === false)
check('looksLikeUapiPermFailure("") === false', cp.looksLikeUapiPermFailure('') === false)
check('looksLikeUapiPermFailure(null) === false', cp.looksLikeUapiPermFailure(null) === false)

// ── 4. Extractor falls back gracefully on unusual response shapes ──
console.log('\n[4] Extractor is defensive against unusual bodies')
check('null body → null', cp.extractCpanelErrorFromResponse({ response: { data: null } }) === null)
check('undefined response → null', cp.extractCpanelErrorFromResponse({ message: 'x' }) === null)
check('string body → first line', cp.extractCpanelErrorFromResponse({ response: { data: '  EPERM: not permitted\n stack: ...\n' } }) === 'EPERM: not permitted')
check('empty string body → null', cp.extractCpanelErrorFromResponse({ response: { data: '   ' } }) === null)
check('errors array shape', cp.extractCpanelErrorFromResponse({ response: { data: { errors: ['boom'] } } }) === 'boom')
check('cp.error shape',
  cp.extractCpanelErrorFromResponse({ response: { data: { cpanelresult: { error: 'root-level err' } } } }) === 'root-level err')

// ── 5. Extractor SANITIZES server hostnames out of the reason ──
console.log('\n[5] Sanitization is still applied (server IP not leaked)')
const withHost = cp.extractCpanelErrorFromResponse({
  response: {
    data: {
      cpanelresult: { data: [{ reason: 'connection failed to whm.test.local:2087' }] },
    },
  },
}, 'whm.test.local')
check('server hostname replaced with [server]', withHost && withHost.includes('[server]'), `got: ${JSON.stringify(withHost)}`)
check('port 2087 stripped', withHost && !withHost.includes(':2087'), `got: ${JSON.stringify(withHost)}`)

// ── 6. /files/mkdir route source contains the WHM fallback wiring ──
console.log('\n[6] /files/mkdir route has WHM-root fallback wired')
const fs = require('fs')
const routesSrc = fs.readFileSync(require('path').join(__dirname, '..', 'cpanel-routes.js'), 'utf8')
check('mkdir route references CPANEL_UAPI_EPERM', /CPANEL_UAPI_EPERM/.test(routesSrc))
check('mkdir route mentions @hellpeaces (attribution / anchor)', /hellpeaces|5522767823/i.test(routesSrc))
check('mkdir route uses whm-fallback via tag', /via:\s*['"]whm-fallback['"]/.test(routesSrc))
check('mkdir route uses looksLikeUapiPermFailure', /looksLikeUapiPermFailure/.test(routesSrc))
check('mkdir route calls Fileman/mkdir under cpanel_jsonapi_user', /cpanel_jsonapi_module:\s*['"]Fileman['"][\s\S]{0,200}cpanel_jsonapi_func:\s*['"]mkdir['"]/.test(routesSrc))

// ── Summary ──
console.log(`\n${failures === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures} test(s) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
