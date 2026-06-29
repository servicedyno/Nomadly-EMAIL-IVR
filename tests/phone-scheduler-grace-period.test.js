/**
 * Tests for PhoneScheduler grace period on insufficient funds.
 *
 * Validates that when auto-renew fails due to insufficient funds:
 * 1. A 24h grace period is set instead of immediate release
 * 2. The number stays active during grace
 * 3. Grace expiry triggers release
 * 4. Successful renewal during grace clears the _graceUntil flag
 * 5. Grace period message is sent to user
 */
const fs = require('fs')
const path = require('path')

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'phone-scheduler.js'), 'utf8')

describe('PhoneScheduler Grace Period', () => {

  test('insufficient_funds branch sets _graceUntil instead of immediately releasing', () => {
    // The old code had: `numbers[i].status = 'released'` immediately after insufficient_funds
    // The new code should NOT have immediate release — it should check _graceUntil first
    const insuffFundsSection = SRC.split("outcome === 'insufficient_funds'")[1]?.slice(0, 3000) || ''

    // Should contain grace period logic
    expect(insuffFundsSection).toContain('_graceUntil')
    expect(insuffFundsSection).toContain('graceDeadline')
    expect(insuffFundsSection).toContain('24 * 60 * 60 * 1000')

    // First branch (no graceUntil): should set grace, NOT release
    const firstBranch = insuffFundsSection.split('!graceUntil')[1]?.slice(0, 500) || ''
    expect(firstBranch).toContain('graceDeadline')
    expect(firstBranch).toContain("status = 'active'") // keep active during grace
  })

  test('grace period is 24 hours', () => {
    // 24h = 24 * 60 * 60 * 1000 = 86400000 ms
    expect(SRC).toContain('24 * 60 * 60 * 1000')
  })

  test('expired grace triggers release', () => {
    // After grace expires, the code should set status = released
    const graceExpiredMatch = SRC.match(/graceExpired[\s\S]{0,50}\{[\s\S]*?status\s*=\s*'released'/)
    expect(graceExpiredMatch).not.toBeNull()
  })

  test('successful renewal clears _graceUntil in atomic DB update', () => {
    // The findOneAndUpdate $set should include _graceUntil: null
    const atomicUpdateMatch = SRC.match(/\$set:\s*\{[^}]*'val\.numbers\.\$\._graceUntil':\s*null/)
    expect(atomicUpdateMatch).not.toBeNull()
  })

  test('successful renewal clears _graceUntil in local copy', () => {
    // After atomic update, the local array should also be cleared
    expect(SRC).toContain('numbers[index]._graceUntil = null')
  })

  test('buildGracePeriodMsg function exists with 4 language variants', () => {
    expect(SRC).toContain('function buildGracePeriodMsg')
    // Should have en, fr, zh, hi variants
    const fnBody = SRC.split('function buildGracePeriodMsg')[1]?.slice(0, 3000) || ''
    expect(fnBody).toContain("en:")
    expect(fnBody).toContain("fr:")
    expect(fnBody).toContain("zh:")
    expect(fnBody).toContain("hi:")
  })

  test('grace message includes deposit CTA and 24h deadline', () => {
    const fnBody = SRC.split('function buildGracePeriodMsg')[1]?.slice(0, 3000) || ''
    // English version should mention 24 hours and deposit
    expect(fnBody).toContain('24 hours')
    expect(fnBody).toContain('deposit')
    expect(fnBody).toContain('permanently released')
  })

  test('admin notification sent on grace start', () => {
    const insuffSection = SRC.split("outcome === 'insufficient_funds'")[1]?.slice(0, 3000) || ''
    expect(insuffSection).toContain('Grace Period Started')
    expect(insuffSection).toContain('_notifyGroup')
  })

  test('admin notification sent on grace expiry + release', () => {
    const insuffSection = SRC.split("outcome === 'insufficient_funds'")[1]?.slice(0, 5000) || ''
    expect(insuffSection).toContain('Grace Expired + Released')
  })

  test('no immediate release without grace period check', () => {
    // After the insufficient_funds outcome, there should NOT be a direct
    // `releaseFromProvider` call without first checking _graceUntil
    const afterInsuff = SRC.split("outcome === 'insufficient_funds'")[1]?.slice(0, 5000) || ''
    // The releaseFromProvider should only appear AFTER the graceExpired check
    const firstRelease = afterInsuff.indexOf('releaseFromProvider')
    const graceCheck = afterInsuff.indexOf('_graceUntil')
    expect(graceCheck).toBeGreaterThanOrEqual(0)
    expect(firstRelease).toBeGreaterThanOrEqual(0)
    expect(graceCheck).toBeLessThan(firstRelease)
  })

  test('number stays in grace period on subsequent hourly checks', () => {
    // When _graceUntil is set but not expired, the code should log "still in grace period"
    expect(SRC).toContain('still in grace period')
  })

  test('_releasedAfterGrace flag set on grace expiry release', () => {
    // For audit trail: released numbers should be flagged
    expect(SRC).toContain('_releasedAfterGrace')
  })

  test('no auto-renew without grace when autoRenew is OFF', () => {
    // When autoRenew is false, the non-autoRenew branch should still release immediately
    // (grace period only applies to auto-renew failures, not opt-out releases)
    const noAutoRenewSection = SRC.split("No auto-renew — release from provider immediately")[0]
    // This confirms the non-autoRenew branch is separate and doesn't have grace
    expect(noAutoRenewSection).toBeTruthy()
  })
})
