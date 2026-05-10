/**
 * tests/test_balance_monitor.js
 *
 * Verifies the balance-monitor.js fixes:
 *   1. Successful Twilio call after a transient 5xx (retry works).
 *   2. Persistent 502 → no alert on FIRST occurrence (transient; suppressed).
 *   3. Persistent 502 on TWO consecutive checks → "API unreachable" alert
 *      with the correct wording (NOT "credentials are invalid").
 *   4. 401 from Twilio → "CREDENTIALS REJECTED" alert immediately.
 */

const Module = require('module')

// ── axios mock ──
const axiosCalls = []
let nextResponse = null  // can be a function or an array of responses to consume in order
const origRequire = Module.prototype.require
Module.prototype.require = function (req) {
  if (req === 'axios') {
    return {
      get: async (url, opts) => {
        axiosCalls.push({ url, opts })
        let resp = typeof nextResponse === 'function' ? nextResponse(url) : (Array.isArray(nextResponse) ? nextResponse.shift() : nextResponse)
        if (resp && resp.throws) {
          const err = new Error(resp.message || 'mock err')
          if (resp.status) err.response = { status: resp.status, data: resp.data }
          if (resp.code) err.code = resp.code
          throw err
        }
        return resp || { status: 200, data: { balance: '12.30', currency: 'USD' } }
      },
    }
  }
  return origRequire.apply(this, arguments)
}

process.env.TWILIO_ACCOUNT_SID = 'ACtest'
process.env.TWILIO_AUTH_TOKEN = 'token'
process.env.TELNYX_API_KEY = 'tk'
process.env.TELEGRAM_ADMIN_CHAT_ID = '1'

const bm = require('../balance-monitor.js')

const sentMessages = []
const fakeBot = {
  sendMessage: async (chat, msg, opts) => { sentMessages.push({ chat, msg, opts }); return { message_id: 1 } },
}
bm.initBalanceMonitor(fakeBot)

;(async () => {
  let allOk = true

  // ── TEST 1: 502 then 200 → recovery, no alert ──
  axiosCalls.length = 0; sentMessages.length = 0
  // checkTelnyxBalance is called first, then checkTwilioBalance.
  // Make Telnyx return 200; Twilio: first call 502, second 200.
  let twilioCalls = 0
  nextResponse = (url) => {
    if (url.includes('telnyx')) return { status: 200, data: { data: { balance: '50.00', currency: 'USD' } } }
    twilioCalls++
    if (twilioCalls === 1) return { throws: true, status: 502, message: 'Bad Gateway' }
    return { status: 200, data: { balance: '12.30', currency: 'USD' } }
  }
  const r1 = await bm.checkAllBalances()
  console.log('TEST 1 — transient 502 then 200:')
  console.log('  results:', JSON.stringify(r1.map(r => ({ p: r.provider, bal: r.balance, err: r.error }))))
  console.log('  alerts sent:', sentMessages.length, '(expect 0 — recovered)')
  const ok1 = r1.find(r => r.provider === 'Twilio')?.balance === 12.30 && sentMessages.length === 0
  console.log('  →', ok1 ? '✅ PASS' : '❌ FAIL'); if (!ok1) allOk = false

  // ── TEST 2: 502 always (3 retries) on 1st check → suppressed ──
  axiosCalls.length = 0; sentMessages.length = 0
  twilioCalls = 0
  nextResponse = (url) => {
    if (url.includes('telnyx')) return { status: 200, data: { data: { balance: '50.00', currency: 'USD' } } }
    return { throws: true, status: 502, message: 'Bad Gateway' }
  }
  const r2 = await bm.checkAllBalances()
  console.log('\nTEST 2 — single 502 storm (1st check) — SUPPRESSED:')
  console.log('  alerts sent:', sentMessages.length, '(expect 0 — first time, suppressed)')
  console.log('  Twilio result:', JSON.stringify(r2.find(r => r.provider === 'Twilio')))
  const twilioRes2 = r2.find(r => r.provider === 'Twilio')
  const ok2 = sentMessages.length === 0 && twilioRes2.errorCategory === 'transient'
  console.log('  →', ok2 ? '✅ PASS' : '❌ FAIL'); if (!ok2) allOk = false

  // ── TEST 3: 502 again on SECOND consecutive check → alert with correct wording ──
  axiosCalls.length = 0; sentMessages.length = 0
  // (counter from TEST 2 still at 1 → this is consecutive #2)
  const r3 = await bm.checkAllBalances()
  console.log('\nTEST 3 — 2nd consecutive 502 → ALERT (transient wording):')
  console.log('  alerts sent:', sentMessages.length, '(expect 1)')
  if (sentMessages.length) console.log('  alert msg:', sentMessages[0].msg.replace(/\n/g, ' / ').slice(0, 220))
  const ok3 = sentMessages.length === 1
    && sentMessages[0].msg.includes('API unreachable')
    && !sentMessages[0].msg.includes('credentials are invalid')
    && !sentMessages[0].msg.includes('account is suspended')
  console.log('  →', ok3 ? '✅ PASS' : '❌ FAIL'); if (!ok3) allOk = false

  // ── TEST 4: 401 → IMMEDIATE alert with "CREDENTIALS REJECTED" wording ──
  axiosCalls.length = 0; sentMessages.length = 0
  // Reset counter by getting a successful response first
  nextResponse = (url) => {
    if (url.includes('telnyx')) return { status: 200, data: { data: { balance: '50.00', currency: 'USD' } } }
    return { status: 200, data: { balance: '12.30', currency: 'USD' } }
  }
  await bm.checkAllBalances()  // recovers, clears counter
  sentMessages.length = 0

  // Now simulate a real 401
  nextResponse = (url) => {
    if (url.includes('telnyx')) return { status: 200, data: { data: { balance: '50.00', currency: 'USD' } } }
    return { throws: true, status: 401, message: 'Unauthorized' }
  }
  // Need to also override dedup for fresh test (use new provider key prefix)
  const r4 = await bm.checkAllBalances()
  console.log('\nTEST 4 — 401 → IMMEDIATE alert with "CREDENTIALS REJECTED":')
  console.log('  alerts sent:', sentMessages.length, '(expect 1)')
  if (sentMessages.length) console.log('  alert msg:', sentMessages[0].msg.replace(/\n/g, ' / ').slice(0, 220))
  const ok4 = sentMessages.length === 1
    && sentMessages[0].msg.includes('CREDENTIALS REJECTED')
    && sentMessages[0].msg.includes('HTTP 401')
  console.log('  →', ok4 ? '✅ PASS' : '❌ FAIL'); if (!ok4) allOk = false

  console.log('\n══ FINAL: ' + (allOk ? '✅ ALL TESTS PASS' : '❌ SOMETHING FAILED'))
  process.exit(allOk ? 0 : 1)
})()
