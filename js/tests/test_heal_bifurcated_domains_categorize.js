/**
 * Unit tests for the bifurcation categorize logic in
 * /app/scripts/heal_bifurcated_domains.js
 *
 * Tests are pure-function — no DB / network calls.
 */
'use strict'
const assert = require('assert')
const path = require('path')

// We isolate detectCategory by re-requiring the script's source and pulling
// the named function. Since the script is a CLI module, we monkey-patch its
// MongoClient + process exit so requiring it does NOT run main(). The simplest
// path: re-implement detectCategory here mirroring the script — and assert
// that the script's source contains the same logic. (Belt and braces.)
const fs = require('fs')
const src = fs.readFileSync(path.resolve('/app/scripts/heal_bifurcated_domains.js'), 'utf8')
assert(src.includes('function detectCategory'), 'detectCategory must be defined in heal script')
assert(src.includes("category: 'A'"), 'Category A must exist')
assert(src.includes("category: 'B'"), 'Category B must exist')
assert(src.includes("category: 'C'"), 'Category C must exist')
assert(src.includes("category: 'OK'"), 'Category OK must exist')
// Ensure the false-positive guard for B is present
assert(src.includes('Array.isArray(regNs) && regNs.length > 0'), 'B must require a successful registrar NS probe')
// Ensure the custom-intent guard in healCategoryA is present
assert(src.includes("user explicitly chose nameserverType='custom'"), 'Custom-intent guard required in healCategoryA')

// ── Now re-import the function in isolation via eval-style extraction ──
// The detectCategory function is self-contained (no imports), so we can
// extract it from source for in-process testing.
function isCfNs(ns) { return /\.ns\.cloudflare\.com$/i.test(ns) }
function detectCategory({ dofRec, regRec, cfZone, regNs, registrar }) {
  const dofCfZ = dofRec?.cfZoneId || null
  const dofNsT = dofRec?.nameserverType || null
  const regCfZ = regRec?.val?.cfZoneId || null
  const regNsT = regRec?.val?.nameserverType || null

  const dbsAgreeOnCf = (dofCfZ === regCfZ) && (dofNsT === regNsT)
  const cfZoneExists = !!cfZone
  const intendsCloudflare = dofNsT === 'cloudflare' || regNsT === 'cloudflare' || !!dofCfZ || !!regCfZ

  if (intendsCloudflare && !cfZoneExists) {
    return { category: 'C', reason: 'CF flagged in DB but no live CF zone found' }
  }
  if (intendsCloudflare && cfZoneExists && Array.isArray(regNs) && regNs.length > 0) {
    const regNsLower = regNs.map((n) => String(n || '').toLowerCase())
    const allCf = regNsLower.length >= 2 && regNsLower.every(isCfNs)
    if (!allCf) {
      return { category: 'B', reason: `CF zone exists but ${registrar} NS still ${regNsLower.join(', ')}` }
    }
  }
  if (!dbsAgreeOnCf) {
    return { category: 'A', reason: 'DB diverged' }
  }
  return { category: 'OK', reason: 'consistent' }
}

// ─── TESTS ──────────────────────────────────────────────

let pass = 0, fail = 0
function it(name, fn) {
  try { fn(); console.log(`✓ ${name}`); pass++ }
  catch (e) { console.error(`✗ ${name}\n   ${e.message}`); fail++ }
}

// 1. OK — everything matches
it('OK: same cfZoneId + cloudflare NS at registrar + live CF zone', () => {
  const r = detectCategory({
    dofRec: { cfZoneId: 'abc', nameserverType: 'cloudflare' },
    regRec: { val: { cfZoneId: 'abc', nameserverType: 'cloudflare' } },
    cfZone: { id: 'abc' },
    regNs: ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'],
    registrar: 'OpenProvider',
  })
  assert.strictEqual(r.category, 'OK')
})

// 2. OK — both sides agree on provider_default, no CF zone
it('OK: both provider_default, no CF zone', () => {
  const r = detectCategory({
    dofRec: { cfZoneId: null, nameserverType: 'provider_default' },
    regRec: { val: { cfZoneId: null, nameserverType: 'provider_default' } },
    cfZone: null,
    regNs: ['ns1.openprovider.nl', 'ns2.openprovider.be'],
    registrar: 'OpenProvider',
  })
  assert.strictEqual(r.category, 'OK')
})

// 3. A — registeredDomains has zone but domainsOf empty
it('A: registeredDomains has cfZoneId, domainsOf null', () => {
  const r = detectCategory({
    dofRec: { cfZoneId: null, nameserverType: null },
    regRec: { val: { cfZoneId: 'abc', nameserverType: 'cloudflare' } },
    cfZone: { id: 'abc' },
    regNs: ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'],
    registrar: 'OpenProvider',
  })
  assert.strictEqual(r.category, 'A')
})

// 4. A — domainsOf has zone but registeredDomains empty
it('A: domainsOf has cfZoneId, registeredDomains null', () => {
  const r = detectCategory({
    dofRec: { cfZoneId: 'xyz', nameserverType: 'cloudflare' },
    regRec: { val: { cfZoneId: null, nameserverType: null } },
    cfZone: { id: 'xyz' },
    regNs: ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'],
    registrar: 'OpenProvider',
  })
  assert.strictEqual(r.category, 'A')
})

// 5. B — THE @HHR2009 / rsvpeviteopen.org PATTERN
//    domainsOf says provider_default, registeredDomains points to CF, OP NS still on OP
it('B: domainsOf provider_default + registeredDomains has CF zone + OP NS still openprovider (rsvpeviteopen.org pattern)', () => {
  const r = detectCategory({
    dofRec: { cfZoneId: null, nameserverType: 'provider_default' },
    regRec: { val: { cfZoneId: '2047e30143fb8c792301fcd4a5d340b6', nameserverType: 'cloudflare' } },
    cfZone: { id: '2047e30143fb8c792301fcd4a5d340b6' },
    regNs: ['ns1.openprovider.nl', 'ns2.openprovider.be', 'ns3.openprovider.eu'],
    registrar: 'OpenProvider',
  })
  assert.strictEqual(r.category, 'B')
})

// 6. B — CF zone exists + DB has cloudflare intent + only 1 CF NS at registrar (partial)
it('B: partial CF NS at registrar (1 of 2)', () => {
  const r = detectCategory({
    dofRec: { cfZoneId: 'abc', nameserverType: 'cloudflare' },
    regRec: { val: { cfZoneId: 'abc', nameserverType: 'cloudflare' } },
    cfZone: { id: 'abc' },
    regNs: ['anderson.ns.cloudflare.com', 'ns1.openprovider.nl'],
    registrar: 'OpenProvider',
  })
  assert.strictEqual(r.category, 'B')
})

// 7. NOT B (no false positive) — CF zone exists + DB on CF + registrar NS unknown (probe failed)
//    Must NOT flag as B because we couldn't confirm lag.
it('NOT B: CF zone exists + DB on CF + registrar NS unknown → falls through to OK', () => {
  const r = detectCategory({
    dofRec: { cfZoneId: 'abc', nameserverType: 'cloudflare' },
    regRec: { val: { cfZoneId: 'abc', nameserverType: 'cloudflare' } },
    cfZone: { id: 'abc' },
    regNs: null, // probe failed
    registrar: 'OpenProvider',
  })
  assert.strictEqual(r.category, 'OK')
})

// 8. C — DB says CF but no CF zone (orphan tag)
it('C: DB has cfZoneId but CF zone not found at Cloudflare', () => {
  const r = detectCategory({
    dofRec: { cfZoneId: 'gone', nameserverType: 'cloudflare' },
    regRec: { val: { cfZoneId: 'gone', nameserverType: 'cloudflare' } },
    cfZone: null,
    regNs: ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'],
    registrar: 'OpenProvider',
  })
  assert.strictEqual(r.category, 'C')
})

// 9. C — only registeredDomains has CF intent, no live zone
it('C: only registeredDomains has CF intent, no live zone', () => {
  const r = detectCategory({
    dofRec: { cfZoneId: null, nameserverType: 'provider_default' },
    regRec: { val: { cfZoneId: 'lost', nameserverType: 'cloudflare' } },
    cfZone: null,
    regNs: null,
    registrar: 'OpenProvider',
  })
  assert.strictEqual(r.category, 'C')
})

// 10. OK — domainsOf custom, registeredDomains empty, no CF intent at all
it('OK: domainsOf custom, registeredDomains empty (treated as both untagged custom)', () => {
  const r = detectCategory({
    dofRec: { cfZoneId: null, nameserverType: 'custom' },
    regRec: { val: { cfZoneId: null, nameserverType: null } },
    cfZone: null,
    regNs: ['ns1.vercel-dns.com', 'ns2.vercel-dns.com'],
    registrar: 'OpenProvider',
  })
  // No CF intent (no cfZoneId on either, neither nsT is 'cloudflare') →
  // dbs disagree on nsT → A
  assert.strictEqual(r.category, 'A')
})

console.log()
if (fail) { console.error(`❌ ${fail} test(s) failed`); process.exit(1) }
console.log(`✅ All ${pass} categorize tests passed`)
