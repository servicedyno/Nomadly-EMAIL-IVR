// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Lifecycle Diet (audit rec #18)
// A shared throttle for UNSOLICITED marketing/promo messages so a new
// non-buyer no longer receives 5-6 pushes in the first 24h.
//
//   1. Cap unsolicited marketing to 1 per 24h per user (shared across
//      AutoPromo, cart nudge, welcome offer, browse follow-up, low-balance
//      & day-12 nudges).
//   2. Suppress AutoPromo for users < 72h old — they're still inside the
//      welcome sequence and don't need generic blasts on top.
//   3. Pause promos for anyone who hit a balance wall until they deposit
//      (the low-balance shortfall reminder is sent instead — it is exempt).
//
// Transactional/confirmation/support messages NEVER call this gate, so they
// are always delivered.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args)

const DAY_MS = 24 * 60 * 60 * 1000
const WELCOME_WINDOW_MS = 72 * 60 * 60 * 1000

function initLifecycleDiet(db) {
  const unsolicitedLog = db.collection('unsolicitedLog') // _id = chatId
  const funnelEvents = db.collection('funnelEvents')
  const conversion = db.collection('userConversion')

  // Indexes (best-effort)
  unsolicitedLog.createIndex({ lastSentAt: 1 }).catch(() => {})
  funnelEvents.createIndex({ chatId: 1, event: 1, ts: -1 }).catch(() => {})

  // ── 1-per-24h cap ────────────────────────────────────────────────
  async function isWithin24hCap(chatId) {
    try {
      const rec = await unsolicitedLog.findOne({ _id: String(chatId) })
      if (!rec?.lastSentAt) return false
      return (Date.now() - new Date(rec.lastSentAt).getTime()) < DAY_MS
    } catch { return false }
  }

  async function markUnsolicitedSent(chatId, channel = 'unknown') {
    try {
      await unsolicitedLog.updateOne(
        { _id: String(chatId) },
        { $set: { lastSentAt: new Date(), lastChannel: channel }, $inc: { count: 1 } },
        { upsert: true }
      )
    } catch (e) { log(`[LifecycleDiet] markUnsolicitedSent failed for ${chatId}: ${e.message}`) }
  }

  // ── < 72h old (still in welcome sequence) ────────────────────────
  async function isInWelcomeWindow(chatId) {
    try {
      const rec = await conversion.findOne({ chatId: String(chatId) })
      if (!rec?.joinedAt) return false
      return (Date.now() - new Date(rec.joinedAt).getTime()) < WELCOME_WINDOW_MS
    } catch { return false }
  }

  // ── Active balance wall (hit a wall, no deposit since) ───────────
  async function hasActiveBalanceWall(chatId) {
    try {
      const cid = String(chatId)
      const lastWall = await funnelEvents.find({ chatId: cid, event: 'insufficient_balance_wall' })
        .sort({ ts: -1 }).limit(1).next()
      if (!lastWall) return false
      const lastDeposit = await funnelEvents.find({ chatId: cid, event: 'deposit_confirmed' })
        .sort({ ts: -1 }).limit(1).next()
      if (lastDeposit && new Date(lastDeposit.ts).getTime() >= new Date(lastWall.ts).getTime()) return false
      return true
    } catch { return false }
  }

  // ── Master gate for a single user ────────────────────────────────
  // opts.skipWelcomeWindow — for messages that ARE the welcome sequence
  //   (welcome offer, browse follow-up) or that target old users only.
  // opts.skipBalanceWall — for the balance-wall shortfall reminder itself.
  async function canSendPromo(chatId, opts = {}) {
    const { skipWelcomeWindow = false, skipBalanceWall = false } = opts
    if (await isWithin24hCap(chatId)) return { ok: false, reason: 'cap_24h' }
    if (!skipWelcomeWindow && await isInWelcomeWindow(chatId)) return { ok: false, reason: 'welcome_window' }
    if (!skipBalanceWall && await hasActiveBalanceWall(chatId)) return { ok: false, reason: 'balance_wall' }
    return { ok: true }
  }

  // ── Batch suppression sets (used by AutoPromo blasts) ────────────
  // Returns { capped, welcome, balanceWall } Sets of chatId strings.
  async function buildSuppressionSets(chatIds) {
    const ids = (chatIds || []).map(String)
    const capped = new Set()
    const welcome = new Set()
    const balanceWall = new Set()
    if (!ids.length) return { capped, welcome, balanceWall }

    const now = Date.now()
    const dayAgo = new Date(now - DAY_MS)
    const welcomeAgo = new Date(now - WELCOME_WINDOW_MS)

    try {
      const recent = await unsolicitedLog.find(
        { _id: { $in: ids }, lastSentAt: { $gte: dayAgo } }
      ).project({ _id: 1 }).toArray()
      for (const r of recent) capped.add(String(r._id))
    } catch (e) { log(`[LifecycleDiet] cap-set query error: ${e.message}`) }

    try {
      const fresh = await conversion.find(
        { chatId: { $in: ids }, joinedAt: { $gte: welcomeAgo } }
      ).project({ chatId: 1 }).toArray()
      for (const r of fresh) welcome.add(String(r.chatId))
    } catch (e) { log(`[LifecycleDiet] welcome-set query error: ${e.message}`) }

    try {
      const walls = await funnelEvents.find(
        { chatId: { $in: ids }, event: 'insufficient_balance_wall' }
      ).project({ chatId: 1, ts: 1 }).toArray()
      if (walls.length) {
        const lastWall = new Map()
        for (const w of walls) {
          const c = String(w.chatId); const t = new Date(w.ts).getTime()
          if (!lastWall.has(c) || lastWall.get(c) < t) lastWall.set(c, t)
        }
        const wallIds = [...lastWall.keys()]
        const deposits = await funnelEvents.find(
          { chatId: { $in: wallIds }, event: 'deposit_confirmed' }
        ).project({ chatId: 1, ts: 1 }).toArray()
        const lastDep = new Map()
        for (const d of deposits) {
          const c = String(d.chatId); const t = new Date(d.ts).getTime()
          if (!lastDep.has(c) || lastDep.get(c) < t) lastDep.set(c, t)
        }
        for (const [c, wt] of lastWall) {
          const dt = lastDep.get(c)
          if (!dt || dt < wt) balanceWall.add(c)
        }
      }
    } catch (e) { log(`[LifecycleDiet] wall-set query error: ${e.message}`) }

    return { capped, welcome, balanceWall }
  }

  log(`[LifecycleDiet] Initialized — cap 1/${DAY_MS / 3600000}h, welcome window ${WELCOME_WINDOW_MS / 3600000}h, balance-wall gate active`)

  return {
    isWithin24hCap,
    markUnsolicitedSent,
    isInWelcomeWindow,
    hasActiveBalanceWall,
    canSendPromo,
    buildSuppressionSets,
    DAY_MS,
    WELCOME_WINDOW_MS,
  }
}

module.exports = { initLifecycleDiet }
