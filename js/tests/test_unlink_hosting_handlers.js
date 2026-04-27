// Smoke tests for the new unlink-domain / cancel-hosting handlers.
// Verifies all referenced helpers exist with the expected signatures.

const assert = require('assert')

console.log('— Test: required modules and helpers exist —')

const cpanelAuth = require('../cpanel-auth')
assert.strictEqual(typeof cpanelAuth.decrypt, 'function', 'cpanelAuth.decrypt must be a function')
assert.strictEqual(typeof cpanelAuth.encrypt, 'function', 'cpanelAuth.encrypt must be a function')

const cpProxy = require('../cpanel-proxy')
assert.strictEqual(typeof cpProxy.removeAddonDomain, 'function', 'cpProxy.removeAddonDomain must be a function')

const cfService = require('../cf-service')
assert.strictEqual(typeof cfService.getZoneByName, 'function', 'cfService.getZoneByName must be a function')
assert.strictEqual(typeof cfService.cleanupAllHostingRecords, 'function', 'cfService.cleanupAllHostingRecords must be a function')

const antiRedService = require('../anti-red-service')
assert.strictEqual(typeof antiRedService.removeWorkerRoutes, 'function', 'antiRedService.removeWorkerRoutes must be a function')

const whmService = require('../whm-service')
assert.strictEqual(typeof whmService.terminateAccount, 'function', 'whmService.terminateAccount must be a function')

console.log('  ✓ all helper functions resolve')

console.log('— Test: encrypt/decrypt round-trip works —')
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-for-roundtrip-only'
// Clear-cache so it picks up env (already loaded; just verify roundtrip)
const sample = 'TestPwd!@#456'
const enc = cpanelAuth.encrypt(sample)
assert.ok(enc.encrypted && enc.iv && enc.tag, 'encrypt must return {encrypted, iv, tag}')
const dec = cpanelAuth.decrypt({ encrypted: enc.encrypted, iv: enc.iv, tag: enc.tag })
assert.strictEqual(dec, sample, 'decrypt should return original password')
console.log('  ✓ encrypt/decrypt round-trip OK')

console.log('— Test: lang strings exist in all 4 locales —')
const { translation } = require('../translation.js')
const langs = ['en', 'fr', 'hi', 'zh']
const tKeys = [
  'selectDomainToUnlink',
  'noAddonDomainsToUnlink',
  'confirmUnlinkDomain',
  'unlinkingDomain',
  'unlinkDomainSuccess',
  'unlinkDomainFailed',
  'confirmCancelHostingPlan',
  'cancellingHostingPlan',
  'cancelHostingPlanSuccess',
  'cancelHostingPlanFailed',
]
const userKeys = [
  'unlinkDomain',
  'cancelHostingPlan',
  'confirmUnlinkBtn',
  'confirmCancelHostingBtn',
  'cancelGoBackBtn',
]

for (const lang of langs) {
  for (const k of tKeys) {
    const v = translation('t.' + k, lang, 'example.com', 'Plan-Test')
    assert.ok(v && v !== ('t.' + k), `t.${k} missing in ${lang}: got "${v}"`)
  }
  for (const k of userKeys) {
    const v = translation('user.' + k, lang)
    assert.ok(v && v !== ('user.' + k), `user.${k} missing in ${lang}: got "${v}"`)
  }
}
console.log(`  ✓ all ${tKeys.length} t-strings + ${userKeys.length} user-strings present in en/fr/hi/zh`)

console.log('— Test: cancel hosting plan message renders correctly (sample) —')
const en = translation('t.confirmCancelHostingPlan', 'en', 'foo.com', 'Premium Anti-Red HostPanel (30 Days)')
assert.ok(en.includes('foo.com'), 'must include domain')
assert.ok(en.includes('Premium Anti-Red HostPanel'), 'must include plan name')
assert.ok(en.toLowerCase().includes('cannot be undone') || en.toLowerCase().includes('permanently delete'), 'must include warning')
console.log('  ✓ confirmCancelHostingPlan renders all dynamic params')

console.log('\n✅ All smoke tests passed.')
