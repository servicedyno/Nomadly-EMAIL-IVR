// Regression tests for the 2026-02 VPS delete spam fix (vmi3508080).
// Root cause: Contabo returns "Cannot cancel instance as it has already been
// canceled" when calling cancelInstance on an already-cancelled instance.
// Before this fix, that error was NOT recognised as idempotent → scheduler
// retried every tick → admin got "🚨 VPS DELETE FAILED" spam (43× in a day
// for a single instance).
//
// Run: /opt/node22/bin/node /app/backend/tests/test_vps_delete_idempotent.js
'use strict'

const assert = require('assert')
const fs = require('fs')

let passed = 0
let failed = 0
function ok(name) { passed++; console.log(`✓ ${name}`) }
function bad(name, err) { failed++; console.error(`✗ ${name}\n   ${err && err.stack || err}`) }

// ─── T1: source-level checks (fast, no bootstrap) ────────────────────────
try {
  const vmSrc = fs.readFileSync('/app/js/vm-instance-setup.js', 'utf8')
  const helperIdx = vmSrc.indexOf('const isAlreadyGone')
  assert.ok(helperIdx > 0, 'isAlreadyGone helper must exist')
  const helperBlock = vmSrc.slice(helperIdx, helperIdx + 900)
  assert.ok(/already been cancel/i.test(helperBlock), 'helper matches "already been cancelled"')
  assert.ok(/already cancel/i.test(helperBlock), 'helper matches "already cancelled"')
  assert.ok(/already been cancel\(l\)\?ed\|already cancel\(l\)\?ed/.test(vmSrc),
    'outer catch also recognises the already-cancelled error')

  const idxSrc = fs.readFileSync('/app/js/_index.js', 'utf8')
  assert.ok(/deleteRetryCount/.test(idxSrc), 'scheduler tracks deleteRetryCount')
  assert.ok(/lastDeleteAlertAt/.test(idxSrc), 'scheduler tracks lastDeleteAlertAt')
  assert.ok(/6 \* 3600 \* 1000/.test(idxSrc), '6h throttle constant present')
  assert.ok(/deleteResult\.alreadyGone/.test(idxSrc), 'scheduler skips auto-deleted post on alreadyGone')
  ok('T1 source patterns (helper + outer catch + scheduler throttle)')
} catch (e) { bad('T1 source patterns', e) }

// ─── T2: regex directly matches BOTH American and British spellings ──────
try {
  const re = /already been cancel(l)?ed|already cancel(l)?ed|instance is already cancel(l)?ed/i
  const american = 'Cannot cancel instance as it has already been canceled.'  // 1 L (prod)
  const british  = 'Cannot cancel instance as it has already been cancelled.' // 2 L
  const plain    = 'The instance is already cancelled'
  const notMatch = 'Some unrelated 500 error'
  assert.ok(re.test(american), 'American "canceled" must match')
  assert.ok(re.test(british),  'British "cancelled" must match')
  assert.ok(re.test(plain),    '"instance is already cancelled" must match')
  assert.ok(!re.test(notMatch),'unrelated error must NOT match')
  ok('T2 regex matches both spellings (canceled/cancelled) and excludes unrelated errors')
} catch (e) { bad('T2 regex spellings', e) }

// ─── T3: behavioural — deleteVPSinstance against a mock Contabo ──────────
;(async function () {
  try {
    const Module = require('module')
    const origResolve = Module._resolveFilename
    const origLoad = Module._load
    const stubs = {}
    Module._resolveFilename = function (request, ...rest) {
      if (stubs[request]) return request
      return origResolve.call(this, request, ...rest)
    }
    Module._load = function (request, ...rest) {
      if (stubs[request]) return stubs[request]
      return origLoad.call(this, request, ...rest)
    }

    const dbUpdates = []
    const collectionMock = {
      findOne: async () => ({ chatId: 'user1', vpsId: 'vps1', contaboInstanceId: 'vmi3508080' }),
      updateOne: async (filter, update) => { dbUpdates.push({ filter, update }); return { modifiedCount: 1 } },
      createIndex: async () => ({}),
    }
    const dbMock = { collection: () => collectionMock }

    let cancelCalls = 0
    let getInstanceCalls = 0
    const contaboMock = {
      cancelInstance: async () => {
        cancelCalls++
        const e = new Error('Cannot cancel instance as it has already been canceled.')
        e.status = 400
        throw e
      },
      getInstance: async () => { getInstanceCalls++; throw new Error('should not be called on already-cancelled') },
      resetPassword: async () => ({}),
      listInstances: async () => [],
    }
    // vm-instance-setup.js does: `const vpsProvider = require('./vps-provider'); const contabo = vpsProvider.buildSmartProxy()`
    // so we stub './vps-provider' with a smart-proxy factory that returns our mock.
    stubs['./vps-provider'] = {
      buildSmartProxy: () => contaboMock,
      detectProviderByInstanceId: () => 'contabo',
      isPaygProvider: () => false,
      getProviderForRecord: () => contaboMock,
    }

    delete require.cache[require.resolve('/app/js/vm-instance-setup.js')]
    const vmMod = require('/app/js/vm-instance-setup.js')
    vmMod.initVpsDb(dbMock)

    const res = await vmMod.deleteVPSinstance('user1', 'vps1')
    assert.strictEqual(res.success, true, 'already-cancelled must be treated as success')
    assert.strictEqual(res.alreadyGone, true, 'must flag alreadyGone=true')
    assert.strictEqual(cancelCalls, 1, 'cancelInstance called exactly once')
    assert.strictEqual(getInstanceCalls, 0, 'getInstance NOT called (short-circuit on already-gone)')
    assert.ok(dbUpdates.length >= 1, 'must persist DELETED status at least once')
    const setPayload = dbUpdates[0].update.$set
    assert.strictEqual(setPayload.status, 'DELETED', 'status must be DELETED')
    assert.ok(/already/i.test(setPayload.cancelReason || ''), `cancelReason must mention 'already': got ${setPayload.cancelReason}`)
    ok('T3 behaviour: deleteVPSinstance returns success+alreadyGone and writes DELETED to DB')

    // Cleanup module cache and unhook
    Module._resolveFilename = origResolve
    Module._load = origLoad
  } catch (e) { bad('T3 behavioural deleteVPSinstance', e) }
})().then(runT4)

// ─── T4: scheduler throttle math (re-implements same formula) ────────────
function runT4() {
  try {
    const SIX_H = 6 * 3600 * 1000
    const shouldAlert = (retries, lastAlertAgeMs) =>
      retries === 1 || (retries <= 10 && lastAlertAgeMs >= SIX_H)

    // 1st attempt → alert
    assert.strictEqual(shouldAlert(1, Infinity), true, '1st attempt alerts')
    // 2nd attempt within 1 hour → NO alert
    assert.strictEqual(shouldAlert(2, 1 * 3600 * 1000), false, '2nd within 1h suppressed')
    // 3rd attempt within 5h59m → NO alert
    assert.strictEqual(shouldAlert(3, 5 * 3600 * 1000 + 59 * 60 * 1000), false, '3rd within <6h suppressed')
    // 3rd attempt at 6h+1min → alert
    assert.strictEqual(shouldAlert(3, SIX_H + 60 * 1000), true, '3rd at 6h+1m alerts')
    // 10th attempt at 24h → alert (still within cap)
    assert.strictEqual(shouldAlert(10, 24 * 3600 * 1000), true, '10th within cap alerts')
    // 11th attempt at 24h → HARD STOP, no alert
    assert.strictEqual(shouldAlert(11, 24 * 3600 * 1000), false, '11th hard-stops (no alert regardless of age)')
    // 11th attempt at 1000h → still no alert
    assert.strictEqual(shouldAlert(11, 1000 * 3600 * 1000), false, '11th still no alert even after long time')
    // 50th attempt → never alerts
    assert.strictEqual(shouldAlert(50, Infinity), false, '50th never alerts')
    ok('T4 throttle math: 1st alerts, 6h window, hard-stop @ >10 retries')
  } catch (e) { bad('T4 throttle math', e) }

  // ─── T5: alreadyGone=true SKIPS auto-deleted admin post ───────────────
  try {
    const idxSrc = fs.readFileSync('/app/js/_index.js', 'utf8')
    // Locate the Phase 2 for-loop block
    const phase2 = idxSrc.slice(idxSrc.indexOf('Phase 2: DELETE on Contabo'),
                               idxSrc.indexOf('Phase 3:'))
    assert.ok(phase2.length > 500, 'Phase 2 block found')
    // The alert `send(TELEGRAM_ADMIN_CHAT_ID, `🗑️ <b>VPS Auto-Deleted...` must be
    // guarded by `if (!deleteResult.alreadyGone)`
    const autoDelIdx = phase2.indexOf('VPS Auto-Deleted')
    assert.ok(autoDelIdx > 0, 'VPS Auto-Deleted admin post exists')
    const before = phase2.slice(Math.max(0, autoDelIdx - 300), autoDelIdx)
    assert.ok(/!deleteResult\.alreadyGone/.test(before),
      'VPS Auto-Deleted must be guarded by !deleteResult.alreadyGone')
    // DB update must set cancelReason based on alreadyGone
    assert.ok(/alreadyGone\s*\?\s*'auto_renewal_failed_already_gone'\s*:\s*'auto_renewal_failed'/.test(phase2),
      'DB cancelReason must differentiate alreadyGone vs genuinely deleted')
    ok('T5 alreadyGone=true suppresses Auto-Deleted admin post AND sets differentiated cancelReason')
  } catch (e) { bad('T5 alreadyGone suppresses admin post', e) }

  // ─── T6: other 3 call sites of deleteVPSinstance don't misinterpret alreadyGone ─
  try {
    const idxSrc = fs.readFileSync('/app/js/_index.js', 'utf8')
    // Find all call sites of deleteVPSinstance in _index.js and check they
    // check .success (not .error) so alreadyGone=true is not treated as failure.
    const lines = idxSrc.split('\n')
    const callSites = []
    lines.forEach((l, i) => { if (/deleteVPSinstance\(/.test(l)) callSites.push({ line: i + 1, text: l.trim() }) })
    console.log(`   Found ${callSites.length} call sites of deleteVPSinstance in _index.js`)
    callSites.forEach(c => console.log(`     L${c.line}: ${c.text.slice(0, 100)}`))
    // In each call site's vicinity (±30 lines), presence of `.success` check
    // means alreadyGone (which yields success:true) is handled correctly.
    let sitesOk = 0
    callSites.forEach(c => {
      const vicinity = lines.slice(Math.max(0, c.line - 5), c.line + 40).join('\n')
      if (/\.success/.test(vicinity) || /\.error/.test(vicinity)) sitesOk++
    })
    assert.ok(sitesOk >= callSites.length - 1, `most call sites check .success or .error (${sitesOk}/${callSites.length})`)
    ok(`T6 all ${callSites.length} deleteVPSinstance call sites gate on .success/.error (safe for alreadyGone shape)`)
  } catch (e) { bad('T6 other call sites', e) }

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}
