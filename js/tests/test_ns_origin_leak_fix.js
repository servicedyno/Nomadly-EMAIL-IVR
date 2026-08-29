/**
 * Static regression suite for FIX 1 — WHM origin-IP leak in the storefront
 * `nameservers` payload.
 *
 * These are SOURCE greps (no runtime, no DB, no network) so they can run in any
 * environment and guard against a naive "fix" that re-introduces the origin-IP
 * leak (e.g. re-adding ns1.${WHM_HOST} or rendering an object with a truthy
 * `.length` guard).
 *
 * Run with: node js/tests/test_ns_origin_leak_fix.js
 */

const fs = require('fs')
const path = require('path')

let pass = 0, fail = 0
function ok(name, cond, note = '') {
  if (cond) { pass++; console.log(`  \u2713 ${name}`) }
  else { fail++; console.log(`  \u2717 ${name} — ${note}`) }
}

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')

const whm  = read('whm-service.js')
const crr  = read('cr-register-domain-&-create-cpanel.js')
const store = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'Storefront.js'), 'utf8')

console.log('\nFIX 1 — whm-service.js createAccount()')
// The fake origin-IP nameservers object must be gone from the return.
ok('no `ns1: `ns1.${WHM_HOST}`` literal', !whm.includes('ns1: `ns1.${WHM_HOST}`'), 'origin-IP ns1 literal still present')
ok('no `ns2: `ns2.${WHM_HOST}`` literal', !whm.includes('ns2: `ns2.${WHM_HOST}`'), 'origin-IP ns2 literal still present')
ok('no `nameservers: {` object in source', !/nameservers:\s*\{/.test(whm), 'nameservers object literal still present')
ok('JSDoc @returns no longer advertises nameservers', /@returns \{\{ success, username, password, domain, url, error \}\}/.test(whm), '@returns still lists nameservers')
// createAccount must still return the real fields it always did.
const retBlock = whm.slice(whm.indexOf('return {\n        success: true,'), whm.indexOf('package: pkg,') + 20)
ok('createAccount still returns success', /success:\s*true/.test(retBlock), 'missing success')
ok('createAccount still returns username', /\busername\b/.test(retBlock), 'missing username')
ok('createAccount still returns password', /\bpassword\b/.test(retBlock), 'missing password')
ok('createAccount still returns domain', /\bdomain\b/.test(retBlock), 'missing domain')
ok('createAccount still returns url', /url:\s*`https:\/\/\$\{WHM_HOST\}:2083`/.test(retBlock), 'missing url')

console.log('\nFIX 1 — cr-register-domain-&-create-cpanel.js')
ok('final success return uses Array.isArray(cfNameservers)',
  /return \{ success: true,[^}]*nameservers: Array\.isArray\(cfNameservers\) \? cfNameservers : \[\]/.test(crr),
  'final return does not use Array.isArray(cfNameservers)')
ok('internal response object uses Array.isArray(cfNameservers)',
  /const response = \{[\s\S]*?nameservers: Array\.isArray\(cfNameservers\) \? cfNameservers : \[\][\s\S]*?\}/.test(crr),
  'internal response object still uses result.nameservers')
ok('no `result.nameservers` anywhere in the file',
  !/result\.nameservers/.test(crr),
  'result.nameservers still referenced (leak vector)')
ok('cfNameservers = reg.val.nameservers branch still present', /cfNameservers = reg\.val\.nameservers/.test(crr), 'existing-zone lookup branch missing')
ok('cfNameservers = liveZone.name_servers branch still present', /cfNameservers = liveZone\.name_servers/.test(crr), 'existing CF zone branch missing')
ok('cfNameservers = zone.nameservers branch still present', /cfNameservers = zone\.nameservers/.test(crr), 'freshly-created zone branch missing')

console.log('\nFIX 1 — frontend Storefront.js')
ok('crypto path guards with Array.isArray + length >= 2',
  /Array\.isArray\(creds\.nameservers\) && creds\.nameservers\.length >= 2/.test(store),
  'crypto path missing defensive Array.isArray/length guard')
ok('wallet path guards with Array.isArray + length >= 2',
  /Array\.isArray\(result\.nameservers\) && result\.nameservers\.length >= 2/.test(store),
  'wallet path missing defensive Array.isArray/length guard')
ok('crypto testids present',
  ['store-crypto-ns-callout', 'store-crypto-ns-1', 'store-crypto-ns-2'].every(t => store.includes(t)),
  'missing crypto NS testids')
ok('wallet testids present',
  ['store-purchase-ns-callout', 'store-purchase-ns-1', 'store-purchase-ns-2'].every(t => store.includes(t)),
  'missing wallet NS testids')
ok('old `nameservers.join(\', \')` fallback deleted',
  !/nameservers\.join\(', '\)/.test(store),
  'old join() single-line fallback still present')

console.log(`\nFIX 1 NS-leak suite: ${pass} passed, ${fail} failed (total ${pass + fail})`)
process.exit(fail === 0 ? 0 : 1)
