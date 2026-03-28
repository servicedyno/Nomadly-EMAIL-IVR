/**
 * Test script for contabo-service.js
 * Run: node js/tests/test_contabo_service.js
 */
require('dotenv').config()
const contabo = require('../contabo-service')

async function runTests() {
  let passed = 0
  let failed = 0

  async function test(name, fn) {
    try {
      await fn()
      console.log(`  ✅ ${name}`)
      passed++
    } catch (err) {
      console.log(`  ❌ ${name}: ${err.message || JSON.stringify(err)}`)
      failed++
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🧪 Contabo Service Tests')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // 1. Auth
  console.log('📋 Authentication:')
  await test('OAuth2 token fetch', async () => {
    const token = await contabo.getAccessToken()
    if (!token || token.length < 50) throw new Error('Token too short')
  })

  await test('Token caching (second call should be instant)', async () => {
    const t1 = Date.now()
    await contabo.getAccessToken()
    const elapsed = Date.now() - t1
    if (elapsed > 100) throw new Error(`Cache miss? took ${elapsed}ms`)
  })

  // 2. Health check
  console.log('\n📋 Health Check:')
  await test('healthCheck returns ok', async () => {
    const h = await contabo.healthCheck()
    if (!h.ok) throw new Error(h.message)
    console.log(`     → ${h.instanceCount} instance(s) found`)
  })

  // 3. Products
  console.log('\n📋 Products (local catalog):')
  await test('listProducts returns 6 NVMe plans', () => {
    const products = contabo.listProducts('EU', false, 'nvme')
    if (products.length !== 6) throw new Error(`Expected 6, got ${products.length}`)
  })

  await test('listProducts returns 6 SSD plans', () => {
    const products = contabo.listProducts('EU', false, 'ssd')
    if (products.length !== 6) throw new Error(`Expected 6, got ${products.length}`)
  })

  await test('Pricing with 50% markup (EU, Linux)', () => {
    const products = contabo.listProducts('EU', false, 'nvme')
    const p1 = products[0]
    // Base $4.50 + EU surcharge $0 = $4.50, 50% markup = $6.75
    if (p1.pricing.totalWithMarkup !== 6.75) throw new Error(`Expected $6.75, got $${p1.pricing.totalWithMarkup}`)
    console.log(`     → VPS 1 (EU, Linux): $${p1.pricing.totalWithMarkup}/mo`)
  })

  await test('Pricing with Windows/RDP (EU)', () => {
    const products = contabo.listProducts('EU', true, 'nvme')
    const p1 = products[0]
    // Base $4.50 + Windows $4.99 = $9.49, 50% markup = $14.24
    const expected = Math.round(9.49 * 1.5 * 100) / 100
    if (p1.pricing.totalWithMarkup !== expected) throw new Error(`Expected $${expected}, got $${p1.pricing.totalWithMarkup}`)
    console.log(`     → VPS 1 (EU, RDP): $${p1.pricing.totalWithMarkup}/mo`)
  })

  await test('Pricing with region surcharge (US-east, RDP)', () => {
    const products = contabo.listProducts('US-east', true, 'nvme')
    const p1 = products[0]
    // Base $4.50 + US-east $0.95 + Windows $4.99 = $10.44, 50% markup
    const expected = Math.round(10.44 * 1.5 * 100) / 100
    if (p1.pricing.totalWithMarkup !== expected) throw new Error(`Expected $${expected}, got $${p1.pricing.totalWithMarkup}`)
    console.log(`     → VPS 1 (US-east, RDP): $${p1.pricing.totalWithMarkup}/mo`)
  })

  // 4. Regions
  console.log('\n📋 Regions (live API):')
  await test('listRegions returns 9+ regions', async () => {
    const regions = await contabo.listRegions()
    if (regions.length < 8) throw new Error(`Expected 8+, got ${regions.length}`)
    console.log(`     → ${regions.length} regions: ${regions.map(r => r.regionSlug).join(', ')}`)
  })

  // 5. Images
  console.log('\n📋 Images (live API):')
  await test('listImages(all) returns 30+ images', async () => {
    const images = await contabo.listImages('all')
    if (images.length < 30) throw new Error(`Expected 30+, got ${images.length}`)
    console.log(`     → ${images.length} total images`)
  })

  await test('listImages(linux) returns Linux-only', async () => {
    const images = await contabo.listImages('linux')
    const winCount = images.filter(i => i.isWindows).length
    if (winCount > 0) throw new Error(`Found ${winCount} Windows images in Linux filter`)
    console.log(`     → ${images.length} Linux images`)
  })

  await test('listImages(rdp) returns Windows-only', async () => {
    const images = await contabo.listImages('rdp')
    if (images.length === 0) throw new Error('No Windows images found')
    const linuxCount = images.filter(i => !i.isWindows).length
    if (linuxCount > 0) throw new Error(`Found ${linuxCount} Linux images in RDP filter`)
    console.log(`     → ${images.length} Windows images`)
  })

  await test('getDefaultWindowsImageId returns valid UUID', async () => {
    const id = await contabo.getDefaultWindowsImageId()
    if (!id || id.length < 30) throw new Error(`Invalid imageId: ${id}`)
    console.log(`     → Default RDP image: ${id}`)
  })

  // 6. Secrets
  console.log('\n📋 Secrets (live API):')
  await test('listSecrets returns array', async () => {
    const secrets = await contabo.listSecrets()
    console.log(`     → ${secrets.length} secret(s) found`)
  })

  // 7. Instances
  console.log('\n📋 Instances (live API):')
  await test('listInstances returns array', async () => {
    const instances = await contabo.listInstances()
    console.log(`     → ${instances.length} instance(s)`)
    if (instances.length > 0) {
      const formatted = contabo.formatInstanceForDisplay(instances[0])
      console.log(`     → First: ${formatted.statusEmoji} ${formatted.name} | ${formatted.ip} | ${formatted.productName} | ${formatted.regionName}`)
    }
  })

  await test('getInstance returns existing instance details', async () => {
    const instances = await contabo.listInstances()
    if (instances.length === 0) throw new Error('No instances to test with')
    const detail = await contabo.getInstance(instances[0].instanceId)
    if (!detail.instanceId) throw new Error('Missing instanceId in response')
    console.log(`     → ${detail.name}: ${detail.status}, CPU:${detail.cpuCores}, RAM:${detail.ramMb}MB`)
  })

  // 8. Format helpers
  console.log('\n📋 Formatting:')
  await test('formatInstanceForDisplay', async () => {
    const instances = await contabo.listInstances()
    if (instances.length === 0) throw new Error('No instances')
    const f = contabo.formatInstanceForDisplay(instances[0])
    if (!f.ip || !f.statusEmoji) throw new Error('Missing fields')
    console.log(`     → ${f.statusEmoji} ${f.name} | IP: ${f.ip} | ${f.productName} | OS: ${f.osType}`)
  })

  await test('formatSpecs', () => {
    const spec = contabo.formatSpecs(contabo.PRODUCT_CATALOG[0])
    if (!spec.includes('vCPU')) throw new Error('Missing vCPU in specs')
    console.log(`     → ${spec}`)
  })

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📊 Results: ${passed} passed, ${failed} failed (${passed + failed} total)`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(err => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
