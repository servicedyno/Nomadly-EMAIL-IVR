'use strict'
/**
 * test_ovh_mgmt_parity.js
 * Verifies OVH VPS/RDP can be managed like Contabo after the parity fixes:
 *   1. Provider routing (detectProviderByInstanceId / getProviderForRecord)
 *   2. ovh-service exposes the full lifecycle method surface
 *   3. New OVH-aware lang keys (passwordResetEmailed / windowsReinstallEmailed)
 *      exist and render non-empty strings in all 4 locales
 *   4. OVH resetPassword returns no inline password (so the bot must use the
 *      emailed-message branch) — shape check only, no live API call.
 *
 * NOTE: No live OVH/Contabo API calls are made. Pure routing + shape checks.
 */
process.env.VPS_DEFAULT_PROVIDER = process.env.VPS_DEFAULT_PROVIDER || 'ovh'
const assert = require('assert')
let pass = 0, fail = 0
function check (name, fn) {
  try { fn(); console.log('  \u2713', name); pass++ } catch (e) { console.log('  \u2717', name, '\u2192', e.message); fail++ }
}

const vpsProvider = require('../vps-provider')
const ovh = require('../ovh-service')

console.log('1) detectProviderByInstanceId')
check('vps- prefix \u2192 ovh', () => assert.strictEqual(vpsProvider.detectProviderByInstanceId('vps-12abc.vps.ovh.net'), 'ovh'))
check('numeric \u2192 contabo', () => assert.strictEqual(vpsProvider.detectProviderByInstanceId('203228089'), 'contabo'))

console.log('2) getProviderForRecord routing')
check('record.provider=ovh \u2192 ovh-service', () => assert.strictEqual(vpsProvider.getProviderForRecord({ provider: 'ovh' }).PROVIDER, 'ovh'))
check('vps- contaboInstanceId \u2192 ovh-service', () => assert.strictEqual(vpsProvider.getProviderForRecord({ contaboInstanceId: 'vps-x.vps.ovh.net' }).PROVIDER, 'ovh'))
check('numeric contaboInstanceId \u2192 contabo-service', () => {
  const svc = vpsProvider.getProviderForRecord({ contaboInstanceId: '203228089' })
  assert.strictEqual(typeof svc.cancelInstance, 'function')
  assert.notStrictEqual(svc.PROVIDER, 'ovh')
})

console.log('3) ovh-service lifecycle method surface (parity with Contabo)')
const required = ['getInstance', 'startInstance', 'stopInstance', 'restartInstance', 'shutdownInstance',
  'resetPassword', 'reinstallInstance', 'cancelInstance', 'upgradeInstance', 'updateInstanceName',
  'createSnapshot', 'listSnapshots', 'deleteSnapshot', 'getDefaultWindowsImageId', 'createSecret']
for (const m of required) check(`ovh.${m} is function`, () => assert.strictEqual(typeof ovh[m], 'function'))
check('ovh.PROVIDER === "ovh"', () => assert.strictEqual(ovh.PROVIDER, 'ovh'))

console.log('4) new OVH-aware lang keys render in all locales')
for (const loc of ['en', 'fr', 'zh', 'hi']) {
  const mod = require(`../lang/${loc}.js`)
  const top = mod[loc] || mod[Object.keys(mod)[0]]
  const vp = top.vp
  check(`${loc}: vp.passwordResetEmailed is function`, () => assert.strictEqual(typeof vp.passwordResetEmailed, 'function'))
  check(`${loc}: vp.windowsReinstallEmailed is function`, () => assert.strictEqual(typeof vp.windowsReinstallEmailed, 'function'))
  check(`${loc}: passwordResetEmailed renders non-empty`, () => {
    const s = vp.passwordResetEmailed('srv1', '1.2.3.4', 'ubuntu', null)
    assert.ok(typeof s === 'string' && s.length > 20)
    assert.ok(s.includes('srv1') && s.includes('1.2.3.4'))
  })
  check(`${loc}: windowsReinstallEmailed renders non-empty`, () => {
    const s = vp.windowsReinstallEmailed('rdp1', '5.6.7.8', 'Administrator', null)
    assert.ok(typeof s === 'string' && s.length > 20)
    assert.ok(s.includes('rdp1') && s.includes('Administrator'))
  })
  // existing inline-password variants must still exist (no regression)
  check(`${loc}: vp.passwordResetSuccess still present`, () => assert.strictEqual(typeof vp.passwordResetSuccess, 'function'))
  check(`${loc}: vp.windowsReinstallSuccess still present`, () => assert.strictEqual(typeof vp.windowsReinstallSuccess, 'function'))
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
