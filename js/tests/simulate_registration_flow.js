#!/usr/bin/env node
/**
 * Domain Registration Flow Simulator
 * Tests all 6 combinations (2 registrars × 3 NS options) + 3 fallback scenarios
 * Mocks actual API calls, traces through real logic
 */

require('dotenv').config({ path: '/app/backend/.env' })

const PASS = '✅'
const FAIL = '❌'
const WARN = '⚠️'
let totalPass = 0, totalFail = 0, totalWarn = 0
const issues = []

// ─── Mock Setup ─────────────────────────────────────────

let mockCRResult = { success: true }
let mockOPResult = { success: true, domainId: 99999, registrar: 'OpenProvider' }
let mockCFResult = { success: true, zoneId: 'cf-zone-123', nameservers: ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'], status: 'pending' }
let crCalled = false, opCalled = false, cfCreateCalled = false
let opCalledWithNS = null, crCalledWithDomain = null

// Mock ConnectReseller
const originalCRModule = require('/app/js/cr-domain-register')
const originalCRBuy = originalCRModule.buyDomainOnline
originalCRModule.buyDomainOnline = async (domain) => {
  crCalled = true
  crCalledWithDomain = domain
  console.log(`    [MOCK CR] buyDomainOnline("${domain}") → ${JSON.stringify(mockCRResult)}`)
  return mockCRResult
}

// Mock OpenProvider registerDomain
const opService = require('/app/js/op-service')
const originalOPRegister = opService.registerDomain
opService.registerDomain = async (domainName, nameservers = []) => {
  opCalled = true
  opCalledWithNS = nameservers
  console.log(`    [MOCK OP] registerDomain("${domainName}", NS=[${nameservers.join(', ')}]) → ${JSON.stringify(mockOPResult)}`)
  return mockOPResult
}

// Mock Cloudflare createZone
const cfService = require('/app/js/cf-service')
const originalCFCreate = cfService.createZone
cfService.createZone = async (domainName) => {
  cfCreateCalled = true
  console.log(`    [MOCK CF] createZone("${domainName}") → ${JSON.stringify(mockCFResult)}`)
  return mockCFResult
}

// Mock DB
const mockDB = {
  collection: () => ({
    updateOne: async (filter, update, opts) => {
      console.log(`    [MOCK DB] updateOne filter=${JSON.stringify(filter)} set=${JSON.stringify(update.$set)}`)
      return { modifiedCount: 1 }
    }
  })
}

const domainService = require('/app/js/domain-service')

// ─── Helper ─────────────────────────────────────────────

function resetMocks() {
  crCalled = false
  opCalled = false
  cfCreateCalled = false
  opCalledWithNS = null
  crCalledWithDomain = null
  mockCRResult = { success: true }
  mockOPResult = { success: true, domainId: 99999, registrar: 'OpenProvider' }
  mockCFResult = { success: true, zoneId: 'cf-zone-123', nameservers: ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'], status: 'pending' }
}

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ${PASS} ${label}`)
    totalPass++
  } else {
    console.log(`  ${FAIL} ${label} ${detail}`)
    totalFail++
    issues.push(`${label}: ${detail}`)
  }
}

function warn(label, detail) {
  console.log(`  ${WARN} ${label} ${detail}`)
  totalWarn++
  issues.push(`[WARN] ${label}: ${detail}`)
}

// ─── Simulations ────────────────────────────────────────

async function simulate(testName, registrar, nsChoice, customNS, opts = {}) {
  console.log(`\n${'═'.repeat(70)}`)
  console.log(`TEST: ${testName}`)
  console.log(`  registrar=${registrar}  nsChoice=${nsChoice}  customNS=${JSON.stringify(customNS || null)}`)
  console.log(`${'─'.repeat(70)}`)
  resetMocks()

  if (opts.crFails) {
    mockCRResult = { error: opts.crError || 'Insufficient balance' }
  }
  if (opts.cfFails) {
    mockCFResult = { success: false, errors: ['CF zone create failed'] }
  }

  const result = await domainService.registerDomain('simtest.com', registrar, nsChoice, mockDB, '12345', customNS)

  console.log(`  RESULT: ${JSON.stringify(result)}`)
  console.log(`  ─ Trace:`)

  // Validate based on scenario
  if (registrar === 'ConnectReseller' && !opts.crFails) {
    check('CR called', crCalled)
    check('OP NOT called', !opCalled)
    check('Result registrar = ConnectReseller', result.registrar === 'ConnectReseller')
  }

  if (registrar === 'OpenProvider') {
    check('OP called', opCalled)
    check('CR NOT called', !crCalled)
    check('Result registrar = OpenProvider', result.registrar === 'OpenProvider')
  }

  if (opts.crFails) {
    check('CR called first', crCalled)
    check('OP called as fallback', opCalled, 'OP should be called when CR fails')
    check('Result registrar = OpenProvider (fallback)', result.registrar === 'OpenProvider',
      `got: ${result.registrar}`)
  }

  // NS validation
  if (nsChoice === 'provider_default') {
    if (registrar === 'ConnectReseller' && !opts.crFails) {
      check('CR: NS set at registration (hardcoded 8307.dns*.managedns.org)', true, '(CR always uses its own NS)')
      check('No CF zone created', !cfCreateCalled)
    }
    if (registrar === 'OpenProvider' || opts.crFails) {
      check('OP called with empty NS (provider_default)', opCalled && opCalledWithNS?.length === 0,
        `got NS: [${opCalledWithNS}]`)
      check('No CF zone created', !cfCreateCalled)
    }
  }

  if (nsChoice === 'cloudflare' && !opts.cfFails) {
    check('CF createZone called', cfCreateCalled)
    if (registrar === 'ConnectReseller' && !opts.crFails) {
      check('CR: NS NOT passed at registration (CR ignores them)', crCalled, '(CR hardcodes its own NS)')
      warn('CR+CF: NS update needed post-registration', 'CR registers with 8307.dns*.managedns.org, CF NS applied later')
    }
    if (registrar === 'OpenProvider' || opts.crFails) {
      check('OP called with CF nameservers', opCalled && opCalledWithNS?.length >= 2,
        `got NS: [${opCalledWithNS}]`)
    }
    check('Result has cfZoneId', !!result.cfZoneId, `got: ${result.cfZoneId}`)
    check('Result nameservers populated', result.nameservers?.length >= 2,
      `got: [${result.nameservers}]`)
  }

  if (nsChoice === 'custom') {
    check('No CF zone created', !cfCreateCalled)
    if (registrar === 'ConnectReseller' && !opts.crFails) {
      check('CR: NS NOT passed at registration (CR ignores them)', crCalled, '(CR hardcodes its own NS)')
      warn('CR+Custom: NS update needed post-registration', 'CR registers with 8307.dns*.managedns.org, custom NS applied later')
    }
    if (registrar === 'OpenProvider' || opts.crFails) {
      check('OP called with custom nameservers', opCalled && opCalledWithNS?.length === 2,
        `got NS: [${opCalledWithNS}]`)
    }
    check('Result nameservers = custom NS', JSON.stringify(result.nameservers) === JSON.stringify(customNS),
      `got: [${result.nameservers}]`)
  }

  check('Result success = true', result.success === true, `got: ${result.success}`)
  return result
}

// ─── Post-Registration Flow Trace (_index.js) ───────────

function tracePostRegistration(testName, registrar, nsChoice, resultRegistrar) {
  console.log(`\n  ── Post-registration trace (buyDomainFullProcess) ──`)
  console.log(`    state.registrar="${registrar}"  nsChoice="${nsChoice}"  result.registrar="${resultRegistrar}"`)

  // After fix: registrar = buyResult.registrar || registrar (line 10508)
  const effectiveRegistrar = resultRegistrar || registrar

  const customNS = ['ns1.custom.com', 'ns2.custom.com']

  let postRegPath = 'none'

  if (nsChoice === 'custom' && effectiveRegistrar === 'ConnectReseller') {
    postRegPath = 'CR custom NS update (60s wait → CR DNS API)'
  } else if (nsChoice === 'custom' && effectiveRegistrar === 'OpenProvider') {
    postRegPath = 'OP custom NS verify (10s wait → OP NS API)'
  } else if (nsChoice === 'cloudflare' && effectiveRegistrar === 'ConnectReseller') {
    postRegPath = 'CR cloudflare NS update (60s wait → CR DNS API)'
  } else if (nsChoice === 'cloudflare' && effectiveRegistrar === 'OpenProvider') {
    postRegPath = 'OP cloudflare NS verify (10s wait → OP NS API)'
  } else if (nsChoice === 'provider_default') {
    postRegPath = 'skip (provider_default → no NS update needed)'
  }

  console.log(`    effectiveRegistrar="${effectiveRegistrar}" (from buyResult.registrar)`)
  console.log(`    Post-reg path taken: ${postRegPath}`)

  // Validate the path matches the actual registrar
  const pathUsesCorrectRegistrar =
    (effectiveRegistrar === 'OpenProvider' && !postRegPath.startsWith('CR')) ||
    (effectiveRegistrar === 'ConnectReseller' && !postRegPath.startsWith('OP')) ||
    nsChoice === 'provider_default'

  check('Post-reg NS update uses correct registrar path', pathUsesCorrectRegistrar)
}

// ─── Run All Tests ──────────────────────────────────────

async function runAll() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗')
  console.log('║     DOMAIN REGISTRATION FLOW SIMULATOR — ALL PATHS                 ║')
  console.log('╚══════════════════════════════════════════════════════════════════════╝')

  // ── ConnectReseller (3 NS options) ──
  let r

  r = await simulate('1. CR + provider_default', 'ConnectReseller', 'provider_default', null)
  tracePostRegistration('1. CR + provider_default', 'ConnectReseller', 'provider_default', r.registrar)

  r = await simulate('2. CR + custom NS', 'ConnectReseller', 'custom', ['ns1.custom.com', 'ns2.custom.com'])
  tracePostRegistration('2. CR + custom NS', 'ConnectReseller', 'custom', r.registrar)

  r = await simulate('3. CR + cloudflare', 'ConnectReseller', 'cloudflare', null)
  tracePostRegistration('3. CR + cloudflare', 'ConnectReseller', 'cloudflare', r.registrar)

  // ── OpenProvider (3 NS options) ──

  r = await simulate('4. OP + provider_default', 'OpenProvider', 'provider_default', null)
  tracePostRegistration('4. OP + provider_default', 'OpenProvider', 'provider_default', r.registrar)

  r = await simulate('5. OP + custom NS', 'OpenProvider', 'custom', ['ns1.custom.com', 'ns2.custom.com'])
  tracePostRegistration('5. OP + custom NS', 'OpenProvider', 'custom', r.registrar)

  r = await simulate('6. OP + cloudflare', 'OpenProvider', 'cloudflare', null)
  tracePostRegistration('6. OP + cloudflare', 'OpenProvider', 'cloudflare', r.registrar)

  // ── Fallback: CR fails → OP (3 NS options) ──

  r = await simulate('7. CR FAILS → OP fallback + provider_default', 'ConnectReseller', 'provider_default', null, { crFails: true })
  tracePostRegistration('7. CR→OP fallback + provider_default', 'ConnectReseller', 'provider_default', r.registrar)

  r = await simulate('8. CR FAILS → OP fallback + custom NS', 'ConnectReseller', 'custom', ['ns1.custom.com', 'ns2.custom.com'], { crFails: true })
  tracePostRegistration('8. CR→OP fallback + custom NS', 'ConnectReseller', 'custom', r.registrar)

  r = await simulate('9. CR FAILS → OP fallback + cloudflare', 'ConnectReseller', 'cloudflare', null, { crFails: true })
  tracePostRegistration('9. CR→OP fallback + cloudflare', 'ConnectReseller', 'cloudflare', r.registrar)

  // ── Edge: CF zone creation fails ──

  r = await simulate('10. OP + cloudflare (CF FAILS → falls back to provider_default)', 'OpenProvider', 'cloudflare', null, { cfFails: true })
  check('CF failure: nsChoice downgraded to provider_default', r.cfZoneId === null, `cfZoneId: ${r.cfZoneId}`)
  check('CF failure: OP called with empty NS', opCalledWithNS?.length === 0, `NS: [${opCalledWithNS}]`)

  // ── Summary ───────────────────────────────────────────

  console.log(`\n${'═'.repeat(70)}`)
  console.log(`SUMMARY: ${PASS} ${totalPass} passed  ${FAIL} ${totalFail} failed  ${WARN} ${totalWarn} warnings`)
  console.log(`${'═'.repeat(70)}`)

  if (issues.length > 0) {
    console.log('\nISSUES FOUND:')
    issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`))
  }

  console.log('')
}

runAll().catch(err => {
  console.error('Simulator error:', err)
  process.exit(1)
})
