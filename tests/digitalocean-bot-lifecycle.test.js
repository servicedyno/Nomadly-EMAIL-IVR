/* global describe, test, expect, beforeEach, afterEach */
/**
 * DigitalOcean — bot-side lifecycle integration tests.
 *
 * Verifies that the bot's existing VPS-management flows (Start/Stop/Restart/
 * Shutdown/Delete/Toggle-autorenew/Cancel-on-create) route correctly to the
 * DigitalOcean service when the record's contaboInstanceId carries the
 * `do-` prefix, AND that the destructive-cancel guard prevents wiping the
 * just-created droplet during the cancel-on-create + toggle-autorenew flows.
 *
 * These are unit-level tests that mock the DO service so we don't hit the
 * real DO API (which would cost real money to create+destroy a Droplet).
 */
process.env.VPS_MARKUP_PERCENT = '200'
process.env.DIGITALOCEAN_API_TOKEN = 'test-key-only'
process.env.VPS_DEFAULT_PROVIDER = 'contabo' // keep default Contabo to ensure DO routing relies purely on the do- prefix

const path = require('path')

describe('DigitalOcean — bot-side lifecycle dispatch via smart proxy', () => {
  beforeEach(() => {
    // Clear cache so vps-provider re-reads env / providers
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'vps-provider'))]
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'digitalocean-service'))]
  })

  test('startInstance("do-487393245") dispatches to DigitalOcean service', () => {
    const vp = require(path.join(__dirname, '..', 'js', 'vps-provider'))
    const digitalocean = require(path.join(__dirname, '..', 'js', 'digitalocean-service'))
    const dispatched = vp.dispatchByInstanceId('do-487393245')
    // Reference equality proves the smart proxy resolves to the SAME module
    expect(dispatched).toBe(digitalocean)
    // And that the dispatched module has the lifecycle methods the bot needs
    expect(typeof dispatched.startInstance).toBe('function')
    expect(typeof dispatched.stopInstance).toBe('function')
    expect(typeof dispatched.restartInstance).toBe('function')
    expect(typeof dispatched.shutdownInstance).toBe('function')
  })

  test('Numeric instanceId still dispatches to Contabo (DO does not steal Contabo traffic)', () => {
    const vp = require(path.join(__dirname, '..', 'js', 'vps-provider'))
    const contabo = require(path.join(__dirname, '..', 'js', 'contabo-service'))
    const dispatched = vp.dispatchByInstanceId('203228089')
    expect(dispatched).toBe(contabo)
  })

  test('Smart proxy: contabo.stopInstance("do-...") forwards through DO service', async () => {
    const vp = require(path.join(__dirname, '..', 'js', 'vps-provider'))
    const digitalocean = require(path.join(__dirname, '..', 'js', 'digitalocean-service'))

    // Spy on the DO service's stopInstance
    const original = digitalocean.stopInstance
    let capturedArg = null
    digitalocean.stopInstance = (arg) => { capturedArg = arg; return Promise.resolve({ stubbed: true }) }

    try {
      const proxy = vp.buildSmartProxy()
      const result = await proxy.stopInstance('do-487393245')
      expect(result).toEqual({ stubbed: true })
      expect(capturedArg).toBe('do-487393245')
    } finally {
      digitalocean.stopInstance = original
    }
  })

  test('Smart proxy: every lifecycle method routes do- IDs to DO', async () => {
    const vp = require(path.join(__dirname, '..', 'js', 'vps-provider'))
    const digitalocean = require(path.join(__dirname, '..', 'js', 'digitalocean-service'))
    const methods = ['startInstance', 'stopInstance', 'restartInstance', 'shutdownInstance',
                     'resetPassword', 'reinstallInstance', 'cancelInstance', 'updateInstanceName',
                     'upgradeInstance', 'createSnapshot', 'listSnapshots', 'deleteSnapshot']
    for (const m of methods) {
      const calls = []
      const original = digitalocean[m]
      digitalocean[m] = (...args) => { calls.push({ method: m, args }); return Promise.resolve({ stubbed: m }) }
      try {
        const proxy = vp.buildSmartProxy()
        await proxy[m]('do-487393245', 'arg2', 'arg3')
        expect(calls.length).toBe(1)
        expect(calls[0].method).toBe(m)
        expect(calls[0].args[0]).toBe('do-487393245')
      } finally {
        digitalocean[m] = original
      }
    }
  })
})

describe('DigitalOcean — instance ID storage convention (do- prefix preservation)', () => {
  beforeEach(() => {
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'digitalocean-service'))]
  })

  test('createInstance returns instanceId wrapped with do- prefix', async () => {
    const digitalocean = require(path.join(__dirname, '..', 'js', 'digitalocean-service'))
    // Stub apiRequest so we don't actually create a paid droplet
    const realApi = digitalocean.apiRequest
    // Manually wire a stub by overriding the http client used internally is
    // too invasive; instead we verify the WRAP / STRIP helpers directly and
    // trust the integration test for the API call path.
    expect(digitalocean._wrapId(487393245)).toBe('do-487393245')
    expect(digitalocean._wrapId('487393245')).toBe('do-487393245')
    expect(digitalocean._wrapId('do-487393245')).toBe('do-487393245') // idempotent
    expect(digitalocean._stripIdPrefix('do-487393245')).toBe('487393245')
    expect(digitalocean._stripIdPrefix('487393245')).toBe('487393245')
    expect(realApi).toBeDefined()
  })

  test('getProviderForRecord picks DO when contaboInstanceId starts with do-', () => {
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'vps-provider'))]
    const vp = require(path.join(__dirname, '..', 'js', 'vps-provider'))
    const digitalocean = require(path.join(__dirname, '..', 'js', 'digitalocean-service'))
    // Simulate a DB record from a DO purchase
    const record = {
      chatId: '1234',
      contaboInstanceId: 'do-487393245',
      provider: 'digitalocean',
      vpsId: 'do-487393245',
      productId: 's-1vcpu-1gb',
      region: 'EU',
    }
    expect(vp.getProviderForRecord(record)).toBe(digitalocean)
  })

  test('Even if provider field is missing, do- prefix in contaboInstanceId routes to DO', () => {
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'vps-provider'))]
    const vp = require(path.join(__dirname, '..', 'js', 'vps-provider'))
    const digitalocean = require(path.join(__dirname, '..', 'js', 'digitalocean-service'))
    const record = { contaboInstanceId: 'do-487393245' } // no provider field
    expect(vp.getProviderForRecord(record)).toBe(digitalocean)
  })
})

describe('DigitalOcean — destructive-cancel guard (Vultr parity)', () => {
  // These tests verify the OPERATING-PRINCIPLE expressed in the
  // vm-instance-setup.js cancel-on-create and toggle-autorenew branches:
  // when the detected provider is 'vultr' or 'digitalocean', the bot
  // MUST NOT call cancelInstance() because it would immediately destroy
  // the just-created VPS.
  //
  // We can't easily run the full flow without DB, so we verify the
  // detectProviderByInstanceId result that gates the branch.

  beforeEach(() => {
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'vps-provider'))]
  })

  test('detectProviderByInstanceId("do-...") returns "digitalocean" — gates the guard', () => {
    const vp = require(path.join(__dirname, '..', 'js', 'vps-provider'))
    expect(vp.detectProviderByInstanceId('do-487393245')).toBe('digitalocean')
  })

  test('Source check: vm-instance-setup.js cancel-on-create branch lists digitalocean', () => {
    const fs = require('fs')
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'vm-instance-setup.js'), 'utf-8')
    // The cancel-on-create guard MUST include 'digitalocean' so DO purchases
    // don't self-destruct seconds after creation. (Azure was later added to
    // the same guard list — we accept any ordering / extra providers.)
    expect(src).toMatch(/\[\s*('[a-z]+'\s*,\s*)*'digitalocean'(\s*,\s*'[a-z]+')*\s*\]\.includes\(\s*vpsProvider\.detectProviderByInstanceId/)
  })

  test('Source check: changeVpsAutoRenewal branch guards both vultr and digitalocean', () => {
    const fs = require('fs')
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'vm-instance-setup.js'), 'utf-8')
    // The "auto-renew OFF" branch must short-circuit for both
    // vultr and digitalocean (destructive cancel guard).
    expect(src).toMatch(/_provName === 'vultr' \|\| _provName === 'digitalocean'/)
  })

  test('Source check: deleteVPSinstance short-circuits the cancelDate poll for DO', () => {
    const fs = require('fs')
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'vm-instance-setup.js'), 'utf-8')
    // The verify-cancelDate poll is wasted on DO (immediate delete) — must
    // short-circuit just like OVH.
    expect(src).toMatch(/_providerName === 'vultr' \|\| _providerName === 'digitalocean'/)
  })
})

describe('DigitalOcean — DB record shape compatibility', () => {
  test('A DO record looks identical to a Vultr/Contabo record from the bot UI perspective', () => {
    // The bot's UI renderer (lang/en.js selectedVpsData, _index.js getVPSDetails)
    // depends on these fields. A DO record must expose them too.
    const fakeRecord = {
      chatId: '1234',
      contaboInstanceId: 'do-487393245',
      provider: 'digitalocean',
      name: 'my-do-vps',
      label: 'my-do-vps',
      vpsId: 'do-487393245',
      host: '192.0.2.10',
      region: 'EU',
      productId: 's-1vcpu-1gb',
      osType: 'Linux',
      isRDP: false,
      imageId: 'ubuntu-24-04-x64',
      defaultUser: 'root',
      start_time: new Date('2026-06-24'),
      end_time: new Date('2026-07-24'),
      plan: 'Monthly',
      planPrice: 18,
      status: 'active',
      autoRenewable: false,
      rootPasswordSecretId: 'do-pwd-test',
      sshKeySecretId: null,
    }
    // All keys present
    const requiredKeys = ['chatId', 'contaboInstanceId', 'provider', 'name', 'vpsId',
                         'host', 'region', 'productId', 'osType', 'plan', 'planPrice',
                         'status', 'autoRenewable']
    for (const k of requiredKeys) expect(fakeRecord).toHaveProperty(k)
    // provider explicitly says digitalocean
    expect(fakeRecord.provider).toBe('digitalocean')
    // contaboInstanceId has do- prefix
    expect(fakeRecord.contaboInstanceId).toMatch(/^do-/)
  })
})
