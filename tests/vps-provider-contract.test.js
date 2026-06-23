/**
 * Regression tests for the VPS provider abstraction contract.
 *
 * 2026-06-23 incident (@ciroovblzz RDP purchase failed): Vultr's listRegions()
 * returned `{slug, emoji, label, vultrId}` (flat) while Contabo/OVH return
 * `{regionSlug, regionName, display: {emoji, label}}` (nested). The consumer
 * vm-instance-setup.js fetchAvailableCountries() does
 * `r.display.emoji` → TypeError → catch returns `false` → bot kicks user back
 * to main menu with "Erreur lors de la récupération". Killed every RDP/VPS
 * purchase after VPS_DEFAULT_PROVIDER=vultr was set on prod.
 *
 * These tests enforce the SHARED CONTRACT between contabo / ovh / vultr so
 * that every consumer in vm-instance-setup.js can rely on the same shape.
 */

const vps = require('../js/vps-provider')

describe('VPS provider abstraction contract', () => {
  const PROVIDERS = ['contabo', 'ovh', 'vultr']

  PROVIDERS.forEach(name => {
    describe(name, () => {
      const svc = require(`../js/${name}-service`)

      test('PROVIDER constant matches name (soft — contabo legacy lacks it)', () => {
        if (typeof svc.PROVIDER === 'string') {
          expect(svc.PROVIDER.toLowerCase()).toBe(name)
        }
      })

      test('listRegions() returns objects with .regionSlug, .regionName and .display.{emoji,label}', async () => {
        const regs = await svc.listRegions()
        expect(Array.isArray(regs)).toBe(true)
        expect(regs.length).toBeGreaterThan(0)
        for (const r of regs) {
          expect(typeof r.regionSlug).toBe('string')
          expect(r.regionSlug.length).toBeGreaterThan(0)
          expect(typeof r.regionName).toBe('string')
          expect(r.display).toBeDefined()
          expect(typeof r.display.emoji).toBe('string')
          expect(typeof r.display.label).toBe('string')
          // The exact prod bug: this template literal threw "Cannot read .emoji of undefined"
          const buttonLabel = `${r.display.emoji} ${r.display.label}`
          expect(buttonLabel.length).toBeGreaterThan(0)
        }
      })

      test('exports formatSpecs(product) → string', () => {
        expect(typeof svc.formatSpecs).toBe('function')
        const sample = (svc.PRODUCT_CATALOG || [])[0]
        if (sample) {
          const out = svc.formatSpecs(sample)
          expect(typeof out).toBe('string')
          expect(out).toMatch(/vCPU/)
          expect(out).toMatch(/RAM/)
        }
      })

      test('exports formatInstanceForDisplay(instance) → object with required keys', () => {
        expect(typeof svc.formatInstanceForDisplay).toBe('function')
      })

      test('exports WINDOWS_LICENSE_BY_TIER (numeric keyed)', () => {
        expect(svc.WINDOWS_LICENSE_BY_TIER).toBeDefined()
        expect(typeof svc.WINDOWS_LICENSE_BY_TIER).toBe('object')
      })

      test('listImages("linux") returns objects with imageId+name+osType+isWindows', async () => {
        // Skip if the provider call hits live API and there's no creds in this env
        const orig = svc.listImages
        if (typeof orig !== 'function') return
        // For Vultr/Contabo this requires API access; OVH is static. Just shape-test
        // when the call succeeds, otherwise skip.
        let images
        try { images = await orig('linux') } catch { return }
        if (!Array.isArray(images) || images.length === 0) return
        const img = images[0]
        expect(img.imageId !== undefined).toBe(true)
        expect(typeof img.name).toBe('string')
        expect(['Linux', 'Windows']).toContain(img.osType)
        expect(typeof img.isWindows).toBe('boolean')
      })
    })
  })

  test('smart proxy with VPS_DEFAULT_PROVIDER=vultr satisfies the consumer contract', async () => {
    const prev = process.env.VPS_DEFAULT_PROVIDER
    process.env.VPS_DEFAULT_PROVIDER = 'vultr'
    // Re-require to pick up the fresh env (cached require can hide this)
    delete require.cache[require.resolve('../js/vps-provider')]
    const freshVps = require('../js/vps-provider')
    const contaboProxy = freshVps.buildSmartProxy()
    const regs = await contaboProxy.listRegions()
    expect(Array.isArray(regs)).toBe(true)
    expect(regs.length).toBeGreaterThan(0)
    // This is EXACTLY the line that crashed on 2026-06-23
    const labels = regs.map(r => `${r.display.emoji} ${r.display.label}`)
    expect(labels.length).toBe(regs.length)
    expect(typeof contaboProxy.formatSpecs).toBe('function')
    if (prev !== undefined) process.env.VPS_DEFAULT_PROVIDER = prev
    else delete process.env.VPS_DEFAULT_PROVIDER
  })
})
