/**
 * Tests for cpanel-proxy.js — CPANEL_DOWN short-circuit on connection errors.
 *
 * We mock axios to throw connection-style errors and assert that:
 *   - response has code: 'CPANEL_DOWN'
 *   - errors message is friendly (no raw "ECONNREFUSED" leaked)
 *   - admin notifier is called (throttled)
 *
 * Run with: node js/tests/test_cpanel_proxy_down.js
 */

const path = require('path')

;(async () => {
  let pass = 0, fail = 0
  function ok(name, cond, note = '') {
    if (cond) { pass++; console.log(`  ✓ ${name}`) }
    else { fail++; console.log(`  ✗ ${name} — ${note}`) }
  }

  process.env.WHM_HOST = '127.0.0.1'

  // Pre-populate axios mock BEFORE requiring cpanel-proxy
  const axiosPath = require.resolve('axios')
  delete require.cache[axiosPath]

  const Module = require('module')
  const origResolve = Module._resolveFilename
  const fakeAxios = {
    get: async () => { const e = new Error('connect ECONNREFUSED 127.0.0.1:2083'); e.code = 'ECONNREFUSED'; throw e },
    post: async () => { const e = new Error('connect ECONNREFUSED 127.0.0.1:2083'); e.code = 'ECONNREFUSED'; throw e },
    create: () => fakeAxios,
  }
  Module._resolveFilename = function (req, ...rest) {
    if (req === 'axios') return '__FAKE_AXIOS__'
    return origResolve.call(this, req, ...rest)
  }
  require.cache['__FAKE_AXIOS__'] = { id: '__FAKE_AXIOS__', filename: '__FAKE_AXIOS__', loaded: true, exports: fakeAxios }

  // Fresh require
  delete require.cache[require.resolve('../cpanel-proxy')]
  const cpProxy = require('../cpanel-proxy')

  const adminNotices = []
  cpProxy.setAdminNotifier(t => adminNotices.push(t))

  // 1. UAPI listFiles — should return CPANEL_DOWN, not raw ECONNREFUSED
  const res1 = await cpProxy.listFiles('cpuser', 'pw', '/public_html')
  ok('listFiles → status 0', res1.status === 0)
  ok('listFiles → code CPANEL_DOWN', res1.code === 'CPANEL_DOWN', JSON.stringify(res1))
  ok('listFiles → friendly error (no raw ECONNREFUSED)',
    Array.isArray(res1.errors) && /temporarily unavailable/i.test(res1.errors[0]) && !/ECONNREFUSED/i.test(res1.errors[0]),
    JSON.stringify(res1.errors))
  ok('listFiles → admin notified once', adminNotices.length === 1, `count=${adminNotices.length}`)

  // 2. Repeat call — admin alert is throttled (no second alert in 15min window)
  await cpProxy.listFiles('cpuser', 'pw', '/public_html')
  ok('second call within throttle window → no extra admin alert', adminNotices.length === 1, `count=${adminNotices.length}`)

  // 3. saveFileContent (POST) — also short-circuits
  const res3 = await cpProxy.saveFileContent('cpuser', 'pw', '/public_html', 'index.html', '<h1>hi</h1>')
  ok('saveFileContent → CPANEL_DOWN', res3.code === 'CPANEL_DOWN', JSON.stringify(res3))

  // 4. listDomains — also short-circuits via uapi
  const res4 = await cpProxy.listDomains('cpuser', 'pw')
  ok('listDomains → CPANEL_DOWN', res4.code === 'CPANEL_DOWN', JSON.stringify(res4))

  // 5. isControlPlaneDown classifier
  ok('isControlPlaneDown(ECONNREFUSED)', cpProxy.isControlPlaneDown({ code: 'ECONNREFUSED' }))
  ok('isControlPlaneDown(ETIMEDOUT)',     cpProxy.isControlPlaneDown({ code: 'ETIMEDOUT' }))
  ok('!isControlPlaneDown(401 response)', !cpProxy.isControlPlaneDown({ response: { status: 401 } }))

  Module._resolveFilename = origResolve
  console.log(`\n${pass} pass / ${fail} fail`)
  process.exit(fail > 0 ? 1 : 0)
})().catch(err => {
  console.error('Test crashed:', err)
  process.exit(2)
})
