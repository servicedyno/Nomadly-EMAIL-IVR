// Smoke tests for site-status-service:
//  - htaccess strip is idempotent and surgical
//  - status reader returns the right enum from a cpanelAccounts record

const assert = require('assert')
const svc = require('../site-status-service')

console.log('— Test: stripMaintenanceBlock (no block present is a no-op) —')
const noBlock = `RewriteEngine On\nRewriteRule ^old$ /new [R=301,L]\n`
assert.strictEqual(svc._stripMaintenanceBlock(noBlock), noBlock, 'should return unchanged if no markers')
console.log('  ✓ pass-through OK')

console.log('— Test: stripMaintenanceBlock removes a clean block + preserves user rules —')
const withBlock =
  svc.HTACCESS_BEGIN + '\n' +
  '# Auto-managed by Nomadly. Do not edit between BEGIN/END markers.\n' +
  '<IfModule mod_rewrite.c>\n  RewriteEngine On\n</IfModule>\n' +
  svc.HTACCESS_END + '\n\n' +
  'RewriteEngine On\nRewriteRule ^old$ /new [R=301,L]\n'
const stripped = svc._stripMaintenanceBlock(withBlock)
assert.ok(!stripped.includes(svc.HTACCESS_BEGIN), 'BEGIN marker should be gone')
assert.ok(!stripped.includes(svc.HTACCESS_END), 'END marker should be gone')
assert.ok(stripped.includes('RewriteRule ^old$ /new'), 'user rules must be preserved')
console.log('  ✓ block removed cleanly')

console.log('— Test: stripMaintenanceBlock idempotent (safe to call repeatedly) —')
const stripped2 = svc._stripMaintenanceBlock(stripped)
assert.strictEqual(stripped, stripped2, 'second strip must equal first')
console.log('  ✓ idempotent')

console.log('— Test: stripMaintenanceBlock handles two stale blocks (defense-in-depth) —')
const doubleBlock = withBlock + svc.HTACCESS_BEGIN + '\nstale\n' + svc.HTACCESS_END + '\n'
const strippedDouble = svc._stripMaintenanceBlock(doubleBlock)
assert.ok(!strippedDouble.includes(svc.HTACCESS_BEGIN), 'all BEGIN markers removed')
assert.ok(!strippedDouble.includes('stale'), 'stale block content gone')
console.log('  ✓ handles repeats')

console.log('— Test: readStatus enum from cpanelAccounts shape —')
assert.strictEqual(svc.readStatus({ suspended: true }), 'suspended')
assert.strictEqual(svc.readStatus({ maintenanceMode: true }), 'maintenance')
assert.strictEqual(svc.readStatus({ suspended: false, maintenanceMode: false }), 'online')
assert.strictEqual(svc.readStatus({}), 'online')
assert.strictEqual(svc.readStatus(null), 'online')
// Suspended takes precedence (defensive — should never co-occur, but if it does, tell the user the harder truth)
assert.strictEqual(svc.readStatus({ suspended: true, maintenanceMode: true }), 'suspended')
console.log('  ✓ status reader OK')

console.log('\n✅ All site-status smoke tests passed.')
