/**
 * Verification for audit fix #22 — surface wallet floors EARLY (at entry) with
 * a pre-filled deposit, instead of failing deep in the flow.
 *   • Bulk IVR $50 floor at "Select Caller ID".
 *   • Call-forwarding $25 recommended floor on the forwarding screen.
 *
 * Run: node js/tests/test_early_floors_2026-06.js  (exit 0 = pass)
 */
const fs = require('fs')
const path = require('path')
const s = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

let pass = 0, fail = 0
const failures = []
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; failures.push(name); console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('── Fix #22 — early floors ──')
check('shared entry-floor wall helper defined (_showEntryFloorWall)',
  /const _showEntryFloorWall = \(usdBal, floorUsd, featureLabel\) =>/.test(s))
check('entry-floor wall renders pre-filled deposit buttons',
  /const _showEntryFloorWall[\s\S]{0,2000}💵 Deposit \$\$\{dep1\}/.test(s))

// Bulk IVR
check('Bulk IVR reads its floor from BULK_CALL_MIN_WALLET',
  /const _bulkFloor = parseFloat\(process\.env\.BULK_CALL_MIN_WALLET \|\| '50'\)/.test(s))
check('Bulk IVR blocks at Select Caller ID with the entry-floor wall',
  /_bulkBal < _bulkFloor\) return _showEntryFloorWall\(_bulkBal, _bulkFloor, 'Bulk IVR'\)/.test(s))
check('Bulk IVR floor check sits before bulkSelectCaller state is set',
  s.indexOf("_showEntryFloorWall(_bulkBal, _bulkFloor, 'Bulk IVR')") < s.indexOf("await set(state, chatId, 'action', a.bulkSelectCaller)"))

// Forwarding
check('forwarding reads its recommended floor from FORWARDING_MIN_WALLET',
  /const _fwdFloor = parseFloat\(process\.env\.FORWARDING_MIN_WALLET \|\| '25'\)/.test(s))
check('forwarding screen adds a pre-filled deposit button when below floor',
  /walletBal < _fwdFloor\) \{[\s\S]{0,200}btns\.unshift\(\[`💵 Deposit \$\$\{_fwdDep\}`\]\)/.test(s))
check('forwarding low-balance note is localised (4 langs)',
  /Forwarding bills per-minute[\s\S]{0,400}fr:[\s\S]{0,400}zh:[\s\S]{0,400}hi:/.test(s))

// The pre-filled "💵 Deposit $N" tap is already handled by the shared parser
check('pre-filled deposit taps are parsed by the shared deposit-wall handler',
  /\^💵 Deposit \\\$\(\\d\+/.test(s))

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
if (fail) { console.log('FAILURES:'); failures.forEach(f => console.log('  • ' + f)) }
process.exit(fail ? 1 : 0)
