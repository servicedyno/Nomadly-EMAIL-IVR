/**
 * Unit tests for /app/js/dns-hostname-normalizer.js
 *
 * Covers the iMr_Brown / @Night_ismine fix:
 *   - Strip trailing `.{zoneName}` from hostnames so users can paste
 *     either `www` or `www.example.com` without creating a duplicated
 *     record name like `www.example.com.example.com`.
 *   - Reject hostnames that belong to a different domain.
 *   - Detect already-broken records (`www.zone.zone`).
 *
 * Run:  node js/__tests__/dns-hostname-normalizer.test.js
 */

const {
  normalizeHostname,
  detectDuplicatedZone,
} = require('../dns-hostname-normalizer')

let passed = 0
let failed = 0
const fails = []

function assert(label, cond, extra) {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${label}`)
  } else {
    failed += 1
    fails.push({ label, extra })
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`)
  }
}

function eq(label, actual, expected) {
  assert(label, actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

console.log('\ndns-hostname-normalizer — unit tests')
console.log('────────────────────────────────────')

// ─── normalizeHostname ───
console.log('\n[normalizeHostname — pass-through]')
eq('@ stays as @',                          normalizeHostname('@', 'example.com').value, '@')
eq('www stays as www',                      normalizeHostname('www', 'example.com').value, 'www')
eq('api stays as api',                      normalizeHostname('api', 'example.com').value, 'api')
eq('_dmarc stays as _dmarc',                normalizeHostname('_dmarc', 'example.com').value, '_dmarc')
eq('neo1._domainkey stays as neo1._domainkey', normalizeHostname('neo1._domainkey', 'example.com').value, 'neo1._domainkey')

console.log('\n[normalizeHostname — strip trailing zone]')
let r
r = normalizeHostname('www.example.com', 'example.com')
assert('www.example.com → www (ok+stripped)',     r.ok && r.value === 'www' && r.stripped === true)
r = normalizeHostname('www.example.com.', 'example.com')
assert('www.example.com. → www (FQDN dot)',       r.ok && r.value === 'www' && r.stripped === true)
r = normalizeHostname('example.com', 'example.com')
assert('example.com → @ (apex collapse)',          r.ok && r.value === '@' && r.stripped === true)
r = normalizeHostname('example.com.', 'example.com')
assert('example.com. → @ (apex collapse FQDN)',    r.ok && r.value === '@' && r.stripped === true)
r = normalizeHostname('api.sub.example.com', 'example.com')
assert('api.sub.example.com → api.sub',            r.ok && r.value === 'api.sub' && r.stripped === true)
r = normalizeHostname('WWW.EXAMPLE.COM', 'example.com')
assert('WWW.EXAMPLE.COM (uppercase) → WWW',        r.ok && r.value === 'WWW' && r.stripped === true)
r = normalizeHostname('www.example.com', 'EXAMPLE.COM')
assert('zone uppercase still matches',             r.ok && r.value === 'www' && r.stripped === true)

console.log('\n[normalizeHostname — foreign domain rejected]')
r = normalizeHostname('www.other-domain.com', 'example.com')
assert('www.other-domain.com REJECTED',           !r.ok && r.reason === 'foreign-domain')
r = normalizeHostname('mail.google.com', 'example.com')
assert('mail.google.com REJECTED',                !r.ok && r.reason === 'foreign-domain')

console.log('\n[normalizeHostname — underscore labels with dots stay valid]')
r = normalizeHostname('neo1._domainkey', 'example.com')
assert('neo1._domainkey accepted (no zone match)',  r.ok && r.value === 'neo1._domainkey')
r = normalizeHostname('_dmarc.example.com', 'example.com')
assert('_dmarc.example.com → _dmarc (strip zone)',  r.ok && r.value === '_dmarc' && r.stripped === true)

console.log('\n[normalizeHostname — edge cases]')
eq('empty string passes through',           normalizeHostname('', 'example.com').value, '')
eq('non-string passes through (number)',    normalizeHostname(123, 'example.com').value, 123)
r = normalizeHostname('www', '')
assert('empty zone leaves hostname alone',  r.ok && r.value === 'www')

// ─── detectDuplicatedZone ───
console.log('\n[detectDuplicatedZone]')
eq('www.example.com.example.com → www',
  detectDuplicatedZone('www.example.com.example.com', 'example.com'),
  'www.example.com')
// NOTE: above is the raw "strip one trailing .zone" — the bot then re-normalizes via normalizeHostname.
// Verify that the final pipeline (detect → normalize) produces "www".
const broken = 'www.example.com.example.com'
const onceStripped = detectDuplicatedZone(broken, 'example.com')
const finalNorm = normalizeHostname(onceStripped, 'example.com')
eq('detect→normalize pipeline produces "www"', finalNorm.value, 'www')

eq('api.sub.example.com.example.com → api.sub.example.com',
  detectDuplicatedZone('api.sub.example.com.example.com', 'example.com'),
  'api.sub.example.com')
const onceStripped2 = detectDuplicatedZone('api.sub.example.com.example.com', 'example.com')
eq('detect→normalize produces "api.sub"',
  normalizeHostname(onceStripped2, 'example.com').value, 'api.sub')

eq('plain www.example.com → null (not duplicated)',
  detectDuplicatedZone('www.example.com', 'example.com'), null)
eq('plain www → null',
  detectDuplicatedZone('www', 'example.com'), null)
eq('case-insensitive match works',
  detectDuplicatedZone('WWW.example.COM.EXAMPLE.com', 'example.com'),
  'WWW.example.COM')
eq('different zone → null',
  detectDuplicatedZone('www.example.com.example.com', 'other-domain.com'), null)
eq('null inputs handled',
  detectDuplicatedZone(null, 'example.com'), null)

// ─── @Night_ismine real-world scenario ───
console.log('\n[scenario] @Night_ismine — www.verify-navy.com')
r = normalizeHostname('www.verify-navy.com', 'verify-navy.com')
assert('www.verify-navy.com → www',  r.ok && r.value === 'www' && r.stripped === true)
const ngmFixed = detectDuplicatedZone('www.verify-navy.com.verify-navy.com', 'verify-navy.com')
assert('broken record detected', ngmFixed === 'www.verify-navy.com')
const ngmFinal = normalizeHostname(ngmFixed, 'verify-navy.com')
assert("pipeline auto-fixes to 'www'", ngmFinal.value === 'www' && ngmFinal.stripped === true)

console.log('\n────────────────────────────────────')
console.log(`Result: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  for (const f of fails) console.log(' -', f.label, f.extra || '')
  process.exit(1)
}
process.exit(0)
