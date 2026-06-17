/**
 * Verify pricing for the 6 OVH plans we plan to resell.
 * For each plan, print ALL pricing entries (default vs promo, monthly vs annual,
 * setup fees, etc.) so we can confirm what the bot will actually pay.
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const axios  = require('axios')
const crypto = require('crypto')

const AK = '547807098e261b35'
const AS = 'b0a079be6b20649f1b4d3f8729f130cc'
const CK = '8ab431c4da9ab46bfb8a4bb950fcc3d9'
const BASE = 'https://ca.api.ovh.com/1.0'

async function ovh(method, path, qs='') {
  const ts = (await axios.get(`${BASE}/auth/time`, {timeout:10000})).data
  const url = `${BASE}${path}${qs}`
  const sig = '$1$' + crypto.createHash('sha1').update(`${AS}+${CK}+${method}+${url}++${ts}`).digest('hex')
  return axios({method,url,headers:{'X-Ovh-Application':AK,'X-Ovh-Consumer':CK,'X-Ovh-Timestamp':String(ts),'X-Ovh-Signature':sig}})
}

;(async () => {
  const r = await ovh('GET', '/order/catalog/public/vps', '?ovhSubsidiary=WE')
  const plans = r.data?.plans || []
  const addons = r.data?.addons || []

  const wanted = [
    'vps-le-2-2-40',
    'vps-value-1-2-80',
    'vps-le-4-4-80',
    'vps-comfort-4-8-80',
    'vps-essential-2-8-160',
    'vps-le-16-16-160',
  ]
  const winAddons = [
    'option-windows-le-2-2-40',
    'option-windows-value-1-2-80',
    'option-windows-le-4-4-80',
    'option-windows-comfort-4-8-80',
    'option-windows-essential-2-8-160',
    'option-windows-le-16-16-160',
  ]

  console.log('════════════ Full pricing for the 6 proposed Linux plans ════════════\n')
  for (const code of wanted) {
    const p = plans.find(x => x.planCode === code)
    if (!p) { console.log(`MISSING: ${code}`); continue }
    console.log(`━━━ ${p.planCode} — ${p.invoiceName}`)
    for (const pr of (p.pricings || [])) {
      const valueUsd = (pr.price / 100000000).toFixed(2)
      console.log(`  mode=${(pr.mode||'').padEnd(18)} interval=${(pr.intervalUnit||'').padEnd(8)} duration=${(pr.duration||'').padEnd(6)} qty=${pr.minimumQuantity}-${pr.maximumQuantity}  price=$${valueUsd}  description="${pr.description||''}"`)
    }
    console.log()
  }

  console.log('\n════════════ Windows-option addons for those 6 plans ════════════\n')
  for (const code of winAddons) {
    const a = addons.find(x => x.planCode === code)
    if (!a) { console.log(`MISSING: ${code}`); continue }
    console.log(`━━━ ${a.planCode} — ${a.invoiceName}`)
    for (const pr of (a.pricings || [])) {
      const valueUsd = (pr.price / 100000000).toFixed(2)
      console.log(`  mode=${(pr.mode||'').padEnd(18)} interval=${(pr.intervalUnit||'').padEnd(8)} duration=${(pr.duration||'').padEnd(6)}  price=$${valueUsd}  description="${pr.description||''}"`)
    }
    console.log()
  }
})().catch(e => { console.error('FATAL:', e.response?.data || e.message); process.exit(1) })
