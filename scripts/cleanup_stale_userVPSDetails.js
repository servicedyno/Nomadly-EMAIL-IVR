#!/usr/bin/env node
/**
 * Migration: cleanup stale `state.userVPSDetails` references
 *
 * Context — `state.userVPSDetails` is a legitimately overloaded field in the
 * bot codebase: `goto.getUserAllVmIntances()` writes it as an ARRAY (list view),
 * while `goto.getVPSDetails()` overwrites it with a SINGLE OBJECT (detail view).
 * Each flow self-heals on entry, so this overloading does not crash in the
 * normal happy path.
 *
 * However, state records can accumulate STALE single-object references to VPS
 * that no longer exist in `vpsPlansOf` (e.g. operator-revoked instances,
 * Contabo-side deletions). Until the user next visits the list view, those
 * stale objects mislead any helper that reads `userVPSDetails` directly.
 *
 * This migration:
 *   1. Scans state records where `userVPSDetails` is a single object (not array)
 *   2. Validates the reference against vpsPlansOf (source of truth)
 *   3. Clears stale references — bot will repopulate cleanly on next list view
 *
 * Dry-run by default. Pass `--apply` to actually write.
 */
require('dotenv').config({ path: '/app/.env' })
const { MongoClient } = require('mongodb')

const APPLY = process.argv.includes('--apply')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)
  const state = db.collection('state')
  const vpsPlansOf = db.collection('vpsPlansOf')

  console.log(`━━━━ Stale userVPSDetails cleanup (${APPLY ? 'APPLY' : 'DRY-RUN'}) ━━━━`)

  // Build a set of all live (non-DELETED) contabo instance IDs across all users
  const livePlans = await vpsPlansOf.find(
    { status: { $ne: 'DELETED' } },
    { projection: { contaboInstanceId: 1, vpsId: 1, chatId: 1 } }
  ).toArray()
  const liveContaboIds = new Set(livePlans.map(p => String(p.contaboInstanceId)))
  const liveVpsIds     = new Set(livePlans.map(p => String(p.vpsId)).filter(Boolean))
  console.log(`Live VPS in vpsPlansOf: ${livePlans.length} (${liveContaboIds.size} unique Contabo IDs)`)

  // Find every state doc where userVPSDetails is a single object (not array, not null)
  const candidates = await state.find({
    userVPSDetails: { $exists: true, $ne: null, $not: { $type: 'array' } }
  }).toArray()
  console.log(`State docs with single-object userVPSDetails: ${candidates.length}`)

  let cleared = 0
  let kept = 0
  let kept_contabo_alive = 0
  const contabo = require('/app/js/contabo-service.js')
  for (const s of candidates) {
    const v = s.userVPSDetails
    const ref = String(
      v?.contaboInstanceId ?? v?._id ?? v?.vpsId ?? v?.instanceId ?? ''
    )
    const isLive = ref && (liveContaboIds.has(ref) || liveVpsIds.has(ref))
    if (isLive) {
      kept++
      continue
    }
    // Defensive: even if not in vpsPlansOf, check Contabo before destroying state.
    // If the instance still exists on Contabo, the user may legitimately own it
    // (e.g. vpsPlansOf record was lost / never written). Don't destroy that pointer —
    // log instead so the operator can backfill vpsPlansOf manually.
    let contaboAlive = false
    if (ref && /^\d+$/.test(ref)) {
      try {
        const live = await contabo.getInstance(Number(ref))
        if (live?.instanceId) {
          contaboAlive = true
          console.log(`  KEEP (orphan on Contabo): chatId=${s._id}  contaboId=${ref}  name=${v?.name}  status=${live.status}`)
          kept_contabo_alive++
        }
      } catch (_) { /* not found on Contabo → safe to clear */ }
    }
    if (contaboAlive) continue

    console.log(`  STALE: chatId=${s._id}  ref=${ref || '(none)'}  name=${v?.name || '?'}  host=${v?.host || '?'}`)
    if (APPLY) {
      await state.updateOne(
        { _id: s._id },
        {
          $unset: { userVPSDetails: '' },
          $set:   { _userVPSDetailsClearedAt: new Date(), _userVPSDetailsClearedReason: 'stale-reference-cleanup' }
        }
      )
    }
    cleared++
  }

  console.log(`\nSummary:`)
  console.log(`  Live (kept):              ${kept}`)
  console.log(`  Orphan on Contabo (kept): ${kept_contabo_alive}    ← operator: investigate / backfill vpsPlansOf`)
  console.log(`  Stale (${APPLY ? 'cleared' : 'would-clear'}):  ${cleared}`)

  if (!APPLY) console.log(`\n(Re-run with --apply to actually clear stale references.)`)

  await client.close()
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
