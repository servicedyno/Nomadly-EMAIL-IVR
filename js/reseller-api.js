// ============================================================
// Reseller API  (js/reseller-api.js)
// ------------------------------------------------------------
// Public, API-key-authenticated REST API that lets a reseller
// programmatically resell:
//   • Domains        (search / register / list)
//   • DNS management (records CRUD + nameservers)  — free, no wallet charge
//   • VPS  (Linux)   (plans / create / list / actions / destroy / creds)
//   • RDP  (Windows) (plans / create / list / actions / destroy / creds)
//   • cPanel hosting (plans / create / list / suspend / terminate / login)
//
// Design decisions (confirmed with product owner):
//   1. Billing → debits the existing wallet system (walletOf, usdOut) via the
//      atomic, overdraft-safe db.atomicIncrement(). The API key is bound to a
//      single owner account (chatId) whose wallet funds every provisioning call.
//   2. API keys → seeded via scripts/seed_reseller_key.js into `resellerApiKeys`
//      (sha256-hashed). One key = full access (no per-product scopes).
//   3. Safety → provisioning only runs LIVE when RESELLER_API_LIVE=true AND
//      SKIP_WEBHOOK_SYNC!=='true'. On a dev/sandbox pod (SKIP_WEBHOOK_SYNC=true)
//      the API ALWAYS runs in dry-run: it validates input, prices the order,
//      checks the wallet balance, but NEVER calls a provider or debits funds.
//
// Mounted in _index.js:
//   app.use('/reseller/v1', createResellerApi({ getDb: () => db, log, notifyAdmin }))
// External URL (FastAPI strips /api): https://<host>/api/reseller/v1/*
// ============================================================

const express = require('express')
const crypto = require('crypto')

const { atomicIncrement } = require('./db')
const { getBalance } = require('./utils')

const domainService = require('./domain-service')
const whmService = require('./whm-service')
const vpsProvider = require('./vps-provider')

// ── Hosting plan catalog (prices from prod .env, mirrors store-routes) ──
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d }
function hostingPlans() {
  return [
    {
      id: 'premium-weekly', name: 'Premium Anti-Red (1-Week)', tier: 'premium',
      priceUsd: num(process.env.PREMIUM_ANTIRED_WEEKLY_PRICE, 30), durationDays: 7, addons: 1,
      features: ['Anti-Red protection', '1 addon domain', 'HostPanel + File Manager', '7 days'],
    },
    {
      id: 'premium-monthly', name: 'Premium Anti-Red HostPanel (1-Month)', tier: 'premium',
      priceUsd: num(process.env.PREMIUM_ANTIRED_CPANEL_PRICE, 75), durationDays: 30, addons: 5,
      features: ['Anti-Red protection', '5 addon domains', 'MySQL databases', '30 days'],
    },
    {
      id: 'golden-monthly', name: 'Golden Anti-Red HostPanel (1-Month)', tier: 'gold',
      priceUsd: num(process.env.GOLDEN_ANTIRED_CPANEL_PRICE, 100), durationDays: 30, addons: 'unlimited',
      features: ['Anti-Red protection', 'Unlimited addon domains', 'Visitor Captcha + Geo', '30 days'],
    },
  ]
}
const hostingPlanById = (id) => hostingPlans().find(p => p.id === id)

const domainOk = (d) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(String(d || '').trim())
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex')

function createResellerApi(deps = {}) {
  const getDb = deps.getDb || (() => null)
  const log = deps.log || console.log
  const notifyAdmin = deps.notifyAdmin || (async () => {})
  const router = express.Router()

  const col = (name) => {
    const db = getDb()
    if (!db) throw new Error('Database not ready')
    return db.collection(name)
  }

  // ── Mode: are we allowed to actually provision + charge? ──
  // Hard safety: a dev/sandbox pod (SKIP_WEBHOOK_SYNC=true) shares production
  // provider accounts + Mongo, so it must NEVER create real resources.
  function isLive() {
    return process.env.RESELLER_API_LIVE === 'true' && process.env.SKIP_WEBHOOK_SYNC !== 'true'
  }
  const mode = () => (isLive() ? 'live' : 'dry_run')

  // ── Wallet helpers (bound to the API key's owner account) ──
  async function walletBalance(chatId) {
    try {
      const { usdBal } = await getBalance(col('walletOf'), String(chatId))
      return Math.round((Number(usdBal) || 0) * 100) / 100
    } catch (e) { log(`[ResellerAPI] walletBalance error: ${e.message}`); return 0 }
  }
  async function chargeWallet(chatId, amountUsd) {
    // atomic + overdraft-safe: returns false if balance insufficient
    return await atomicIncrement(col('walletOf'), String(chatId), 'usdOut', Math.round(amountUsd * 100) / 100)
  }
  async function refundWallet(chatId, amountUsd) {
    return await atomicIncrement(col('walletOf'), String(chatId), 'usdIn', Math.round(amountUsd * 100) / 100)
  }

  async function recordOrder(doc) {
    try { await col('resellerApiOrders').insertOne({ _id: crypto.randomUUID(), createdAt: new Date(), ...doc }) }
    catch (e) { log(`[ResellerAPI] recordOrder error: ${e.message}`) }
  }

  // ── API-key auth middleware ──
  async function apiKeyAuth(req, res, next) {
    try {
      let raw = null
      const authHeader = req.headers.authorization || ''
      if (authHeader.startsWith('Bearer ')) raw = authHeader.slice(7).trim()
      if (!raw && req.headers['x-api-key']) raw = String(req.headers['x-api-key']).trim()
      if (!raw) return res.status(401).json({ error: 'missing_api_key', message: 'Provide your key via "Authorization: Bearer <key>" or "X-API-Key: <key>".' })

      const keyDoc = await col('resellerApiKeys').findOne({ keyHash: sha256(raw), enabled: true })
      if (!keyDoc) return res.status(401).json({ error: 'invalid_api_key', message: 'API key not recognised or disabled.' })

      req.reseller = { keyId: keyDoc._id, ownerChatId: String(keyDoc.ownerChatId), label: keyDoc.label || null }
      // best-effort usage tracking (never blocks the request)
      col('resellerApiKeys').updateOne({ _id: keyDoc._id }, { $set: { lastUsedAt: new Date() }, $inc: { requestCount: 1 } }).catch(() => {})
      next()
    } catch (e) {
      log(`[ResellerAPI] auth error: ${e.message}`)
      return res.status(500).json({ error: 'auth_error', message: e.message })
    }
  }

  // ── Central billed-provision wrapper ──
  // In dry-run: validate + price + balance check, return simulation (no charge).
  // In live: atomic charge → provision → refund-on-failure.
  async function billedProvision(req, res, { product, action, priceUsd, request, provision }) {
    const chatId = req.reseller.ownerChatId
    const price = Math.round(Number(priceUsd) * 100) / 100
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: 'pricing_failed', message: 'Could not determine a valid price for this order.' })
    }
    const balance = await walletBalance(chatId)

    // ── Universal wallet guard (applies in BOTH dry_run and live) ──
    // An API order is NEVER processed — neither simulated nor provisioned —
    // when the bot wallet bound to the API key cannot cover the price. This
    // makes the "insufficient balance ⇒ order refused" guarantee identical on
    // every pod. In live mode the atomic chargeWallet() below adds a second,
    // race-safe overdraft check.
    if (balance < price) {
      await recordOrder({ keyId: req.reseller.keyId, ownerChatId: chatId, product, action, request, priceUsd: price, mode: mode(), status: 'rejected_insufficient_balance' })
      return res.status(402).json({
        error: 'insufficient_wallet_balance',
        message: `Wallet balance $${balance.toFixed(2)} is below the order price $${price.toFixed(2)}. Top up your wallet and retry.`,
        product, action,
        price_usd: price,
        wallet_balance_usd: balance,
        shortfall_usd: Math.round((price - balance) * 100) / 100,
        mode: mode(),
      })
    }

    if (!isLive()) {
      await recordOrder({ keyId: req.reseller.keyId, ownerChatId: chatId, product, action, request, priceUsd: price, mode: 'dry_run', status: 'simulated' })
      return res.json({
        mode: 'dry_run',
        product, action,
        price_usd: price,
        wallet_balance_usd: balance,
        sufficient_balance: true,
        would_provision: request,
        note: 'Dry-run: balance is sufficient; no resource was created and no funds were charged. Set RESELLER_API_LIVE=true on a production pod to go live.',
      })
    }

    // ── LIVE ── (balance already confirmed sufficient; charge stays atomic + overdraft-safe against concurrent spend)
    const charged = await chargeWallet(chatId, price)
    if (!charged) {
      return res.status(402).json({ error: 'insufficient_wallet_balance', message: 'Wallet debit was declined (insufficient funds / concurrent spend).', price_usd: price, wallet_balance_usd: balance })
    }

    let result
    try {
      result = await provision()
    } catch (err) {
      await refundWallet(chatId, price)
      await recordOrder({ keyId: req.reseller.keyId, ownerChatId: chatId, product, action, request, priceUsd: price, mode: 'live', status: 'failed', error: err.message })
      try { await notifyAdmin(`❌ <b>Reseller API ${product}/${action} FAILED</b>\nKey: ${req.reseller.label || req.reseller.keyId}\nRefunded $${price.toFixed(2)}\nError: ${err.message}`) } catch (_) { /* notify best-effort */ }
      return res.status(502).json({ error: 'provisioning_failed', message: err.message, refunded: true, refund_usd: price })
    }

    if (result && result.success === false) {
      await refundWallet(chatId, price)
      await recordOrder({ keyId: req.reseller.keyId, ownerChatId: chatId, product, action, request, priceUsd: price, mode: 'live', status: 'failed', error: result.error || 'provision_failed' })
      return res.status(502).json({ error: 'provisioning_failed', message: result.error || 'Provider could not fulfil the request.', refunded: true, refund_usd: price })
    }

    const balanceAfter = await walletBalance(chatId)
    await recordOrder({ keyId: req.reseller.keyId, ownerChatId: chatId, product, action, request, priceUsd: price, mode: 'live', status: 'provisioned', result })
    return res.json({ mode: 'live', product, action, charged_usd: price, wallet_balance_usd: balanceAfter, result })
  }

  // Small async wrapper so route handlers can throw
  const h = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    log(`[ResellerAPI] ${req.method} ${req.path} error: ${e.message}`)
    if (!res.headersSent) res.status(500).json({ error: 'internal_error', message: e.message })
  })

  // ════════════════════════════════════════════════════════
  // META
  // ════════════════════════════════════════════════════════
  router.get('/health', (req, res) => res.json({
    ok: true, service: 'reseller-api', version: 'v1', mode: mode(),
    products: ['domains', 'dns', 'vps', 'rdp', 'hosting'],
  }))

  router.get('/account', apiKeyAuth, h(async (req, res) => {
    const balance = await walletBalance(req.reseller.ownerChatId)
    res.json({ owner_chat_id: req.reseller.ownerChatId, label: req.reseller.label, wallet_balance_usd: balance, currency: 'usd', mode: mode() })
  }))

  // ── Bot pricing catalog (the same prices the Telegram bot charges) ──
  // One call returns every sellable product's price plus your wallet balance,
  // so a reseller can compute margins without hitting each product endpoint.
  router.get('/pricing', apiKeyAuth, h(async (req, res) => {
    const region = String(req.query.region || 'EU').toUpperCase()
    const balance = await walletBalance(req.reseller.ownerChatId)

    const mapPlans = (prov, isRDP) => (prov.listProducts(region, isRDP) || []).map(p => ({
      plan_id: p.productId, name: p.name || p.productId,
      vcpus: p.vcpus || p.vCpus || null, ram_gb: p.ramGb || null, disk_gb: p.diskGb || null,
      price_usd: p.pricing ? p.pricing.totalWithMarkup : null,
    }))
    let vpsPlans = [], rdpPlans = [], vpsProviderName = process.env.VPS_DEFAULT_PROVIDER, rdpProviderName = process.env.VPS_RDP_PROVIDER
    try { const pv = vpsProvider.getProvider(); vpsProviderName = pv.PROVIDER || vpsProviderName; vpsPlans = mapPlans(pv, false) } catch (e) { log(`[ResellerAPI] pricing vps warn: ${e.message}`) }
    try { const pr = vpsProvider.getRdpProvider(); rdpProviderName = pr.PROVIDER || rdpProviderName; rdpPlans = mapPlans(pr, true) } catch (e) { log(`[ResellerAPI] pricing rdp warn: ${e.message}`) }

    res.json({
      mode: mode(),
      currency: 'usd',
      wallet_balance_usd: balance,
      region,
      domains: {
        note: 'Domain prices are per-name and set live by the registrar (identical to bot pricing). Call GET /domains/search?domain=<name> for an exact, wallet-billable quote.',
        min_price_usd: num(process.env.MIN_DOMAIN_PRICE, 30),
      },
      hosting: hostingPlans().map(p => ({ plan_id: p.id, name: p.name, tier: p.tier, price_usd: p.priceUsd, duration_days: p.durationDays, addon_domains: p.addons, features: p.features })),
      vps: { provider: vpsProviderName, region, plans: vpsPlans },
      rdp: { provider: rdpProviderName, region, plans: rdpPlans },
    })
  }))

  // ════════════════════════════════════════════════════════
  // DOMAINS
  // ════════════════════════════════════════════════════════
  router.get('/domains/search', apiKeyAuth, h(async (req, res) => {
    const domain = String(req.query.domain || '').trim().toLowerCase()
    if (!domainOk(domain)) return res.status(400).json({ error: 'invalid_domain', message: 'Provide a valid domain, e.g. ?domain=mysite.com' })
    const r = await domainService.checkDomainPrice(domain, getDb())
    res.json({ domain, available: !!r.available, price_usd: r.available ? Number(r.price) : 0, registrar: r.registrar || null, message: r.message || '' })
  }))

  router.post('/domains/register', apiKeyAuth, h(async (req, res) => {
    const domain = String(req.body?.domain || '').trim().toLowerCase()
    if (!domainOk(domain)) return res.status(400).json({ error: 'invalid_domain', message: 'Provide a valid domain in body: { "domain": "mysite.com" }' })
    const customNS = Array.isArray(req.body?.nameservers) ? req.body.nameservers : null
    const nsChoice = customNS ? 'custom' : (req.body?.ns_choice || 'cloudflare')

    const priceInfo = await domainService.checkDomainPrice(domain, getDb())
    if (!priceInfo.available) return res.status(409).json({ error: 'domain_unavailable', message: priceInfo.message || 'That domain is not available.' })
    const registrar = priceInfo.registrar || 'ConnectReseller'

    return billedProvision(req, res, {
      product: 'domain', action: 'register', priceUsd: Number(priceInfo.price),
      request: { domain, registrar, ns_choice: nsChoice, nameservers: customNS },
      provision: async () => {
        const r = await domainService.registerDomain(domain, registrar, nsChoice, getDb(), req.reseller.ownerChatId, customNS)
        if (r && r.success === false) return { success: false, error: r.error || r.message }
        return { success: true, domain, registrar, nameservers: r?.nameservers || customNS || [], detail: r || null }
      },
    })
  }))

  router.get('/domains', apiKeyAuth, h(async (req, res) => {
    const docs = await col('domainsOf').find({ chatId: String(req.reseller.ownerChatId) }).limit(500).toArray()
    res.json({ domains: docs.map(d => ({ domain: d.domainName, registrar: d.registrar || null, nameserver_type: d.nameserverType || null, registered_at: d.registeredAt || null })) })
  }))

  // ════════════════════════════════════════════════════════
  // DNS management (free — no wallet charge)
  // ════════════════════════════════════════════════════════
  router.get('/dns/:domain/records', apiKeyAuth, h(async (req, res) => {
    const domain = String(req.params.domain || '').trim().toLowerCase()
    if (!domainOk(domain)) return res.status(400).json({ error: 'invalid_domain' })
    const r = await domainService.viewDNSRecords(domain, getDb())
    res.json({ domain, records: r?.records || r || [], source: r?.source || null })
  }))

  router.post('/dns/:domain/records', apiKeyAuth, h(async (req, res) => {
    const domain = String(req.params.domain || '').trim().toLowerCase()
    if (!domainOk(domain)) return res.status(400).json({ error: 'invalid_domain' })
    const { type, name, value, priority, ttl } = req.body || {}
    if (!type || value == null) return res.status(400).json({ error: 'invalid_record', message: 'Body must include { type, name, value }.' })
    const r = await domainService.addDNSRecord(domain, String(type).toUpperCase(), value, name || '@', getDb(), priority, ttl ? { ttl } : undefined)
    if (r && r.success === false) return res.status(502).json({ error: 'dns_add_failed', message: r.error || r.message })
    res.json({ domain, added: { type, name: name || '@', value, priority: priority || null, ttl: ttl || null }, detail: r || null })
  }))

  router.put('/dns/:domain/records', apiKeyAuth, h(async (req, res) => {
    const domain = String(req.params.domain || '').trim().toLowerCase()
    if (!domainOk(domain)) return res.status(400).json({ error: 'invalid_domain' })
    const recordData = req.body?.record || req.body
    if (!recordData || typeof recordData !== 'object') return res.status(400).json({ error: 'invalid_record', message: 'Body must include the record object to update (from GET records).' })
    const r = await domainService.updateDNSRecord(domain, recordData, getDb())
    if (r && r.success === false) return res.status(502).json({ error: 'dns_update_failed', message: r.error || r.message })
    res.json({ domain, updated: true, detail: r || null })
  }))

  router.delete('/dns/:domain/records', apiKeyAuth, h(async (req, res) => {
    const domain = String(req.params.domain || '').trim().toLowerCase()
    if (!domainOk(domain)) return res.status(400).json({ error: 'invalid_domain' })
    const recordData = req.body?.record || req.body
    if (!recordData || typeof recordData !== 'object') return res.status(400).json({ error: 'invalid_record', message: 'Body must include the record object to delete (from GET records).' })
    const r = await domainService.deleteDNSRecord(domain, recordData, getDb())
    if (r && r.success === false) return res.status(502).json({ error: 'dns_delete_failed', message: r.error || r.message })
    res.json({ domain, deleted: true, detail: r || null })
  }))

  router.put('/dns/:domain/nameservers', apiKeyAuth, h(async (req, res) => {
    const domain = String(req.params.domain || '').trim().toLowerCase()
    if (!domainOk(domain)) return res.status(400).json({ error: 'invalid_domain' })
    const ns = req.body?.nameservers
    if (!Array.isArray(ns) || ns.length < 2) return res.status(400).json({ error: 'invalid_nameservers', message: 'Provide at least 2 nameservers: { "nameservers": ["ns1...","ns2..."] }' })
    const r = await domainService.updateAllNameservers(domain, ns, getDb())
    if (r && r.success === false) return res.status(502).json({ error: 'ns_update_failed', message: r.error || r.message })
    res.json({ domain, nameservers: ns, updated: true, detail: r || null })
  }))

  // ════════════════════════════════════════════════════════
  // VPS (Linux) + RDP (Windows) — share the provider interface
  // ════════════════════════════════════════════════════════
  function providerFor(isRDP) { return isRDP ? vpsProvider.getRdpProvider() : vpsProvider.getProvider() }

  async function vpsPlansHandler(req, res, isRDP) {
    const region = String(req.query.region || 'EU').toUpperCase()
    const prov = providerFor(isRDP)
    const products = prov.listProducts(region, isRDP) || []
    res.json({
      product: isRDP ? 'rdp' : 'vps',
      provider: prov.PROVIDER || (isRDP ? process.env.VPS_RDP_PROVIDER : process.env.VPS_DEFAULT_PROVIDER),
      region,
      plans: products.map(p => ({
        plan_id: p.productId, name: p.name || p.productId,
        vcpus: p.vcpus || p.vCpus || null, ram_gb: p.ramGb || null, disk_gb: p.diskGb || null,
        price_usd: p.pricing ? p.pricing.totalWithMarkup : null,
      })),
    })
  }

  async function vpsCreateHandler(req, res, isRDP) {
    const region = String(req.body?.region || 'EU').toUpperCase()
    const planId = req.body?.plan_id
    const hostname = req.body?.hostname || null
    const prov = providerFor(isRDP)
    const product = prov.getProduct ? prov.getProduct(planId) : null
    if (!product) return res.status(400).json({ error: 'invalid_plan', message: 'Unknown plan_id. Call GET plans first.' })
    const pricing = prov.calculatePrice(product, region, isRDP)
    if (!pricing) return res.status(400).json({ error: 'unavailable', message: `Plan not available in region ${region}.` })

    return billedProvision(req, res, {
      product: isRDP ? 'rdp' : 'vps', action: 'create', priceUsd: pricing.totalWithMarkup,
      request: { plan_id: planId, region, hostname, os: isRDP ? 'windows' : (req.body?.os || 'ubuntu') },
      provision: async () => {
        const createFn = (isRDP && prov.createInstanceWithFallback) ? prov.createInstanceWithFallback.bind(prov) : prov.createInstance.bind(prov)
        const inst = await createFn({ productId: planId, regionSlug: region, isWindows: isRDP, label: hostname || undefined })
        // Persist a record so GET /vps|/rdp lists it for this owner
        const vpsId = crypto.randomUUID()
        try {
          await col('vpsPlansOf').insertOne({
            _id: vpsId, chatId: String(req.reseller.ownerChatId), vpsId,
            provider: prov.PROVIDER, instanceId: inst.instanceId || null, host: inst.mainIp || null,
            region, productId: planId, plan: product.name || planId, planPrice: pricing.totalWithMarkup,
            osType: isRDP ? 'windows' : 'linux', isRDP: !!isRDP, status: inst.status || 'provisioning',
            rootPasswordSecretId: inst.passwordSecretId || null, source: 'reseller_api',
            start_time: new Date(), timestamp: new Date(),
          })
        } catch (e) { log(`[ResellerAPI] vpsPlansOf insert warn: ${e.message}`) }
        return { success: true, id: vpsId, instance_id: inst.instanceId || null, ip: inst.mainIp || null, status: inst.status || 'provisioning', default_password: inst.defaultPassword || null }
      },
    })
  }

  async function vpsListHandler(req, res, isRDP) {
    const docs = await col('vpsPlansOf').find({ chatId: String(req.reseller.ownerChatId), isRDP: !!isRDP }).limit(500).toArray()
    res.json({ [isRDP ? 'rdp' : 'vps']: docs.map(d => ({
      id: d.vpsId || d._id, instance_id: d.instanceId || d.contaboInstanceId || null, ip: d.host || null,
      plan: d.plan || null, region: d.region || null, os: d.osType || null, status: d.status || null,
      created_at: d.start_time || d.timestamp || null,
    })) })
  }

  async function loadOwnedVps(req, id, isRDP) {
    return col('vpsPlansOf').findOne({ $or: [{ vpsId: id }, { _id: id }], chatId: String(req.reseller.ownerChatId), isRDP: !!isRDP })
  }

  async function vpsGetHandler(req, res, isRDP) {
    const rec = await loadOwnedVps(req, req.params.id, isRDP)
    if (!rec) return res.status(404).json({ error: 'not_found' })
    let live = null
    if (rec.instanceId) { try { const prov = providerFor(isRDP); live = await prov.getInstance(rec.instanceId) } catch (e) { live = { error: e.message } } }
    res.json({ id: rec.vpsId || rec._id, instance_id: rec.instanceId || null, plan: rec.plan, region: rec.region, os: rec.osType, status: live?.status || rec.status, ip: live?.mainIp || rec.host || null, live })
  }

  async function vpsActionHandler(req, res, isRDP) {
    const rec = await loadOwnedVps(req, req.params.id, isRDP)
    if (!rec) return res.status(404).json({ error: 'not_found' })
    const action = String(req.body?.action || '').toLowerCase()
    const map = { start: 'startInstance', stop: 'stopInstance', reboot: 'restartInstance', restart: 'restartInstance', shutdown: 'shutdownInstance' }
    const fnName = map[action]
    if (!fnName) return res.status(400).json({ error: 'invalid_action', message: 'action must be one of: start, stop, reboot, shutdown' })
    if (!isLive()) return res.json({ mode: 'dry_run', id: rec.vpsId || rec._id, action, note: 'Dry-run: no action sent to provider.' })
    const prov = providerFor(isRDP)
    if (!rec.instanceId || typeof prov[fnName] !== 'function') return res.status(501).json({ error: 'not_supported' })
    const r = await prov[fnName](rec.instanceId)
    res.json({ mode: 'live', id: rec.vpsId || rec._id, action, detail: r || null })
  }

  async function vpsDestroyHandler(req, res, isRDP) {
    const rec = await loadOwnedVps(req, req.params.id, isRDP)
    if (!rec) return res.status(404).json({ error: 'not_found' })
    if (!isLive()) return res.json({ mode: 'dry_run', id: rec.vpsId || rec._id, note: 'Dry-run: instance not destroyed.' })
    const prov = providerFor(isRDP)
    if (rec.instanceId && typeof prov.cancelInstance === 'function') { try { await prov.cancelInstance(rec.instanceId) } catch (e) { log(`[ResellerAPI] cancelInstance warn: ${e.message}`) } }
    await col('vpsPlansOf').updateOne({ _id: rec._id }, { $set: { status: 'destroyed', end_time: new Date() } })
    res.json({ mode: 'live', id: rec.vpsId || rec._id, destroyed: true })
  }

  async function vpsCredsHandler(req, res, isRDP) {
    const rec = await loadOwnedVps(req, req.params.id, isRDP)
    if (!rec) return res.status(404).json({ error: 'not_found' })
    let password = null
    if (isLive() && rec.rootPasswordSecretId) { try { const prov = providerFor(isRDP); password = await prov.getSecretPassword(rec.rootPasswordSecretId) } catch (e) { log(`[ResellerAPI] getSecretPassword warn: ${e.message}`) } }
    res.json({ id: rec.vpsId || rec._id, ip: rec.host || null, username: isRDP ? 'Administrator' : 'root', password: password || (isLive() ? null : '••• (revealed only in live mode)'), mode: mode() })
  }

  // VPS routes
  router.get('/vps/plans', apiKeyAuth, h((req, res) => vpsPlansHandler(req, res, false)))
  router.post('/vps', apiKeyAuth, h((req, res) => vpsCreateHandler(req, res, false)))
  router.get('/vps', apiKeyAuth, h((req, res) => vpsListHandler(req, res, false)))
  router.get('/vps/:id', apiKeyAuth, h((req, res) => vpsGetHandler(req, res, false)))
  router.post('/vps/:id/action', apiKeyAuth, h((req, res) => vpsActionHandler(req, res, false)))
  router.delete('/vps/:id', apiKeyAuth, h((req, res) => vpsDestroyHandler(req, res, false)))
  router.get('/vps/:id/credentials', apiKeyAuth, h((req, res) => vpsCredsHandler(req, res, false)))

  // RDP routes (Windows)
  router.get('/rdp/plans', apiKeyAuth, h((req, res) => vpsPlansHandler(req, res, true)))
  router.post('/rdp', apiKeyAuth, h((req, res) => vpsCreateHandler(req, res, true)))
  router.get('/rdp', apiKeyAuth, h((req, res) => vpsListHandler(req, res, true)))
  router.get('/rdp/:id', apiKeyAuth, h((req, res) => vpsGetHandler(req, res, true)))
  router.post('/rdp/:id/action', apiKeyAuth, h((req, res) => vpsActionHandler(req, res, true)))
  router.delete('/rdp/:id', apiKeyAuth, h((req, res) => vpsDestroyHandler(req, res, true)))
  router.get('/rdp/:id/credentials', apiKeyAuth, h((req, res) => vpsCredsHandler(req, res, true)))

  // ════════════════════════════════════════════════════════
  // cPanel HOSTING
  // ════════════════════════════════════════════════════════
  router.get('/hosting/plans', apiKeyAuth, h(async (req, res) => {
    res.json({ plans: hostingPlans().map(p => ({ plan_id: p.id, name: p.name, tier: p.tier, price_usd: p.priceUsd, duration_days: p.durationDays, addon_domains: p.addons, features: p.features })) })
  }))

  router.post('/hosting', apiKeyAuth, h(async (req, res) => {
    const plan = hostingPlanById(req.body?.plan_id)
    if (!plan) return res.status(400).json({ error: 'invalid_plan', message: 'Unknown plan_id. Call GET /hosting/plans.' })
    const domain = String(req.body?.domain || '').trim().toLowerCase()
    if (!domainOk(domain)) return res.status(400).json({ error: 'invalid_domain', message: 'Provide a valid domain.' })
    const domainMode = req.body?.domain_mode === 'buy' ? 'buy' : 'byo'
    const email = req.body?.email || null

    // duplicate guard (mirrors store provisioning)
    const dup = await col('cpanelAccounts').findOne({ domain, deleted: { $ne: true } })
    if (dup) return res.status(409).json({ error: 'domain_in_use', message: 'That domain already has an active hosting plan.' })

    let domainPrice = 0, registrar = null
    if (domainMode === 'buy') {
      const dp = await domainService.checkDomainPrice(domain, getDb())
      if (!dp.available) return res.status(409).json({ error: 'domain_unavailable', message: dp.message || 'Domain not available to register.' })
      domainPrice = Number(dp.price) || 0
      registrar = dp.registrar || 'ConnectReseller'
    }
    const total = Math.round((plan.priceUsd + domainPrice) * 100) / 100

    return billedProvision(req, res, {
      product: 'hosting', action: 'create', priceUsd: total,
      request: { plan_id: plan.id, plan: plan.name, domain, domain_mode: domainMode, hosting_usd: plan.priceUsd, domain_usd: domainPrice },
      provision: async () => {
        const { registerDomainAndCreateCpanel } = require('./cr-register-domain-&-create-cpanel.js')
        const info = {
          _id: `reseller_${crypto.randomUUID()}`, website_name: domain, plan: plan.name, email,
          userLanguage: 'en', price: total, hostingPrice: plan.priceUsd, registrar, source: 'reseller_api',
          ownerChatId: String(req.reseller.ownerChatId),
        }
        if (domainMode === 'byo') { info.existingDomain = true; info.connectExternalDomain = true }
        const r = await registerDomainAndCreateCpanel(() => {}, info, [], col('state'), null)
        if (!r || r.success === false) return { success: false, error: r?.error || 'Provisioning failed' }
        // tag the account with the reseller owner for listing
        if (r.username) { try { await col('cpanelAccounts').updateOne({ _id: String(r.username).toLowerCase() }, { $set: { chatId: String(req.reseller.ownerChatId), source: 'reseller_api', ownerEmail: email } }) } catch (_) { /* tag best-effort */ } }
        return { success: true, domain, plan: plan.name, cpanel_username: r.username || null, nameservers: r.nameservers || [], queued: !!r.queued }
      },
    })
  }))

  router.get('/hosting', apiKeyAuth, h(async (req, res) => {
    const docs = await col('cpanelAccounts').find({ chatId: String(req.reseller.ownerChatId), deleted: { $ne: true } }).limit(500).toArray()
    res.json({ accounts: docs.map(d => ({ username: d._id || d.username, domain: d.domain, plan: d.plan || null, suspended: !!d.suspended, created_at: d.createdAt || null })) })
  }))

  async function loadOwnedCpanel(req, username) {
    return col('cpanelAccounts').findOne({ _id: String(username).toLowerCase(), chatId: String(req.reseller.ownerChatId) })
  }

  router.post('/hosting/:user/suspend', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwnedCpanel(req, req.params.user)
    if (!acct) return res.status(404).json({ error: 'not_found' })
    if (!isLive()) return res.json({ mode: 'dry_run', username: acct._id, note: 'Dry-run: account not suspended.' })
    const r = await whmService.suspendAccount(acct._id, req.body?.reason || 'Suspended via reseller API')
    await col('cpanelAccounts').updateOne({ _id: acct._id }, { $set: { suspended: true } })
    res.json({ mode: 'live', username: acct._id, suspended: true, detail: r || null })
  }))

  router.post('/hosting/:user/unsuspend', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwnedCpanel(req, req.params.user)
    if (!acct) return res.status(404).json({ error: 'not_found' })
    if (!isLive()) return res.json({ mode: 'dry_run', username: acct._id, note: 'Dry-run: account not unsuspended.' })
    const r = await whmService.unsuspendAccount(acct._id)
    await col('cpanelAccounts').updateOne({ _id: acct._id }, { $set: { suspended: false } })
    res.json({ mode: 'live', username: acct._id, suspended: false, detail: r || null })
  }))

  router.delete('/hosting/:user', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwnedCpanel(req, req.params.user)
    if (!acct) return res.status(404).json({ error: 'not_found' })
    if (!isLive()) return res.json({ mode: 'dry_run', username: acct._id, note: 'Dry-run: account not terminated.' })
    const r = await whmService.terminateAccount(acct._id)
    await col('cpanelAccounts').updateOne({ _id: acct._id }, { $set: { deleted: true, deletedAt: new Date() } })
    res.json({ mode: 'live', username: acct._id, terminated: true, detail: r || null })
  }))

  router.get('/hosting/:user/login', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwnedCpanel(req, req.params.user)
    if (!acct) return res.status(404).json({ error: 'not_found' })
    if (!isLive()) return res.json({ mode: 'dry_run', username: acct._id, note: 'Dry-run: login URL generated only in live mode.' })
    const session = await whmService.createUserSession(acct._id)
    res.json({ mode: 'live', username: acct._id, login_url: session?.url || session || null })
  }))

  log(`[ResellerAPI] mounted at /reseller/v1 (mode=${mode()})`)
  return router
}

module.exports = { createResellerApi, hostingPlans }
