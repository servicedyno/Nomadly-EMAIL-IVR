#!/usr/bin/env node
/**
 * LIVE management test of davion419's Azure RDP (az-nmdcbaec20f3), exercising the
 * SAME provider methods the bot calls. Order keeps it running at the end:
 *   resetPassword -> stop -> start -> restart -> verify RDP port.
 * Writes the new password secret to the DB record (mirrors the bot's reset handler).
 */
'use strict'
require('dotenv').config()
const net = require('net')
const { MongoClient } = require('mongodb')

const IID = 'az-nmdcbaec20f3'
const VM = 'nmdcbaec20f3'
const IP = '20.125.117.70'

function ts() { return new Date().toISOString().substring(11, 19) }

async function powerState(azure) {
  try {
    const raw = await azure.apiRequest('GET',
      `/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}/resourceGroups/${process.env.AZURE_RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${VM}/instanceView`,
      { apiVersion: '2024-11-01' })
    const ps = (raw.statuses || []).map(s => s.code).find(c => c.startsWith('PowerState/')) || '?'
    return ps
  } catch (e) { return 'err:' + e.message }
}

async function waitFor(azure, want, maxMs = 300000) {
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    const ps = await powerState(azure)
    console.log(`    [${ts()}] powerState=${ps}`)
    if (ps.includes(want)) return true
    await new Promise(r => setTimeout(r, 12000))
  }
  return false
}

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const { getProviderForRecord } = require('/app/js/vps-provider.js')
  const rec = await db.collection('vpsPlansOf').findOne({ contaboInstanceId: IID })
  const azure = getProviderForRecord(rec)
  const results = {}

  console.log(`[${ts()}] baseline powerState:`, await powerState(azure))

  // 1) RESET PASSWORD
  console.log(`\n[${ts()}] === resetPassword ===`)
  let newPwd = null
  try {
    const r = await azure.resetPassword(IID, {})
    newPwd = r.password
    await db.collection('vpsPlansOf').updateOne({ _id: rec._id }, { $set: { rootPasswordSecretId: r.secretId } })
    console.log(`    ✅ resetPassword OK | user=${r.raw?.adminUser} | newPassword=${newPwd} | secretId=${r.secretId}`)
    results.resetPassword = { ok: true, adminUser: r.raw?.adminUser, password: newPwd }
  } catch (e) { console.log('    ❌ resetPassword:', e.message); results.resetPassword = { ok: false, err: e.message } }

  // 2) STOP
  console.log(`\n[${ts()}] === stopInstance ===`)
  try {
    await azure.stopInstance(IID)
    const ok = await waitFor(azure, 'deallocated', 300000) || await waitFor(azure, 'stopped', 30000)
    console.log(`    ${ok ? '✅' : '⚠️'} stop reached stopped/deallocated=${ok}`)
    results.stop = { ok }
  } catch (e) { console.log('    ❌ stop:', e.message); results.stop = { ok: false, err: e.message } }

  // 3) START
  console.log(`\n[${ts()}] === startInstance ===`)
  try {
    await azure.startInstance(IID)
    const ok = await waitFor(azure, 'running', 300000)
    console.log(`    ${ok ? '✅' : '⚠️'} start reached running=${ok}`)
    results.start = { ok }
  } catch (e) { console.log('    ❌ start:', e.message); results.start = { ok: false, err: e.message } }

  // 4) RESTART
  console.log(`\n[${ts()}] === restartInstance ===`)
  try {
    await azure.restartInstance(IID)
    await new Promise(r => setTimeout(r, 15000))
    const ok = await waitFor(azure, 'running', 300000)
    console.log(`    ${ok ? '✅' : '⚠️'} restart back to running=${ok}`)
    results.restart = { ok }
  } catch (e) { console.log('    ❌ restart:', e.message); results.restart = { ok: false, err: e.message } }

  // 5) RDP port reachable again
  console.log(`\n[${ts()}] === verify RDP 3389 ===`)
  await new Promise((resolve) => {
    const s = new net.Socket(); s.setTimeout(15000)
    s.on('connect', () => { console.log('    ✅ RDP port OPEN'); results.rdpPort = true; s.destroy(); resolve() })
    s.on('timeout', () => { console.log('    ⏳ RDP port timeout (still booting)'); results.rdpPort = false; s.destroy(); resolve() })
    s.on('error', (e) => { console.log('    ❌ ' + e.message); results.rdpPort = false; resolve() })
    s.connect(3389, IP)
  })

  console.log('\n=== SUMMARY ===')
  console.log(JSON.stringify(results, null, 2))
  console.log('FINAL_PASSWORD=' + (newPwd || 'unchanged'))
  await client.close()
  process.exit(0)
})().catch(e => { console.error('FATAL', e); process.exit(1) })
