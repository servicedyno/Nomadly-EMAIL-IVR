/**
 * Regression test: Twilio number purchase must use the sub-account when an
 * AddressSid or BundleSid is involved (not the main account).
 *
 * Context: 2026-06-12 production logs (Railway deploy 5863320a) showed
 *   "[Twilio] buyNumber error: Could not find Address with sid AD3ecf… for
 *    account AC754f… to satisfy Address requirement"
 * because the bot was buying on the MAIN account while the AddressSid had
 * been created on the SUB-account (createAddress is sub-only by design).
 *
 * This test pins the fix: buyNumber, when given (subSid, subToken), instantiates
 * the Twilio client with sub credentials, and rejects address/bundle purchases
 * that try to fall back to the main account.
 *
 * Pure-unit test (no live Twilio call): we stub the `twilio` constructor to
 * record which (sid, token) pair the function instantiates.
 */

const path = require('path')
const assert = require('assert')
const Module = require('module')

// ── Stub the `twilio` package BEFORE requiring twilio-service ──
const calls = []
function makeFakeClient(label) {
  return {
    incomingPhoneNumbers: {
      create: async (opts) => {
        calls.push({ label, opts })
        return {
          phoneNumber: opts.phoneNumber,
          sid: 'PNfakefakefakefake' + label.slice(0, 4),
          friendlyName: opts.phoneNumber,
          capabilities: { voice: true, sms: true },
        }
      },
    },
  }
}
const fakeTwilioFactory = (sid, token) => {
  calls.push({ ctor: { sid, token } })
  if (sid && sid.startsWith('AC754')) return makeFakeClient('MAIN')
  if (sid && sid.startsWith('AC832')) return makeFakeClient('SUB')
  return makeFakeClient('OTHER')
}

// Monkey-patch require so twilio-service picks up our fake.
const origResolve = Module._resolveFilename
const origLoad = Module._load
Module._load = function (request, parent, ...rest) {
  if (request === 'twilio') return fakeTwilioFactory
  return origLoad.call(this, request, parent, ...rest)
}

// Set env so twilio-service initializes without throwing.
process.env.TWILIO_ACCOUNT_SID = 'AC754fb3aedb907b12c79a7d31b67937a0'
process.env.TWILIO_AUTH_TOKEN = 'fake-main-token'
process.env.SELF_URL = 'https://example.test/api'

// Now load the real module under test.
const twilioService = require(path.resolve(__dirname, '../../js/twilio-service.js'))

function run(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`✓ ${name}`))
    .catch((e) => {
      console.error(`✗ ${name}\n   ${e.stack || e.message}`)
      process.exit(1)
    })
}

;(async () => {
  // 1. buyNumber WITH subSid + subToken → instantiates sub client, address visible.
  await run('buyNumber uses sub-account when subSid + subToken provided', async () => {
    calls.length = 0
    const SUB_SID = 'AC832d91dcd8cc2043077ac8299705f28e'
    const SUB_TOKEN = 'fake-sub-token'
    const ADDRESS_SID = 'AD3ecf4636b04fa0e54783f86544f3844e'
    const out = await twilioService.buyNumber(
      '+15551234567',
      SUB_SID,
      SUB_TOKEN,
      'https://example.test/api',
      ADDRESS_SID,
      null,
    )
    assert.ok(!out.error, `unexpected error: ${out.error}`)
    assert.strictEqual(out.sid, 'PNfakefakefakefakeSUB')
    // The constructor should have been called with the SUB credentials, never MAIN.
    const ctorCalls = calls.filter((c) => c.ctor).map((c) => c.ctor.sid)
    assert.ok(ctorCalls.includes(SUB_SID), `expected sub sid in ctor calls, got ${JSON.stringify(ctorCalls)}`)
    assert.ok(!ctorCalls.includes(process.env.TWILIO_ACCOUNT_SID), 'main account must not be instantiated for sub-account purchase')
    // The address sid must have been passed through to Twilio.
    const createCall = calls.find((c) => c.opts)
    assert.strictEqual(createCall.opts.addressSid, ADDRESS_SID)
  })

  // 2. buyNumber WITHOUT sub credentials but WITH addressSid → must REJECT (fix prevents prod bug).
  await run('buyNumber rejects address/bundle purchase on main account (regression: 2026-06-12 prod bug)', async () => {
    calls.length = 0
    const out = await twilioService.buyNumber(
      '+447700900123',
      null,
      null,
      'https://example.test/api',
      'AD3ecf4636b04fa0e54783f86544f3844e',
      null,
    )
    assert.ok(out.error, 'expected rejection, got success')
    assert.ok(/sub-account/i.test(out.error), `error should mention sub-account, got: ${out.error}`)
    // Must NOT have called Twilio at all.
    const createCalls = calls.filter((c) => c.opts)
    assert.strictEqual(createCalls.length, 0, 'no Twilio API call should be made when address requires sub-account')
  })

  // 3. buyNumber WITHOUT sub credentials and WITHOUT address/bundle → main account allowed (admin/no-reg flow).
  await run('buyNumber falls back to main account for address-free numbers (admin path)', async () => {
    calls.length = 0
    const out = await twilioService.buyNumber(
      '+18885550199',
      null,
      null,
      'https://example.test/api',
      null,
      null,
    )
    assert.ok(!out.error, `unexpected error: ${out.error}`)
    assert.strictEqual(out.sid, 'PNfakefakefakefakeMAIN')
  })

  console.log('\nAll twilio-service buyNumber regression tests passed.')

  // Restore module loader to avoid leaking the stub.
  Module._load = origLoad
  Module._resolveFilename = origResolve
})()
