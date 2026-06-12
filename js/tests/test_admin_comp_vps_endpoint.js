/**
 * Static-source regression test for the /admin/comp-vps endpoint.
 *
 * Why static-only: the endpoint is wired into the live Express app inside
 * _index.js (37k+ lines) and depends on the full bot bootstrap (db, state,
 * vpsPlansOf, buyVPSPlanFullProcess, etc.). Spinning that up in a test
 * harness is impractical. Instead, this test guards the critical contract
 * points so a future refactor can't silently break them:
 *
 *   1. Endpoint exists at POST /admin/comp-vps
 *   2. Auth check uses SESSION_SECRET.slice(0, 16) (matches sibling admin endpoints)
 *   3. Required fields validated: chatId, compReason (>=3 chars)
 *   4. Count is hard-capped (≤10) to prevent slip-of-the-finger billing storms
 *   5. Each provisioned record is tagged with `comp: true` + `compReason` + `compAt`
 *   6. Per-instance failure does NOT abort the whole loop
 *   7. Provisioning uses buyVPSPlanFullProcess (the standard pipeline,
 *      which deliberately does NOT touch the wallet)
 */
const fs = require('fs')
const path = require('path')

const src = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf-8')

let pass = 0
let fail = 0
function assert(name, cond, hint) {
  if (cond) { console.log(`  ✓ ${name}`); pass++ }
  else { console.log(`  ✗ ${name}${hint ? ' — ' + hint : ''}`); fail++ }
}

// Extract the endpoint block (start at the comment header, end at the next app.<verb> at column 0)
const startIdx = src.indexOf('// /admin/comp-vps — provision N free VPS')
assert('endpoint header comment present', startIdx > 0, 'comment block missing — endpoint may have been removed')
// Find the route opener
const routeIdx = src.indexOf("app.post('/admin/comp-vps'", startIdx)
assert('route registered at POST /admin/comp-vps', routeIdx > startIdx)

// Slice to next `app.` boundary at start of a new endpoint
const nextRouteIdx = src.indexOf('\napp.', routeIdx + 1)
const endpointBlock = src.slice(routeIdx, nextRouteIdx > 0 ? nextRouteIdx : routeIdx + 5000)

// ── 1. Auth guard ─────────────────────────────────────────────────────────
assert(
  'auth uses SESSION_SECRET.slice(0, 16)',
  /SESSION_SECRET\?\.slice\(0,\s*16\)/.test(endpointBlock),
  'auth check changed or removed'
)
assert(
  'returns 403 on bad key',
  /res\.status\(403\)\.json\(/.test(endpointBlock),
  '403 path missing'
)

// ── 2. Required field validation ─────────────────────────────────────────
assert(
  'rejects missing chatId',
  /Missing chatId/.test(endpointBlock)
)
assert(
  'rejects missing/short compReason',
  /compReason required/.test(endpointBlock) && /length < 3/.test(endpointBlock),
  'compReason guard missing or weakened'
)
assert(
  'rejects missing vpsDetails',
  /No vpsDetails available/.test(endpointBlock)
)

// ── 3. Count safety cap ──────────────────────────────────────────────────
assert(
  'count capped at 10',
  /Math\.min\(Number\(count\)\s*\|\|\s*1,\s*10\)/.test(endpointBlock),
  'no count ceiling — slip-of-finger could create a billing storm'
)
assert(
  'count floor at 1',
  /Math\.max\(1/.test(endpointBlock)
)

// ── 4. Audit metadata tagging ────────────────────────────────────────────
assert(
  'comp metadata has comp: true',
  /comp:\s*true/.test(endpointBlock),
  'records would not be distinguishable from paid VPS'
)
assert(
  'comp metadata has compReason',
  /compReason,/.test(endpointBlock) || /compReason\s*}/.test(endpointBlock)
)
assert(
  'comp metadata has compAt',
  /compAt:\s*new Date/.test(endpointBlock)
)
assert(
  'comp metadata has compBy attribution',
  /compBy:\s*['"]admin\/comp-vps['"]/.test(endpointBlock)
)
assert(
  'records tagged with compIndex (1-based position in batch)',
  /compIndex/.test(endpointBlock)
)

// ── 5. Failure isolation ─────────────────────────────────────────────────
assert(
  'errors collected per-instance (continue, not return)',
  /errors\.push\(/.test(endpointBlock) && /continue/.test(endpointBlock),
  'whole batch would abort on first failure — billing leak risk'
)
assert(
  'response includes both provisioned[] and errors[]',
  /provisioned/.test(endpointBlock) && /errors/.test(endpointBlock)
)

// ── 6. Uses the standard pipeline (does NOT touch wallet) ────────────────
assert(
  'calls buyVPSPlanFullProcess (standard pipeline, no wallet deduction)',
  /buyVPSPlanFullProcess\(chatIdStr,\s*lang,\s*perInstance\)/.test(endpointBlock),
  'endpoint must reuse the standard pipeline so audit/email/telegram flows behave like a normal purchase'
)
// Crucially — must NOT call any wallet debit helpers from this endpoint
assert(
  'no direct wallet debit call (deductFromWallet / charge / debit)',
  !/deductFromWallet|chargeWallet|debitWallet/.test(endpointBlock),
  'endpoint must not deduct from the user wallet — this is a comp'
)

// ── 7. Logs for audit trail ──────────────────────────────────────────────
assert(
  'logs comp activity with chatId + reason',
  /\[admin\/comp-vps\].*chatId=.*reason=/.test(endpointBlock) ||
  /admin\/comp-vps.*chatId.*compReason/.test(endpointBlock),
  'no audit log line — operator review impossible'
)

console.log()
if (fail) { console.error(`❌ ${fail} test(s) failed`); process.exit(1) }
console.log(`✅ All ${pass} comp-vps endpoint guards pass`)
