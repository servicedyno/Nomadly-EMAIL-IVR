/* global require, module, process */
/**
 * Regression test for @kathyserious AU toll-free purchase failure (2026-05-25).
 *
 * Symptom: Twilio createAddress was called with `null, null` for the
 * sub-account credentials, the security guard (requireSubClient) returned
 * null, and every first-time address-required purchase (AU/FI/NZ/HK/MX/...)
 * failed with "Address creation requires sub-account credentials" — wallet
 * was refunded, user stuck retrying forever.
 *
 * Fix (in js/_index.js cpEnterAddress): get-or-create the user's Twilio
 * sub-account BEFORE calling createAddress, persist subSid+subToken to
 * phoneNumbersOf so executeTwilioPurchase finds the same credentials, and
 * pass them into createAddress.
 *
 * This test verifies the underlying twilio-service contract: the security
 * guard rejects null credentials, accepts a valid sub-account pair, and
 * rejects when the sub SID matches the main account SID.
 */
const assert = require('assert')
const Module = require('module')

// ── Stub the twilio() factory so no network calls happen ────────────
const _origLoad = Module._load
let _twilioCalls = []
Module._load = function (request, parent, ...rest) {
  if (request === 'twilio') {
    return function twilioFactory(sid, token) {
      _twilioCalls.push({ sid, token })
      return {
        addresses: { create: async (params) => ({ sid: 'AD_FAKE_' + sid.slice(2, 8), ...params }) },
        api: { accounts: { list: async () => [] } },
        incomingPhoneNumbers: () => ({ update: async () => ({}), remove: async () => ({}) }),
      }
    }
  }
  return _origLoad.call(this, request, parent, ...rest)
}

process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'ACmain00000000000000000000000000000'
process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'main-token-xxx'

delete require.cache[require.resolve('../twilio-service.js')]
const ts = require('../twilio-service.js')

let passed = 0, failed = 0
function it(name, fn) {
  try {
    const r = fn()
    if (r && r.then) {
      return r.then(() => { console.log(`✓ ${name}`); passed++ })
        .catch(err => { console.error(`✗ ${name}: ${err.message}`); failed++ })
    }
    console.log(`✓ ${name}`); passed++
  } catch (err) { console.error(`✗ ${name}: ${err.message}`); failed++ }
}

async function run() {
  await it('createAddress: null/null sub-account creds → rejected (the @kathyserious regression)', async () => {
    _twilioCalls = []
    const res = await ts.createAddress('Kathy Doe', '9 Cobram Street', 'Tarneit', 'VIC', '3029', 'AU', null, null)
    assert.ok(res.error, 'must return an error object')
    assert.ok(/sub-account credentials/i.test(res.error), `expected sub-account credential error, got: ${res.error}`)
    assert.strictEqual(_twilioCalls.length, 0, 'must NOT instantiate a Twilio client when creds are missing')
  })

  await it('createAddress: empty-string creds → rejected', async () => {
    _twilioCalls = []
    const res = await ts.createAddress('Kathy', '9 Cobram St', 'Tarneit', 'VIC', '3029', 'AU', '', '')
    assert.ok(res.error)
    assert.strictEqual(_twilioCalls.length, 0)
  })

  await it('createAddress: subSid matches main account SID → rejected (security)', async () => {
    _twilioCalls = []
    const res = await ts.createAddress('Kathy', '9 Cobram St', 'Tarneit', 'VIC', '3029', 'AU',
      'ACmain00000000000000000000000000000', 'main-token-xxx')
    assert.ok(res.error)
    assert.strictEqual(_twilioCalls.length, 0, 'security guard must block main-account SID')
  })

  await it('createAddress: valid sub-account creds (the after-fix path) → succeeds and instantiates sub-client', async () => {
    _twilioCalls = []
    const subSid = 'ACsub99999999999999999999999999999999'
    const subToken = 'sub-token-yyy'
    const res = await ts.createAddress('Kathy Doe', '9 Cobram Street', 'Tarneit', 'VIC', '3029', 'AU', subSid, subToken)
    assert.ok(!res.error, `expected success, got error: ${res.error}`)
    assert.ok(res.sid, 'must return a Twilio Address SID')
    assert.strictEqual(_twilioCalls.length, 1, 'must instantiate exactly one Twilio client')
    assert.strictEqual(_twilioCalls[0].sid, subSid, 'must use the sub-account SID, not main')
    assert.strictEqual(_twilioCalls[0].token, subToken)
  })

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error('runner crashed:', e); process.exit(2) })
