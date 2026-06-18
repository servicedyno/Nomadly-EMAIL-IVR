/**
 * OVH VPS — full management API verification on existing service.
 *
 * Tests 5 mutations sequentially on a live VPS:
 *   1. POST /vps/{sn}/reboot            → expect state running → running (~30 s)
 *   2. POST /vps/{sn}/stop              → expect state running → stopped (~10 s)
 *   3. POST /vps/{sn}/start             → expect state stopped → running (~30 s)
 *   4. PUT /vps/{sn}/serviceInfos       → flip auto-renew ON → OFF
 *   5. PUT /vps/{sn}/serviceInfos       → flip auto-renew OFF → ON (restore)
 *
 * Each power mutation polls the task to 'done' then confirms VPS state.
 * Auto-renew toggle is bookended so the final renew.automatic value matches
 * what we started with — no human-visible side-effect after the test.
 *
 * Usage: node test_ovh_full_mgmt.js <serviceName>
 */
require('dotenv').config({ path: '/app/.env' })
const axios = require('axios')
const crypto = require('crypto')

const SN = process.argv[2]
if (!SN) { console.error('usage: node test_ovh_full_mgmt.js <serviceName>'); process.exit(1) }

const AK = process.env.OVH_APP_KEY
const AS = process.env.OVH_APP_SECRET
const CK = process.env.OVH_CONSUMER_KEY
const BASE = process.env.OVH_ENDPOINT

let _delta = null
async function timeOffset() {
  if (_delta != null) return _delta
  const r = await axios.get(`${BASE}/auth/time`)
  _delta = r.data - Math.round(Date.now() / 1000)
  return _delta
}
async function req(method, path, body = null) {
  const delta = await timeOffset()
  const ts = Math.round(Date.now() / 1000) + delta
  const url = BASE + path
  const bodyStr = body ? JSON.stringify(body) : ''
  const sig = '$1$' + crypto.createHash('sha1').update([AS, CK, method, url, bodyStr, ts].join('+')).digest('hex')
  const r = await axios({ method, url, data: body || undefined, headers: {
    'X-Ovh-Application': AK,
    'X-Ovh-Consumer': CK,
    'X-Ovh-Timestamp': String(ts),
    'X-Ovh-Signature': sig,
    'Content-Type': 'application/json',
  } })
  return r.data
}

async function pollVpsState(sn, expect, taskId, maxSec = 180) {
  const t0 = Date.now()
  while ((Date.now() - t0) / 1000 < maxSec) {
    await new Promise(r => setTimeout(r, 4000))
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
    let task = null, vps = null
    try { task = await req('GET', `/vps/${sn}/tasks/${taskId}`) } catch (_) {}
    try { vps = await req('GET', `/vps/${sn}`) } catch (_) {}
    console.log(`    +${elapsed.padStart(3, ' ')}s   task=${task?.state ?? '?'} (${task?.progress ?? '?'}%)   vps.state=${vps?.state ?? '?'}`)
    if (task?.state === 'done' && (!expect || vps?.state === expect)) return { elapsedSec: Number(elapsed), finalState: vps?.state }
  }
  throw new Error(`Timeout waiting for vps.state=${expect} (task=${taskId})`)
}

;(async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  OVH VPS full management test — ${SN}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Snapshot starting state
  const before = await req('GET', `/vps/${SN}`)
  const beforeRenew = (await req('GET', `/vps/${SN}/serviceInfos`)).renew
  const beforeIps = await req('GET', `/vps/${SN}/ips`).catch(() => [])
  console.log(`\nStarting state:  power=${before.state}  renew.automatic=${beforeRenew.automatic}  ips=${JSON.stringify(beforeIps)}\n`)

  if (before.state !== 'running' && before.state !== 'stopped') {
    console.log(`⚠️  VPS state '${before.state}' is unexpected — aborting.`)
    process.exit(1)
  }

  // Decide test order so final power state == starting power state.
  // If starting from 'running': reboot → stop → start
  // If starting from 'stopped': start → reboot → stop
  const startedRunning = before.state === 'running'
  const steps = startedRunning
    ? [
        { label: 'reboot', method: 'POST', path: `/vps/${SN}/reboot`, expect: 'running' },
        { label: 'stop',   method: 'POST', path: `/vps/${SN}/stop`,   expect: 'stopped' },
        { label: 'start',  method: 'POST', path: `/vps/${SN}/start`,  expect: 'running' },
      ]
    : [
        { label: 'start',  method: 'POST', path: `/vps/${SN}/start`,  expect: 'running' },
        { label: 'reboot', method: 'POST', path: `/vps/${SN}/reboot`, expect: 'running' },
        { label: 'stop',   method: 'POST', path: `/vps/${SN}/stop`,   expect: 'stopped' },
      ]
  console.log(`Test order chosen (final state will match starting state '${before.state}'):`)
  steps.forEach((s, i) => console.log(`  [${i + 1}] ${s.label}  → expect ${s.expect}`))

  const results = {}

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    console.log(`\n[${i + 1}/5] ${s.method} ${s.path}`)
    const task = await req(s.method, s.path)
    console.log(`     task created: id=${task.id} type=${task.type}`)
    const r = await pollVpsState(SN, s.expect, task.id)
    console.log(`  ✅ ${s.label} complete in ${r.elapsedSec}s — vps.state=${r.finalState}`)
    results[s.label] = { ok: true, ...r }
  }

  // ── 4. AUTO-RENEW TOGGLE OFF (read+write proof) ──────────────────────────
  console.log('\n[4/5] PUT /vps/' + SN + '/serviceInfos  (auto-renew: ON → OFF)')
  {
    await req('PUT', `/vps/${SN}/serviceInfos`, {
      renew: { automatic: false, deleteAtExpiration: false, period: beforeRenew.period || 1, forced: false },
    })
    const after = (await req('GET', `/vps/${SN}/serviceInfos`)).renew
    console.log(`     verify: renew.automatic=${after.automatic} deleteAtExpiration=${after.deleteAtExpiration}`)
    if (after.automatic !== false) throw new Error('auto-renew did not flip to false')
    console.log(`  ✅ Auto-renew toggle OFF confirmed`)
    results.autorenew_off = { ok: true, renew: after }
  }

  // ── 5. RESTORE AUTO-RENEW ────────────────────────────────────────────────
  console.log('\n[5/5] PUT /vps/' + SN + '/serviceInfos  (restore auto-renew to original: ON)')
  {
    await req('PUT', `/vps/${SN}/serviceInfos`, {
      renew: { automatic: beforeRenew.automatic, deleteAtExpiration: beforeRenew.deleteAtExpiration || false, period: beforeRenew.period || 1, forced: beforeRenew.forced || false },
    })
    const after = (await req('GET', `/vps/${SN}/serviceInfos`)).renew
    console.log(`     verify: renew.automatic=${after.automatic}`)
    if (after.automatic !== beforeRenew.automatic) throw new Error(`auto-renew did not restore (now ${after.automatic}, expected ${beforeRenew.automatic})`)
    console.log(`  ✅ Auto-renew restored to ${after.automatic}`)
    results.autorenew_restore = { ok: true, renew: after }
  }

  // Final snapshot
  const afterAll = await req('GET', `/vps/${SN}`)
  const afterAllRenew = (await req('GET', `/vps/${SN}/serviceInfos`)).renew
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Final state:  power=${afterAll.state}  renew.automatic=${afterAllRenew.automatic}`)
  console.log('Bookended OK:', afterAll.state === before.state && afterAllRenew.automatic === beforeRenew.automatic ? 'YES ✅' : 'NO ❌')
  console.log('\nAll results:')
  console.log(JSON.stringify(results, null, 2))
  process.exit(0)
})().catch(e => {
  console.error('\n❌ FATAL', e.response?.data || e.message)
  if (e.response?.status) console.error('   HTTP', e.response.status)
  process.exit(1)
})
