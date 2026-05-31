// Validates the AI Support prompt + cPanel Health fixes (2026-02):
//
//   • AI prompt now contains an explicit "MySQL Databases" section telling
//     the LLM to route users to the hosting panel for ALL database tasks.
//   • cpanel-health.js: PROBE_TIMEOUT_MS bumped to 10s, DOWN_THRESHOLD_MISSES
//     bumped to 3.
//
// Run with:  node tests/test_ai_support_and_health_fixes.js

'use strict'

const fs = require('fs')
const path = require('path')

let passed = 0
let failed = 0
const assert = (cond, name) => {
  if (cond) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}`); failed++ }
}

// ── AI support prompt content checks ─────────────────────────────────────
console.log('\nTest A: ai-support.js system prompt mentions hosting panel for MySQL')
const aiPath = path.join(__dirname, '..', 'js', 'ai-support.js')
const ai = fs.readFileSync(aiPath, 'utf8')

assert(/MySQL Databases.*managed in the hosting panel/i.test(ai),
  'A1 prompt has "MySQL Databases (managed in the hosting panel)" header')
assert(/MySQL database management.*from the hosting panel.*NOT from the bot/is.test(ai),
  'A2 prompt explicitly says MySQL is managed from hosting panel, NOT from bot')
assert(/Do NOT.*tell the user to use any in-bot.*mysql.*command/is.test(ai),
  'A3 prompt instructs assistant NOT to point users to in-bot /mysql commands')
assert(/phpMyAdmin/.test(ai), 'A4 prompt mentions phpMyAdmin')
assert(/Remote MySQL/.test(ai), 'A5 prompt mentions Remote MySQL')

// ── cpanel-health constants ──────────────────────────────────────────────
console.log('\nTest B: cpanel-health.js timeout + DOWN threshold updated')
const hPath = path.join(__dirname, '..', 'js', 'cpanel-health.js')
const h = fs.readFileSync(hPath, 'utf8')

assert(/const PROBE_TIMEOUT_MS = 10000/.test(h), 'B1 PROBE_TIMEOUT_MS = 10000')
assert(/const DOWN_THRESHOLD_MISSES = 3/.test(h), 'B2 DOWN_THRESHOLD_MISSES = 3')

// ── package.json / supervisor heap-size flag ─────────────────────────────
console.log('\nTest C: Node startup uses --max-old-space-size=2048')
const pkgPath = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
assert(/--max-old-space-size=2048/.test(pkg.scripts.start),
  `C1 package.json start script has --max-old-space-size=2048 (got: ${pkg.scripts.start})`)

const supervisorPath = '/etc/supervisor/conf.d/supervisord_nodejs.conf'
if (fs.existsSync(supervisorPath)) {
  const sv = fs.readFileSync(supervisorPath, 'utf8')
  assert(/--max-old-space-size=2048/.test(sv),
    'C2 supervisor nodejs.conf has --max-old-space-size=2048')
} else {
  console.log('  ⏭️  C2 supervisor conf not present in this env — skipped')
}

console.log(`\nResults: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
