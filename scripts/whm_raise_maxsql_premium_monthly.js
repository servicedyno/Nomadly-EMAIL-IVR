/* eslint-env node */
/**
 * One-shot operator script: raise MAXSQL on the Premium Monthly WHM package
 * AND on every existing Premium Monthly cpanelAccount, so existing customers
 * can create databases (matching the storefront card promise).
 *
 * Safe to re-run — modifypkg + modifyacct are idempotent.
 *
 * Run: node scripts/whm_raise_maxsql_premium_monthly.js
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const PKG_NAME = 'Premium-Anti-Red-HostPanel-1-Month'
const NEW_MAXSQL = 5
const PLAN_NAMES = [
  'Premium Anti-Red HostPanel (1-Month)',
  'premium-anti-red-hostpanel-1-month',
]

;(async () => {
  // Use the existing whmApi axios instance — already wired with token / CF Access creds
  const whmServicePath = require.resolve('/app/js/whm-service.js')
  delete require.cache[whmServicePath]
  const fs = require('fs')
  const src = fs.readFileSync(whmServicePath, 'utf8')
  // Re-create the whmApi instance directly (it's not exported)
  const axios = require('axios')
  const WHM_BASE = process.env.WHM_API_URL
  const WHM_TOKEN = process.env.WHM_TOKEN
  const WHM_USER = process.env.WHM_USER || 'root'
  if (!WHM_BASE || !WHM_TOKEN) {
    console.error('FATAL: WHM_API_URL or WHM_TOKEN missing from /app/backend/.env')
    process.exit(1)
  }
  const headers = { Authorization: `whm ${WHM_USER}:${WHM_TOKEN}` }
  // Honor CF Access headers if set (the tunnel requires service token in sandbox)
  if (process.env.CF_ACCESS_CLIENT_ID) headers['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID
  if (process.env.CF_ACCESS_CLIENT_SECRET) headers['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET

  const whm = axios.create({
    baseURL: WHM_BASE.replace(/\/+$/, '') + '/json-api',
    headers,
    timeout: 30000,
    validateStatus: () => true,
  })

  console.log(`WHM endpoint: ${whm.defaults.baseURL}`)
  console.log(`Auth: whm ${WHM_USER}:****`)
  console.log(`CF-Access creds: ${process.env.CF_ACCESS_CLIENT_ID ? 'present' : 'absent'}`)
  console.log()

  // Step 1 — modifypkg
  console.log(`Step 1: modifypkg name=${PKG_NAME} MAXSQL=${NEW_MAXSQL} …`)
  try {
    const r = await whm.get('/modifypkg', {
      params: { 'api.version': 1, name: PKG_NAME, MAXSQL: NEW_MAXSQL },
    })
    console.log(`  HTTP ${r.status}`)
    if (r.status === 403) {
      console.error('  ❌ 403 from WHM — likely Cloudflare Access blocking the sandbox IP.')
      console.error('     Provide CF-Access service token headers (CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET)')
      console.error('     or run this script on a host whitelisted in your Cloudflare Access policy.')
      console.error()
      console.error('  ⚠️  ALTERNATIVE: Run the WHM commands directly in your WHM dashboard or via SSH:')
      console.error(`     whmapi1 modifypkg name=${PKG_NAME} MAXSQL=${NEW_MAXSQL}`)
      console.error()
    } else if (r.data?.metadata?.result === 1) {
      console.log(`  ✅ package updated: ${r.data?.metadata?.reason || 'OK'}`)
    } else {
      console.error(`  ❌ WHM rejected modifypkg: ${r.data?.metadata?.reason || JSON.stringify(r.data).slice(0, 400)}`)
    }
  } catch (e) {
    console.error(`  ❌ modifypkg threw: ${e.message}`)
    if (e.response?.status === 403) {
      console.error('     CF Access 403 — same blocker.')
    }
  }

  // Step 2 — modifyacct for every existing Premium Monthly account
  console.log()
  console.log(`Step 2: modifyacct MAXSQL=${NEW_MAXSQL} for every existing Premium Monthly cpanelAccount …`)
  const mc = await MongoClient.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 10000 })
  const db = mc.db(process.env.DB_NAME)
  const accounts = await db.collection('cpanelAccounts').find({
    plan: { $in: PLAN_NAMES.map(n => new RegExp(`^${n.replace(/[()-]/g, '\\$&')}$`, 'i')) },
    deleted: { $ne: true },
    __seedTestAccount: { $ne: true },
  }).project({ _id: 1, cpUser: 1, domain: 1, plan: 1 }).toArray()
  await mc.close()
  console.log(`  found ${accounts.length} Premium Monthly account(s)`)

  let ok = 0, fail = 0, skipped403 = 0
  for (const a of accounts) {
    const user = a.cpUser || a._id
    try {
      const r = await whm.get('/modifyacct', {
        params: { 'api.version': 1, user, MAXSQL: NEW_MAXSQL },
      })
      if (r.status === 403) {
        skipped403++
        if (skipped403 === 1) console.error(`  ❌ 403 from WHM (will skip remaining ${accounts.length - 1} accounts)`)
        break
      }
      if (r.data?.metadata?.result === 1) {
        ok++
        if (ok <= 5 || ok % 10 === 0) console.log(`  ✓ ${user} (${a.domain})`)
      } else {
        fail++
        console.error(`  ✗ ${user}: ${r.data?.metadata?.reason || JSON.stringify(r.data).slice(0, 200)}`)
      }
    } catch (e) {
      fail++
      console.error(`  ✗ ${user}: ${e.message}`)
    }
  }
  console.log()
  console.log(`Summary: ${ok} ok, ${fail} failed${skipped403 ? `, ${skipped403}+ skipped due to 403` : ''}`)
  if (skipped403) {
    console.error()
    console.error(`⚠️  Sandbox cannot reach WHM directly (CF Access 403).`)
    console.error(`   Run this script on your production Railway service (it has the WHM tunnel allowlist),`)
    console.error(`   OR run these one-liners in your WHM SSH:`)
    console.error()
    console.error(`     whmapi1 modifypkg name=${PKG_NAME} MAXSQL=${NEW_MAXSQL}`)
    for (const a of accounts.slice(0, 10)) {
      console.error(`     whmapi1 modifyacct user=${a.cpUser || a._id} MAXSQL=${NEW_MAXSQL}`)
    }
    if (accounts.length > 10) console.error(`     # …and ${accounts.length - 10} more`)
  }
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
