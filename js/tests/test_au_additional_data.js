/**
 * Dry-run unit test for the .au-family fix in /app/js/op-service.js
 * NO HTTP calls. Verifies the CORRECTED additional_data schema per
 * OpenProvider's official wiki:
 * https://doc.openprovider.eu/API_Format_Additional_Data
 *
 * Run:  node /app/js/tests/test_au_additional_data.js
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })

const assert = require('assert')
const op     = require('/app/js/op-service.js')

console.log('━━━━ .au additional_data dry-run test ━━━━')

// ── Test 1: env present ────────────────────────────────────────────────
assert.ok(process.env.AU_REGISTRANT_ABN || process.env.AU_REGISTRANT_ACN, 'AU_REGISTRANT_ABN or ACN must be set')
console.log('✓  env vars present')

// ── Test 2: AU_TLDS set ────────────────────────────────────────────────
assert.deepStrictEqual(
  [...op.AU_TLDS].sort(),
  ['au', 'com.au', 'id.au', 'net.au'],
  'AU_TLDS must be au / com.au / id.au / net.au'
)
console.log('✓  AU_TLDS = au / com.au / net.au / id.au (.org.au excluded)')

// ── Test 3: schema for non-id.au TLDs has exactly 4 fields ────────────
const REQUIRED_NON_ID = ['eligibility_type', 'eligibility_type_relationship', 'id_type', 'id_number']
for (const tld of ['au', 'com.au', 'net.au']) {
  const d = op.getCountryTLDData(tld)
  assert.ok(d, `getCountryTLDData('${tld}') must NOT be null`)
  assert.deepStrictEqual(Object.keys(d).sort(), [...REQUIRED_NON_ID].sort(), `[.${tld}] should send exactly the 4 OP-defined fields`)
  assert.match(d.id_number, /^\d+$/, `[.${tld}] id_number must be digits only`)
  assert.ok(['ABN','ACN','ARBN','OTHER','TM'].includes(d.id_type), `[.${tld}] id_type must be a valid OP value`)
  assert.ok(['1','2'].includes(d.eligibility_type_relationship), `[.${tld}] eligibility_type_relationship must be "1" or "2"`)
  // Per OP KB: for Company entity_type, use ACN (not ABN) — registry blocks ABN-on-Company.
  if (d.eligibility_type === 'Company' && !process.env.AU_REGISTRANT_ID_TYPE) {
    assert.strictEqual(d.id_type, 'ACN', `[.${tld}] when entity=Company and no explicit override, id_type must default to ACN`)
  }
  console.log(`✓  .${tld} → 4 OP-correct fields: ${JSON.stringify(d)}`)
}

// ── Test 4: .id.au has only 2 fields (no id_type / id_number) ─────────
const id_au = op.getCountryTLDData('id.au')
assert.ok(id_au, '.id.au should return data')
assert.deepStrictEqual(
  Object.keys(id_au).sort(),
  ['eligibility_type', 'eligibility_type_relationship'],
  '.id.au should have ONLY eligibility_type + eligibility_type_relationship'
)
console.log(`✓  .id.au → 2 fields only: ${JSON.stringify(id_au)}`)

// ── Test 5: .org.au excluded ───────────────────────────────────────────
assert.strictEqual(op.getCountryTLDData('org.au'), null, '.org.au must return null (excluded)')
console.log('✓  .org.au correctly returns null')

// ── Test 6: fail-fast when ABN+ACN both unset (non-id.au) ─────────────
const saved = { abn: process.env.AU_REGISTRANT_ABN, acn: process.env.AU_REGISTRANT_ACN }
delete process.env.AU_REGISTRANT_ABN
delete process.env.AU_REGISTRANT_ACN
for (const tld of ['au', 'com.au', 'net.au']) {
  assert.strictEqual(op.getCountryTLDData(tld), null, `[.${tld}] must return null when no ABN/ACN set`)
}
// .id.au still works (no ID needed)
assert.ok(op.getCountryTLDData('id.au'), '.id.au must work even without ABN/ACN (it does not need one)')
process.env.AU_REGISTRANT_ABN = saved.abn
process.env.AU_REGISTRANT_ACN = saved.acn
console.log('✓  fail-fast: .au/.com.au/.net.au return null when ABN+ACN unset; .id.au remains valid')

// ── Test 7: no regression on .us / .ca / unknown ──────────────────────
assert.deepStrictEqual(op.getCountryTLDData('us'), { application_purpose: 'P1', nexus_category: 'C12' })
assert.deepStrictEqual(op.getCountryTLDData('ca'), { legal_type: 'CCT' })
assert.strictEqual(op.getCountryTLDData('zz'), null)
console.log('✓  .us / .ca / unknown TLDs behave as before')

console.log('\n━━━━ ALL ASSERTIONS PASSED ━━━━')
