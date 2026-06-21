/**
 * P1+P13 (2026-06-21): Phase-1 extraction of admin HTTP endpoints from the
 * 38 k line `_index.js` monolith.
 *
 * Currently hosts only the recently-added endpoints (scanner-block-stats,
 * funnel-stats, scheduler-stats) — the existing 8 admin endpoints stay in
 * `_index.js` for now and will be moved in follow-up passes.
 *
 * Public surface:
 *   const adminRoutes = require('./routes/admin.js')
 *   adminRoutes.install(app, { db, log, scannerStats })
 *
 * Each endpoint reuses the same auth check: ?key= must match
 * SESSION_SECRET.slice(0,16). Don't change this without coordinating with
 * the older admin endpoints still inside _index.js.
 */
const schedReg = require('../scheduler-registry.js')

function authOk(req) {
  return req?.query?.key === process.env.SESSION_SECRET?.slice(0, 16)
}

function install(app, deps) {
  const { getDb, log, scannerStats, scannerBlockRules } = deps
  if (typeof getDb !== 'function') {
    throw new Error('routes/admin: deps.getDb must be a function that returns the current db handle')
  }

  // ── /admin/scanner-block-stats (was: inline in earlyApp) ──────────────────
  // Note: this one is also bound on `earlyApp` so it's reachable even before
  // the main `app` mounts.  We mount it here on `app` too for completeness.
  app.get('/admin/scanner-block-stats', (req, res) => {
    if (!scannerStats) return res.status(503).json({ error: 'scanner-stats not wired' })
    const byPath = [...(scannerStats.byPath.entries())].sort((a, b) => b[1] - a[1]).slice(0, 50)
    const byIp = [...(scannerStats.byIp.entries())].sort((a, b) => b[1] - a[1]).slice(0, 50)
    res.json({
      total: scannerStats.total,
      startedAt: scannerStats.startedAt,
      uptimeSec: Math.round((Date.now() - new Date(scannerStats.startedAt).getTime()) / 1000),
      topPaths: byPath.map(([path, count]) => ({ path, count })),
      topIps: byIp.map(([ip, count]) => ({ ip, count })),
      blockRules: scannerBlockRules || null,
    })
  })

  // ── /admin/scheduler-stats ────────────────────────────────────────────────
  // Returns every interval/timeout registered via scheduler-registry: when
  // each last ticked, error count, and whether it's currently running.
  app.get('/admin/scheduler-stats', (req, res) => {
    if (!authOk(req)) return res.status(403).json({ error: 'Unauthorized' })
    try {
      res.json({ success: true, ...schedReg.snapshot() })
    } catch (err) {
      log('[admin/scheduler-stats] Error:', err.message)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // ── /admin/funnel-stats ───────────────────────────────────────────────────
  // Pairs `insufficient_balance_wall` and `deposit_confirmed` events from
  // funnelEvents to compute recovery-rate.  Query: ?days=7 (1-30).
  app.get('/admin/funnel-stats', async (req, res) => {
    if (!authOk(req)) return res.status(403).json({ error: 'Unauthorized' })
    try {
      const days = Math.max(1, Math.min(30, parseInt(req.query.days, 10) || 7))
      const since = new Date(Date.now() - days * 86400_000)
      const events = await getDb().collection('funnelEvents').find({ ts: { $gte: since } }).toArray()
      const byChat = new Map()
      for (const e of events) {
        if (!byChat.has(e.chatId)) byChat.set(e.chatId, { walls: [], deposits: [] })
        if (e.event === 'insufficient_balance_wall') byChat.get(e.chatId).walls.push(e)
        else if (e.event === 'deposit_confirmed') byChat.get(e.chatId).deposits.push(e)
      }
      const stats = {
        windowDays: days,
        since,
        totalWallEvents: events.filter(e => e.event === 'insufficient_balance_wall').length,
        totalDepositConfirmed: events.filter(e => e.event === 'deposit_confirmed').length,
        distinctUsersHitWall: 0,
        distinctUsersRecovered: 0,
        stillBounced: 0,
        avgShortBy: 0,
        bouncedUsers: [],
      }
      let shortSum = 0
      let shortN = 0
      for (const [chatId, j] of byChat) {
        if (j.walls.length === 0) continue
        stats.distinctUsersHitWall++
        const firstWallTs = j.walls[0].ts
        const recovered = j.deposits.some(d => d.ts >= firstWallTs)
        if (recovered) stats.distinctUsersRecovered++
        else stats.bouncedUsers.push({
          chatId,
          wallHits: j.walls.length,
          lastShortBy: j.walls[j.walls.length - 1].shortBy,
          lastFunnel: j.walls[j.walls.length - 1].funnel,
          lastWallAt: j.walls[j.walls.length - 1].ts,
        })
        for (const w of j.walls) {
          if (typeof w.shortBy === 'number') { shortSum += w.shortBy; shortN++ }
        }
      }
      stats.stillBounced = stats.distinctUsersHitWall - stats.distinctUsersRecovered
      stats.avgShortBy = shortN ? Number((shortSum / shortN).toFixed(2)) : 0
      stats.recoveryRatePct = stats.distinctUsersHitWall
        ? Number(((stats.distinctUsersRecovered / stats.distinctUsersHitWall) * 100).toFixed(1))
        : null
      res.json({ success: true, ...stats })
    } catch (err) {
      log('[admin/funnel-stats] Error:', err.message)
      res.status(500).json({ error: 'Internal server error' })
    }
  })
}

module.exports = { install }
