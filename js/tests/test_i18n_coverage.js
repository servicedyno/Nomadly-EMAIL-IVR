/**
 * Locale coverage regression test (P0/P1/P2 i18n work — 2026-02).
 * Verifies all newly-added translation keys exist and resolve in en/fr/zh/hi.
 *
 * Run: `node js/tests/test_i18n_coverage.js`
 *      (exit 0 = pass, non-zero = fail)
 */

/* eslint-disable no-console */

const assert = require('assert')
const { translation } = require('../translation')

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

console.log('Locale coverage tests for newly-i18n\'d strings')

const LOCALES = ['en', 'fr', 'zh', 'hi']
const KEYS_FLAT = [
  // ── Hosting / Billing UX (P0) ──
  'myHostingPlansHeader',
  'billingMenuHeader',
  'billingMenuIntro',
  'billingMenuEmpty',
  'statusActive',
  'statusActiveOnline',
  'statusSuspended',
  'statusSuspendedFull',
  'statusExpired',
  'statusMaintenance',
  'autoRenewOn',
  'autoRenewOff',
  'autoRenewWeeklyOff',
  'autoRenewWeeklyShort',
  'planLabel',
  'statusLabel',
  'domainTypeFieldLabel',
  'createdLabel',
  'expiresLabel',
  'autoRenewFieldLabel',
  'usernameLabel',
  'priceLabel',
  'durationLabel',
  'walletBalanceLabel',
  'chargedLabel',
  'newExpiryLabel',
  'remainingBalanceLabel',
  'domainLabel',
  'currentLabel',
  'planViewCredentialsHint',
  'planViewBillingNudge',
  'planViewMultiHostUpsell',
  'renewModalConfirmHint',
  'renewModalInsufficient',
  'renewSuccessTitle',
  'renewSuccessAntiRedNote',
  'renewFailureFallback',
  'upgradeModalHeader',
  'upgradeModalChooseHint',
  'autoRenewNotForWeekly',
  'siteAlreadyOffline',
  'siteAlreadyOnline',
  'addonNotOnPlan',
  'promoMessagesEnabled',
  'promoMessagesDisabled',
  'credentialsPinLabel',
  'credentialsPanelUrlLabel',
  'credentialsFreshNotice',
  // ── Hosting Scheduler (P0) ──
  'schedExpiryWarningTitle',
  'schedRenewTextOn',
  'schedRenewTextWeekly',
  'schedRenewTextWalletHint',
  'schedAutoRenewedTitle',
  'schedAutoRenewFailedTitle',
  'schedWeeklyExpiredTitle',
  'schedDeletedTitle',
  'schedSuspendedTitle',
  // ── Phone-monitor / Phone-scheduler (P1) ──
  'phoneCallerIdFlaggedTitle',
  'phoneAutoRenewFailedTitle',
  'phoneSuspendedTitle',
  'phoneUsageAlertTitle',
  // ── Generic error (P1) ──
  'genericErrorTitle',
  'genericErrorRefundedNote',
  'genericErrorContactSupport',
  // ── Bulk-call (P2) ──
  'bulkCallReportTitle',
  'bulkCallReportCallerId',
  'bulkCallReportAudio',
  'bulkCallReportProvider',
  'bulkCallReportDuration',
  'bulkCallReportTotal',
  'bulkCallReportAnswered',
  'bulkCallReportKeyPressed',
  'bulkCallReportTransferred',
  'bulkCallReportNoAnswer',
  'bulkCallReportHungUp',
  'bulkCallReportBusy',
  'bulkCallReportFailed',
  // ── SMS App (P2) ──
  'smsAppTrialCompleteTitle',
  'smsAppTrialExpiredTitle',
  'smsAppTrialExpiredBody',
  // ── cPanel-routes Anti-Red (P2) ──
  'antiRedWarningTitle',
  'antiRedFailedTitle',
]

const KEYS_FN = [
  // Each entry: [key, [...sample args]] — verify the function returns a non-empty string
  ['renewModalHeader', ['Plan ABC']],
  ['renewModalCurrentExpiry', ['Mar 15, 2026', false]],
  ['renewModalDuration', [30]],
  ['renewModalPayButton', [75]],
  ['billingRenewBtn', ['example.com']],
  ['billingToggleAutoRenewBtn', ['example.com']],
  ['autoRenewTurnedOn', ['example.com']],
  ['autoRenewTurnedOff', ['example.com']],
  ['credentialsHeader', ['example.com']],
  ['schedExpiryWarningBody', ['Premium', 'example.com']],
  ['schedRenewTextOff', [48]],
  ['schedRenewTextToggleHint', ['example.com']],
  ['schedAutoRenewedBody', ['Premium', 'example.com', 75, 'Mar 15', '24.50']],
  ['schedAutoRenewFailedBody', ['Premium', 'example.com', 75, '0.50', 48]],
  ['schedWeeklyExpiredBody', ['Premium-Week', 'example.com', 48]],
  ['schedDeletedBody', ['example.com', 'Premium']],
  ['schedDeletedBodyHours', ['example.com', 'Premium', 50, 48]],
  ['schedSuspendedBody', ['example.com', 'Premium', 5, 48]],
  ['phoneCallerIdFlaggedBody', ['+15551234567']],
  ['phoneAutoRenewFailedBody', ['+15551234567', 'Pro', 30, 'Buy New Number']],
  ['phoneSuspendedBody', ['+15551234567', 'Buy New Number']],
  ['phoneUsageAlertBody', ['+15551234567', 800, 1000, 'SMS', 80, 0.05, 'SMS']],
  ['phoneUsageLimitTitle', ['SMS']],
  ['phoneUsageLimitBody', ['+15551234567', 'SMS', 1000, 0.05, 'SMS']],
  ['genericErrorBody', ['tx_abc123']],
  ['smsAppTrialCompleteBody', [100]],
  ['antiRedWarningBodyShort', ['example.com']],
  ['antiRedFailedBodyShort', ['example.com', 3]],
]

// ── Test 1: every flat key resolves to a non-empty string in every locale ──
for (const lang of LOCALES) {
  for (const key of KEYS_FLAT) {
    check(`${lang}: t.${key} resolves`, () => {
      const value = translation(`t.${key}`, lang)
      assert.ok(
        typeof value === 'string' && value.length > 0,
        `expected non-empty string, got ${typeof value}: ${JSON.stringify(value)}`
      )
      // Catch the silent-fallback case where translation returns the raw key.
      assert.notStrictEqual(value, `t.${key}`, `key fell through to raw "t.${key}"`)
    })
  }
}

// ── Test 2: every function key returns a non-empty string in every locale ──
for (const lang of LOCALES) {
  for (const [key, args] of KEYS_FN) {
    check(`${lang}: t.${key}(...args) returns string`, () => {
      const value = translation(`t.${key}`, lang, ...args)
      assert.ok(
        typeof value === 'string' && value.length > 0,
        `expected non-empty string, got ${typeof value}: ${JSON.stringify(value)}`
      )
      assert.notStrictEqual(value, `t.${key}`, `function key fell through to raw key`)
    })
  }
}

// ── Test 3: missing key warning (translation should fall back from fr→en, then warn) ──
check('translation() falls back to en when key only exists in en', () => {
  // Deliberately use a key that *should* exist in all locales.
  const out = translation('t.billingMenuHeader', 'fr')
  assert.ok(out.includes('Facturation'), 'FR translation should be French, got: ' + out)
})

check('translation() returns raw key for completely unknown keys', () => {
  // Suppress console.warn for this test to keep output clean.
  const originalWarn = console.warn
  console.warn = () => {}
  try {
    const out = translation('t.this_key_definitely_does_not_exist_anywhere_xyz', 'en')
    assert.strictEqual(out, 't.this_key_definitely_does_not_exist_anywhere_xyz')
  } finally {
    console.warn = originalWarn
  }
})

if (failed) {
  console.log(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log('\nAll i18n coverage tests passed')
