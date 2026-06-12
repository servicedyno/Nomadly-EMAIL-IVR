require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

;(async () => {
  // Use the NEW creds we just verified
  const tokRes = await axios.post('https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token',
    new URLSearchParams({
      client_id:     'INT-14615517',
      client_secret: 'jtwgLkHt11SB6u3KpFVEJPJLcDpIR5ix',
      grant_type:    'password',
      username:      'vpsresell@dyno.pt',
      password:      'Godisgood123@',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
  )
  const token = tokRes.data.access_token
  console.log('✓ Token acquired')

  // List Contabo standard images (not custom)
  const reqId = require('crypto').randomUUID()
  const r = await axios.get('https://api.contabo.com/v1/compute/images?page=1&size=200&standardImage=true', {
    headers: { Authorization: `Bearer ${token}`, 'x-request-id': reqId },
    timeout: 30000,
  })
  const imgs = r.data?.data || []
  console.log(`\nFound ${imgs.length} standard images:\n`)

  // Filter to Windows images and show their compat
  const winImgs = imgs.filter(i => /windows/i.test(i.name) || /windows/i.test(i.osType || ''))
  console.log(`Windows images (${winImgs.length}):`)
  for (const img of winImgs) {
    console.log(`  - name=${img.name}`)
    console.log(`    id=${img.imageId}`)
    console.log(`    osType=${img.osType} version=${img.version}`)
    console.log(`    standardImage=${img.standardImage} status=${img.status}`)
    console.log(`    description=${(img.description || '').substring(0, 100)}`)
    console.log()
  }
})().catch(e => { console.error('ERR', e.response?.data || e.message); process.exit(1) })
