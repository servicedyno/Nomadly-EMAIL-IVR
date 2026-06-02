/**
 * Regression test: captcha toggle for addon domains.
 *
 * Customer report (homepage-navyfed.com / @Night_ismine, 2026-02): the
 * captcha-toggle UI showed "⚠️ No CF" for the addon domain even though the
 * CF Worker route was actively running. Root cause: addon-domain-flow.js
 * never persisted `val.cfZoneId` / `val.nameserverType` into
 * registeredDomains, so both the bot and the panel rejected the toggle.
 *
 * Fix: `resolveDomainCfState(domain, db)` in anti-red-service.js falls back
 * to a live `cfService.getZoneByName` lookup and self-heals the DB.
 *
 * Run with:  node js/tests/captcha-toggle-addon-domain.test.js
 */

const assert = require('assert')
const path = require('path')

// Stub cf-service BEFORE anti-red-service loads it. We can't rely on
// require.cache injection because anti-red-service's inline
// `require('./cf-service')` happens at call-time and Node serves the cached
// real module. Instead we monkey-patch the actual module export.
const cfService = require('../cf-service')
const __realGetZoneByName = cfService.getZoneByName
let __zoneResponses = {}
cfService.getZoneByName = async (name) => __zoneResponses[String(name).toLowerCase()] || null

const antiRed = require('../anti-red-service')

function makeFakeDb(initialDocs = {}) {
  const docs = { ...initialDocs }
  return {
    collection: (name) => {
      assert.strictEqual(name, 'registeredDomains', 'only registeredDomains expected')
      return {
        findOne: async ({ _id }) => docs[_id] || null,
        updateOne: async ({ _id }, update, opts = {}) => {
          if (!docs[_id]) {
            if (!opts.upsert) return { matchedCount: 0 }
            docs[_id] = { _id, val: {} }
          }
          if (update.$set) {
            for (const [k, v] of Object.entries(update.$set)) {
              const segments = k.split('.')
              let cur = docs[_id]
              for (let i = 0; i < segments.length - 1; i++) {
                cur[segments[i]] = cur[segments[i]] || {}
                cur = cur[segments[i]]
              }
              cur[segments[segments.length - 1]] = v
            }
          }
          return { matchedCount: 1 }
        },
        __debug: docs,
      }
    },
    __debug: docs,
  }
}

async function run() {
  // === Case 1: DB already has cfZoneId — fast path, no CF call ===
  {
    __zoneResponses = {} // CF call would return null if accidentally hit
    const db = makeFakeDb({
      'example.com': { _id: 'example.com', val: { cfZoneId: 'zone-abc', nameserverType: 'cloudflare' } },
    })
    const r = await antiRed.resolveDomainCfState('example.com', db)
    assert.strictEqual(r.zoneId, 'zone-abc')
    assert.strictEqual(r.hasCloudflare, true)
    assert.strictEqual(r.source, 'db')
    console.log('✅ Case 1 — DB fast path')
  }

  // === Case 2: Addon domain missing cfZoneId — CF API lookup hits, DB backfilled ===
  {
    __zoneResponses = { 'homepage-navyfed.com': { id: 'zone-xyz', name: 'homepage-navyfed.com' } }
    const db = makeFakeDb({
      // simulate the bug — domain doc exists but has no CF metadata
      'homepage-navyfed.com': { _id: 'homepage-navyfed.com', val: { plan: 'gold' } },
    })
    const r = await antiRed.resolveDomainCfState('homepage-navyfed.com', db)
    assert.strictEqual(r.zoneId, 'zone-xyz', 'should resolve zone via CF API')
    assert.strictEqual(r.hasCloudflare, true)
    assert.strictEqual(r.source, 'cf-api')
    // Self-heal: DB should now have the backfilled metadata
    const doc = db.__debug['homepage-navyfed.com']
    assert.strictEqual(doc.val.cfZoneId, 'zone-xyz', 'DB should be backfilled')
    assert.strictEqual(doc.val.nameserverType, 'cloudflare')
    console.log('✅ Case 2 — Addon backfill (the bug fix)')
  }

  // === Case 3: Domain not on CF — neither DB nor API has it ===
  {
    __zoneResponses = {}
    const db = makeFakeDb({})
    const r = await antiRed.resolveDomainCfState('not-on-cf.com', db)
    assert.strictEqual(r.zoneId, null)
    assert.strictEqual(r.hasCloudflare, false)
    assert.strictEqual(r.source, 'none')
    console.log('✅ Case 3 — Genuinely not on CF')
  }

  // === Case 4: isOff flag is reported regardless of source ===
  {
    __zoneResponses = { 'addon-off.com': { id: 'zid', name: 'addon-off.com' } }
    const db = makeFakeDb({
      'addon-off.com': { _id: 'addon-off.com', val: { visitorCaptchaOff: true } },
    })
    const r = await antiRed.resolveDomainCfState('addon-off.com', db)
    assert.strictEqual(r.isOff, true)
    assert.strictEqual(r.hasCloudflare, true)
    console.log('✅ Case 4 — isOff propagated for backfilled docs')
  }

  // === Case 5: legacy antiRedOff flag still treated as off ===
  {
    __zoneResponses = {}
    const db = makeFakeDb({
      'legacy.com': { _id: 'legacy.com', val: { cfZoneId: 'z1', nameserverType: 'cloudflare', antiRedOff: true } },
    })
    const r = await antiRed.resolveDomainCfState('legacy.com', db)
    assert.strictEqual(r.isOff, true)
    console.log('✅ Case 5 — Legacy antiRedOff still honored')
  }

  // === Case 6: missing domain returns empty result, doesn't throw ===
  {
    const r = await antiRed.resolveDomainCfState('', null)
    assert.strictEqual(r.hasCloudflare, false)
    console.log('✅ Case 6 — Empty input is safe')
  }

  // restore real cf-service for any subsequent test runs
  cfService.getZoneByName = __realGetZoneByName

  console.log('\n🎉 All captcha-toggle-addon-domain regression cases passed')
}

run().catch((e) => {
  console.error('❌ TEST FAILED:', e)
  process.exit(1)
})
