#!/usr/bin/env node
/**
 * diagnose_contabo_charges.js
 *
 * Cross-references the live Contabo account instances against local MongoDB
 * `vpsPlansOf` records to surface:
 *   1. ORPHANS                  — instances LIVE on Contabo but NOT in our DB (we're paying, no customer)
 *   2. GHOSTS (unbilled customers) — instances LIVE on Contabo with DB record CANCELLED/DELETED (failed to cancel on provider)
 *   3. EXPIRED-STILL-RUNNING    — DB says RUNNING but end_time is in the past (scheduler gap)
 *   4. PENDING-CANCELLATION     — DB flagged for deletion, waiting on Contabo cancel
 *   5. HEALTHY                  — normal active mapped instances
 *
 * Then prints a monthly cost breakdown so we can identify the "€30+ leak".
 *
 * READ-ONLY — no writes, no deletions. Prints a full report and exits.
 */

require('dotenv').config({ path: '/app/.env' })
const { MongoClient, ServerApiVersion } = require('mongodb')
const contabo = require('./contabo-service.js')

const DB_NAME = process.env.DB_NAME
const MONGO_URL = process.env.MONGO_URL

const EUR_PER_USD = 0.92 // approximate for display

function fmtUsd(n) { return `$${Number(n || 0).toFixed(2)}` }
function fmtEur(n) { return `€${(Number(n || 0) * EUR_PER_USD).toFixed(2)}` }
function fmtDate(d) { if (!d) return 'N/A'; try { return new Date(d).toISOString().slice(0, 16).replace('T', ' ') } catch { return String(d) } }

function estimateContaboMonthlyCost(instance) {
  // Try to use local product catalog for the instance's productId+region+OS.
  // Returns Contabo base cost (what Contabo charges us, NOT our markup).
  const product = contabo.getProduct(instance.productId)
  if (!product) return null
  const base = product.basePriceUsd || 0
  const tier = product.tier || 1
  const surchargeArr = contabo.REGION_SURCHARGE[instance.region]
  const regionSurcharge = surchargeArr ? (surchargeArr[tier - 1] ?? 0) : 0
  const isWindows = instance.osType === 'Windows'
  const windowsFee = isWindows ? (contabo.WINDOWS_LICENSE_BY_TIER[tier] || 0) : 0
  return Math.round((base + regionSurcharge + windowsFee) * 100) / 100
}

async function main() {
  console.log('═════════════════════════════════════════════════════════')
  console.log('  CONTABO BILLING DIAGNOSTIC — READ ONLY')
  console.log(`  Run at: ${new Date().toISOString()}`)
  console.log('═════════════════════════════════════════════════════════\n')

  const client = new MongoClient(MONGO_URL, { serverApi: ServerApiVersion.v1 })
  await client.connect()
  const db = client.db(DB_NAME)
  const vpsPlansOf = db.collection('vpsPlansOf')

  console.log('[1/3] Fetching ALL instances from Contabo API…')
  let contaboInstances = []
  try {
    contaboInstances = await contabo.listInstances()
  } catch (err) {
    console.error('❌ Contabo API fetch failed:', err.message || err)
    await client.close()
    process.exit(1)
  }
  console.log(`     → ${contaboInstances.length} instance(s) live on Contabo\n`)

  console.log('[2/3] Fetching ALL VPS plan records from MongoDB.vpsPlansOf…')
  const allPlans = await vpsPlansOf.find({}).toArray()
  console.log(`     → ${allPlans.length} VPS plan record(s) in DB\n`)

  // Build lookup map: contaboInstanceId -> dbRecord
  const dbByInstanceId = new Map()
  for (const plan of allPlans) {
    const id = plan.contaboInstanceId ?? plan.vpsId
    if (id != null) dbByInstanceId.set(String(id), plan)
  }

  console.log('[3/3] Cross-referencing…\n')

  const orphans = []              // on Contabo, not in DB at all
  const ghosts = []               // on Contabo, DB has it as CANCELLED/DELETED
  const pendingCancellation = []  // on Contabo, DB flagged PENDING_CANCELLATION
  const expiredRunning = []       // on Contabo, DB says RUNNING but end_time is past
  const healthy = []              // active, mapped, within contract
  const infra = []                // instance IP is referenced in .env (infrastructure, don't cancel)

  // Load .env to recognise infrastructure instances by IP
  let envContent = ''
  try { envContent = require('fs').readFileSync('/app/.env', 'utf8') } catch {}

  const now = new Date()

  for (const inst of contaboInstances) {
    // Contabo instance's own cancelDate field: set when the instance has been
    // cancelled on Contabo but not yet physically removed — these are NOT billing us.
    const isCancelledOnContabo = inst.status === 'cancelled' || !!inst.cancelDate

    const db = dbByInstanceId.get(String(inst.instanceId))
    const monthlyCost = estimateContaboMonthlyCost(inst)
    const ip = inst.ipConfig?.v4?.ip || 'pending'
    const entry = {
      instanceId: inst.instanceId,
      name: inst.name || inst.displayName,
      productId: inst.productId,
      region: inst.region,
      ip,
      status: inst.status,
      cancelDate: inst.cancelDate,
      createdDate: inst.createdDate,
      osType: inst.osType,
      monthlyCostUsd: monthlyCost,
      dbRecord: db ? {
        chatId: db.chatId || db.chat_id,
        label: db.label || db.name,
        status: db.status,
        end_time: db.end_time,
        autoRenewable: db.autoRenewable,
        planPrice: db.planPrice,
        deletedAt: db.deletedAt,
        cancelledAt: db.cancelledAt,
      } : null,
    }

    if (isCancelledOnContabo) {
      // Already cancelled provider-side. Include in report but NOT in cost totals.
      entry._providerCancelled = true
    }

    // Infrastructure instance check: IP is referenced in .env
    const isInfra = ip && ip !== 'pending' && envContent.split('\n').some(l => l.includes(ip) && !l.trim().startsWith('#'))
    if (isInfra && !db) {
      infra.push(entry)
      continue
    }

    if (!db) {
      orphans.push(entry)
    } else {
      const s = String(db.status || '').toUpperCase()
      if (s === 'CANCELLED' || s === 'DELETED') {
        ghosts.push(entry)
      } else if (s === 'PENDING_CANCELLATION') {
        pendingCancellation.push(entry)
      } else if ((s === 'RUNNING' || s === 'INSTALLING' || s === 'PROVISIONING') && db.end_time && new Date(db.end_time) < now) {
        expiredRunning.push(entry)
      } else {
        healthy.push(entry)
      }
    }
  }

  // ── REPORT ────────────────────────────────────────────────────────
  function printBucket(title, arr, note) {
    console.log(`\n───── ${title} (${arr.length}) ─────`)
    if (note) console.log(`  ${note}`)
    if (arr.length === 0) { console.log('  (none)'); return 0 }
    let total = 0
    for (const e of arr) {
      const flag = e._providerCancelled ? '  [CANCELLED on Contabo — not billing]' : ''
      console.log(`  • ${e.instanceId} | ${e.name} | ${e.productId} @ ${e.region} | ${e.status}${flag}`)
      console.log(`      IP: ${e.ip} | OS: ${e.osType} | cost/mo: ${fmtUsd(e.monthlyCostUsd)} (${fmtEur(e.monthlyCostUsd)}) | created: ${fmtDate(e.createdDate)}${e.cancelDate ? ` | contaboCancelDate: ${fmtDate(e.cancelDate)}` : ''}`)
      if (e.dbRecord) {
        console.log(`      DB: chatId=${e.dbRecord.chatId} | label=${e.dbRecord.label || '-'} | status=${e.dbRecord.status} | end_time=${fmtDate(e.dbRecord.end_time)} | autoRenew=${e.dbRecord.autoRenewable} | userPaid/mo=${fmtUsd(e.dbRecord.planPrice)}${e.dbRecord.deletedAt ? ` | deletedAt=${fmtDate(e.dbRecord.deletedAt)}` : ''}${e.dbRecord.cancelledAt ? ` | cancelledAt=${fmtDate(e.dbRecord.cancelledAt)}` : ''}`)
      } else {
        console.log(`      DB: NO MATCH (orphan)`)
      }
      if (!e._providerCancelled && e.monthlyCostUsd) total += e.monthlyCostUsd
    }
    console.log(`  → Subtotal (active, still billing): ${fmtUsd(total)} / mo (${fmtEur(total)} / mo)`)
    return total
  }

  const orphanCost = printBucket('🛑 ORPHANS — on Contabo, NO customer record in DB', orphans,
    'These instances are being billed to you with ZERO revenue. Prime candidates to cancel.')
  const infraCost = printBucket('🏗️  INFRASTRUCTURE — IP referenced in .env (keep these running)', infra,
    'These back production services (email validator, cPanel tunnel, etc.) — DO NOT cancel.')
  const ghostCost = printBucket('⚠️  GHOSTS — DB says CANCELLED/DELETED but instance still live on Contabo', ghosts,
    'Scheduler marked them cancelled but the Contabo cancel call failed or was never made.')
  const pendingCost = printBucket('🕓 PENDING_CANCELLATION — awaiting Contabo cancel', pendingCancellation,
    'Auto-renew failed; should be cancelled by Phase 1.5 / Phase 2 scheduler.')
  const expiredCost = printBucket('⏰ EXPIRED-BUT-RUNNING — DB end_time is past, status still RUNNING', expiredRunning,
    'Scheduler gap — these should have entered PENDING_CANCELLATION already.')
  const healthyCost = printBucket('✅ HEALTHY — mapped to a customer, within contract', healthy)

  const leakedCost = orphanCost + ghostCost + pendingCost + expiredCost
  const totalCost = leakedCost + healthyCost + infraCost

  console.log('\n═════════════════════════════════════════════════════════')
  console.log('  SUMMARY — YOUR CONTABO MONTHLY SPEND')
  console.log('═════════════════════════════════════════════════════════')
  console.log(`  Healthy (customer-paid, OK):     ${fmtUsd(healthyCost)} / mo  (${fmtEur(healthyCost)} / mo)`)
  console.log(`  Infrastructure (whitelisted):    ${fmtUsd(infraCost)} / mo  (${fmtEur(infraCost)} / mo)`)
  console.log(`  Orphans (no customer):           ${fmtUsd(orphanCost)} / mo  (${fmtEur(orphanCost)} / mo)  ← LEAK`)
  console.log(`  Ghosts (cancel failed):          ${fmtUsd(ghostCost)} / mo  (${fmtEur(ghostCost)} / mo)  ← LEAK`)
  console.log(`  Pending cancel (in-flight):      ${fmtUsd(pendingCost)} / mo  (${fmtEur(pendingCost)} / mo)`)
  console.log(`  Expired but still RUNNING:       ${fmtUsd(expiredCost)} / mo  (${fmtEur(expiredCost)} / mo)  ← LEAK`)
  console.log(`  ─────────────────────────────────────────────`)
  console.log(`  TOTAL active billing:            ${fmtUsd(totalCost)} / mo  (${fmtEur(totalCost)} / mo)`)
  console.log(`  TOTAL LEAK (no revenue):         ${fmtUsd(leakedCost)} / mo  (${fmtEur(leakedCost)} / mo)`)
  console.log('═════════════════════════════════════════════════════════')

  // Export structured JSON for follow-up actions (e.g., cancellation script)
  const fs = require('fs')
  const reportPath = '/app/memory/contabo_diagnostic_report.json'
  fs.writeFileSync(reportPath, JSON.stringify({
    runAt: new Date().toISOString(),
    summary: {
      contaboInstanceCount: contaboInstances.length,
      dbRecordCount: allPlans.length,
      healthyCost, infraCost, orphanCost, ghostCost, pendingCost, expiredCost, totalCost, leakedCost
    },
    buckets: { orphans, infra, ghosts, pendingCancellation, expiredRunning, healthy }
  }, null, 2))
  console.log(`\n📄 Full report saved to: ${reportPath}`)

  await client.close()
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
