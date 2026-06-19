/* eslint-env node */
/**
 * Unit tests for the Anti-Bot / JA3 WAF Custom Rules migration in
 *   - js/cf-service.js :: createAntiBotRules
 *   - js/anti-red-service.js :: createJA3Rules
 *
 * Strategy: stub axios via Module._load BEFORE requiring either module so
 * we can record every HTTP call. We verify:
 *   1. NO call ever hits the deprecated /firewall/rules or /filters endpoints.
 *   2. createAntiBotRules POSTs a single rule to /zones/{z}/rulesets/{id}/rules
 *      with `expression`, `action:"block"`, description containing "Anti-Bot",
 *      `enabled:true` — and skips creation when the entrypoint already has an
 *      Anti-Bot rule.
 *   3. createJA3Rules POSTs a single rule with `action:"js_challenge"`,
 *      description containing "JA3", `enabled:true` — and gracefully reports
 *      `planLimitation:true` on 400/403 (zones without Enterprise Bot Mgmt).
 *   4. Auto-creates the entrypoint on 404.
 *
 * Run: node js/__tests__/cf-antibot-ja3-rulesets.test.js
 */

require('dotenv').config({ path: '/app/backend/.env' })
const assert = require('assert')
const path = require('path')
const Module = require('module')

const calls = []
let stubResponder = null
function makeStubAxios() {
  const handler = (method) => async (url, bodyOrCfg, cfg) => {
    const config = cfg || bodyOrCfg
    const body = (method === 'get' || method === 'delete') ? undefined : bodyOrCfg
    calls.push({ method: method.toUpperCase(), url, body, headers: config?.headers })
    return stubResponder({ method: method.toUpperCase(), url, body })
  }
  const inst = {
    get: handler('get'),
    post: handler('post'),
    delete: handler('delete'),
    patch: handler('patch'),
  }
  // anti-red-service.js calls axios.create() for the WHM tunnel client.
  // We're not exercising that path here, so return a permissive stub.
  inst.create = () => ({
    get: async () => ({ data: { metadata: { result: 0, reason: 'stubbed' } } }),
    post: async () => ({ data: { metadata: { result: 0, reason: 'stubbed' } } }),
  })
  return inst
}

const origLoad = Module._load
Module._load = function (request, parent, ...rest) {
  if (request === 'axios') return makeStubAxios()
  return origLoad.call(this, request, parent, ...rest)
}

process.env.CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL || 'test@example.com'
process.env.CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY || 'dummy-key'

// Bust the require cache so the stub applies on first require
for (const p of ['/app/js/cf-service.js', '/app/js/anti-red-service.js']) {
  delete require.cache[path.resolve(p)]
}
const cf = require('/app/js/cf-service')
const antiRed = require('/app/js/anti-red-service')

Module._load = origLoad

const ZONE_ID = 'zone-xyz-555'
const RULESET_ID = 'rsid-zzz-444'

function reset() { calls.length = 0 }

function assertNoDeprecated() {
  const dep = calls.filter(c =>
    c.url.includes('/firewall/rules') ||
    /\/filters(\?|$)/.test(c.url) ||
    c.url.endsWith('/filters')
  )
  if (dep.length) {
    console.error('UNEXPECTED deprecated calls:', dep.map(c => `${c.method} ${c.url}`))
  }
  assert.strictEqual(dep.length, 0, 'must NOT hit /firewall/rules or /filters')
}

async function test_antibot_creates_when_no_existing() {
  reset()
  let postedBody = null
  stubResponder = ({ method, url, body }) => {
    if (method === 'GET' && url.includes('/rulesets/phases/http_request_firewall_custom/entrypoint')) {
      return { data: { success: true, result: { id: RULESET_ID, rules: [] } } }
    }
    if (method === 'POST' && url === `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/${RULESET_ID}/rules`) {
      postedBody = body
      return { data: { success: true, result: { rules: [{ id: 'r-new', ...body }] } } }
    }
    throw new Error('unexpected call: ' + method + ' ' + url)
  }
  const r = await cf.createAntiBotRules(ZONE_ID)
  assert.strictEqual(r.success, true, 'should succeed')
  assertNoDeprecated()
  assert.ok(postedBody, 'must POST to /rules')
  assert.strictEqual(postedBody.action, 'block')
  assert.strictEqual(postedBody.enabled, true)
  assert.ok(postedBody.description.includes('Anti-Bot'))
  assert.ok(/http\.user_agent contains "Googlebot"/.test(postedBody.expression),
    'expression must include http.user_agent UA matches')
  console.log('  PASS: createAntiBotRules creates a single rule on empty entrypoint')
}

async function test_antibot_skips_when_existing() {
  reset()
  stubResponder = ({ method, url }) => {
    if (method === 'GET' && url.includes('/entrypoint')) {
      return {
        data: { success: true, result: { id: RULESET_ID, rules: [
          { id: 'old-1', description: 'Anti-Bot: Block known bad crawlers', expression: '(...)', action: 'block', enabled: true },
        ] } },
      }
    }
    throw new Error('unexpected call: ' + method + ' ' + url)
  }
  const r = await cf.createAntiBotRules(ZONE_ID)
  assert.strictEqual(r.success, true)
  assert.strictEqual(r.existing, true, 'should return existing:true')
  // No POST should have been made
  const posts = calls.filter(c => c.method === 'POST')
  assert.strictEqual(posts.length, 0, 'must not POST when a rule already exists')
  assertNoDeprecated()
  console.log('  PASS: createAntiBotRules skips duplicate via entrypoint.rules[]')
}

async function test_antibot_autocreates_entrypoint() {
  reset()
  stubResponder = ({ method, url, body }) => {
    if (method === 'GET' && url.includes('/entrypoint')) {
      const err = new Error('Not Found')
      err.response = { status: 404, data: { success: false, errors: [{ code: 1006 }] } }
      throw err
    }
    if (method === 'POST' && url === `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets`) {
      assert.strictEqual(body.phase, 'http_request_firewall_custom')
      assert.strictEqual(body.kind, 'zone')
      return { data: { success: true, result: { id: 'fresh-rs', rules: [] } } }
    }
    if (method === 'POST' && url.includes('/rulesets/fresh-rs/rules')) {
      return { data: { success: true, result: { rules: [{ id: 'r1', ...body }] } } }
    }
    throw new Error('unexpected: ' + method + ' ' + url)
  }
  const r = await cf.createAntiBotRules(ZONE_ID)
  assert.strictEqual(r.success, true)
  assert.ok(calls.some(c =>
    c.method === 'POST' &&
    c.url === `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets`
  ), 'must auto-create entrypoint on 404')
  assertNoDeprecated()
  console.log('  PASS: createAntiBotRules auto-creates entrypoint on 404')
}

async function test_ja3_creates_js_challenge() {
  reset()
  let postedBody = null
  stubResponder = ({ method, url, body }) => {
    if (method === 'GET' && url.includes('/entrypoint')) {
      return { data: { success: true, result: { id: RULESET_ID, rules: [] } } }
    }
    if (method === 'POST' && url === `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/${RULESET_ID}/rules`) {
      postedBody = body
      return { data: { success: true, result: { rules: [{ id: 'ja3-r1', ...body }] } } }
    }
    throw new Error('unexpected: ' + method + ' ' + url)
  }
  const r = await antiRed.createJA3Rules(ZONE_ID)
  assert.strictEqual(r.success, true, 'should succeed')
  assert.ok(postedBody, 'must POST to /rules')
  assert.strictEqual(postedBody.action, 'js_challenge')
  assert.strictEqual(postedBody.enabled, true)
  assert.ok(postedBody.description.includes('JA3'))
  assert.ok(/cf\.bot_management\.ja3_hash eq /.test(postedBody.expression),
    'expression must reference cf.bot_management.ja3_hash')
  assertNoDeprecated()
  console.log('  PASS: createJA3Rules creates js_challenge rule')
}

async function test_ja3_skips_when_existing() {
  reset()
  stubResponder = ({ method, url }) => {
    if (method === 'GET' && url.includes('/entrypoint')) {
      return {
        data: { success: true, result: { id: RULESET_ID, rules: [
          { id: 'ja3-old', description: 'Anti-Red: Challenge scanner TLS fingerprints (JA3)', expression: '(...)', action: 'js_challenge', enabled: true },
        ] } },
      }
    }
    throw new Error('unexpected: ' + method + ' ' + url)
  }
  const r = await antiRed.createJA3Rules(ZONE_ID)
  assert.strictEqual(r.success, true)
  assert.strictEqual(r.existing, true)
  const posts = calls.filter(c => c.method === 'POST')
  assert.strictEqual(posts.length, 0)
  assertNoDeprecated()
  console.log('  PASS: createJA3Rules skips duplicate via entrypoint.rules[]')
}

async function test_ja3_graceful_on_400() {
  reset()
  stubResponder = ({ method, url }) => {
    if (method === 'GET' && url.includes('/entrypoint')) {
      return { data: { success: true, result: { id: RULESET_ID, rules: [] } } }
    }
    if (method === 'POST') {
      const err = new Error('Bad Request')
      err.response = { status: 400, data: { success: false, errors: [{ code: 20009, message: 'Unknown field cf.bot_management.ja3_hash — requires Enterprise Bot Management' }] } }
      throw err
    }
    throw new Error('unexpected: ' + method + ' ' + url)
  }
  const r = await antiRed.createJA3Rules(ZONE_ID)
  assert.strictEqual(r.success, false)
  assert.strictEqual(r.planLimitation, true, 'must signal Enterprise plan requirement on 400')
  assertNoDeprecated()
  console.log('  PASS: createJA3Rules returns planLimitation:true on 400')
}

async function test_ja3_graceful_on_403() {
  reset()
  stubResponder = ({ method, url }) => {
    if (method === 'GET' && url.includes('/entrypoint')) {
      return { data: { success: true, result: { id: RULESET_ID, rules: [] } } }
    }
    if (method === 'POST') {
      const err = new Error('Forbidden')
      err.response = { status: 403, data: { success: false, errors: [{ code: 10000, message: 'No permission' }] } }
      throw err
    }
    throw new Error('unexpected: ' + method + ' ' + url)
  }
  const r = await antiRed.createJA3Rules(ZONE_ID)
  assert.strictEqual(r.success, false)
  assert.strictEqual(r.planLimitation, true)
  console.log('  PASS: createJA3Rules returns planLimitation:true on 403')
}

async function test_ja3_missing_cf_config() {
  reset()
  const savedKey = process.env.CLOUDFLARE_API_KEY
  const savedEmail = process.env.CLOUDFLARE_EMAIL
  delete process.env.CLOUDFLARE_API_KEY
  delete process.env.CLOUDFLARE_EMAIL
  const r = await antiRed.createJA3Rules(ZONE_ID)
  assert.strictEqual(r.success, false)
  assert.ok(r.error?.includes('Cloudflare not configured'))
  assert.strictEqual(calls.length, 0, 'no HTTP when CF env vars missing')
  process.env.CLOUDFLARE_API_KEY = savedKey
  process.env.CLOUDFLARE_EMAIL = savedEmail
  console.log('  PASS: createJA3Rules guards on missing CF env vars')
}

async function main() {
  console.log('━━━ Anti-Bot + JA3 WAF Custom Rules migration tests ━━━')
  await test_antibot_creates_when_no_existing()
  await test_antibot_skips_when_existing()
  await test_antibot_autocreates_entrypoint()
  await test_ja3_creates_js_challenge()
  await test_ja3_skips_when_existing()
  await test_ja3_graceful_on_400()
  await test_ja3_graceful_on_403()
  await test_ja3_missing_cf_config()
  console.log('\n✅ ALL 8 TESTS PASS')
}
main().catch(e => { console.error('❌ TEST FAILURE:', e); process.exit(1) })
