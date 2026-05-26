/**
 * Tests for js/sanitize-provider.js
 *
 * Real-prod regression: 2026-05-26 Railway log showed users seeing
 * "support.registrar.eu/..." URLs (broken) because OpenProvider error
 * messages contained "support.openprovider.eu" URLs that got mangled by
 * the OpenProvider→registrar string substitution. These tests make sure
 * that does NOT happen anymore, and that no provider URL/hostname/name
 * (Twilio, Telnyx, OpenProvider, ConnectReseller) can leak to users.
 *
 * Run:  node js/__tests__/sanitize-provider.test.js
 */
const { sanitizeProviderError, sanitizeHangupCause } = require('../sanitize-provider.js')

// ── Patterns that MUST NOT appear in any sanitized output ──
const FORBIDDEN_PATTERNS = [
  /support\.registrar\.eu/i,
  /registrar\.eu\//i,
  /openprovider\./i,
  /connectreseller\./i,
  /telnyx\./i,
  /twilio\.com/i,
  /https?:\/\//i, // no full URLs ever
  /\b(?:OpenProvider|Telnyx|Twilio|ConnectReseller|Connect Reseller)\b/, // no brand names
]

// ── Test cases (each must be cleaned) ──
const CASES = [
  // The original 2026-05-26 prod incident
  'Failed to update nameservers (see https://support.openprovider.eu/hc/en-us/articles/12345) please retry',
  // Post-substitution defensive
  'Server returned 500 (see https://support.registrar.eu/issue/42).',
  // Bare hostname
  'api.openprovider.eu returned 500',
  // Subdomain
  'Got error from https://api.openprovider.eu/v1beta/domains/123',
  // ConnectReseller URL
  'Help: https://www.connectreseller.com/help/123 for more',
  // Provider nameserver hostnames
  'ns1.openprovider.nl is unreachable',
  'ns2.openprovider.be timed out and ns3.openprovider.eu refused',
  // Voice providers
  'Visit https://www.twilio.com/console/sms for help',
  'See https://api.telnyx.com/v2/messages',
  // Multiple URLs
  'Both https://support.openprovider.eu/x and https://api.openprovider.eu/y failed',
  // Name only
  'OpenProvider API timeout',
  // Generic — should be unchanged but never trigger forbidden patterns
  'Domain not available',
  // URL at end
  'Failed. See https://support.openprovider.eu/abc',
  // ConnectReseller variant
  'Connect Reseller returned: https://www.connectreseller.com/admin/issue',
  // Axios-style error
  'Request failed with status code 500 https://api.openprovider.eu/v1beta/domains/4567',
  // German TLD
  'Cannot reach https://api.openprovider.de or api.openprovider.eu',
  // Subdomain on .eu
  'Authentication failed at https://login.openprovider.eu/auth/v1',
  // Twilio SID redaction
  'Twilio Account AC1234567890abcdef1234567890abcdef cannot purchase',
  // ConnectReseller mixed
  'Error from ConnectReseller: please contact https://www.connectreseller.com/contact',
  // Bare CR hostname
  'Got 502 from api.connectreseller.com',
  // Docs URL
  'Visit our docs at https://docs.openprovider.eu/api for examples',
  // openprovider.de root
  'https://www.openprovider.de says nope',
  // Pre + post substitution forms
  'Please retry. Help: https://support.registrar.eu/abc and registrar.eu/x',
  // Empty / undefined / non-string
  '',
  null,
  undefined,
]

let pass = 0
let fail = 0
const failures = []

for (const input of CASES) {
  const out = sanitizeProviderError(input, 'domain')
  // Always returns a string
  if (typeof out !== 'string') {
    fail++
    failures.push({ input, out, reason: 'non-string output' })
    continue
  }
  // No forbidden patterns
  const matched = FORBIDDEN_PATTERNS.find(p => p.test(out))
  if (matched) {
    fail++
    failures.push({ input, out, reason: 'forbidden pattern: ' + matched })
    continue
  }
  pass++
}

// sanitizeHangupCause should never leak either
const HANGUP_CASES = [
  'Not yet verified for your account on https://www.twilio.com/console',
  'rate limit at api.telnyx.com',
  'rejected (see https://support.openprovider.eu/hc/articles/123)',
]
for (const input of HANGUP_CASES) {
  const out = sanitizeHangupCause(input)
  const matched = FORBIDDEN_PATTERNS.find(p => p.test(out))
  if (matched) {
    fail++
    failures.push({ input, out, reason: 'hangup leak: ' + matched })
    continue
  }
  pass++
}

console.log(`sanitize-provider tests: ${pass} pass, ${fail} fail`)
if (fail > 0) {
  console.error('FAILURES:')
  for (const f of failures) {
    console.error('  IN:  ', JSON.stringify(f.input))
    console.error('  OUT: ', JSON.stringify(f.out))
    console.error('  REASON:', f.reason)
  }
  process.exit(1)
}
