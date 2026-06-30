/**
 * Smoke test for maskPhone() — privacy guard for group/public messages.
 *
 * Asserts:
 *  - Full number is NEVER returned verbatim in masked output.
 *  - Last 2 digits are preserved (for support-side correlation).
 *  - First 2-3 digits (country / area-code) are preserved.
 *  - Empty / nullish inputs return empty.
 *  - All chars in the middle are bullet (•).
 *  - formatPhone() still returns the full number (so it stays usable for
 *    admin-only private messages).
 *
 * Regression target (2026-07-01): phone-scheduler.js group notifications
 * leaked the full user phone number on every Auto-Renew / Grace / Release.
 */
'use strict'

const { formatPhone, maskPhone } = require('../phone-config')

let pass = 0
let fail = 0

const it = (label, fn) => {
  try { fn(); console.log(`  ✅ ${label}`); pass++ }
  catch (e) { console.log(`  ❌ ${label}\n     ${e.message}`); fail++ }
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg) }

console.log('\n=== maskPhone unit tests ===')

it('US +15105551234 → masked, keeps last 2 + first area-code digit', () => {
  const m = maskPhone('+15105551234')
  assert(!m.includes('5551234'), `unexpected full subscriber digits leaked: ${m}`)
  assert(!m.includes('+15105'), `unexpected long-prefix leak: ${m}`)
  assert(m.endsWith('34'), `should end with last 2 digits: ${m}`)
  assert(m.startsWith('+1'), `should keep +1: ${m}`)
  console.log(`     "+15105551234" → "${m}"`)
})

it('UK +447911123456 → masked international', () => {
  const m = maskPhone('+447911123456')
  assert(!m.includes('7911123456'), `subscriber leak: ${m}`)
  assert(m.endsWith('56'), `should end with last 2: ${m}`)
  assert(m.startsWith('+'), `should keep +: ${m}`)
  console.log(`     "+447911123456" → "${m}"`)
})

it('Number without + prefix', () => {
  const m = maskPhone('15105551234')
  assert(!m.includes('5551234'), `leak: ${m}`)
  assert(m.endsWith('34'), `tail: ${m}`)
  console.log(`     "15105551234" → "${m}"`)
})

it('Short / weird input (5 digits)', () => {
  const m = maskPhone('12345')
  assert(m.endsWith('45'), `should keep last 2: ${m}`)
  assert(m.length <= 6, `should be short: ${m}`)
  console.log(`     "12345" → "${m}"`)
})

it('Empty / null', () => {
  assert(maskPhone('') === '', 'empty')
  assert(maskPhone(null) === '', 'null')
  assert(maskPhone(undefined) === '', 'undefined')
})

it('Formatted input is normalized first', () => {
  const m = maskPhone('+1 (510) 555-1234')
  assert(!m.includes('5551234'), `leak after normalize: ${m}`)
  assert(m.endsWith('34'), `tail: ${m}`)
  console.log(`     "+1 (510) 555-1234" → "${m}"`)
})

it('Middle is bullets, not digits', () => {
  const m = maskPhone('+15105551234')
  // Strip the known kept portion (head + tail + brackets/separators) and verify
  // there are NO consecutive 3+ digits remaining anywhere.
  const longRun = /\d{3,}/.exec(m)
  if (longRun) {
    assert(longRun.index === 0 || longRun.index === m.length - 2, `3+ digit run in middle: ${m} (run at ${longRun.index})`)
  }
})

it('formatPhone() still returns full number for admin DMs', () => {
  const f = formatPhone('+15105551234')
  assert(f.includes('510'), `expected 510 in: ${f}`)
  assert(f.includes('555'), `expected 555 in: ${f}`)
  assert(f.includes('1234'), `expected 1234 in: ${f}`)
  console.log(`     formatPhone("+15105551234") → "${f}"`)
})

it('maskPhone vs formatPhone for the same input — masked must NOT equal full', () => {
  const num = '+15105551234'
  assert(maskPhone(num) !== formatPhone(num), 'masked and full are identical')
})

console.log(`\n═══ ${pass} passed, ${fail} failed ═══`)
process.exit(fail === 0 ? 0 : 1)
