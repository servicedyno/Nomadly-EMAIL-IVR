// Read-only Telnyx diagnostic: check if +18884879051 is on the Telnyx account
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const API_KEY = process.env.TELNYX_API_KEY
const BASE = 'https://api.telnyx.com/v2'
const PHONE = '+18884879051'
const h = () => ({ 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' })

;(async () => {
  // 1) Direct lookup — already owned?
  console.log('[1] Direct lookup phone_numbers/' + PHONE)
  try {
    const res = await axios.get(`${BASE}/phone_numbers/${encodeURIComponent(PHONE)}`, { headers: h() })
    console.log('  ✅ OWNED by our Telnyx account')
    console.log('  id        :', res.data?.data?.id)
    console.log('  status    :', res.data?.data?.status)
    console.log('  connection_id:', res.data?.data?.connection_id)
    console.log('  messaging_profile_id:', res.data?.data?.messaging_profile_id)
    console.log('  phone_number_type:', res.data?.data?.phone_number_type)
    console.log('  purchased_at:', res.data?.data?.purchased_at)
  } catch (e) {
    console.log('  Not owned →', e.response?.status, e.response?.data?.errors?.[0]?.title || e.message)
  }

  // 2) Search inventory — is it purchasable right now?
  console.log('\n[2] Search Telnyx inventory for', PHONE)
  try {
    const res = await axios.get(`${BASE}/available_phone_numbers`, {
      headers: h(),
      params: { 'filter[phone_number]': PHONE, 'filter[limit]': 5 }
    })
    const nums = res.data?.data || []
    console.log('  Found in inventory:', nums.length)
    nums.forEach(n => console.log('   -', n.phone_number, 'features=', JSON.stringify(n.features?.map(f => f.name))))
  } catch (e) {
    console.log('  ERR:', e.response?.status, e.response?.data?.errors?.[0]?.title || e.message)
  }

  // 3) Toll-free area-code search around 888
  console.log('\n[3] Telnyx toll-free inventory (sample — to know what we could buy as replacement)')
  try {
    const res = await axios.get(`${BASE}/available_phone_numbers`, {
      headers: h(),
      params: {
        'filter[country_code]': 'US',
        'filter[phone_number_type]': 'toll_free',
        'filter[limit]': 5,
        'filter[best_effort]': true,
      }
    })
    const nums = res.data?.data || []
    console.log('  Sample toll-free numbers available:')
    nums.slice(0, 5).forEach(n => console.log('   -', n.phone_number))
  } catch (e) {
    console.log('  ERR:', e.response?.status, e.response?.data?.errors?.[0]?.title || e.message)
  }

  // 4) Check ALL our owned phone_numbers and filter — paranoid scan
  console.log('\n[4] List ALL owned Telnyx numbers (page 1, search for', PHONE + ')')
  try {
    const res = await axios.get(`${BASE}/phone_numbers`, {
      headers: h(),
      params: { 'filter[phone_number]': PHONE, 'page[size]': 5 }
    })
    const nums = res.data?.data || []
    console.log('  Matches:', nums.length)
    nums.forEach(n => console.log('   - id=' + n.id + ' phone=' + n.phone_number + ' status=' + n.status))
  } catch (e) {
    console.log('  ERR:', e.response?.status, e.response?.data?.errors?.[0]?.title || e.message)
  }

  // 5) Check Telnyx number orders for any historical reference
  console.log('\n[5] Search Telnyx number_orders for', PHONE)
  try {
    const res = await axios.get(`${BASE}/number_orders`, {
      headers: h(),
      params: { 'filter[phone_numbers.phone_number]': PHONE, 'page[size]': 5 }
    })
    const orders = res.data?.data || []
    console.log('  Orders found:', orders.length)
    orders.forEach(o => console.log('   - id=' + o.id + ' status=' + o.status + ' created=' + o.created_at))
  } catch (e) {
    console.log('  ERR:', e.response?.status, e.response?.data?.errors?.[0]?.title || e.message)
  }
})().catch(e => { console.error(e); process.exit(1) })
