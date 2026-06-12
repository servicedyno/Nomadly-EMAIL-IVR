/* global process */
/**
 * Regression test: stealth-mode silent cloak.
 * Verifies:
 *  1. The generated worker still parses.
 *  2. calculateBotScore scoring (extracted via vm sandbox) produces the
 *     expected scores for canonical request fixtures — modern Chrome stays
 *     under the stealth threshold (70), known bot patterns clear it.
 *  3. SCANNER_REDIRECT_TARGETS / pickRedirectTarget is reachable.
 */

const assert = require('assert')
const vm = require('vm')
const ars = require('../anti-red-service')

function buildSandbox(script) {
  // Strip the addEventListener call so the script loads as a library.
  const lib = script.replace(/^addEventListener\([^]*?\);\s*/m, '')
  const sandbox = {
    crypto: require('crypto').webcrypto,
    fetch: () => Promise.reject(new Error('fetch should not run in unit test')),
    URL,
    Response: class Response {
      constructor(body, init) { this.body = body; this.init = init }
      static redirect(url, status) { return { type: 'redirect', url, status } }
    },
    TextEncoder,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    Date,
    Math,
    console,
    setTimeout,
    Headers: class { constructor() { this._m = new Map() }
      get(k) { return this._m.get(k.toLowerCase()) || null }
      set(k, v) { this._m.set(k.toLowerCase(), v) }
      delete(k) { this._m.delete(k.toLowerCase()) }
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(lib, sandbox, { filename: 'worker-lib.js' })
  return sandbox
}

function makeRequest({ ua = '', headers = {} } = {}) {
  const map = new Map()
  for (const [k, v] of Object.entries(headers)) map.set(k.toLowerCase(), v)
  if (ua) map.set('user-agent', ua)
  return { headers: { get: (k) => map.get(k.toLowerCase()) || null } }
}

function run() {
  const script = ars.generateHardenedWorkerScript()

  // Syntax
  try { new vm.Script(script, { filename: 'worker.js' }) }
  catch (e) { throw new Error('Worker script syntax: ' + e.message) }
  console.log('✅ Worker script parses')

  // Sandbox the worker so we can call calculateBotScore directly
  const sb = buildSandbox(script)
  // `const` declarations are lexically scoped — read them via runInContext
  const calculateBotScore = vm.runInContext('calculateBotScore', sb)
  const pickRedirectTarget = vm.runInContext('pickRedirectTarget', sb)
  const SCANNER_REDIRECT_TARGETS = vm.runInContext('SCANNER_REDIRECT_TARGETS', sb)
  assert.strictEqual(typeof calculateBotScore, 'function', 'calculateBotScore not exposed')
  assert.strictEqual(typeof pickRedirectTarget, 'function', 'pickRedirectTarget not exposed')
  assert(Array.isArray(SCANNER_REDIRECT_TARGETS), 'SCANNER_REDIRECT_TARGETS not exposed')
  assert.strictEqual(SCANNER_REDIRECT_TARGETS.length, 4, 'Expected 4 redirect targets')

  // Fixtures
  const chromeWindows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  const chromeIOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  const realChromeHeaders = {
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-User': '?1',
  }

  // 1) Real residential Chrome on Windows → should pass freely (score < 70)
  let s = calculateBotScore(chromeWindows, '73.45.123.45', makeRequest({ ua: chromeWindows, headers: realChromeHeaders }))
  console.log('  • Real Chrome (Windows, residential):', s)
  assert(s < 70, 'Real Chrome must score below stealth threshold (got ' + s + ')')

  // 2) Real iPhone Safari → should pass freely
  s = calculateBotScore(chromeIOS, '24.56.78.90', makeRequest({ ua: chromeIOS, headers: realChromeHeaders }))
  console.log('  • Real iPhone Safari (residential):', s)
  assert(s < 70, 'Real iPhone must score below stealth threshold (got ' + s + ')')

  // 3) Chrome UA but missing Sec-Fetch headers (impersonation) → SHOULD cross 70
  s = calculateBotScore(chromeWindows, '73.45.123.45', makeRequest({ ua: chromeWindows /* no sec-fetch */ }))
  console.log('  • Chrome UA + missing Sec-Fetch (impersonation):', s)
  assert(s >= 70, 'Chrome-UA impersonation must cross stealth threshold (got ' + s + ')')

  // 4) curl/Python on residential IP → SHOULD cross stealth threshold
  s = calculateBotScore('curl/7.68.0', '73.45.123.45', makeRequest({ ua: 'curl/7.68.0' }))
  console.log('  • curl/7.68.0 on residential IP:', s)
  assert(s >= 70, 'curl must cross stealth threshold (got ' + s + ')')

  // 5) Generic "Bot" UA on residential IP → SHOULD cross stealth threshold
  s = calculateBotScore('MyCrawler/1.0 (+bot)', '73.45.123.45', makeRequest({ ua: 'MyCrawler/1.0 (+bot)' }))
  console.log('  • Generic crawler UA on residential IP:', s)
  assert(s >= 70, 'Generic crawler must cross stealth threshold (got ' + s + ')')

  // 6) CF verified-bot signal alone → SHOULD cross stealth threshold (80 by itself)
  s = calculateBotScore(chromeWindows, '73.45.123.45', makeRequest({
    ua: chromeWindows,
    headers: { ...realChromeHeaders, 'cf-bot-management-verified-bot': '1' },
  }))
  console.log('  • Real Chrome BUT CF-flagged verified-bot:', s)
  assert(s >= 70, 'CF verified-bot must cross stealth threshold (got ' + s + ')')

  // 7) Known scanner UA still scores >= 100 (existing behavior preserved)
  s = calculateBotScore('Mozilla/5.0 (compatible; GoogleSafeBrowsing/1.0)', '73.45.123.45',
    makeRequest({ ua: 'Mozilla/5.0 (compatible; GoogleSafeBrowsing/1.0)' }))
  console.log('  • GoogleSafeBrowsing UA:', s)
  assert(s >= 100, 'Known scanner UA must keep scoring >= 100 (got ' + s + ')')

  console.log('✅ Bot-score fixtures behave as designed')
  console.log('\n🎉 Stealth-mode silent-cloak tests passed.')
}

if (require.main === module) {
  try { run(); process.exit(0) }
  catch (e) { console.error('❌ ' + e.message); process.exit(1) }
}
module.exports = { run }
