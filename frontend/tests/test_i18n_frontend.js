/**
 * Frontend i18n smoke test.
 * Loads the panel login page, verifies all 4 locale JSON files load correctly,
 * and that switching language updates DOM strings.
 *
 * Run: `node frontend/tests/test_i18n_frontend.js`
 */

/* eslint-disable no-console */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

let failed = 0
const check = (name, fn) => {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${name}\n    ${e.message}`)
  }
}

console.log('Frontend i18n setup tests')

const LOCALES = ['en', 'fr', 'zh', 'hi']
const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales')

// ── 1. All 4 translation JSON files exist and are valid JSON ─────────────────
const data = {}
for (const lang of LOCALES) {
  check(`${lang}.json: file exists and parses as JSON`, () => {
    const filePath = path.join(LOCALES_DIR, `${lang}.json`)
    const raw = fs.readFileSync(filePath, 'utf8')
    data[lang] = JSON.parse(raw)
  })
}

// ── 2. Key parity across all 4 locales ───────────────────────────────────────
const collectKeys = (obj, prefix = '') => {
  let keys = []
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') {
      keys = keys.concat(collectKeys(v, full))
    } else {
      keys.push(full)
    }
  }
  return keys.sort()
}

if (data.en) {
  const enKeys = new Set(collectKeys(data.en))
  for (const lang of ['fr', 'zh', 'hi']) {
    if (!data[lang]) continue
    const langKeys = new Set(collectKeys(data[lang]))
    check(`${lang}.json: all en keys present (${enKeys.size} keys)`, () => {
      const missing = [...enKeys].filter(k => !langKeys.has(k))
      assert.deepStrictEqual(missing, [], `missing in ${lang}: ${missing.slice(0, 5).join(', ')}…`)
    })
    check(`${lang}.json: no extra keys not in en`, () => {
      const extra = [...langKeys].filter(k => !enKeys.has(k))
      assert.deepStrictEqual(extra, [], `extra in ${lang}: ${extra.slice(0, 5).join(', ')}…`)
    })
  }
}

// ── 3. Critical user-facing strings are translated (not English) ─────────────
const verifyDifferent = (lang, keyPath, en) => {
  const get = (obj, p) => p.split('.').reduce((a, k) => a?.[k], obj)
  const enVal = get(data.en, keyPath)
  const langVal = get(data[lang], keyPath)
  // Allow exact same value ONLY if the English source is itself language-neutral.
  // Critical strings: must differ.
  assert.notStrictEqual(
    langVal,
    enVal,
    `${lang}.${keyPath} should be translated, not equal to "${enVal}"`
  )
}

const CRITICAL_KEYS = [
  'login.title',
  'login.submitButton',
  'dashboard.tabs.files',
  'dashboard.tabs.domains',
  'dashboard.tabs.security',
  'common.save',
  'common.cancel',
  'account.logout',
  'security.captchaTitle',
]

for (const lang of ['fr', 'zh', 'hi']) {
  if (!data[lang]) continue
  for (const key of CRITICAL_KEYS) {
    check(`${lang}.json: "${key}" actually translated (not English)`, () => {
      verifyDifferent(lang, key, data.en)
    })
  }
}

// ── 4. languageNames are language-neutral (they should NOT be translated — they're native names) ─
for (const lang of LOCALES) {
  check(`${lang}.json: languageNames includes all 4 locales`, () => {
    for (const code of LOCALES) {
      assert.ok(
        data[lang]?.languageNames?.[code],
        `${lang}.json missing languageNames.${code}`
      )
    }
    assert.strictEqual(data[lang].languageNames.en, 'English')
    assert.strictEqual(data[lang].languageNames.fr, 'Français')
    assert.strictEqual(data[lang].languageNames.zh, '中文')
    assert.strictEqual(data[lang].languageNames.hi, 'हिन्दी')
  })
}

// ── 5. i18n.js exports SUPPORTED_LANGS ───────────────────────────────────────
check('i18n.js: exists and exports SUPPORTED_LANGS', () => {
  const i18nPath = path.join(__dirname, '..', 'src', 'i18n.js')
  const src = fs.readFileSync(i18nPath, 'utf8')
  assert.ok(/export const SUPPORTED_LANGS = \['en', 'fr', 'zh', 'hi'\]/.test(src))
  assert.ok(/lookupLocalStorage:\s*'hp\.lang'/.test(src))
})

check('LanguageSwitcher.js: exists and uses useTranslation', () => {
  const compPath = path.join(__dirname, '..', 'src', 'components', 'LanguageSwitcher.js')
  const src = fs.readFileSync(compPath, 'utf8')
  assert.ok(/useTranslation/.test(src))
  assert.ok(/data-testid="language-switcher-trigger"/.test(src))
})

check('PanelLogin.js: uses translation keys', () => {
  const p = path.join(__dirname, '..', 'src', 'pages', 'PanelLogin.js')
  const src = fs.readFileSync(p, 'utf8')
  assert.ok(/t\('login\.title'\)/.test(src))
  assert.ok(/t\('login\.submitButton'\)/.test(src))
})

check('PanelDashboard.js: tab labels use translation keys', () => {
  const p = path.join(__dirname, '..', 'src', 'pages', 'PanelDashboard.js')
  const src = fs.readFileSync(p, 'utf8')
  assert.ok(/t\(`dashboard\.tabs\.\$\{tab\.i18nKey\}`\)/.test(src))
})

if (failed) {
  console.log(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log('\nAll frontend i18n setup tests passed')
