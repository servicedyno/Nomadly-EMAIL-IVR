/**
 * test_use_my_domain_await.js
 *
 * Regression guard for the "Use My Domain" flow race condition reported by
 * @jasonthekidd (chat 7893016294) on 2026-05-06:
 *   User tapped a domain from the purchased list → bot silently redirected
 *   to the "Connect External Domain" options menu instead of proceeding to
 *   the email step. Root cause: three `saveInfo(...)` calls preceding
 *   `goto.enterYourEmail()` were not `await`ed, so the `if (!info.website_name)`
 *   guard in `enterYourEmail` read stale closure state and bailed.
 *
 * This static test reads the compiled source of _index.js and enforces that
 * every `saveInfo(...)` immediately preceding `goto.enterYourEmail()` in the
 * `action === a.useMyDomain` branch is awaited.
 *
 * Run: node /app/js/tests/test_use_my_domain_await.js
 */
const fs = require('fs')
const path = require('path')

const src = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

// Locate the useMyDomain handler block
const start = src.indexOf('if (action === a.useMyDomain)')
if (start === -1) { console.error('❌ useMyDomain handler not found'); process.exit(1) }
// Grab ~1500 chars — the handler body is short
const rawBlock = src.slice(start, start + 1500)
// Strip // comments so we don't match the goto inside the bug-fix comment
const block = rawBlock.split('\n').map(l => {
  const cIdx = l.indexOf('//')
  return cIdx >= 0 ? l.slice(0, cIdx) : l
}).join('\n')

// Verify the three saveInfo calls are awaited AND precede goto.enterYourEmail()
const needles = [
  "await saveInfo('website_name',",
  "await saveInfo('existingDomain',",
  "await saveInfo('nameserver',",
]
const gotoIdx = block.indexOf('goto.enterYourEmail()')
if (gotoIdx === -1) { console.error('❌ goto.enterYourEmail() not found in useMyDomain'); process.exit(1) }

let ok = 0
for (const needle of needles) {
  const i = block.indexOf(needle)
  if (i === -1) {
    console.error(`❌ Missing: ${needle}`)
  } else if (i >= gotoIdx) {
    console.error(`❌ Ordering: ${needle} should come BEFORE goto.enterYourEmail()`)
  } else {
    console.log(`✅ ${needle} — awaited and ordered correctly`)
    ok++
  }
}

// Also assert there is NO un-awaited `saveInfo(` in the critical 200 chars before the goto
const preGoto = block.slice(Math.max(0, gotoIdx - 400), gotoIdx)
const unawaited = preGoto.match(/(?<!await\s)\bsaveInfo\(/g)
if (unawaited) {
  console.error(`❌ Found un-awaited saveInfo(...) right before goto.enterYourEmail(): ${unawaited.length} occurrence(s)`)
  process.exit(1)
}
console.log('✅ No un-awaited saveInfo() found in the final 400 chars before goto.enterYourEmail()')

if (ok === needles.length) {
  console.log(`\n── ${ok + 1}/${needles.length + 1} passed — useMyDomain flow is race-free ──`)
  process.exit(0)
} else {
  process.exit(1)
}
