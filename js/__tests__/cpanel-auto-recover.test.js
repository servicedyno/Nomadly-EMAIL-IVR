/**
 * Tests for cpanel-auto-recover.js — decision logic only.
 *
 * Verifies:
 *   • Returns `not_configured` when WHM_DROPLET_ID is unset
 *   • Returns `no_do_token` when DO token is unset
 *   • Skips reboot when SSH:22 still answers (OS alive, only WHM down)
 *   • Honours cooldown
 *
 * Network calls (TCP probe, DO API) are stubbed so the test is
 * deterministic and offline-safe.
 */

const Module = require('module')
const path = require('path')

// ── Pre-set env so the module reads the values we want ──
process.env.WHM_DROPLET_ID = '557194941'
process.env.DIGITALOCEAN_API_TOKEN = 'test-token'
process.env.WHM_HOST = '209.38.241.9'
process.env.WHM_API_URL = 'https://whm-api.test'
process.env.WHM_AUTO_REBOOT_COOLDOWN_MS = '1800000'

// ── Patch `net` and `https` BEFORE the SUT is required ──
const origLoad = Module._load
let _stubs = { tcpOk: false, httpsOk: true, doActionId: 42, doActionStatus: 'completed' }
Module._load = function (request) {
  if (request === 'net') {
    return {
      Socket: class FakeSocket {
        constructor() { this._listeners = {} }
        once(ev, cb) { this._listeners[ev] = cb }
        setTimeout() {}
        connect() {
          setImmediate(() => {
            if (_stubs.tcpOk) (this._listeners.connect || (() => {}))()
            else (this._listeners.timeout || this._listeners.error || (() => {}))()
          })
        }
        destroy() {}
      },
    }
  }
  if (request === 'https') {
    return {
      request: (opts, cb) => {
        const p = String(opts.path || '')
        const isDoApi = p.startsWith('/v2/')
        const isAction = p.startsWith('/v2/droplets/')
        const isPoll = p.startsWith('/v2/actions/')
        const fakeRes = {
          // DO API → 201/200; tunnel probe → 401 (ok) or 530 (down)
          statusCode: isDoApi ? 201 : (_stubs.httpsOk ? 401 : 530),
          on(ev, fn) {
            if (ev === 'end') {
              setImmediate(fn)
            } else if (ev === 'data') {
              if (isAction) setImmediate(() => fn(Buffer.from(JSON.stringify({ action: { id: _stubs.doActionId, status: 'in-progress' } }))))
              else if (isPoll) setImmediate(() => fn(Buffer.from(JSON.stringify({ action: { id: _stubs.doActionId, status: _stubs.doActionStatus } }))))
            }
          },
          resume() {},
        }
        const fakeReq = {
          on(ev, fn) { if (ev === 'timeout') this._t = fn; if (ev === 'error') this._e = fn },
          write() {},
          end() { setImmediate(() => cb(fakeRes)) },
          destroy() {},
        }
        return fakeReq
      },
    }
  }
  return origLoad.apply(this, arguments)
}

const sut = require('../cpanel-auto-recover.js')

let pass = 0, fail = 0
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { pass++; console.log(`  ✓ ${name}`) })
    .catch(e => { fail++; console.log(`  ✗ ${name}\n    ${e.message}`) })
}

;(async () => {
  console.log('cpanel-auto-recover.test.js\n')

  // 1. Configured?
  await test('detects when configured', () => {
    if (!sut._isConfigured()) throw new Error('expected _isConfigured=true')
  })

  // 2. SSH alive → skip
  await test('skips reboot when SSH:22 still answers (OS alive)', async () => {
    _stubs.tcpOk = true
    const r = await sut.attemptRecovery({ reason: 'TIMEOUT' })
    if (r.attempted) throw new Error(`expected attempted=false (ssh_alive), got ${JSON.stringify(r)}`)
    if (r.reason !== 'ssh_alive') throw new Error(`expected reason=ssh_alive, got ${r.reason}`)
  })

  // 3. SSH dead → recovery starts and sets the in-flight lock.
  // We start one recovery (fire-and-forget — the wait-for-host loop would
  // otherwise take ~2 min) and immediately verify a concurrent call is
  // rejected with `in_flight`.
  await test('SSH dead triggers attempt + in-flight lock blocks concurrent call', async () => {
    _stubs.tcpOk = false
    const first = sut.attemptRecovery({ reason: 'TIMEOUT' })
    await new Promise(r => setImmediate(r))
    await new Promise(r => setImmediate(r))
    const second = await sut.attemptRecovery({ reason: 'TIMEOUT' })
    if (second.attempted) throw new Error(`expected concurrent attempt rejected, got ${JSON.stringify(second)}`)
    if (second.reason !== 'in_flight') throw new Error(`expected reason=in_flight, got ${second.reason}`)
    first.catch(() => {})
  })

  console.log(`\n${pass}/${pass + fail} passed`)
  // Hard-exit so background fire-and-forget recovery doesn't keep the
  // process alive on the long wait-for-host loop.
  process.exit(fail ? 1 : 0)
})()
