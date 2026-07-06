/**
 * Probe OVH's dedicated server catalog (Eco/Rise/Advance) for the cheapest
 * machines with >= 32 GB RAM. These would back a hypothetical "Tier 7+"
 * offering for users who need more than OVH VPS Tier 6 (16 GB RAM).
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const crypto = require('crypto')

const AK = process.env.OVH_APP_KEY
const AS = process.env.OVH_APP_SECRET
const CK = process.env.OVH_CONSUMER_KEY
const BASE = process.env.OVH_ENDPOINT
const SUBS = process.env.OVH_SUBSIDIARY || 'WE'

async function ovh(method, path, qs = '') {
  const ts = (await axios.get(`${BASE}/auth/time`, {timeout:10000})).data
  const url = `${BASE}${path}${qs}`
  const sig = '$1$' + crypto.createHash('sha1').update(`${AS}+${CK}+${method}+${url}++${ts}`).digest('hex')
  return axios({method,url,headers:{'X-Ovh-Application':AK,'X-Ovh-Consumer':CK,'X-Ovh-Timestamp':String(ts),'X-Ovh-Signature':sig}})
}

;(async () => {
  console.log(`━━━ Probing dedicated catalogs for subsidiary=${SUBS}`)
  // OVH has 4 dedicated lines:
  //   1) /order/catalog/public/eco        — Eco (cheapest, single CPU)
  //   2) /order/catalog/public/dedicated  — Advance (mid-range)
  //   3) /order/catalog/public/scale       — Scale (top of line)
  //   4) /order/catalog/public/baremetalPod — Bare-metal pods
  const catalogs = ['eco', 'dedicated', 'scale']
  const found = []
  for (const cat of catalogs) {
    try {
      const r = await ovh('GET', `/order/catalog/public/${cat}`, `?ovhSubsidiary=${SUBS}`)
      const plans = r.data?.plans || []
      console.log(`\n━━━ ${cat}: ${plans.length} plans`)
      for (const p of plans.slice(0, 60)) {
        // Look at memory addon family for the default RAM size
        const memFam = (p.addonFamilies || []).find(f => f.name === 'memory')
        const memDefault = memFam?.default || null
        const monthly = (p.pricings || []).find(x => x.mode === 'default' && x.intervalUnit === 'month')
        if (!monthly) continue
        const priceUsd = monthly.price / 100000000
        // Try to extract RAM size from the default memory plan code (e.g. ram-32g-noecc-2933)
        const ramMatch = memDefault?.match(/ram-(\d+)g/i)
        const ramGb = ramMatch ? +ramMatch[1] : null
        if (ramGb != null && ramGb < 32) continue  // Skip <32GB machines
        const name = (p.invoiceName || '').substring(0, 50)
        found.push({ catalog: cat, planCode: p.planCode, name, ramGb, monthlyUsd: priceUsd, memDefault })
      }
    } catch (e) {
      console.log(`  ${cat}: HTTP ${e.response?.status} ${e.response?.data?.message || e.message}`)
    }
  }
  found.sort((a, b) => a.monthlyUsd - b.monthlyUsd)
  console.log('\n══════════ Cheapest dedicated machines >= 32 GB RAM ══════════')
  console.log('catalog'.padEnd(12) + 'planCode'.padEnd(40) + 'RAM'.padEnd(8) + 'monthly $'.padEnd(11) + 'name')
  console.log('-'.repeat(110))
  for (const m of found.slice(0, 15)) {
    console.log(
      m.catalog.padEnd(12) +
      String(m.planCode).padEnd(40) +
      (m.ramGb ? m.ramGb + 'G' : '?').padEnd(8) +
      `$${m.monthlyUsd.toFixed(2)}`.padEnd(11) +
      m.name
    )
  }
})().catch(e => { console.error('FATAL:', e.response?.data || e.message); process.exit(1) })
