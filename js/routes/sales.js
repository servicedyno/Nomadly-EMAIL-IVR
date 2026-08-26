/**
 * Sales & Profit Dashboard API
 * ---------------------------------------------------------------------------
 * Read-only admin analytics over the `transactions` collection (canonical
 * product-sales + wallet-deposit log) plus call-usage aggregates from
 * `walletLedger`. Everything is reported in USD (all transactions are USD).
 *
 * Profit model (HYBRID, approved for v1):
 *   - Domains & VPS: cost derived from the configured markup (EXACT):
 *       Domains sale = cost * (1 + PERCENT_INCREASE_DOMAIN)  => cost = amt / mult
 *       VPS     sale = cost * (1 + VPS_MARKUP_PERCENT/100)   => cost = amt / mult
 *   - Other categories: cost estimated via a per-category ratio (ESTIMATED).
 *   Each response carries an `assumptions` block so the UI can label margins.
 *
 * Auth: POST /admin/sales/login {password} -> JWT (24h, signed w/ SESSION_SECRET).
 *       All other routes require `Authorization: Bearer <token>`.
 *
 * Mounted at /admin/sales — reachable externally at <pod>/api/admin/sales/*.
 */
const express = require('express')
const jwt = require('jsonwebtoken')

// ── Flat profit-margin model ──
// The dashboard reports a single, uniform profit margin across EVERY category,
// controlled by one env var. Revenue stays real; profit = revenue * FLAT_MARGIN,
// cost = revenue * (1 - FLAT_MARGIN). Change SALES_FLAT_MARGIN_PCT to adjust what
// the bot owner sees everywhere. Default 30%.
const FLAT_MARGIN = Math.max(0, Math.min(100, Number(process.env.SALES_FLAT_MARGIN_PCT || 30))) / 100
function costProfit(revenue) {
  return { cost: revenue * (1 - FLAT_MARGIN), profit: revenue * FLAT_MARGIN }
}

// walletLedger usage types that represent real usage revenue (NOT product
// purchases already captured in `transactions` — avoids double counting).
const CALL_USAGE_TYPES = ['outbound_call', 'connection_fee', 'twilio_bridge_per_minute', 'inbound_call', 'call_recording', 'caller-name']
const SMS_USAGE_TYPES = ['sms', 'outbound_sms']
const MARKETPLACE_TYPES = ['marketplace_access']

const SALE_TYPES = new Set([
  'domain', 'hosting', 'vps', 'phone-number', 'cloudphone-subscription',
  'plan-subscription', 'virtual-card', 'digital-product', 'digital-product-purchase',
  'leads', 'purchase', 'esim',
])
const DEPOSIT_TYPES = new Set(['wallet-topup', 'topup', 'deposit'])
const BONUS_TYPES = new Set(['welcome-bonus', 'first-deposit-bonus', 'first-deposit-bonus-retro', 'admin-credit'])
const REFUND_TYPES = new Set(['refund', 'refund-reversal', 'domain-refund'])

function categoryOf(type) {
  const t = String(type || '').toLowerCase()
  if (t.startsWith('domain')) return 'Domains'
  if (t === 'hosting') return 'Hosting'
  if (t === 'vps') return 'VPS'
  if (t === 'phone-number' || t === 'cloudphone-subscription') return 'Cloud Phone'
  if (t === 'plan-subscription') return 'Subscriptions'
  if (t === 'leads') return 'Leads'
  if (t === 'virtual-card' || t.startsWith('digital-product') || t === 'esim' || t === 'purchase') return 'Digital Products'
  return 'Other'
}

// group: 'sale' | 'deposit' | 'bonus' | 'refund' | 'adjustment'
function groupOf(type) {
  const t = String(type || '').toLowerCase()
  if (REFUND_TYPES.has(t) || t.includes('refund')) return 'refund'
  if (DEPOSIT_TYPES.has(t) || t.includes('topup') || t.includes('deposit')) return 'deposit'
  if (BONUS_TYPES.has(t) || t.includes('bonus')) return 'bonus'
  if (t.includes('-credit') || t.includes('correction') || t === 'admin-credit') return 'adjustment'
  if (SALE_TYPES.has(t)) return 'sale'
  return 'adjustment'
}

function costForSale(_category, amountUsd) {
  return costProfit(amountUsd).cost
}

function normDate(v) {
  if (!v) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

function rangeToSince(range) {
  const now = Date.now()
  const DAY = 86400000
  switch (String(range || '30d')) {
    case 'today': { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d }
    case '7d': return new Date(now - 7 * DAY)
    case '30d': return new Date(now - 30 * DAY)
    case '90d': return new Date(now - 90 * DAY)
    case '1y': return new Date(now - 365 * DAY)
    case 'all': return new Date(0)
    default: return new Date(now - 30 * DAY)
  }
}
function prevWindow(range, since) {
  if (String(range) === 'all') return null
  const span = Date.now() - since.getTime()
  return { start: new Date(since.getTime() - span), end: since }
}
function dayKey(d) { return d.toISOString().slice(0, 10) }

// Normalize one raw transaction into a report row.
function normalizeTxn(doc) {
  const date = normDate(doc.createdAt) || normDate(doc.updatedAt)
  const type = doc.type
  const group = groupOf(type)
  const category = categoryOf(type)
  const amount = Number(doc.amount) || 0
  // NGN safety (in practice all rows are USD)
  const amountUsd = String(doc.currency || 'USD').toUpperCase() === 'NGN' ? amount / 1360 : amount
  const isSale = group === 'sale'
  const cost = isSale ? costForSale(category, amountUsd) : 0
  const md = doc.metadata || {}
  let product = category
  if (category === 'Domains' && md.domain) product = md.domain
  else if ((category === 'Hosting' || category === 'VPS') && md.plan) product = md.plan
  else if (category === 'Cloud Phone' && (md.plan || md.phoneNumber)) product = md.plan || md.phoneNumber
  else if (category === 'Digital Products' && (md.product || md.plan)) product = md.product || md.plan
  return {
    id: doc._id,
    chatId: String(doc.chatId || ''),
    type,
    category,
    group,
    amountUsd,
    cost,
    profit: isSale ? amountUsd - cost : 0,
    status: doc.status || 'completed',
    date,
    product,
    metadata: md,
  }
}

// ── Auth ──
function makeToken() {
  return jwt.sign({ role: 'sales-admin' }, process.env.SESSION_SECRET || 'fallback-secret', { expiresIn: '24h' })
}
function authMiddleware(req, res, next) {
  try {
    const hdr = req.headers['authorization'] || ''
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : (req.query.token || '')
    if (!token) return res.status(401).json({ error: 'Missing token' })
    const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'fallback-secret')
    if (decoded.role !== 'sales-admin') return res.status(403).json({ error: 'Forbidden' })
    req.sales = decoded
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ── Call/SMS usage aggregation from walletLedger ──
async function loadUsage(db, since, until) {
  const match = { amount: { $lt: 0 }, type: { $in: [...CALL_USAGE_TYPES, ...SMS_USAGE_TYPES, ...MARKETPLACE_TYPES] } }
  match.timestamp = { $gte: since }
  if (until) match.timestamp.$lte = until
  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: { type: '$type', day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } } },
        revenue: { $sum: { $abs: '$amount' } },
        count: { $sum: 1 },
      },
    },
  ]
  const rows = await db.collection('walletLedger').aggregate(pipeline, { allowDiskUse: true }).toArray()
  // shape: per day per category
  const byDay = {} // day -> { Calls:{rev,count}, SMS:{}, Marketplace:{} }
  const byCat = {}
  let total = 0
  for (const r of rows) {
    const t = r._id.type
    const cat = CALL_USAGE_TYPES.includes(t) ? 'Calls' : (SMS_USAGE_TYPES.includes(t) ? 'SMS' : 'Marketplace')
    const day = r._id.day
    byDay[day] = byDay[day] || {}
    byDay[day][cat] = (byDay[day][cat] || 0) + r.revenue
    byCat[cat] = byCat[cat] || { revenue: 0, count: 0 }
    byCat[cat].revenue += r.revenue
    byCat[cat].count += r.count
    total += r.revenue
  }
  return { byDay, byCat, total }
}

// ── Core report builder ──
function buildReport(rows, usage, since, until) {
  const sales = rows.filter((r) => r.group === 'sale')
  const refunds = rows.filter((r) => r.group === 'refund')
  const deposits = rows.filter((r) => r.group === 'deposit')
  const bonuses = rows.filter((r) => r.group === 'bonus')

  let grossRevenue = 0, totalCost = 0
  const catMap = {}
  const addCat = (cat, revenue, cost, count) => {
    catMap[cat] = catMap[cat] || { category: cat, revenue: 0, cost: 0, profit: 0, orders: 0 }
    catMap[cat].revenue += revenue
    catMap[cat].cost += cost
    catMap[cat].profit += revenue - cost
    catMap[cat].orders += count
  }
  for (const s of sales) {
    grossRevenue += s.amountUsd
    totalCost += s.cost
    addCat(s.category, s.amountUsd, s.cost, 1)
  }
  // fold in usage (calls / sms / marketplace) — flat margin
  for (const [cat, u] of Object.entries(usage.byCat)) {
    const cost = costProfit(u.revenue).cost
    grossRevenue += u.revenue
    totalCost += cost
    addCat(cat, u.revenue, cost, u.count)
  }

  const refundTotal = refunds.reduce((a, r) => a + r.amountUsd, 0)
  const depositTotal = deposits.reduce((a, r) => a + r.amountUsd, 0)
  const bonusTotal = bonuses.reduce((a, r) => a + r.amountUsd, 0)
  const orders = sales.length

  // timeseries (by day)
  const tsMap = {}
  const bump = (day, rev, cost) => {
    tsMap[day] = tsMap[day] || { date: day, revenue: 0, cost: 0, profit: 0, orders: 0 }
    tsMap[day].revenue += rev
    tsMap[day].cost += cost
    tsMap[day].profit += rev - cost
  }
  for (const s of sales) {
    if (!s.date) continue
    const day = dayKey(s.date)
    bump(day, s.amountUsd, s.cost)
    tsMap[day].orders += 1
  }
  for (const [day, cats] of Object.entries(usage.byDay)) {
    for (const [cat, rev] of Object.entries(cats)) {
      bump(day, rev, costProfit(rev).cost)
    }
  }
  const timeseries = Object.values(tsMap).sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      revenue: round2(d.revenue),
      cost: round2(d.cost),
      profit: round2(d.profit),
      orders: d.orders,
    }))

  // weekly profit totals (Monday-start ISO weeks, aggregated from daily series)
  const wkMap = {}
  for (const d of timeseries) {
    const wk = weekStart(d.date)
    wkMap[wk] = wkMap[wk] || { weekStart: wk, revenue: 0, cost: 0, profit: 0, orders: 0 }
    wkMap[wk].revenue += d.revenue
    wkMap[wk].cost += d.cost
    wkMap[wk].profit += d.profit
    wkMap[wk].orders += d.orders
  }
  const weekly = Object.values(wkMap).sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .map((w) => ({
      weekStart: w.weekStart,
      label: weekLabel(w.weekStart),
      revenue: round2(w.revenue),
      cost: round2(w.cost),
      profit: round2(w.profit),
      orders: w.orders,
    }))

  // top products
  const prodMap = {}
  for (const s of sales) {
    const key = `${s.category}::${s.product}`
    prodMap[key] = prodMap[key] || { product: s.product, category: s.category, revenue: 0, profit: 0, orders: 0 }
    prodMap[key].revenue += s.amountUsd
    prodMap[key].profit += s.profit
    prodMap[key].orders += 1
  }
  const topProducts = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
    .map((p) => ({ ...p, revenue: round2(p.revenue), profit: round2(p.profit) }))

  // top customers
  const custMap = {}
  for (const s of sales) {
    custMap[s.chatId] = custMap[s.chatId] || { chatId: s.chatId, revenue: 0, profit: 0, orders: 0 }
    custMap[s.chatId].revenue += s.amountUsd
    custMap[s.chatId].profit += s.profit
    custMap[s.chatId].orders += 1
  }
  const topCustomers = Object.values(custMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
    .map((c) => ({ ...c, revenue: round2(c.revenue), profit: round2(c.profit) }))

  const byCategory = Object.values(catMap).sort((a, b) => b.revenue - a.revenue).map((c) => ({
    category: c.category,
    revenue: round2(c.revenue),
    cost: round2(c.cost),
    profit: round2(c.profit),
    orders: c.orders,
  }))

  return {
    summary: {
      grossRevenue: round2(grossRevenue),
      totalCost: round2(totalCost),
      netProfit: round2(grossRevenue - totalCost),
      orders,
      avgOrderValue: orders > 0 ? round2(grossRevenue / orders) : 0,
      refunds: round2(Math.abs(refundTotal)),
      deposits: round2(depositTotal),
      bonuses: round2(bonusTotal),
      thisWeekProfit: weekly.length ? weekly[weekly.length - 1].profit : 0,
    },
    byCategory,
    timeseries,
    weekly,
    topProducts,
    topCustomers,
  }
}

// Monday-start week helpers
function weekStart(dayStr) {
  const d = new Date(dayStr + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7 // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}
function weekLabel(startStr) {
  const s = new Date(startStr + 'T00:00:00Z')
  const e = new Date(s); e.setUTCDate(e.getUTCDate() + 6)
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${mon[s.getUTCMonth()]} ${s.getUTCDate()}–${mon[e.getUTCMonth()]} ${e.getUTCDate()}`
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100 }
function round1(n) { return Math.round((Number(n) || 0) * 10) / 10 }

function install(app, deps) {
  const { getDb, log } = deps
  const router = express.Router()
  router.use(express.json({ limit: '1mb' }))

  const logIt = (...a) => { try { (log || console.log)('[SalesDash]', ...a) } catch (_) { /* noop */ } }

  // ── Login ──
  router.post('/login', (req, res) => {
    const password = (req.body && req.body.password) || req.query.password || req.headers['x-sales-password']
    const expected = process.env.SALES_DASHBOARD_PASSWORD
    if (!expected) return res.status(500).json({ error: 'Dashboard password not configured' })
    if (!password || String(password) !== String(expected)) {
      return res.status(401).json({ error: 'Incorrect password' })
    }
    return res.json({ token: makeToken(), expiresIn: 86400 })
  })

  // ── Overview (KPIs + category + timeseries + tops) ──
  router.get('/overview', authMiddleware, async (req, res) => {
    try {
      const db = getDb()
      if (!db) return res.status(503).json({ error: 'DB not ready' })
      const range = req.query.range || '30d'
      const since = rangeToSince(range)
      const until = new Date()

      const raw = await db.collection('transactions')
        .find({}, { projection: { _id: 1, chatId: 1, type: 1, amount: 1, currency: 1, status: 1, metadata: 1, createdAt: 1, updatedAt: 1 } })
        .toArray()
      const normalized = raw.map(normalizeTxn).filter((r) => r.date && r.date >= since && r.date <= until)

      const usage = await loadUsage(db, since, until)
      const report = buildReport(normalized, usage, since, until)

      // period-over-period deltas
      let deltas = null
      const pw = prevWindow(range, since)
      if (pw) {
        const prevNorm = raw.map(normalizeTxn).filter((r) => r.date && r.date >= pw.start && r.date < pw.end)
        const prevUsage = await loadUsage(db, pw.start, pw.end)
        const prev = buildReport(prevNorm, prevUsage, pw.start, pw.end)
        const pct = (cur, old) => (old > 0 ? round1(((cur - old) / old) * 100) : (cur > 0 ? 100 : 0))
        deltas = {
          grossRevenue: pct(report.summary.grossRevenue, prev.summary.grossRevenue),
          netProfit: pct(report.summary.netProfit, prev.summary.netProfit),
          orders: pct(report.summary.orders, prev.summary.orders),
          avgOrderValue: pct(report.summary.avgOrderValue, prev.summary.avgOrderValue),
        }
      }

      // attach customer names for top customers
      try {
        const ids = report.topCustomers.map((c) => c.chatId)
        if (ids.length) {
          const names = await db.collection('nameOf').find({ _id: { $in: ids } }).toArray()
          const nameMap = {}
          for (const n of names) nameMap[String(n._id)] = n.val
          report.topCustomers = report.topCustomers.map((c) => ({ ...c, name: nameMap[c.chatId] || null }))
        }
      } catch (_) { /* names optional */ }

      // bot-user stats + conversion funnel (join-cohort within range): joined → deposited → purchased
      let userStats = null
      let funnel = null
      try {
        const convDocs = await db.collection('userConversion')
          .find({}, { projection: { chatId: 1, joinedAt: 1, hasPurchased: 1 } }).toArray()
        // nameOf holds one doc per chatId that ever messaged the bot — the most complete "joined" signal
        const nameIds = await db.collection('nameOf').find({}, { projection: { _id: 1 } }).toArray()
        const joinedAtMap = {}
        for (const c of convDocs) joinedAtMap[String(c.chatId)] = normDate(c.joinedAt)
        const allIds = new Set(nameIds.map((n) => String(n._id)))
        for (const c of convDocs) allIds.add(String(c.chatId))

        // cohort = users who joined within the selected range (nameOf-only users have no join
        // date, so they only count when range = 'all')
        const inRange = (cid) => {
          const d = joinedAtMap[cid]
          if (d) return d >= since && d <= until
          return String(range) === 'all'
        }
        const cohortSet = new Set([...allIds].filter(inRange))
        const purchasedUsers = convDocs.filter((c) => c.hasPurchased).length
        userStats = { totalUsers: allIds.size, newUsers: cohortSet.size, purchasedUsers }

        // funnel: of the joined cohort, how many deposited real funds / made a purchase
        const depositedSet = new Set()
        const purchasedSet = new Set()
        for (const doc of raw) {
          const cid = String(doc.chatId || '')
          if (!cohortSet.has(cid)) continue
          const r = normalizeTxn(doc)
          if (r.group === 'deposit' && r.amountUsd > 0) depositedSet.add(cid)
          if (r.group === 'sale') purchasedSet.add(cid)
        }
        funnel = { joined: cohortSet.size, deposited: depositedSet.size, purchased: purchasedSet.size }
      } catch (_) { /* optional */ }

      res.json({
        range,
        generatedAt: new Date().toISOString(),
        ...report,
        deltas,
        userStats,
        funnel,
        flatMarginPct: Math.round(FLAT_MARGIN * 1000) / 10,
      })
    } catch (e) {
      logIt('overview error:', e.message)
      res.status(500).json({ error: e.message })
    }
  })

  // ── Transactions list (product orders from `transactions`) ──
  router.get('/transactions', authMiddleware, async (req, res) => {
    try {
      const db = getDb()
      if (!db) return res.status(503).json({ error: 'DB not ready' })
      const range = req.query.range || '30d'
      const since = rangeToSince(range)
      const groupFilter = (req.query.group || '').toLowerCase() // sale|deposit|bonus|refund|adjustment|''
      const catFilter = req.query.category || ''
      const statusFilter = req.query.status || ''
      const search = String(req.query.search || '').toLowerCase().trim()
      const page = Math.max(1, parseInt(req.query.page, 10) || 1)
      const limit = Math.min(200, Math.max(10, parseInt(req.query.limit, 10) || 50))

      const raw = await db.collection('transactions').find({}).toArray()
      let rows = raw.map(normalizeTxn).filter((r) => r.date && r.date >= since)
      if (groupFilter) rows = rows.filter((r) => r.group === groupFilter)
      if (catFilter) rows = rows.filter((r) => r.category === catFilter)
      if (statusFilter) rows = rows.filter((r) => String(r.status) === statusFilter)
      if (search) {
        rows = rows.filter((r) =>
          String(r.id).toLowerCase().includes(search) ||
          String(r.chatId).toLowerCase().includes(search) ||
          String(r.product).toLowerCase().includes(search) ||
          String(r.type).toLowerCase().includes(search) ||
          JSON.stringify(r.metadata || {}).toLowerCase().includes(search))
      }
      rows.sort((a, b) => b.date - a.date)
      const total = rows.length
      const paged = rows.slice((page - 1) * limit, page * limit).map((r) => ({
        id: r.id,
        date: r.date ? r.date.toISOString() : null,
        type: r.type,
        category: r.category,
        group: r.group,
        chatId: r.chatId,
        product: r.product,
        amountUsd: round2(r.amountUsd),
        cost: round2(r.cost),
        profit: round2(r.profit),
        status: r.status,
      }))
      res.json({ total, page, limit, pages: Math.ceil(total / limit), rows: paged })
    } catch (e) {
      logIt('transactions error:', e.message)
      res.status(500).json({ error: e.message })
    }
  })

  // ── CSV export ──
  router.get('/export.csv', authMiddleware, async (req, res) => {
    try {
      const db = getDb()
      if (!db) return res.status(503).json({ error: 'DB not ready' })
      const range = req.query.range || '30d'
      const since = rangeToSince(range)
      const groupFilter = (req.query.group || '').toLowerCase()
      const catFilter = req.query.category || ''
      const statusFilter = req.query.status || ''
      const search = String(req.query.search || '').toLowerCase().trim()

      const raw = await db.collection('transactions').find({}).toArray()
      let rows = raw.map(normalizeTxn).filter((r) => r.date && r.date >= since)
      if (groupFilter) rows = rows.filter((r) => r.group === groupFilter)
      if (catFilter) rows = rows.filter((r) => r.category === catFilter)
      if (statusFilter) rows = rows.filter((r) => String(r.status) === statusFilter)
      if (search) {
        rows = rows.filter((r) =>
          String(r.id).toLowerCase().includes(search) ||
          String(r.chatId).toLowerCase().includes(search) ||
          String(r.product).toLowerCase().includes(search) ||
          String(r.type).toLowerCase().includes(search))
      }
      rows.sort((a, b) => b.date - a.date)
      const esc = (v) => {
        const s = v == null ? '' : String(v)
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
      }
      const header = ['TransactionID', 'Date', 'Type', 'Category', 'Group', 'CustomerChatId', 'Product', 'AmountUSD', 'CostUSD', 'ProfitUSD', 'Status']
      const lines = [header.join(',')]
      for (const r of rows) {
        lines.push([
          esc(r.id), esc(r.date ? r.date.toISOString() : ''), esc(r.type), esc(r.category), esc(r.group),
          esc(r.chatId), esc(r.product), round2(r.amountUsd), round2(r.cost), round2(r.profit),
          esc(r.status),
        ].join(','))
      }
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="nomadly-sales-${range}-${Date.now()}.csv"`)
      res.send(lines.join('\n'))
    } catch (e) {
      logIt('export error:', e.message)
      res.status(500).json({ error: e.message })
    }
  })

  // ── Bot Users (everyone who joined the bot) + per-user order stats ──
  // Builds a row per known chatId: username, join date, language, wallet balance,
  // order count, total spent, last order + deposit/bonus/refund totals. Sourced from
  // userConversion (joinedAt/lang/hasPurchased) ∪ nameOf (username) ∪ transactions.
  async function buildUserIndex(db) {
    const [conv, names, wallets, txns, welcomeBonusDocs] = await Promise.all([
      db.collection('userConversion').find({}, { projection: { chatId: 1, joinedAt: 1, lang: 1, hasPurchased: 1 } }).toArray(),
      db.collection('nameOf').find({}).toArray(),
      db.collection('walletOf').find({}).toArray(),
      db.collection('transactions').find({}).toArray(),
      db.collection('welcomeBonuses').find({}, { projection: { chatId: 1, bonusAmount: 1 } }).toArray(),
    ])
    const nameMap = {}
    for (const n of names) nameMap[String(n._id)] = n.val
    const walletMap = {}
    for (const w of wallets) walletMap[String(w._id)] = (Number(w.usdIn) || 0) - (Number(w.usdOut) || 0)
    // Ground-truth "welcome bonus received" map (from welcomeBonuses collection —
    // one doc per user who ever received the $WELCOME_BONUS_USD gift)
    const welcomeBonusMap = {}
    for (const w of welcomeBonusDocs) welcomeBonusMap[String(w.chatId)] = Number(w.bonusAmount) || 0

    const agg = {}
    const ensure = (cid) => (agg[cid] = agg[cid] || { orders: 0, totalSpent: 0, deposits: 0, bonuses: 0, refunds: 0, lastOrderDate: null, firstTxnDate: null, txnCount: 0 })
    for (const doc of txns) {
      const cid = String(doc.chatId || '')
      if (!cid) continue
      const r = normalizeTxn(doc)
      const a = ensure(cid)
      a.txnCount += 1
      if (r.date && (!a.firstTxnDate || r.date < a.firstTxnDate)) a.firstTxnDate = r.date
      if (r.group === 'sale') {
        a.orders += 1
        a.totalSpent += r.amountUsd
        if (r.date && (!a.lastOrderDate || r.date > a.lastOrderDate)) a.lastOrderDate = r.date
      } else if (r.group === 'deposit') a.deposits += r.amountUsd
      else if (r.group === 'bonus') a.bonuses += r.amountUsd
      else if (r.group === 'refund') a.refunds += Math.abs(r.amountUsd)
    }

    const convMap = {}
    for (const c of conv) convMap[String(c.chatId)] = c
    const ids = new Set()
    for (const c of conv) ids.add(String(c.chatId))
    for (const n of names) ids.add(String(n._id))
    for (const cid of Object.keys(agg)) ids.add(cid)

    const rows = []
    for (const cid of ids) {
      const c = convMap[cid] || {}
      const a = agg[cid] || {}
      const joinedAt = normDate(c.joinedAt) || a.firstTxnDate || null
      const balance = round2(walletMap[cid] || 0)
      const deposits = round2(a.deposits || 0)
      const bonuses = round2(a.bonuses || 0)
      const welcomeBonus = round2(welcomeBonusMap[cid] || 0)
      // "Bonus-only" wallet — user has never deposited real funds AND everything
      // in their wallet is still (unspent) promotional credit. Small epsilon lets
      // rounding artifacts like $4.999… still qualify.
      const bonusOnly = deposits === 0 && balance > 0 && balance <= bonuses + 0.01
      const bonusRemaining = bonusOnly ? Math.min(balance, bonuses) : 0
      rows.push({
        chatId: cid,
        name: nameMap[cid] || null,
        joinedAt,
        lang: c.lang || null,
        balance,
        orders: a.orders || 0,
        totalSpent: round2(a.totalSpent || 0),
        lastOrderDate: a.lastOrderDate || null,
        deposits,
        bonuses,
        refunds: round2(a.refunds || 0),
        welcomeBonus,
        bonusOnly,
        bonusRemaining: round2(bonusRemaining),
        hasPurchased: (a.orders || 0) > 0 || !!c.hasPurchased,
      })
    }
    return rows
  }

  router.get('/users', authMiddleware, async (req, res) => {
    try {
      const db = getDb()
      if (!db) return res.status(503).json({ error: 'DB not ready' })
      const range = req.query.range || 'all'
      const since = rangeToSince(range)
      const search = String(req.query.search || '').toLowerCase().trim()
      const sort = String(req.query.sort || 'joinedAt')
      const dir = String(req.query.dir || 'desc') === 'asc' ? 1 : -1
      const onlyNew = String(req.query.onlyNew || '') === 'true'
      const page = Math.max(1, parseInt(req.query.page, 10) || 1)
      const limit = Math.min(200, Math.max(10, parseInt(req.query.limit, 10) || 25))

      let rows = await buildUserIndex(db)
      const totalUsers = rows.length
      const newUsers = rows.filter((r) => r.joinedAt && r.joinedAt >= since).length
      const purchasedUsers = rows.filter((r) => r.hasPurchased).length

      if (onlyNew) rows = rows.filter((r) => r.joinedAt && r.joinedAt >= since)
      if (search) {
        rows = rows.filter((r) =>
          String(r.chatId).toLowerCase().includes(search) ||
          String(r.name || '').toLowerCase().includes(search))
      }
      const t = (d) => (d ? d.getTime() : 0)
      const cmp = {
        joinedAt: (a, b) => t(a.joinedAt) - t(b.joinedAt),
        balance: (a, b) => a.balance - b.balance,
        spent: (a, b) => a.totalSpent - b.totalSpent,
        orders: (a, b) => a.orders - b.orders,
        lastOrder: (a, b) => t(a.lastOrderDate) - t(b.lastOrderDate),
        name: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
      }
      const base = cmp[sort] || cmp.joinedAt
      rows.sort((a, b) => dir * base(a, b))

      const total = rows.length
      const paged = rows.slice((page - 1) * limit, page * limit).map((r) => ({
        ...r,
        joinedAt: r.joinedAt ? r.joinedAt.toISOString() : null,
        lastOrderDate: r.lastOrderDate ? r.lastOrderDate.toISOString() : null,
      }))
      res.json({ total, page, limit, pages: Math.ceil(total / limit), totalUsers, newUsers, purchasedUsers, rows: paged })
    } catch (e) {
      logIt('users error:', e.message)
      res.status(500).json({ error: e.message })
    }
  })

  // Per-user drill-down: full profile + complete order/transaction history.
  router.get('/users/:chatId', authMiddleware, async (req, res) => {
    try {
      const db = getDb()
      if (!db) return res.status(503).json({ error: 'DB not ready' })
      const chatId = String(req.params.chatId || '')
      const [conv, nameDoc, wallet, txnDocs, welcomeDoc] = await Promise.all([
        db.collection('userConversion').findOne({ chatId }),
        db.collection('nameOf').findOne({ _id: chatId }),
        db.collection('walletOf').findOne({ _id: chatId }),
        db.collection('transactions').find({ chatId }).toArray(),
        db.collection('welcomeBonuses').findOne({ chatId }),
      ])
      const txns = txnDocs.map(normalizeTxn).sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0))
      const sales = txns.filter((t) => t.group === 'sale')
      const balanceRaw = wallet ? (Number(wallet.usdIn) || 0) - (Number(wallet.usdOut) || 0) : 0
      const balance = round2(balanceRaw)
      const joinedAt = (conv && normDate(conv.joinedAt))
        || (txns.length ? txns[txns.length - 1].date : null)
      const deposits = round2(txns.filter((x) => x.group === 'deposit').reduce((a, x) => a + x.amountUsd, 0))
      const bonuses = round2(txns.filter((x) => x.group === 'bonus').reduce((a, x) => a + x.amountUsd, 0))
      const welcomeBonus = round2(welcomeDoc ? (Number(welcomeDoc.bonusAmount) || 0) : 0)
      const refunds = round2(txns.filter((x) => x.group === 'refund').reduce((a, x) => a + Math.abs(x.amountUsd), 0))
      // Purely promotional wallet — no real deposits AND balance still ≤ total bonuses
      const bonusOnly = deposits === 0 && balance > 0 && balance <= bonuses + 0.01
      const bonusRemaining = round2(bonusOnly ? Math.min(balance, bonuses) : 0)
      res.json({
        profile: {
          chatId,
          name: nameDoc ? nameDoc.val : null,
          joinedAt: joinedAt ? joinedAt.toISOString() : null,
          lang: conv ? conv.lang : null,
          balance,
          hasPurchased: sales.length > 0 || !!(conv && conv.hasPurchased),
          orders: sales.length,
          totalSpent: round2(sales.reduce((a, x) => a + x.amountUsd, 0)),
          deposits,
          bonuses,
          refunds,
          welcomeBonus,
          bonusOnly,
          bonusRemaining,
        },
        transactions: txns.map((x) => ({
          id: x.id,
          date: x.date ? x.date.toISOString() : null,
          type: x.type,
          category: x.category,
          group: x.group,
          product: x.product,
          amountUsd: round2(x.amountUsd),
          profit: round2(x.profit),
          status: x.status,
        })),
      })
    } catch (e) {
      logIt('user detail error:', e.message)
      res.status(500).json({ error: e.message })
    }
  })

  app.use('/admin/sales', router)
  logIt('Sales dashboard routes mounted at /admin/sales')
}

module.exports = { install }
