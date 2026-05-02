#!/usr/bin/env node
/**
 * lint:panel-lang — Parity gate for the React hosting panel locales.
 *
 * Verifies that frontend/src/locales/{fr,hi,zh}.json have the same key
 * surface as en.json (recursively). Catches drift like:
 *   - en.json gets a new key but fr/hi/zh don't
 *   - accidental key typos in only one locale
 *
 * Complements scripts/check_lang_parity.js (which covers the Telegram
 * bot locales in /app/js/lang/*.js).
 *
 * Exit 1 on any drift, 0 on full parity.
 *
 * Usage: node scripts/check_panel_lang_parity.js
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join('/app/frontend/src/locales');
const TARGETS = ['fr', 'hi', 'zh'];
const SOURCE = 'en';

function load(name) {
  const fp = path.join(LOCALES_DIR, `${name}.json`);
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function deepKeys(obj, prefix = '') {
  const keys = [];
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return keys;
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    keys.push(fullKey);
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...deepKeys(v, fullKey));
    }
  }
  return keys;
}

// Also scan for placeholder/HTML-tag consistency on LEAF strings — if en.json
// says 'Foo {{name}} <strong>bar</strong>', fr/hi/zh must include the same
// {{name}} and <strong></strong> tokens (otherwise i18next renders broken).
function leafStrings(obj, prefix = '') {
  const out = {};
  if (obj === null || typeof obj !== 'object') return out;
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (typeof v === 'string') out[fullKey] = v;
    else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, leafStrings(v, fullKey));
    }
  }
  return out;
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g;
const TAG = /<\/?[a-z][a-z0-9]*>/gi;

function tokens(s) {
  return {
    placeholders: [...s.matchAll(PLACEHOLDER)].map(m => m[1]).sort(),
    tags: [...s.matchAll(TAG)].map(m => m[0].toLowerCase()).sort(),
  };
}

function tokensEqual(a, b) {
  return a.placeholders.join(',') === b.placeholders.join(',') &&
         a.tags.join(',') === b.tags.join(',');
}

const en = load(SOURCE);
const enKeys = new Set(deepKeys(en));
const enLeaves = leafStrings(en);

let errors = 0;
for (const lang of TARGETS) {
  let lgErrors = 0;
  const tgt = load(lang);
  const tgtKeys = new Set(deepKeys(tgt));
  const tgtLeaves = leafStrings(tgt);

  // 1. Missing keys
  const missing = [...enKeys].filter(k => !tgtKeys.has(k));
  if (missing.length) {
    lgErrors += missing.length;
    console.error(`\n[${lang}] ${missing.length} missing key(s):`);
    missing.slice(0, 20).forEach(k => console.error(`  - ${k}`));
    if (missing.length > 20) console.error(`  … and ${missing.length - 20} more`);
  }

  // 2. Extra keys (possibly stale / dead translations)
  const extra = [...tgtKeys].filter(k => !enKeys.has(k));
  if (extra.length) {
    console.warn(`\n[${lang}] ${extra.length} stale/extra key(s) not in en.json:`);
    extra.slice(0, 10).forEach(k => console.warn(`  - ${k}`));
  }

  // 3. Placeholder / HTML tag drift on shared leaves
  const drift = [];
  for (const [key, enVal] of Object.entries(enLeaves)) {
    const tgtVal = tgtLeaves[key];
    if (typeof tgtVal !== 'string') continue;
    const enTok = tokens(enVal);
    const tgtTok = tokens(tgtVal);
    if (!tokensEqual(enTok, tgtTok)) {
      drift.push({ key, en: enTok, [lang]: tgtTok });
    }
  }
  if (drift.length) {
    lgErrors += drift.length;
    console.error(`\n[${lang}] ${drift.length} placeholder/tag drift(s):`);
    drift.slice(0, 10).forEach(d => {
      console.error(`  - ${d.key}`);
      console.error(`      en:   placeholders=[${d.en.placeholders.join(',')}] tags=[${d.en.tags.join(',')}]`);
      console.error(`      ${lang}:   placeholders=[${d[lang].placeholders.join(',')}] tags=[${d[lang].tags.join(',')}]`);
    });
  }

  if (lgErrors === 0) {
    console.log(`✓ ${lang}: parity with en (${enKeys.size} keys, placeholders + tags verified)`);
  }
  errors += lgErrors;
}

if (errors > 0) {
  console.error(`\n✗ Parity check FAILED — ${errors} issue(s) across ${TARGETS.join(', ')}`);
  process.exit(1);
}
console.log(`\n✓ All ${TARGETS.length} target locales are in parity with en.json.`);
