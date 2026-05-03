/**
 * Regression test: cpanel-health hysteresis.
 *
 * Context: on 2026-05-03 15:26:48 UTC a single 2-second HTTPS HEAD timeout
 * to the whm-api.hostbay.io tunnel caused a false-positive admin alert
 * ("cPanel/WHM control plane down — ETIMEDOUT") and paused the job queue
 * for 20 seconds, even though the very next probe (at 15:27:07) succeeded
 * and WHM was healthy throughout. Users were unaffected but the alert
 * spammed the admin chat and the queue pause delayed any in-flight job.
 *
 * Fix: require DOWN_THRESHOLD_MISSES=2 consecutive probe misses before
 * firing the `down` event, and raise PROBE_TIMEOUT_MS from 2000 → 6000ms.
 *
 * This test drives cpanel-health with a stubbed probe function to validate:
 *   - single miss → no 'down' emit, no state transition
 *   - two consecutive misses → 'down' emitted exactly once
 *   - subsequent success while DOWN → 'up' emitted exactly once
 *   - up/miss/miss/miss sequence → still only one 'down' event
 */

const assert = require('assert')
const path = require('path')

// Mock env BEFORE requiring the module so WHM_API_URL is picked up.
process.env.WHM_HOST = '209.38.241.9'
process.env.WHM_API_URL = 'https://whm-api.hostbay.io'

// Replace https.request so we can deterministically make probes pass/fail.
const https = require('https')
let probeResult = true   // true = succeed, false = timeout
const origRequest = https.request
https.request = function (url, opts, cb) {
  // Create a fake request object that implements the minimum surface used
  // by cpanel-health._tunnelHttpsProbe.
  const listeners = {}
  const req = {
    on(ev, fn) { listeners[ev] = fn; return req },
    end() {
      setImmediate(() => {
        if (probeResult) {
          // Simulate a successful 401 response
          const res = { statusCode: 401, resume() {} }
          cb(res)
        } else if (listeners.timeout) {
          listeners.timeout()
        } else if (listeners.error) {
          const e = new Error('timeout')
          e.code = 'ETIMEDOUT'
          listeners.error(e)
        }
      })
    },
    destroy() {
      if (listeners.error) {
        const e = new Error('socket hang up')
        e.code = 'ETIMEDOUT'
        listeners.error(e)
      }
    },
  }
  return req
}

// Fresh-require so our mocks take effect
delete require.cache[require.resolve(path.resolve(__dirname, '../cpanel-health.js'))]
const cpHealth = require(path.resolve(__dirname, '../cpanel-health.js'))

function run(name, fn) {
  return (async () => {
    try { await fn(); console.log(`✓ ${name}`) }
    catch (e) { console.error(`✗ ${name}\n   ${e.message}\n   ${e.stack}`); process.exit(1) }
  })()
}

;(async () => {
  const down = []
  const up = []
  const attach = () => {
    cpHealth.onDown(p => down.push(p))
    cpHealth.onUp(p => up.push(p))
  }
  attach()

  // 1. First probe: success → no events
  probeResult = true
  cpHealth._resetCache(); attach()
  down.length = 0; up.length = 0
  await cpHealth.isWhmReachable({ force: true })
  await run('First success emits no events', () => {
    assert.strictEqual(down.length, 0, 'no down event')
    assert.strictEqual(up.length, 0, 'no up event (was never down)')
  })

  // 2. One failed probe → NO down event (hysteresis)
  cpHealth._resetCache(); attach()
  probeResult = true; await cpHealth.isWhmReachable({ force: true })
  down.length = 0; up.length = 0
  probeResult = false
  await cpHealth.isWhmReachable({ force: true })
  await run('Single probe miss does NOT fire down event (hysteresis)', () => {
    assert.strictEqual(down.length, 0,
      `expected 0 down events after 1 miss, got ${down.length}: ${JSON.stringify(down)}`)
  })

  // 3. Two consecutive failures → exactly one down event
  probeResult = false
  await cpHealth.isWhmReachable({ force: true })
  await run('Two consecutive probe misses fire down event exactly once', () => {
    assert.strictEqual(down.length, 1,
      `expected 1 down event after 2 consecutive misses, got ${down.length}`)
    assert.strictEqual(down[0].reason, 'ETIMEDOUT')
  })

  // 4. A third miss does NOT re-fire the down event
  probeResult = false
  await cpHealth.isWhmReachable({ force: true })
  await run('Third consecutive miss does NOT duplicate the down event', () => {
    assert.strictEqual(down.length, 1,
      `expected still 1 down event after 3 misses, got ${down.length}`)
  })

  // 5. Successful probe after being DOWN → up event fires exactly once
  probeResult = true
  await cpHealth.isWhmReachable({ force: true })
  await run('Recovery fires up event exactly once', () => {
    assert.strictEqual(up.length, 1,
      `expected 1 up event on recovery, got ${up.length}`)
  })

  // 6. Another success does not duplicate the up event
  await cpHealth.isWhmReachable({ force: true })
  await run('Subsequent success does NOT duplicate up event', () => {
    assert.strictEqual(up.length, 1,
      `expected still 1 up event, got ${up.length}`)
  })

  // 7. Flapping scenario — miss, success, miss, success: zero down events
  cpHealth._resetCache(); attach()
  down.length = 0; up.length = 0
  probeResult = true; await cpHealth.isWhmReachable({ force: true })
  probeResult = false; await cpHealth.isWhmReachable({ force: true })  // 1st miss
  probeResult = true; await cpHealth.isWhmReachable({ force: true })   // recovered
  probeResult = false; await cpHealth.isWhmReachable({ force: true })  // 1st miss again
  probeResult = true; await cpHealth.isWhmReachable({ force: true })   // recovered
  await run('Flapping misses (1 miss → success → 1 miss → success) emits ZERO down events', () => {
    assert.strictEqual(down.length, 0,
      `flapping should not alert — got ${down.length} down events`)
    assert.strictEqual(up.length, 0,
      `flapping should not alert — got ${up.length} up events`)
  })

  // Restore
  https.request = origRequest
  console.log('\nAll cpanel-health hysteresis tests passed.')
})().catch(e => { console.error(e); process.exit(1) })
