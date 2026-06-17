/**
 * Find the cheapest tier-ladder for OVH VPS. We:
 *   1. Filter to non-degressivity / non-upfront plans (default monthly only).
 *   2. Sort by price ascending.
 *   3. For each candidate, find the matching Windows-option addon price.
 *   4. Output a ladder of 6 progressively more powerful tiers.
 *
 * Also probes the vps-2025 and vps-2027 lines (next-gen hardware) which
 * may be cheaper for similar specs.
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const axios  = require('axios')
const crypto = require('crypto')

const AK = process.env.OVH_APP_KEY
const AS = process.env.OVH_APP_SECRET
const CK = process.env.OVH_CONSUMER_KEY
const BASE = process.env.OVH_ENDPOINT || 'https://ca.api.ovh.com/1.0'

async function ovh(method, path, qs = '') {
  const ts = (await axios.get(`${BASE}/auth/time`, { timeout: 10000 })).data
  const url = `${BASE}${path}${qs}`
  const sig = '$1$' + crypto.createHash('sha1').update(`${AS}+${CK}+${method}+${url}++${ts}`).digest('hex')
  return axios({ method, url, headers: { 'X-Ovh-Application': AK, 'X-Ovh-Consumer': CK, 'X-Ovh-Timestamp': String(ts), 'X-Ovh-Signature': sig } })
}

;(async () => {
  const r = await ovh('GET', '/order/catalog/public/vps', '?ovhSubsidiary=WE')
  const plans  = r.data?.plans || []
  const addons = r.data?.addons || []

  // 1. Filter "base" VPS plans (not upgrade-SKUs / not degressivity-priced)
  const base = []
  for (const p of plans) {
    // Skip any plan with -10percent / -degressivityXX / vps-XXXX-modelN suffix in middle (upgrade SKU)
    if (/-(degressivity\d+|10percent)/.test(p.planCode)) continue
    // Drop "linked-upgrade" SKUs like vps-le-4-4-80-vps-2025-model2 (these are upgrades to existing services)
    if (/^vps-[a-z]+-\d+-\d+-\d+-vps-/.test(p.planCode)) continue
    // Drop "additional disk" options
    if (/^option-/.test(p.planCode)) continue
    // Drop the old s1-2 legacy and starter-style with no Windows  (keep starter, mark separately)
    const monthly = (p.pricings || []).find(x => x.mode === 'default' && x.intervalUnit === 'month')
    if (!monthly) continue
    // Match planCode for spec hint
    const m = p.planCode.match(/^vps-[a-z]+-(\d+)-(\d+)-(\d+)$/) ||
              p.planCode.match(/^vps-(\d+)-model(\d+)(?:\.LZ)?$/)
    let cpu = null, ramGb = null, diskGb = null
    if (m && m[3]) { cpu = +m[1]; ramGb = +m[2]; diskGb = +m[3] }
    base.push({
      planCode: p.planCode,
      name: p.invoiceName,
      family: p.planCode.split('-').slice(0, 2).join('-'),
      monthlyUsd: monthly.price / 100000000,
      cpu, ramGb, diskGb,
    })
  }

  // 2. For each base, find matching Windows option price
  for (const b of base) {
    const code = b.planCode
    const winCodes = [
      `option-windows-${code.replace(/^vps-/, '')}`,         // e.g. option-windows-le-2-2-40
      `option-windows-${code.replace(/^vps-(\d+)-/, '$1-')}`, // e.g. option-windows-2025-model1
    ]
    let win = null
    for (const wc of winCodes) {
      const a = addons.find(x => x.planCode === wc)
      if (a) {
        const m = (a.pricings || []).find(x => x.intervalUnit === 'month' && x.mode === 'default')
        if (m) { win = m.price / 100000000; break }
      }
    }
    b.windowsUsd = win
  }

  // 3. Sort by monthly price ascending
  base.sort((a, b) => a.monthlyUsd - b.monthlyUsd)

  console.log('\n══════════ ALL OVH VPS plans sorted by price (default monthly) ══════════')
  console.log('Plan-code'.padEnd(28) + 'Family'.padEnd(15) + 'Specs (c/G/GB)'.padEnd(18) + 'Linux $'.padEnd(10) + 'Win opt $'.padEnd(11) + 'RDP $')
  console.log('-'.repeat(95))
  for (const b of base) {
    const specs = (b.cpu != null) ? `${b.cpu}c/${b.ramGb}G/${b.diskGb}G` : '(unknown)'
    const linux = `$${b.monthlyUsd.toFixed(2)}`
    const winOpt = b.windowsUsd != null ? `$${b.windowsUsd.toFixed(2)}` : '—'
    const rdp = b.windowsUsd != null ? `$${(b.monthlyUsd + b.windowsUsd).toFixed(2)}` : '(no win)'
    console.log(b.planCode.padEnd(28) + b.family.padEnd(15) + specs.padEnd(18) + linux.padEnd(10) + winOpt.padEnd(11) + rdp)
  }

  // 4. Recommended cheap ladder (6 tiers, progressively better, all support Windows)
  console.log('\n══════════ RECOMMENDED CHEAPEST 6-TIER LADDER (Linux + RDP) ══════════')
  // Filter to plans WITH Windows support
  const withWin = base.filter(b => b.windowsUsd != null && b.cpu != null)
  // Sort by RAM, then CPU, then price
  withWin.sort((a, b) => a.ramGb - b.ramGb || a.cpu - b.cpu || a.monthlyUsd - b.monthlyUsd)

  // Pick the cheapest plan for each RAM bracket
  const ramBuckets = [2, 4, 8, 16]
  const ladder = []
  for (const r of ramBuckets) {
    const candidates = withWin.filter(b => b.ramGb === r).sort((a, b) => a.monthlyUsd - b.monthlyUsd)
    for (const c of candidates.slice(0, 2)) ladder.push(c)
  }
  // Print ladder with markup at 200% (production)
  const MARKUP = 3
  console.log('Tier'.padEnd(6) + 'Plan'.padEnd(28) + 'Specs'.padEnd(20) + 'Linux raw'.padEnd(12) + 'Linux ×3'.padEnd(11) + 'Win raw'.padEnd(10) + 'RDP ×3')
  console.log('-'.repeat(95))
  for (let i = 0; i < Math.min(ladder.length, 8); i++) {
    const b = ladder[i]
    const specs = `${b.cpu}c/${b.ramGb}G/${b.diskGb}G`
    console.log(
      String(i + 1).padEnd(6) +
      b.planCode.padEnd(28) +
      specs.padEnd(20) +
      `$${b.monthlyUsd.toFixed(2)}`.padEnd(12) +
      `$${(b.monthlyUsd * MARKUP).toFixed(2)}`.padEnd(11) +
      `$${b.windowsUsd.toFixed(2)}`.padEnd(10) +
      `$${((b.monthlyUsd + b.windowsUsd) * MARKUP).toFixed(2)}`
    )
  }
})().catch(e => { console.error('FATAL:', e.response?.data || e.message); process.exit(1) })
