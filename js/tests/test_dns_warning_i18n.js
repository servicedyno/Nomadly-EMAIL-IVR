/**
 * Regression test for domain-origin indicator + DNS warning copy translation.
 *
 * Ensures:
 *   1. `domainTypeRegistered` and `domainTypeExternal` exist with matching
 *      visual emoji prefix in all 4 locales.
 *   2. `dnsWarningHostedDomain(domain, plan)` exists in all 4 locales,
 *      embeds both args, and contains a translated warning marker.
 *   3. `dnsProceedAnyway` and `dnsCancel` exist in all 4 locales.
 *   4. _index.js no longer has dead English-fallback `||` patterns for these
 *      five keys.
 *   5. _index.js uses `trans('t.<key>')` for these — picks up user lang.
 *
 * Run with: node js/tests/test_dns_warning_i18n.js
 */
const fs = require('fs')
const path = require('path')
const { translation } = require('../translation')

let pass = 0, fail = 0
function ok(name, cond, note = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} — ${note}`) }
}

const langs = ['en', 'fr', 'zh', 'hi']

// ── 1 + 2 + 3: keys present per locale via translation() runtime ──
for (const l of langs) {
  const reg = translation('t.domainTypeRegistered', l)
  const ext = translation('t.domainTypeExternal', l)
  ok(`[${l}] t.domainTypeRegistered resolves`, typeof reg === 'string' && reg.length > 0, reg)
  ok(`[${l}] t.domainTypeExternal resolves`, typeof ext === 'string' && ext.length > 0, ext)
  ok(`[${l}] domainTypeRegistered has tag emoji`, /🏷️/.test(reg))
  ok(`[${l}] domainTypeExternal has globe emoji`, /🌍/.test(ext))

  const warn = translation('t.dnsWarningHostedDomain', l, 'example.com', 'Premium Weekly')
  ok(`[${l}] t.dnsWarningHostedDomain resolves to a string`, typeof warn === 'string' && warn.length > 50, String(warn).slice(0,80))
  ok(`[${l}] dnsWarningHostedDomain interpolates domain`, /example\.com/.test(warn))
  ok(`[${l}] dnsWarningHostedDomain interpolates plan`, /Premium Weekly/.test(warn))
  ok(`[${l}] dnsWarningHostedDomain has warning marker (⚠️)`, /⚠️/.test(warn))

  const proceed = translation('t.dnsProceedAnyway', l)
  const cancel  = translation('t.dnsCancel', l)
  ok(`[${l}] t.dnsProceedAnyway resolves`, typeof proceed === 'string' && proceed.length > 0, proceed)
  ok(`[${l}] t.dnsCancel resolves`, typeof cancel === 'string' && cancel.length > 0, cancel)
}

// ── 4: dead fallbacks removed from _index.js ──
const indexSrc = fs.readFileSync(path.resolve(__dirname, '../_index.js'), 'utf8')

ok('no `t.domainTypeRegistered || ` fallback in _index.js',
  !/t\.domainTypeRegistered\s*\|\|/.test(indexSrc))
ok('no `t.domainTypeExternal || ` fallback in _index.js',
  !/t\.domainTypeExternal\s*\|\|/.test(indexSrc))
ok('no `t.dnsWarningHostedDomain ?` ternary fallback in _index.js',
  !/t\.dnsWarningHostedDomain\s*\?/.test(indexSrc))
ok('no `t.dnsProceedAnyway || ` fallback in _index.js',
  !/t\.dnsProceedAnyway\s*\|\|/.test(indexSrc))
ok('no `t.dnsCancel || ` fallback in _index.js',
  !/t\.dnsCancel\s*\|\|/.test(indexSrc))
ok('no inline English DNS-warning copy in _index.js',
  !/WARNING: This domain has an active hosting plan/.test(indexSrc))

// ── 5: _index.js routes through trans() so user language is honored ──
ok("_index uses trans('t.domainTypeRegistered')",
  /trans\(['"]t\.domainTypeRegistered['"]\)/.test(indexSrc))
ok("_index uses trans('t.domainTypeExternal')",
  /trans\(['"]t\.domainTypeExternal['"]\)/.test(indexSrc))
ok("_index uses trans('t.dnsWarningHostedDomain', domain, plan)",
  /trans\(['"]t\.dnsWarningHostedDomain['"],\s*domain/.test(indexSrc))
ok("_index uses trans('t.dnsProceedAnyway')",
  /trans\(['"]t\.dnsProceedAnyway['"]\)/.test(indexSrc))
ok("_index uses trans('t.dnsCancel')",
  /trans\(['"]t\.dnsCancel['"]\)/.test(indexSrc))

console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
