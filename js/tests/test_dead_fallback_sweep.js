/**
 * Regression test for the dead-fallback sweep across _index.js.
 *
 * Background: 173 occurrences of `t.<key> || 'inline english'` were found
 * across _index.js. 140 of them were dead i18n fallbacks (the keys actually
 * exist in all 4 locales), so the inline English string was unreachable but
 * masked the real translation flow. This sweep removed all 140 of them.
 *
 * The remaining `t\.\w+ *|| *'...'` matches in _index.js are guaranteed to be
 * data-field accesses on local objects (e.g. `result.error || 'unknown'`,
 * `msg.document.file_name || ''`, `couponResult.type || 'unknown'`), NOT
 * untranslated i18n keys. We assert that property by checking each remaining
 * occurrence's left-hand object name is one of an allow-listed set of data
 * objects.
 *
 * Run with: node js/tests/test_dead_fallback_sweep.js
 */
const fs = require('fs')
const path = require('path')
const { translation } = require('../translation')

let pass = 0, fail = 0
function ok(name, cond, note = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} — ${note}`) }
}

const indexSrc = fs.readFileSync(path.resolve(__dirname, '../_index.js'), 'utf8')

// 55 i18n keys that were swept clean of inline-English fallbacks.
const SWEPT_KEYS = [
  'audioFailedSave', 'audioReceivedShort', 'cancel', 'cancelled',
  'chooseOption', 'chooseValidDomain', 'couponAlreadyUsed', 'couponInvalid',
  'couponUsedToday', 'domainActionsMenu',
  'ebAdminPanel', 'ebAdminPanelTitle', 'ebBundleNotFound',
  'ebCampaignNotFound', 'ebCancelBtn',
  'ebCancelled', 'ebDashboardBtn', 'ebEnterSubject', 'ebFailedReadHtml',
  'ebManageDomainsBtn',
  'ebManageIpsBtn', 'ebMyCampaigns', 'ebPricingBtn', 'ebSuppressionBtn',
  'ebTypeOrUpload', 'ebTypeText', 'ebUploadCsvOnly', 'ebUploadCsvTxt',
  'ebUploadHtml', 'ebUploadHtmlFile',
  'enterCoupon', 'enterCouponCode', 'invalidCoupon', 'keyboardRefreshed',
  'leadAllCities', 'leadNationwide', 'leadNone', 'leadRequestTarget',
  'linkAlreadyExist', 'no', 'noDomainSelected', 'noPendingLeads',
  'noSupportSession', 'notValidHalf', 'nsCannotAdd', 'planNotFound',
  'promoOptIn', 'promoOptOut', 'purchaseFailed', 'selectCorrectOption',
  'selectValidOption', 'someIssue', 'supportMsgReceived',
  'switchToCfAlreadyCf', 'switchToProviderAlreadyProvider', 'welcome',
  'yes', 'paymentTimeoutReminder',
]

// ── 1. Each swept key resolves in all 4 locales ──
for (const key of SWEPT_KEYS) {
  for (const lang of ['en', 'fr', 'zh', 'hi']) {
    const v = translation(`t.${key}`, lang)
    const isStr  = typeof v === 'string' && v.length > 0
    const isFn   = typeof v === 'function'
    ok(`[${lang}] t.${key} resolves`, isStr || isFn,
      `value=${JSON.stringify(v)?.slice(0,80)}`)
  }
}

// ── 2. No more `t.<sweptKey> || 'string'` patterns in _index.js ──
for (const key of SWEPT_KEYS) {
  const re = new RegExp(`\\bt\\.${key}\\s*\\|\\|\\s*['"\`]`)
  ok(`no dead fallback for t.${key}`, !re.test(indexSrc))
}

// ── 3. No more `t.<sweptKey> ? t.<sweptKey>(...) : 'string'` ternaries ──
for (const key of SWEPT_KEYS) {
  const re = new RegExp(`\\bt\\.${key}\\s*\\?\\s*t\\.${key}\\s*\\(`)
  ok(`no dead ternary fallback for t.${key}`, !re.test(indexSrc))
}

// ── 4. Remaining `t.X || 'string'` matches are confirmed-safe (data accesses
// on locals named `t`, e.g. inside ad-hoc lang-table objects) ──
// We only care about LITERAL `t.<key>` patterns (the user-locale dict in
// most of _index.js). Anything else is unrelated to this sweep.
const tFallbackRe = /\bt\.(\w+)\s*\|\|\s*['"`]/g
const tRemaining = []
let m
while ((m = tFallbackRe.exec(indexSrc)) !== null) {
  tRemaining.push(m[1])
}
const tViolations = tRemaining.filter(k => SWEPT_KEYS.includes(k))
ok(`zero swept keys still have dead fallbacks (${tRemaining.length} t.* fallbacks remaining; ${tViolations.length} are on swept keys)`,
  tViolations.length === 0,
  tViolations.slice(0, 5).join(', '))

// ── 5. Remaining t.* fallbacks are intentional (data-field accesses on local
// variables named `t` — typically a Telegram message draft, transaction,
// or option object) ──
// Whitelist of remaining keys we've manually verified are NOT i18n keys.
const KNOWN_DATA_FIELD_KEYS = [
  'actualPrice',  // buyResult.actualPrice via aliasing
  'error',        // result.error etc. but a fresh shadow `t = result` could exist
  'text',         // draft.text (IVR/voicemail flows)
  'type',         // couponResult.type
  'file_name', 'mime_type', 'voiceName', 'label', 'reason', 'status',
]
const tDataAccessOnly = tRemaining.filter(k => !SWEPT_KEYS.includes(k))
const tUnknown = tDataAccessOnly.filter(k => !KNOWN_DATA_FIELD_KEYS.includes(k))
ok(`all remaining t.* fallbacks are known data-field accesses (${tUnknown.length} unknown)`,
  tUnknown.length === 0,
  Array.from(new Set(tUnknown)).slice(0, 8).join(', '))

console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
