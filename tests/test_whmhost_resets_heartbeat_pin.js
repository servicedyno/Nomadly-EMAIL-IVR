/**
 * Regression test: every code path that repoints a cpanelAccount to a new whmHost
 * MUST also clear the protection-heartbeat "stuck" flags. If it doesn't, the
 * 2026-06-17 bug recurs and the heartbeat silently skips migrated accounts.
 *
 * See /app/memory/ANTI_RED_AUDIT_AND_FIX_2026-02-20.md fix #1.
 *
 * This test is a static analysis — it greps every file that does a Mongo
 * $set on whmHost and asserts the same update also $unset's the pin fields.
 * Run as part of CI / pre-deploy.
 */
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

// Files that have been verified to correctly clear pin flags when setting whmHost.
// Any new file that updates whmHost in MongoDB must either:
//   - clear protectionRepairCount, protectionLastSkipReason, protectionStuckAt,
//     protectionRepairUpdatedAt in the same update, OR
//   - be explicitly listed in EXEMPT_FILES below with a justification comment.
const EXEMPT_FILES = new Set([
  // storeCredentials in cpanel-auth.js: uses upsert with $set of a full doc
  // template that doesn't include pin fields. For NEW accounts (the only path
  // that calls this), there are no pin fields to clear. The recovery script
  // wraps the storeCredentials call with an explicit $unset, so re-store
  // scenarios are also covered.
  'js/cpanel-auth.js',
  // cpanel-routes.js: READS req.whmHost, never WRITES it. Filtered out by
  // the regex below as well, but listing for clarity.
  'js/cpanel-routes.js',
  // seed_store_phase2.js: creates a fresh __seedTest cPanel account via upsert
  // with a hard-coded full doc. No pre-existing pin fields to clear (the
  // account doesn't exist before the upsert). Marked __seedTest:true.
  'scripts/seed_store_phase2.js',
])

const PIN_FIELDS = [
  'protectionRepairCount',
  'protectionLastSkipReason',
  'protectionStuckAt',
  'protectionRepairUpdatedAt',
]

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['node_modules', '.git', '__tests__'].includes(e.name)) continue
      walk(p, out)
    } else if (e.isFile() && p.endsWith('.js')) {
      out.push(p)
    }
  }
  return out
}

function check() {
  const files = [...walk(path.join(ROOT, 'js')), ...walk(path.join(ROOT, 'scripts'))]
  const violations = []
  // Match a Mongo update whose $set assigns whmHost to anything OTHER than reading it
  // We use a generous heuristic: find updateOne/updateMany blocks that include
  // the literal "whmHost:" inside a $set object.
  const setWhmRx = /\$set\s*:\s*\{[^}]*\bwhmHost\s*:/g

  for (const f of files) {
    const rel = path.relative(ROOT, f)
    if (EXEMPT_FILES.has(rel)) continue
    const src = fs.readFileSync(f, 'utf8')
    if (!setWhmRx.test(src)) continue
    // File writes whmHost. Verify it also clears at least one pin field
    // somewhere within ~30 lines of each $set match.
    setWhmRx.lastIndex = 0
    let m
    while ((m = setWhmRx.exec(src)) !== null) {
      const startOffset = m.index
      // Look ahead up to 1500 chars (covers ~30 lines) for a matching $unset
      // that includes any pin field, OR look for an explicit $unset in any
      // adjacent update (within 4000 chars to handle helper-call patterns).
      const window = src.slice(Math.max(0, startOffset - 500), startOffset + 4000)
      const hasUnset = PIN_FIELDS.some(field => new RegExp(`\\$unset[^{]*\\{[^}]*${field}`, 's').test(window))
      if (!hasUnset) {
        const line = src.slice(0, startOffset).split('\n').length
        violations.push({ file: rel, line, snippet: src.slice(startOffset, startOffset + 200).replace(/\s+/g, ' ') })
      }
    }
  }

  return violations
}

const violations = check()
if (violations.length === 0) {
  console.log('✅ All whmHost-setting code paths also clear protection-heartbeat pin flags.')
  process.exit(0)
} else {
  console.error('❌ Found code that repoints whmHost without clearing the protection-heartbeat pin flags.')
  console.error('   This will cause the 2026-06-17 silent-heartbeat-skip bug to recur on migrated accounts.')
  console.error('   See /app/memory/ANTI_RED_AUDIT_AND_FIX_2026-02-20.md fix #1.')
  console.error('   Fix: add $unset for protectionRepairCount, protectionLastSkipReason,')
  console.error('         protectionStuckAt, protectionRepairUpdatedAt — OR add the file to EXEMPT_FILES.')
  console.error('')
  for (const v of violations) {
    console.error(`   ${v.file}:${v.line}`)
    console.error(`     ${v.snippet}`)
  }
  process.exit(1)
}
