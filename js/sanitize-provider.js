// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Provider Name Sanitizer — strips API provider names from user-facing messages
// Replaces Twilio, Telnyx, OpenProvider, ConnectReseller with user-friendly alternatives
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Sanitize an error message to remove API provider names.
 * Used for ALL user-facing error messages to prevent provider name leaks.
 *
 * @param {string} msg - The raw error message
 * @param {string} [context='generic'] - Context: 'voice', 'domain', 'sms', 'generic'
 * @returns {string} Sanitized message safe for user display
 */
function sanitizeProviderError(msg, context = 'generic') {
  if (!msg || typeof msg !== 'string') return msg || 'An error occurred'

  let sanitized = msg

  // ── FIX: HTML entity escaping ──
  // Cloudflare error messages contain URLs like <https://...> which break Telegram HTML parse mode.
  // Escape < > & to prevent "Unsupported start tag" errors from Telegram.
  sanitized = sanitized.replace(/&/g, '&amp;')
  sanitized = sanitized.replace(/</g, '&lt;')
  sanitized = sanitized.replace(/>/g, '&gt;')

  // ── Voice/Call provider names ──
  sanitized = sanitized.replace(/\bTwilio\b/gi, 'Speechcue')
  sanitized = sanitized.replace(/\bTelnyx\b/gi, 'Speechcue')

  // ── Domain registrar names ──
  sanitized = sanitized.replace(/\bOpenProvider\b/gi, 'registrar')
  sanitized = sanitized.replace(/\bConnectReseller\b/gi, 'registrar')
  sanitized = sanitized.replace(/\bConnect Reseller\b/gi, 'registrar')
  // Abbreviations sometimes used internally
  sanitized = sanitized.replace(/\bOP\s+(API|service|error|domain)/gi, 'registrar $1')
  sanitized = sanitized.replace(/\bCR\s+(API|service|error|domain)/gi, 'registrar $1')

  // ── Strip internal API paths / account identifiers ──
  // Twilio account paths like /2010-04-01/Accounts/AC.../
  sanitized = sanitized.replace(/\/\d{4}-\d{2}-\d{2}\/Accounts\/AC[a-f0-9]+\/[^\s]*/gi, '[internal]')
  // Twilio SIDs (AC..., PN..., etc.)
  sanitized = sanitized.replace(/\b(AC|PN|SK|CL|SD|CR)[a-f0-9]{32}\b/gi, '[redacted]')
  // Telnyx UUIDs in error messages
  sanitized = sanitized.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[ref]')

  // ── Strip "purchased from Twilio/Telnyx" patterns ──
  sanitized = sanitized.replace(/you've verified or purchased from Speechcue/gi, 'you own or have verified')
  sanitized = sanitized.replace(/purchased from Speechcue/gi, 'purchased')
  sanitized = sanitized.replace(/verified for your account/gi, 'verified for your account')

  // ── Clean up double spaces and trailing dots ──
  sanitized = sanitized.replace(/\s{2,}/g, ' ').trim()

  return sanitized
}

/**
 * Sanitize a hangup cause for user display in campaign progress.
 * Returns a short, user-friendly reason.
 */
function sanitizeHangupCause(cause) {
  if (!cause || typeof cause !== 'string') return 'Unknown error'

  const lower = cause.toLowerCase()

  // Map known Twilio/Telnyx error patterns to friendly messages
  if (lower.includes('not yet verified') || lower.includes('not verified')) {
    return 'Caller ID not verified for this account'
  }
  if (lower.includes('blacklisted') || lower.includes('blocked')) {
    return 'Number is blocked or blacklisted'
  }
  if (lower.includes('invalid phone') || lower.includes('invalid number') || lower.includes('not a valid phone')) {
    return 'Invalid phone number'
  }
  if (lower.includes('insufficient') || lower.includes('balance')) {
    return 'Insufficient account balance'
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Rate limit reached — try again later'
  }
  if (lower.includes('unreachable') || lower.includes('not reachable')) {
    return 'Number not reachable'
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'Call timed out'
  }
  if (lower.includes('rejected') || lower.includes('declined')) {
    return 'Call was rejected'
  }
  if (lower.includes('network') || lower.includes('connectivity')) {
    return 'Network error'
  }
  if (lower.includes('permission') || lower.includes('not allowed') || lower.includes('geo permission')) {
    return 'Calling this destination is not permitted'
  }

  // Fallback: sanitize the raw message
  return sanitizeProviderError(cause, 'voice')
}

module.exports = {
  sanitizeProviderError,
  sanitizeHangupCause,
}
