/* eslint-env node */
/**
 * One-shot startup migration: raise MAXSQL=5 on the Premium-Anti-Red-HostPanel-1-Month
 * WHM package + on every existing Premium Monthly cpanelAccount.
 *
 * Background: the storefront's Premium Monthly card advertises "MySQL databases",
 * and 2026-06-19 we widened the /mysql/* gate from Gold-only to (Premium Monthly +
 * Gold). But the underlying WHM package was provisioned with MAXSQL=0, so existing
 * Premium Monthly customers still cannot create databases at the cPanel layer. This
 * migration brings their accounts up to spec.
 *
 * Idempotent — completion is recorded in a `migrations` collection so it only runs
 * once. Safe to re-deploy or restart the service multiple times. Sandbox/dev pods
 * that cannot reach WHM (CF Access 403) simply log warnings and don't poison the
 * marker — the migration will retry on the next startup once WHM is reachable.
 *
 * Used from js/_index.js a few seconds after startup, similar to runCpanelMigration.
 */
const axios = require('axios')

const MIGRATION_ID = 'raise_maxsql_premium_monthly_v1'
const PKG_NAME = 'Premium-Anti-Red-HostPanel-1-Month'
const NEW_MAXSQL = 5
const PLAN_REGEX = /^Premium Anti-Red HostPanel \(1-Month\)$/i

function buildWhmClient() {
  const WHM_BASE = process.env.WHM_API_URL
  const WHM_TOKEN = process.env.WHM_TOKEN
  const WHM_USER = process.env.WHM_USER || 'root'
  if (!WHM_BASE || !WHM_TOKEN) return null
  const headers = { Authorization: `whm ${WHM_USER}:${WHM_TOKEN}` }
  if (process.env.CF_ACCESS_CLIENT_ID) headers['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID
  if (process.env.CF_ACCESS_CLIENT_SECRET) headers['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET
  return axios.create({
    baseURL: WHM_BASE.replace(/\/+$/, '') + '/json-api',
    headers,
    timeout: 30000,
    validateStatus: () => true,
  })
}

async function runMaxsqlMigration(getDb) {
  const log = (...args) => console.log('[MaxsqlMigration]', ...args)
  const warn = (...args) => console.warn('[MaxsqlMigration]', ...args)
  const db = getDb && getDb()
  if (!db) { warn('skip — getDb() returned null'); return }

  const migrations = db.collection('migrations')
  const existing = await migrations.findOne({ _id: MIGRATION_ID }).catch(() => null)
  if (existing?.completedAt) {
    log(`already complete (${new Date(existing.completedAt).toISOString()}) — skipping`)
    return
  }

  const whm = buildWhmClient()
  if (!whm) { warn('skip — WHM_API_URL or WHM_TOKEN missing'); return }

  // 1) modifypkg — raise the package default so future accounts auto-inherit.
  let pkgOk = false
  let pkgUnreachable = false
  try {
    const r = await whm.get('/modifypkg', { params: { 'api.version': 1, name: PKG_NAME, MAXSQL: NEW_MAXSQL } })
    if (r.status === 403) {
      pkgUnreachable = true
      warn(`modifypkg 403 (CF Access blocked); will retry on next startup`)
    } else if (r.data?.metadata?.result === 1) {
      pkgOk = true
      log(`modifypkg ${PKG_NAME} MAXSQL=${NEW_MAXSQL} → OK`)
    } else {
      warn(`modifypkg rejected: ${r.data?.metadata?.reason || JSON.stringify(r.data).slice(0, 200)}`)
    }
  } catch (e) {
    warn(`modifypkg threw: ${e.message}`)
    if (e.response?.status === 403) pkgUnreachable = true
  }
  if (pkgUnreachable) return // Don't mark complete — let next startup retry

  // 2) modifyacct for every existing Premium Monthly account.
  const accounts = await db.collection('cpanelAccounts').find({
    plan: PLAN_REGEX,
    deleted: { $ne: true },
    __seedTestAccount: { $ne: true },
  }).project({ _id: 1, cpUser: 1, domain: 1 }).toArray()
  log(`found ${accounts.length} Premium Monthly account(s) to update`)

  const stats = { ok: 0, fail: 0, accounts: accounts.length, pkgOk }
  for (const a of accounts) {
    const user = a.cpUser || a._id
    try {
      const r = await whm.get('/modifyacct', { params: { 'api.version': 1, user, MAXSQL: NEW_MAXSQL } })
      if (r.status === 403) {
        warn(`modifyacct ${user} → 403 (CF Access); aborting & deferring`)
        return // Don't mark complete — let next startup retry
      }
      if (r.data?.metadata?.result === 1) {
        stats.ok++
      } else {
        stats.fail++
        warn(`modifyacct ${user} rejected: ${r.data?.metadata?.reason || ''}`)
      }
    } catch (e) {
      stats.fail++
      warn(`modifyacct ${user} threw: ${e.message}`)
    }
  }

  await migrations.updateOne(
    { _id: MIGRATION_ID },
    {
      $set: {
        completedAt: new Date(),
        stats,
        notes: `raised MAXSQL to ${NEW_MAXSQL} on package ${PKG_NAME} + ${stats.ok} cpanel account(s)`,
      },
    },
    { upsert: true }
  )
  log(`✅ migration ${MIGRATION_ID} complete: ${stats.ok} ok, ${stats.fail} failed, ${accounts.length} total`)
}

module.exports = { runMaxsqlMigration, MIGRATION_ID }
