/**
 * Probe vps-2025-model* plans to get real specs (cpu/ram/disk).
 * The plan name doesn't reveal specs — we need to look at addonFamilies / configurations.
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
  const bodyStr = body ? JSON.stringify(body) : ''
  const sig = '$1$' + crypto.createHash('sha1').update(`${AS}+${CK}+${method}+${url}+${bodyStr}+${ts}`).digest('hex')
  return axios({method,url,headers:{'X-Ovh-Application':AK,'X-Ovh-Consumer':CK,'X-Ovh-Timestamp':String(ts),'X-Ovh-Signature':sig,'Content-Type':'application/json'},data:body||undefined,timeout:20000})
}

;(async () => {
  const r = await ovh('GET','/order/catalog/public/vps', null, '?ovhSubsidiary=WE')
  const plans = r.data?.plans || []
  // Inspect vps-2025-model* and vps-le-* and vps-value-* — the 3 families we care about
  for (const p of plans) {
    if (/^(vps-2025-model[1-6](\.LZ)?|vps-le-(2-2-40|4-4-80|16-16-160)|vps-value-1-(2|4)-(40|80|20)|vps-comfort-4-8-80|vps-comfort-4-8-160|vps-essential-2-8-160|vps-starter-1-2-20|vps-2027-model[1-4](\.LZ)?)$/.test(p.planCode)) {
      const monthly = (p.pricings || []).find(x => x.mode === 'default' && x.intervalUnit === 'month')
      console.log(`━━━ ${p.planCode} — ${p.invoiceName} — $${(monthly?.price/100000000).toFixed(2)}/mo`)
      // Show configurations & products (addonFamilies might reveal OS/CPU details)
      if (p.configurations?.length) {
        console.log('  configurations:')
        for (const c of p.configurations) {
          console.log(`    ${c.name}: ${(c.values||[]).slice(0,8).join(', ')}${c.values?.length>8?'…':''}`)
        }
      }
      if (p.addonFamilies?.length) {
        console.log('  addonFamilies:')
        for (const af of p.addonFamilies.slice(0,6)) {
          console.log(`    ${af.name}: addons=${(af.addons||[]).length}, mandatory=${af.mandatory||false}`)
        }
      }
      console.log()
    }
  }
  // Also dump the catalog's `addons` array (which holds reference products)
  const addons = r.data?.addons || []
  console.log(`\n━━━ Catalog has ${addons.length} addon products. Sample (with specs):`)
  let count = 0
  for (const a of addons) {
    if (/^(vps-2025-model[1-6](\.LZ)?|vps-le-(2-2-40|4-4-80|16-16-160))/.test(a.planCode)) {
      console.log(`  ${a.planCode.padEnd(28)} ${a.invoiceName.padEnd(30)} family=${a.family||'-'}`)
      if (a.product?.configurations) {
        for (const c of a.product.configurations) {
          console.log(`    spec ${c.name}: ${c.value}`)
        }
      }
      if (++count > 20) break
    }
  }
  // And: product definitions live in r.data.products. Look there for spec
  const products = r.data?.products || []
  console.log(`\n━━━ Catalog has ${products.length} product definitions. vps-2025 / vps-le / vps-value specs:`)
  for (const pr of products) {
    if (/^(vps-2025-model[1-6](\.LZ)?|vps-le-(2-2-40|4-4-80|16-16-160)|vps-value-|vps-essential-|vps-comfort-4-8-)/.test(pr.name)) {
      const blobs = (pr.blobs || {})
      const tech  = blobs.technical || {}
      const cpu   = tech.cpu?.cores || tech.cpu?.number || '?'
      const ram   = tech.memory?.size || tech.ram?.size || '?'
      const disk  = tech.storage?.disks?.[0]?.capacity || tech.disk?.capacity || '?'
      const dtype = tech.storage?.disks?.[0]?.type || tech.disk?.type || '?'
      console.log(`  ${pr.name.padEnd(28)} cpu=${cpu}c  ram=${ram}  disk=${disk} ${dtype}  ${pr.description||''}`.slice(0,140))
    }
  }
})().catch(e => { console.error('FATAL:', e.response?.data || e.message); process.exit(1) })
