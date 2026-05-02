/* global process */
/**
 * End-to-end test for _whmRetry via autoWhitelistIP().
 * Spins a tiny HTTP server that:
 *   - Hangs the first request to each WHM endpoint (forces axios timeout)
 *   - Answers the second request with a success payload
 * Then calls autoWhitelistIP() and asserts that cPHulk ended up `true`
 * (i.e. the retry fired and succeeded).
 */

const http = require('http')
const { URL } = require('url')

process.env.WHM_HOST = '127.0.0.1'
process.env.WHM_TOKEN = 'test-token'
// Use an https-free local target by pretending a tunnel URL points at our HTTP server.
// whm-service builds baseURL from WHM_API_URL when set, with no TLS wrapper — but the
// axios client in whm-service always uses https. So instead we stub the `axios.create`'d
// instance's baseURL + httpsAgent. Cleanest path: intercept network with nock? No. Use
// the built-in `axios.defaults.adapter` replacement.

const axios = require('axios')
let callCounts = {}
axios.defaults.adapter = async function fakeAdapter(config) {
  const u = new URL(config.url, config.baseURL)
  const path = u.pathname
  callCounts[path] = (callCounts[path] || 0) + 1
  const attempt = callCounts[path]

  // First call to each of /json-api/<fn> : simulate network timeout
  if (attempt === 1 && /\/(create_cphulk_record|csf_allow|add_host_access)$/.test(path)) {
    const err = new Error('timeout of 20000ms exceeded')
    err.code = 'ECONNABORTED'
    throw err
  }

  // Second call onwards: success
  const fn = path.split('/').pop()
  let body = { metadata: { result: 1 } }
  if (fn === 'csf_allow') body = { metadata: { result: 1 } }
  if (fn === 'add_host_access') body = { metadata: { result: 1 } }
  return {
    data: body,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: {},
  }
}

// Also stub ipify — autoWhitelistIP() fetches it first
const originalRequest = axios.request
// Override specific base URLs by intercepting the adapter above for any URL
const originalAdapter = axios.defaults.adapter
axios.defaults.adapter = async function masterAdapter(config) {
  const fullUrl = config.baseURL ? new URL(config.url, config.baseURL).href : config.url
  if (fullUrl.includes('ipify.org')) {
    return {
      data: '203.0.113.99',
      status: 200, statusText: 'OK', headers: {}, config, request: {},
    }
  }
  return originalAdapter(config)
}

;(async () => {
  const whm = require('../whm-service.js')
  const res = await whm.autoWhitelistIP()
  console.log('autoWhitelistIP result:', JSON.stringify(res, null, 2))
  console.log('call counts:', callCounts)

  let pass = 0, fail = 0
  const ok = (label, cond) => { if (cond) { pass++; console.log(`  ✓ ${label}`) } else { fail++; console.log(`  ✗ ${label}`) } }

  ok('success == true', res.success === true)
  ok('ip detected', res.ip === '203.0.113.99')
  ok('cPHulk retried and succeeded', res.cphulk === true)
  ok('/create_cphulk_record called twice (1 timeout + 1 retry)', callCounts['/create_cphulk_record'] === 2)
  ok('/csf_allow called twice', callCounts['/csf_allow'] === 2)
  ok('/add_host_access called twice', callCounts['/add_host_access'] === 2)

  console.log(`\n${pass} pass / ${fail} fail`)
  process.exit(fail ? 1 : 0)
})().catch(e => { console.error('ERR:', e); process.exit(2) })
