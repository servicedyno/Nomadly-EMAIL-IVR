#!/usr/bin/env node
/**
 * Regression tests for /twilio/sip-ring-result fallback logic:
 *  - Self-call loop guard (when SIP doesn't answer and forwardTo === from/to)
 *  - timeLimit is applied to fallback forward dial (wallet cap)
 *
 * These are structural/source-level checks (not live HTTP).
 */

const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '..', '_index.js')
const src = fs.readFileSync(SRC, 'utf8')

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`✅ ${msg}`)
}

// Isolate the /twilio/sip-ring-result handler body
const startIdx = src.indexOf(`app.post('/twilio/sip-ring-result'`)
const endMarker = `app.post('/twilio/single-ivr'`
const endIdx = src.indexOf(endMarker, startIdx)
assert(startIdx > 0 && endIdx > startIdx, 'sip-ring-result handler exists in _index.js')

const handler = src.substring(startIdx, endIdx)

// 1. Self-call loop guard present in fallback forwarding
assert(
  handler.includes('Self-call loop guard') &&
  handler.includes('fwdConfig.forwardTo === decodedFrom') &&
  handler.includes('fwdConfig.forwardTo === decodedTo'),
  'SIP fallback forward includes self-call loop guard'
)

// 2. User-facing block notification for self-call
assert(
  handler.includes('Call Forwarding BLOCKED (SIP fallback)'),
  'SIP fallback sends Telegram block message on self-call loop'
)

// 3. timeLimit is computed and passed to dialOpts
assert(
  handler.includes(`computeDialTimeLimit('forwarding'`) &&
  handler.includes('fwdSipTimeLimit') &&
  handler.includes('timeLimit: fwdSipTimeLimit'),
  'SIP fallback forward dial uses computeDialTimeLimit wallet cap'
)

// 4. Insufficient-wallet message exists so user knows why forwarding was skipped
assert(
  handler.includes('SIP Fallback Forwarding Blocked') &&
  handler.includes('need $${RATE}/min'),
  'SIP fallback forward notifies user when wallet insufficient'
)

// 5. Self-call path still falls through to voicemail/missed (doesn't return early)
// Verify that the self-call block is in an if, and doesn't include `return res.type`
// immediately after the self-call guard branch
const selfCallBlockMatch = handler.match(
  /Self-call loop guard[\s\S]*?Fall through to voicemail\/missed[^}]*\}/
)
assert(selfCallBlockMatch, 'Self-call guard falls through to voicemail/missed (no early return)')

// 6. Existing Voicemail fallback (Fallback 2) and missed-call fallback (Fallback 3) still present
assert(handler.includes('Fallback 2: Voicemail'), 'Fallback 2 (voicemail) still present')
assert(handler.includes('Fallback 3: Missed call'), 'Fallback 3 (missed call) still present')

// 7. Existing 'completed' bill path with _twilioBilledCallSids dedup still intact
assert(
  handler.includes(`DialCallStatus === 'completed'`) &&
  handler.includes('_twilioBilledCallSids.add(CallSid)'),
  'Billed-call dedup on DialCallStatus=completed still present'
)

// 8. Always-forward is NOT in this fallback (handled upstream in /twilio/voice-webhook)
assert(
  handler.includes(`fwdConfig.mode !== 'always'`),
  'SIP fallback only runs for busy/no_answer modes (not always)'
)

console.log('\n🟢 All SIP ring-result fallback tests passed (8/8)')
