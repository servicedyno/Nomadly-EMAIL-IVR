/* Test: voice-service routing priority + phone-config route-summary helper.
 *
 * Bug context (Feb 2026 — @wizardchop +15162719167):
 *   User had Always-Forward enabled AND IVR enabled. Calls hit IVR menu (option 1 → voicemail)
 *   and never forwarded — because IVR was checked before forwarding-always.
 *
 * Fix: handleCallAnswered() now checks `mode === 'always'` BEFORE IVR. This test locks the
 * priority order via the canonical route-summary helper (single source of truth for both the
 * voice service runtime AND the bot UX preview).
 */

const assert = require('assert')
const phoneConfig = require('../phone-config')

const { getCallRouteSummary, formatCallFlowPreview } = phoneConfig

let pass = 0, fail = 0
function t(label, fn) {
  try { fn(); console.log('✓', label); pass++ }
  catch (e) { console.log('✗', label, '\n   ', e.message); fail++ }
}

// ────────────────────────────────────────
// 1. The exact @wizardchop scenario
// ────────────────────────────────────────
t('Always-Forward + IVR + Voicemail → forward_always wins, IVR/VM skipped', () => {
  const num = {
    plan: 'business',
    sipUsername: null,
    features: {
      callForwarding: { enabled: true, mode: 'always', forwardTo: '+19382616936' },
      ivr: { enabled: true, options: { '1': { action: 'voicemail' } } },
      voicemail: { enabled: true },
    },
  }
  const r = getCallRouteSummary(num)
  assert.strictEqual(r.primary.action, 'forward_always')
  assert.strictEqual(r.primary.forwardTo, '+19382616936')
  assert.deepStrictEqual(r.skippedFeatures.sort(), ['ivr', 'voicemail'])
})

// ────────────────────────────────────────
// 2. IVR-only (no forwarding) → IVR runs
// ────────────────────────────────────────
t('IVR only → primary=ivr, no skipped', () => {
  const num = {
    plan: 'business',
    features: { ivr: { enabled: true, options: { '1': { action: 'voicemail' } } } },
  }
  const r = getCallRouteSummary(num)
  assert.strictEqual(r.primary.action, 'ivr')
  assert.strictEqual(r.skippedFeatures.length, 0)
})

// ────────────────────────────────────────
// 3. IVR + forward(busy) → IVR primary, forward_busy is DORMANT (not secondary)
// ────────────────────────────────────────
t('IVR + forward(busy) → IVR primary, forward_busy in dormantFeatures (truly never fires under IVR)', () => {
  const num = {
    plan: 'business',
    features: {
      ivr: { enabled: true, options: { '1': { action: 'voicemail' } } },
      callForwarding: { enabled: true, mode: 'busy', forwardTo: '+15555550000' },
    },
  }
  const r = getCallRouteSummary(num)
  assert.strictEqual(r.primary.action, 'ivr')
  assert.strictEqual(r.skippedFeatures.length, 0, 'forward(busy/no_answer) under IVR are dormant, not skipped')
  const dorm = r.dormantFeatures.find(d => d.feature === 'forward_busy')
  assert.ok(dorm, 'forward_busy should be in dormantFeatures (IVR pre-empts it)')
  assert.strictEqual(dorm.forwardTo, '+15555550000')
})

// ────────────────────────────────────────
// 4. IVR + forward(no_answer) → IVR primary, forward_no_answer DORMANT
// ────────────────────────────────────────
t('IVR + forward(no_answer) → IVR primary, forward_no_answer in dormantFeatures', () => {
  const num = {
    plan: 'business',
    features: {
      ivr: { enabled: true, options: { '1': { action: 'voicemail' } } },
      callForwarding: { enabled: true, mode: 'no_answer', forwardTo: '+15555550000', ringTimeout: 30 },
    },
  }
  const r = getCallRouteSummary(num)
  assert.strictEqual(r.primary.action, 'ivr')
  const dorm = r.dormantFeatures.find(d => d.feature === 'forward_no_answer')
  assert.ok(dorm)
  assert.strictEqual(dorm.ringTimeout, 30)
})

// ────────────────────────────────────────
// 5. Forward-always + voicemail (no IVR) → forward wins, vm skipped
// ────────────────────────────────────────
t('Forward(always) + voicemail (no IVR) → forward primary, voicemail skipped', () => {
  const num = {
    plan: 'pro',
    features: {
      callForwarding: { enabled: true, mode: 'always', forwardTo: '+15555550000' },
      voicemail: { enabled: true },
    },
  }
  const r = getCallRouteSummary(num)
  assert.strictEqual(r.primary.action, 'forward_always')
  assert.deepStrictEqual(r.skippedFeatures, ['voicemail'])
})

// ────────────────────────────────────────
// 6. Forward-always + SIP → forward wins, SIP skipped
// ────────────────────────────────────────
t('Forward(always) + SIP → forward primary, sip_ring skipped', () => {
  const num = {
    plan: 'business',
    sipUsername: 'sipuser123',
    features: {
      callForwarding: { enabled: true, mode: 'always', forwardTo: '+15555550000' },
    },
  }
  const r = getCallRouteSummary(num)
  assert.strictEqual(r.primary.action, 'forward_always')
  assert.deepStrictEqual(r.skippedFeatures, ['sip_ring'])
})

// ────────────────────────────────────────
// 7. SIP + voicemail (no forward, no IVR) → SIP primary, voicemail in secondary
// ────────────────────────────────────────
t('SIP + voicemail → SIP primary, voicemail secondary, nothing skipped', () => {
  const num = {
    plan: 'pro',
    sipUsername: 'sipuser123',
    features: { voicemail: { enabled: true } },
  }
  const r = getCallRouteSummary(num)
  assert.strictEqual(r.primary.action, 'sip_ring')
  assert.strictEqual(r.skippedFeatures.length, 0)
})

// ────────────────────────────────────────
// 8. Voicemail-only → voicemail primary
// ────────────────────────────────────────
t('Voicemail only → voicemail primary', () => {
  const num = {
    plan: 'pro',
    features: { voicemail: { enabled: true } },
  }
  assert.strictEqual(getCallRouteSummary(num).primary.action, 'voicemail')
})

// ────────────────────────────────────────
// 9. No features → missed
// ────────────────────────────────────────
t('No features → missed', () => {
  const num = { plan: 'starter', features: {} }
  assert.strictEqual(getCallRouteSummary(num).primary.action, 'missed')
})

// ────────────────────────────────────────
// 10. IVR enabled but no options → falls through to next priority
// ────────────────────────────────────────
t('IVR enabled with empty options → ignored, falls through to forwarding', () => {
  const num = {
    plan: 'business',
    features: {
      ivr: { enabled: true, options: {} },
      callForwarding: { enabled: true, mode: 'busy', forwardTo: '+15555550000' },
    },
  }
  const r = getCallRouteSummary(num)
  assert.strictEqual(r.primary.action, 'forward_busy')
})

// ────────────────────────────────────────
// 11. IVR enabled but plan doesn't support it (starter) → ignored
// ────────────────────────────────────────
t('IVR enabled but plan=starter → IVR ignored, falls through', () => {
  const num = {
    plan: 'starter',
    features: {
      ivr: { enabled: true, options: { '1': { action: 'voicemail' } } },
      callForwarding: { enabled: true, mode: 'always', forwardTo: '+15555550000' },
    },
  }
  const r = getCallRouteSummary(num)
  assert.strictEqual(r.primary.action, 'forward_always')
  // IVR shouldn't be in skipped because plan doesn't support it (effectively disabled)
  assert.ok(!r.skippedFeatures.includes('ivr'))
})

// ────────────────────────────────────────
// 12. Voicemail enabled but plan=starter → voicemail ignored
// ────────────────────────────────────────
t('Voicemail enabled but plan=starter → voicemail ignored', () => {
  const num = {
    plan: 'starter',
    features: { voicemail: { enabled: true } },
  }
  const r = getCallRouteSummary(num)
  assert.strictEqual(r.primary.action, 'missed', 'starter plan does not support voicemail')
})

// ────────────────────────────────────────
// 13. formatCallFlowPreview produces expected localized strings
// ────────────────────────────────────────
t('formatCallFlowPreview EN — Always-Forward + IVR/VM skipped', () => {
  const num = {
    plan: 'business',
    features: {
      callForwarding: { enabled: true, mode: 'always', forwardTo: '+19382616936' },
      ivr: { enabled: true, options: { '1': { action: 'voicemail' } } },
      voicemail: { enabled: true },
    },
  }
  const txt = formatCallFlowPreview(num, 'en')
  assert.match(txt, /All calls auto-forward/)
  assert.match(txt, /IVR.*skipped|skipped.*IVR/, 'Should mention IVR + voicemail are skipped')
  assert.match(txt, /voicemail/i)
})

t('formatCallFlowPreview FR — IVR only', () => {
  const num = {
    plan: 'business',
    features: { ivr: { enabled: true, options: { '1': { action: 'voicemail' } } } },
  }
  const txt = formatCallFlowPreview(num, 'fr')
  assert.match(txt, /menu SVI/)
})

t('formatCallFlowPreview ZH — voicemail only', () => {
  const num = { plan: 'pro', features: { voicemail: { enabled: true } } }
  const txt = formatCallFlowPreview(num, 'zh')
  assert.match(txt, /语音信箱/)
})

t('formatCallFlowPreview HI — missed', () => {
  const num = { plan: 'starter', features: {} }
  const txt = formatCallFlowPreview(num, 'hi')
  assert.match(txt, /अनुपलब्ध|उपलब्ध नहीं/)
})

// ────────────────────────────────────────
// IVR option enumeration in preview (mirrors screenshot scenario)
// ────────────────────────────────────────
t('formatCallFlowPreview EN — IVR with 3 options enumerates Press 1→Forward, Press 2→Message, Press 3→Voicemail', () => {
  const num = {
    plan: 'business',
    features: {
      ivr: { enabled: true, options: {
        '1': { action: 'forward', forwardTo: '+19382616936' },
        '2': { action: 'message' },
        '3': { action: 'voicemail' },
      }},
    },
  }
  const txt = formatCallFlowPreview(num, 'en')
  assert.match(txt, /Press <b>1<\/b>→Forward/)
  assert.match(txt, /Press <b>2<\/b>→Message/)
  assert.match(txt, /Press <b>3<\/b>→Voicemail/)
})

t('formatCallFlowPreview FR — IVR options enumerate with French labels', () => {
  const num = {
    plan: 'business',
    features: {
      ivr: { enabled: true, options: {
        '1': { action: 'forward', forwardTo: '+15555550000' },
        '2': { action: 'voicemail' },
      }},
    },
  }
  const txt = formatCallFlowPreview(num, 'fr')
  assert.match(txt, /Touche <b>1<\/b>→Transfert/)
  assert.match(txt, /Touche <b>2<\/b>→Messagerie/)
})

t('formatCallFlowPreview EN — IVR with 5 options caps at 3 + "+2 more"', () => {
  const num = {
    plan: 'business',
    features: {
      ivr: { enabled: true, options: {
        '1': { action: 'forward', forwardTo: '+15555550001' },
        '2': { action: 'forward', forwardTo: '+15555550002' },
        '3': { action: 'message' },
        '4': { action: 'message' },
        '5': { action: 'voicemail' },
      }},
    },
  }
  const txt = formatCallFlowPreview(num, 'en')
  assert.match(txt, /\+2 more/, 'Should show "+2 more" when capping at 3')
  assert.match(txt, /Press <b>1<\/b>/)
  assert.match(txt, /Press <b>3<\/b>/)
  assert.doesNotMatch(txt, /Press <b>4<\/b>/, 'Press 4 should be hidden behind "+2 more"')
})

// ────────────────────────────────────────
// IVR dormant warning in preview
// ────────────────────────────────────────
t('formatCallFlowPreview EN — IVR + forward(busy) shows "💤 Forward-when-busy is dormant"', () => {
  const num = {
    plan: 'business',
    features: {
      ivr: { enabled: true, options: { '1': { action: 'voicemail' } } },
      callForwarding: { enabled: true, mode: 'busy', forwardTo: '+15555550000' },
    },
  }
  const txt = formatCallFlowPreview(num, 'en')
  assert.match(txt, /💤/, 'Should include dormant warning emoji')
  assert.match(txt, /dormant/i)
  assert.match(txt, /Forward-when-busy/)
})

t('formatCallFlowPreview EN — IVR with all dormant features lists each one', () => {
  const num = {
    plan: 'business',
    sipUsername: 'sipxyz',
    features: {
      ivr: { enabled: true, options: { '1': { action: 'voicemail' } } },
      callForwarding: { enabled: true, mode: 'no_answer', forwardTo: '+15555550000', ringTimeout: 30 },
      voicemail: { enabled: true },
    },
  }
  const txt = formatCallFlowPreview(num, 'en')
  assert.match(txt, /Forward-on-no-answer/)
  assert.match(txt, /SIP ring/)
  assert.match(txt, /Voicemail/)
  assert.match(txt, /dormant/)
})

// ────────────────────────────────────────
// Broken IVR — enabled but no options
// ────────────────────────────────────────
t('Broken IVR (enabled, no options) → primary=missed, broken-IVR message in preview', () => {
  const num = {
    plan: 'business',
    features: {
      ivr: { enabled: true, options: {} },
    },
  }
  const r = getCallRouteSummary(num)
  assert.strictEqual(r.primary.action, 'missed', 'enabled-but-empty IVR should not be primary')
  assert.ok(r.hasBrokenIvr, 'broken IVR flag should be set')
  const txt = formatCallFlowPreview(num, 'en')
  assert.match(txt, /no menu options yet/, 'Preview should warn about missing options')
})

// ────────────────────────────────────────
// Exact screenshot scenario — IVR auto-attendant with 3 options, no Always-Forward
// ────────────────────────────────────────
t('Screenshot scenario (IVR auto-attendant, no Always-Forward) → no skipped, no dormant', () => {
  const num = {
    plan: 'business',
    sipUsername: null,
    features: {
      ivr: { enabled: true, options: {
        '1': { action: 'forward', forwardTo: '+19382616936' },
        '2': { action: 'message' },
        '3': { action: 'voicemail' },
      }},
      // Pre-existing default voicemail/forwarding off — they don't conflict
      callForwarding: { enabled: false, mode: 'disabled', forwardTo: null },
      voicemail: { enabled: false },
    },
  }
  const r = getCallRouteSummary(num)
  assert.strictEqual(r.primary.action, 'ivr')
  assert.strictEqual(r.skippedFeatures.length, 0, 'No conflict warning should fire — pure IVR setup')
  assert.strictEqual(r.dormantFeatures.length, 0, 'No dormant features either — all top-level features off')
  const txt = formatCallFlowPreview(num, 'en')
  assert.doesNotMatch(txt, /skipped/, 'Should not mention skipped features')
  assert.doesNotMatch(txt, /dormant/, 'Should not mention dormant features')
})

// ────────────────────────────────────────
// formatIvrOptionsInline — direct unit test
// ────────────────────────────────────────
t('formatIvrOptionsInline EN — empty options returns ""', () => {
  assert.strictEqual(phoneConfig.formatIvrOptionsInline({}, 'en'), '')
  assert.strictEqual(phoneConfig.formatIvrOptionsInline(null, 'en'), '')
  assert.strictEqual(phoneConfig.formatIvrOptionsInline(undefined, 'en'), '')
})

t('formatIvrOptionsInline EN — sorts keys numerically', () => {
  const txt = phoneConfig.formatIvrOptionsInline({
    '3': { action: 'voicemail' },
    '1': { action: 'forward' },
    '2': { action: 'message' },
  }, 'en')
  // Press 1 should come before Press 2 should come before Press 3
  const idx1 = txt.indexOf('Press <b>1</b>')
  const idx2 = txt.indexOf('Press <b>2</b>')
  const idx3 = txt.indexOf('Press <b>3</b>')
  assert.ok(idx1 > -1 && idx2 > -1 && idx3 > -1)
  assert.ok(idx1 < idx2 && idx2 < idx3, `Keys should be sorted: got 1@${idx1}, 2@${idx2}, 3@${idx3}`)
})

// ────────────────────────────────────────
// 14. Mirror the actual @wizardchop runtime priority (via voice-service order)
// ────────────────────────────────────────
t('voice-service.js: handleCallAnswered checks Forwarding(always) BEFORE IVR', () => {
  const fs = require('fs')
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'voice-service.js'), 'utf8')
  // Find the function header
  const fnIdx = src.indexOf('async function handleCallAnswered')
  assert.ok(fnIdx > 0, 'handleCallAnswered not found in voice-service.js')
  const fnSrc = src.slice(fnIdx, fnIdx + 8000)
  const alwaysIdx = fnSrc.search(/Forwarding.*"always"|mode === 'always'/i)
  // Find IVR options check inside the function body
  const ivrCheckIdx = fnSrc.search(/ivrConfig\?\.enabled/)
  assert.ok(alwaysIdx > 0 && alwaysIdx < ivrCheckIdx,
    `Always-forward check (idx ${alwaysIdx}) must come before IVR check (idx ${ivrCheckIdx}) inside handleCallAnswered`)
})

console.log(`\n${pass}/${pass + fail} tests passed`)
if (fail > 0) process.exit(1)
