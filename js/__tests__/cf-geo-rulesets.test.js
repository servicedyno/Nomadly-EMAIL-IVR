/* eslint-env node */
/**
 * Unit tests for the WAF Custom Rules migration in js/cf-service.js
 * (functions: listFirewallRules, createGeoRule, deleteFirewallRule).
 *
 * Strategy: replace axios.{get,post,delete} with stubs that record calls and
 * return canned Rulesets-API responses. We verify:
 *   1. The new code calls the Rulesets endpoints, NOT /firewall/rules or /filters.
 *   2. createGeoRule builds the correct `ip.geoip.country in {...}` expression
 *      for both `block` and `allow` modes.
 *   3. listFirewallRules returns rules in the legacy shape that existing
 *      callers (cpanel-routes.js, anti-red-service.js) read:
 *        - r.id, r.description, r.action, r.paused
 *        - r.filter.expression (legacy compat)
 *   4. deleteFirewallRule resolves the ruleset id from the entrypoint
 *      before calling DELETE.
 *   5. When the entrypoint doesn't exist (404), it is auto-created.
 *
 * Run: node js/__tests__/cf-geo-rulesets.test.js
 */

require('dotenv').config({ path: '/app/backend/.env' })
const assert = require('assert')
const path = require('path')
const Module = require('module')

// Stub axios via Module._load BEFORE requiring cf-service
const calls = []
let stubResponder = null
function makeStubAxios() {
  const handler = (method) => async (url, bodyOrCfg, cfg) => {
    const config = cfg || bodyOrCfg
    const body = (method === 'get' || method === 'delete') ? undefined : bodyOrCfg
    calls.push({ method: method.toUpperCase(), url, body, headers: config?.headers })
    return stubResponder({ method: method.toUpperCase(), url, body })
  }
  return {
    get: handler('get'),
    post: handler('post'),
    delete: handler('delete'),
    patch: handler('patch'),
  }
}

const origLoad = Module._load
Module._load = function (request, parent, ...rest) {
  if (request === 'axios') return makeStubAxios()
  return origLoad.call(this, request, parent, ...rest)
}

// Set required env BEFORE requiring cf-service
process.env.CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL || 'test@example.com'
process.env.CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY || 'dummy-key'

// Bust any cached cf-service so it picks up our stub axios
const cfPath = path.resolve('/app/js/cf-service.js')
delete require.cache[cfPath]
const cf = require(cfPath)

Module._load = origLoad

const ZONE_ID = 'zone-abc-123'
const RULESET_ID = 'ruleset-xyz-789'
const RULE_ID = 'rule-1'

function reset() {
  calls.length = 0
}

async function test_listFirewallRules_returns_legacy_shape() {
  reset()
  stubResponder = ({ method, url }) => {
    if (method === 'GET' && url.includes(`/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint`)) {
      return {
        data: {
          success: true,
          result: {
            id: RULESET_ID,
            kind: 'zone',
            phase: 'http_request_firewall_custom',
            rules: [
              {
                id: RULE_ID,
                expression: '(ip.geoip.country in {"CN" "RU"})',
                description: 'Geo-block: CN, RU',
                action: 'block',
                enabled: true,
                last_updated: '2026-06-19T00:00:00Z',
                version: '1',
                ref: 'r1ref',
              },
              {
                id: 'rule-2',
                expression: '(http.user_agent contains "Googlebot")',
                description: 'Anti-Bot: Block known bad crawlers',
                action: 'block',
                enabled: false,
                ref: 'r2ref',
              },
            ],
          },
        },
      }
    }
    throw new Error('unexpected call: ' + method + ' ' + url)
  }

  const rules = await cf.listFirewallRules(ZONE_ID)
  assert.strictEqual(rules.length, 2, 'should return 2 rules')

  // Legacy shape: callers in cpanel-routes.js / anti-red-service.js read these fields:
  assert.strictEqual(rules[0].id, RULE_ID)
  assert.strictEqual(rules[0].description, 'Geo-block: CN, RU')
  assert.strictEqual(rules[0].action, 'block')
  assert.strictEqual(rules[0].paused, false, 'enabled=true → paused=false')
  assert.ok(rules[0].filter?.expression?.includes('ip.geoip.country'),
    'must expose filter.expression for legacy callers')

  assert.strictEqual(rules[1].paused, true, 'enabled=false → paused=true')

  // The deprecated endpoints must NEVER be hit
  const dep = calls.filter(c => c.url.includes('/firewall/rules') || c.url.includes('/filters'))
  assert.strictEqual(dep.length, 0, 'must not hit deprecated endpoints')

  // Must hit the new Rulesets entrypoint endpoint
  const ep = calls.filter(c => c.url.includes('/rulesets/phases/http_request_firewall_custom/entrypoint'))
  assert.ok(ep.length >= 1, 'must call the Rulesets entrypoint')

  console.log('  PASS: listFirewallRules returns legacy shape & hits Rulesets API')
}

async function test_createGeoRule_block_mode() {
  reset()
  stubResponder = ({ method, url, body }) => {
    if (method === 'GET' && url.includes('/entrypoint')) {
      return { data: { success: true, result: { id: RULESET_ID, rules: [] } } }
    }
    if (method === 'POST' && url === `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/${RULESET_ID}/rules`) {
      // Capture the body for assertion
      return {
        data: {
          success: true,
          result: {
            id: RULESET_ID,
            rules: [{
              id: 'newrule-1',
              expression: body.expression,
              description: body.description,
              action: body.action,
              enabled: true,
            }],
          },
        },
      }
    }
    throw new Error('unexpected call: ' + method + ' ' + url)
  }

  const result = await cf.createGeoRule(ZONE_ID, ['CN', 'RU'], 'block', 'Block bad actors')
  assert.strictEqual(result.success, true, 'block mode should succeed')
  assert.ok(result.rule, 'should return rule')

  // No deprecated endpoint calls
  const dep = calls.filter(c => c.url.includes('/firewall/rules') || c.url.includes('/filters'))
  assert.strictEqual(dep.length, 0, 'must not hit deprecated endpoints')

  // The POST body should be the new shape (single rule, not array; uses `expression`, not `filter`)
  const post = calls.find(c => c.method === 'POST' && c.url.includes(`/rulesets/${RULESET_ID}/rules`))
  assert.ok(post, 'POST to /rulesets/{id}/rules must be made')
  assert.strictEqual(post.body.action, 'block')
  assert.strictEqual(post.body.description, 'Block bad actors')
  assert.strictEqual(post.body.enabled, true)
  assert.strictEqual(post.body.expression, '(ip.geoip.country in {"CN" "RU"})',
    'block mode must use `in {...}` expression')

  console.log('  PASS: createGeoRule(block) → correct expression + Rulesets POST')
}

async function test_createGeoRule_allow_mode() {
  reset()
  stubResponder = ({ method, url, body }) => {
    if (method === 'GET' && url.includes('/entrypoint')) {
      return { data: { success: true, result: { id: RULESET_ID, rules: [] } } }
    }
    if (method === 'POST' && url.includes(`/rulesets/${RULESET_ID}/rules`)) {
      return {
        data: {
          success: true,
          result: {
            rules: [{
              id: 'newrule-2',
              expression: body.expression,
              description: body.description,
              action: body.action,
              enabled: true,
            }],
          },
        },
      }
    }
    throw new Error('unexpected call: ' + method + ' ' + url)
  }

  const result = await cf.createGeoRule(ZONE_ID, ['US', 'GB'], 'allow')
  assert.strictEqual(result.success, true, 'allow mode should succeed')

  const post = calls.find(c => c.method === 'POST' && c.url.includes(`/rulesets/${RULESET_ID}/rules`))
  assert.strictEqual(post.body.expression, '(not (ip.geoip.country in {"US" "GB"}))',
    'allow mode must negate the in-list')

  console.log('  PASS: createGeoRule(allow) → negated expression')
}

async function test_createGeoRule_creates_entrypoint_when_missing() {
  reset()
  stubResponder = ({ method, url }) => {
    if (method === 'GET' && url.includes('/entrypoint')) {
      const err = new Error('Not Found')
      err.response = { status: 404, data: { success: false, errors: [{ code: 1006 }] } }
      throw err
    }
    if (method === 'POST' && url === `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets`) {
      return { data: { success: true, result: { id: 'newly-created-ruleset', rules: [] } } }
    }
    if (method === 'POST' && url.includes('/rulesets/newly-created-ruleset/rules')) {
      return {
        data: {
          success: true,
          result: {
            rules: [{
              id: 'r-new',
              expression: '(ip.geoip.country in {"IR"})',
              description: 'Geo-block: IR',
              action: 'block',
              enabled: true,
            }],
          },
        },
      }
    }
    throw new Error('unexpected call: ' + method + ' ' + url)
  }

  const result = await cf.createGeoRule(ZONE_ID, ['IR'], 'block')
  assert.strictEqual(result.success, true)
  // We should have hit POST /rulesets (the create) THEN POST /rulesets/{id}/rules
  const createRuleset = calls.find(c =>
    c.method === 'POST' &&
    c.url === `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets`
  )
  assert.ok(createRuleset, 'must auto-create the entrypoint ruleset on 404')
  assert.strictEqual(createRuleset.body.phase, 'http_request_firewall_custom')
  assert.strictEqual(createRuleset.body.kind, 'zone')

  console.log('  PASS: createGeoRule auto-creates entrypoint on 404')
}

async function test_deleteFirewallRule_resolves_ruleset() {
  reset()
  stubResponder = ({ method, url }) => {
    if (method === 'GET' && url.includes('/entrypoint')) {
      return { data: { success: true, result: { id: RULESET_ID, rules: [] } } }
    }
    if (method === 'DELETE' && url === `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/${RULESET_ID}/rules/${RULE_ID}`) {
      return { data: { success: true } }
    }
    throw new Error('unexpected call: ' + method + ' ' + url)
  }

  const result = await cf.deleteFirewallRule(ZONE_ID, RULE_ID)
  assert.strictEqual(result.success, true)
  assert.ok(calls.some(c =>
    c.method === 'DELETE' &&
    c.url.includes(`/rulesets/${RULESET_ID}/rules/${RULE_ID}`)
  ), 'must DELETE /rulesets/{rulesetId}/rules/{ruleId}')

  // Old endpoint must not be hit
  const dep = calls.filter(c => c.url.includes('/firewall/rules/'))
  assert.strictEqual(dep.length, 0, 'must not hit deprecated /firewall/rules/{id}')

  console.log('  PASS: deleteFirewallRule resolves ruleset & uses Rulesets DELETE')
}

async function test_deleteFirewallRule_idempotent_on_404() {
  reset()
  stubResponder = ({ method, url }) => {
    if (method === 'GET' && url.includes('/entrypoint')) {
      return { data: { success: true, result: { id: RULESET_ID, rules: [] } } }
    }
    if (method === 'DELETE') {
      const err = new Error('Not Found')
      err.response = { status: 404, data: { success: false, errors: [{ code: 1004 }] } }
      throw err
    }
    throw new Error('unexpected call: ' + method + ' ' + url)
  }

  const result = await cf.deleteFirewallRule(ZONE_ID, 'already-deleted-id')
  assert.strictEqual(result.success, true)
  assert.strictEqual(result.alreadyGone, true, 'must signal idempotent deletion')
  console.log('  PASS: deleteFirewallRule is idempotent on 404')
}

async function test_createGeoRule_validates_input() {
  reset()
  const noStubCalls = []
  stubResponder = ({ method, url }) => {
    noStubCalls.push({ method, url })
    return { data: { success: true, result: {} } }
  }
  const r1 = await cf.createGeoRule(ZONE_ID, [], 'block')
  assert.strictEqual(r1.success, false, 'empty countryCodes → fail')
  const r2 = await cf.createGeoRule(ZONE_ID, null, 'block')
  assert.strictEqual(r2.success, false, 'null countryCodes → fail')
  assert.strictEqual(noStubCalls.length, 0, 'no HTTP calls when input is invalid')
  console.log('  PASS: createGeoRule rejects empty/null inputs without HTTP calls')
}

async function main() {
  console.log('━━━ cf-service WAF Custom Rules migration tests ━━━')
  await test_listFirewallRules_returns_legacy_shape()
  await test_createGeoRule_block_mode()
  await test_createGeoRule_allow_mode()
  await test_createGeoRule_creates_entrypoint_when_missing()
  await test_deleteFirewallRule_resolves_ruleset()
  await test_deleteFirewallRule_idempotent_on_404()
  await test_createGeoRule_validates_input()
  console.log('\n✅ ALL 7 TESTS PASS')
}
main().catch(e => { console.error('❌ TEST FAILURE:', e); process.exit(1) })
