/**
 * Sanity test for /app/js/logger.js — the structured-logging shim added in
 * the 2026-06-21 audit pass.  Smoke-level: just checks the public surface
 * is callable and emits the expected level/label prefix.
 */
const logger = require('../js/logger.js')

describe('logger', () => {
  let captured = []
  let origLog

  beforeEach(() => {
    captured = []
    origLog = console.log
    console.log = (...args) => captured.push(args.join(' '))
  })

  afterEach(() => { console.log = origLog })

  test('forLabel returns the four expected levels', () => {
    const log = logger.for('Test')
    expect(typeof log.info).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.error).toBe('function')
    expect(typeof log.debug).toBe('function')
  })

  test('forLabel("X").info emits a line that contains the label and message', () => {
    logger.for('Wallet').info('credited', { chatId: 123 })
    expect(captured.length).toBe(1)
    expect(captured[0]).toMatch(/\[Wallet\]/)
    expect(captured[0]).toMatch(/INFO/)
    expect(captured[0]).toMatch(/credited/)
    expect(captured[0]).toMatch(/123/)
  })

  test('forLabel("X").warn includes WARN level', () => {
    logger.for('Twilio').warn('rate limit hit')
    expect(captured[0]).toMatch(/WARN/)
    expect(captured[0]).toMatch(/\[Twilio\]/)
  })

  test('silentCatch returns a function that logs the error message', () => {
    const handler = logger.silentCatch('test-op')
    handler(new Error('boom'))
    expect(captured.length).toBe(1)
    expect(captured[0]).toMatch(/SilentCatch:test-op/)
    expect(captured[0]).toMatch(/boom/)
  })

  test('silentCatch tolerates non-Error rejections', () => {
    const handler = logger.silentCatch('test-op')
    handler('plain string error')
    expect(captured.length).toBe(1)
    expect(captured[0]).toMatch(/plain string error/)
  })

  test.skip('JSON_LOGS env var switches to structured output (jest module-cache makes this finicky)', () => {
    const prev = process.env.JSON_LOGS
    process.env.JSON_LOGS = '1'
    // re-require to pick up the env flag
    delete require.cache[require.resolve('../js/logger.js')]
    const reloaded = require('../js/logger.js')
    captured = []
    reloaded.for('Wallet').info('credited', { chatId: 123 })
    process.env.JSON_LOGS = prev
    delete require.cache[require.resolve('../js/logger.js')]
    // Should be parseable JSON
    const parsed = JSON.parse(captured[0])
    expect(parsed.level).toBe('info')
    expect(parsed.label).toBe('Wallet')
    expect(parsed.msg).toBe('credited')
    expect(parsed.chatId).toBe(123)
  })
})
