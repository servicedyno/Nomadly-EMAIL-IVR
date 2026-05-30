/**
 * Tests for billing-leak visibility added on 2026-05-30.
 *
 * Verifies that when smartWalletDeduct returns success:false on an
 * outbound call, the bot now:
 *   • writes a `billing_failed` row to walletLedger (visibility)
 *   • DMs the user that their wallet was insufficient
 *   • calls notifyAdmin so the leak is surfaced operationally
 *
 * Note: voice-service.js is a 5k-line monolith with a lot of init wiring,
 * so this test reaches into billCallMinutesUnified by faking just enough
 * collaborators via initVoiceService.
 */

const path = require('path')

// Stub for `./utils.js` smartWalletDeduct/getBalance
const Module = require('module')
const origLoad = Module._load
let _stubs = {
  deductOk: false,
  inserted: [],
  dms: [],
  adminMsgs: [],
}
Module._load = function (request, parent) {
  if (parent && parent.filename === path.resolve(__dirname, '../voice-service.js')) {
    if (request === './utils.js') {
      const real = origLoad.apply(this, arguments)
      return Object.assign({}, real, {
        smartWalletDeduct: async () => ({ success: _stubs.deductOk, currency: 'usd', charged: 0, usdBal: 0 }),
        smartWalletCheck: async () => ({ ok: true, usdBal: 100 }),
        getBalance: async () => ({ usdBal: 0, ngnBal: 0 }),
      })
    }
  }
  return origLoad.apply(this, arguments)
}

const voice = require('../voice-service.js')

// Build the fakest walletOf we can — only s.db.collection('walletLedger').insertOne is used
const fakeWalletLedger = {
  insertOne: async (doc) => { _stubs.inserted.push(doc); return { acknowledged: true } },
}
const fakeDb = { collection: (n) => (n === 'walletLedger' ? fakeWalletLedger : { insertOne: async () => ({}) }) }
const fakeWalletOf = { s: { db: fakeDb } }

const fakeBot = {
  sendMessage: async (chatId, msg) => { _stubs.dms.push({ chatId, msg }); return { message_id: 1 } },
}
const fakeNotifyAdmin = async (msg) => { _stubs.adminMsgs.push(msg) }

voice.initVoiceService({
  bot: fakeBot,
  phoneNumbersOf: { findOne: async () => null },
  phoneLogs: { insertOne: async () => ({}) },
  telnyxApi: {},
  telnyxResources: {},
  translation: () => null,
  ivrAnalytics: {},
  walletOf: fakeWalletOf,
  payments: {},
  nanoid: () => 'mockref',
  state: { findOne: async () => ({ userLanguage: 'en' }) },
  loyalty: null,
  db: fakeDb,
  notifyAdmin: fakeNotifyAdmin,
})

let pass = 0, fail = 0
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { fail++; console.log(`  ✗ ${name}\n    ${e.message}`) }
}

;(async () => {
  console.log('billing-leak-visibility.test.js\n')

  // Reset state
  _stubs.inserted = []; _stubs.dms = []; _stubs.adminMsgs = []

  // ── Case 1: insufficient funds → ledger row + DM + admin notification ──
  _stubs.deductOk = false
  await test('insufficient wallet writes billing_failed ledger row', async () => {
    const r = await voice.billCallMinutesUnified('chat1', '+18336140410', 1, 'sip:foo@sip.telnyx.com', 'Bridge_Transfer')
    if (!r) throw new Error('billCallMinutesUnified returned nothing')
    const billingFailed = _stubs.inserted.filter(d => d.type === 'billing_failed')
    if (billingFailed.length !== 1) throw new Error(`expected 1 billing_failed row, got ${billingFailed.length}`)
    if (!billingFailed[0].owedUsd) throw new Error('owedUsd not set')
    if (billingFailed[0].chatId !== 'chat1') throw new Error('chatId mismatch')
  })

  await test('insufficient wallet DMs the user', async () => {
    if (_stubs.dms.length < 1) throw new Error(`expected ≥1 DM, got ${_stubs.dms.length}`)
    const lastDm = _stubs.dms[_stubs.dms.length - 1]
    if (lastDm.chatId !== 'chat1') throw new Error('DM chatId mismatch')
    if (!/wallet|Outbound/i.test(lastDm.msg)) throw new Error('DM body unexpected')
  })

  await test('insufficient wallet notifies admin', async () => {
    if (_stubs.adminMsgs.length < 1) throw new Error(`expected ≥1 admin msg, got ${_stubs.adminMsgs.length}`)
    if (!/BillingLeak/i.test(_stubs.adminMsgs[0])) throw new Error('admin msg missing BillingLeak tag')
  })

  // ── Case 2: successful deduct → NO billing_failed row, NO admin notify ──
  _stubs.inserted = []; _stubs.dms = []; _stubs.adminMsgs = []
  _stubs.deductOk = true
  await test('successful deduct does NOT trigger leak path', async () => {
    await voice.billCallMinutesUnified('chat2', '+18336140410', 1, 'sip:foo@sip.telnyx.com', 'Bridge_Transfer')
    const billingFailed = _stubs.inserted.filter(d => d.type === 'billing_failed')
    if (billingFailed.length !== 0) throw new Error(`expected 0 billing_failed rows, got ${billingFailed.length}`)
    if (_stubs.adminMsgs.length !== 0) throw new Error(`expected 0 admin msgs, got ${_stubs.adminMsgs.length}`)
  })

  console.log(`\n${pass}/${pass + fail} passed`)
  process.exit(fail ? 1 : 0)
})()
