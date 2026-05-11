#!/usr/bin/env node
/**
 * investigate_recent_contabo_charge.js
 * READ-ONLY. Finds plausible sources for a recent Contabo charge:
 *   1. Instances created in the last N days, sorted desc
 *   2. Snapshots (each ≈ $1-3/mo depending on size)
 *   3. Secrets / add-ons / tags created recently
 *   4. Any add-on objects attached to existing instances
 *   5. Spec mismatch: instance.productId not in local catalog (V93/V96/...)
 *   6. Try Contabo /orders endpoint (newer API) speculatively
 */

const fs = require('fs')
const contabo = require('./contabo-service.js')
require('dotenv').config({ path: '/app/.env' })

const LOOKBACK_DAYS = 7
const now = new Date()
const cutoff = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

function fmt(d) { if (!d) return 'N/A'; try { return new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' } catch { return String(d) } }
function ago(d) { if (!d) return ''; const diff = (now.getTime() - new Date(d).getTime()) / 1000; if (diff < 0) return `(in future)`; const h = diff/3600; if (h < 48) return `(${h.toFixed(1)}h ago)`; return `(${(h/24).toFixed(1)}d ago)` }

;(async () => {
  console.log(`═══ Contabo recent-charge investigation ═══`)
  console.log(`Run at: ${now.toISOString()}`)
  console.log(`Lookback: ${LOOKBACK_DAYS} days (since ${cutoff.toISOString()})\n`)

  // ── 1) ALL instances sorted by createdDate desc, plus full attribute dump
  const all = await contabo.listInstances()
  const sorted = [...all].sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
  console.log(`Total instances on Contabo: ${all.length}`)
  console.log(`\nMOST RECENT 8:`)
  for (const i of sorted.slice(0, 8)) {
    const created = new Date(i.createdDate)
    const recent = created >= cutoff
    console.log(`  ${recent ? '🆕' : '  '} ${i.instanceId} | ${i.productId} @ ${i.region} | ${i.status} | OS=${i.osType} | ${i.ipConfig?.v4?.ip || 'pending'} | created ${fmt(i.createdDate)} ${ago(i.createdDate)}`)
    if (i.cancelDate) console.log(`        cancelDate: ${fmt(i.cancelDate)}`)
    if (i.addOns?.length) console.log(`        addOns: ${JSON.stringify(i.addOns)}`)
  }

  // ── 2) Look for products not in our local catalog (V93/V96/V99/...)
  console.log(`\n── Unmapped productIds (likely Storage VPS / specialty plans) ──`)
  const unmapped = all.filter(i => !contabo.getProduct(i.productId))
  if (unmapped.length === 0) console.log('  (none)')
  for (const i of unmapped) {
    console.log(`  • ${i.instanceId} | ${i.productId} @ ${i.region} | ${i.status} | OS=${i.osType} | created ${fmt(i.createdDate)} ${ago(i.createdDate)}`)
    console.log(`      productName: ${i.productName || '-'} | ramMb=${i.ramMb} | diskMb=${i.diskMb} | cpuCores=${i.cpuCores}`)
  }

  // ── 3) Snapshots (each instance)
  console.log(`\n── Snapshots ──`)
  let snapshotTotal = 0
  for (const i of all) {
    try {
      const snaps = await contabo.listSnapshots(i.instanceId)
      if (snaps && snaps.length) {
        snapshotTotal += snaps.length
        for (const s of snaps) {
          console.log(`  • ${i.instanceId} (${i.productId}) → snapshot ${s.snapshotId} | ${s.name} | autoDeleteDate=${s.autoDeleteDate || '-'} | createdDate=${fmt(s.createdDate)}`)
        }
      }
    } catch (e) { /* ignore per-instance failures */ }
  }
  if (snapshotTotal === 0) console.log('  (no snapshots on any instance)')
  else console.log(`  total snapshots: ${snapshotTotal}`)

  // ── 4) Secrets created recently
  console.log(`\n── Secrets (created within ${LOOKBACK_DAYS}d) ──`)
  try {
    const secrets = await contabo.listSecrets()
    const recent = secrets.filter(s => new Date(s.createdDate) >= cutoff)
    if (recent.length === 0) console.log('  (no recent secrets)')
    for (const s of recent) {
      console.log(`  • secretId=${s.secretId} | name=${s.name} | type=${s.type} | created ${fmt(s.createdDate)} ${ago(s.createdDate)}`)
    }
  } catch (e) { console.log(`  listSecrets failed: ${e.message}`) }

  // ── 5) Speculative: try Contabo billing/orders endpoints
  console.log(`\n── Speculative billing endpoint probe ──`)
  for (const path of ['/billing/orders', '/billing/invoices', '/orders', '/invoices', '/users/client', '/users']) {
    try {
      const r = await contabo.apiRequest('GET', path, null, { size: 20 })
      console.log(`  ${path} → 200 OK, keys: ${Object.keys(r || {}).join(',')} (${(r?.data || []).length} rows)`)
      if (r?.data?.length) console.log(JSON.stringify(r.data.slice(0, 3), null, 2).split('\n').map(l => '    ' + l).join('\n'))
    } catch (e) {
      console.log(`  ${path} → ${e.status || 'err'}  ${(e.message || '').toString().slice(0, 90)}`)
    }
  }

  // ── 6) IP add-ons attached to instances (Contabo charges for additional IPs)
  console.log(`\n── Additional IPv4 add-ons (each ≈ €3/mo) ──`)
  let extraIps = 0
  for (const i of all) {
    const extra = i.additionalIps || (i.ipConfig?.v4?.additionalIps) || []
    if (extra && extra.length) {
      extraIps += extra.length
      console.log(`  • ${i.instanceId} (${i.productId}) has ${extra.length} extra IP(s): ${JSON.stringify(extra)}`)
    }
  }
  if (extraIps === 0) console.log('  (none)')
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
