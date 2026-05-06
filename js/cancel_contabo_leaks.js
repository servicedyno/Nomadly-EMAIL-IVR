#!/usr/bin/env node
/**
 * cancel_contabo_leaks.js
 *
 * Cancels a specific list of Contabo instances that were identified as leaks
 * (orphans/ghosts) by diagnose_contabo_charges.js.
 *
 * Verifies each cancellation by re-fetching the instance and checking that
 * `cancelDate` is now set. Prints a final summary.
 *
 * Usage: node cancel_contabo_leaks.js <instanceId1> <instanceId2> ...
 *        node cancel_contabo_leaks.js --dry-run <instanceId1> ...
 */

require('dotenv').config({ path: '/app/.env' })
const contabo = require('./contabo-service.js')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const instanceIds = args.filter(a => !a.startsWith('--'))

if (instanceIds.length === 0) {
  console.error('Usage: node cancel_contabo_leaks.js [--dry-run] <instanceId1> <instanceId2> ...')
  process.exit(1)
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function cancelAndVerify(instanceId) {
  console.log(`\n── Instance ${instanceId} ──`)

  // Step 1: Pre-cancel snapshot
  let pre
  try {
    pre = await contabo.getInstance(instanceId)
  } catch (err) {
    console.log(`  ❌ Could not fetch instance: ${err.message || JSON.stringify(err)}`)
    return { instanceId, ok: false, reason: 'not_found' }
  }
  console.log(`  Name:        ${pre.name || pre.displayName}`)
  console.log(`  Status:      ${pre.status}`)
  console.log(`  Region:      ${pre.region}`)
  console.log(`  Product:     ${pre.productId}`)
  console.log(`  Created:     ${pre.createdDate}`)
  console.log(`  CancelDate:  ${pre.cancelDate || '(not scheduled)'}`)

  if (pre.cancelDate) {
    console.log(`  ℹ️  Already scheduled for cancellation on ${pre.cancelDate} — skipping API call.`)
    return { instanceId, ok: true, alreadyScheduled: true, cancelDate: pre.cancelDate }
  }

  if (dryRun) {
    console.log(`  🔍 DRY RUN — would call cancelInstance(${instanceId})`)
    return { instanceId, ok: true, dryRun: true }
  }

  // Step 2: Cancel
  try {
    const res = await contabo.cancelInstance(instanceId)
    console.log(`  ✅ cancelInstance API call OK. Response: ${JSON.stringify(res).slice(0, 200)}`)
  } catch (err) {
    console.log(`  ❌ cancelInstance threw: ${err.message || JSON.stringify(err)}`)
    return { instanceId, ok: false, reason: 'cancel_api_error', error: err.message || err }
  }

  // Step 3: Verify by re-fetching (poll up to 20s for cancelDate to appear)
  let verified = false
  let finalState = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    await sleep(5000)
    try {
      finalState = await contabo.getInstance(instanceId)
      if (finalState.cancelDate) { verified = true; break }
      console.log(`  ⏳ attempt ${attempt}/4 — cancelDate still not set`)
    } catch (err) {
      console.log(`  ⚠️  verify fetch failed: ${err.message}`)
    }
  }

  if (verified) {
    console.log(`  ✅ VERIFIED cancelled. cancelDate = ${finalState.cancelDate}`)
    return { instanceId, ok: true, cancelDate: finalState.cancelDate, status: finalState.status }
  } else {
    console.log(`  ⚠️  API returned success but cancelDate never appeared — may be a Contabo soft-success (common for pending_payment instances).`)
    console.log(`      Current status: ${finalState?.status}`)
    console.log(`      ACTION REQUIRED: cancel manually via Contabo dashboard: https://my.contabo.com/`)
    return { instanceId, ok: false, reason: 'soft_success_no_canceldate', status: finalState?.status }
  }
}

async function main() {
  console.log('═════════════════════════════════════════════════════════')
  console.log(`  CANCEL CONTABO LEAK INSTANCES (${dryRun ? 'DRY RUN' : 'LIVE'})`)
  console.log(`  Targets: ${instanceIds.join(', ')}`)
  console.log('═════════════════════════════════════════════════════════')

  const results = []
  for (const id of instanceIds) {
    const r = await cancelAndVerify(id)
    results.push(r)
  }

  console.log('\n═════════════════════════════════════════════════════════')
  console.log('  SUMMARY')
  console.log('═════════════════════════════════════════════════════════')
  for (const r of results) {
    const icon = r.ok ? '✅' : '⚠️ '
    const detail = r.dryRun ? 'DRY RUN'
      : r.alreadyScheduled ? `already scheduled (cancelDate=${r.cancelDate})`
      : r.ok ? `cancelled (cancelDate=${r.cancelDate})`
      : `FAILED: ${r.reason}`
    console.log(`  ${icon} ${r.instanceId} — ${detail}`)
  }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
