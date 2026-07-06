/**
 * OVH VPS management API probe — READ-ONLY by default.
 *
 * Lists every VPS on the account and shows live state + IP + region.
 *
 * Usage:
 *   node test_ovh_manage_existing_vps.js                     # list only (safe)
 *   node test_ovh_manage_existing_vps.js --detail=<serviceName>   # full GET /vps/{sn}
 *   node test_ovh_manage_existing_vps.js --reboot=<serviceName>   # POST /vps/{sn}/reboot (real reboot, ~30s downtime)
 *   node test_ovh_manage_existing_vps.js --tasks=<serviceName>    # list recent tasks (audit trail)
 */
require('dotenv').config({ path: '/app/.env' })
const ovh = require('/app/js/ovh-service.js')
const axios = require('axios')
const crypto = require('crypto')

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.startsWith('--') ? a.replace(/^--/, '').split('=') : [a, true]),
)

// Direct ovhRequest helper (need it for tasks endpoint not exposed in module)
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
async function req(method, path) {
  const delta = await timeOffset()
  const ts = Math.round(Date.now() / 1000) + delta
  const url = BASE + path
  const sigParts = [AS, CK, method, url, '', ts].join('+')
  const sig = '$1$' + crypto.createHash('sha1').update(sigParts).digest('hex')
  const r = await axios({ method, url, headers: {
    'X-Ovh-Application': AK,
    'X-Ovh-Consumer': CK,
    'X-Ovh-Timestamp': String(ts),
    'X-Ovh-Signature': sig,
    'Content-Type': 'application/json',
  } })
  return r.data
}

;(async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  OVH /vps/* management probe — ${BASE}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 1. list ─────────────────────────────────────────────────────────────────
  console.log('\n[1] GET /vps → list all VPS service names on the account…')
  const names = await req('GET', '/vps')
  console.log(`    Found ${names.length} VPS${names.length === 1 ? '' : 's'}: ${JSON.stringify(names)}`)

  if (names.length === 0) {
    console.log('\nNo VPSs on this OVH account. Nothing to manage. Exiting.')
    return
  }

  // 2. details for each ──────────────────────────────────────────────────────
  console.log('\n[2] GET /vps/{sn} for each → live state + region + IP…')
  const rows = []
  for (const sn of names) {
    try {
      const d = await req('GET', `/vps/${sn}`)
      let ip = d.mainIpAddress
      if (!ip) {
        const ips = await req('GET', `/vps/${sn}/ips`).catch(() => [])
        ip = ips?.[0] || '-'
      }
      const info = await req('GET', `/vps/${sn}/serviceInfos`).catch(() => ({}))
      rows.push({
        serviceName: sn,
        displayName: d.displayName || sn,
        state:       d.state,
        cluster:     d.cluster,
        offer:       d.offerType || d.model?.name || '-',
        cores:       d.model?.maximumAdditionnalIp != null ? `${d.vcore ?? '-'}c` : '-',
        memoryGb:    d.memoryLimit ? (d.memoryLimit / 1024).toFixed(0) : '-',
        diskGb:      d.diskGroups?.[0]?.diskSize ?? '-',
        ip,
        nextBilling: info.expiration || '-',
        renewMode:   info.renew?.automatic ? 'auto' : (info.renew?.deleteAtExpiration ? 'cancel-at-expiry' : 'manual'),
      })
    } catch (e) {
      rows.push({ serviceName: sn, error: e.message })
    }
  }
  console.table(rows)

  // 3. if --detail or --tasks or --reboot, drill down ───────────────────────
  if (args.detail) {
    console.log(`\n[3] Full GET /vps/${args.detail} →`)
    const full = await req('GET', `/vps/${args.detail}`)
    console.log(JSON.stringify(full, null, 2))
  }

  if (args.tasks) {
    console.log(`\n[3] GET /vps/${args.tasks}/tasks → recent management tasks…`)
    const ids = await req('GET', `/vps/${args.tasks}/tasks`)
    console.log(`    ${ids.length} task IDs (showing last 5 with details):`)
    const latest = (ids || []).slice(-5)
    for (const tid of latest) {
      try {
        const t = await req('GET', `/vps/${args.tasks}/tasks/${tid}`)
        console.log(`    #${tid}: type=${t.type}  state=${t.state}  date=${t.date}  progress=${t.progress}%`)
      } catch (e) {
        console.log(`    #${tid}: (error ${e.message})`)
      }
    }
  }

  if (args.reboot) {
    console.log(`\n[3] POST /vps/${args.reboot}/reboot → real reboot (~30s downtime)…`)
    const before = await req('GET', `/vps/${args.reboot}`)
    console.log(`    State before:  ${before.state}`)
    const t0 = Date.now()
    const task = await req('POST', `/vps/${args.reboot}/reboot`)
    console.log(`    Task created:  id=${task.id}  type=${task.type}  state=${task.state}  date=${task.date}`)
    console.log(`    Polling state every 5 s until 'running' returns (up to 2 min)…`)
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 5000))
      const t = await req('GET', `/vps/${args.reboot}/tasks/${task.id}`).catch(() => null)
      const s = await req('GET', `/vps/${args.reboot}`).catch(() => null)
      console.log(`    +${((Date.now()-t0)/1000).toFixed(0)}s  task.state=${t?.state || '?'}  task.progress=${t?.progress ?? '?'}%  vps.state=${s?.state || '?'}`)
      if (t?.state === 'done' && s?.state === 'running') {
        console.log(`✅ Reboot completed in ${((Date.now() - t0) / 1000).toFixed(0)}s — VPS back online.`)
        break
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Done.')
})().catch(e => { console.error('FATAL', e?.response?.data || e.message); process.exit(1) })
