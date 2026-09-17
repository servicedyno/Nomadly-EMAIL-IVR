// Regression: Contabo auth circuit breaker. When keycloak rejects the
// credentials (prod: invalid_client 101×/48h), getAccessToken must trip a
// breaker so subsequent calls FAST-FAIL without hitting keycloak or spamming
// the logs. Deterministic — axios.post is stubbed so no network/keycloak call.
const axios = require('axios')

let pass = 0, fail = 0
function check(n, c) { if (c) { pass++; console.log('  ✅ ' + n) } else { fail++; console.log('  ❌ ' + n) } }

// Stub keycloak: always reject with invalid_client, and count real calls.
let postCalls = 0
const origPost = axios.post
axios.post = async () => {
  postCalls++
  const e = new Error('Request failed with status code 401')
  e.response = { data: { error: 'invalid_client', error_description: 'Invalid client or Invalid client credentials' } }
  throw e
}

// Capture console.error to count how many times the breaker logs its reason.
let openLogs = 0
const origErr = console.error
console.error = (...args) => { if (String(args[0] || '').includes('Auth circuit OPEN')) openLogs++ }

;(async () => {
  const contabo = require('../contabo-service.js')

  console.log('\n[1] First token fetch → trips breaker, throws VPS_AUTH_DOWN')
  let err1 = null
  try { await contabo.__getAccessTokenForTest() } catch (e) { err1 = e }
  check('threw', !!err1)
  check('typed code VPS_AUTH_DOWN', err1 && err1.code === 'VPS_AUTH_DOWN')
  check('keycloak hit exactly once', postCalls === 1)
  check('isAuthHealthy() → false', contabo.isAuthHealthy().healthy === false)

  console.log('\n[2] Second fetch while breaker open → fast-fail, NO keycloak call')
  let err2 = null
  try { await contabo.__getAccessTokenForTest() } catch (e) { err2 = e }
  check('threw again', !!err2)
  check('typed code VPS_AUTH_DOWN', err2 && err2.code === 'VPS_AUTH_DOWN')
  check('keycloak NOT hit again (still 1)', postCalls === 1)

  console.log('\n[3] Third fetch → still suppressed (no keycloak, no re-log)')
  try { await contabo.__getAccessTokenForTest() } catch (e) { /* expected */ }
  check('keycloak still not hit (1 total)', postCalls === 1)

  console.log('\n[4] Breaker reason logged exactly ONCE across 3 failing calls')
  check('openLogs === 1', openLogs === 1)

  console.log('\n[5] isAuthHealthy reports a positive minutesLeft while open')
  check('minutesLeft > 0', (contabo.isAuthHealthy().minutesLeft || 0) > 0)

  axios.post = origPost
  console.error = origErr
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { axios.post = origPost; console.error = origErr; console.log('FATAL', e); process.exit(1) })
