#!/usr/bin/env node
/**
 * Push CF nameservers to OpenProvider registry for @HHR2009's two stuck domains.
 *
 * Investigation finding (2026-06-18):
 *   - OP's DB shows correct CF NS for both domains.
 *   - But public DNS (registry) still resolves to OP parking NS (ina*.registrar.eu).
 *   - Root cause: original op.registerDomain() with CF NS stored the NS in OP's
 *     DB but the registry-side NS update (chprov / domain:update at Verisign / DENIC)
 *     never propagated. See op-service.js:683 doc — same class of bug as rsvpeviteopen.de.
 *   - Calling op.updateNameservers() with the `ns_group: ''` quirk forces OP to
 *     re-push to the registry → registry switches to CF NS → AntiRed worker starts
 *     intercepting traffic → red flag clears.
 *
 * Idempotent. Safe to re-run.
 */

require('dotenv').config({ path: '/app/.env' })
const op = require('/app/js/op-service.js')

const DOMAINS = [
  { domain: 'strivepartypaperless.com', cfNs: ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'] },
  { domain: 'inviowelcoparty.de',       cfNs: ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'] },
]

;(async () => {
  for (const { domain, cfNs } of DOMAINS) {
    console.log(`\n=========================================`)
    console.log(`Domain: ${domain}`)
    console.log(`Target CF NS: ${cfNs.join(', ')}`)

    // Verify current OP state
    const before = await op.getDomainInfo(domain)
    if (!before?.domainId) {
      console.log(`  ❌ Not found at OpenProvider — skipping`)
      continue
    }
    console.log(`  OP domainId: ${before.domainId}  status: ${before.status}`)
    console.log(`  OP DB shows:  ${JSON.stringify(before.nameservers)}`)

    // Force registry-side push
    console.log(`  → Calling op.updateNameservers() to force registry push (ns_group reset)...`)
    const result = await op.updateNameservers(domain, cfNs)
    console.log(`  Result: ${JSON.stringify(result)}`)

    // Verify
    const after = await op.getDomainInfo(domain)
    console.log(`  Post-call OP DB: ${JSON.stringify(after?.nameservers)}`)
    console.log(`  ${result.success ? '✅' : '❌'} ${domain}`)
  }

  console.log(`\nDONE — registry propagation typically takes 10 min – 24 h.`)
  console.log(`Monitor with:  dig @1.1.1.1 strivepartypaperless.com NS +short`)
  console.log(`Expected:      anderson.ns.cloudflare.com / leanna.ns.cloudflare.com`)
  process.exit(0)
})().catch(e => { console.error('FATAL', e); process.exit(1) })
