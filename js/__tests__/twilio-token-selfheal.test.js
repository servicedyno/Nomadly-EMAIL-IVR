/**
 * Test for the Twilio sub-account token self-heal wrapper (added 2026-02).
 *
 * Context:
 *   When a Twilio sub-account's auth token is rotated (manually for security,
 *   or automatically), every operation we issue with the cached token returns
 *   HTTP 401 / code 20003. Previously this caused silent renewal & release
 *   failures. We now wrap sub-account operations in `withSubAccountSelfHeal`
 *   which catches auth errors, fetches the live token via the main account,
 *   retries the operation, and surfaces the new token for DB persistence.
 *
 * What this test verifies (no real network calls — twilio npm module is
 * replaced in require.cache with a stub):
 *   • Stored token works on first try → ok:true, no rotation
 *   • Stored token 401s, live token differs → ok:true, tokenRotated:true
 *   • Stored token 401s, live token IS the same as stored → ok:false,
 *     tokenRotated:false (not a rotation, surface error)
 *   • Non-auth error → not retried, propagated
 *   • Missing subSid → ok:false, no Twilio call
 */

require('dotenv').config({ path: '/app/backend/.env' })

;(async () => {
  // ── Stub the `twilio` npm module BEFORE requiring twilio-service ──
  // Behaviour is driven by the `scenarioBehaviour` map keyed by the token
  // that the caller of `incomingPhoneNumbers(sid).remove()` is using.
  // This lets us model "stored fails, live succeeds" without comparing tokens.
  let scenarioBehaviour = {} // token → 'ok' | 'auth-fail' | 'not-found'
  let liveTokenForMain = 'LIVE_TOKEN'
  let storedRemoveCalls = 0
  let liveRemoveCalls = 0
  let mainFetchCalls = 0

  function buildTwilioClient(sid, token) {
    return {
      _sid: sid, _token: token,
      incomingPhoneNumbers: (_numberSid) => ({
        remove: async () => {
          const behaviour = scenarioBehaviour[token] || 'ok'
          if (token === liveTokenForMain) liveRemoveCalls++
          else storedRemoveCalls++
          if (behaviour === 'auth-fail') {
            const err = new Error('Authentication failed'); err.status = 401; err.code = 20003
            throw err
          }
          if (behaviour === 'not-found') {
            const err = new Error('not found'); err.status = 404
            throw err
          }
          return // success
        },
      }),
      api: {
        v2010: {
          accounts: (subSid) => ({
            fetch: async () => {
              mainFetchCalls++
              return { sid: subSid, authToken: liveTokenForMain, friendlyName: 'mock', status: 'active' }
            },
          }),
        },
      },
    }
  }

  // Replace the twilio module export so that calling `twilio(sid, token)`
  // builds our stub client.
  const twilioModulePath = require.resolve('twilio')
  require.cache[twilioModulePath] = {
    id: twilioModulePath, filename: twilioModulePath, loaded: true,
    exports: (sid, token) => buildTwilioClient(sid, token),
  }

  const svc = require('/app/js/twilio-service.js')

  let pass = 0, fail = 0
  function reset() { scenarioBehaviour = {}; storedRemoveCalls = 0; liveRemoveCalls = 0; mainFetchCalls = 0 }
  async function test(name, fn) {
    reset()
    try { await fn(); pass++; console.log('  ✓ ' + name) }
    catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + (e.stack || e.message)) }
  }
  function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert failed') }

  console.log('twilio-token-selfheal.test.js\n')

  await test('stored token works on first try → no rotation', async () => {
    scenarioBehaviour = { STORED: 'ok' }
    const r = await svc.withSubAccountSelfHeal('ACsub', 'STORED', 'release',
      c => c.incomingPhoneNumbers('PN1').remove())
    assert(r.ok, 'should succeed')
    assert(!r.tokenRotated, 'should not flag rotated')
    assert(r.liveToken === 'STORED', 'token returned unchanged')
    assert(mainFetchCalls === 0, 'must NOT call main account on success')
    assert(storedRemoveCalls === 1 && liveRemoveCalls === 0, 'stored attempted once, live not at all')
  })

  await test('stored 401 + live differs → self-heal succeeds, tokenRotated:true', async () => {
    liveTokenForMain = 'LIVE_v2'
    scenarioBehaviour = { OLD_STORED: 'auth-fail', LIVE_v2: 'ok' }
    const r = await svc.withSubAccountSelfHeal('ACsub', 'OLD_STORED', 'release',
      c => c.incomingPhoneNumbers('PN1').remove())
    assert(r.ok, 'should succeed via self-heal: ' + r.error)
    assert(r.tokenRotated === true, 'tokenRotated must be true')
    assert(r.liveToken === 'LIVE_v2', 'liveToken should be returned')
    assert(storedRemoveCalls === 1, 'stored attempted exactly once')
    assert(liveRemoveCalls === 1, 'live attempted exactly once')
    assert(mainFetchCalls === 1, 'main queried exactly once')
  })

  await test('stored 401 + live matches stored → not a rotation, surface error', async () => {
    liveTokenForMain = 'SAME'
    scenarioBehaviour = { SAME: 'auth-fail' }
    // The "live === stored" branch in code must NOT retry. So we expect only
    // a single remove() invocation across both counters.
    const r = await svc.withSubAccountSelfHeal('ACsub', 'SAME', 'release',
      c => c.incomingPhoneNumbers('PN1').remove())
    assert(!r.ok, 'should fail')
    assert(r.tokenRotated === false, 'tokenRotated must be false (live==stored)')
    assert(mainFetchCalls === 1, 'main fetched once to compare')
    assert((storedRemoveCalls + liveRemoveCalls) === 1, 'must invoke remove() exactly ONCE (no retry when live==stored)')
  })

  await test('non-auth error → no retry, propagated', async () => {
    liveTokenForMain = 'LIVE_v3'
    scenarioBehaviour = { STORED: 'not-found' }
    const r = await svc.withSubAccountSelfHeal('ACsub', 'STORED', 'release',
      c => c.incomingPhoneNumbers('PN1').remove())
    assert(!r.ok, 'should fail')
    assert(!r.tokenRotated, 'must not flag rotation')
    assert(/not found/i.test(r.error), 'error message preserved: ' + r.error)
    assert(mainFetchCalls === 0, 'must NOT call main on non-auth error')
  })

  await test('missing subSid → ok:false, no Twilio call', async () => {
    const r = await svc.withSubAccountSelfHeal(null, 'STORED', 'release',
      c => c.incomingPhoneNumbers('PN1').remove())
    assert(!r.ok, 'should fail')
    assert(/missing/i.test(r.error), 'error should mention missing')
    assert(storedRemoveCalls === 0 && liveRemoveCalls === 0, 'no Twilio calls made')
  })

  console.log(`\nResults: ${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error(e); process.exit(1) })
