/**
 * Vultr cross-provider parity integration test.
 *
 * After 2026-06-23 (@ciroovblzz incident), Vultr was made the default VPS
 * provider in prod but had 9 contract gaps that would break or destroy any
 * provisioning attempt. This suite locks in the contract so the bot's
 * existing call shape works without modification on Vultr.
 *
 * Mocks axios at the module level — no real Vultr API calls.
 */

/* global describe, test, expect, beforeEach, jest */

process.env.VULTR_API_KEY = 'test-key'
process.env.VPS_MARKUP_PERCENT = '200'

// Mock axios BEFORE requiring vultr-service so the http instance picks up the
// fake. axios.create() returns an object whose methods we'll stub per-test.
jest.mock('axios', () => {
  const calls = []
  const stub = jest.fn().mockResolvedValue({ data: {} })
  const create = jest.fn(() => ({
    request: stub,
    interceptors: { response: { use: jest.fn() } },
  }))
  return { __esModule: true, default: { create }, create, _stub: stub, _calls: calls }
})

const axios = require('axios')
const vultr = require('../js/vultr-service')

// Helper: configure the next axios call's response, capture body
function nextResponse(data) { axios._stub.mockResolvedValueOnce({ data }) }
function nextError(status, message) {
  const err = new Error(message || `Request failed with status code ${status}`)
  err.response = { status, data: { error: message || 'fail' } }
  axios._stub.mockRejectedValueOnce(err)
}
function lastCall() {
  const calls = axios._stub.mock.calls
  return calls.length ? calls[calls.length - 1][0] : null
}

beforeEach(() => {
  axios._stub.mockReset()
  axios._stub.mockResolvedValue({ data: {} })
})

describe('Vultr cross-provider parity (post-2026-06-23 fixes)', () => {

  // ─── Gap #1: createSecret('password') ──────────────────────────────────
  describe('createSecret password-secret simulation', () => {
    test('createSecret(name, value, "password") returns a fake secretId without API call', async () => {
      const result = await vultr.createSecret('pwd-test-12345', 'MyP@ssw0rd123', 'password')
      expect(axios._stub).not.toHaveBeenCalled()
      expect(typeof result.secretId).toBe('string')
      expect(result.secretId).toMatch(/^vultr-pwd-/)
      expect(result.id).toBe(result.secretId)
      expect(result.name).toBe('pwd-test-12345')
      expect(result.type).toBe('password')
    })

    test('createSecret(name, value, "ssh") still hits the /ssh-keys API', async () => {
      nextResponse({ ssh_key: { id: 'sk-abc-123', name: 'my-key' } })
      const result = await vultr.createSecret('my-key', 'ssh-rsa AAAA…', 'ssh')
      const call = lastCall()
      expect(call.method).toBe('POST')
      expect(call.url).toBe('/ssh-keys')
      expect(call.data.ssh_key).toBe('ssh-rsa AAAA…')
      expect(result.secretId).toBe('sk-abc-123')
      expect(result.id).toBe('sk-abc-123')
    })

    test('createSecret throws on unsupported type', async () => {
      await expect(vultr.createSecret('x', 'y', 'unknown'))
        .rejects.toThrow(/unsupported type/)
    })
  })

  // ─── Gap #2: createInstance accepts bot's Contabo-style params ──────────
  describe('createInstance Contabo-compat aliases', () => {
    test('accepts {region, imageId, displayName, sshKeys, rootPassword (=fake secretId)}', async () => {
      const pwdSecret = await vultr.createSecret('pwd-x', 'P@ssw0rd-very-strong-1234', 'password')

      nextResponse({ instance: { id: 'vultr-uuid-1', main_ip: null, default_password: null, status: 'pending' } })

      const out = await vultr.createInstance({
        productId:    'vc2-2c-4gb',
        region:       'US-central',
        imageId:      501,
        displayName:  'nomadly-test-1',
        rootPassword: pwdSecret.secretId,
        sshKeys:      ['sk-1', 'sk-2'],
        period:       1,
      })

      const call = lastCall()
      expect(call.method).toBe('POST')
      expect(call.url).toBe('/instances')
      expect(call.data.region).toBe('ord')           // US-central → ord
      expect(call.data.plan).toBe('vc2-2c-4gb')
      expect(call.data.os_id).toBe(501)
      expect(call.data.label).toBe('nomadly-test-1')
      expect(call.data.sshkey_id).toEqual(['sk-1', 'sk-2'])
      expect(call.data.password).toBe('P@ssw0rd-very-strong-1234')
      expect(out.instanceId).toBe('vultr-uuid-1')
    })

    test('throws when productId/region/imageId missing', async () => {
      await expect(vultr.createInstance({ productId: 'x' }))
        .rejects.toThrow(/createInstance requires/)
    })

    test('throws when region slug is unknown', async () => {
      await expect(vultr.createInstance({ productId: 'p', region: 'MARS', imageId: 1 }))
        .rejects.toThrow(/Unknown region slug/)
    })
  })

  // ─── Gap #3: cancelInstance respects scheduleOnly mode ──────────────────
  describe('cancelInstance scheduleOnly safety', () => {
    test('scheduleOnly:true does NOT call DELETE (would destroy on Vultr)', async () => {
      const out = await vultr.cancelInstance('vultr-uuid-1', { scheduleOnly: true })
      expect(axios._stub).not.toHaveBeenCalled()
      expect(out.success).toBe(true)
      expect(out.scheduleOnly).toBe(true)
      expect(out.note).toMatch(/no scheduled cancellation/)
    })

    test('default mode DOES issue a real DELETE', async () => {
      nextResponse({ success: true })
      await vultr.cancelInstance('vultr-uuid-1')
      const call = lastCall()
      expect(call.method).toBe('DELETE')
      expect(call.url).toBe('/instances/vultr-uuid-1')
    })
  })

  // ─── Gap #6: resetPassword return shape parity ──────────────────────────
  describe('resetPassword cross-provider return shape', () => {
    test('returns { password, secretId, reinstalled, note }', async () => {
      nextResponse({ instance: { id: 'i-1', default_password: 'NewP@ss123' } })
      const out = await vultr.resetPassword('vultr-uuid-1', { isRDP: false })
      expect(out.password).toBe('NewP@ss123')
      expect(out.newPassword).toBe('NewP@ss123')
      expect(typeof out.secretId).toBe('string')
      expect(out.secretId).toMatch(/^vultr-pwd-/)
      expect(out.reinstalled).toBe(true)
      expect(typeof out.note).toBe('string')
      expect(out.note).toMatch(/SSH/)
    })

    test('Windows note differs from Linux', async () => {
      nextResponse({ instance: { id: 'i-1', default_password: 'WinP@ss' } })
      const out = await vultr.resetPassword('vultr-uuid-1', { isRDP: true })
      expect(out.note).toMatch(/Windows/)
    })
  })

  // ─── Gap #7: reinstallInstance accepts {imageId, rootPassword} ──────────
  describe('reinstallInstance Contabo-compat aliases', () => {
    test('imageId aliases to os_id; cached secret updated with new password', async () => {
      const pwd = await vultr.createSecret('pwd-r', 'old-pass', 'password')
      nextResponse({ instance: { id: 'i-1', default_password: 'fresh-vultr-generated' } })
      const out = await vultr.reinstallInstance('i-1', { imageId: 501, rootPassword: pwd.secretId })
      const call = lastCall()
      expect(call.data.os_id).toBe(501)
      expect(out.password).toBe('fresh-vultr-generated')
    })

    test('numeric-string osId is coerced to int', async () => {
      nextResponse({ instance: { id: 'i-1' } })
      await vultr.reinstallInstance('i-1', { osId: '501' })
      const call = lastCall()
      expect(call.data.os_id).toBe(501)
      expect(typeof call.data.os_id).toBe('number')
    })
  })

  // ─── Gap #8: userData is not double-base64'd ────────────────────────────
  describe('createInstance userData base64 handling', () => {
    test('already-base64 input passes through unchanged', async () => {
      nextResponse({ instance: { id: 'i-1' } })
      const script = '#!/bin/bash\necho hello\n'
      const alreadyB64 = Buffer.from(script).toString('base64')
      await vultr.createInstance({
        productId: 'vc2-1c-2gb', region: 'US-central', imageId: 501,
        userData: alreadyB64,
      })
      const call = lastCall()
      expect(call.data.user_data).toBe(alreadyB64)
      expect(Buffer.from(call.data.user_data, 'base64').toString('utf-8'))
        .toBe(script)
    })

    test('raw-text input is base64-encoded once', async () => {
      nextResponse({ instance: { id: 'i-1' } })
      // Use binary text that isn't accidentally valid base64 — e.g. has a space
      const script = '#!/bin/bash\necho hello world\n'
      await vultr.createInstance({
        productId: 'vc2-1c-2gb', region: 'US-central', imageId: 501,
        userData: script,
      })
      const call = lastCall()
      expect(Buffer.from(call.data.user_data, 'base64').toString('utf-8'))
        .toBe(script)
    })
  })

  // ─── Gap #9: SSH keys attach via sshKeys alias ─────────────────────────
  describe('createInstance sshKeys alias', () => {
    test('sshKeys (Contabo-style) maps to sshkey_id (Vultr API)', async () => {
      nextResponse({ instance: { id: 'i-1' } })
      await vultr.createInstance({
        productId: 'vc2-1c-2gb', region: 'US-central', imageId: 501,
        sshKeys: ['sk-aaa', 'sk-bbb'],
      })
      const call = lastCall()
      expect(call.data.sshkey_id).toEqual(['sk-aaa', 'sk-bbb'])
    })
  })

  // ─── Lifecycle ops ──────────────────────────────────────────────────────
  describe('lifecycle ops hit correct Vultr endpoints', () => {
    const cases = [
      ['startInstance',    'POST', 'start'],
      ['stopInstance',     'POST', 'halt'],
      ['restartInstance',  'POST', 'reboot'],
      ['shutdownInstance', 'POST', 'halt'],
    ]
    cases.forEach(([fn, method, suffix]) => {
      test(`${fn} → ${method} /instances/{id}/${suffix}`, async () => {
        nextResponse({ success: true })
        await vultr[fn]('uuid-1')
        const call = lastCall()
        expect(call.method).toBe(method)
        expect(call.url).toBe(`/instances/uuid-1/${suffix}`)
      })
    })
  })

  // ─── getInstance ipConfig shim for Contabo-shaped consumers ────────────
  describe('getInstance Contabo shape compatibility', () => {
    test('exposes ipConfig.v4.ip and ipv4 alongside mainIp', async () => {
      nextResponse({ instance: {
        id: 'uuid-1', main_ip: '203.0.113.5', default_password: 'p',
        status: 'active', power_status: 'running', server_status: 'ok',
        region: 'ord', plan: 'vc2-1c-2gb', os_id: 501,
        label: 'test', tag: null, date_created: '2026-06-23T13:00:00Z',
        v6_main_ip: '',
      }})
      const inst = await vultr.getInstance('uuid-1')
      expect(inst.mainIp).toBe('203.0.113.5')
      expect(inst.ipConfig?.v4?.ip).toBe('203.0.113.5')
      expect(inst.ipv4).toBe('203.0.113.5')
    })
  })

  // ─── upgradeInstance + updateInstanceName ──────────────────────────────
  describe('upgradeInstance + updateInstanceName', () => {
    test('upgradeInstance PATCHes plan', async () => {
      nextResponse({ success: true })
      await vultr.upgradeInstance('u-1', 'vc2-2c-4gb')
      const call = lastCall()
      expect(call.method).toBe('PATCH')
      expect(call.url).toBe('/instances/u-1')
      expect(call.data).toEqual({ plan: 'vc2-2c-4gb' })
    })

    test('updateInstanceName PATCHes label', async () => {
      nextResponse({ success: true })
      await vultr.updateInstanceName('u-1', 'new-name')
      const call = lastCall()
      expect(call.method).toBe('PATCH')
      expect(call.url).toBe('/instances/u-1')
      expect(call.data).toEqual({ label: 'new-name' })
    })
  })
})
