// ============================================================
// Reseller API — cPanel Hosting Management  (js/reseller-hosting-mgmt.js)
// ------------------------------------------------------------
// Exposes, under the reseller API (/reseller/v1/hosting/:user/...), every
// IN-ACCOUNT cPanel user functionality that the web HostPanel (/panel) and the
// Telegram bot already offer — WITHOUT duplicating any business logic.
//
// It does this by reusing the EXACT SAME lower-level modules the panel routes
// call:
//   • cpanel-proxy.js  → Email / MySQL / Subdomains / Files / Domains / SSL / Stats
//   • whm-service.js   → AutoSSL trigger
//   • cf-service.js    → Geo rules, anti-bot profile, analytics
//   • safe-browsing-service.js → Safe-Browsing / blacklist checks
//   • anti-red-service.js      → Anti-Red deploy + Visitor-Captcha toggle
//
// Auth / ownership / billing model (inherited from reseller-api.js):
//   • apiKeyAuth binds the request to a single owner (chatId).
//   • loadOwnedCpanel(req, user) enforces that the account is owned by that key.
//   • cPanel password is read from the encrypted store (cpanel-auth.decrypt) —
//     the same source the panel's resolveCpPass middleware uses.
//   • Management ops are FREE (no wallet charge), like DNS management.
//   • SAFETY: on a dev/sandbox pod (SKIP_WEBHOOK_SYNC=true → isLive()===false)
//     every WRITE returns a dry-run envelope and never mutates the shared
//     production cPanel/WHM/Cloudflare state. READS run live on any pod (a read
//     is safe), mirroring the existing GET /hosting/:user behaviour.
// ============================================================

const cpProxy = require('./cpanel-proxy')
const cpAuth = require('./cpanel-auth')
const whmService = require('./whm-service')
const cfService = require('./cf-service')
const safeBrowsing = require('./safe-browsing-service')
const antiRed = require('./anti-red-service')

// Files that back the Anti-Red protection — users must not clobber them.
// Mirrors cpanel-routes.js PROTECTED_FILES / isProtectedAntiRedFile.
const PROTECTED_FILES = ['.htaccess', '.user.ini', '.antired-challenge.php']
function isProtectedAntiRedFile(dir, file) {
  const inPublicHtml = dir && (String(dir).endsWith('/public_html') || String(dir).endsWith('/public_html/'))
  return !!inPublicHtml && PROTECTED_FILES.includes(file)
}

// Derive the same request context the panel's resolveCpPass middleware builds.
function ctxFromAccount(acct) {
  const cpUser = acct.cpUser || acct._id
  let cpPass = null
  try {
    if (acct.cpPass_encrypted && acct.cpPass_iv && acct.cpPass_tag) {
      cpPass = cpAuth.decrypt({ encrypted: acct.cpPass_encrypted, iv: acct.cpPass_iv, tag: acct.cpPass_tag })
    } else if (acct.cpPass || acct.password) {
      cpPass = acct.cpPass || acct.password
    }
  } catch (_) { cpPass = null }
  const cpPlan = acct.plan || ''
  const cpAddonDomains = (acct.addonDomains || [])
    .map(a => (typeof a === 'string' ? a : (a && a.domain) || ''))
    .filter(Boolean)
  return {
    cpUser,
    cpPass,
    whmHost: acct.whmHost || null,
    cpDomain: acct.domain || null,
    cpPlan,
    cpAddonDomains,
    cpIsGold: /Golden Anti-Red HostPanel/i.test(cpPlan),
  }
}

/**
 * Register all hosting-management routes onto the reseller router.
 * @param {object} deps
 *   router          express.Router() from createResellerApi
 *   apiKeyAuth      the API-key middleware (sets req.reseller.ownerChatId)
 *   h               async route wrapper (catches → 500)
 *   col             (name) => db.collection(name)
 *   getDb           () => db
 *   loadOwnedCpanel (req, username) => account | null  (ownership enforced)
 *   isLive          () => boolean
 *   mode            () => 'live' | 'dry_run'
 *   log             logger
 */
function registerHostingMgmtRoutes(deps) {
  const { router, apiKeyAuth, h, col, getDb, loadOwnedCpanel, isLive, mode, log } = deps

  // ── Ownership loader: returns account or sends 404 and returns null ──
  async function loadOwned(req, res) {
    const acct = await loadOwnedCpanel(req, req.params.user)
    if (!acct || acct.deleted) {
      res.status(404).json({ error: 'not_found', message: 'No hosting account with that username under your API key.' })
      return null
    }
    return acct
  }

  // ── Read context (needs live cPanel credentials) ──
  // Returns { acct, ...ctx } or sends 4xx and returns null.
  function withCreds(res, acct) {
    const ctx = ctxFromAccount(acct)
    if (!ctx.cpPass) {
      res.status(501).json({ error: 'no_credentials', message: 'cPanel password is not on file for this account; management via API is unavailable.' })
      return null
    }
    return { acct, ...ctx }
  }

  // ── Standard dry-run envelope for a WRITE that is blocked on the sandbox ──
  function dryRun(res, acct, action, extra = {}) {
    return res.json({
      mode: 'dry_run',
      username: acct._id || acct.cpUser,
      action,
      ...extra,
      note: 'Dry-run: input validated + ownership confirmed; no change was made on the cPanel/WHM/Cloudflare server. Set RESELLER_API_LIVE=true on a production pod to apply.',
    })
  }

  // ── MySQL plan gate (mirror requireMysqlEligible: reject 7-day trial only) ──
  function mysqlBlocked(res, ctx) {
    const planLc = (ctx.cpPlan || '').toLowerCase()
    const isWeeklyTrial = /1-week|\bweek\b|\(7 days\)/.test(planLc) && !/month/.test(planLc)
    if (!isWeeklyTrial) return false
    res.status(403).json({
      error: 'mysql_requires_monthly',
      message: 'MySQL databases require Premium Anti-Red HostPanel (1-Month) or Golden.',
      current_plan: ctx.cpPlan || '',
    })
    return true
  }

  // ── Gold gate (mirror requireGold: Geo + Visitor Captcha) ──
  function goldBlocked(res, ctx) {
    if (ctx.cpIsGold) return false
    res.status(403).json({
      error: 'gold_only',
      message: 'This feature is available on the Golden Anti-Red HostPanel plan only.',
      is_gold: false,
      plan: ctx.cpPlan || '',
    })
    return true
  }

  // Small helpers for reading params from body OR query (handy for DELETE).
  const bq = (req, key) => (req.body && req.body[key] != null ? req.body[key] : req.query[key])
  const missing = (res, ...pairs) => {
    for (const [name, val] of pairs) {
      if (val == null || val === '') { res.status(400).json({ error: 'missing_parameter', message: `'${name}' is required.` }); return true }
    }
    return false
  }

  // ════════════════════════════════════════════════════════
  // EMAIL ACCOUNTS
  // ════════════════════════════════════════════════════════
  router.get('/hosting/:user/email', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.listEmailAccounts(ctx.cpUser, ctx.cpPass, ctx.whmHost))
  }))

  router.post('/hosting/:user/email', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { email, password, quota, domain } = req.body || {}
    if (missing(res, ['email', email], ['password', password], ['domain', domain])) return
    if (!isLive()) return dryRun(res, acct, 'email.create', { email: `${email}@${domain}` })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.createEmailAccount(ctx.cpUser, ctx.cpPass, email, password, quota, domain, ctx.whmHost))
  }))

  router.delete('/hosting/:user/email', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const email = bq(req, 'email'); const domain = bq(req, 'domain')
    if (missing(res, ['email', email], ['domain', domain])) return
    if (!isLive()) return dryRun(res, acct, 'email.delete', { email: `${email}@${domain}` })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.deleteEmailAccount(ctx.cpUser, ctx.cpPass, email, domain, ctx.whmHost))
  }))

  router.put('/hosting/:user/email/password', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { email, password, domain } = req.body || {}
    if (missing(res, ['email', email], ['password', password], ['domain', domain])) return
    if (!isLive()) return dryRun(res, acct, 'email.password', { email: `${email}@${domain}` })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.changeEmailPassword(ctx.cpUser, ctx.cpPass, email, password, domain, ctx.whmHost))
  }))

  // ════════════════════════════════════════════════════════
  // STATS (disk quota + bandwidth)  — read, safe on any pod
  // ════════════════════════════════════════════════════════
  router.get('/hosting/:user/stats', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = withCreds(res, acct); if (!ctx) return
    const [quota, bandwidth] = await Promise.all([
      cpProxy.getQuotaInfo(ctx.cpUser, ctx.cpPass, ctx.whmHost).catch(e => ({ error: e.message })),
      cpProxy.getBandwidthData(ctx.cpUser, ctx.cpPass, ctx.whmHost).catch(e => ({ error: e.message })),
    ])
    res.json({ username: acct._id, quota, bandwidth })
  }))

  // ════════════════════════════════════════════════════════
  // SSL
  // ════════════════════════════════════════════════════════
  router.get('/hosting/:user/ssl', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.getSSLStatus(ctx.cpUser, ctx.cpPass, ctx.whmHost))
  }))

  router.post('/hosting/:user/ssl/autossl', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    if (!isLive()) return dryRun(res, acct, 'ssl.autossl')
    const ctx = withCreds(res, acct); if (!ctx) return
    const result = await whmService.startAutoSSL(ctx.cpUser)
    if (result && result.success) return res.json({ success: true, message: 'AutoSSL check started. Certificates will be issued shortly (1-3 minutes).' })
    const already = /PIDFile|already/i.test(result && result.error || '')
    if (already) return res.json({ success: true, message: 'AutoSSL is already running for this account.' })
    res.status(502).json({ success: false, error: (result && result.error) || 'AutoSSL trigger failed' })
  }))

  // ════════════════════════════════════════════════════════
  // SUBDOMAINS
  // ════════════════════════════════════════════════════════
  router.get('/hosting/:user/subdomains', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.listSubdomains(ctx.cpUser, ctx.cpPass, ctx.whmHost))
  }))

  router.post('/hosting/:user/subdomains', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const subdomain = req.body && req.body.subdomain
    const rootdomain = (req.body && req.body.rootdomain) || acct.domain
    const dir = req.body && req.body.dir
    if (missing(res, ['subdomain', subdomain], ['rootdomain', rootdomain])) return
    if (!isLive()) return dryRun(res, acct, 'subdomain.create', { subdomain: `${subdomain}.${rootdomain}` })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.createSubdomain(ctx.cpUser, ctx.cpPass, subdomain, rootdomain, dir, ctx.whmHost))
  }))

  router.delete('/hosting/:user/subdomains', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const full = bq(req, 'subdomain')
    if (missing(res, ['subdomain', full])) return
    if (!isLive()) return dryRun(res, acct, 'subdomain.delete', { subdomain: full })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.deleteSubdomain(ctx.cpUser, ctx.cpPass, full, ctx.whmHost))
  }))

  // ════════════════════════════════════════════════════════
  // DOMAINS (list / docroot / addon removal)
  //   Addon-domain ADD already exists as POST /hosting/:user/addons.
  // ════════════════════════════════════════════════════════
  router.get('/hosting/:user/domains', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.listDomains(ctx.cpUser, ctx.cpPass, ctx.whmHost))
  }))

  router.post('/hosting/:user/domains/docroot', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { subdomain, rootdomain, dir } = req.body || {}
    if (missing(res, ['subdomain', subdomain], ['rootdomain', rootdomain], ['dir', dir])) return
    if (!isLive()) return dryRun(res, acct, 'domain.docroot', { subdomain, rootdomain, dir })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.changeDomainDocRoot(ctx.cpUser, ctx.cpPass, subdomain, rootdomain, dir, ctx.whmHost))
  }))

  router.delete('/hosting/:user/domains/addon', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const domain = String(bq(req, 'domain') || '').trim().toLowerCase()
    if (missing(res, ['domain', domain])) return
    if (!isLive()) return dryRun(res, acct, 'domain.addon.remove', { domain })
    const ctx = withCreds(res, acct); if (!ctx) return
    const r = await cpProxy.removeAddonDomain(ctx.cpUser, ctx.cpPass, domain, undefined, acct.domain, ctx.whmHost)
    // Best-effort: keep the Mongo mirror in sync with cPanel.
    if (r && r.status === 1) {
      try { await col('cpanelAccounts').updateOne({ _id: acct._id }, { $pull: { addonDomains: { domain } } }) } catch (_) {}
    }
    res.json(r)
  }))

  // ════════════════════════════════════════════════════════
  // MYSQL  (databases / users / privileges / remote hosts)
  // ════════════════════════════════════════════════════════
  router.get('/hosting/:user/mysql/databases', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = withCreds(res, acct); if (!ctx) return
    if (mysqlBlocked(res, ctx)) return
    res.json(await cpProxy.listDatabases(ctx.cpUser, ctx.cpPass, ctx.whmHost))
  }))

  router.post('/hosting/:user/mysql/databases', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const name = req.body && req.body.name
    if (missing(res, ['name', name])) return
    const ctx0 = ctxFromAccount(acct); if (mysqlBlocked(res, ctx0)) return
    if (!isLive()) return dryRun(res, acct, 'mysql.database.create', { name })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.createDatabase(ctx.cpUser, ctx.cpPass, name, ctx.whmHost))
  }))

  router.delete('/hosting/:user/mysql/databases', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const name = bq(req, 'name')
    if (missing(res, ['name', name])) return
    const ctx0 = ctxFromAccount(acct); if (mysqlBlocked(res, ctx0)) return
    if (!isLive()) return dryRun(res, acct, 'mysql.database.delete', { name })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.deleteDatabase(ctx.cpUser, ctx.cpPass, name, ctx.whmHost))
  }))

  router.post('/hosting/:user/mysql/databases/rename', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { oldname, newname } = req.body || {}
    if (missing(res, ['oldname', oldname], ['newname', newname])) return
    const ctx0 = ctxFromAccount(acct); if (mysqlBlocked(res, ctx0)) return
    if (!isLive()) return dryRun(res, acct, 'mysql.database.rename', { oldname, newname })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.renameDatabase(ctx.cpUser, ctx.cpPass, oldname, newname, ctx.whmHost))
  }))

  router.post('/hosting/:user/mysql/databases/repair', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const name = req.body && req.body.name
    if (missing(res, ['name', name])) return
    const ctx0 = ctxFromAccount(acct); if (mysqlBlocked(res, ctx0)) return
    if (!isLive()) return dryRun(res, acct, 'mysql.database.repair', { name })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.repairDatabase(ctx.cpUser, ctx.cpPass, name, ctx.whmHost))
  }))

  router.post('/hosting/:user/mysql/databases/check', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const name = req.body && req.body.name
    if (missing(res, ['name', name])) return
    const ctx0 = ctxFromAccount(acct); if (mysqlBlocked(res, ctx0)) return
    if (!isLive()) return dryRun(res, acct, 'mysql.database.check', { name })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.checkDatabase(ctx.cpUser, ctx.cpPass, name, ctx.whmHost))
  }))

  router.get('/hosting/:user/mysql/users', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = withCreds(res, acct); if (!ctx) return
    if (mysqlBlocked(res, ctx)) return
    res.json(await cpProxy.listDatabaseUsers(ctx.cpUser, ctx.cpPass, ctx.whmHost))
  }))

  router.post('/hosting/:user/mysql/users', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { name, password } = req.body || {}
    if (missing(res, ['name', name], ['password', password])) return
    const ctx0 = ctxFromAccount(acct); if (mysqlBlocked(res, ctx0)) return
    if (!isLive()) return dryRun(res, acct, 'mysql.user.create', { name })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.createDatabaseUser(ctx.cpUser, ctx.cpPass, name, password, ctx.whmHost))
  }))

  router.delete('/hosting/:user/mysql/users', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const name = bq(req, 'name')
    if (missing(res, ['name', name])) return
    const ctx0 = ctxFromAccount(acct); if (mysqlBlocked(res, ctx0)) return
    if (!isLive()) return dryRun(res, acct, 'mysql.user.delete', { name })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.deleteDatabaseUser(ctx.cpUser, ctx.cpPass, name, ctx.whmHost))
  }))

  router.put('/hosting/:user/mysql/users/password', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { user, password } = req.body || {}
    if (missing(res, ['user', user], ['password', password])) return
    const ctx0 = ctxFromAccount(acct); if (mysqlBlocked(res, ctx0)) return
    if (!isLive()) return dryRun(res, acct, 'mysql.user.password', { user })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.setDatabaseUserPassword(ctx.cpUser, ctx.cpPass, user, password, ctx.whmHost))
  }))

  router.post('/hosting/:user/mysql/users/rename', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { oldname, newname } = req.body || {}
    if (missing(res, ['oldname', oldname], ['newname', newname])) return
    const ctx0 = ctxFromAccount(acct); if (mysqlBlocked(res, ctx0)) return
    if (!isLive()) return dryRun(res, acct, 'mysql.user.rename', { oldname, newname })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.renameDatabaseUser(ctx.cpUser, ctx.cpPass, oldname, newname, ctx.whmHost))
  }))

  router.post('/hosting/:user/mysql/privileges/grant', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { user, database, privileges } = req.body || {}
    if (missing(res, ['user', user], ['database', database], ['privileges', privileges])) return
    const ctx0 = ctxFromAccount(acct); if (mysqlBlocked(res, ctx0)) return
    if (!isLive()) return dryRun(res, acct, 'mysql.privileges.grant', { user, database })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.setUserPrivilegesOnDatabase(ctx.cpUser, ctx.cpPass, user, database, privileges, ctx.whmHost))
  }))

  router.post('/hosting/:user/mysql/privileges/revoke', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { user, database } = req.body || {}
    if (missing(res, ['user', user], ['database', database])) return
    const ctx0 = ctxFromAccount(acct); if (mysqlBlocked(res, ctx0)) return
    if (!isLive()) return dryRun(res, acct, 'mysql.privileges.revoke', { user, database })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.revokeUserPrivilegesOnDatabase(ctx.cpUser, ctx.cpPass, user, database, ctx.whmHost))
  }))

  router.get('/hosting/:user/mysql/remote-hosts', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = withCreds(res, acct); if (!ctx) return
    if (mysqlBlocked(res, ctx)) return
    res.json(await cpProxy.listMysqlRemoteHosts(ctx.cpUser, ctx.cpPass, ctx.whmHost))
  }))

  router.post('/hosting/:user/mysql/remote-hosts', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const remoteHost = req.body && req.body.host
    if (missing(res, ['host', remoteHost])) return
    const ctx0 = ctxFromAccount(acct); if (mysqlBlocked(res, ctx0)) return
    if (!isLive()) return dryRun(res, acct, 'mysql.remote-host.add', { host: remoteHost })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.addMysqlRemoteHost(ctx.cpUser, ctx.cpPass, remoteHost, ctx.whmHost))
  }))

  router.delete('/hosting/:user/mysql/remote-hosts', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const remoteHost = bq(req, 'host')
    if (missing(res, ['host', remoteHost])) return
    const ctx0 = ctxFromAccount(acct); if (mysqlBlocked(res, ctx0)) return
    if (!isLive()) return dryRun(res, acct, 'mysql.remote-host.delete', { host: remoteHost })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.deleteMysqlRemoteHost(ctx.cpUser, ctx.cpPass, remoteHost, ctx.whmHost))
  }))

  // ════════════════════════════════════════════════════════
  // FILE MANAGER
  // ════════════════════════════════════════════════════════
  router.get('/hosting/:user/files', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = withCreds(res, acct); if (!ctx) return
    const dir = req.query.dir || '/public_html'
    res.json(await cpProxy.listFiles(ctx.cpUser, ctx.cpPass, dir, ctx.whmHost))
  }))

  router.get('/hosting/:user/files/content', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { dir, file } = req.query
    if (missing(res, ['dir', dir], ['file', file])) return
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.getFileContent(ctx.cpUser, ctx.cpPass, dir, file, ctx.whmHost))
  }))

  router.post('/hosting/:user/files/save', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { dir, file, content } = req.body || {}
    if (missing(res, ['dir', dir], ['file', file])) return
    if (isProtectedAntiRedFile(dir, file)) return res.status(403).json({ error: 'protected_file', message: `${file} is protected by Anti-Red and cannot be modified.` })
    if (!isLive()) return dryRun(res, acct, 'files.save', { path: `${dir}/${file}` })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.saveFileContent(ctx.cpUser, ctx.cpPass, dir, file, content != null ? content : '', ctx.whmHost))
  }))

  router.post('/hosting/:user/files/mkdir', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { dir, name } = req.body || {}
    if (missing(res, ['dir', dir], ['name', name])) return
    if (!isLive()) return dryRun(res, acct, 'files.mkdir', { path: `${dir}/${name}` })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.createDirectory(ctx.cpUser, ctx.cpPass, dir, name, ctx.whmHost))
  }))

  router.delete('/hosting/:user/files', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const dir = bq(req, 'dir'); const file = bq(req, 'file')
    const isDirectory = String(bq(req, 'isDirectory') || '') === 'true' || bq(req, 'isDirectory') === true
    if (missing(res, ['dir', dir], ['file', file])) return
    if (isProtectedAntiRedFile(dir, file)) return res.status(403).json({ error: 'protected_file', message: `${file} is protected by Anti-Red and cannot be deleted.` })
    if (!isLive()) return dryRun(res, acct, 'files.delete', { path: `${dir}/${file}` })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.deleteFile(ctx.cpUser, ctx.cpPass, dir, file, ctx.whmHost, isDirectory))
  }))

  router.post('/hosting/:user/files/rename', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { dir, oldName, newName } = req.body || {}
    if (missing(res, ['dir', dir], ['oldName', oldName], ['newName', newName])) return
    if (!isLive()) return dryRun(res, acct, 'files.rename', { from: `${dir}/${oldName}`, to: `${dir}/${newName}` })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.renameFile(ctx.cpUser, ctx.cpPass, dir, oldName, newName, ctx.whmHost))
  }))

  router.post('/hosting/:user/files/extract', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { dir, file, destDir } = req.body || {}
    if (missing(res, ['dir', dir], ['file', file])) return
    if (!isLive()) return dryRun(res, acct, 'files.extract', { file: `${dir}/${file}`, destDir: destDir || dir })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.extractFile(ctx.cpUser, ctx.cpPass, dir, file, destDir, ctx.whmHost))
  }))

  router.post('/hosting/:user/files/compress', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { dir, files, destFile } = req.body || {}
    if (missing(res, ['dir', dir], ['destFile', destFile])) return
    if (!Array.isArray(files) || !files.length) return res.status(400).json({ error: 'invalid_parameter', message: "'files' must be a non-empty array of file names." })
    if (!isLive()) return dryRun(res, acct, 'files.compress', { files, destFile: `${dir}/${destFile}` })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.compressFiles(ctx.cpUser, ctx.cpPass, dir, files, destFile, ctx.whmHost))
  }))

  router.post('/hosting/:user/files/copy', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { sourceDir, fileName, destDir } = req.body || {}
    if (missing(res, ['sourceDir', sourceDir], ['fileName', fileName], ['destDir', destDir])) return
    if (!isLive()) return dryRun(res, acct, 'files.copy', { from: `${sourceDir}/${fileName}`, to: destDir })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.copyFile(ctx.cpUser, ctx.cpPass, sourceDir, fileName, destDir, ctx.whmHost))
  }))

  router.post('/hosting/:user/files/move', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { sourceDir, fileName, destDir } = req.body || {}
    if (missing(res, ['sourceDir', sourceDir], ['fileName', fileName], ['destDir', destDir])) return
    if (!isLive()) return dryRun(res, acct, 'files.move', { from: `${sourceDir}/${fileName}`, to: `${destDir}/${fileName}` })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.moveFile(ctx.cpUser, ctx.cpPass, sourceDir, fileName, destDir, ctx.whmHost))
  }))

  // Upload a file via base64 body (small files). Reuses cpProxy.uploadFile.
  router.post('/hosting/:user/files/upload', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const { dir, fileName } = req.body || {}
    const contentB64 = (req.body && (req.body.content_base64 || req.body.contentBase64)) || null
    if (missing(res, ['dir', dir], ['fileName', fileName], ['content_base64', contentB64])) return
    let buffer
    try { buffer = Buffer.from(String(contentB64), 'base64') } catch (e) { return res.status(400).json({ error: 'invalid_base64', message: 'content_base64 must be valid base64.' }) }
    if (!isLive()) return dryRun(res, acct, 'files.upload', { path: `${dir}/${fileName}`, bytes: buffer.length })
    const ctx = withCreds(res, acct); if (!ctx) return
    res.json(await cpProxy.uploadFile(ctx.cpUser, ctx.cpPass, dir, fileName, buffer, ctx.whmHost))
  }))

  // ════════════════════════════════════════════════════════
  // SECURITY / ANTI-RED  (Cloudflare-backed premium protection)
  // ════════════════════════════════════════════════════════
  router.get('/hosting/:user/security/status', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = ctxFromAccount(acct)
    const domain = ctx.cpDomain
    const [zone, jsEnabled, sbResult, blResult] = await Promise.all([
      cfService.getZoneByName(domain).catch(() => null),
      antiRed.isJSChallengeEnabled(ctx.cpUser).catch(() => false),
      safeBrowsing.checkDomain(domain).catch(() => ({ error: 'check failed' })),
      safeBrowsing.checkBlacklists(domain).catch(() => ({ error: 'check failed' })),
    ])
    let antiBot = null
    if (zone) { try { antiBot = await cfService.getSecuritySettings(zone.id); antiBot.zoneId = zone.id } catch (_) {} }
    res.json({
      username: acct._id,
      domain,
      plan: ctx.cpPlan,
      is_gold: ctx.cpIsGold,
      antiBot,
      antiRed: { safeBrowsing: sbResult, blacklist: blResult },
      configured: { safeBrowsing: safeBrowsing.isConfigured() },
      protectionLayers: {
        jsChallenge: jsEnabled,
        cloudflareZone: !!zone,
      },
      stats: {
        scannerIpRanges: antiRed.SCANNER_IP_RANGES.length,
        scannerUserAgents: antiRed.SCANNER_USER_AGENTS.length,
        ja3Hashes: antiRed.SCANNER_JA3_HASHES.length,
      },
    })
  }))

  router.get('/hosting/:user/security/anti-red/status', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = ctxFromAccount(acct)
    const jsEnabled = await antiRed.isJSChallengeEnabled(ctx.cpUser).catch(() => false)
    res.json({
      username: acct._id,
      scannerIpRanges: antiRed.SCANNER_IP_RANGES.length,
      scannerUserAgents: antiRed.SCANNER_USER_AGENTS.length,
      ja3Hashes: antiRed.SCANNER_JA3_HASHES.length,
      jsChallengeEnabled: jsEnabled,
      protectionLayers: ['htaccess_ip_cloaking', 'scanner_ua_blocking', 'js_challenge', 'ja3_fingerprinting', 'cf_waf_rules'],
    })
  }))

  router.post('/hosting/:user/security/anti-red/deploy', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = ctxFromAccount(acct)
    if (!isLive()) return dryRun(res, acct, 'security.anti-red.deploy', { domain: ctx.cpDomain })
    const result = await antiRed.deployFullProtection(ctx.cpUser, ctx.cpDomain, ctx.cpPlan || '')
    res.json(result)
  }))

  router.post('/hosting/:user/security/anti-bot', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const profile = req.body && req.body.profile
    const allowed = ['off', 'low', 'medium', 'high', 'under_attack']
    if (!allowed.includes(profile)) return res.status(400).json({ error: 'invalid_profile', message: `profile must be one of: ${allowed.join(', ')}` })
    const ctx = ctxFromAccount(acct)
    if (!isLive()) return dryRun(res, acct, 'security.anti-bot', { profile })
    const zone = await cfService.getZoneByName(ctx.cpDomain)
    if (!zone) return res.status(404).json({ error: 'cf_zone_not_found', message: 'Cloudflare zone not found for this domain.' })
    res.json(await cfService.setAntiBotProfile(zone.id, profile))
  }))

  router.post('/hosting/:user/security/anti-bot/rules', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = ctxFromAccount(acct)
    if (!isLive()) return dryRun(res, acct, 'security.anti-bot.rules', { domain: ctx.cpDomain })
    const zone = await cfService.getZoneByName(ctx.cpDomain)
    if (!zone) return res.status(404).json({ error: 'cf_zone_not_found', message: 'Cloudflare zone not found for this domain.' })
    res.json(await cfService.createAntiBotRules(zone.id))
  }))

  router.get('/hosting/:user/security/safe-browsing', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = ctxFromAccount(acct)
    res.json(await safeBrowsing.checkDomain(ctx.cpDomain))
  }))

  router.get('/hosting/:user/security/blacklist', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = ctxFromAccount(acct)
    res.json(await safeBrowsing.checkBlacklists(ctx.cpDomain))
  }))

  // Visitor Captcha (Golden plan) — enable/disable the human challenge page for
  // a specific domain. Mirrors panel POST /security/captcha/toggle.
  router.get('/hosting/:user/security/visitor-captcha', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = ctxFromAccount(acct)
    const db = getDb()
    const allDomains = [ctx.cpDomain, ...ctx.cpAddonDomains].filter(Boolean)
    const domains = await Promise.all(allDomains.map(async (d) => {
      const cf = await antiRed.resolveDomainCfState(d, db).catch(() => ({}))
      return { domain: d, enabled: !!(cf.hasCloudflare && !cf.isOff), hasCloudflare: !!cf.hasCloudflare, isMain: d === ctx.cpDomain }
    }))
    res.json({ username: acct._id, is_gold: ctx.cpIsGold, plan: ctx.cpPlan, captchaGoldOnly: true, domains })
  }))

  router.post('/hosting/:user/security/visitor-captcha', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = ctxFromAccount(acct)
    if (goldBlocked(res, ctx)) return
    const enabled = req.body && req.body.enabled
    let domain = (req.body && req.body.domain) || ctx.cpDomain
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'missing_parameter', message: "'enabled' (boolean) is required." })
    domain = String(domain).toLowerCase()
    const allDomains = [ctx.cpDomain, ...ctx.cpAddonDomains].filter(Boolean).map(d => d.toLowerCase())
    if (!allDomains.includes(domain)) return res.status(403).json({ error: 'domain_not_owned', message: 'Domain does not belong to this account.' })
    if (!isLive()) return dryRun(res, acct, 'security.visitor-captcha', { domain, enabled })
    const db = getDb()
    const cf = await antiRed.resolveDomainCfState(domain, db)
    if (!cf.hasCloudflare || !cf.zoneId) return res.status(400).json({ error: 'no_cloudflare', message: `Visitor Captcha requires Cloudflare nameservers. ${domain} is not on Cloudflare.` })
    const workerResult = await antiRed.deploySharedWorkerRoute(domain, cf.zoneId)
    if (!workerResult || !workerResult.success) return res.status(502).json({ error: 'worker_deploy_failed', message: (workerResult && workerResult.error) || 'Failed to update Visitor Captcha.' })
    try {
      if (enabled) {
        await db.collection('registeredDomains').updateOne({ _id: domain }, { $unset: { 'val.antiRedOff': '', 'val.antiRedOffAt': '', 'val.visitorCaptchaOff': '' } })
        await antiRed.setDomainChallengeBypass(domain, false)
      } else {
        await db.collection('registeredDomains').updateOne({ _id: domain }, { $set: { 'val.visitorCaptchaOff': true }, $unset: { 'val.antiRedOff': '', 'val.antiRedOffAt': '' } })
        await antiRed.setDomainChallengeBypass(domain, true)
      }
    } catch (_) { /* best-effort persistence */ }
    res.json({ success: true, username: acct._id, domain, enabled, hasCloudflare: true })
  }))

  // ════════════════════════════════════════════════════════
  // GEO BLOCKING  (Golden plan)  — Cloudflare firewall rules
  // ════════════════════════════════════════════════════════
  router.get('/hosting/:user/geo', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = ctxFromAccount(acct)
    if (goldBlocked(res, ctx)) return
    const zone = await cfService.getZoneByName(ctx.cpDomain)
    if (!zone) return res.json({ rules: [], error: 'Domain not in Cloudflare' })
    const rules = await cfService.listFirewallRules(zone.id)
    const geoRules = (rules || []).filter(r => r.filter && r.filter.expression && r.filter.expression.includes('ip.geoip.country'))
      .map(r => ({ id: r.id, description: r.description || '', action: r.action, expression: (r.filter && r.filter.expression) || '', paused: r.paused || false }))
    res.json({ rules: geoRules, zoneId: zone.id })
  }))

  router.post('/hosting/:user/geo', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = ctxFromAccount(acct)
    if (goldBlocked(res, ctx)) return
    const { countries, mode: geoMode, description } = req.body || {}
    if (!Array.isArray(countries) || !countries.length || !geoMode) return res.status(400).json({ error: 'missing_parameter', message: 'countries (non-empty array) and mode (block|allow) are required.' })
    if (!isLive()) return dryRun(res, acct, 'geo.create', { countries, mode: geoMode })
    const zone = await cfService.getZoneByName(ctx.cpDomain)
    if (!zone) return res.status(400).json({ error: 'cf_zone_not_found', message: 'Domain not in Cloudflare.' })
    res.json(await cfService.createGeoRule(zone.id, countries, geoMode, description))
  }))

  router.delete('/hosting/:user/geo', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = ctxFromAccount(acct)
    if (goldBlocked(res, ctx)) return
    const ruleId = bq(req, 'ruleId')
    if (missing(res, ['ruleId', ruleId])) return
    if (!isLive()) return dryRun(res, acct, 'geo.delete', { ruleId })
    const zone = await cfService.getZoneByName(ctx.cpDomain)
    if (!zone) return res.status(400).json({ error: 'cf_zone_not_found', message: 'Domain not in Cloudflare.' })
    res.json(await cfService.deleteFirewallRule(zone.id, ruleId))
  }))

  // ════════════════════════════════════════════════════════
  // ANALYTICS  (Cloudflare zone analytics) — read
  // ════════════════════════════════════════════════════════
  router.get('/hosting/:user/analytics', apiKeyAuth, h(async (req, res) => {
    const acct = await loadOwned(req, res); if (!acct) return
    const ctx = ctxFromAccount(acct)
    const days = parseInt(req.query.days, 10) || 7
    const detailed = req.query.detailed !== 'false'
    const zone = await cfService.getZoneByName(ctx.cpDomain)
    if (!zone) return res.json({ success: false, error: 'Domain not in Cloudflare' })
    if (detailed) return res.json(await cfService.getDetailedZoneAnalytics(zone.id, days))
    res.json(await cfService.getZoneAnalytics(zone.id, days))
  }))

  log(`[ResellerAPI] hosting-management routes registered (email, mysql, subdomains, files, domains, ssl, stats, security, geo, analytics)`)
}

module.exports = { registerHostingMgmtRoutes, ctxFromAccount, isProtectedAntiRedFile }
