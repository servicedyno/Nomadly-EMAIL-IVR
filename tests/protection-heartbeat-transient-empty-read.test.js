/* global describe, test, expect, beforeEach, jest */
/**
 * Regression test — Protection heartbeat transient-empty-read guard.
 *
 * Background (2026-06-24): 23 of 24 active cPanel accounts on the new WHM
 * server (post-2026-06-17 migration) were marked STUCK overnight. A manual
 * probe confirmed every file was actually intact on disk — the heartbeat
 * was incrementing repairCount on transient empty reads from WHM's
 * Fileman::get_file_content UAPI.
 *
 * Fix: when EITHER file comes back empty without a "user gone" / HTTP error,
 * re-read once with a 750ms delay and prefer whichever pass returned content.
 *
 * What this locks in:
 *   1. Source-level: the transient-empty-read guard block exists in
 *      protection-heartbeat.js (so a future revert is caught).
 *   2. The retry only triggers when both whmErrors and HTTP-error fields
 *      are absent — i.e. the read "succeeded" but returned suspiciously
 *      empty content. Permanent failures (user-gone, 404) skip the retry.
 *   3. The retry picks the LONGER content from the two passes (defends
 *      against a blip on either pass).
 */

const fs = require('fs')
const path = require('path')

const SRC_PATH = path.join(__dirname, '..', 'js', 'protection-heartbeat.js')
const SRC = fs.readFileSync(SRC_PATH, 'utf-8')

describe('Protection heartbeat — transient-empty-read guard (2026-06-24 fix)', () => {

  test('Source contains the transient-empty-read block', () => {
    // Future-proof: any revert that removes this guard will fail this test.
    expect(SRC).toMatch(/Transient-empty-read guard \(2026-06-24\)/)
    expect(SRC).toMatch(/looksTransient/)
    expect(SRC).toMatch(/empty read recovered on retry/)
  })

  test('The retry only fires when there are NO whmErrors / HTTP errors', () => {
    // The looksTransient predicate must rule out:
    //   - non-empty whmErrors (means cPanel returned an error result)
    //   - non-empty .error fields (means HTTP-level failure)
    // Otherwise we'd retry permanent failures and double the load.
    // Confirm each of the 4 negation clauses is present somewhere in the source.
    expect(SRC).toMatch(/!\(iniRes\.whmErrors/)
    expect(SRC).toMatch(/!\(phpRes\.whmErrors/)
    expect(SRC).toMatch(/!iniRes\.error/)
    expect(SRC).toMatch(/!phpRes\.error/)
  })

  test('The retry uses ≥ 500ms delay (allows WHM to settle)', () => {
    // Defense: a 0ms or <250ms retry would hammer WHM and probably re-hit
    // the same blip. The original fix uses 750ms.
    const m = SRC.match(/setTimeout\(r, (\d+)\)/m)
    expect(m).not.toBeNull()
    const delay = parseInt(m[1], 10)
    expect(delay).toBeGreaterThanOrEqual(500)
  })

  test('The retry picks whichever pass returned MORE content', () => {
    // Otherwise we'd accidentally prefer the empty-read on the 2nd pass if
    // both blip in a row.
    expect(SRC).toMatch(/iniRes2\.content[\s\S]{0,30}\.length > .*iniRes\.content/)
    expect(SRC).toMatch(/phpRes2\.content[\s\S]{0,30}\.length > .*phpRes\.content/)
  })

  test('Both files in parallel for the retry too (Promise.all)', () => {
    // Sequential reads would double total latency on a healthy-fleet sweep.
    // Confirm the retry uses Promise.all like the initial read.
    const occurrences = (SRC.match(/await Promise\.all\(\[\s*getFile\(cpUsername/g) || []).length
    expect(occurrences).toBeGreaterThanOrEqual(2) // initial + retry
  })

  test('Behaviour spec — the predicate logic in isolation', () => {
    // Recreate the looksTransient gate to confirm its truth table is correct.
    function looksTransient(iniRes, phpRes) {
      return (
        (!iniRes.content || !phpRes.content) &&
        !(iniRes.whmErrors && iniRes.whmErrors.length) &&
        !(phpRes.whmErrors && phpRes.whmErrors.length) &&
        !iniRes.error && !phpRes.error
      )
    }

    // Both files have content → no retry needed
    expect(looksTransient({ content: 'x' }, { content: 'y' })).toBe(false)

    // ini empty, php has content, no errors → RETRY (suspicious)
    expect(looksTransient({ content: '' }, { content: 'y' })).toBe(true)

    // ini empty, but cPanel said "No such user" → DON'T retry (real error)
    expect(looksTransient({ content: '', whmErrors: ['No such user'] }, { content: 'y' })).toBe(false)

    // ini empty, HTTP 401 / 404 error captured → DON'T retry
    expect(looksTransient({ content: '', error: 'Request failed', status: 404 }, { content: 'y' })).toBe(false)

    // Both empty, no errors → RETRY (textbook stuck-loop trigger)
    expect(looksTransient({ content: '' }, { content: '' })).toBe(true)

    // Both empty with whmErrors on one side → DON'T retry
    expect(looksTransient({ content: '' }, { content: '', whmErrors: ['gone'] })).toBe(false)
  })

  test('Behaviour spec — picking the longer content per file', () => {
    // Pick-longer logic, simulated:
    function pickLonger(a, b) {
      return ((b.content || '').length > (a.content || '').length) ? b : a
    }
    expect(pickLonger({ content: '' }, { content: 'hello' }).content).toBe('hello')
    expect(pickLonger({ content: 'hi' }, { content: '' }).content).toBe('hi')
    expect(pickLonger({ content: 'aa' }, { content: 'bbbb' }).content).toBe('bbbb')
    expect(pickLonger({ content: '' }, { content: '' }).content).toBe('')
  })
})
