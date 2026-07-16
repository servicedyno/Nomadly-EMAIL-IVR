#!/usr/bin/env node
/**
 * Test suite for admin escalation buttons fix (2026-07-16)
 * 
 * BUG: The admin AI-escalation alert message sends 4 inline_keyboard buttons:
 *   💬 Reply User      → callback_data = aR:<chatId>
 *   ✅ Ack & Take Over → callback_data = eAck:<escId>
 *   ✔️ Resolve         → callback_data = eResolve:<escId>
 *   ✖️ Close Session   → callback_data = aCS:<chatId>
 * 
 * The admin-callback gate at /app/js/_index.js:5853 was:
 *   if (!data || !(/^a[A-Z]/.test(data) || data === 'aCANCEL' || data === 'aCONF')) return
 * 
 * The regex `/^a[A-Z]/` matched aR:, aCS:, aD:, aRO:, aRC: but NOT eAck: or
 * eResolve:, so those two callbacks silently returned BEFORE reaching their
 * handlers at lines 5968 (eAck) and 5994 (eResolve).
 * 
 * FIX: The gate is now:
 *   const isAdminCallback =
 *       /^a[A-Z]/.test(data)                    // existing admin prefixes
 *       || /^e(Ack|Resolve):/.test(data)        // NEW — escalation prefixes
 *       || data === 'aCANCEL' || data === 'aCONF'
 *   if (!data || !isAdminCallback) return
 */

const fs = require('fs')
const path = require('path')

// ────────────────────────────────────────────────────────────────────────────
// Test 1 — Predicate matrix (behavioral)
// ────────────────────────────────────────────────────────────────────────────

console.log('[Test 1] Predicate matrix — behavioral verification')

// Re-implement the predicate locally (matches the fix)
const isAdminCallback = (data) => {
  if (!data) return false
  return /^a[A-Z]/.test(data) || /^e(Ack|Resolve):/.test(data) || data === 'aCANCEL' || data === 'aCONF'
}

const testCases = [
  // Existing admin callbacks (should all be true)
  { input: 'aR:5522767823', expected: true, desc: 'aR: (Reply User)' },
  { input: 'aCS:5522767823', expected: true, desc: 'aCS: (Close Session)' },
  { input: 'aD:ORD-123', expected: true, desc: 'aD: (Delete order)' },
  { input: 'aRO:ORD-123', expected: true, desc: 'aRO: (Refund order)' },
  { input: 'aRC:5522767823:12.5', expected: true, desc: 'aRC: (Refund credit)' },
  { input: 'aRO_OK:ORD-123', expected: true, desc: 'aRO_OK: (Refund confirm)' },
  { input: 'aRC_OK:x:1', expected: true, desc: 'aRC_OK: (Credit confirm)' },
  { input: 'aCANCEL', expected: true, desc: 'aCANCEL (literal)' },
  { input: 'aCONF', expected: true, desc: 'aCONF (literal)' },
  
  // NEW — escalation callbacks (KEY — was ❌ before fix, now ✅)
  { input: 'eAck:6a1abc123', expected: true, desc: 'eAck: (Acknowledge escalation) — KEY FIX' },
  { input: 'eResolve:6a1abc', expected: true, desc: 'eResolve: (Resolve escalation) — KEY FIX' },
  
  // Leak checks — unrelated user callbacks (should all be false)
  { input: 'pd:host:foo.com', expected: false, desc: 'pd: (user panel callback)' },
  { input: 'pv:domain:x', expected: false, desc: 'pv: (user panel callback)' },
  { input: 'pp:sms:x', expected: false, desc: 'pp: (user panel callback)' },
  { input: 'e:foo', expected: false, desc: 'e: (generic e prefix, not eAck/eResolve)' },
  { input: 'ePremature', expected: false, desc: 'ePremature (not eAck/eResolve)' },
  { input: 'evil:x', expected: false, desc: 'evil: (unrelated)' },
  { input: '', expected: false, desc: 'empty string' },
  { input: null, expected: false, desc: 'null' },
  { input: undefined, expected: false, desc: 'undefined' },
]

let predicatePassCount = 0
let predicateFailCount = 0

testCases.forEach(({ input, expected, desc }) => {
  const result = isAdminCallback(input)
  const pass = result === expected
  if (pass) {
    predicatePassCount++
    console.log(`  ✅ ${desc}: isAdminCallback(${JSON.stringify(input)}) = ${result}`)
  } else {
    predicateFailCount++
    console.log(`  ❌ ${desc}: isAdminCallback(${JSON.stringify(input)}) = ${result}, expected ${expected}`)
  }
})

console.log(`[Test 1] Predicate matrix: ${predicatePassCount}/${testCases.length} passed\n`)

// ────────────────────────────────────────────────────────────────────────────
// Test 2 — Static grep proof (source code verification)
// ────────────────────────────────────────────────────────────────────────────

console.log('[Test 2] Static grep proof — source code verification')

const indexJsPath = path.join(__dirname, '..', '_index.js')
const indexJsContent = fs.readFileSync(indexJsPath, 'utf8')

const staticChecks = [
  {
    desc: 'New escalation regex present: /^e(Ack|Resolve):/',
    pattern: /\/\^e\(Ack\|Resolve\):\//,
    shouldMatch: true,
  },
  {
    desc: 'eAck: handler present: if (data.startsWith(\'eAck:\'))',
    pattern: /if\s*\(\s*data\.startsWith\s*\(\s*['"]eAck:['"]\s*\)\s*\)/,
    shouldMatch: true,
  },
  {
    desc: 'eResolve: handler present: if (data.startsWith(\'eResolve:\'))',
    pattern: /if\s*\(\s*data\.startsWith\s*\(\s*['"]eResolve:['"]\s*\)\s*\)/,
    shouldMatch: true,
  },
  {
    desc: 'aR: handler present: if (data.startsWith(\'aR:\'))',
    pattern: /if\s*\(\s*data\.startsWith\s*\(\s*['"]aR:['"]\s*\)\s*\)/,
    shouldMatch: true,
  },
  {
    desc: 'aCS: handler present: if (data.startsWith(\'aCS:\'))',
    pattern: /if\s*\(\s*data\.startsWith\s*\(\s*['"]aCS:['"]\s*\)\s*\)/,
    shouldMatch: true,
  },
  {
    desc: 'Admin chatId gate untouched: if (fromId !== String(TELEGRAM_ADMIN_CHAT_ID))',
    pattern: /if\s*\(\s*fromId\s*!==\s*String\s*\(\s*TELEGRAM_ADMIN_CHAT_ID\s*\)\s*\)/,
    shouldMatch: true,
  },
  {
    desc: 'Escalation alert button: ✅ Ack & Take Over with callback_data eAck:',
    pattern: /['"]✅ Ack & Take Over['"]\s*,\s*callback_data:\s*`eAck:\$\{escId\}`/,
    shouldMatch: true,
  },
  {
    desc: 'Escalation alert button: ✔️ Resolve with callback_data eResolve:',
    pattern: /['"]✔️ Resolve['"]\s*,\s*callback_data:\s*`eResolve:\$\{escId\}`/,
    shouldMatch: true,
  },
  {
    desc: 'Escalation alert button: 💬 Reply User with callback_data aR:',
    pattern: /['"]💬 Reply User['"]\s*,\s*callback_data:\s*`aR:\$\{cidStr\}`/,
    shouldMatch: true,
  },
  {
    desc: 'Escalation alert button: ✖️ Close Session with callback_data aCS:',
    pattern: /['"]✖️ Close Session['"]\s*,\s*callback_data:\s*`aCS:\$\{cidStr\}`/,
    shouldMatch: true,
  },
]

let staticPassCount = 0
let staticFailCount = 0

staticChecks.forEach(({ desc, pattern, shouldMatch }) => {
  const matches = indexJsContent.match(pattern)
  const pass = shouldMatch ? !!matches : !matches
  if (pass) {
    staticPassCount++
    console.log(`  ✅ ${desc}`)
  } else {
    staticFailCount++
    console.log(`  ❌ ${desc} — ${shouldMatch ? 'NOT FOUND' : 'UNEXPECTED MATCH'}`)
  }
})

console.log(`[Test 2] Static grep proof: ${staticPassCount}/${staticChecks.length} passed\n`)

// ────────────────────────────────────────────────────────────────────────────
// Test 3 — Regression sanity (prior fixes still in place)
// ────────────────────────────────────────────────────────────────────────────

console.log('[Test 3] Regression sanity — prior fixes still in place')

const regressionChecks = [
  {
    desc: 'phone-scheduler.js grace-period fast-path with getBalance(_walletOf, chatId)',
    file: path.join(__dirname, '..', 'phone-scheduler.js'),
    pattern: /getBalance\s*\(\s*_walletOf\s*,\s*chatId\s*\)/,
  },
  {
    desc: 'voice-service.js case \'call.speak.started\': adjacent to case \'call.playback.started\':',
    file: path.join(__dirname, '..', 'voice-service.js'),
    pattern: /case\s+['"]call\.speak\.started['"]\s*:/,
  },
  {
    desc: 'pay-blockbee.js convert() returns null in error/non-finite paths',
    file: path.join(__dirname, '..', 'pay-blockbee.js'),
    pattern: /return\s+null/,
  },
  {
    desc: 'db.js atomicIncrement() non-finite guard at top',
    file: path.join(__dirname, '..', 'db.js'),
    pattern: /typeof\s+amount\s*!==\s*['"]number['"]\s*\|\|\s*!Number\.isFinite\s*\(\s*amount\s*\)/,
  },
]

let regressionPassCount = 0
let regressionFailCount = 0

regressionChecks.forEach(({ desc, file, pattern }) => {
  try {
    const content = fs.readFileSync(file, 'utf8')
    const matches = content.match(pattern)
    if (matches) {
      regressionPassCount++
      console.log(`  ✅ ${desc}`)
    } else {
      regressionFailCount++
      console.log(`  ❌ ${desc} — NOT FOUND`)
    }
  } catch (e) {
    regressionFailCount++
    console.log(`  ❌ ${desc} — FILE READ ERROR: ${e.message}`)
  }
})

console.log(`[Test 3] Regression sanity: ${regressionPassCount}/${regressionChecks.length} passed\n`)

// ────────────────────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────────────────────

const totalTests = testCases.length + staticChecks.length + regressionChecks.length
const totalPassed = predicatePassCount + staticPassCount + regressionPassCount
const totalFailed = predicateFailCount + staticFailCount + regressionFailCount

console.log('═'.repeat(80))
console.log(`SUMMARY: ${totalPassed}/${totalTests} assertions passed`)
console.log(`  [Test 1] Predicate matrix: ${predicatePassCount}/${testCases.length} passed`)
console.log(`  [Test 2] Static grep proof: ${staticPassCount}/${staticChecks.length} passed`)
console.log(`  [Test 3] Regression sanity: ${regressionPassCount}/${regressionChecks.length} passed`)
console.log('═'.repeat(80))

if (totalFailed > 0) {
  console.error(`\n❌ ${totalFailed} assertion(s) FAILED`)
  process.exit(1)
} else {
  console.log('\n✅ All assertions PASSED')
  process.exit(0)
}
