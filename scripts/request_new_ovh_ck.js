/**
 * Request a NEW OVH Consumer Key from the CA endpoint with full-access
 * rules (GET/POST/PUT/PATCH/DELETE on /*). OVH returns a validation URL —
 * the account owner clicks it, logs in, approves, and the Consumer Key
 * becomes active immediately. The Application Key + Secret stay the same.
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const AK = process.argv[2] || '547807098e261b35'
const AS = process.argv[3] || 'b0a079be6b20649f1b4d3f8729f130cc'
const BASE = 'https://ca.api.ovh.com/1.0'   // confirmed working region

// Rules we need for a Contabo-replacement integration:
//   /vps/*           → list, create, configure, reinstall, stop, start, terminate VPS
//   /cloud/*         → public-cloud projects + instances (alternative to /vps)
//   /order/*         → catalog, cart, ordering
//   /me              → account identity for sanity checks
//   /ip/*            → manage IPs (failover, reverse DNS, etc.)
//   /domain/*        → optional, in case we want to read OVH-registered domains too
const rules = [
  { method: 'GET',    path: '/*' },
  { method: 'POST',   path: '/*' },
  { method: 'PUT',    path: '/*' },
  { method: 'PATCH',  path: '/*' },
  { method: 'DELETE', path: '/*' },
]

;(async () => {
  // POST /auth/credential is UNAUTHENTICATED but signed by the Application Key
  const r = await axios.post(`${BASE}/auth/credential`, {
    accessRules: rules,
    redirection: 'https://www.ovh.com/',  // where the user lands after approving
  }, {
    headers: {
      'X-Ovh-Application': AK,
      'Content-Type':      'application/json',
    },
    timeout: 15000,
  })

  const out = r.data
  console.log('━━━ New Consumer Key requested ━━━')
  console.log(`Consumer Key:    ${out.consumerKey}`)
  console.log(`State:           ${out.state}`)
  console.log(`Validation URL:  ${out.validationUrl}`)
  console.log('\n→ Open the validation URL in a browser, log into the OVH account that owns the VPSes, and click "Authorize". The CK becomes active immediately.')
  console.log('\nAfter approval, replace this in /app/backend/.env:')
  console.log(`  OVH_CONSUMER_KEY="${out.consumerKey}"`)
})().catch(e => {
  console.error('FATAL:', e.response?.status, e.response?.data || e.message)
  process.exit(1)
})
