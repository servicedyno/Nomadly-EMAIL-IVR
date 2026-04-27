// Verifies the new bot site-offline/online state machine has all keys present
// in every locale, plus the site-status-service exposes its public API.

const assert = require('assert')
const { translation } = require('../translation.js')
const svc = require('../site-status-service')

console.log('— Test: site-status-service public API —')
for (const fn of ['enableMaintenanceMode', 'disableMaintenanceMode', 'suspend', 'unsuspend', 'readStatus']) {
  assert.strictEqual(typeof svc[fn], 'function', `${fn} must be exported`)
}
console.log('  ✓ all 5 functions exported')

console.log('— Test: lang strings for site offline/online toggle exist in en/fr/hi/zh —')
const langs = ['en', 'fr', 'hi', 'zh']
const tKeys = [
  'chooseSiteOfflineMode',
  'confirmSiteOfflineMode',
  'takingSiteOffline',
  'takeSiteOfflineSuccess',
  'takeSiteOfflineFailed',
  'confirmBringSiteOnline',
  'bringingSiteOnline',
  'bringSiteOnlineSuccess',
  'bringSiteOnlineFailed',
]
const userKeys = [
  'takeSiteOffline',
  'bringSiteOnline',
  'siteOfflineModeMaintenance',
  'siteOfflineModeSuspend',
  'confirmTakeOfflineBtn',
  'confirmBringOnlineBtn',
]

for (const lang of langs) {
  for (const k of tKeys) {
    // The functions take (domain, mode) — pass realistic args to confirm interpolation works
    const v = translation('t.' + k, lang, 'foo.com', 'maintenance')
    assert.ok(v && v !== ('t.' + k), `t.${k} missing in ${lang}: got "${v}"`)
  }
  for (const k of userKeys) {
    const v = translation('user.' + k, lang)
    assert.ok(v && v !== ('user.' + k), `user.${k} missing in ${lang}: got "${v}"`)
  }
}
console.log(`  ✓ ${tKeys.length} t-strings + ${userKeys.length} user-strings present in en/fr/hi/zh (${(tKeys.length + userKeys.length) * langs.length} total assertions)`)

console.log('— Test: confirmSiteOfflineMode branches differently for suspended vs maintenance —')
const enMaint = translation('t.confirmSiteOfflineMode', 'en', 'foo.com', 'maintenance')
const enSusp = translation('t.confirmSiteOfflineMode', 'en', 'foo.com', 'suspended')
assert.notStrictEqual(enMaint, enSusp, 'maintenance and suspended must produce different copy')
assert.ok(enMaint.toLowerCase().includes('maintenance'), 'maintenance copy must mention maintenance')
assert.ok(enSusp.toLowerCase().includes('suspend'), 'suspended copy must mention suspend')
// Both must remind the user that billing keeps running
assert.ok(enMaint.toLowerCase().includes('expir') || enMaint.toLowerCase().includes('renew'), 'maintenance must remind about billing')
assert.ok(enSusp.toLowerCase().includes('expir') || enSusp.toLowerCase().includes('renew'), 'suspended must remind about billing')
console.log('  ✓ branching + billing reminders verified')

console.log('— Test: chooseSiteOfflineMode contains the critical billing warning —')
const choose = translation('t.chooseSiteOfflineMode', 'en', 'foo.com')
assert.ok(/auto.?renew/i.test(choose), 'must mention auto-renew')
assert.ok(/expir/i.test(choose), 'must mention expiry')
console.log('  ✓ user is told that taking site offline does NOT pause billing')

console.log('\n✅ All site-toggle smoke tests passed.')
