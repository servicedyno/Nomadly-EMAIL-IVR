/**
 * Regression test for the storefront origin-IP-leak fix (upstream 2026-08-29),
 * adapted to this WhiteLabel branch's source (which already carries the fix).
 *
 * The bug (now closed):
 *   1. `whm-service.createAccount` used to return
 *      `nameservers: { ns1: 'ns1.<WHM_HOST>', ns2: 'ns2.<WHM_HOST>' }` — the
 *      origin host. Meaningless to the user AND an origin-IP-leak vector to any
 *      browser that fetched /api/store/order/:orderId.
 *   2. `cr-register-domain-&-create-cpanel.js` propagated that object into
 *      `webOrders.nameservers` and its success payload.
 *   3. Storefront React then rendered/handled the object shape.
 *
 * Fixed state (asserted below via static source checks — no live services):
 *   (A) whm-service.js no longer returns any origin-based `nameservers`, and
 *       documents WHY (WHM_HOST is the origin).
 *   (B) cr-register-domain-&-create-cpanel.js returns the REAL Cloudflare /
 *       registrar nameservers (an array), never `result.nameservers`.
 *   (C) Storefront.js guards nameservers with `Array.isArray` so an accidental
 *       object shape can never paint the origin IP in front of a shopper.
 *
 * Path-resolves from __dirname (NOT hardcoded /app) so it also passes on the
 * GitHub Actions runner.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
function slurp(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

let fails = 0;
function ok(name, cond, extra = '') {
  if (cond) { console.log(`  \u2705 ${name}`); }
  else { console.log(`  \u274c ${name}${extra ? ' — ' + extra : ''}`); fails++; }
}

const whm = slurp('js/whm-service.js');
const reg = slurp('js/cr-register-domain-&-create-cpanel.js');
const store = slurp('frontend/src/pages/Storefront.js');

console.log('=== (A) whm-service.js — origin-IP nameservers removed ===');
ok('createAccount return no longer builds `ns1.${WHM_HOST}` nameserver',
  !/ns1:\s*`ns1\.\$\{WHM_HOST\}`/.test(whm));
ok('no `nameservers: {` object literal inside a return block',
  !/return\s*\{[\s\S]{0,400}nameservers:\s*\{[\s\S]*?ns1:[\s\S]*?ns2:/.test(whm));
ok('documents WHY nameservers are not returned (WHM_HOST is the origin)',
  /WHM_HOST is (the|our) origin/i.test(whm));

console.log('\n=== (B) cr-register-domain — returns real CF NS array, not WHM object ===');
const arrReturns = (reg.match(/nameservers:\s*Array\.isArray\(cfNameservers\)/g) || []).length;
ok('success payload(s) use `Array.isArray(cfNameservers)` (>= 2 call sites)',
  arrReturns >= 2, `found ${arrReturns}`);
ok('never returns the WHM origin object `nameservers: result.nameservers`',
  !/nameservers:\s*result\.nameservers/.test(reg));
ok('cfNameservers sourced from the real CF/registrar branches',
  /cfNameservers\s*=\s*reg\.val\.nameservers/.test(reg) &&
  /cfNameservers\s*=\s*liveZone\.name_servers/.test(reg) &&
  /cfNameservers\s*=\s*zone\.nameservers/.test(reg));

console.log('\n=== (C) Storefront.js — Array.isArray guard on both callouts ===');
const guards = (store.match(/Array\.isArray\(\w+\.nameservers\)\s*&&\s*\w+\.nameservers\.length\s*>=\s*2/g) || []).length;
ok('crypto + purchase callouts both guard with Array.isArray + length>=2',
  guards >= 2, `found ${guards}`);
ok('renders nameserver entries as string <code>, not raw objects',
  /<code[^>]*store-crypto-ns-1[^>]*>\{[^}]*nameservers\[0\]\}<\/code>/.test(store) ||
  /nameservers\[0\]\}<\/code>/.test(store));

if (fails) { console.log(`\n\u274c ${fails} assertion(s) failed`); process.exit(1); }
console.log('\n\u2705 origin-IP-leak protection intact (whm-service + cr-register + Storefront)');
process.exit(0);
