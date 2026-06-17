/**
 * Compare every Contabo product currently sold via the bot against the
 * closest-matching OVH VPS plan, with the bot's actual selling price
 * (after the 50% markup that's applied to Contabo). Output a clean
 * pricing-difference table for both Linux and Windows-RDP variants.
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const axios  = require('axios')
const crypto = require('crypto')

const AK = '547807098e261b35'
const AS = 'b0a079be6b20649f1b4d3f8729f130cc'
const CK = '8ab431c4da9ab46bfb8a4bb950fcc3d9'
const BASE = 'https://ca.api.ovh.com/1.0'
const SUBSIDIARY = 'WE'
const MARKUP_PERCENT = parseFloat(process.env.VPS_MARKUP_PERCENT || '50')

async function ovh(method, path, body = null, qs = '') {
  const ts = (await axios.get(`${BASE}/auth/time`, { timeout: 10000 })).data
  const url = `${BASE}${path}${qs}`
  const bodyStr = body ? JSON.stringify(body) : ''
  const toSign = `${AS}+${CK}+${method}+${url}+${bodyStr}+${ts}`
  const sig = '$1$' + crypto.createHash('sha1').update(toSign).digest('hex')
  return axios({ method, url, headers: { 'X-Ovh-Application': AK, 'X-Ovh-Consumer': CK, 'X-Ovh-Timestamp': String(ts), 'X-Ovh-Signature': sig, 'Content-Type':'application/json' }, data: body || undefined, timeout: 20000 })
}

// Contabo wholesale catalog (mirrors /app/js/contabo-service.js)
const CONTABO = [
  { tier:1, productId:'V91',  name:'Cloud VPS 10',     cpu:4,  ramGb:8,  diskGb:75,  disk:'NVMe', basePriceUsd:4.95  },
  { tier:1, productId:'V92',  name:'Cloud VPS 10 SSD', cpu:4,  ramGb:8,  diskGb:150, disk:'SSD',  basePriceUsd:4.95  },
  { tier:2, productId:'V94',  name:'Cloud VPS 20',     cpu:6,  ramGb:12, diskGb:100, disk:'NVMe', basePriceUsd:7.95  },
  { tier:2, productId:'V95',  name:'Cloud VPS 20 SSD', cpu:6,  ramGb:12, diskGb:200, disk:'SSD',  basePriceUsd:7.95  },
  { tier:3, productId:'V97',  name:'Cloud VPS 30',     cpu:8,  ramGb:24, diskGb:200, disk:'NVMe', basePriceUsd:15.00 },
  { tier:3, productId:'V98',  name:'Cloud VPS 30 SSD', cpu:8,  ramGb:24, diskGb:400, disk:'SSD',  basePriceUsd:15.00 },
  { tier:4, productId:'V100', name:'Cloud VPS 40',     cpu:12, ramGb:48, diskGb:250, disk:'NVMe', basePriceUsd:26.00 },
  { tier:4, productId:'V101', name:'Cloud VPS 40 SSD', cpu:12, ramGb:48, diskGb:500, disk:'SSD',  basePriceUsd:26.00 },
  { tier:5, productId:'V103', name:'Cloud VPS 50',     cpu:16, ramGb:64, diskGb:300, disk:'NVMe', basePriceUsd:46.00 },
  { tier:5, productId:'V104', name:'Cloud VPS 50 SSD', cpu:16, ramGb:64, diskGb:600, disk:'SSD',  basePriceUsd:46.00 },
  { tier:6, productId:'V106', name:'Cloud VPS 60',     cpu:18, ramGb:96, diskGb:350, disk:'NVMe', basePriceUsd:59.00 },
  { tier:6, productId:'V107', name:'Cloud VPS 60 SSD', cpu:18, ramGb:96, diskGb:700, disk:'SSD',  basePriceUsd:59.00 },
]
const CONTABO_WIN_LICENSE = { 1:9.30, 2:19.10, 3:32.00, 4:32.00, 5:32.00, 6:32.00 }

const fmt = (n) => '$' + (Math.round(n * 100) / 100).toFixed(2)
const markup = (x) => Math.round(x * (1 + MARKUP_PERCENT/100) * 100) / 100
const customerPriceContaboLinux = (p) => markup(p.basePriceUsd)
const customerPriceContaboWin   = (p) => markup(p.basePriceUsd + CONTABO_WIN_LICENSE[p.tier])

;(async () => {
  // Fetch the entire OVH catalogue
  const r = await ovh('GET', '/order/catalog/public/vps', null, `?ovhSubsidiary=${SUBSIDIARY}`)
  const ovhPlans = r.data?.plans || []
  console.log(`OVH catalogue: ${ovhPlans.length} plans (incl. options)`)

  // Filter to actual VPS plans (drop options/addons) and parse spec from planCode.
  // Plan codes follow patterns like: vps-essential-2-4-40, vps-elite-8-16-160, vps-le-2-2-40, vps-comfort-4-8-80
  // The trailing three numbers are CPU-RAM(GB)-DISK(GB). The middle word is the family.
  const parsed = []
  for (const p of ovhPlans) {
    const m = (p.planCode || '').match(/^vps-(le|value|essential|comfort|elite)-(\d+)-(\d+)-(\d+)$/)
    if (!m) continue
    const family = m[1]
    const cpu  = +m[2]
    const ramGb  = +m[3]
    const diskGb = +m[4]
    const monthly = (p.pricings || []).find(x => x.mode === 'default' && x.intervalUnit === 'month')
    if (!monthly) continue
    parsed.push({ planCode: p.planCode, name: p.invoiceName, family, cpu, ramGb, diskGb, monthlyUsd: monthly.price / 100000000 })
  }

  // Windows-VPS line in OVH:
  // OVH has explicit `vps-2025-modelN` Windows-licensed plans; otherwise Windows
  // is offered as a /vps/{id}/option Microsoft license addon. The catalogue
  // exposes vps-2025-* (newer 2025 line) with bundled-Windows tier prices.
  const winPlans = ovhPlans.filter(p => /^vps-2025-/.test(p.planCode))
  const winParsed = winPlans.map(p => {
    const monthly = (p.pricings || []).find(x => x.mode === 'default' && x.intervalUnit === 'month')
    return { planCode: p.planCode, name: p.invoiceName, monthlyUsd: monthly?.price / 100000000 || 0 }
  })

  // Also probe addon products for Windows licence (per-vps monthly addon)
  let winLicenseUsd = null
  try {
    const opts = await ovh('GET', '/order/catalog/public/vps', null, `?ovhSubsidiary=${SUBSIDIARY}`)
    for (const p of (opts.data?.plans || [])) {
      if ((p.planCode || '').includes('windows-license')) {
        const m = (p.pricings || []).find(x => x.intervalUnit === 'month')
        if (m) { winLicenseUsd = m.price / 100000000; break }
      }
    }
  } catch (_) { /* noop */ }

  // ── Find closest OVH match for each Contabo plan ─────────────────────
  // Match strategy:
  //   1) RAM tier first (most user-visible spec)
  //   2) CPU as a secondary score
  //   3) Disk as a tertiary score
  function bestMatch(target) {
    let best = null, bestScore = Infinity
    for (const o of parsed) {
      const ramDiff  = Math.abs(o.ramGb  - target.ramGb)  * 10
      const cpuDiff  = Math.abs(o.cpu    - target.cpu)    * 5
      const diskDiff = Math.abs(o.diskGb - target.diskGb) * 0.1
      const score = ramDiff + cpuDiff + diskDiff
      if (score < bestScore) { bestScore = score; best = o }
    }
    return best
  }

  const wpct = 18                // column widths for printf-ish alignment
  const pad = (s, n) => String(s).padEnd(n)
  const padL = (s, n) => String(s).padStart(n)

  console.log('\n══════════════ LINUX VPS — Contabo (current) vs OVH (proposed) ══════════════\n')
  console.log(pad('Contabo Plan', 24) + pad('CPU/RAM/Disk', 22) + padL('Customer ($)', 14) + '  →  ' + pad('OVH Plan', 28) + pad('CPU/RAM/Disk', 22) + padL('Customer ($)', 14) + padL('Δ (OVH-Contabo)', 16))
  console.log('-'.repeat(140))
  let totalDelta = 0
  for (const c of CONTABO) {
    const ovhMatch = bestMatch(c)
    if (!ovhMatch) continue
    const cust  = customerPriceContaboLinux(c)
    const ovhCust = markup(ovhMatch.monthlyUsd)
    const delta = ovhCust - cust
    totalDelta += delta
    const arrow = delta > 0.5 ? '▲' : delta < -0.5 ? '▼' : '≈'
    console.log(
      pad(c.name, 24) + pad(`${c.cpu}c/${c.ramGb}G/${c.diskGb}G ${c.disk}`, 22) + padL(fmt(cust), 14) +
      '  →  ' +
      pad(ovhMatch.planCode, 28) + pad(`${ovhMatch.cpu}c/${ovhMatch.ramGb}G/${ovhMatch.diskGb}G`, 22) + padL(fmt(ovhCust), 14) +
      padL((delta>=0?'+':'')+fmt(delta)+' '+arrow, 16)
    )
  }
  console.log('-'.repeat(140))
  console.log(`Average Δ across all ${CONTABO.length} Linux SKUs: ${fmt(totalDelta / CONTABO.length)} per VPS/mo (OVH is ${totalDelta>=0?'more':'less'} expensive)`)

  console.log('\n══════════════ WINDOWS RDP — Contabo (current) vs OVH (proposed) ══════════════\n')
  console.log('Contabo: base VPS + Windows-Server-2025 Datacenter license addon (per tier).')
  if (winLicenseUsd) {
    console.log(`OVH:     base VPS + Windows-License addon @ ${fmt(winLicenseUsd)} /mo (flat, all sizes).`)
  } else {
    console.log('OVH:     Windows licence price not exposed via /order/catalog/public/vps response. The newer vps-2025-* line bundles Windows in some cases:')
    for (const w of winParsed) console.log(`         ${w.planCode.padEnd(26)} ${w.name.padEnd(30)} ${fmt(w.monthlyUsd)} /mo`)
  }
  console.log()
  console.log(pad('Contabo RDP Plan', 24) + pad('Tier', 6) + padL('Customer ($)', 14) + '  →  ' + pad('OVH equivalent', 28) + padL('Customer ($)', 14) + padL('Δ', 14))
  console.log('-'.repeat(110))
  let winDelta = 0, winN = 0
  for (const c of CONTABO) {
    const ovhMatch = bestMatch(c)
    if (!ovhMatch) continue
    const cust = customerPriceContaboWin(c)
    // Windows on OVH = base + flat license (if exposed) else use the bundled vps-2025 nearest match
    let ovhCustWin = null, ovhLabel = ''
    if (winLicenseUsd != null) {
      ovhCustWin = markup(ovhMatch.monthlyUsd + winLicenseUsd)
      ovhLabel   = ovhMatch.planCode + ' + Windows'
    } else {
      ovhLabel = '(Windows addon price not auto-discoverable)'
      ovhCustWin = NaN
    }
    const delta = !isNaN(ovhCustWin) ? ovhCustWin - cust : 0
    if (!isNaN(ovhCustWin)) { winDelta += delta; winN++ }
    const arrow = !isNaN(ovhCustWin) ? (delta > 0.5 ? '▲' : delta < -0.5 ? '▼' : '≈') : '?'
    console.log(
      pad(c.name.replace(' SSD','')+' RDP', 24) + pad(c.tier, 6) + padL(fmt(cust), 14) +
      '  →  ' +
      pad(ovhLabel, 28) + padL(isNaN(ovhCustWin) ? '–' : fmt(ovhCustWin), 14) +
      padL(isNaN(ovhCustWin) ? '–' : ((delta>=0?'+':'')+fmt(delta)+' '+arrow), 14)
    )
  }
  console.log('-'.repeat(110))
  if (winN) console.log(`Average Δ across Windows SKUs: ${fmt(winDelta/winN)}`)

  // ── Coverage gap analysis ────────────────────────────────────────────
  console.log('\n══════════════ COVERAGE GAPS (where OVH can\'t match Contabo specs at all) ══════════════\n')
  for (const c of CONTABO) {
    const ovhMatch = bestMatch(c)
    if (!ovhMatch) continue
    const cpuDiff   = ovhMatch.cpu    - c.cpu
    const ramDiff   = ovhMatch.ramGb  - c.ramGb
    const diskDiff  = ovhMatch.diskGb - c.diskGb
    const notes = []
    if (cpuDiff < -1)  notes.push(`OVH has ${Math.abs(cpuDiff)} fewer vCPU`)
    if (ramDiff < -1)  notes.push(`OVH has ${Math.abs(ramDiff)} GB less RAM`)
    if (diskDiff < -10) notes.push(`OVH has ${Math.abs(diskDiff)} GB less disk`)
    if (notes.length) console.log(`  ${c.name.padEnd(22)} (${c.cpu}c/${c.ramGb}G/${c.diskGb}G) — OVH offers ${ovhMatch.planCode} (${ovhMatch.cpu}c/${ovhMatch.ramGb}G/${ovhMatch.diskGb}G): ${notes.join('; ')}`)
  }
})().catch(e => { console.error('FATAL:', e.response?.data || e.message); process.exit(1) })
