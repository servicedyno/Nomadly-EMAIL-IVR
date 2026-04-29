/**
 * Regression test for @thebiggestbag22's "BlueFCU_Upload_Ready" folder deletion bug.
 *
 * Background: cPanel API2 Fileman::fileop on production servers (WHM 11.x):
 *   • op=unlink   → silently no-ops on directories (returns result=1 but dir stays)
 *   • op=killdir  → "Unknown operation sent to api2_fileop"
 *   • op=trash    → ✅ works for both files and directories
 *
 * Verifies that:
 *   1. cpanel-proxy.deleteFile() uses op="trash" when isDirectory=true.
 *   2. cpanel-proxy.deleteFile() uses op="unlink" when isDirectory=false.
 *   3. The WHM-fallback path in cpanel-routes.js also uses op="trash" for dirs.
 *
 * Run: `node js/tests/test_delete_folder_op.js`
 */

/* eslint-disable no-console */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

let failed = 0
const check = (name, fn) => {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${name}\n    ${e.message}`)
  }
}

console.log('Folder-deletion op regression tests (BlueFCU_Upload_Ready bug)')

// ── 1. Static check on cpanel-proxy.js ──
const proxySrc = fs.readFileSync(
  path.join(__dirname, '..', 'cpanel-proxy.js'),
  'utf8'
)

check('cpanel-proxy.js: deleteFile uses op=trash for directories (primary)', () => {
  // After the verify-and-retry refactor, the primary op is set via:
  //   const primary = isDirectory ? 'trash' : 'unlink'
  assert.ok(
    /const primary = isDirectory \? 'trash' : 'unlink'/.test(proxySrc),
    'expected `const primary = isDirectory ? \'trash\' : \'unlink\'`'
  )
})

check('cpanel-proxy.js: deleteFile defines a fallback op for the silent-no-op retry', () => {
  assert.ok(
    /const fallback = isDirectory \? 'unlink' : 'trash'/.test(proxySrc),
    'expected fallback op to be the inverse of primary'
  )
})

check('cpanel-proxy.js: deleteFile verifies the target is gone via list re-read', () => {
  assert.ok(
    /_verifyDeleted\(/.test(proxySrc),
    'expected a _verifyDeleted helper that re-lists the parent dir'
  )
})

check('cpanel-proxy.js: deleteFile retries with fallback op when verify fails', () => {
  // The control flow must be: primary op → verify → if !gone, run fallback → verify again
  assert.ok(
    /if \(gone === false\) \{[\s\S]{0,400}_fileopDelete\([\s\S]{0,200}fallback/.test(proxySrc),
    'expected a retry-with-fallback branch on silent-no-op detection'
  )
})

check('cpanel-proxy.js: deleteFile annotates response with attempted_ops', () => {
  assert.ok(/attempted_ops:\s*\[primary\]/.test(proxySrc))
  assert.ok(/attempted_ops:\s*\[primary,\s*fallback\]/.test(proxySrc))
})

check('cpanel-proxy.js: no longer uses killdir in code (only in doc comments)', () => {
  // Strip block + line comments so we only check actual JS expressions.
  const noComments = proxySrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  assert.ok(
    !/killdir/.test(noComments),
    'killdir reference still present in non-comment code — modern cPanel returns "Unknown operation"'
  )
})

// ── 2. Static check on cpanel-routes.js (WHM fallback path) ──
const routesSrc = fs.readFileSync(
  path.join(__dirname, '..', 'cpanel-routes.js'),
  'utf8'
)

check('cpanel-routes.js: WHM-fallback delete uses primary op = trash for dirs / unlink for files', () => {
  assert.ok(
    /const primary = isDirectory \? 'trash' : 'unlink'/.test(routesSrc),
    'expected primary op selection in WHM-fallback path'
  )
})

check('cpanel-routes.js: WHM-fallback retries with alternate op on silent no-op', () => {
  assert.ok(
    /const fallback = isDirectory \? 'unlink' : 'trash'/.test(routesSrc)
  )
  // The verify-and-retry control flow must be present
  assert.ok(
    /if \(gone === false\)[\s\S]{0,400}runOp\(fallback\)/.test(routesSrc),
    'expected `if (gone === false) { … runOp(fallback) }` retry branch'
  )
})

check('cpanel-routes.js: WHM-fallback verifies deletion via list_files re-read', () => {
  assert.ok(/cpanel_jsonapi_func:\s*'list_files'/.test(routesSrc))
  assert.ok(/const verifyGone = async \(\) =>/.test(routesSrc))
})

check('cpanel-routes.js: no killdir in code (only in comments)', () => {
  const noComments = routesSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  assert.ok(
    !/killdir/.test(noComments),
    'killdir in WHM-fallback would also fail with "Unknown operation"'
  )
})

// ── 3. Functional check: deleteFile() invokes api2 with the right `op` ──
// We mock the api2 call by replacing the module export, but cpanel-proxy
// caches its internal helper. Easier to grep the source: assert the call
// site shape contains the right `op` variable.

check('cpanel-proxy.js: deleteFile passes op via shorthand into api2', () => {
  // After refactor the call lives inside `_fileopDelete`, still using the same shape.
  assert.ok(
    /api2\(cpUser, cpPass, 'Fileman', 'fileop', \{[\s\S]{0,200}op,[\s\S]{0,200}\}/.test(proxySrc)
  )
})

// ── 4. Live-doc comment: explanation of the cPanel quirks is preserved ──
check('cpanel-proxy.js: doc comment cites the BlueFCU_Upload_Ready repro', () => {
  assert.ok(
    /BlueFCU_Upload_Ready/.test(proxySrc),
    'doc trail preserves the repro reference'
  )
})

if (failed) {
  console.log(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log('\nAll folder-deletion regression tests passed')
