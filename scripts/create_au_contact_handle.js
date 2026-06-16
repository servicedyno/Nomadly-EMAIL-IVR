/**
 * One-shot script: pre-create a dedicated AU contact handle in OpenProvider
 * so .au-family registrations can use it (resolves OP code 160 "Empty
 * companyname field").
 *
 * Creating a customer/contact handle is FREE on OP — no domain purchase
 * happens. This script ONLY POSTs /v1beta/customers and reads back the
 * generated handle ID.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const OP = 'https://api.openprovider.eu'

async function token() {
  const r = await axios.post(`${OP}/v1beta/auth/login`, {
    username: process.env.OPENPROVIDER_USERNAME,
    password: process.env.OPENPROVIDER_PASSWORD,
  }, { timeout: 15000 })
  if (r.data?.code !== 0) throw new Error('OP auth failed: ' + JSON.stringify(r.data))
  return r.data.data.token
}

;(async () => {
  const t = await token()
  const headers = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }

  // Step 1: Search for an existing AU handle with the right org name so we don't duplicate.
  const search = await axios.get(`${OP}/v1beta/customers`, {
    headers, timeout: 15000,
    params: { limit: 500, email_pattern: process.env.WHOIS_PUBLISHED_EMAIL || 'cloakhost@tutamail.com' },
  })
  const orgName = process.env.AU_REGISTRANT_NAME || 'APPLE PTY LTD'
  const existing = (search.data?.data?.results || []).find(c =>
    c.handle?.endsWith('-AU') &&
    (c.company_name === orgName || c.organization === orgName) &&
    !c.is_deleted
  )
  if (existing) {
    console.log(`Existing AU handle found: ${existing.handle}  (company=${existing.company_name || existing.organization})`)
    console.log('Use this handle ID. No creation needed.')
    return
  }

  // Step 2: Create a new AU handle.
  const contact = {
    name: { first_name: 'Apple', last_name: 'Pty Ltd' },
    company_name: orgName,                        // OP code 160 fix
    phone: { country_code: '+61', area_code: '1300', subscriber_number: '321456' },
    email: process.env.WHOIS_PUBLISHED_EMAIL || 'cloakhost@tutamail.com',
    address: {
      street:  '20 Martin Place',
      number:  '20',
      zipcode: '2000',
      city:    'Sydney',
      state:   'NSW',
      country: 'AU',
    },
    locale: 'en_AU',
  }
  console.log('Creating AU contact handle:')
  console.log(JSON.stringify(contact, null, 2))

  const r = await axios.post(`${OP}/v1beta/customers`, contact, { headers, timeout: 15000 })
  if (r.data?.code !== 0) {
    console.error('CREATE FAILED:', JSON.stringify(r.data, null, 2))
    process.exit(1)
  }
  const handle = r.data?.data?.handle
  console.log(`\n✅ Created AU handle: ${handle}`)
  console.log('\n→ Add to /app/js/op-service.js PREFERRED_HANDLES:\n     AU: "' + handle + '",')

  // Step 3: Verify by reading the handle back.
  const verify = await axios.get(`${OP}/v1beta/customers/${handle}`, { headers, timeout: 10000 })
  const d = verify.data?.data || {}
  console.log('\nVerified read-back:')
  console.log(`  handle=${d.handle}`)
  console.log(`  company_name=${d.company_name}`)
  console.log(`  country=${d.address?.country}`)
  console.log(`  email=${d.email}`)
  console.log(`  is_deleted=${d.is_deleted}`)
})().catch(e => {
  console.error('FATAL:', e.response?.data || e.message)
  process.exit(1)
})
