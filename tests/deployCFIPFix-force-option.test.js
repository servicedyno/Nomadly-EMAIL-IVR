/* global describe, test, expect, jest, beforeEach, afterEach */
/**
 * Tests for the deployCFIPFix `force` option (added 2026-06-23).
 *
 * Background: protection-heartbeat repairs a stuck account by calling
 * deployCFIPFix. Without `force`, the idempotency cache (signature +
 * 7-day window) would short-circuit the write, telling the heartbeat
 * "deployed" while WHM actually still has the customer's overwrite.
 * Three such cached-skip "repairs" trigger the STUCK admin alert
 * every 6h while the customer site stays down.
 *
 * Confirms: `{ force: true }` bypasses the cache; default behaviour is
 * unchanged (still skips when the same payload was deployed recently).
 */
const path = require('path')

// Mock the WHM axios instance + MongoDB client BEFORE requiring the module.
const mockWhmGet = jest.fn().mockResolvedValue({ data: { metadata: { result: 1 } } })
jest.mock('axios', () => ({
  create: () => ({ get: mockWhmGet, post: jest.fn() }),
}))

let storedSig = null
let storedAt = null
const mockFindOne = jest.fn(async () => ({
  cpUser: 'testuser',
  lastCfIpFixSig: storedSig,
  lastCfIpFixAt: storedAt,
}))
const mockUpdateOne = jest.fn(async () => ({ acknowledged: true }))
jest.mock('mongodb', () => ({
  MongoClient: class {
    connect() { return Promise.resolve() }
    close() { return Promise.resolve() }
    db() {
      return {
        collection: () => ({
          findOne: mockFindOne,
          updateOne: mockUpdateOne,
        }),
      }
    }
  },
}))

process.env.WHM_HOST = 'whm.test'
process.env.WHM_TOKEN = 'token'
process.env.MONGO_URL = 'mongodb://test/test'
process.env.DB_NAME = 'test'

// Require AFTER mocks are installed
const antiRed = require(path.join(__dirname, '..', 'js', 'anti-red-service.js'))

describe('deployCFIPFix — force option (heartbeat repair-loop fix)', () => {
  beforeEach(() => {
    mockWhmGet.mockClear()
    mockFindOne.mockClear()
    mockUpdateOne.mockClear()
    storedSig = null
    storedAt = null
  })

  test('without force: first deploy writes to WHM', async () => {
    const res = await antiRed.deployCFIPFix('testuser')
    expect(res.success).toBe(true)
    expect(res.skipped).toBeUndefined()
    // 2 WHM writes (challenge.php + .user.ini)
    expect(mockWhmGet).toHaveBeenCalledTimes(2)
    expect(mockUpdateOne).toHaveBeenCalledTimes(1) // sig stamp
  })

  test('without force: SAME payload deployed within 7d → SKIP (idempotency working)', async () => {
    // Pretend we already deployed this exact content yesterday
    storedSig = 'will be computed from same content' // will need to match — easier to deploy once then call again
    // First call to populate the stored sig naturally
    await antiRed.deployCFIPFix('testuser')
    const sigStamped = mockUpdateOne.mock.calls[0][0]
    storedSig = mockUpdateOne.mock.calls[0][1].$set.lastCfIpFixSig
    storedAt = mockUpdateOne.mock.calls[0][1].$set.lastCfIpFixAt
    mockWhmGet.mockClear()
    mockUpdateOne.mockClear()

    // Second call WITHOUT force — should skip
    const res = await antiRed.deployCFIPFix('testuser')
    expect(res.success).toBe(true)
    expect(res.skipped).toBe('unchanged')
    expect(mockWhmGet).not.toHaveBeenCalled()
    expect(mockUpdateOne).not.toHaveBeenCalled()
  })

  test('WITH force: SAME payload still WRITES to WHM (the heartbeat path)', async () => {
    // Populate the cache first
    await antiRed.deployCFIPFix('testuser')
    storedSig = mockUpdateOne.mock.calls[0][1].$set.lastCfIpFixSig
    storedAt = mockUpdateOne.mock.calls[0][1].$set.lastCfIpFixAt
    mockWhmGet.mockClear()
    mockUpdateOne.mockClear()

    // Call WITH force — must NOT skip
    const res = await antiRed.deployCFIPFix('testuser', { force: true })
    expect(res.success).toBe(true)
    expect(res.skipped).toBeUndefined()
    expect(mockWhmGet).toHaveBeenCalledTimes(2)
    expect(mockUpdateOne).toHaveBeenCalledTimes(1) // sig restamp
  })

  test('force: false explicitly still uses cache', async () => {
    await antiRed.deployCFIPFix('testuser')
    storedSig = mockUpdateOne.mock.calls[0][1].$set.lastCfIpFixSig
    storedAt = mockUpdateOne.mock.calls[0][1].$set.lastCfIpFixAt
    mockWhmGet.mockClear()

    const res = await antiRed.deployCFIPFix('testuser', { force: false })
    expect(res.skipped).toBe('unchanged')
    expect(mockWhmGet).not.toHaveBeenCalled()
  })

  test('opts undefined behaves like no-force (default)', async () => {
    await antiRed.deployCFIPFix('testuser')
    storedSig = mockUpdateOne.mock.calls[0][1].$set.lastCfIpFixSig
    storedAt = mockUpdateOne.mock.calls[0][1].$set.lastCfIpFixAt
    mockWhmGet.mockClear()

    const res = await antiRed.deployCFIPFix('testuser', undefined)
    expect(res.skipped).toBe('unchanged')
    expect(mockWhmGet).not.toHaveBeenCalled()
  })
})
