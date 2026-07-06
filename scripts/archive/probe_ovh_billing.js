/**
 * Probe OVH account: payment methods, credit balance, billing setup, and
 * the order-flow endpoints we'll need (carts, billing, agreements).
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const crypto = require('crypto')

const AK = '547807098e261b35'
const AS = 'b0a079be6b20649f1b4d3f8729f130cc'
const CK = '8ab431c4da9ab46bfb8a4bb950fcc3d9'
const BASE = 'https://ca.api.ovh.com/1.0'

async function ovh(method, path, body=null) {
  const ts = (await axios.get(`${BASE}/auth/time`, {timeout:10000})).data
  const url = `${BASE}${path}`
  const bodyStr = body ? JSON.stringify(body) : ''
  const sig = '$1$' + crypto.createHash('sha1').update(`${AS}+${CK}+${method}+${url}+${bodyStr}+${ts}`).digest('hex')
  return axios({method,url,headers:{'X-Ovh-Application':AK,'X-Ovh-Consumer':CK,'X-Ovh-Timestamp':String(ts),'X-Ovh-Signature':sig,'Content-Type':'application/json'},data:body||undefined,timeout:20000})
}

async function safeProbe(method, path, label) {
  try {
    const r = await ovh(method, path)
    console.log(`✓ ${label}: ${JSON.stringify(r.data).slice(0, 240)}`)
    return r.data
  } catch (e) {
    console.log(`✗ ${label}: HTTP ${e.response?.status} ${e.response?.data?.message || e.message}`)
    return null
  }
}

;(async () => {
  console.log('━━━ Payment methods & credit on OVH account ━━━')
  await safeProbe('GET', '/me/paymentMethod', '/me/paymentMethod')
  await safeProbe('GET', '/me/availableAutomaticPaymentMeans', '/me/availableAutomaticPaymentMeans')
  await safeProbe('GET', '/me/credit/balance', '/me/credit/balance')
  await safeProbe('GET', '/me/fidelityAccount', '/me/fidelityAccount')

  console.log('\n━━━ Account agreements (must be accepted before ordering) ━━━')
  await safeProbe('GET', '/me/agreements', '/me/agreements')

  console.log('\n━━━ Bill currency & last bills ━━━')
  await safeProbe('GET', '/me/bill', '/me/bill?count=5')

  console.log('\n━━━ Order cart create (test, will be deleted) ━━━')
  let cartId = null
  try {
    const r = await ovh('POST', '/order/cart', { ovhSubsidiary: 'WE', description: 'nomadly-test-cart' })
    cartId = r.data.cartId
    console.log(`  Created cart: ${cartId}`)
    // Assign account
    await ovh('POST', `/order/cart/${cartId}/assign`)
    console.log('  Assigned')
    // Add a vps-le-2-2-40 to it
    const item = await ovh('POST', `/order/cart/${cartId}/vps`, {
      planCode: 'vps-le-2-2-40',
      pricingMode: 'default',
      duration: 'P1M',
      quantity: 1,
    })
    console.log(`  Added vps-le-2-2-40 itemId=${item.data.itemId}`)
    console.log(`  Item price: ${JSON.stringify(item.data.prices)}`)
    // Required configurations
    const rc = await ovh('GET', `/order/cart/${cartId}/item/${item.data.itemId}/requiredConfiguration`)
    console.log(`  Required configuration: ${JSON.stringify(rc.data, null, 2)}`)
    // Available options for OS addon
    const opts = await ovh('GET', `/order/cart/${cartId}/vps/options?planCode=vps-le-2-2-40`)
    console.log(`  Available options: ${(opts.data||[]).length} entries`)
    for (const o of (opts.data || []).slice(0, 5)) {
      console.log(`    family=${o.family}, planCode=${o.planCode}, prices=${o.prices?.[0]?.price?.value || '?'}`)
    }
    // Checkout simulation (do NOT pay)
    try {
      const co = await ovh('GET', `/order/cart/${cartId}/checkout`)
      console.log(`\n  Pre-checkout summary:`)
      console.log(`    total HT: ${co.data?.prices?.withoutTax?.text || co.data?.prices?.original?.text}`)
      console.log(`    total TTC: ${co.data?.prices?.withTax?.text}`)
      console.log(`    autoPayWithPreferredPaymentMethod: ${co.data?.autoPayWithPreferredPaymentMethod}`)
    } catch (e) { console.log('  Checkout summary failed:', e.response?.data?.message || e.message) }
  } catch (e) {
    console.log('  Cart flow error:', e.response?.status, e.response?.data?.message || e.message)
  } finally {
    if (cartId) {
      try { await ovh('DELETE', `/order/cart/${cartId}`); console.log(`  Deleted cart ${cartId}`) } catch (_) { /* silently ignore — cart cleanup is best-effort */ }
    }
  }
})().catch(e => { console.error('FATAL:', e.response?.data || e.message); process.exit(1) })
