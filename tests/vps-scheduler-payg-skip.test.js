/* global describe, test, expect */
/**
 * Source-level regression test: the VPS renewal scheduler in _index.js
 * MUST skip destructive `deleteVPSinstance` calls at T-24h / T-5h for
 * PAYG providers (DigitalOcean / Vultr / Azure), letting Phase 2 (at
 * end_time) handle the destroy instead.
 *
 * Why this test exists:
 *   - Contabo bills monthly contracts in advance, so its `cancelInstance`
 *     is non-destructive (schedules cancel at end_time). The scheduler's
 *     Phase 1 (T-24h) and Phase 1.5 (T-5h) cancel-on-Contabo calls are
 *     therefore mandatory to avoid €30+ leak charges.
 *   - DO / Vultr / Azure are PAYG and `cancelInstance` DESTROYS the VM
 *     immediately. Running Phase 1/1.5 on them would lose 24 hours of
 *     customer-paid uptime. Phase 2 (at end_time) handles the actual
 *     destroy without that loss.
 *
 * A previous version of the scheduler called `deleteVPSinstance`
 * unconditionally for every provider at T-24h. This guard fixes that.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', '_index.js'), 'utf-8')

describe('VPS scheduler — _isPAYGProvider guard skips early destroy for PAYG providers', () => {
  test('Helper _isPAYGProvider is defined at the top of checkVPSPlansExpiryandPayment', () => {
    expect(SRC).toMatch(/function _isPAYGProvider\(vpsPlan\)/)
    expect(SRC).toMatch(/return name === 'vultr' \|\| name === 'digitalocean' \|\| name === 'azure'/)
  })

  test('Phase 1 — auto-renew OFF branch skips deleteVPSinstance for PAYG providers', () => {
    // The destructive call at T-24h must be gated by _isPAYGProvider
    expect(SRC).toMatch(/!vpsPlan\._contaboCancelledEarly && !_isPAYGProvider\(vpsPlan\)\) \{[\s\S]{0,2000}?cancelReason: 'auto_renew_disabled'/)
  })

  test('Phase 1 — wallet-deduct-failed branch skips deleteVPSinstance for PAYG providers', () => {
    expect(SRC).toMatch(/!vpsPlan\._contaboCancelledEarly && !_isPAYGProvider\(vpsPlan\)\) \{[\s\S]{0,2000}?cancelReason: 'wallet_deduct_failed'/)
  })

  test('Phase 1.5 — T-5h pre-emptive cancel skips PAYG providers with continue', () => {
    expect(SRC).toMatch(/for \(const vpsPlan of urgentCancellations\) \{\s*if \(_isPAYGProvider\(vpsPlan\)\) continue/)
  })

  test('Phase 2 still has the at-end_time destroy logic (do NOT remove this)', () => {
    // Sanity check: Phase 2's deleteVPSinstance must still fire at end_time
    expect(SRC).toMatch(/Phase 2: DELETE on Contabo[\s\S]{0,1000}'end_time': \{ \$lte: now \}[\s\S]{0,500}deleteVPSinstance\(chatId, vpsId\)/)
  })

  test('Helper imports detectProviderByInstanceId from vps-provider (real wiring)', () => {
    expect(SRC).toMatch(/const \{ detectProviderByInstanceId: _detectByPrefix \} = require\('\.\/vps-provider'\)/)
  })
})
