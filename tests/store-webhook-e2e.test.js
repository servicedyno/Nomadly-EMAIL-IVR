/* global describe, test, expect, beforeEach, jest */
/**
 * End-to-end tests for the storefront crypto-webhook → hosting provisioning.
 *
 * FULLY MOCKED — no real domain registration, no real cPanel, no real gateway,
 * no real DB. Exercises the actual /store/crypto-webhook Express handler built
 * by createStoreRoutes(), driving it through an in-memory Mongo double.
 *
 * Reproduces the reported bug and verifies the fix:
 *   1. payment.confirmed with the DynoPay status endpoint UNREACHABLE  → PROVISIONS
 *   2. payment.confirmed but underpaid (< 90%)                          → order FAILED
 *   3. payment.pending                                                  → order HELD (stays pending)
 *   4. duplicate payment.confirmed                                      → provisions exactly ONCE (idempotent)
 *   +  gateway CONTRADICTS a paid webhook                               → still provisions + admin alert
 *   +  WHM-down (CPANEL_DOWN / queued) provisioning results            → committed as "provisioning", NEVER refunded
 *   +  novel "paid-like" event                                          → trusted & provisions (deny-list parity)
 *   +  payment.failed                                                   → order FAILED
 */

// ── Mock every external dependency so NOTHING real is touched ────────────────
jest.mock('../js/pay-dynopay', () => ({
  getDynopayCryptoAddress: jest.fn(),
  getDynopayCryptoPaymentStatus: jest.fn(),
}))
jest.mock('../js/pay-blockbee', () => ({
  getCryptoDepositAddress: jest.fn(),
  convert: jest.fn(),
}))
jest.mock('../js/cr-register-domain-&-create-cpanel.js', () => ({
  registerDomainAndCreateCpanel: jest.fn(),
}))

const { getDynopayCryptoPaymentStatus } = require('../js/pay-dynopay')
const { registerDomainAndCreateCpanel } = require('../js/cr-register-domain-&-create-cpanel.js')
const { createStoreRoutes } = require('../js/store-routes')

// ── Minimal in-memory Mongo double (only what the webhook path needs) ────────
function makeDb() {
  const store = {}
  const colMap = (n) => store[n] || (store[n] = new Map())
  const matches = (doc, q) => Object.keys(q).every((k) => {
    const cond = q[k]
    if (cond && typeof cond === 'object') {
      if ('$ne' in cond) return doc[k] !== cond.$ne
      if ('$gte' in cond) return Number(doc[k]) >= Number(cond.$gte)
    }
    return doc[k] === cond
  })
  const findDoc = (m, q) => { for (const d of m.values()) if (matches(d, q)) return d; return null }
  const applyUpd = (doc, upd) => {
    if (upd.$set) Object.assign(doc, upd.$set)
    if (upd.$inc) for (const k of Object.keys(upd.$inc)) doc[k] = (Number(doc[k]) || 0) + Number(upd.$inc[k])
  }
  const collection = (name) => {
    const m = colMap(name)
    return {
      async findOne(q) { const d = findDoc(m, q); return d ? { ...d } : null },
      async insertOne(doc) {
        if (doc._id != null && m.has(doc._id)) { const e = new Error('dup key'); e.code = 11000; throw e }
        const id = doc._id != null ? doc._id : Math.random().toString(36).slice(2)
        m.set(id, { ...doc, _id: id }); return { insertedId: id }
      },
      async updateOne(q, upd) { const d = findDoc(m, q); if (d) applyUpd(d, upd); return { matchedCount: d ? 1 : 0, modifiedCount: d ? 1 : 0 } },
      async findOneAndUpdate(q, upd) { const d = findDoc(m, q); if (!d) return { value: null }; applyUpd(d, upd); return { value: { ...d } } },
      find() { return { sort() { return this }, limit() { return this }, project() { return this }, toArray: async () => [...m.values()].map((d) => ({ ...d })) } },
    }
  }
  return { collection, _get: (name, id) => (store[name] ? store[name].get(id) : null) }
}

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this },
    send(b) { this.body = b; return this },
    json(o) { this.body = o; return this },
  }
}

function getWebhookHandler(routes) {
  const layer = routes.stack.find((l) => l.route && l.route.path === '/crypto-webhook' && l.route.methods && l.route.methods.post)
  if (!layer) throw new Error('POST /crypto-webhook route not found on router')
  const sub = layer.route.stack
  return sub[sub.length - 1].handle
}

let db
let routes
let adminAlerts

async function postWebhook(body) {
  const handler = getWebhookHandler(routes)
  const req = { body, hostname: 'test', originalUrl: '/store/crypto-webhook' }
  const res = mockRes()
  await handler(req, res)
  return res
}

function seedHostingOrder(id, overrides = {}) {
  return db.collection('webOrders').insertOne({
    _id: id,
    kind: 'hosting',
    status: 'pending',
    provider: 'dynopay',
    payAddress: 'addr_' + id,
    amountUsd: 75,
    plan: 'Golden Anti-Red',
    domain: `${id}.com`,
    domainMode: 'byo',
    // guest order (no webUserId) → no wallet side-effects to mock
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  adminAlerts = []
  db = makeDb()
  routes = createStoreRoutes({ getDb: () => db, notifyAdmin: (m) => adminAlerts.push(String(m)) })
})

describe('store crypto-webhook — provisioning parity with the bot', () => {
  test('1) payment.confirmed with gateway UNREACHABLE → PROVISIONS (the fix)', async () => {
    await seedHostingOrder('ordA', { amountUsd: 75 })
    // Storefront symptom: status endpoint 500s / "Application not found".
    getDynopayCryptoPaymentStatus.mockRejectedValue(new Error('Application not found'))
    registerDomainAndCreateCpanel.mockResolvedValue({ success: true, username: 'guestA', pin: '1234', nameservers: ['a.ns', 'b.ns'] })

    const res = await postWebhook({ event: 'payment.confirmed', base_amount: 75, fee_payer: 'company', payment_id: 'pidA', meta_data: { refId: 'ordA' } })

    expect(res.body).toBe('OK')
    expect(registerDomainAndCreateCpanel).toHaveBeenCalledTimes(1)
    const order = db._get('webOrders', 'ordA')
    expect(order.status).toBe('provisioned')
    expect(order.username).toBe('guestA')
  })

  test('gateway status CONTRADICTS a paid webhook → still provisions + admin alert (advisory-only)', async () => {
    await seedHostingOrder('ordA2')
    getDynopayCryptoPaymentStatus.mockResolvedValue({ status: 'failed' }) // positively contradicts
    registerDomainAndCreateCpanel.mockResolvedValue({ success: true, username: 'guestA2', pin: '9', nameservers: [] })

    const res = await postWebhook({ event: 'payment.confirmed', base_amount: 75, fee_payer: 'company', payment_id: 'pidA2', meta_data: { refId: 'ordA2' } })

    expect(res.body).toBe('OK')
    expect(registerDomainAndCreateCpanel).toHaveBeenCalledTimes(1)
    const order = db._get('webOrders', 'ordA2')
    expect(order.status).toBe('provisioned')
    expect(order.unverifiedFulfill).toBe(true)
    expect(adminAlerts.some((a) => /UNVERIFIED/i.test(a))).toBe(true)
  })

  test('2) payment.confirmed but UNDERPAID (<90%) → order FAILED, never provisioned', async () => {
    await seedHostingOrder('ordB', { amountUsd: 100 })
    getDynopayCryptoPaymentStatus.mockResolvedValue({ status: 'confirmed' })
    registerDomainAndCreateCpanel.mockResolvedValue({ success: true, username: 'should-not-happen' })

    const res = await postWebhook({ event: 'payment.confirmed', base_amount: 50, fee_payer: 'company', payment_id: 'pidB', meta_data: { refId: 'ordB' } })

    expect(res.body).toBe('OK')
    expect(registerDomainAndCreateCpanel).not.toHaveBeenCalled()
    const order = db._get('webOrders', 'ordB')
    expect(order.status).toBe('failed')
    expect(order.note).toBe('underpaid')
  })

  test('3) payment.pending → order HELD (stays pending), maps payment_id, no gateway/provision calls', async () => {
    await seedHostingOrder('ordC')
    const res = await postWebhook({ event: 'payment.pending', payment_id: 'pidC', meta_data: { refId: 'ordC' } })

    expect(res.body).toBe('OK')
    expect(registerDomainAndCreateCpanel).not.toHaveBeenCalled()
    expect(getDynopayCryptoPaymentStatus).not.toHaveBeenCalled()
    const order = db._get('webOrders', 'ordC')
    expect(order.status).toBe('pending')
    expect(order.paymentId).toBe('pidC')
  })

  test('4) duplicate payment.confirmed → provisions exactly ONCE (idempotent)', async () => {
    await seedHostingOrder('ordD')
    getDynopayCryptoPaymentStatus.mockResolvedValue({ status: 'confirmed' })
    registerDomainAndCreateCpanel.mockResolvedValue({ success: true, username: 'guestD', pin: '1', nameservers: [] })
    const body = { event: 'payment.confirmed', base_amount: 75, fee_payer: 'company', payment_id: 'pidD', meta_data: { refId: 'ordD' } }

    const r1 = await postWebhook(body)
    const r2 = await postWebhook(body)

    expect(r1.body).toBe('OK')
    expect(r2.body).toBe('OK')
    expect(registerDomainAndCreateCpanel).toHaveBeenCalledTimes(1)
    expect(db._get('webOrders', 'ordD').status).toBe('provisioned')
  })

  test('WHM-down deferred {success:false,queued,deferred,CPANEL_DOWN} → "provisioning", NEVER failed/refunded', async () => {
    await seedHostingOrder('ordE', { domainMode: 'buy' })
    getDynopayCryptoPaymentStatus.mockResolvedValue({ status: 'confirmed' })
    registerDomainAndCreateCpanel.mockResolvedValue({ success: false, queued: true, deferred: true, code: 'CPANEL_DOWN', domainRegistered: true })

    const res = await postWebhook({ event: 'payment.confirmed', base_amount: 75, fee_payer: 'company', payment_id: 'pidE', meta_data: { refId: 'ordE' } })

    expect(res.body).toBe('OK')
    expect(registerDomainAndCreateCpanel).toHaveBeenCalledTimes(1)
    const order = db._get('webOrders', 'ordE')
    expect(order.status).toBe('provisioning')
    expect(order.status).not.toBe('failed')
    expect(adminAlerts.some((a) => /QUEUED/i.test(a))).toBe(true)
  })

  test('WHM-down preflight {success:true,queued:true} → "provisioning" (no fail/refund)', async () => {
    await seedHostingOrder('ordE2')
    getDynopayCryptoPaymentStatus.mockResolvedValue({ status: 'confirmed' })
    registerDomainAndCreateCpanel.mockResolvedValue({ success: true, queued: true })

    await postWebhook({ event: 'payment.confirmed', base_amount: 75, fee_payer: 'company', payment_id: 'pidE2', meta_data: { refId: 'ordE2' } })

    expect(db._get('webOrders', 'ordE2').status).toBe('provisioning')
  })

  test('novel "paid-like" event is TRUSTED and provisions (deny-list parity)', async () => {
    await seedHostingOrder('ordF')
    getDynopayCryptoPaymentStatus.mockRejectedValue(new Error('unreachable'))
    registerDomainAndCreateCpanel.mockResolvedValue({ success: true, username: 'guestF', pin: '1', nameservers: [] })

    await postWebhook({ event: 'payment.settled', base_amount: 75, fee_payer: 'company', payment_id: 'pidF', meta_data: { refId: 'ordF' } })

    expect(db._get('webOrders', 'ordF').status).toBe('provisioned')
  })

  test('payment.failed → order marked FAILED, no provisioning', async () => {
    await seedHostingOrder('ordG')
    const res = await postWebhook({ event: 'payment.failed', payment_id: 'pidG', meta_data: { refId: 'ordG' } })

    expect(res.body).toBe('OK')
    expect(registerDomainAndCreateCpanel).not.toHaveBeenCalled()
    expect(db._get('webOrders', 'ordG').status).toBe('failed')
  })
})
