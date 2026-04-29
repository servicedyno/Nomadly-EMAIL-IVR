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

check('cpanel-proxy.js: deleteFile uses op=trash for directories', () => {
  // The body must be: const op = isDirectory ? 'trash' : 'unlink'
  assert.ok(
    /const op = isDirectory \? 'trash' : 'unlink'/.test(proxySrc),
    'expected `const op = isDirectory ? \'trash\' : \'unlink\'`'
  )
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

check('cpanel-routes.js: WHM-fallback delete uses op=trash for directories', () => {
  assert.ok(
    /const op = isDirectory \? 'trash' : 'unlink'/.test(routesSrc),
    'expected WHM-fallback path to use trash for dirs'
  )
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
  assert.ok(
    /return api2\(cpUser, cpPass, 'Fileman', 'fileop', \{[\s\S]{0,200}op,[\s\S]{0,200}\}/.test(proxySrc)
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
