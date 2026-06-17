/**
 * Probe the OS addon family on representative VPS plans to find the
 * Windows license addon price. Walk r.data.addons for any planCode that
 * contains "windows" or "win-".
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const crypto = require('crypto')

const AK = '547807098e261b35'
const AS = 'b0a079be6b20649f1b4d3f8729f130cc'
const CK = '8ab431c4da9ab46bfb8a4bb950fcc3d9'
const BASE = 'https://ca.api.ovh.com/1.0'

async function ovh(method, path, body=null, qs='') {
  const ts = (await axios.get(`${BASE}/auth/time`, {timeout:10000})).data
  const url = `${BASE}${path}${qs}`
  const sig = '$1$' + crypto.createHash('sha1').update(`${AS}+${CK}+${method}+${url}+${body?JSON.stringify(body):''}+${ts}`).digest('hex')
  return axios({method,url,headers:{'X-Ovh-Application':AK,'X-Ovh-Consumer':CK,'X-Ovh-Timestamp':String(ts),'X-Ovh-Signature':sig,'Content-Type':'application/json'},data:body||undefined,timeout:20000})
}

;(async () => {
  const r = await ovh('GET','/order/catalog/public/vps', null, '?ovhSubsidiary=WE')
  const plans  = r.data?.plans  || []
  const addons = r.data?.addons || []
  const products = r.data?.products || []

  console.log(`Catalog: ${plans.length} plans, ${addons.length} addons, ${products.length} products`)

  // 1. Find all addon families on a sample plan
  const samplePlan = plans.find(p => p.planCode === 'vps-le-4-4-80')
  if (samplePlan) {
    console.log(`\n━━━ Addon families on ${samplePlan.planCode}:`)
    for (const af of (samplePlan.addonFamilies||[])) {
      console.log(`  ${af.name}: addons=${(af.addons||[]).length}, mandatory=${af.mandatory||false}`)
      for (const addonCode of (af.addons||[]).slice(0,5)) {
        const addon = addons.find(a => a.planCode === addonCode)
        if (addon) {
          const monthly = (addon.pricings || []).find(x => x.intervalUnit === 'month')
          const oneTime = (addon.pricings || []).find(x => x.intervalUnit === 'none' || x.intervalUnit === 'day')
          const price = monthly ? `${(monthly.price/100000000).toFixed(2)} USD/mo` :
                        oneTime ? `${(oneTime.price/100000000).toFixed(2)} USD one-time` : 'no monthly price'
          console.log(`    - ${addon.planCode.padEnd(40)} ${addon.invoiceName?.padEnd(28) || ''} ${price}`)
        } else {
          console.log(`    - ${addonCode} (not found in addons[])`)
        }
      }
      if ((af.addons||[]).length > 5) console.log(`    … and ${af.addons.length - 5} more`)
    }
  }

  // 2. Hunt for ALL Windows-related addons in the catalog
  console.log(`\n━━━ All Windows-related addons in catalog:`)
  for (const a of addons) {
    if (/win|microsoft|windows/i.test(a.planCode) || /win|microsoft|windows/i.test(a.invoiceName||'')) {
      const monthly = (a.pricings || []).find(x => x.intervalUnit === 'month')
      const price = monthly ? `${(monthly.price/100000000).toFixed(2)} USD/mo` : '(no monthly pricing)'
      console.log(`  ${a.planCode.padEnd(50)} ${(a.invoiceName||'').padEnd(45)} ${price}`)
    }
  }

  // 3. For sample plans (vps-le-4-4-80, vps-essential-2-8-160), enumerate OS addons explicitly
  for (const plancode of ['vps-le-4-4-80', 'vps-essential-2-8-160', 'vps-comfort-4-8-80', 'vps-le-16-16-160', 'vps-starter-1-2-20', 'vps-2025-model3']) {
    const plan = plans.find(p => p.planCode === plancode)
    if (!plan) { console.log(`\n${plancode} not found`); continue }
    console.log(`\n━━━ OS-family addons for ${plancode}:`)
    const osFam = plan.addonFamilies?.find(af => af.name === 'os')
    if (!osFam) { console.log('  (no OS addon family)'); continue }
    for (const addonCode of (osFam.addons||[])) {
      const a = addons.find(x => x.planCode === addonCode)
      if (a) {
        const monthly = (a.pricings || []).find(x => x.intervalUnit === 'month')
        const price = monthly ? `${(monthly.price/100000000).toFixed(2)} USD/mo` : 'free / no-monthly'
        console.log(`  ${a.planCode.padEnd(40)} ${(a.invoiceName||'').padEnd(40)} ${price}`)
      } else {
        console.log(`  ${addonCode} (addon not found)`)
      }
    }
  }
})().catch(e => { console.error('FATAL:', e.response?.data || e.message); process.exit(1) })
