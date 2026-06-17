/**
 * Probe OVH's VPS APIs that we need for Phase-2 polish:
 *   1. /vps/{sn}/rebuild     — for SSH-key + cloud-init post-deploy
 *   2. /vps/{sn}/upgrade     — for upgradeInstance flow
 *   3. /dedicated/server/availabilities — for dedicated-server mapping
 *
 * The OVH account has zero VPS today, so we use /vps as a probe (returns
 * empty array), then probe the spec endpoints for the API surface.
 *
 * Specifically we look at the /vps schema docs via OPTIONS or the introspection
 * endpoint and verify what parameters /rebuild accepts (sshKey, imageId,
 * installCustomConfig, doNotSendPassword, etc.).
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const crypto = require('crypto')

const AK = process.env.OVH_APP_KEY
const AS = process.env.OVH_APP_SECRET
const CK = process.env.OVH_CONSUMER_KEY
const BASE = process.env.OVH_ENDPOINT || 'https://ca.api.ovh.com/1.0'

async function ovh(method, path) {
  const ts = (await axios.get(`${BASE}/auth/time`, {timeout:10000})).data
  const url = `${BASE}${path}`
  const sig = '$1$' + crypto.createHash('sha1').update(`${AS}+${CK}+${method}+${url}++${ts}`).digest('hex')
  return axios({method,url,headers:{'X-Ovh-Application':AK,'X-Ovh-Consumer':CK,'X-Ovh-Timestamp':String(ts),'X-Ovh-Signature':sig},timeout:30000})
}

async function probe(method, path, label) {
  try {
    const r = await ovh(method, path)
    console.log(`✓ ${label}: ${JSON.stringify(r.data).substring(0, 360)}`)
    return r.data
  } catch (e) {
    console.log(`✗ ${label}: HTTP ${e.response?.status} ${(e.response?.data?.message || e.message || '').substring(0, 200)}`)
    return null
  }
}

;(async () => {
  console.log('━━━ 1. /vps schema (lists API endpoints + parameters)')
  // OVH exposes a schema at /vps.json but it's not GraphQL — try alternate paths
  await probe('GET', '/vps', 'List VPS (empty array expected)')

  // The official schema is at /sws/api/v1/openapi/vps — try fetch
  try {
    const r = await axios.get(`${BASE}/vps.json`, { timeout: 15000 })
    const apis = (r.data?.apis || []).filter(a => /\/(rebuild|upgrade|sshKey)/.test(a.path)).slice(0, 10)
    console.log(`\n━━━ 2. /vps endpoints matching rebuild|upgrade|sshKey:`)
    for (const a of apis) {
      console.log(`  ${a.path}`)
      for (const op of (a.operations || [])) {
        console.log(`    [${op.httpMethod}] ${(op.description || '').substring(0, 100)}`)
        for (const p of (op.parameters || [])) {
          console.log(`      ${p.dataType}${p.required ? '*' : ''}  ${p.name.padEnd(30)} ${(p.description || '').substring(0, 70)}`)
        }
      }
    }
  } catch (e) { console.log('  /vps.json schema fetch failed:', e.message.substring(0, 150)) }

  console.log('\n━━━ 3. /dedicated server catalogue probe')
  await probe('GET', '/order/catalog/public/eco?ovhSubsidiary=WE', '/order/catalog/public/eco (Eco / Rise / Advance dedicated)')

  // /dedicated/server is the management endpoint, list any existing
  await probe('GET', '/dedicated/server', '/dedicated/server (list existing)')

  // Check available upgrade plans for a hypothetical VPS — without real VPS we can't actually call this
  // but we can probe /order/catalog/formatted/vps which sometimes exposes upgrade options
  console.log('\n━━━ 4. /order/cart/{cartId}/vps/upgrade probe (needs cart with vps; just verify endpoint exists)')
  await probe('GET', '/order/cart', 'Show cart-creation endpoint metadata')

  console.log('\n━━━ DONE')
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
