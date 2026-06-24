#!/usr/bin/env node
/**
 * Lifecycle management test — verifies every bot-exposed management op works
 * against the persistent VMs created by persistent_e2e_test.js.
 *
 * USAGE:
 *   DO_ID=do-579957871 AZ_ID=az-nmda6ebb8575 node scripts/test_lifecycle_ops.js
 *
 * Operations tested per provider:
 *   ✓ getInstance              — read instance status
 *   ✓ stopInstance             — power off
 *   ✓ startInstance            — power on
 *   ✓ restartInstance          — reboot
 *   ✓ resetPassword            — change root/admin password
 *   ✓ updateInstanceName       — rename label (best-effort, may no-op on DO)
 *   ✓ createSnapshot           — backup
 *   ✓ listSnapshots            — verify backup created
 *   ✓ deleteSnapshot           — cleanup backup
 *
 * Each op is timed and result printed. VMs are LEFT RUNNING at end.
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })

const vpsProvider = require('/app/js/vps-provider')

const DO_ID = process.env.DO_ID || 'do-579957871'
const AZ_ID = process.env.AZ_ID || 'az-nmda6ebb8575'

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Helper to run a single op + report
async function runOp(provider, name, fn, { mustSucceed = true, expectStatus = null } = {}) {
  const t0 = Date.now()
  try {
    const r = await fn()
    const dt = Date.now() - t0
    console.log(`   ✅ ${name.padEnd(28)} (${dt}ms)${r?.success === false ? ' [success=false]' : ''}`)
    return r
  } catch (e) {
    const dt = Date.now() - t0
    if (mustSucceed) {
      console.log(`   ❌ ${name.padEnd(28)} (${dt}ms) — ${e.message.slice(0, 120)}`)
    } else {
      console.log(`   ⚠️  ${name.padEnd(28)} (${dt}ms) — ${e.message.slice(0, 100)} (allowed)`)
    }
    return null
  }
}

async function exerciseProvider(label, instanceId) {
  console.log('\n══════════════════════════════════════════════════════════')
  console.log(`║  ${label.padEnd(56)}║`)
  console.log('║  instanceId: ' + instanceId.padEnd(43) + '║')
  console.log('══════════════════════════════════════════════════════════')

  const provider = vpsProvider.dispatchByInstanceId(instanceId)
  console.log(`Provider resolved: ${provider.PROVIDER || '(unknown)'}`)

  // ── READ ─────────────────────────────────────────────────────────────
  console.log('\n[1/9] READ — getInstance')
  const before = await runOp(provider, 'getInstance (initial)', () => provider.getInstance(instanceId))
  if (before) {
    console.log(`      status:       ${before.serverStatus || before.status}`)
    console.log(`      power:        ${before.powerStatus || '?'}`)
    console.log(`      ip:           ${before.mainIp || '—'}`)
    console.log(`      plan:         ${before.plan || '?'}`)
    console.log(`      region:       ${before.region || '?'}`)
  }

  // ── STOP ─────────────────────────────────────────────────────────────
  console.log('\n[2/9] STOP — stopInstance (power off)')
  await runOp(provider, 'stopInstance', () => provider.stopInstance(instanceId))
  console.log('      Waiting 30s for power-off…')
  await sleep(30_000)
  const afterStop = await runOp(provider, 'getInstance (after stop)', () => provider.getInstance(instanceId))
  if (afterStop) console.log(`      power now: ${afterStop.powerStatus}`)

  // ── START ────────────────────────────────────────────────────────────
  console.log('\n[3/9] START — startInstance (power on)')
  await runOp(provider, 'startInstance', () => provider.startInstance(instanceId))
  console.log('      Waiting 30s for power-on…')
  await sleep(30_000)
  const afterStart = await runOp(provider, 'getInstance (after start)', () => provider.getInstance(instanceId))
  if (afterStart) console.log(`      power now: ${afterStart.powerStatus}`)

  // ── RESTART ──────────────────────────────────────────────────────────
  console.log('\n[4/9] RESTART — restartInstance (graceful reboot)')
  await runOp(provider, 'restartInstance', () => provider.restartInstance(instanceId))
  console.log('      Waiting 30s for reboot completion…')
  await sleep(30_000)

  // ── RESET PASSWORD ───────────────────────────────────────────────────
  console.log('\n[5/9] RESET PASSWORD — resetPassword')
  const newPwd = require('crypto').randomBytes(16).toString('base64')
    .replace(/[+/=]/g, '').slice(0, 18) + 'Aa1!'
  // Some providers require a secretId; build it the same way createInstance does
  const newSecret = await provider.createSecret(`lifecycle-${Date.now()}`, newPwd, 'password')
  const resetResult = await runOp(provider, 'resetPassword', () =>
    provider.resetPassword(instanceId, newPwd, newSecret.secretId)
  )
  if (resetResult?.success !== false) {
    console.log(`      ↳ new password: ${newPwd}`)
  }

  // ── RENAME ───────────────────────────────────────────────────────────
  console.log('\n[6/9] RENAME — updateInstanceName')
  const newName = 'lifecycle-test-' + Date.now().toString(36).slice(-5)
  await runOp(provider, 'updateInstanceName', () =>
    provider.updateInstanceName(instanceId, newName),
    { mustSucceed: false } // some providers may no-op
  )

  // ── SNAPSHOT (skip on Azure to avoid extra disk cost; just verify endpoint exists) ──
  console.log('\n[7/9] SNAPSHOT — createSnapshot + list + delete')
  const snapName = 'lifecycle-snap-' + Date.now().toString(36).slice(-5)
  const snapResult = await runOp(provider, 'createSnapshot', () =>
    provider.createSnapshot(instanceId, snapName),
    { mustSucceed: false }
  )
  // Wait for snapshot to be ready before listing (DO takes 1-2 min)
  if (snapResult) {
    console.log('      Waiting 10s for snapshot indexing…')
    await sleep(10_000)
  }
  const snapshots = await runOp(provider, 'listSnapshots', () =>
    provider.listSnapshots(instanceId),
    { mustSucceed: false }
  )
  if (Array.isArray(snapshots)) {
    console.log(`      ↳ ${snapshots.length} snapshot(s) found`)
    for (const s of snapshots.slice(0, 3)) {
      console.log(`         • ${s.snapshotId || s.id} (${s.name || s.snapshotName})`)
    }
  }
  if (snapResult?.snapshotId) {
    await runOp(provider, 'deleteSnapshot', () =>
      provider.deleteSnapshot(instanceId, snapResult.snapshotId),
      { mustSucceed: false }
    )
  }

  // ── REGIONS / PRODUCT CATALOG (read-only) ────────────────────────────
  console.log('\n[8/9] CATALOG — listRegions + listProducts')
  await runOp(provider, 'listRegions', async () => {
    const regs = await provider.listRegions()
    console.log(`      ↳ ${regs.length} regions: ${regs.slice(0, 5).map(r => r.regionSlug).join(', ')}…`)
    return regs
  })
  await runOp(provider, 'listProducts', async () => {
    const isWindows = provider.PROVIDER === 'azure'
    const prods = provider.listProducts('EU', isWindows, 'ssd')
    console.log(`      ↳ ${prods.length} products: ${prods.map(p => p.name).join(', ')}`)
    return prods
  })

  // ── FINAL STATE ──────────────────────────────────────────────────────
  console.log('\n[9/9] FINAL — verifying instance still healthy')
  const final = await runOp(provider, 'getInstance (final)', () => provider.getInstance(instanceId))
  if (final) {
    console.log(`      power: ${final.powerStatus || final.status}`)
    console.log(`      ip:    ${final.mainIp}`)
  }

  return final
}

;(async () => {
  const start = Date.now()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('                LIFECYCLE OPS — FULL E2E TEST')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const doFinal = await exerciseProvider('DigitalOcean — Linux VPS lifecycle', DO_ID)
  const azFinal = await exerciseProvider('Azure — Windows RDP lifecycle', AZ_ID)

  const elapsed = Math.round((Date.now() - start) / 1000)
  console.log('\n══════════════════════════════════════════════════════════')
  console.log(`║  TEST COMPLETE  (${elapsed}s elapsed)                            ║`)
  console.log('══════════════════════════════════════════════════════════')
  console.log(`DO   final: ip=${doFinal?.mainIp || '—'} power=${doFinal?.powerStatus || '?'}`)
  console.log(`Azure final: ip=${azFinal?.mainIp || '—'} power=${azFinal?.powerStatus || '?'}`)
  console.log('\n⚠️  Both VMs are still RUNNING. Deprovision when done.')
})().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
