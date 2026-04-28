#!/usr/bin/env node
/**
 * Regression test for the "delete pages/folders doesn't work" bug reported by
 * @Thebiggestbag22 (Feb 2026). Root cause: WHM API2 Fileman::fileop op=unlink
 * only deletes files, not directories — folders silently failed, backend
 * returned 200 OK with status=0, frontend ignored status and just refreshed.
 *
 * Tests:
 *  1. cpProxy.deleteFile uses op=killdir for directories (isDirectory=true)
 *  2. cpProxy.deleteFile uses op=unlink for files (default)
 *  3. /files/delete route accepts isDirectory from body and passes it through
 *  4. /files/delete route returns HTTP 500 on result.status !== 1
 *  5. Frontend handleDelete accepts isDir param and passes isDirectory in body
 *  6. Frontend handleDelete shows folder-aware confirm message
 *  7. Anti-red protected files still rejected with 403
 */

const fs = require('fs')
const path = require('path')

let passed = 0, failed = 0
function assert(cond, msg) {
  if (!cond) { console.error(`❌ FAIL: ${msg}`); failed++ }
  else { console.log(`✅ ${msg}`); passed++ }
}

// ── 1 + 2. cpProxy.deleteFile op selection ──
const proxyPath = path.join(__dirname, '..', 'cpanel-proxy.js')
const proxySrc = fs.readFileSync(proxyPath, 'utf8')

// Isolate the deleteFile function
const fnStart = proxySrc.indexOf('async function deleteFile(')
const fnEnd = proxySrc.indexOf('async function renameFile(', fnStart)
assert(fnStart > 0 && fnEnd > fnStart, 'deleteFile function exists')
const deleteFileSrc = proxySrc.substring(fnStart, fnEnd)

assert(deleteFileSrc.includes('isDirectory'), 'deleteFile accepts isDirectory parameter')
assert(deleteFileSrc.includes("isDirectory ? 'killdir' : 'unlink'"), 'deleteFile selects killdir vs unlink based on isDirectory')
assert(deleteFileSrc.includes('@Thebiggestbag22'), 'deleteFile has root-cause comment citing the bug report')

// ── Static behaviour check: mock api2, call deleteFile with/without flag ──
// We can't easily dynamic-import because cpanel-proxy calls require('axios') at top;
// instead, verify the dispatch table via regex (done above) and confirm the old signature
// is gone (no default-op 'unlink' without the ternary).
const oldBuggyPattern = /async function deleteFile\(cpUser, cpPass, dir, file, host = null\)\s*\{\s*return api2[^}]+op:\s*'unlink'/m
assert(!oldBuggyPattern.test(proxySrc), 'old buggy unlink-only signature is gone')

// ── 3 + 4. /files/delete route: isDirectory passthrough + HTTP 500 on failure ──
const routesPath = path.join(__dirname, '..', 'cpanel-routes.js')
const routesSrc = fs.readFileSync(routesPath, 'utf8')

const routeStart = routesSrc.indexOf(`router.post('/files/delete'`)
const routeEnd = routesSrc.indexOf('router.post', routeStart + 1)
assert(routeStart > 0 && routeEnd > routeStart, '/files/delete route exists')
const routeSrc = routesSrc.substring(routeStart, routeEnd)

assert(routeSrc.includes('isDirectory'), 'route reads isDirectory from req.body')
assert(routeSrc.includes('cpProxy.deleteFile(req.cpUser, req.cpPass, dir, file, req.whmHost, !!isDirectory)'), 'route passes isDirectory to cpProxy.deleteFile')
assert(routeSrc.includes('result?.status === 1') || routeSrc.includes('result?.status !== 1'), 'route checks cPanel result.status')
assert(routeSrc.includes('res.status(500).json({ error: `Delete failed'), 'route returns HTTP 500 with descriptive error on failure')
assert(routeSrc.includes('isProtectedAntiRedFile(dir, file)'), 'anti-red guard still present')
assert(routeSrc.includes('res.status(403)'), 'anti-red guard still returns 403')

// Order: body-validation → anti-red guard → cpanel call → status check → success
const iBody = routeSrc.indexOf('if (!dir || !file)')
const iProtect = routeSrc.indexOf('isProtectedAntiRedFile')
const iCall = routeSrc.indexOf('cpProxy.deleteFile')
const iStatus = routeSrc.indexOf('result?.status === 1') >= 0 ? routeSrc.indexOf('result?.status === 1') : routeSrc.indexOf('result?.status !== 1')
assert(iBody > 0 && iProtect > iBody && iCall > iProtect && iStatus > iCall, 'route order: validation → antired guard → call → status check')

// ── 5 + 6. Frontend handleDelete ──
const fePath = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'panel', 'FileManager.js')
const feSrc = fs.readFileSync(fePath, 'utf8')

const hdStart = feSrc.indexOf('const handleDelete = async')
const hdEnd = feSrc.indexOf('const handleExtract', hdStart)
assert(hdStart > 0 && hdEnd > hdStart, 'handleDelete function exists in FileManager.js')
const hdSrc = feSrc.substring(hdStart, hdEnd)

assert(hdSrc.includes('(fileName, isDir = false)'), 'handleDelete signature accepts isDir param (default false)')
assert(hdSrc.includes("isDir ? 'folder (and everything inside)' : 'file'"), 'confirm message differentiates folder vs file')
assert(hdSrc.includes('isDirectory: isDir'), 'handleDelete sends isDirectory in request body')
assert(hdSrc.includes('setSuccessMessage'), 'handleDelete shows success message on success')
assert(hdSrc.includes('err.message || `Could not delete'), 'handleDelete surfaces error message on failure')

// Desktop + mobile callsites both pass isDir
const desktopCall = feSrc.match(/handleDelete\(name, isDir\)[\s\S]{0,120}fm-delete-\$\{name\}/)
const mobileCall = feSrc.match(/handleDelete\(name, isDir\)[\s\S]{0,120}fm-delete-mobile-\$\{name\}/)
assert(desktopCall, 'desktop-row callsite passes isDir to handleDelete')
assert(mobileCall, 'mobile-card callsite passes isDir to handleDelete')

// Old buggy callsites (without isDir) are gone
const oldCallsite = feSrc.match(/onClick=\{\(\)\s*=>\s*handleDelete\(name\)\s*\}/)
assert(!oldCallsite, 'old handleDelete(name) callsites without isDir are gone')

console.log(`\n${failed === 0 ? '🟢' : '🔴'} ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
