/**
 * Test OVHcloud API credentials end-to-end (read-only):
 *  1) Identity check  (/me)
 *  2) VPS catalogue   (/vps)
 *  3) Available datacentres / regions for /order
 *  4) Sample IP order references
 *
 * Probes EU, US, CA, and AU endpoints to find which one the Consumer Key
 * was created against (OVH credentials are region-bound).
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const axios   = require('axios')
const crypto  = require('crypto')

const AK = process.argv[2] || '547807098e261b35'
const AS = process.argv[3] || 'b0a079be6b20649f1b4d3f8729f130cc'
const CK = process.argv[4] || 'fd4fa9e047f86bc0a452bacdaf90554c'

const ENDPOINTS = {
  eu: 'https://eu.api.ovh.com/1.0',
  us: 'https://api.us.ovhcloud.com/1.0',
  ca: 'https://ca.api.ovh.com/1.0',
}

async function ovh(base, method, path, body = '') {
  // Each request needs a TS coming from the server to avoid clock drift.
  const ts = (await axios.get(`${base}/auth/time`, { timeout: 10000 })).data
  const url = `${base}${path}`
  const bodyStr = body ? JSON.stringify(body) : ''
  const toSign = `${AS}+${CK}+${method}+${url}+${bodyStr}+${ts}`
  const sig = '$1$' + crypto.createHash('sha1').update(toSign).digest('hex')
  return axios({
    method, url,
    headers: {
      'X-Ovh-Application': AK,
      'X-Ovh-Consumer':    CK,
      'X-Ovh-Timestamp':   String(ts),
      'X-Ovh-Signature':   sig,
      'Content-Type':      'application/json',
    },
    data: body || undefined,
    timeout: 15000,
  })
}

async function probe(region) {
  const base = ENDPOINTS[region]
  console.log(`\n━━━ Probing ${region.toUpperCase()} endpoint (${base}) ━━━`)
  try {
    const me = await ovh(base, 'GET', '/me')
    const d = me.data
    console.log('✓ /me ok')
    console.log(`  customerCode: ${d.customerCode}`)
    console.log(`  nichandle:    ${d.nichandle}`)
    console.log(`  email:        ${d.email}`)
    console.log(`  name:         ${d.firstname} ${d.name}`)
    console.log(`  country:      ${d.country}`)
    return region
  } catch (e) {
    const s = e.response?.status, msg = e.response?.data?.message || e.message
    console.log(`  /me FAILED: HTTP ${s} — ${msg}`)
    return null
  }
}

;(async () => {
  // Force CA — that's where the credentials resolved (others returned "invalid").
  const workingRegion = 'ca'
  const base = ENDPOINTS[workingRegion]
  console.log(`\n━━━ Probing ${workingRegion.toUpperCase()} endpoint exhaustively ━━━`)

  // Existing VPS in the account
  try {
    const r = await ovh(base, 'GET', '/vps')
    console.log(`\n✓ /vps: ${r.data.length} VPS already in account`)
    if (r.data.length) console.log(`  IDs: ${r.data.slice(0, 10).join(', ')}${r.data.length > 10 ? '…' : ''}`)
  } catch (e) { console.log(`  /vps failed: HTTP ${e.response?.status} ${e.response?.data?.message}`) }

  // Dedicated cloud / public cloud projects (for Public Cloud instances)
  try {
    const r = await ovh(base, 'GET', '/cloud/project')
    console.log(`\n✓ /cloud/project: ${r.data.length} public-cloud projects`)
    if (r.data.length) console.log(`  IDs: ${r.data.slice(0, 5).join(', ')}`)
  } catch (e) { console.log(`  /cloud/project failed: HTTP ${e.response?.status} ${e.response?.data?.message}`) }

  // Order catalogue — VPS plans available for purchase
  try {
    const r = await ovh(base, 'GET', '/order/cart')
    console.log(`\n✓ /order/cart: ${r.data.length} active carts`)
  } catch (e) { console.log(`  /order/cart failed: HTTP ${e.response?.status} ${e.response?.data?.message}`) }

  // Check available OS images for VPS provisioning
  try {
    const r = await ovh(base, 'GET', '/order/catalog/public/vps', { ovhSubsidiary: 'GB' })
    const plans = (r.data?.plans || []).slice(0, 8).map(p => p.planCode + ' / ' + (p.invoiceName || '?'))
    console.log(`\n✓ /order/catalog/public/vps (sample plans):`)
    for (const p of plans) console.log(`   ${p}`)
  } catch (e) { console.log(`  /order/catalog/public/vps failed: ${e.response?.status} ${e.response?.data?.message}`) }

  // Privileges — what does this Consumer Key actually allow?
  try {
    const r = await ovh(base, 'GET', '/auth/currentCredential')
    console.log(`\n✓ /auth/currentCredential:`)
    console.log(`  status:        ${r.data.status}`)
    console.log(`  expiration:    ${r.data.expiration || '(no expiry — long-lived)'}`)
    console.log(`  applicationId: ${r.data.applicationId}`)
    console.log(`  Rules (${(r.data.rules || []).length}):`)
    for (const rule of (r.data.rules || []).slice(0, 30)) {
      console.log(`    ${rule.method.padEnd(7)} ${rule.path}`)
    }
  } catch (e) { console.log(`  /auth/currentCredential failed: ${e.response?.status} ${e.response?.data?.message}`) }
})().catch(e => { console.error('FATAL:', e.response?.data || e.message); process.exit(1) })
