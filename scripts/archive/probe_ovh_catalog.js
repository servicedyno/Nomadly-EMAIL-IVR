/**
 * Discover what the OVH-CA account can order:
 *   - /me                 → identity, subsidiary (US/CA/etc.)
 *   - /order/catalog/public/vps with the right ovhSubsidiary
 *   - /order/catalog/public/cloud (public-cloud instance catalogue)
 *   - /dedicated/server/datacenter — datacentre list
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const crypto = require('crypto')

const AK = '547807098e261b35'
const AS = 'b0a079be6b20649f1b4d3f8729f130cc'
const CK = '8ab431c4da9ab46bfb8a4bb950fcc3d9'
const BASE = 'https://ca.api.ovh.com/1.0'

async function ovh(method, path, body = null, qs = '') {
  const ts = (await axios.get(`${BASE}/auth/time`, { timeout: 10000 })).data
  const url = `${BASE}${path}${qs}`
  const bodyStr = body ? JSON.stringify(body) : ''
  const toSign = `${AS}+${CK}+${method}+${url}+${bodyStr}+${ts}`
  const sig = '$1$' + crypto.createHash('sha1').update(toSign).digest('hex')
  return axios({
    method, url,
    headers: { 'X-Ovh-Application': AK, 'X-Ovh-Consumer': CK, 'X-Ovh-Timestamp': String(ts), 'X-Ovh-Signature': sig, 'Content-Type': 'application/json' },
    data: body || undefined,
    timeout: 20000,
  })
}

;(async () => {
  // 1. Identity & subsidiary
  try {
    const me = (await ovh('GET', '/me')).data
    console.log('━━━ /me ━━━')
    console.log(`  customerCode: ${me.customerCode}`)
    console.log(`  nichandle:    ${me.nichandle}`)
    console.log(`  email:        ${me.email}`)
    console.log(`  name:         ${me.firstname} ${me.name}`)
    console.log(`  country:      ${me.country}    subsidiary: ${me.ovhSubsidiary}`)
    console.log(`  currency:     ${me.currency?.code}`)
    const sub = me.ovhSubsidiary || 'CA'

    // 2. VPS catalogue
    try {
      const r = await ovh('GET', '/order/catalog/public/vps', null, `?ovhSubsidiary=${sub}`)
      const plans = (r.data?.plans || []).map(p => ({
        code: p.planCode,
        name: p.invoiceName,
        family: p.family,
        prices: (p.pricings || []).filter(x => x.mode === 'default').map(x => `${(x.price / 100000000).toFixed(2)} ${me.currency?.code}/${x.intervalUnit}`),
      }))
      console.log(`\n━━━ Available VPS plans (${plans.length}) on ${sub} ━━━`)
      for (const p of plans.slice(0, 25)) {
        console.log(`  ${p.code.padEnd(28)} ${p.name.padEnd(36)} ${p.family || '-'}  ${p.prices.join(', ')}`)
      }
    } catch (e) { console.log('VPS catalog error:', e.response?.status, e.response?.data?.message || e.message) }

    // 3. Public Cloud catalogue (alternative line, hourly billing)
    try {
      const r = await ovh('GET', '/order/catalog/public/cloud', null, `?ovhSubsidiary=${sub}`)
      const plans = (r.data?.plans || []).slice(0, 5).map(p => p.planCode + ' / ' + (p.invoiceName || ''))
      console.log(`\n━━━ Public Cloud plans (first 5 of ${r.data?.plans?.length || 0}) ━━━`)
      for (const p of plans) console.log('  ' + p)
    } catch (e) { console.log('Cloud catalog error:', e.response?.status, e.response?.data?.message || e.message) }

    // 4. VPS datacentre availability
    try {
      const r = await ovh('GET', '/order/catalog/public/vps', null, `?ovhSubsidiary=${sub}`)
      const allRegions = new Set()
      for (const p of (r.data?.plans || [])) {
        for (const conf of (p.configurations || [])) {
          if (conf.name === 'datacenter' || conf.name === 'region') {
            for (const v of (conf.values || [])) allRegions.add(v)
          }
        }
      }
      console.log(`\n━━━ Datacentre / region values exposed in catalogue ━━━`)
      console.log('  ' + [...allRegions].sort().join(', '))
    } catch (e) { /* noop */ }
  } catch (e) {
    console.log('FATAL /me:', e.response?.status, e.response?.data || e.message)
  }
})().catch(e => { console.error('FATAL:', e.response?.data || e.message); process.exit(1) })
