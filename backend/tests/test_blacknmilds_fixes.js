// Regression tests for the 2026-02 @blacknmilds Cloud IVR fixes.
// Run: /opt/node22/bin/node /app/backend/tests/test_blacknmilds_fixes.js
'use strict'

const assert = require('assert')
const { parseLeadsFile } = require('/app/js/bulk-call-service.js')

// ── Fix 2: parseLeadsFile NANP normalization ─────────────────────────────
;(function testNANP() {
  // 10-digit US number pasted without "+" — MUST become +1XXXXXXXXXX, not +XXXXXXXXXX
  const { leads, errors } = parseLeadsFile([
    '4065067340',      // was becoming +4065067340 (Romania) — now +14065067340 (US)
    '4079281382',
    '17132014654',     // 1-prefixed 11-digit → +17132014654
    '+17209372785',    // already E.164 → unchanged
    '3852568800',      // still 10-digit → +13852568800
    'notaphone',       // invalid
  ].join('\n'))

  assert.deepStrictEqual(
    leads.map(l => l.number),
    ['+14065067340', '+14079281382', '+17132014654', '+17209372785', '+13852568800'],
    'NANP normalization: 10-digit US must be prefixed with +1'
  )
  assert.strictEqual(errors.length, 1, 'exactly 1 invalid line (notaphone)')
  console.log('✓ Fix 2 (parseLeadsFile NANP normalization) — 10-digit US → +1XXXXXXXXXX')

  // Real international numbers should still work
  const intl = parseLeadsFile(['+31626742533', '+447700900123'].join('\n'))
  assert.deepStrictEqual(intl.leads.map(l => l.number), ['+31626742533', '+447700900123'],
    'International E.164 numbers must pass through unchanged')
  console.log('✓ Fix 2 — International E.164 pass-through OK')

  // "0" prefix stripping still works (e.g. UK style 07700 → +7700 — user must supply cc)
  const zero = parseLeadsFile(['003185551234'].join('\n'))
  assert.strictEqual(zero.leads[0].number, '+3185551234',
    '00-prefixed numbers should still have leading zeros stripped and + added')
  console.log('✓ Fix 2 — 00-prefixed international pass-through OK')
})()

// ── Fix 1a: audio-library-service transcodes WAV to MP3 ──────────────────
;(function testWavTranscodePolicy() {
  const src = require('fs').readFileSync('/app/js/audio-library-service.js', 'utf8')
  // The core policy: only MP3 is passed through untouched
  assert.ok(/if \(realFormat !== 'mp3'\) \{/.test(src),
    'audio-library-service.js must transcode everything except mp3 (WAV included)')
  assert.ok(!/realFormat !== 'mp3' && realFormat !== 'wav'/.test(src),
    'the old "MP3 or WAV pass-through" branch must be removed')
  console.log('✓ Fix 1a (audio-library-service) — WAV uploads now transcoded to MP3')
})()

// ── Fix 1b: audio-proxy derives Content-Type from extension ──────────────
;(function testAudioProxyContentType() {
  const src = require('fs').readFileSync('/app/js/_index.js', 'utf8')
  const proxyStart = src.indexOf("app.get('/twilio/audio-proxy'")
  assert.ok(proxyStart > 0, 'audio-proxy route must exist')
  const proxyEnd = src.indexOf('})', proxyStart + 10)
  const proxyBody = src.slice(proxyStart, proxyEnd + 2)

  // The three previously-hardcoded audio/mpeg sets are gone from this route
  const hardcoded = (proxyBody.match(/res\.set\(\s*'Content-Type'\s*,\s*'audio\/mpeg'\s*\)/g) || []).length
  assert.strictEqual(hardcoded, 0,
    'audio-proxy must NOT hardcode audio/mpeg anywhere — derive from extension/upstream')
  assert.ok(/mimeFromUrl/.test(proxyBody),
    'audio-proxy must use mimeFromUrl helper to derive Content-Type')
  console.log('✓ Fix 1b (audio-proxy) — Content-Type derived from file extension')
})()

console.log('\nAll blacknmilds Cloud IVR regression tests passed ✓')
