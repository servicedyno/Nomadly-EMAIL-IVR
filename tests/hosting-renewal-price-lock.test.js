/* global describe, test, expect */
/**
 * Test: getPlanPrice() — auto-renew price lock
 *
 * Confirms the 21-day-RCA fix: when an account has a locked
 * `renewalPriceUsd`, that value is returned regardless of the env-driven
 * plan map. Falls back to the legacy plan-name mapping only when the
 * account hasn't been back-filled.
 */
const path = require('path')
process.env.PREMIUM_ANTIRED_WEEKLY_PRICE = '50'
process.env.PREMIUM_ANTIRED_CPANEL_PRICE = '75'
process.env.GOLDEN_ANTIRED_CPANEL_PRICE = '100'

const { getPlanPrice } = require(path.join(__dirname, '..', 'js', 'hosting-scheduler.js'))

describe('getPlanPrice — auto-renew price lock', () => {
  test('returns renewalPriceUsd when present on the account (the bug fix)', () => {
    const account = {
      plan: 'Golden Anti-Red HostPanel (30 Days)',  // env says $100
      renewalPriceUsd: 30,                            // but customer paid $30 promo
    }
    expect(getPlanPrice(account)).toBe(30) // honor the promo price
  })

  test('falls back to plan-name map when account has NO renewalPriceUsd (legacy)', () => {
    const account = { plan: 'Golden Anti-Red HostPanel (30 Days)' }
    expect(getPlanPrice(account)).toBe(100) // env-driven list price
  })

  test('still works with the legacy plan-name string call signature', () => {
    expect(getPlanPrice('Premium Anti-Red (1-Week)')).toBe(50)
    expect(getPlanPrice('Premium Anti-Red HostPanel (30 Days)')).toBe(75)
    expect(getPlanPrice('Golden Anti-Red HostPanel (1-Month)')).toBe(100)
  })

  test('ignores invalid renewalPriceUsd (zero / negative / NaN) and falls back', () => {
    expect(getPlanPrice({ plan: 'Premium Anti-Red (1-Week)', renewalPriceUsd: 0 })).toBe(50)
    expect(getPlanPrice({ plan: 'Premium Anti-Red (1-Week)', renewalPriceUsd: -5 })).toBe(50)
    expect(getPlanPrice({ plan: 'Premium Anti-Red (1-Week)', renewalPriceUsd: NaN })).toBe(50)
  })

  test('honors fractional locked prices (e.g. $22.50 weekly promo)', () => {
    expect(getPlanPrice({ plan: 'Premium Anti-Red (1-Week)', renewalPriceUsd: 22.5 })).toBe(22.5)
    expect(getPlanPrice({ plan: 'Premium Anti-Red (1-Week)', renewalPriceUsd: 28.5 })).toBe(28.5)
  })

  test('unknown plan with no lock returns 0 (existing behaviour)', () => {
    expect(getPlanPrice({ plan: 'Unknown Mystery Plan' })).toBe(0)
    expect(getPlanPrice('Unknown Mystery Plan')).toBe(0)
  })

  test('null / undefined input falls back to 0 (no crash)', () => {
    expect(getPlanPrice(null)).toBe(0)
    expect(getPlanPrice(undefined)).toBe(0)
  })
})
