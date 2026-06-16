/**
 * Dry-run unit test for the .au-family fix in /app/js/op-service.js
 * NO HTTP calls are made — we only exercise getCountryTLDData() and AU_TLDS.
 *
 * Run with:  node /app/js/tests/test_au_additional_data.js
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })

const assert = require('assert')
const op     = require('/app/js/op-service.js')

console.log('━━━━ .au additional_data dry-run test ━━━━')

const REQUIRED = [
  'eligibility_name', 'eligibility_id_type', 'eligibility_id',
  'eligibility_type', 'registrant_name',     'registrant_id_type',
  'registrant_id',    'policy_reason',
]

// ── Test 1: env vars are present ────────────────────────────────────────
assert.ok(process.env.AU_REGISTRANT_ABN,  'AU_REGISTRANT_ABN must be set in .env')
assert.ok(process.env.AU_REGISTRANT_NAME, 'AU_REGISTRANT_NAME must be set in .env')
console.log('✓  env vars present (ABN, NAME)')

// ── Test 2: AU_TLDS set contents ───────────────────────────────────────
assert.deepStrictEqual(
  [...op.AU_TLDS].sort(),
  ['au', 'com.au', 'id.au', 'net.au'],
  'AU_TLDS must cover au / com.au / net.au / id.au (org.au intentionally excluded)'
)
console.log('✓  AU_TLDS covers au / com.au / net.au / id.au')

// ── Test 3: schema for every .au-family TLD ────────────────────────────
for (const tld of op.AU_TLDS) {
  const d = op.getCountryTLDData(tld)
  assert.ok(d, `getCountryTLDData('${tld}') must NOT be null when env is set`)
  for (const k of REQUIRED) {
    assert.ok(d[k] !== undefined && d[k] !== '', `[.${tld}] missing required field "${k}"`)
  }
  assert.match(d.registrant_id, /^\d+$/, `[.${tld}] registrant_id must be digits only`)
  assert.strictEqual(d.registrant_id.length, 11, `[.${tld}] ABN must be exactly 11 digits`)
  assert.strictEqual(d.eligibility_id, d.registrant_id, `[.${tld}] eligibility_id must equal registrant_id`)
  console.log(`✓  .${tld} → 8 required fields present, ABN format OK`)
}

// ── Test 4: .org.au is intentionally NOT supported ─────────────────────
assert.strictEqual(op.getCountryTLDData('org.au'), null, '.org.au must return null (non-profit-only)')
console.log('✓  .org.au correctly returns null (non-profit-only)')

// ── Test 5: fail-fast when env is missing ──────────────────────────────
const saved = { abn: process.env.AU_REGISTRANT_ABN, name: process.env.AU_REGISTRANT_NAME }
delete process.env.AU_REGISTRANT_ABN
delete process.env.AU_REGISTRANT_NAME
for (const tld of op.AU_TLDS) {
  assert.strictEqual(op.getCountryTLDData(tld), null, `[.${tld}] must return null when AU env vars are unset`)
}
process.env.AU_REGISTRANT_ABN  = saved.abn
process.env.AU_REGISTRANT_NAME = saved.name
console.log('✓  fail-fast: all .au TLDs return null when env vars are unset')

// ── Test 6: other TLDs still work unchanged ────────────────────────────
const us = op.getCountryTLDData('us')
assert.deepStrictEqual(us, { application_purpose: 'P1', nexus_category: 'C12' }, '.us schema unchanged')
const ca = op.getCountryTLDData('ca')
assert.deepStrictEqual(ca, { legal_type: 'CCT' }, '.ca schema unchanged')
const unknown = op.getCountryTLDData('zz')
assert.strictEqual(unknown, null, 'unknown TLD returns null')
console.log('✓  .us / .ca / unknown TLDs behave as before (no regression)')

console.log('\n━━━━ ALL ASSERTIONS PASSED ━━━━')
