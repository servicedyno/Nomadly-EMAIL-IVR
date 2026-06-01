/**
 * Regression test for the @mccoyfcuportal.com "no SSL" bug (2026-06-01).
 *
 * The customer registered the standalone domain mccoyfcuportal.com (no
 * hosting attached). Cloudflare's edge cert was valid, but visitors
 * hitting http://mccoyfcuportal.com/ stayed on plaintext HTTP — browsers
 * showed "Not Secure" in the URL bar. They reported "domain has no SSL".
 *
 * Root cause: `domain-service.js#registerDomain` (and 3 other zone-create
 * sites) called `cfService.createZone` but never followed up with
 * `cfService.setSSLMode` / `cfService.enforceHTTPS`. The hosting and
 * addon-domain flows DID call these — only standalone domain registration
 * missed them.
 *
 * Fix: bake the HTTPS-baseline into `cfService.createZone` itself so
 * EVERY caller (current and future) gets `Always Use HTTPS` enforced
 * automatically. Pre-existing affected domains are repaired by
 * `scripts/heal_https_enforcement.js`.
 *
 * This test asserts:
 *   A. The createZone source contains the HTTPS-baseline call on every
 *      branch (new-zone, existing-zone-fast-path, 1061-recovered-zone).
 *   B. Behavioural test — mock axios + setSSLMode + enforceHTTPS, call
 *      createZone, assert both helpers fired regardless of zone state.
 *   C. The heal script exists and contains the safety guards (dry-run,
 *      limit, healed-timestamp marker, skip-already-healed).
 *   D. node --check on both files.
 *
 * Run:  node tests/test_https_enforcement_on_zone_creation.js
 */

'use strict'

const fs = require('fs')
const path = require('path')
const Module = require('module')
const { spawnSync } = require('child_process')

let passed = 0
let failed = 0
const assert = (cond, name) => {
  if (cond) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}`); failed++ }
}

const cfPath   = path.join(__dirname, '..', 'js', 'cf-service.js')
const healPath = path.join(__dirname, '..', 'scripts', 'heal_https_enforcement.js')
const cfSrc    = fs.readFileSync(cfPath, 'utf8')
const healSrc  = fs.readFileSync(healPath, 'utf8')

// ───────────────────────────────────────────────────────────
// Test A — static guards on cf-service.js#createZone
// ───────────────────────────────────────────────────────────
console.log('\nTest A: cfService.createZone bakes in the HTTPS baseline')

// Extract createZone body so we don't false-positive on other functions.
const createZoneStart = cfSrc.indexOf('const createZone = async (domainName) =>')
const createZoneEnd   = cfSrc.indexOf('\nconst getZoneByName', createZoneStart)
assert(createZoneStart > -1 && createZoneEnd > createZoneStart, 'A0 located createZone block')
const block = cfSrc.slice(createZoneStart, createZoneEnd)

// Three return paths in createZone — all must apply HTTPS defaults:
//   1. zone already exists fast-path (line ~67)
//   2. fresh POST success (line ~82)
//   3. error code 1061 recovery (line ~94)
const applyCallCount = (block.match(/_applyHttpsDefaults\(/g) || []).length
assert(applyCallCount === 3, `A1 _applyHttpsDefaults is called on all 3 return paths (found ${applyCallCount})`)

assert(/const _applyHttpsDefaults = async/.test(cfSrc), 'A2 _applyHttpsDefaults helper is defined')
assert(/await setSSLMode\(zoneId, 'flexible'\)/.test(cfSrc),
       'A3 helper calls setSSLMode(zoneId, "flexible")')
assert(/await enforceHTTPS\(zoneId\)/.test(cfSrc),
       'A4 helper calls enforceHTTPS(zoneId)')
assert(/HTTPS baseline non-fatal error/.test(cfSrc),
       'A5 helper has a non-fatal error path (must never throw past createZone)')

// ───────────────────────────────────────────────────────────
// Test B — behavioural: call createZone with mocked axios and
// verify the right CF endpoints get PATCHed.
// ───────────────────────────────────────────────────────────
console.log('\nTest B: createZone PATCHes the HTTPS-baseline endpoints')

// Capture every axios call so we can assert against it.
const captured = []
const okGet  = async (_url, _opts) => ({ data: { success: true, result: [] } }) // getZoneByName -> empty
const okPost = async (url, _body, _opts) => ({ data: { success: true, result: {
  id: 'zone_test_id', name_servers: ['ns1.cf', 'ns2.cf'], status: 'active',
} } })
const okPatch = async (url, body, _opts) => { captured.push({ url, body }); return { data: { success: true } } }

const fakeAxios = { get: okGet, post: okPost, patch: okPatch }

// Stub `axios` AND `dotenv` BEFORE requiring cf-service.js
const realLoad = Module._load
Module._load = function(req, parent, isMain) {
  if (req === 'axios') return fakeAxios
  if (req === 'dotenv') return { config: () => {} }
  return realLoad.apply(this, arguments)
}
// Clear any cached cf-service so the new axios stub is picked up
delete require.cache[require.resolve('../js/cf-service.js')]
const cfService = require('../js/cf-service.js')
Module._load = realLoad

;(async () => {
  // Provide credentials so cf-service doesn't bail
  process.env.CLOUDFLARE_EMAIL = 'test@example.com'
  process.env.CLOUDFLARE_API_KEY = 'test_key'

  captured.length = 0
  const result = await cfService.createZone('zonecreate-test.example')
  assert(result.success === true, `B1 createZone returns success (got ${JSON.stringify(result).slice(0, 200)})`)
  assert(result.zoneId === 'zone_test_id', 'B2 createZone returns the zoneId')

  const urls = captured.map(c => c.url)
  const hasAlwaysHttps = urls.some(u => u.endsWith('/settings/always_use_https'))
  const hasSSLMode     = urls.some(u => u.endsWith('/settings/ssl'))
  const hasHSTS        = urls.some(u => u.endsWith('/settings/security_header'))
  const hasAutoRewrite = urls.some(u => u.endsWith('/settings/automatic_https_rewrites'))

  assert(hasSSLMode,     `B3 PATCH /settings/ssl was called (urls=${urls.length})`)
  assert(hasAlwaysHttps, 'B4 PATCH /settings/always_use_https was called')
  assert(hasHSTS,        'B5 PATCH /settings/security_header was called (HSTS)')
  assert(hasAutoRewrite, 'B6 PATCH /settings/automatic_https_rewrites was called')

  // Verify the SSL mode value is 'flexible' (the customer-safe default)
  const sslPatch = captured.find(c => c.url.endsWith('/settings/ssl'))
  assert(sslPatch?.body?.value === 'flexible', `B7 SSL mode value is "flexible" (got "${sslPatch?.body?.value}")`)

  // Verify Always Use HTTPS value is 'on'
  const alwaysPatch = captured.find(c => c.url.endsWith('/settings/always_use_https'))
  assert(alwaysPatch?.body?.value === 'on', `B8 Always Use HTTPS value is "on" (got "${alwaysPatch?.body?.value}")`)

  // Behavioural test — pre-existing zone path also applies defaults
  console.log('\nTest B.alt: existing-zone fast-path also applies the baseline')
  captured.length = 0
  // Patch axios.get so getZoneByName returns an existing zone
  fakeAxios.get = async () => ({ data: { success: true, result: [
    { id: 'zone_existing', name_servers: ['ns3.cf', 'ns4.cf'], status: 'active' },
  ] } })
  const r2 = await cfService.createZone('preexisting.example')
  assert(r2.zoneId === 'zone_existing', 'B.alt1 createZone returns the existing zone')
  assert(captured.length >= 4, `B.alt2 existing-zone path still issued ≥4 PATCH settings calls (got ${captured.length})`)

  // ───────────────────────────────────────────────────────────
  // Test C — heal script safety guards
  // ───────────────────────────────────────────────────────────
  console.log('\nTest C: heal script has all safety guards')

  assert(/--dry-run/.test(healSrc),                            'C1 heal script supports --dry-run')
  assert(/--limit/.test(healSrc),                              'C2 heal script supports --limit=N')
  assert(/--batch/.test(healSrc),                              'C3 heal script supports --batch=N (concurrency)')
  assert(/--skip-already-healed/.test(healSrc),                'C4 heal script supports --skip-already-healed')
  assert(/httpsEnforcementHealedAt/.test(healSrc),             'C5 heal script writes the healed marker')
  assert(/await cfService\.enforceHTTPS\(zoneId\)/.test(healSrc), 'C6 heal script calls cfService.enforceHTTPS')
  assert(/registeredDomains/.test(healSrc),                    'C7 heal script reads from registeredDomains collection')
  assert(/process\.exit\(1\)/.test(healSrc),                   'C8 heal script fails fast on missing credentials')
  assert(/results\.errors/.test(healSrc),                      'C9 heal script tracks errors separately from healed count')
  assert(/CF's 1200 req \/ 5 min/.test(healSrc),               'C10 heal script paces under CF rate limit')

  // ───────────────────────────────────────────────────────────
  // Test D — node --check on both files
  // ───────────────────────────────────────────────────────────
  console.log('\nTest D: files parse')
  for (const p of [cfPath, healPath]) {
    const r = spawnSync('node', ['--check', p], { encoding: 'utf8' })
    assert(r.status === 0, `D ${path.basename(p)} parses (stderr: ${r.stderr.trim() || 'none'})`)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
