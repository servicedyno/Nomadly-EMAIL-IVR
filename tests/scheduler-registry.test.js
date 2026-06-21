/**
 * Sanity test for /app/js/scheduler-registry.js.
 * Verifies the registry tracks timers, prevents overlap, and stopAll() clears them.
 */
const sched = require('../js/scheduler-registry.js')

describe('scheduler-registry', () => {
  afterEach(() => sched.stopAll())

  test('every() registers an interval visible in snapshot()', () => {
    sched.every('test-interval-A', 1000, () => {})
    const snap = sched.snapshot()
    expect(snap.intervals.some(i => i.label === 'test-interval-A')).toBe(true)
  })

  test('after() registers a timeout visible in snapshot()', () => {
    sched.after('test-timeout-A', 999_999, () => {})
    const snap = sched.snapshot()
    expect(snap.timeouts).toContain('test-timeout-A')
  })

  test('stopAll() clears all registered timers', () => {
    sched.every('test-1', 1000, () => {})
    sched.every('test-2', 1000, () => {})
    sched.after('test-3', 999_999, () => {})
    sched.stopAll()
    const snap = sched.snapshot()
    expect(snap.intervals).toHaveLength(0)
    expect(snap.timeouts).toHaveLength(0)
  })

  test('previous interval is replaced if same label re-registered', () => {
    let count = 0
    sched.every('dup-label', 1000, () => { count = 1 })
    sched.every('dup-label', 1000, () => { count = 2 })
    const snap = sched.snapshot()
    expect(snap.intervals.filter(i => i.label === 'dup-label')).toHaveLength(1)
  })

  test('errors in tick increment errCount but do not stop the schedule', async () => {
    sched.every('errs', 50, async () => { throw new Error('expected') })
    await new Promise(r => setTimeout(r, 200))
    const snap = sched.snapshot()
    const entry = snap.intervals.find(i => i.label === 'errs')
    expect(entry.errCount).toBeGreaterThan(0)
  })
})
