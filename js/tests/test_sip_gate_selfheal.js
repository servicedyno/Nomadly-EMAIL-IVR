/**
 * Regression test: SIP-credentials gate stops firing for users whose plan
 * already includes SIP, even if `sipDisabled === true` is stuck from a
 * previous lower plan.
 *
 * Context (production incident, 2026-05-05): @wizardchop bought number
 * +15162719167 on the Starter plan, later upgraded to Business — but the
 * upgrade path didn't auto-clear the `sipDisabled` flag on the existing
 * record. Result: user tapped 🔑 SIP Credentials and got the misleading
 * error "requires the Pro plan or higher. Your current plan: business".
 * Two paying users were affected.
 *
 * The fix has two parts:
 *   1. Lazy self-heal in the gate — when canAccessFeature(plan)===true but
 *      sipDisabled===true, clear the flag and proceed to credentials.
 *   2. Honest copy in `phone-config.upgradeMessage` — when the user is
 *      already on a qualifying plan, show "feature temporarily unavailable
 *      — contact support" instead of "upgrade to a plan you already have".
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')

function run(name, fn) {
  try { fn(); console.log(`✓ ${name}`) }
  catch (e) { console.error(`✗ ${name}\n   ${e.message}`); process.exit(1) }
}

const indexSrc = fs.readFileSync(path.resolve(__dirname, '../_index.js'), 'utf8')
const phoneConfigSrc = fs.readFileSync(path.resolve(__dirname, '../phone-config.js'), 'utf8')

// ── Part 1: lazy self-heal in the gate ──

run('SIP-credentials gate has lazy self-heal for stuck sipDisabled', () => {
  // Find the SIP credentials handler block
  const start = indexSrc.indexOf('SIP Credentials — Pro/Business only')
  assert.ok(start > 0, 'SIP credentials handler must exist')
  const block = indexSrc.slice(start, start + 2500)
  assert.ok(block.includes('canAccessFeature(num.plan, \'sipCredentials\')'),
    'gate must consult canAccessFeature(num.plan)')
  assert.ok(/if \(num\.sipDisabled && phoneConfig\.canAccessFeature\(num\.plan, 'sipCredentials'\)\)/.test(block),
    'must detect "stuck flag on qualifying plan" condition before showing the lock screen')
  assert.ok(block.includes('val.numbers.'),
    'must update the right schema path (phoneNumbersOf/<chatId>.val.numbers[idx])')
  assert.ok(block.includes('Auto-cleared sipDisabled'),
    'must log the auto-heal action for audit trail')
})

// ── Part 2: honest copy in upgradeMessage ──

run('upgradeMessage detects "current plan already meets requirement"', () => {
  assert.ok(phoneConfigSrc.includes('planAlreadyMeets'),
    'helper variable must be present in upgradeMessage')
  assert.ok(/planRank\s*=\s*\{\s*starter:\s*1.*pro:\s*2.*business:\s*3/.test(phoneConfigSrc),
    'must compare via numeric plan ranks (not string equality)')
  assert.ok(phoneConfigSrc.includes('lockedTemplates'),
    'must define a separate template family for "already-on-qualifying-plan"')
})

run('lockedTemplates avoid the misleading "upgrade to X plan" copy', () => {
  // Pull just the lockedTemplates object (ends at `\n  }\n` before the next template family)
  const start = phoneConfigSrc.indexOf('const lockedTemplates')
  const end = phoneConfigSrc.indexOf('  // SIP-credentials specific', start)
  assert.ok(start > 0 && end > start, 'lockedTemplates block must exist')
  const block = phoneConfigSrc.slice(start, end)
  assert.ok(!block.includes('Upgrade via'),
    'locked copy must not say "Upgrade via 🔄 Renew / Change Plan" — user IS on a qualifying plan')
  assert.ok(block.includes('temporarily unavailable'),
    'locked copy should clearly say feature is temporarily unavailable')
  assert.ok(block.includes('@Hostbay_support'),
    'locked copy should direct users to support, not back through the upgrade UX')
  // i18n coverage
  assert.ok(block.includes('en:') && block.includes('fr:') && block.includes('zh:') && block.includes('hi:'),
    'lockedTemplates must cover all four supported languages')
})

run('Old buggy copy only fires for users who genuinely need an upgrade', () => {
  // The contradictory copy "requires Pro plan or higher. Your current plan: business"
  // must only fire when the user actually needs to upgrade.
  const fnStart = phoneConfigSrc.indexOf('const upgradeMessage = (feature, currentPlan, lang) =>')
  const fnEnd = phoneConfigSrc.indexOf('\n}', fnStart)
  const fn = phoneConfigSrc.slice(fnStart, fnEnd + 2)
  assert.ok(fn.includes('if (planAlreadyMeets) return'),
    'function must short-circuit for users who already meet the plan requirement')
  assert.ok(/if \(feature === 'sipCredentials'\) return/.test(fn),
    'function must short-circuit for SIP creds (dedicated pitch)')
  // The generic upgrade copy is still the FALLBACK for non-SIP features when
  // user is on a lower plan — that's correct. Just make sure it's preceded
  // by the two short-circuit branches.
  const lastReturnIdx = fn.lastIndexOf("return (templates[l] || templates.en)(featureName, needed, currentPlan)")
  const planMeetsBranchIdx = fn.indexOf('if (planAlreadyMeets) return')
  const sipBranchIdx = fn.indexOf("if (feature === 'sipCredentials') return")
  assert.ok(planMeetsBranchIdx > 0 && planMeetsBranchIdx < lastReturnIdx,
    'planAlreadyMeets branch must come BEFORE the generic upgrade fallback')
  assert.ok(sipBranchIdx > 0 && sipBranchIdx < lastReturnIdx,
    'sipCredentials branch must come BEFORE the generic upgrade fallback')
})

// ── Part 3: SIP-creds-specific upgrade pitch for Starter users (item b) ──

run('SIP credentials gets a dedicated upgrade pitch (creds already provisioned)', () => {
  assert.ok(phoneConfigSrc.includes('sipCredsUpgradeTemplates'),
    'must define a separate template family for sipCredentials feature')
  assert.ok(phoneConfigSrc.includes('already provisioned'),
    'pitch must reassure user creds already exist on our network')
  assert.ok(phoneConfigSrc.includes('Linphone'),
    'pitch should name-check at least one popular softphone for tangibility')
})

run('sipCredsUpgradeTemplates covers all four supported languages', () => {
  const start = phoneConfigSrc.indexOf('const sipCredsUpgradeTemplates')
  const end = phoneConfigSrc.indexOf('}\n  // Pick the right template')
  assert.ok(start > 0 && end > start, 'sipCredsUpgradeTemplates block must exist')
  const block = phoneConfigSrc.slice(start, end)
  assert.ok(block.includes('en:') && block.includes('fr:') && block.includes('zh:') && block.includes('hi:'),
    'sipCredsUpgradeTemplates must cover en/fr/zh/hi')
})

run('upgradeMessage routes Starter users + sipCredentials to the dedicated pitch', () => {
  const fnStart = phoneConfigSrc.indexOf('const upgradeMessage = (feature, currentPlan, lang) =>')
  const fnEnd = phoneConfigSrc.indexOf('\n}', fnStart)
  const fn = phoneConfigSrc.slice(fnStart, fnEnd + 2)
  assert.ok(/feature === 'sipCredentials'\s*\)\s*templates = sipCredsUpgradeTemplates/.test(fn),
    'router must select sipCredsUpgradeTemplates when feature is sipCredentials and plan does NOT yet qualify')
  assert.ok(fn.includes("if (feature === 'sipCredentials') return"),
    'final return must call the sipCreds template with just (currentPlan)')
})

console.log('\nAll SIP-gate self-heal tests passed.')
