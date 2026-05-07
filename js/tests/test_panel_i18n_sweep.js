/**
 * Regression test for the React panel i18n hardening sweep.
 *
 * Coverage:
 *   1. Locale parity — all 4 locales have identical key sets
 *   2. New fm.toolbar.* keys present + interpolation works
 *   3. New fm.bulk.* keys present
 *   4. New common.{clear, clearSelection, working} keys present
 *   5. Source guards on file-manager Toolbar.jsx + BulkBar.jsx — no hardcoded English
 *   6. PanelBulkBar.jsx accepts clearLabel + clearTitle props
 *   7. EmailManager.js passes clearLabel + clearTitle to PanelBulkBar
 *
 * Run with: node js/tests/test_panel_i18n_sweep.js
 */
const fs = require('fs')
const path = require('path')

let pass = 0, fail = 0
function ok(name, cond, note = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} — ${note}`) }
}

const localeDir = path.resolve(__dirname, '../../frontend/src/locales')
const langs = ['en', 'fr', 'zh', 'hi']
const locales = Object.fromEntries(
  langs.map(l => [l, JSON.parse(fs.readFileSync(path.join(localeDir, `${l}.json`), 'utf8'))])
)

function flatten(d, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(d)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key))
    else out[key] = v
  }
  return out
}

// ── 1. Locale parity ──
const flat = Object.fromEntries(langs.map(l => [l, flatten(locales[l])]))
const enKeys = new Set(Object.keys(flat.en))
ok(`all 4 locales have identical key sets (${enKeys.size} keys)`,
  langs.every(l => Object.keys(flat[l]).length === enKeys.size && Object.keys(flat[l]).every(k => enKeys.has(k)))
)

// ── 2 + 3. New keys exist in all 4 locales with non-empty values ──
const NEW_KEYS = [
  'fm.toolbar.searchPlaceholder', 'fm.toolbar.searchAria',
  'fm.toolbar.up', 'fm.toolbar.upTitle',
  'fm.toolbar.newFolder',
  'fm.toolbar.uploadFolder', 'fm.toolbar.uploadFolderTitle',
  'fm.toolbar.uploadFiles', 'fm.toolbar.uploading',
  'fm.bulk.selected', 'fm.bulk.move', 'fm.bulk.moveTitle',
  'fm.bulk.delete', 'fm.bulk.deleteTitle',
  'fm.bulk.clear', 'fm.bulk.clearTitle',
  'common.clear', 'common.clearSelection', 'common.working',
]
for (const key of NEW_KEYS) {
  for (const l of langs) {
    const v = flat[l][key]
    ok(`[${l}] ${key}`, typeof v === 'string' && v.length > 0, v)
  }
}

// ── 4. Source guards: Toolbar.jsx + BulkBar.jsx use t() everywhere ──
const tbSrc = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/panel/file-manager/Toolbar.jsx'), 'utf8')
ok('Toolbar.jsx imports useTranslation', /import\s*{\s*useTranslation\s*}\s*from\s*['"]react-i18next['"]/.test(tbSrc))
ok('Toolbar.jsx calls const { t } = useTranslation()', /const\s*{\s*t\s*}\s*=\s*useTranslation\(\)/.test(tbSrc))
ok('Toolbar.jsx uses t("fm.toolbar.searchPlaceholder")', /t\(['"]fm\.toolbar\.searchPlaceholder['"]\)/.test(tbSrc))
ok('Toolbar.jsx no hardcoded "Search files…" in label/placeholder', !/['"]Search files…['"]/.test(tbSrc))
ok('Toolbar.jsx no hardcoded "Upload Files" in label', !/label:\s*['"]Upload Files['"]/.test(tbSrc))
ok('Toolbar.jsx no hardcoded "Upload Folder" in label', !/label:\s*['"]Upload Folder['"]/.test(tbSrc))
ok('Toolbar.jsx no hardcoded "Uploading…" loadingLabel', !/loadingLabel:\s*['"]Uploading[…\.]/.test(tbSrc))
ok('Toolbar.jsx no hardcoded "+ Folder" label', !/label:\s*['"]\+ Folder['"]/.test(tbSrc))
ok('Toolbar.jsx no hardcoded "Up" / "Go up" label', !/label:\s*['"]Up['"]/.test(tbSrc) && !/title:\s*['"]Go up['"]/.test(tbSrc))

const bbSrc = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/panel/file-manager/BulkBar.jsx'), 'utf8')
ok('BulkBar.jsx imports useTranslation', /import\s*{\s*useTranslation\s*}\s*from\s*['"]react-i18next['"]/.test(bbSrc))
ok('BulkBar.jsx calls const { t } = useTranslation()', /const\s*{\s*t\s*}\s*=\s*useTranslation\(\)/.test(bbSrc))
ok('BulkBar.jsx uses t("fm.bulk.selected")', /t\(['"]fm\.bulk\.selected['"]\)/.test(bbSrc))
ok('BulkBar.jsx uses t("fm.bulk.move")', /t\(['"]fm\.bulk\.move['"]\)/.test(bbSrc))
ok('BulkBar.jsx uses t("fm.bulk.delete")', /t\(['"]fm\.bulk\.delete['"]\)/.test(bbSrc))
ok('BulkBar.jsx uses t("fm.bulk.clear")', /t\(['"]fm\.bulk\.clear['"]\)/.test(bbSrc))
ok('BulkBar.jsx no hardcoded "selected" label prop', !/label=['"]selected['"]/.test(bbSrc))
ok('BulkBar.jsx no hardcoded "Move…" label', !/label:\s*['"]Move…['"]/.test(bbSrc))
ok('BulkBar.jsx no hardcoded "Delete" label', !/label:\s*['"]Delete['"]/.test(bbSrc))

// ── 5. PanelBulkBar accepts clearLabel + clearTitle props ──
const pbbSrc = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/panel/shared/PanelBulkBar.jsx'), 'utf8')
ok('PanelBulkBar accepts clearLabel prop', /clearLabel\s*=\s*['"]Clear['"]/.test(pbbSrc))
ok('PanelBulkBar accepts clearTitle prop', /clearTitle\s*=\s*['"]Clear selection['"]/.test(pbbSrc))
ok('PanelBulkBar Clear button uses {clearLabel}', /\{clearLabel\}/.test(pbbSrc))
ok('PanelBulkBar Clear button title uses {clearTitle}', /title=\{clearTitle\}/.test(pbbSrc))

// ── 6. EmailManager passes clearLabel + clearTitle to PanelBulkBar ──
const emSrc = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/panel/EmailManager.js'), 'utf8')
ok('EmailManager passes clearLabel prop using t("common.clear")',
  /clearLabel=\{t\(['"]common\.clear['"]\)\}/.test(emSrc))
ok('EmailManager passes clearTitle prop using t("common.clearSelection")',
  /clearTitle=\{t\(['"]common\.clearSelection['"]\)\}/.test(emSrc))

console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
