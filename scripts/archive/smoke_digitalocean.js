#!/usr/bin/env node
/**
 * Live read-only smoke test against DigitalOcean's API + the new
 * digitalocean-service.js wrapper. Does NOT create any paid resources.
 *
 * Run: node /app/scripts/smoke_digitalocean.js
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })

const digitalocean = require('/app/js/digitalocean-service.js')
const vp           = require('/app/js/vps-provider.js')

async function main() {
  const results = []

  // 1. listRegions
  try {
    const regions = await digitalocean.listRegions()
    results.push(['listRegions', 'PASS', `${regions.length} customer regions: ${regions.map(r => r.regionSlug).join(', ')}`])
  } catch (e) { results.push(['listRegions', 'FAIL', e.message]) }

  // 2. listProducts
  try {
    const prods = digitalocean.listProducts('EU', false, 'ssd')
    const summary = prods.map(p => `${p.name}=$${p.pricing.totalWithMarkup}`).join(', ')
    results.push(['listProducts', 'PASS', summary])
  } catch (e) { results.push(['listProducts', 'FAIL', e.message]) }

  // 3. listImages (linux)
  try {
    const imgs = await digitalocean.listImages('linux')
    results.push(['listImages(linux)', 'PASS', `${imgs.length} images, default=${imgs[0]?.imageId}`])
  } catch (e) { results.push(['listImages(linux)', 'FAIL', e.message]) }

  // 4. listImages (windows) — should be empty (DO has no Windows)
  try {
    const wimgs = await digitalocean.listImages('windows')
    results.push(['listImages(windows)', wimgs.length === 0 ? 'PASS' : 'FAIL', `count=${wimgs.length} (expected 0)`])
  } catch (e) { results.push(['listImages(windows)', 'FAIL', e.message]) }

  // 5. listInstances (LIVE — read-only)
  try {
    const insts = await digitalocean.listInstances()
    results.push(['listInstances', 'PASS', `${insts.length} live droplets`])
  } catch (e) { results.push(['listInstances', 'FAIL', e.message]) }

  // 6. account check (low-level apiRequest)
  try {
    const acct = await digitalocean.apiRequest('GET', '/account')
    results.push(['apiRequest /account', 'PASS', `email=${acct.account?.email} status=${acct.account?.status} droplet_limit=${acct.account?.droplet_limit}`])
  } catch (e) { results.push(['apiRequest /account', 'FAIL', e.message]) }

  // 7. Provider abstraction: dispatchByInstanceId('do-12345') routes to DO
  try {
    const svc = vp.dispatchByInstanceId('do-12345')
    results.push(['dispatchByInstanceId(do-...)', svc.PROVIDER === 'digitalocean' ? 'PASS' : 'FAIL', `→ ${svc.PROVIDER}`])
  } catch (e) { results.push(['dispatchByInstanceId', 'FAIL', e.message]) }

  // 8. Provider abstraction: bare numeric still goes to Contabo (legacy)
  // contabo-service.js predates the PROVIDER export convention, so we
  // verify identity by reference equality with the directly-loaded module.
  try {
    const svc = vp.dispatchByInstanceId('203228089')
    const contaboDirect = require('/app/js/contabo-service.js')
    const ok = svc === contaboDirect
    results.push(['dispatchByInstanceId(numeric)', ok ? 'PASS' : 'FAIL', `→ contabo (legacy preserved): ref-match=${ok}`])
  } catch (e) { results.push(['dispatchByInstanceId(num)', 'FAIL', e.message]) }

  // 9. getProviderForRecord with explicit provider field
  try {
    const svc = vp.getProviderForRecord({ provider: 'digitalocean' })
    results.push(['getProviderForRecord({provider:digitalocean})', svc.PROVIDER === 'digitalocean' ? 'PASS' : 'FAIL', `→ ${svc.PROVIDER}`])
  } catch (e) { results.push(['getProviderForRecord', 'FAIL', e.message]) }

  // 10. Confirm DO service exports all lifecycle methods the bot calls
  const required = ['startInstance', 'stopInstance', 'restartInstance', 'shutdownInstance',
                    'resetPassword', 'reinstallInstance', 'cancelInstance', 'upgradeInstance',
                    'getInstance', 'createInstance', 'createSnapshot', 'listSnapshots']
  const missing = required.filter(m => typeof digitalocean[m] !== 'function')
  results.push(['lifecycle method completeness', missing.length === 0 ? 'PASS' : 'FAIL', missing.length === 0 ? 'all 12 methods present' : `MISSING: ${missing.join(', ')}`])

  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════════')
  console.log('║ DigitalOcean Live Smoke Test')
  console.log('╠════════════════════════════════════════════════════════════════')
  let pass = 0, fail = 0
  for (const [name, status, detail] of results) {
    const icon = status === 'PASS' ? '✅' : '❌'
    if (status === 'PASS') pass++; else fail++
    console.log(`║ ${icon} ${name}`)
    console.log(`║    ${detail}`)
  }
  console.log('╠════════════════════════════════════════════════════════════════')
  console.log(`║ Result: ${pass} PASS, ${fail} FAIL`)
  console.log('╚════════════════════════════════════════════════════════════════\n')
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(e => { console.error('FATAL:', e); process.exit(2) })
