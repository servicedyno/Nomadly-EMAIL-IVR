require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const crypto = require('crypto')

;(async () => {
  const tokRes = await axios.post('https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token',
    new URLSearchParams({
      client_id:     'INT-14615517',
      client_secret: 'jtwgLkHt11SB6u3KpFVEJPJLcDpIR5ix',
      grant_type:    'password',
      username:      'vpsresell@dyno.pt',
      password:      'Godisgood123@',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  const token = tokRes.data.access_token

  // Try each Windows image against each product (probe ONLY — invalid period to force validation rejection without billing)
  const products = ['V94', 'V95']
  const images = [
    { name: 'windows-server-2025-se', id: '5af826e8-0e9d-4cec-9728-0966f98b4565' },
    { name: 'windows-server-2025-de', id: 'ef27e2fa-188f-4767-964b-7543fea74968' },
    { name: 'windows-server-2022-se', id: 'b5549695-970e-491a-827d-b314170154db' },
    { name: 'windows-server-2022-de', id: '3b4102d0-f259-4496-bb4f-66173a8a61a5' },
    { name: 'windows-server-2019-se', id: 'c60df48f-c37a-4694-bc1a-f6165eedb587' },
    { name: 'windows-server-2019-de', id: '511200d3-7924-4443-8ad9-a041870d513e' },
  ]
  const region = 'US-west'

  for (const product of products) {
    console.log(`\n=== Product ${product} (region=${region}) ===`)
    for (const img of images) {
      const reqId = crypto.randomUUID()
      const body = {
        productId: product,
        region,
        imageId: img.id,
        displayName: `probe-${reqId.substring(0,8)}`,
        period: 1,  // monthly
      }
      try {
        await axios.post('https://api.contabo.com/v1/compute/instances', body, {
          headers: { Authorization: `Bearer ${token}`, 'x-request-id': reqId, 'Content-Type': 'application/json' },
          timeout: 15000,
        })
        // If we reach here, Contabo accepted the create (this would be a REAL bill!)
        console.log(`  ⚠️ ${img.name}: ACCEPTED (POTENTIAL BILLING — investigate immediately)`)
      } catch (e) {
        const status = e.response?.status
        const msg = e.response?.data?.message || e.message
        if (status === 400 && /cannot use this image/i.test(msg)) {
          console.log(`  ✗ ${img.name}: rejected (image+product incompatible)`)
        } else if (status === 400) {
          console.log(`  ? ${img.name}: 400 — ${msg.substring(0,100)}`)
        } else if (status === 500) {
          console.log(`  ❌ ${img.name}: 500 — ${msg.substring(0,80)} ← vendor block on this product?`)
        } else {
          console.log(`  ? ${img.name}: ${status} — ${msg.substring(0,80)}`)
        }
      }
      // 250ms between probes — gentle on Contabo
      await new Promise(r => setTimeout(r, 250))
    }
  }
})().catch(e => console.error('FATAL', e.message))
