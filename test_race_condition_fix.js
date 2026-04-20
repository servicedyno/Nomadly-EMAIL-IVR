/**
 * Test for the race condition fix in handleOutboundIvrHangup() — js/voice-service.js
 *
 * Bug: session.phase was set to 'ended' BEFORE downstream code read it, so all
 *      downstream checks (callWasAnswered, notifType determination) saw 'ended'
 *      instead of the actual phase the call was in (ringing/initiated/playing/...).
 *      → Failed/unanswered Telnyx trial calls were billed 1 min as if answered
 *      → Notification type was always 'hangup' instead of no_answer/busy/completed/etc.
 *
 * Fix: capture `previousPhase = session.phase` BEFORE markCallEnded()/session.phase = 'ended',
 *      then use previousPhase for all downstream classification.
 *
 * This test loads voice-service.js into the same Node process, injects a fake
 * outbound IVR session, fires a synthetic Telnyx call.hangup webhook, and
 * inspects the [OutboundIVR] Hangup log line to verify correct billing and
 * notification classification.
 */

require('dotenv').config()

// Capture log output (the module uses both console.log and a custom log() that
// goes to stdout). We monkey-patch process.stdout.write to capture everything.
const originalWrite = process.stdout.write.bind(process.stdout)
const captured = []
process.stdout.write = (chunk, ...args) => {
  try { captured.push(chunk.toString()) } catch (e) {}
  return originalWrite(chunk, ...args)
}

const voice = require('./js/voice-service.js')
const { outboundIvrCalls, handleVoiceWebhook } = voice

function makeReqRes(eventType, payload) {
  return [
    { body: { data: { event_type: eventType, payload } } },
    { sendStatus: () => {}, status: () => ({ send: () => {} }), send: () => {} }
  ]
}

function recentLogs() {
  const text = captured.join('')
  captured.length = 0
  return text
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function runScenario({ name, phase, hangupCause, isTrial, expectBilledMin, expectNotBilledTag, expectedPhaseTag }) {
  const ccid = `test-ccid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // Inject fake session — simulating an in-flight outbound IVR call in the given phase
  outboundIvrCalls[ccid] = {
    chatId: '999999999',
    callerId: '+15559990000',           // would-be source number
    targetNumber: '+15551234567',        // would-be destination
    voiceName: 'alloy',
    phase,                               // <-- the key field under test
    answerTime: phase === 'ringing' || phase === 'initiated' ? null : Date.now() - 5000,
    isTrial: isTrial === true,           // skip billing path for trial
    digitPressed: null,
    bulkMode: null,
    campaignId: null,
  }

  // Send call.hangup with `to: 'gencred-test'` so the webhook bypasses
  // event buffering (lines 1719-1731 in voice-service.js).
  recentLogs() // clear
  const [req, res] = makeReqRes('call.hangup', {
    call_control_id: ccid,
    call_leg_id: ccid,
    to: 'gencred-test-bypass-buffer',
    from: '+15559990000',
    direction: 'outgoing',
    state: 'hangup',
    hangup_cause: hangupCause,
    hangup_source: 'callee',
    duration_secs: phase === 'ringing' || phase === 'initiated' ? 0 : 5,
  })

  await handleVoiceWebhook(req, res)
  await wait(150) // let the async chain run

  const logs = recentLogs()

  // Find the `[OutboundIVR] Hangup:` log line
  const hangupLine = (logs.match(/\[OutboundIVR\] Hangup:[^\n]+/) || [])[0] || ''

  // Assertions
  let pass = true
  const errs = []

  if (!hangupLine) {
    pass = false
    errs.push('Did not find [OutboundIVR] Hangup log line')
  } else {
    // Check minutesBilled appears as expected
    const minMatch = hangupLine.match(/(\d+)\s+min,\s+cause:/)
    const billedMin = minMatch ? parseInt(minMatch[1], 10) : null
    if (billedMin !== expectBilledMin) {
      pass = false
      errs.push(`Expected ${expectBilledMin} min billed, got ${billedMin} (line: ${hangupLine})`)
    }

    if (expectNotBilledTag) {
      if (!hangupLine.includes('NOT BILLED')) {
        pass = false
        errs.push(`Expected "NOT BILLED, call failed" tag in log, missing (line: ${hangupLine})`)
      }
    } else {
      if (hangupLine.includes('NOT BILLED')) {
        pass = false
        errs.push(`Did NOT expect "NOT BILLED" tag, but found one (line: ${hangupLine})`)
      }
    }
  }

  // Cleanup
  delete outboundIvrCalls[ccid]

  console.log(`\n──────────── ${name} ────────────`)
  console.log(`  phase=${phase}, hangup_cause=${hangupCause}, isTrial=${!!isTrial}`)
  console.log(`  expected: billed=${expectBilledMin}min${expectNotBilledTag ? ', NOT BILLED tag' : ''}`)
  console.log(`  log line: ${hangupLine || '(none)'}`)
  console.log(`  result:   ${pass ? '✅ PASS' : '❌ FAIL'}`)
  if (!pass) errs.forEach(e => console.log(`    - ${e}`))
  return { name, pass, errs, hangupLine }
}

;(async () => {
  console.log('='.repeat(70))
  console.log('  RACE CONDITION FIX TEST — handleOutboundIvrHangup()')
  console.log('='.repeat(70))

  // Wait for module init
  await wait(800)

  const results = []

  // --- Critical scenarios that prove the fix ---
  // 1) Telnyx trial call that never connected (rang only) and was rejected
  //    BEFORE FIX: session.phase='ended' at check time → callWasAnswered=true →
  //                isFailedCall=false → minutesBilled=1 (incorrectly billed!)
  //    AFTER  FIX: previousPhase='ringing' → callWasAnswered=false →
  //                isFailedCall=true → minutesBilled=0 (correctly NOT billed)
  results.push(await runScenario({
    name: 'TRIAL CALL — never answered (ringing → call_rejected)',
    phase: 'ringing',
    hangupCause: 'call_rejected',
    isTrial: true,
    expectBilledMin: 0,
    expectNotBilledTag: true,
  }))

  // 2) Trial call with network failure during ringing
  results.push(await runScenario({
    name: 'TRIAL CALL — network failure (ringing → network_failure)',
    phase: 'ringing',
    hangupCause: 'network_failure',
    isTrial: true,
    expectBilledMin: 0,
    expectNotBilledTag: true,
  }))

  // 3) Trial call to unallocated number (initiated phase)
  results.push(await runScenario({
    name: 'TRIAL CALL — unallocated number (initiated → unallocated_number)',
    phase: 'initiated',
    hangupCause: 'unallocated_number',
    isTrial: true,
    expectBilledMin: 0,
    expectNotBilledTag: true,
  }))

  // 4) Trial call that DID get answered then hung up (playing) → must STILL be billed
  results.push(await runScenario({
    name: 'TRIAL CALL — answered then hung up (playing → normal_clearing)',
    phase: 'playing',
    hangupCause: 'normal_clearing',
    isTrial: true,
    expectBilledMin: 1,
    expectNotBilledTag: false,
  }))

  // 5) Trial call no_answer (ringing → originator_cancel / timeout)
  results.push(await runScenario({
    name: 'TRIAL CALL — no answer (ringing → originator_cancel)',
    phase: 'ringing',
    hangupCause: 'originator_cancel',
    isTrial: true,
    // originator_cancel is NOT in isFailedCall list → still billed 1 min minimum (Quick IVR rule)
    expectBilledMin: 1,
    expectNotBilledTag: false,
  }))

  // 6) Bridged call completed normally
  results.push(await runScenario({
    name: 'TRIAL CALL — bridged completed (bridged → normal_clearing)',
    phase: 'bridged',
    hangupCause: 'normal_clearing',
    isTrial: true,
    expectBilledMin: 1,
    expectNotBilledTag: false,
  }))

  // ── Summary ──
  console.log('\n' + '='.repeat(70))
  console.log('  SUMMARY')
  console.log('='.repeat(70))
  const passed = results.filter(r => r.pass).length
  const failed = results.length - passed
  console.log(`  Total:  ${results.length}`)
  console.log(`  Passed: ${passed}`)
  console.log(`  Failed: ${failed}`)
  results.forEach(r => console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}`))

  process.exit(failed > 0 ? 1 : 0)
})().catch(err => {
  console.error('Test harness error:', err)
  process.exit(2)
})
