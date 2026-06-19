/* global process */
/**
 * store-routes.js — Public Web Storefront (Phase 1: account + wallet + crypto top-up)
 * Mounted at /store (reached via /api/store/* through the FastAPI proxy).
 *
 * Independent of the Telegram bot. Uses SEPARATE collections so the bot's
 * wallet/accounting (walletOf, etc.) is never touched:
 *   - webUsers       : { _id, email, passwordHash, walletUsd, createdAt, lastLogin }
 *   - webWalletTxns  : ledger of every balance change
 *   - webOrders      : crypto top-up / purchase intents (durable; survives restarts)
 *
 * Crypto: DynoPay primary, BlockBee fallback. Min top-up $10 (USDT-TRC20 $20).
 */

const express = require('express')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { log } = require('console')

const { getDynopayCryptoAddress, getDynopayCryptoPaymentStatus } = require('./pay-dynopay')
const { getCryptoDepositAddress, convert } = require('./pay-blockbee')

const JWT_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')
const JWT_EXPIRY = '30d'

// Supported coins + min top-up (USD). USDT-TRC20 has a higher floor per requirement.
const COINS = [
  { code: 'BTC', name: 'Bitcoin', min: 10, bbTicker: 'btc' },
  { code: 'ETH', name: 'Ethereum', min: 10, bbTicker: 'eth' },
  { code: 'LTC', name: 'Litecoin', min: 10, bbTicker: 'ltc' },
  { code: 'DOGE', name: 'Dogecoin', min: 10, bbTicker: 'doge' },
  { code: 'USDT-TRC20', name: 'USDT (TRC20)', min: 20, bbTicker: 'trc20_usdt' },
  { code: 'USDT-ERC20', name: 'USDT (ERC20)', min: 10, bbTicker: 'erc20_usdt' },
  { code: 'BCH', name: 'Bitcoin Cash', min: 10, bbTicker: 'bch' },
  { code: 'TRX', name: 'TRON', min: 10, bbTicker: 'trx' },
]
const coinByCode = (c) => COINS.find(x => x.code === String(c || '').toUpperCase())

const uuid = () => crypto.randomUUID()
const now = () => new Date()

function signToken(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY }) }
function verifyToken(token) { try { return jwt.verify(token, JWT_SECRET) } catch { return null } }

/**
 * @param {object} deps
 * @param {Function} deps.getDb  - returns the connected Mongo db handle
 * @param {string}   deps.selfUrl - webhook base (already includes /api)
 * @param {Function} [deps.notifyAdmin]
 */
function createStoreRoutes(deps = {}) {
  const router = express.Router()
  const getDb = deps.getDb
  const SELF_URL = deps.selfUrl || process.env.SELF_URL
  const notifyAdmin = typeof deps.notifyAdmin === 'function' ? deps.notifyAdmin : (() => {})

  const col = (name) => {
    const db = getDb && getDb()
    if (!db) throw new Error('DB not ready')
    return db.collection(name)
  }

  // ── Auth middleware ──
  function webAuth(req, res, next) {
    const h = req.headers.authorization || ''
    if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
    const decoded = verifyToken(h.slice(7))
    if (!decoded?.webUserId) return res.status(401).json({ error: 'Session expired. Please log in again.' })
    req.webUserId = decoded.webUserId
    req.webEmail = decoded.email
    next()
  }

  const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim())

  async function publicUser(uId) {
    const u = await col('webUsers').findOne({ _id: uId })
    if (!u) return null
    return { id: u._id, email: u.email, walletUsd: Number(u.walletUsd || 0) }
  }

  // ─────────────────────────── AUTH ───────────────────────────
  router.post('/auth/signup', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase()
      const password = String(req.body?.password || '')
      if (!emailOk(email)) return res.status(400).json({ error: 'A valid email is required.' })
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' })

      const existing = await col('webUsers').findOne({ email })
      if (existing) return res.status(409).json({ error: 'An account with this email already exists. Please log in.' })

      const passwordHash = await bcrypt.hash(password, 10)
      const doc = { _id: uuid(), email, passwordHash, walletUsd: 0, createdAt: now(), lastLogin: now() }
      await col('webUsers').insertOne(doc)
      const token = signToken({ webUserId: doc._id, email })
      log(`[Store] signup ${email} (${doc._id})`)
      return res.json({ token, user: { id: doc._id, email, walletUsd: 0 } })
    } catch (err) {
      log(`[Store] signup error: ${err.message}`)
      return res.status(500).json({ error: 'Could not create account. Try again shortly.' })
    }
  })

  router.post('/auth/login', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase()
      const password = String(req.body?.password || '')
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' })
      const u = await col('webUsers').findOne({ email })
      if (!u || !(await bcrypt.compare(password, u.passwordHash))) {
        return res.status(401).json({ error: 'Invalid email or password.' })
      }
      await col('webUsers').updateOne({ _id: u._id }, { $set: { lastLogin: now() } })
      const token = signToken({ webUserId: u._id, email })
      return res.json({ token, user: { id: u._id, email: u.email, walletUsd: Number(u.walletUsd || 0) } })
    } catch (err) {
      log(`[Store] login error: ${err.message}`)
      return res.status(500).json({ error: 'Login failed. Try again shortly.' })
    }
  })

  router.get('/auth/me', webAuth, async (req, res) => {
    const u = await publicUser(req.webUserId)
    if (!u) return res.status(404).json({ error: 'Account not found' })
    res.json({ user: u })
  })

  // ─────────────────────────── WALLET ───────────────────────────
  router.get('/wallet', webAuth, async (req, res) => {
    try {
      const u = await publicUser(req.webUserId)
      if (!u) return res.status(404).json({ error: 'Account not found' })
      const txns = await col('webWalletTxns').find({ webUserId: req.webUserId })
        .sort({ createdAt: -1 }).limit(25).toArray()
      res.json({
        balanceUsd: u.walletUsd,
        coins: COINS.map(c => ({ code: c.code, name: c.name, min: c.min })),
        txns: txns.map(t => ({
          id: t._id, type: t.type, amountUsd: t.amountUsd, balanceAfter: t.balanceAfter,
          coin: t.coin || null, status: t.status || 'done', note: t.note || '', createdAt: t.createdAt,
        })),
      })
    } catch (err) {
      log(`[Store] wallet error: ${err.message}`)
      res.status(500).json({ error: 'Could not load wallet.' })
    }
  })

  // Create a crypto top-up intent → returns a deposit address to send funds to.
  router.post('/wallet/topup', webAuth, async (req, res) => {
    try {
      const amountUsd = Number(req.body?.amountUsd)
      const coin = coinByCode(req.body?.coin)
      if (!coin) return res.status(400).json({ error: 'Unsupported coin.' })
      if (!Number.isFinite(amountUsd)) return res.status(400).json({ error: 'A valid amount is required.' })
      if (amountUsd < coin.min) {
        return res.status(400).json({ error: `Minimum top-up for ${coin.name} is $${coin.min}.`, min: coin.min })
      }

      const orderId = uuid()
      const webhookUrl = `${SELF_URL}/store/crypto-webhook`
      const order = {
        _id: orderId, webUserId: req.webUserId, kind: 'wallet_topup',
        amountUsd, coin: coin.code, provider: 'dynopay', status: 'pending',
        payAddress: null, paymentId: null, usdCredited: 0, createdAt: now(), updatedAt: now(),
      }

      // 1) DynoPay (primary)
      let address = null
      try {
        const dyno = await getDynopayCryptoAddress(amountUsd, coin.code, webhookUrl, {
          product_name: 'wallet_topup', refId: orderId, kind: 'wallet_topup', webUserId: req.webUserId,
        })
        if (dyno && !dyno.error && (dyno.address || dyno.wallet_address)) {
          address = dyno.address || dyno.wallet_address
          order.paymentId = dyno.payment_id || dyno.id || null
        } else {
          log(`[Store] DynoPay topup failed (${JSON.stringify(dyno).slice(0,160)}) — trying BlockBee`)
        }
      } catch (e) { log(`[Store] DynoPay topup threw: ${e.message} — trying BlockBee`) }

      // 2) BlockBee (fallback) — callback carries orderId in query string
      if (!address) {
        try {
          const bbCb = `/store/blockbee-webhook?order=${orderId}&`
          const bb = await getCryptoDepositAddress(coin.bbTicker, orderId, SELF_URL, bbCb)
          if (bb?.address) { address = bb.address; order.provider = 'blockbee' }
        } catch (e) { log(`[Store] BlockBee fallback threw: ${e.message}`) }
      }

      if (!address) {
        return res.status(502).json({ error: 'Payment provider unavailable right now. Please try again shortly.' })
      }

      order.payAddress = address
      await col('webOrders').insertOne(order)
      log(`[Store] topup order ${orderId} ${coin.code} $${amountUsd} via ${order.provider} addr=${String(address).slice(0,12)}…`)
      return res.json({
        orderId, coin: coin.code, amountUsd, provider: order.provider,
        address, status: 'pending',
      })
    } catch (err) {
      log(`[Store] topup error: ${err.message}`)
      res.status(500).json({ error: 'Could not start top-up. Try again shortly.' })
    }
  })

  // Poll a top-up's status (webhook is primary; this is a fallback the UI polls).
  router.get('/wallet/topup/:orderId', webAuth, async (req, res) => {
    try {
      const order = await col('webOrders').findOne({ _id: req.params.orderId, webUserId: req.webUserId })
      if (!order) return res.status(404).json({ error: 'Order not found' })
      // Best-effort live check for DynoPay if still pending
      if (order.status === 'pending' && order.provider === 'dynopay' && order.payAddress) {
        try {
          const st = await getDynopayCryptoPaymentStatus(order.payAddress)
          if (st && (st.status === 'completed' || st.status === 'confirmed' || st.status === 'settled')) {
            await creditTopup(order, st.base_amount, st.fee_payer, order.paymentId || st.payment_id, 'poll')
          }
        } catch (_) {}
      }
      const fresh = await col('webOrders').findOne({ _id: req.params.orderId })
      const u = await publicUser(req.webUserId)
      res.json({ orderId: fresh._id, status: fresh.status, usdCredited: fresh.usdCredited || 0, balanceUsd: u?.walletUsd || 0 })
    } catch (err) {
      log(`[Store] topup status error: ${err.message}`)
      res.status(500).json({ error: 'Could not fetch status.' })
    }
  })

  // ── Shared credit routine (idempotent) ──
  async function creditTopup(order, baseAmount, feePayer, paymentId, source) {
    // Idempotency: only credit a pending order once.
    const claim = await col('webOrders').findOneAndUpdate(
      { _id: order._id, status: 'pending' },
      { $set: { status: 'crediting', paymentId: paymentId || order.paymentId, updatedAt: now() } },
      { returnDocument: 'after' }
    )
    const claimed = claim && (claim.value || claim) // driver version compat
    if (!claimed || (claimed.status && claimed.status !== 'crediting')) {
      log(`[Store] creditTopup ${order._id}: already processed (${source}) — skipping`)
      return false
    }

    // USD to credit: trust DynoPay's confirmed USD (base_amount) when company pays fees;
    // otherwise fall back to the order's requested amount (wallet top-up = credit what's owed).
    let usdIn
    if (baseAmount && (feePayer === 'company' || feePayer == null)) usdIn = parseFloat(baseAmount)
    if (!Number.isFinite(usdIn) || usdIn <= 0) usdIn = Number(order.amountUsd)
    usdIn = Math.round(usdIn * 100) / 100

    const upd = await col('webUsers').findOneAndUpdate(
      { _id: order.webUserId },
      { $inc: { walletUsd: usdIn } },
      { returnDocument: 'after' }
    )
    const userDoc = upd && (upd.value || upd)
    const balanceAfter = Number(userDoc?.walletUsd || 0)

    await col('webWalletTxns').insertOne({
      _id: uuid(), webUserId: order.webUserId, type: 'topup', amountUsd: usdIn,
      balanceAfter, coin: order.coin, provider: order.provider, orderId: order._id,
      status: 'done', note: `Crypto top-up (${source})`, createdAt: now(),
    })
    await col('webOrders').updateOne({ _id: order._id }, { $set: { status: 'credited', usdCredited: usdIn, updatedAt: now() } })
    log(`[Store] CREDITED $${usdIn} to ${order.webUserId} (order ${order._id}, ${source}). Balance=$${balanceAfter}`)
    try { notifyAdmin(`💰 <b>Web wallet top-up</b>\nUser: ${order.webUserId}\nAmount: $${usdIn} (${order.coin})\nProvider: ${order.provider}`) } catch {}
    return true
  }

  // ── DynoPay webhook (durable, DB-backed) ──
  router.post('/crypto-webhook', async (req, res) => {
    try {
      const event = req.body?.event || req.body?.status
      const paymentId = req.body?.payment_id
      const refId = req.body?.meta_data?.refId

      // pending: just record the paymentId→order mapping
      if (event === 'payment.pending' || req.body?.status === 'pending') {
        if (refId && paymentId) {
          await col('webOrders').updateOne({ _id: refId }, { $set: { paymentId, updatedAt: now() } }).catch(() => {})
        }
        return res.send('OK')
      }
      if (event === 'payment.failed') {
        if (refId) await col('webOrders').updateOne({ _id: refId, status: 'pending' }, { $set: { status: 'failed', updatedAt: now() } }).catch(() => {})
        return res.send('OK')
      }

      // confirmed / settled / underpaid(with funds) → credit
      let order = null
      if (refId) order = await col('webOrders').findOne({ _id: refId })
      if (!order && paymentId) order = await col('webOrders').findOne({ paymentId })
      if (!order) { log(`[Store] webhook: no matching order (ref=${refId}, pid=${paymentId})`); return res.send('OK') }

      if (order.status === 'credited') { log(`[Store] webhook dup for ${order._id}`); return res.send('OK') }

      // ── SECURITY: re-verify with DynoPay before crediting ──
      // The webhook is necessarily unauthenticated, so never trust the body's
      // amount/status blindly — re-fetch the payment from DynoPay and only
      // credit if it actually confirmed. (Dev/test bypass via STORE_DEV_TRUST_WEBHOOK.)
      const trustBody = process.env.STORE_DEV_TRUST_WEBHOOK === 'true'
      if (!trustBody && order.provider === 'dynopay' && order.payAddress) {
        let ok = false
        try {
          const st = await getDynopayCryptoPaymentStatus(order.payAddress)
          ok = st && ['completed', 'confirmed', 'settled', 'paid'].includes(String(st.status || '').toLowerCase())
        } catch (_) { ok = false }
        if (!ok) { log(`[Store] webhook: DynoPay re-verify failed for ${order._id} — NOT crediting`); return res.send('OK') }
      }

      await creditTopup(order, req.body?.base_amount, req.body?.fee_payer, paymentId, `dynopay:${event}`)
      return res.send('OK')
    } catch (err) {
      log(`[Store] crypto-webhook error: ${err.message}`)
      return res.status(200).send('OK') // never make the provider retry-storm on our bug
    }
  })

  // ── BlockBee webhook (fallback). BlockBee calls back via GET with query params. ──
  async function handleBlockbee(req, res) {
    try {
      const orderId = req.query.order || req.query.orderId
      const valueCoin = req.query.value_coin || req.query.value
      const confirmations = Number(req.query.confirmations || 0)
      if (!orderId) return res.send('*ok*')
      const order = await col('webOrders').findOne({ _id: orderId })
      if (!order) return res.send('*ok*')
      if (order.status === 'credited') return res.send('*ok*')
      // Require at least 1 confirmation
      if (confirmations < 1) return res.send('*ok*')
      // Convert received coin value → USD
      let usd = order.amountUsd
      try { const c = await convert(valueCoin, coinByCode(order.coin)?.bbTicker || 'btc', 'usd'); if (Number.isFinite(c) && c > 0) usd = c } catch (_) {}
      await creditTopup({ ...order, amountUsd: usd }, usd, 'company', `bb_${orderId}`, 'blockbee')
      return res.send('*ok*')
    } catch (err) {
      log(`[Store] blockbee-webhook error: ${err.message}`)
      return res.send('*ok*')
    }
  }
  router.get('/blockbee-webhook', handleBlockbee)
  router.post('/blockbee-webhook', handleBlockbee)

  // health/info
  router.get('/health', (req, res) => res.json({ ok: true, coins: COINS.map(c => c.code) }))

  // ═══════════════════════ PHASE 2: STOREFRONT (plans + buy hosting from wallet) ═══════════════════════

  const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d }
  function plansCatalog() {
    return [
      {
        id: 'premium-weekly', name: 'Premium Anti-Red (1-Week)', tier: 'premium',
        priceUsd: num(process.env.PREMIUM_ANTIRED_WEEKLY_PRICE, 30), durationDays: 7, addons: 1,
        features: ['Anti-Red protection', '1 addon domain', 'HostPanel + File Manager', '7 days'],
      },
      {
        id: 'premium-monthly', name: 'Premium Anti-Red HostPanel (1-Month)', tier: 'premium',
        priceUsd: num(process.env.PREMIUM_ANTIRED_CPANEL_PRICE, 75), durationDays: 30, addons: 5,
        features: ['Anti-Red protection', '5 addon domains', 'Email + MySQL', '30 days'],
      },
      {
        id: 'golden-monthly', name: 'Golden Anti-Red HostPanel (1-Month)', tier: 'gold',
        priceUsd: num(process.env.GOLDEN_ANTIRED_CPANEL_PRICE, 100), durationDays: 30, addons: 'unlimited',
        features: ['Anti-Red protection', 'Unlimited addon domains', 'Visitor Captcha + Geo', '30 days'],
      },
    ]
  }
  const planById = (id) => plansCatalog().find(p => p.id === id)
  const domainOk = (d) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(String(d || '').trim())

  router.get('/plans', (req, res) => res.json({ plans: plansCatalog() }))

  // Domain availability + price (for "buy a domain" at checkout)
  router.get('/domain/search', webAuth, async (req, res) => {
    try {
      const domain = String(req.query.domain || '').trim().toLowerCase()
      if (!domainOk(domain)) return res.status(400).json({ error: 'Enter a valid domain (e.g. mysite.com).' })
      const ds = require('./domain-service')
      const r = await ds.checkDomainPrice(domain, getDb && getDb())
      return res.json({ domain, available: !!r.available, priceUsd: r.available ? Number(r.price) : 0, registrar: r.registrar || null, message: r.message || '' })
    } catch (err) {
      log(`[Store] domain search error: ${err.message}`)
      return res.status(500).json({ error: 'Domain lookup failed. Try again shortly.' })
    }
  })

  // Buy a hosting plan, paid from wallet. domainMode: 'byo' (bring your own) | 'buy' (register new).
  router.post('/hosting/purchase', webAuth, async (req, res) => {
    const planId = req.body?.planId
    const domain = String(req.body?.domain || '').trim().toLowerCase()
    const domainMode = req.body?.domainMode === 'buy' ? 'buy' : 'byo'
    const plan = planById(planId)
    if (!plan) return res.status(400).json({ error: 'Unknown plan.' })
    if (!domainOk(domain)) return res.status(400).json({ error: 'Enter a valid domain (e.g. mysite.com).' })

    try {
      // One active hosting account per domain (mirrors provisioning idempotency guard)
      const dup = await col('cpanelAccounts').findOne({ domain, deleted: { $ne: true } })
      if (dup) return res.status(409).json({ error: 'That domain already has an active hosting plan.' })

      // Price the order
      let domainPrice = 0
      let registrar = null
      if (domainMode === 'buy') {
        const ds = require('./domain-service')
        const dp = await ds.checkDomainPrice(domain, getDb && getDb())
        if (!dp.available) return res.status(409).json({ error: dp.message || 'That domain is not available — try another.' })
        domainPrice = Number(dp.price) || 0
        registrar = dp.registrar || null
      }
      const total = Math.round((Number(plan.priceUsd) + domainPrice) * 100) / 100

      // Atomically debit the wallet ONLY if balance is sufficient (prevents races/overspend)
      const debit = await col('webUsers').findOneAndUpdate(
        { _id: req.webUserId, walletUsd: { $gte: total } },
        { $inc: { walletUsd: -total } },
        { returnDocument: 'after' }
      )
      const debited = debit && (debit.value || debit)
      if (!debited || typeof debited.walletUsd !== 'number') {
        const u = await publicUser(req.webUserId)
        return res.status(402).json({
          error: `Insufficient wallet balance. This order is $${total}; your balance is $${u?.walletUsd || 0}. Please top up.`,
          needTopup: true, required: total, balanceUsd: u?.walletUsd || 0,
        })
      }
      const balanceAfter = Number(debited.walletUsd)
      await col('webWalletTxns').insertOne({
        _id: uuid(), webUserId: req.webUserId, type: 'purchase', amountUsd: -total, balanceAfter,
        coin: null, provider: 'wallet', orderId: null, status: 'done',
        note: `Hosting: ${plan.name} — ${domain}${domainMode === 'buy' ? ' (+domain)' : ''}`, createdAt: now(),
      })

      // Provision via the proven pipeline (registers domain when domainMode='buy', else BYO)
      const user = await col('webUsers').findOne({ _id: req.webUserId })
      const stateCol = col('state')
      const noop = () => {}
      const info = {
        _id: req.webUserId,            // acts as the owner id (chatId slot)
        website_name: domain,
        plan: plan.name,
        email: user?.email || null,
        userLanguage: 'en',
        price: total,
        hostingPrice: plan.priceUsd,
        domainPrice,
        registrar,
        source: 'web',
      }
      if (domainMode === 'byo') { info.existingDomain = true; info.connectExternalDomain = true }

      let result
      try {
        const { registerDomainAndCreateCpanel } = require('./cr-register-domain-&-create-cpanel.js')
        result = await registerDomainAndCreateCpanel(noop, info, [], stateCol, null)
      } catch (e) {
        log(`[Store] provision threw: ${e.message}`)
        result = { success: false, error: e.message }
      }

      if (!result?.success) {
        // Refund the wallet — provisioning failed, user keeps their funds.
        const ref = await col('webUsers').findOneAndUpdate(
          { _id: req.webUserId }, { $inc: { walletUsd: total } }, { returnDocument: 'after' }
        )
        const refDoc = ref && (ref.value || ref)
        await col('webWalletTxns').insertOne({
          _id: uuid(), webUserId: req.webUserId, type: 'refund', amountUsd: total,
          balanceAfter: Number(refDoc?.walletUsd || balanceAfter + total), coin: null, provider: 'wallet',
          orderId: null, status: 'done', note: `Refund — provisioning failed (${domain})`, createdAt: now(),
        })
        log(`[Store] purchase provision FAILED for ${domain} — refunded $${total} to ${req.webUserId}`)
        return res.status(502).json({ error: 'We could not set up your hosting right now and have refunded your wallet. Please try again shortly.' })
      }

      // Link the new cPanel account to this web identity so it shows under "My Plans".
      try {
        await col('cpanelAccounts').updateOne(
          { _id: String(result.username).toLowerCase() },
          { $set: { webUserId: req.webUserId, source: 'web', ownerEmail: user?.email || null } }
        )
      } catch (e) { log(`[Store] link cpanelAccount warning: ${e.message}`) }

      log(`[Store] PURCHASE ok — ${req.webUserId} bought ${plan.name} on ${domain} (cpUser=${result.username})`)
      return res.json({
        success: true, username: result.username, pin: result.pin, domain, plan: plan.name,
        balanceUsd: balanceAfter, nameservers: result.nameservers || [],
      })
    } catch (err) {
      log(`[Store] purchase error: ${err.message}`)
      return res.status(500).json({ error: 'Purchase failed. If your wallet was charged it will be auto-refunded — contact support if not.' })
    }
  })

  // List the hosting plans owned by this web account.
  router.get('/my-plans', webAuth, async (req, res) => {
    try {
      const accts = await col('cpanelAccounts').find({ webUserId: req.webUserId, deleted: { $ne: true } })
        .project({ cpUser: 1, domain: 1, plan: 1, expiryDate: 1, addonDomains: 1, suspended: 1 }).toArray()
      res.json({
        plans: accts.map(a => ({
          cpUser: a.cpUser || a._id, domain: a.domain, plan: a.plan,
          expiryDate: a.expiryDate || null, addonCount: (a.addonDomains || []).length,
          suspended: !!a.suspended,
        })),
      })
    } catch (err) {
      log(`[Store] my-plans error: ${err.message}`)
      res.status(500).json({ error: 'Could not load your plans.' })
    }
  })

  // Bridge: mint a HostPanel JWT for a plan this web user owns (no PIN needed —
  // they're already authenticated as the owner). The existing panel uses this token.
  router.post('/open-panel', webAuth, async (req, res) => {
    try {
      const cpUser = String(req.body?.cpUser || '').toLowerCase()
      if (!cpUser) return res.status(400).json({ error: 'cpUser is required' })
      const acct = await col('cpanelAccounts').findOne({ _id: cpUser, webUserId: req.webUserId, deleted: { $ne: true } })
      if (!acct) return res.status(404).json({ error: 'Plan not found for your account.' })
      const cpAuth = require('./cpanel-auth')
      const token = cpAuth.createToken({ cpUser: acct.cpUser, domain: acct.domain, chatId: acct.chatId })
      return res.json({ token, cpUser: acct.cpUser, domain: acct.domain })
    } catch (err) {
      log(`[Store] open-panel error: ${err.message}`)
      res.status(500).json({ error: 'Could not open panel.' })
    }
  })

  return router
}

module.exports = { createStoreRoutes }
