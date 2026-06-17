/**
 * Probe ALL VPS plans (every prefix family) from the OVH catalog so we can
 * see the cheapest line, the Windows-bundled lines, and decide on a pricing
 * strategy before migrating. Also dumps the listed currency from /me.
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const crypto = require('crypto')

const AK = '547807098e261b35'
const AS = 'b0a079be6b20649f1b4d3f8729f130cc'
const CK = '8ab431c4da9ab46bfb8a4bb950fcc3d9'
const BASE = 'https://ca.api.ovh.com/1.0'
const SUBS = process.argv[2] || 'WE'

async function ovh(method, path, body=null, qs='') {
  const ts = (await axios.get(`${BASE}/auth/time`, {timeout:10000})).data
  const url = `${BASE}${path}${qs}`
  const bodyStr = body ? JSON.stringify(body) : ''
  const sig = '$1$' + crypto.createHash('sha1').update(`${AS}+${CK}+${method}+${url}+${bodyStr}+${ts}`).digest('hex')
  return axios({method,url,headers:{'X-Ovh-Application':AK,'X-Ovh-Consumer':CK,'X-Ovh-Timestamp':String(ts),'X-Ovh-Signature':sig,'Content-Type':'application/json'},data:body||undefined,timeout:20000})
}

;(async () => {
  const me = (await ovh('GET','/me')).data
  console.log(`Account: ${me.nichandle}  Subsidiary: ${me.ovhSubsidiary}  Currency: ${me.currency?.code}`)
  console.log(`Querying catalog for ovhSubsidiary=${SUBS}\n`)

  const r = await ovh('GET','/order/catalog/public/vps', null, `?ovhSubsidiary=${SUBS}`)
  const plans = r.data?.plans || []
  console.log(`Total plans returned: ${plans.length}\n`)

  // Group by family (first 2-3 segments of planCode)
  const byFamily = {}
  for (const p of plans) {
    const fam = (p.planCode || '').split('-').slice(0,2).join('-')
    if (!byFamily[fam]) byFamily[fam] = []
    byFamily[fam].push(p)
  }

  for (const fam of Object.keys(byFamily).sort()) {
    const list = byFamily[fam]
    console.log(`━━━ Family: ${fam}  (${list.length} plans)`)
    for (const p of list) {
      const monthly = (p.pricings || []).find(x => x.mode === 'default' && x.intervalUnit === 'month')
      const m = monthly ? `${(monthly.price/100000000).toFixed(2)} ${me.currency?.code}/mo` : 'no monthly'
      console.log(`  ${p.planCode.padEnd(30)} ${String(p.invoiceName||'').padEnd(38)} ${m}`)
    }
    console.log()
  }
})().catch(e => { console.error('FATAL:', e.response?.data || e.message); process.exit(1) })
