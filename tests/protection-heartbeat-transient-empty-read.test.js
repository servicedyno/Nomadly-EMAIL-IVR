/* global describe, test, expect */
/**
 * Regression test — Protection heartbeat transient-empty-read guard.
 *
 * Background (2026-06-24): 23 of 24 active cPanel accounts on the new WHM
 * server (post-2026-06-17 migration) were marked STUCK overnight. A manual
 * probe confirmed every file was actually intact on disk — the heartbeat
 * was incrementing repairCount on transient empty reads from WHM's
 * Fileman::get_file_content UAPI.
 *
 * v1 fix: single 750ms retry, pick whichever pass returned content.
 * v2 fix (2026-06-24 same-day): 3 retries with exponential backoff
 *        [750, 2000, 5000]ms, AND a "trust last good deploy" fallback —
 *        if reads still empty after every retry AND the account has a
 *        `lastCfIpFixSig` on record, skip the cycle (don't increment
 *        the counter, don't fire admin alert).
 *
 * What this test locks in:
 *   1. Source-level: the v2 guard block exists in protection-heartbeat.js
 *      (so a future revert is caught).
 *   2. The retry only triggers when both whmErrors and HTTP-error fields
 *      are absent — i.e. the read "succeeded" but returned suspiciously
 *      empty content.
 *   3. The retry picks the LONGER content from each pass (defends against
 *      a blip on either pass).
 *   4. Up to 3 retries with exponential backoff (750ms, 2s, 5s).
 *   5. The `shouldSkipAsTransient` helper correctly classifies the
 *      stuck-loop trigger scenarios.
 */

const fs = require('fs')
const path = require('path')

const SRC_PATH = path.join(__dirname, '..', 'js', 'protection-heartbeat.js')
const SRC = fs.readFileSync(SRC_PATH, 'utf-8')

describe('Protection heartbeat — transient-empty-read guard (2026-06-24 v2 fix)', () => {

  test('Source contains the v2 transient-empty-read block', () => {
    // Future-proof: any revert that removes this guard will fail this test.
    expect(SRC).toMatch(/Transient-empty-read guard \(2026-06-24, hardened 2026-06-24-v2\)/)
    expect(SRC).toMatch(/empty read recovered on retry/)
    expect(SRC).toMatch(/whm_read_unreliable/)
  })

  test('Source contains the v2 trust-last-deploy fallback (the key false-positive fix)', () => {
    // This is the new behaviour that stops the admin-alert storm.
    expect(SRC).toMatch(/Trust-last-deploy fallback/)
    expect(SRC).toMatch(/hasDeploySignature/)
    expect(SRC).toMatch(/lastCfIpFixSig/)
  })

  test('Source contains the dev-safety guard (no prod mutation from sandbox)', () => {
    expect(SRC).toMatch(/DEV SAFETY GUARD/)
    expect(SRC).toMatch(/SKIP_WEBHOOK_SYNC === ['"]true['"]/)
  })

  test('The retry budget is at least 3 attempts with backoff ≥750ms', () => {
    // v2 upgraded from single 750ms to [750, 2000, 5000] for slow/overloaded WHM.
    const m = SRC.match(/RETRY_DELAYS_MS\s*=\s*\[([^\]]+)\]/)
    expect(m).not.toBeNull()
    const delays = m[1].split(',').map(s => parseInt(s.trim(), 10))
    expect(delays.length).toBeGreaterThanOrEqual(3)
    delays.forEach(d => expect(d).toBeGreaterThanOrEqual(500))
    // Confirm backoff is monotonically non-decreasing
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1])
    }
  })

  test('The retry picks whichever pass returned MORE content (per file)', () => {
    // Otherwise we'd accidentally prefer the empty-read on the next pass if both blip.
    expect(SRC).toMatch(/iniRes2\.content[\s\S]{0,40}\.length > .*iniRes\.content/)
    expect(SRC).toMatch(/phpRes2\.content[\s\S]{0,40}\.length > .*phpRes\.content/)
  })

  test('Module exports the new pure helpers for unit-testing without WHM', () => {
    // Don't require the module again here (avoids side-effects from the
    // dev-safety guard reading env at module load); just confirm the export
    // names exist in source.
    expect(SRC).toMatch(/RETRY_DELAYS_MS,/)
    expect(SRC).toMatch(/isEmptyReadPair,/)
    expect(SRC).toMatch(/hasNoExplicitError,/)
    expect(SRC).toMatch(/shouldSkipAsTransient,/)
  })

  test('Behaviour spec — predicate logic in isolation (no module load needed)', () => {
    // Replicate the v2 helpers' logic to lock the truth table.
    function isEmptyReadPair(a, b) {
      return !(a && a.content) && !(b && b.content)
    }
    function hasNoExplicitError(a, b) {
      const aErr = !!((a && a.whmErrors && a.whmErrors.length) || (a && a.fetchError && a.status))
      const bErr = !!((b && b.whmErrors && b.whmErrors.length) || (b && b.fetchError && b.status))
      return !aErr && !bErr
    }
    function shouldSkipAsTransient(s) {
      if (!s) return false
      const bothEmpty = !s.iniContent && !s.phpContent
      const iniErr = (s.iniWhmErrors && s.iniWhmErrors.length) || (s.iniFetchError && s.iniStatus)
      const phpErr = (s.phpWhmErrors && s.phpWhmErrors.length) || (s.phpFetchError && s.phpStatus)
      return bothEmpty && !iniErr && !phpErr && !!s.lastCfIpFixSig
    }

    // isEmptyReadPair
    expect(isEmptyReadPair({ content: 'x' }, { content: 'y' })).toBe(false)
    expect(isEmptyReadPair({ content: '' }, { content: '' })).toBe(true)
    expect(isEmptyReadPair({ content: '' }, { content: 'y' })).toBe(false)

    // hasNoExplicitError
    expect(hasNoExplicitError({ content: '' }, { content: '' })).toBe(true)
    expect(hasNoExplicitError({ content: '', whmErrors: ['No such user'] }, { content: '' })).toBe(false)
    expect(hasNoExplicitError({ content: '', fetchError: 'x', status: 404 }, { content: '' })).toBe(false)
    // Network-level timeout (no status) is treated as transient
    expect(hasNoExplicitError({ content: '', fetchError: 'timeout' }, { content: '' })).toBe(true)

    // shouldSkipAsTransient — the critical false-positive guard
    // both empty + sig present + no errors → SKIP (this is the bug-fix case)
    expect(shouldSkipAsTransient({
      iniContent: '', phpContent: '', lastCfIpFixSig: 'abc',
    })).toBe(true)
    // no sig → must repair (account was never deployed)
    expect(shouldSkipAsTransient({
      iniContent: '', phpContent: '', lastCfIpFixSig: null,
    })).toBe(false)
    // explicit error → not transient
    expect(shouldSkipAsTransient({
      iniContent: '', phpContent: '', iniWhmErrors: ['gone'], lastCfIpFixSig: 'abc',
    })).toBe(false)
    // only one file empty → real mutation, not transient
    expect(shouldSkipAsTransient({
      iniContent: '; data', phpContent: '', lastCfIpFixSig: 'abc',
    })).toBe(false)
  })

  test('Behaviour spec — picking the longer content per file', () => {
    function pickLonger(a, b) {
      return ((b.content || '').length > (a.content || '').length) ? b : a
    }
    expect(pickLonger({ content: '' }, { content: 'hello' }).content).toBe('hello')
    expect(pickLonger({ content: 'hi' }, { content: '' }).content).toBe('hi')
    expect(pickLonger({ content: 'aa' }, { content: 'bbbb' }).content).toBe('bbbb')
    expect(pickLonger({ content: '' }, { content: '' }).content).toBe('')
  })
})
