/**
 * Behavioral tests for the @hellpeaces (5522767823) File Manager EPERM fix.
 *
 * Incident: cPanel account `prevc2b4` (previteletterviews.com) hit
 *   `"/usr/local/cpanel/uapi" exited with status 1 (EPERM)`
 * — a broken homedir/quota on the WHM box. The panel showed a raw
 * "Create folder failed: 500", never paged ops, and the user couldn't
 * open existing folders either. It festered ~2 weeks (2026-07-03 → 07-21)
 * with 4 manual escalations.
 *
 * These tests cover the NEW pure helpers added to cpanel-proxy.js that back
 * the fix (friendly UX + deduped ops paging with exact remediation). They do
 * NOT touch cPanel/WHM or the DB.
 */

const assert = require('assert')

// Real-looking host so the fake-host guard in alertEpermRepairNeeded doesn't
// suppress the legitimate alerts under test.
process.env.WHM_HOST = '68.183.77.106'
const cp = require('../cpanel-proxy')

let passed = 0, failed = 0
function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed++ }
  catch (e) { console.error(`❌ ${name}\n   ${e.message}`); failed++ }
}

const EPERM_RAW = '"/usr/local/cpanel/uapi" exited with status 1 (EPERM).'

console.log('\n=== @hellpeaces EPERM fix — pure helper behavioral tests ===\n')

// 1) EPERM detection matches the exact incident string
test('looksLikeUapiPermFailure matches the exact @hellpeaces string', () => {
  assert.strictEqual(cp.looksLikeUapiPermFailure(EPERM_RAW), true)
})
test('looksLikeUapiPermFailure is false for an ordinary error', () => {
  assert.strictEqual(cp.looksLikeUapiPermFailure('mkdir: File exists'), false)
})

// 2) Friendly user message — localized + safe fallback
test('getEpermUserMessage returns a calm, non-technical EN message', () => {
  const m = cp.getEpermUserMessage('en')
  assert.ok(/permission issue/i.test(m), 'should mention a permission issue')
  assert.ok(/safe/i.test(m), 'should reassure data is safe')
  assert.ok(!/EPERM|uapi|500/i.test(m), 'must NOT leak raw technical error to the user')
})
test('getEpermUserMessage falls back to EN for unknown lang', () => {
  assert.strictEqual(cp.getEpermUserMessage('xx'), cp.getEpermUserMessage('en'))
})
test('getEpermLocalizedMessages covers en/fr/zh/hi', () => {
  const all = cp.getEpermLocalizedMessages()
  for (const l of ['en', 'fr', 'zh', 'hi']) {
    assert.ok(all[l] && all[l].length > 10, `missing/short message for ${l}`)
  }
})

// 3) Ops alert carries the EXACT remediation ops needs to fix the box
test('buildEpermOpsAlert includes account, host and the exact repair commands', () => {
  const msg = cp.buildEpermOpsAlert({ op: 'create folder', cpUser: 'prevc2b4', domain: 'previteletterviews.com', whmHost: '68.183.77.106' })
  assert.ok(msg.includes('prevc2b4'), 'must include the cPanel user')
  assert.ok(msg.includes('previteletterviews.com'), 'must include the domain')
  assert.ok(msg.includes('68.183.77.106'), 'must include the WHM host')
  assert.ok(msg.includes('/scripts/fixquotas'), 'must include fixquotas remediation')
  assert.ok(msg.includes('/scripts/fixhomedirperms --user=prevc2b4'), 'must include per-user fixhomedirperms remediation')
  assert.ok(/EPERM/i.test(msg), 'should label the failure class for ops')
})

// 4) alertEpermRepairNeeded — dedup, per-op keying, guards, notifier wiring
test('alertEpermRepairNeeded pages once, then dedups within the throttle window', () => {
  const sent = []
  cp.setAdminNotifier((m) => sent.push(m))
  const args = { op: 'create folder', cpUser: 'dedupUserA', domain: 'a.com', whmHost: '68.183.77.106' }
  const first = cp.alertEpermRepairNeeded(args)
  const second = cp.alertEpermRepairNeeded(args)
  assert.strictEqual(first, true, 'first alert should fire')
  assert.strictEqual(second, false, 'duplicate within window should be suppressed')
  assert.strictEqual(sent.length, 1, 'notifier should be called exactly once')
  assert.ok(sent[0].includes('dedupUserA'))
})

test('alertEpermRepairNeeded keys by (cpUser + op) — a different op pages again', () => {
  const sent = []
  cp.setAdminNotifier((m) => sent.push(m))
  const base = { cpUser: 'dedupUserB', domain: 'b.com', whmHost: '68.183.77.106' }
  const a = cp.alertEpermRepairNeeded({ ...base, op: 'create folder' })
  const b = cp.alertEpermRepairNeeded({ ...base, op: 'open folder' })
  assert.strictEqual(a, true)
  assert.strictEqual(b, true, 'distinct op should not be deduped against the first')
  assert.strictEqual(sent.length, 2)
})

test('alertEpermRepairNeeded refuses obviously-fake test hosts', () => {
  const sent = []
  cp.setAdminNotifier((m) => sent.push(m))
  const r = cp.alertEpermRepairNeeded({ op: 'create folder', cpUser: 'fakeHostUser', domain: 'x.com', whmHost: 'test.host' })
  assert.strictEqual(r, false)
  assert.strictEqual(sent.length, 0)
})

test('alertEpermRepairNeeded returns false when no cpUser', () => {
  cp.setAdminNotifier(() => {})
  assert.strictEqual(cp.alertEpermRepairNeeded({ op: 'create folder', whmHost: '68.183.77.106' }), false)
})

console.log(`\n${passed}/${passed + failed} assertions passed\n`)
process.exit(failed === 0 ? 0 : 1)
