/**
 * Tiny logger wrapper — gives every module a consistent "[Label]" prefix
 * and a single chokepoint for future JSON-log / Sentry / Datadog wiring.
 *
 * Use from any module:
 *   const log = require('./logger').for('Wallet')
 *   log.info('credited', { chatId, amount })
 *   log.warn('low balance', { chatId })
 *   log.error('credit failed', { err: err.message })
 *
 * Or for legacy code that already does `console.log(...)`:
 *   const { silentCatch } = require('./logger')
 *   try { await x() } catch (e) { silentCatch('label')(e) }
 *
 * Output (today): plain text to stdout. Switch to JSON later by flipping ONE flag.
 */
const JSON_LOGS = process.env.JSON_LOGS === '1'

function _emit(level, label, msg, extra) {
  const ts = new Date().toISOString()
  if (JSON_LOGS) {
    const rec = { ts, level, label, msg, ...(extra || {}) }
    console.log(JSON.stringify(rec))
    return
  }
  const xtra = extra ? ' ' + JSON.stringify(extra) : ''
  console.log(`${ts} [${label}] ${level.toUpperCase()} ${msg}${xtra}`)
}

function forLabel(label) {
  return {
    info: (msg, extra) => _emit('info', label, msg, extra),
    warn: (msg, extra) => _emit('warn', label, msg, extra),
    error: (msg, extra) => _emit('error', label, msg, extra),
    debug: (msg, extra) => process.env.DEBUG_LOG === '1' && _emit('debug', label, msg, extra),
  }
}

/**
 * Replacement for silent catches (catch with ignore) — keeps the silent-by-default
 * behaviour but at least records the error rate per label.
 */
function silentCatch(label) {
  return (err) => {
    _emit('warn', `SilentCatch:${label}`, err?.message || String(err || ''))
  }
}

/**
 * Bind global handlers for unhandled rejections and uncaught exceptions.
 * Call once on bot start.
 */
function bindGlobalHandlers() {
  process.on('unhandledRejection', (reason, promise) => {
    _emit('error', 'UnhandledRejection', String(reason?.message || reason || 'unknown'), {
      stack: reason?.stack?.split('\n').slice(0, 5).join(' | ') || null,
    })
  })
  process.on('uncaughtException', (err) => {
    _emit('error', 'UncaughtException', err?.message || String(err), {
      stack: err?.stack?.split('\n').slice(0, 5).join(' | ') || null,
    })
    // Don't exit — let the process keep serving other users.  Railway will
    // restart anyway on the next deploy if this is a persistent crash.
  })
}

module.exports = { for: forLabel, silentCatch, bindGlobalHandlers }
