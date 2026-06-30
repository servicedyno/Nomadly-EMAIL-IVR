/**
 * Regression test: phone-scheduler.js must NEVER pass a full phone number as
 * the PUBLIC arg of _notifyGroup. Public arg = first arg; admin/private arg
 * = second arg. The full number is OK in the private arg.
 *
 * Reported 2026-07-01: "phone number expiry or renewal to group is showing
 * the full number, it shouldn't".
 *
 * This is a STATIC-SOURCE guard: parses phone-scheduler.js and asserts every
 * _notifyGroup?.() call where the body references `phoneNumber` either:
 *   (a) wraps the PUBLIC (1st) phoneNumber occurrence in maskPhone(...), OR
 *   (b) the call has only one arg AND no phoneNumber is in the message at all.
 *
 * If anyone re-introduces `formatPhone(num.phoneNumber)` as the SOLE arg, or
 * passes raw `${num.phoneNumber}` to the first arg, this test fails.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const SRC = fs.readFileSync(path.join(__dirname, '..', 'phone-scheduler.js'), 'utf8')

let pass = 0
let fail = 0
const it = (label, cond, detail = '') => {
  if (cond) { console.log(`  ✅ ${label}`); pass++ }
  else      { console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`); fail++ }
}

console.log('\n=== phone-scheduler.js — no-leak guard ===')

// Find every _notifyGroup?.( ... ) call (multiline body, until matching close).
// We use a simple balanced-paren scanner because regex can't handle nesting.
const findCalls = (src) => {
  const calls = []
  const TRIG = '_notifyGroup?.('
  let i = 0
  while (true) {
    const idx = src.indexOf(TRIG, i)
    if (idx === -1) break
    const start = idx + TRIG.length
    let depth = 1
    let j = start
    let inStr = null     // ' " ` for string state
    let inTpl = false    // for inside ${...} in template literal
    while (j < src.length && depth > 0) {
      const c = src[j]
      const prev = src[j - 1]
      if (inStr) {
        if (c === inStr && prev !== '\\') inStr = null
      } else {
        if (c === "'" || c === '"' || c === '`') inStr = c
        else if (c === '(') depth++
        else if (c === ')') depth--
      }
      j++
    }
    const body = src.slice(start, j - 1)
    // Line number
    const line = src.slice(0, idx).split('\n').length
    // Split into args at TOP-level commas only (ignore commas inside strings/parens/objects)
    const args = []
    let acc = ''; let d = 0; let s = null
    for (let k = 0; k < body.length; k++) {
      const c = body[k]
      if (s) { if (c === s && body[k - 1] !== '\\') s = null; acc += c; continue }
      if (c === "'" || c === '"' || c === '`') { s = c; acc += c; continue }
      if (c === '(' || c === '[' || c === '{') d++
      if (c === ')' || c === ']' || c === '}') d--
      if (c === ',' && d === 0) { args.push(acc); acc = ''; continue }
      acc += c
    }
    if (acc.trim().length) args.push(acc)
    calls.push({ line, body, args: args.map((a) => a.trim()) })
    i = j
  }
  return calls
}

const calls = findCalls(SRC)
it(`found ≥9 _notifyGroup calls (got ${calls.length})`, calls.length >= 9)

let leaks = 0
for (const c of calls) {
  const pub = c.args[0] || ''
  const priv = c.args[1] || ''
  const pubHasRawPhone = /\bphoneNumber\b/.test(pub) || /num\.phoneNumber/.test(pub)
  const pubHasFormatPhone = /formatPhone\s*\(/.test(pub)
  const pubHasMaskPhone = /maskPhone\s*\(/.test(pub)

  // PUBLIC arg must either:
  //   - not contain phoneNumber at all (safe), OR
  //   - contain only maskPhone(...), no formatPhone or raw template
  const publicLeak =
    (pubHasRawPhone || pubHasFormatPhone) && !pubHasMaskPhone
  const rawTemplateLeak =
    /\$\{[^}]*\.phoneNumber[^}]*\}/.test(pub) && !pubHasMaskPhone

  if (publicLeak || rawTemplateLeak) {
    leaks++
    console.log(`  ❌ LEAK at line ${c.line}: public arg contains raw phone or formatPhone without maskPhone`)
    console.log(`     public: ${pub.slice(0, 200)}`)
  }
}
it(`zero leaks in _notifyGroup public args (found ${leaks})`, leaks === 0)

// Sanity: maskPhone must be imported in phone-scheduler.js
it(
  'maskPhone is imported from ./phone-config.js',
  /require\(['"]\.\/phone-config(\.js)?['"]\)/.test(SRC) && /\bmaskPhone\b/.test(SRC),
  'expected maskPhone in destructuring from phone-config.js'
)

// Spot-check known fix sites (line numbers within tolerance ±5)
const expectedSites = [
  { tag: 'Release ABORTED (safety)', mustHave: 'maskPhone(num.phoneNumber)' },
  { tag: 'Grace Period Started', mustHave: 'maskPhone(num.phoneNumber)' },
  { tag: 'Grace Expired + Released', mustHave: 'maskPhone(num.phoneNumber)' },
  { tag: 'Auto-Renew Deferred (no release)', mustHave: 'maskPhone(num.phoneNumber)' },
  { tag: 'Expired + Released:', mustHave: 'maskPhone(num.phoneNumber)' },
  { tag: 'Sub-number planPrice anomaly', mustHave: 'maskPhone(num.phoneNumber)' },
  { tag: 'PlanPrice MISMATCH', mustHave: 'maskPhone(num.phoneNumber)' },
  { tag: 'Auto-renew ABORTED — invalid planPrice', mustHave: 'maskPhone(num.phoneNumber)' },
  { tag: 'Auto-Renewed:', mustHave: 'maskPhone(num.phoneNumber)' },
]
for (const e of expectedSites) {
  it(
    `notification "${e.tag}" uses maskPhone in public arg`,
    SRC.includes(e.tag) && (() => {
      // find call near this tag
      const idx = SRC.indexOf(e.tag)
      if (idx < 0) return false
      // search the preceding 800 chars for _notifyGroup?.( … and verify maskPhone is in the public-arg portion
      const windowStart = Math.max(0, idx - 800)
      const window = SRC.slice(windowStart, idx + 400)
      return window.includes('maskPhone(num.phoneNumber)')
    })(),
  )
}

console.log(`\n═══ ${pass} passed, ${fail} failed ═══`)
process.exit(fail === 0 ? 0 : 1)
