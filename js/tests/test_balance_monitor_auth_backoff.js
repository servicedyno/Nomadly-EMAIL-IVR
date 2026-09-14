/**
 * Verifies the BalanceMonitor auth-error backoff: when a provider's key is
 * rejected (HTTP 401/403), the monitor pauses that provider so it stops
 * logging the same error every cycle (fix for the stale-Telnyx-key 401 noise).
 *
 * Run: node js/tests/test_balance_monitor_auth_backoff.js  (exit 0 = pass)
 */
const axios = require('axios')

let telnyxCalls = 0
let twilioCalls = 0
axios.get = async (url) => {
  if (String(url).includes('telnyx')) telnyxCalls++
  else if (String(url).includes('twilio')) twilioCalls++
  const e = new Error('Unauthorized')
  e.response = { status: 401 }
  throw e
}

// Keys present so the checks actually run; no admin so no alert send is attempted.
process.env.TELNYX_API_KEY = 'KEYtest'
process.env.TWILIO_ACCOUNT_SID = 'ACtest'
process.env.TWILIO_AUTH_TOKEN = 'toktest'
delete process.env.TELEGRAM_ADMIN_CHAT_ID

const bm = require('../balance-monitor.js')

let pass = 0, fail = 0
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}

;(async () => {
  await bm.checkAllBalances()
  const t1 = telnyxCalls, w1 = twilioCalls
  await bm.checkAllBalances()
  const t2 = telnyxCalls, w2 = twilioCalls

  check('Telnyx tried exactly once on first check (401 = no retry)', t1 === 1, `got ${t1}`)
  check('Twilio tried exactly once on first check (401 = no retry)', w1 === 1, `got ${w1}`)
  check('Telnyx NOT polled again after key rejected (paused)', t2 === t1, `first=${t1} second=${t2}`)
  check('Twilio NOT polled again after key rejected (paused)', w2 === w1, `first=${w1} second=${w2}`)

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
})()
