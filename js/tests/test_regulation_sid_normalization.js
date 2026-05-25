/* global require, module, process */
/**
 * Regression test for @kathyserious AU Toll-Free regulatory-bundle failure (2026-05-25 21:14:57).
 *
 * Symptom: `[Twilio] getRegulationSid error: Invalid number type: toll_free`
 *
 * Root cause: The bot stores `cpNumberType = 'toll_free'` (underscored, to
 * match Twilio's Available-Numbers search shape), but Twilio's
 * regulations.list API expects single-token `'tollfree'`. Twilio returns
 * `{ error: 'Invalid number type: toll_free' }`, the bot refunds the
 * wallet, and the user is stuck.
 *
 * Fix: `normalizeRegNumberType` in twilio-service.js normalizes
 * 'toll_free' / 'toll-free' / 'tollfree' → 'tollfree' at the API boundary
 * so callers can pass either form.
 */
const assert = require('assert')
const Module = require('module')

const _origLoad = Module._load
let _capturedListArgs = []
let _stubResponse = []
Module._load = function (request, parent, ...rest) {
  if (request === 'twilio') {
    return function twilioFactory() {
      return {
        numbers: { v2: { regulatoryCompliance: { regulations: {
          list: async (args) => {
            _capturedListArgs.push(args)
            // Mimic Twilio: reject anything other than 'local'/'mobile'/'national'/'tollfree'
            const valid = new Set(['local', 'mobile', 'national', 'tollfree'])
            if (!valid.has(args.numberType)) {
              const err = new Error(`Invalid number type: ${args.numberType}`)
              throw err
            }
            return _stubResponse
          },
        } } } },
        addresses: { create: async () => ({ sid: 'AD_FAKE' }) },
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
  // ── Negative: BEFORE-fix behaviour reproduces the @kathyserious bug ──
  // (verified at the underlying twilio() stub: 'toll_free' is rejected as
  // Twilio's API does in real life)
  await it('Stub fidelity: Twilio rejects "toll_free" — the actual @kathyserious 21:14:57 symptom', async () => {
    _capturedListArgs = []; _stubResponse = []
    // Bypass normalizer by directly calling the stub
    const twilio = require('twilio')
    const client = twilio('AC_x', 'tok')
    try {
      await client.numbers.v2.regulatoryCompliance.regulations.list({
        isoCountry: 'AU', numberType: 'toll_free', endUserType: 'individual', limit: 5,
      })
      throw new Error('expected rejection, got success')
    } catch (e) {
      assert.match(e.message, /Invalid number type: toll_free/)
    }
  })

  // ── Positive: getRegulationSid normalizes 'toll_free' before calling Twilio ──
  await it('getRegulationSid: "toll_free" (underscored) → normalized to "tollfree" before Twilio call', async () => {
    _capturedListArgs = []
    _stubResponse = [{ sid: 'RN_TEST_TOLLFREE_AU_INDIVIDUAL', friendlyName: 'Australia: Toll-Free - Individual' }]
    const result = await ts.getRegulationSid('AU', 'toll_free', 'individual')
    assert.ok(!result.error, `expected success, got error: ${result.error}`)
    assert.strictEqual(result.sid, 'RN_TEST_TOLLFREE_AU_INDIVIDUAL')
    assert.strictEqual(_capturedListArgs.length, 1)
    assert.strictEqual(_capturedListArgs[0].numberType, 'tollfree',
      `must have been normalized to 'tollfree', got: ${_capturedListArgs[0].numberType}`)
    assert.strictEqual(_capturedListArgs[0].isoCountry, 'AU')
    assert.strictEqual(_capturedListArgs[0].endUserType, 'individual')
  })

  await it('getRegulationSid: "toll-free" (hyphenated) → normalized to "tollfree"', async () => {
    _capturedListArgs = []
    _stubResponse = [{ sid: 'RN_TEST_TOLLFREE_AU_INDIVIDUAL', friendlyName: 'Australia: Toll-Free - Individual' }]
    const result = await ts.getRegulationSid('AU', 'toll-free', 'individual')
    assert.ok(!result.error)
    assert.strictEqual(_capturedListArgs[0].numberType, 'tollfree')
  })

  await it('getRegulationSid: "tollfree" (canonical) → passes through unchanged', async () => {
    _capturedListArgs = []
    _stubResponse = [{ sid: 'RN_TEST_TOLLFREE_AU_INDIVIDUAL', friendlyName: 'Australia: Toll-Free - Individual' }]
    const result = await ts.getRegulationSid('AU', 'tollfree', 'individual')
    assert.ok(!result.error)
    assert.strictEqual(_capturedListArgs[0].numberType, 'tollfree')
  })

  await it('getRegulationSid: "local" passes through unchanged (the common path)', async () => {
    _capturedListArgs = []
    _stubResponse = [{ sid: 'RN_TEST_LOCAL_AU_INDIVIDUAL', friendlyName: 'Australia: Local - Individual' }]
    const result = await ts.getRegulationSid('AU', 'local', 'individual')
    assert.ok(!result.error)
    assert.strictEqual(_capturedListArgs[0].numberType, 'local')
  })

  await it('getRegulationSid: "mobile" / "national" pass through unchanged', async () => {
    _capturedListArgs = []
    _stubResponse = [{ sid: 'RN_mobile', friendlyName: 'AU Mobile' }]
    await ts.getRegulationSid('AU', 'mobile', 'individual')
    assert.strictEqual(_capturedListArgs[0].numberType, 'mobile')

    _capturedListArgs = []
    _stubResponse = [{ sid: 'RN_nat', friendlyName: 'AU National' }]
    await ts.getRegulationSid('AU', 'national', 'individual')
    assert.strictEqual(_capturedListArgs[0].numberType, 'national')
  })

  await it('getRegulationSid: missing numberType defaults to "local"', async () => {
    _capturedListArgs = []
    _stubResponse = [{ sid: 'RN_local', friendlyName: 'AU Local' }]
    await ts.getRegulationSid('AU', null, 'individual')
    assert.strictEqual(_capturedListArgs[0].numberType, 'local')
    _capturedListArgs = []
    await ts.getRegulationSid('AU', undefined, 'individual')
    assert.strictEqual(_capturedListArgs[0].numberType, 'local')
    _capturedListArgs = []
    await ts.getRegulationSid('AU', '', 'individual')
    assert.strictEqual(_capturedListArgs[0].numberType, 'local')
  })

  await it('getRegulationSid: case-insensitive normalization ("Toll_Free", "TOLL-FREE")', async () => {
    _capturedListArgs = []
    _stubResponse = [{ sid: 'RN_tf', friendlyName: 'AU Toll-Free' }]
    await ts.getRegulationSid('AU', 'Toll_Free', 'individual')
    assert.strictEqual(_capturedListArgs[0].numberType, 'tollfree')

    _capturedListArgs = []
    await ts.getRegulationSid('AU', 'TOLL-FREE', 'individual')
    assert.strictEqual(_capturedListArgs[0].numberType, 'tollfree')
  })

  await it('getRegulationSid: empty Twilio response → returns error', async () => {
    _capturedListArgs = []; _stubResponse = []
    const r = await ts.getRegulationSid('XX', 'tollfree', 'individual')
    assert.ok(r.error)
    assert.match(r.error, /No regulation found/)
  })

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error('runner crashed:', e); process.exit(2) })
