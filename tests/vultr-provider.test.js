/* global describe, test, expect, beforeEach */
/**
 * Vultr provider — integration with the vps-provider abstraction.
 *
 * Confirms:
 *   - The 6-tier "Premium Cloud VPS 10-60" catalog is intact
 *   - Pricing applies 200% markup (matches VPS_MARKUP_PERCENT)
 *   - listProducts accepts the 3-arg signature (parity with contabo)
 *   - All 9 customer-facing regions resolve to a Vultr region ID
 *   - vps-provider routes by record + by instanceId correctly:
 *       Vultr UUIDs → Vultr
 *       Contabo numeric → Contabo
 *       OVH `vps-…` → OVH
 *   - Customer-facing names never mention "Vultr" or "Contabo"
 */
process.env.VPS_MARKUP_PERCENT = '200'
process.env.VULTR_API_KEY = 'test-key-only'

const path = require('path')
const vultr = require(path.join(__dirname, '..', 'js', 'vultr-service.js'))

describe('Vultr — Premium Cloud VPS catalog (Option A, RDP-viable)', () => {
  test('Exactly 6 tiers, named "Premium Cloud VPS 10/20/30/40/50/60"', () => {
    expect(vultr.PRODUCT_CATALOG).toHaveLength(6)
    const names = vultr.PRODUCT_CATALOG.map(p => p.name)
    expect(names).toEqual([
      'Premium Cloud VPS 10', 'Premium Cloud VPS 20', 'Premium Cloud VPS 30',
      'Premium Cloud VPS 40', 'Premium Cloud VPS 50', 'Premium Cloud VPS 60',
    ])
  })

  test('Customer-facing names never mention provider', () => {
    for (const p of vultr.PRODUCT_CATALOG) {
      expect(p.name).not.toMatch(/vultr/i)
      expect(p.name).not.toMatch(/contabo/i)
      expect(p.name).not.toMatch(/ovh/i)
    }
  })

  test('Tier 1 is RDP-viable (≥2 GB RAM) — the cheapest viable Windows plan', () => {
    const tier1 = vultr.PRODUCT_CATALOG[0]
    expect(tier1.productId).toBe('vc2-1c-2gb')
    expect(tier1.ramMb).toBeGreaterThanOrEqual(2048)
    expect(tier1.basePriceUsd).toBe(10)
  })

  test('PRODUCT_CATALOG_SSD is an alias of PRODUCT_CATALOG (no SSD/NVMe variant on Vultr)', () => {
    expect(vultr.PRODUCT_CATALOG_SSD).toBe(vultr.PRODUCT_CATALOG)
  })
})

describe('Vultr — pricing with 200% markup', () => {
  test.each([
    ['vc2-1c-2gb',   10,  30],
    ['vc2-2c-2gb',   15,  45],
    ['vc2-2c-4gb',   24,  72],
    ['vc2-4c-8gb',   40, 120],
    ['vc2-6c-16gb',  80, 240],
    ['vc2-8c-32gb', 160, 480],
  ])('%s costs $%i × 3 = $%i sell price', (id, base, sell) => {
    const p = vultr.getProduct(id)
    const price = vultr.calculatePrice(p, 'EU', false)
    expect(price.basePriceUsd).toBe(base)
    expect(price.totalWithMarkup).toBe(sell)
  })

  test('Windows licence is bundled (no surcharge for RDP)', () => {
    const p = vultr.getProduct('vc2-1c-2gb')
    const linux = vultr.calculatePrice(p, 'EU', false)
    const win = vultr.calculatePrice(p, 'EU', true)
    expect(win.windowsLicense).toBe(0)
    expect(win.totalWithMarkup).toBe(linux.totalWithMarkup)
  })

  test('Region surcharge is zero across all 9 regions (flat pricing)', () => {
    const p = vultr.getProduct('vc2-1c-2gb')
    for (const region of Object.keys(vultr.REGION_TO_VULTR_ID)) {
      const price = vultr.calculatePrice(p, region, false)
      expect(price.regionSurcharge).toBe(0)
    }
  })

  test('listProducts accepts (region, isWindows, diskPreference) — Contabo signature parity', () => {
    const nvme = vultr.listProducts('EU', false, 'nvme')
    const ssd = vultr.listProducts('EU', false, 'ssd')
    // Both return the SAME catalog (Vultr has no SSD/NVMe split)
    expect(nvme).toHaveLength(6)
    expect(ssd).toHaveLength(6)
    expect(nvme.map(p => p.productId)).toEqual(ssd.map(p => p.productId))
  })
})

describe('Regions — 9 customer-facing slugs map to Vultr region IDs', () => {
  test.each([
    ['EU', 'fra'], ['US-east', 'ewr'], ['US-west', 'lax'], ['US-central', 'ord'],
    ['UK', 'lhr'], ['SG', 'sgp'], ['JP', 'nrt'], ['AU', 'syd'], ['IN', 'bom'],
  ])('%s → %s', (slug, vultrId) => {
    expect(vultr.REGION_TO_VULTR_ID[slug]).toBe(vultrId)
  })
})

describe('vps-provider — per-record + per-instanceId routing for Vultr UUIDs', () => {
  beforeEach(() => {
    // Clear any cached provider so .env changes pick up correctly
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'vps-provider'))]
  })

  test('VPS_DEFAULT_PROVIDER=vultr → getProvider returns Vultr', () => {
    process.env.VPS_DEFAULT_PROVIDER = 'vultr'
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'vps-provider'))]
    const vp = require(path.join(__dirname, '..', 'js', 'vps-provider'))
    expect(vp.getProvider().PROVIDER).toBe('vultr')
  })

  test('UUID instanceId → routed to Vultr regardless of default', () => {
    process.env.VPS_DEFAULT_PROVIDER = 'contabo'
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'vps-provider'))]
    const vp = require(path.join(__dirname, '..', 'js', 'vps-provider'))
    const svc = vp.dispatchByInstanceId('cb676a83-3b48-4b6a-9f88-d62e1c9aac1f')
    expect(svc.PROVIDER).toBe('vultr')
  })

  test('Numeric instanceId → routed to Contabo (legacy records preserved)', () => {
    process.env.VPS_DEFAULT_PROVIDER = 'vultr'
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'vps-provider'))]
    const vp = require(path.join(__dirname, '..', 'js', 'vps-provider'))
    expect(vp.detectProviderByInstanceId('203228089')).toBe('contabo')
  })

  test('vps-… instanceId → routed to OVH', () => {
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'vps-provider'))]
    const vp = require(path.join(__dirname, '..', 'js', 'vps-provider'))
    expect(vp.detectProviderByInstanceId('vps-12abc34.vps.ovh.net')).toBe('ovh')
  })

  test('getProviderForRecord uses explicit provider field first', () => {
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'vps-provider'))]
    const vp = require(path.join(__dirname, '..', 'js', 'vps-provider'))
    expect(vp.getProviderForRecord({ provider: 'vultr' }).PROVIDER).toBe('vultr')
  })

  test('UUID in contaboInstanceId (legacy mis-named field) → routed to Vultr', () => {
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'vps-provider'))]
    const vp = require(path.join(__dirname, '..', 'js', 'vps-provider'))
    const svc = vp.getProviderForRecord({ contaboInstanceId: 'cb676a83-3b48-4b6a-9f88-d62e1c9aac1f' })
    expect(svc.PROVIDER).toBe('vultr')
  })
})
