/**
 * Tests for cpanel-health.js — TCP probe + license-check caching.
 *
 * Run with: node js/tests/test_cpanel_health.js
 */

const net = require('net')
const path = require('path')
const assert = require('assert')

// Ensure we don't pull in stray env from a real .env in this test process
process.env.WHM_HOST = '127.0.0.1'

// Spawn a local TCP server we can stop/start to simulate WHM up/down
function startServer(port) {
  return new Promise(resolve => {
    const srv = net.createServer(sock => sock.end())
    srv.listen(port, '127.0.0.1', () => resolve(srv))
  })
}
function stopServer(srv) { return new Promise(r => srv.close(() => r())) }

// Use a high non-default port; monkey-patch the module to read it.
const TEST_PORT = 28799
const HEALTH_PATH = path.resolve(__dirname, '..', 'cpanel-health.js')

// Patch the module's WHM_PORT by re-requiring through a tiny shim — but simpler:
// we'll edit the in-memory module after require by running through the public API.
// The probe uses WHM_PORT = 2087 hardcoded; for tests we'll temporarily redirect
// by overriding the cached _tcpProbe via require-cache trick. Instead, the test
// just confirms that:
//   - on-probe failure (no listener) returns reachable=false
//   - on-probe success (listener) returns reachable=true
//   - the result is cached per the TTL
// To do that we use port 2087 directly: bind a listener on 2087.

;(async () => {
  let pass = 0, fail = 0
  function ok(name, cond, note = '') {
    if (cond) { pass++; console.log(`  ✓ ${name}`) }
    else { fail++; console.log(`  ✗ ${name} — ${note}`) }
  }

  // Fresh require to start with empty cache
  delete require.cache[require.resolve('../cpanel-health')]
  const cpHealth = require('../cpanel-health')
  cpHealth._resetCache()

  // 1. With no listener → reachable=false
  let reachable = await cpHealth.isWhmReachable({ force: true })
  ok('initial probe (no listener) → false', reachable === false)

  // 2. Start listener → reachable=true after force re-probe
  let srv
  try {
    srv = await startServer(2087)
  } catch (e) {
    console.log(`  ⚠ skipping live-listener tests: cannot bind 2087 (${e.code})`)
    console.log(`\n${pass} pass / ${fail} fail`)
    process.exit(fail > 0 ? 1 : 0)
  }

  reachable = await cpHealth.isWhmReachable({ force: true })
  ok('with listener → true', reachable === true)

  // 3. Cached read should be true without forcing
  reachable = cpHealth.isWhmReachableCached()
  ok('cached read → true', reachable === true)

  // 4. State-transition listener fires on down→up
  let upFired = 0, downFired = 0
  cpHealth.onUp(() => { upFired++ })
  cpHealth.onDown(() => { downFired++ })

  await stopServer(srv)
  await cpHealth.isWhmReachable({ force: true })
  ok('downward transition emits onDown', downFired === 1, `downFired=${downFired}`)

  srv = await startServer(2087)
  await cpHealth.isWhmReachable({ force: true })
  ok('upward transition emits onUp', upFired === 1, `upFired=${upFired}`)

  // 5. getStatus snapshot shape
  const status = await cpHealth.getStatus({ refresh: false })
  ok('getStatus has summary', typeof status.summary === 'string')
  ok('getStatus has reachable', typeof status.reachable === 'boolean')

  await stopServer(srv)

  console.log(`\n${pass} pass / ${fail} fail`)
  process.exit(fail > 0 ? 1 : 0)
})().catch(err => {
  console.error('Test crashed:', err)
  process.exit(2)
})
