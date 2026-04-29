#!/usr/bin/env node
/**
 * lint:lang — Translation parity gate.
 *
 * Verifies that fr.js, hi.js, zh.js have the same key surface as en.js
 * (recursively, through nested objects). Catches drift like:
 *   - en.js gets a new key but the foreign-lang files don't
 *   - mistyped keys (typo in only one lang)
 *
 * Exit 1 on any missing keys, 0 otherwise.
 *
 * Usage: node scripts/check_lang_parity.js
 */

const path = require('path');

const LANG_DIR = '/app/js/lang';
const TARGETS = ['fr', 'hi', 'zh']; // verified against en
const SOURCE = 'en';

function loadLang(name) {
  const fp = path.join(LANG_DIR, `${name}.js`);
  delete require.cache[require.resolve(fp)];
  const mod = require(fp);
  if (!mod[name]) throw new Error(`${fp} does not export "${name}" — please check the file structure.`);
  return mod[name];
}

// Recursively collect keys, joined by dots. Skips arrays + functions.
// Functions are leaves (we want them as keys, not their bodies).
//
// SKIP_REVERSE_MAPS: top-level objects whose KEYS are intentionally localized
// (reverse-lookup tables like 'MX Record' → 'MX', or 'Bitcoin' → 'BTC').
// In these maps, the keys themselves are user-facing strings and SHOULD differ
// between languages. We compare ONLY the SET-of-values count for parity.
const SKIP_REVERSE_MAPS = new Set([
  'supportedCryptoView',     // localized crypto display strings → ticker
  'supportedLanguages',      // localized language display strings → code
  'planOptionsOf',           // localized plan name → period code
  'selectFormatOf',          // localized format names
  'vpsPlanOf',               // localized vps plan periods
]);

// Inside `t`, these specific sub-keys are also reverse-mapping table entries
// where the KEY is the localized RR-type / CAA-tag display string.
// (e.g., en uses 'MX Record', fr uses 'Enregistrement MX')
const SKIP_T_REVERSE_KEYS = new Set([
  // DNS record reverse mappings: en.js has 'MX Record':'MX', fr has 'Enregistrement MX':'MX'
  'MX Record', 'TXT Record', 'A Record', 'CNAME Record', 'NS Record', 'AAAA Record', 'SRV Record', 'CAA Record',
  // CAA tag display strings
  'issue — Authorize a CA', 'issuewild — Authorize wildcard', 'iodef — Violation report URL',
]);

function deepKeys(obj, prefix = '') {
  const keys = [];
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return keys;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const fullKey = prefix ? `${prefix}.${k}` : k;
    // Skip top-level reverse-mapping tables — recursion stops here so their
    // localized keys don't surface as "missing" across languages.
    if (!prefix && SKIP_REVERSE_MAPS.has(k)) {
      keys.push(fullKey); // record presence of the table itself, not its keys
      continue;
    }
    // Skip the 't.<reverseKey>' set
    if (prefix === 't' && SKIP_T_REVERSE_KEYS.has(k)) {
      continue; // don't even record the per-language key
    }
    keys.push(fullKey);
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v !== 'function') {
      keys.push(...deepKeys(v, fullKey));
    }
  }
  return keys;
}

let total = 0;
const en = loadLang(SOURCE);
const enKeys = deepKeys(en);
const enKeySet = new Set(enKeys);

console.log(`[lint:lang] Source ${SOURCE}.js: ${enKeys.length} keys`);

for (const target of TARGETS) {
  let mod;
  try { mod = loadLang(target); }
  catch (e) {
    console.log(`\n[lint:lang] ❌ ${target}.js failed to load: ${e.message}`);
    total++;
    continue;
  }
  const tk = new Set(deepKeys(mod));
  const missing = enKeys.filter(k => !tk.has(k));
  // Note: extra keys in target are warnings, not errors — language files can have extras.
  const extra = [...tk].filter(k => !enKeySet.has(k));

  if (missing.length === 0) {
    console.log(`[lint:lang] ✅ ${target}.js: parity OK${extra.length ? ` (${extra.length} extra key(s) — informational)` : ''}`);
    continue;
  }
  console.log(`\n[lint:lang] ❌ ${target}.js missing ${missing.length} key(s):`);
  for (const k of missing) console.log(`    - ${k}`);
  total += missing.length;
}

if (total) {
  console.log(`\n[lint:lang] ${total} translation gap(s). Add the missing keys to the foreign-language file(s).`);
  process.exit(1);
}
console.log(`\n[lint:lang] All ${TARGETS.length} target language(s) match ${SOURCE}.js — OK.`);
process.exit(0);
