/**
 * Smoke test for ovh-service.js + vps-provider.js.
 *
 * Tests (read-only / cart-build-only — NEVER triggers checkout):
 *   1. healthCheck()           — /me & /vps return ok
 *   2. listProducts()          — 6 tiers with correct pricing
 *   3. listRegions()           — 9 datacenters
 *   4. listImages()            — Linux + Windows OS catalog
 *   5. calculatePrice()        — Markup math is correct
 *   6. _buildCart() then _deleteCart()  — full order flow without checkout
 *   7. vps-provider.getProvider() returns ovh-service
 */

'use strict'
require('dotenv').config({ path: '/app/backend/.env' })

const ovh = require('../ovh-service')
const provider = require('../vps-provider')

function assert(cond, label) {
  if (cond) console.log(`  ✓ ${label}`)
  else { console.log(`  ✗ ${label}`); process.exitCode = 1 }
}

;(async () => {
  console.log('━━━ 1. healthCheck')
  const h = await ovh.healthCheck()
  console.log(`  ${JSON.stringify(h)}`)
  assert(h.ok === true, 'API connected')
  assert(typeof h.account === 'string', 'nichandle returned')

  console.log('\n━━━ 2. listProducts (Linux)')
  const linux = ovh.listProducts('BHS', false)
  for (const p of linux) {
    console.log(`  Tier ${p.tier} (${p.productId}) ${p.name}: ${p.cpuCores}c/${p.ramGb}G/${p.diskGb}G  raw=$${p.basePriceUsd}  customer=$${p.pricing.totalWithMarkup}`)
  }
  assert(linux.length === 6, 'Six Linux tiers')
  // Production VPS_MARKUP_PERCENT = 200, so price = base × 3
  assert(linux[0].pricing.totalWithMarkup === 16.50, 'Tier 1 Linux markup (200%) = $16.50')

  console.log('\n━━━ 2b. listProducts (Windows / RDP)')
  const win = ovh.listProducts('BHS', true)
  for (const p of win) {
    console.log(`  Tier ${p.tier} (${p.productId}) RDP ${p.name}: customer=$${p.pricing.totalWithMarkup} (base $${p.basePriceUsd} + win $${p.windowsPriceUsd})`)
  }
  assert(win[0].pricing.totalWithMarkup === 51.00, 'Tier 1 RDP markup (200%) = $51.00')
  assert(win[5].pricing.totalWithMarkup === 375.00, 'Tier 6 RDP markup (200%) = $375.00')

  console.log('\n━━━ 3. listRegions')
  const regions = await ovh.listRegions()
  for (const r of regions) console.log(`  ${r.display.emoji}  ${r.regionSlug}  ${r.regionName}`)
  assert(regions.length === 9, 'Nine datacenters')

  console.log('\n━━━ 4. listImages')
  const imgs = await ovh.listImages('all')
  console.log(`  ${imgs.length} images: ${imgs.map(i => i.name).join(', ')}`)
  assert(imgs.some(i => i.name === 'ubuntu-24.04'), 'ubuntu-24.04 present')
  assert(imgs.some(i => i.osType === 'Windows'), 'Windows images present')

  console.log('\n━━━ 5. vps-provider routing')
  console.log(`  DEFAULT_PROVIDER = ${provider.DEFAULT_PROVIDER}`)
  console.log(`  FALLBACK_ENABLED = ${provider.FALLBACK_ENABLED}`)
  const p = provider.getProvider()
  assert(p.PROVIDER === 'ovh', 'getProvider() returns ovh')

  console.log('\n━━━ 6. _buildCart (smoke test — DELETES cart, never checks out)')
  let cartId = null
  try {
    const cart = await ovh._buildCart({
      productId: 'VLE2',
      region:    'BHS',
      imageId:   'ubuntu-24.04',
      isWindows: false,
    })
    cartId = cart.cartId
    console.log(`  Cart built: cartId=${cart.cartId} itemId=${cart.itemId} total=$${cart.total.toFixed(2)}`)
    assert(cart.total === 5.50, 'Linux Nano cart total = $5.50')
  } catch (e) {
    console.log(`  ✗ Cart build failed: ${e.message}`)
    process.exitCode = 1
  } finally {
    if (cartId) await ovh._deleteCart(cartId)
  }

  console.log('\n━━━ 6b. _buildCart with Windows option')
  let cartIdW = null
  try {
    const cart = await ovh._buildCart({
      productId: 'VLE2',
      region:    'BHS',
      imageId:   'windows-2025',
      isWindows: true,
    })
    cartIdW = cart.cartId
    console.log(`  Cart built: cartId=${cart.cartId} itemId=${cart.itemId} total=$${cart.total.toFixed(2)}`)
    assert(cart.total === 17.00, 'RDP Nano cart total = $17.00 (5.50 base + 11.50 windows)')
  } catch (e) {
    console.log(`  ✗ Cart build failed: ${e.message}`)
    process.exitCode = 1
  } finally {
    if (cartIdW) await ovh._deleteCart(cartIdW)
  }

  console.log('\n━━━ 7. Dry-run createInstance (OVH_DRY_RUN=true)')
  process.env.OVH_DRY_RUN = 'true'
  try {
    const inst = await ovh.createInstance({
      productId:   'VLE2',
      region:      'BHS',
      imageId:     'ubuntu-24.04',
      displayName: 'smoke-test',
    })
    console.log(`  Dry-run instance: id=${inst.instanceId} status=${inst.status} total=$${inst._ovhTotal?.toFixed(2)}`)
    assert(inst.status === 'dry_run', 'Dry-run returned status=dry_run')
    assert(inst._ovhTotal === 5.50, 'Dry-run total = $5.50')
  } catch (e) {
    console.log(`  ✗ Dry-run createInstance failed: ${e.message}`)
    process.exitCode = 1
  } finally {
    delete process.env.OVH_DRY_RUN
  }

  console.log('\n━━━ DONE. Exit code:', process.exitCode || 0)
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
