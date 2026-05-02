/**
 * Regression test: shared cpanelErrors helper.
 *
 * Context: @ciroovblzz production report showed users seeing raw axios
 * strings ("timeout of 30000ms exceeded") as the error screen right after
 * login. These helpers map such transient upstream errors to calm i18n
 * copy and signal when a Retry button should be offered.
 */

const fs = require('fs')
const path = require('path')
const assert = require('assert')

// Load the ES module source and transform the `export` keywords so Node (CJS)
// can eval it. The helper file has no runtime dependencies — it's pure string
// matching — so this keeps the test dependency-free (no Babel / Jest required).
const src = fs.readFileSync(path.resolve(__dirname, '../src/components/panel/shared/cpanelErrors.js'), 'utf8')
const module_stub = { exports: {} }
// Strip the `export` keyword (keep the `function X()` declaration so intra-file
// references still resolve) and append an explicit export block at the end.
const shim = src.replace(/export\s+function/g, 'function')
  + '\nmodule.exports.friendlyMessage = friendlyMessage;'
  + '\nmodule.exports.pickErrorMessage = pickErrorMessage;'
  + '\nmodule.exports.isTransientError = isTransientError;'
// eslint-disable-next-line no-new-func
new Function('module', shim)(module_stub)
const { friendlyMessage, pickErrorMessage, isTransientError } = module_stub.exports

// Minimal t() stub that returns the key so we can assert which i18n slot was picked.
const t = (k) => k

function run(name, fn) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (e) {
    console.error(`✗ ${name}\n   ${e.message}`)
    process.exit(1)
  }
}

run('friendlyMessage maps axios timeout → errors.cpanelSlow', () => {
  assert.strictEqual(friendlyMessage('timeout of 30000ms exceeded', t), 'errors.cpanelSlow')
  assert.strictEqual(friendlyMessage('timeout of 120000ms exceeded', t), 'errors.cpanelSlow')
  assert.strictEqual(friendlyMessage('ETIMEDOUT', t), 'errors.cpanelSlow')
  assert.strictEqual(friendlyMessage('ECONNABORTED', t), 'errors.cpanelSlow')
})

run('friendlyMessage maps connection errors → errors.cpanelUnreachable', () => {
  assert.strictEqual(friendlyMessage('ECONNREFUSED', t), 'errors.cpanelUnreachable')
  assert.strictEqual(friendlyMessage('ENOTFOUND', t), 'errors.cpanelUnreachable')
  assert.strictEqual(friendlyMessage('socket hang up', t), 'errors.cpanelUnreachable')
})

run('friendlyMessage returns empty for unknown messages (passthrough)', () => {
  assert.strictEqual(friendlyMessage('File not found', t), '')
  assert.strictEqual(friendlyMessage('Permission denied', t), '')
  assert.strictEqual(friendlyMessage('', t), '')
})

run('pickErrorMessage prefers CPANEL_DOWN → localized variant', () => {
  const res = {
    code: 'CPANEL_DOWN',
    localizedMessages: { en: 'Custom EN down', fr: 'Custom FR down' },
    errors: ['ECONNREFUSED']
  }
  assert.strictEqual(pickErrorMessage(res, t, 'en'), 'Custom EN down')
  assert.strictEqual(pickErrorMessage(res, t, 'fr'), 'Custom FR down')
})

run('pickErrorMessage falls back to errors.cpanelDown when no localized entry', () => {
  const res = { code: 'CPANEL_DOWN', errors: ['ECONNREFUSED'] }
  assert.strictEqual(pickErrorMessage(res, t, 'en'), 'errors.cpanelDown')
})

run('pickErrorMessage maps axios timeout in errors[0] → errors.cpanelSlow', () => {
  const res = { status: 0, errors: ['timeout of 30000ms exceeded'], data: null }
  assert.strictEqual(pickErrorMessage(res, t, 'en'), 'errors.cpanelSlow')
})

run('pickErrorMessage passes through normal cPanel errors', () => {
  const res = { status: 0, errors: ['Execution of "mkdir": already exists'], data: null }
  assert.strictEqual(pickErrorMessage(res, t, 'en'), 'Execution of "mkdir": already exists')
})

run('pickErrorMessage returns empty for null/empty', () => {
  assert.strictEqual(pickErrorMessage(null, t, 'en'), '')
  assert.strictEqual(pickErrorMessage({}, t, 'en'), '')
  assert.strictEqual(pickErrorMessage({ errors: [] }, t, 'en'), '')
})

run('isTransientError recognises timeout + connection patterns', () => {
  assert.strictEqual(isTransientError('timeout of 30000ms exceeded'), true)
  assert.strictEqual(isTransientError('ECONNREFUSED'), true)
  assert.strictEqual(isTransientError('ECONNABORTED'), true)
  assert.strictEqual(isTransientError('socket hang up'), true)
})

run('isTransientError returns false for permanent cPanel errors', () => {
  assert.strictEqual(isTransientError('File not found'), false)
  assert.strictEqual(isTransientError('Permission denied'), false)
  assert.strictEqual(isTransientError(''), false)
  assert.strictEqual(isTransientError(null), false)
})

console.log('\nAll cpanelErrors helper tests passed.')
