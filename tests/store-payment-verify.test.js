/* global describe, test, expect */
/**
 * Unit tests for js/store-payment-verify.js
 *
 * Verifies the storefront webhook classifier is a DENY-LIST (parity with the
 * bot's authDyno): hold ONLY on empty / definitively-unpaid events, and TRUST
 * every other event as paid. This is the core of the fix — the old code
 * defaulted to NOT-paid unless a gateway status endpoint said otherwise, which
 * dropped every real web payment (the endpoint returns "Application not found"
 * for storefront addresses).
 */

const {
  classifyStoreWebhook,
  isStoreUnderpaid,
  normalizeStatus,
} = require('../js/store-payment-verify')

describe('classifyStoreWebhook — deny-list (parity with bot authDyno)', () => {
  const paidEvents = [
    'payment.confirmed', 'confirmed', 'settled', 'payment.settled',
    'completed', 'payment.completed', 'paid', 'success',
    // Unknown / novel provider "paid-like" events MUST still be trusted —
    // this is what proves the deny-list default (and fixes the bug).
    'payment.fully_paid', 'some_new_paid_status', 'overpaid',
  ]
  test.each(paidEvents)('trusts "%s" as PAID → fulfill', (ev) => {
    const v = classifyStoreWebhook({ event: ev })
    expect(v.decision).toBe('fulfill')
    expect(v.paid).toBe(true)
  })

  const holdEvents = ['pending', 'payment.pending', 'underpaid', 'payment.underpaid', 'waiting', 'processing', 'unpaid']
  test.each(holdEvents)('holds non-terminal unpaid "%s"', (ev) => {
    const v = classifyStoreWebhook({ event: ev })
    expect(v.decision).toBe('hold')
    expect(v.paid).toBe(false)
  })

  const failEvents = ['failed', 'payment.failed', 'expired', 'cancelled', 'canceled', 'declined', 'rejected']
  test.each(failEvents)('fails terminal unpaid "%s"', (ev) => {
    const v = classifyStoreWebhook({ event: ev })
    expect(v.decision).toBe('fail')
    expect(v.paid).toBe(false)
  })

  test('empty / missing event → hold (never provision blind)', () => {
    expect(classifyStoreWebhook({}).decision).toBe('hold')
    expect(classifyStoreWebhook({ event: '' }).decision).toBe('hold')
    expect(classifyStoreWebhook({ event: '   ' }).decision).toBe('hold')
    expect(classifyStoreWebhook(null).decision).toBe('hold')
    expect(classifyStoreWebhook(undefined).decision).toBe('hold')
  })

  test('falls back to body.status when event is missing', () => {
    expect(classifyStoreWebhook({ status: 'confirmed' }).decision).toBe('fulfill')
    expect(classifyStoreWebhook({ status: 'pending' }).decision).toBe('hold')
    expect(classifyStoreWebhook({ status: 'failed' }).decision).toBe('fail')
  })

  test('case-insensitive + strips "payment." prefix', () => {
    expect(classifyStoreWebhook({ event: 'PAYMENT.CONFIRMED' }).decision).toBe('fulfill')
    expect(classifyStoreWebhook({ event: '  Confirmed  ' }).decision).toBe('fulfill')
    expect(classifyStoreWebhook({ event: 'Payment.Failed' }).decision).toBe('fail')
    expect(normalizeStatus('payment.Settled')).toBe('settled')
    expect(normalizeStatus('  PENDING ')).toBe('pending')
  })

  test('classification does NOT require any gateway call (the bug)', () => {
    // A confirmed webhook classifies as paid purely from the body — no network.
    const v = classifyStoreWebhook({ event: 'payment.confirmed', payment_id: 'x', meta_data: { refId: 'r' } })
    expect(v.paid).toBe(true)
    expect(v.decision).toBe('fulfill')
  })
})

describe('isStoreUnderpaid — 0.90 tolerance (unchanged)', () => {
  test('full / over payment → not underpaid', () => {
    expect(isStoreUnderpaid(100, 100)).toBe(false)
    expect(isStoreUnderpaid(200, 100)).toBe(false)
  })

  test('short by <=10% → NOT underpaid', () => {
    expect(isStoreUnderpaid(95, 100)).toBe(false)
    expect(isStoreUnderpaid(90, 100)).toBe(false)     // exactly 90% is accepted
    expect(isStoreUnderpaid(90.01, 100)).toBe(false)
  })

  test('short by >10% → underpaid', () => {
    expect(isStoreUnderpaid(89.99, 100)).toBe(true)
    expect(isStoreUnderpaid(50, 100)).toBe(true)
    expect(isStoreUnderpaid(0, 100)).toBe(true)
  })

  test('custom tolerance override works', () => {
    expect(isStoreUnderpaid(80, 100, 0.75)).toBe(false)
    expect(isStoreUnderpaid(70, 100, 0.75)).toBe(true)
  })

  test('non-finite paid / non-positive owed → not underpaid (fail-open)', () => {
    expect(isStoreUnderpaid(NaN, 100)).toBe(false)
    expect(isStoreUnderpaid('abc', 100)).toBe(false)
    expect(isStoreUnderpaid(50, 0)).toBe(false)
    expect(isStoreUnderpaid(50, -5)).toBe(false)
    expect(isStoreUnderpaid(50, NaN)).toBe(false)
  })
})
