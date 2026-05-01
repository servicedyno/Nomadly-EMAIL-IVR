/**
 * cPanel Job Handlers
 * --------------------
 * Each handler is invoked by cpanel-job-queue when WHM is reachable.
 *
 * Handlers must be SHORT-CIRCUIT-SAFE: if WHM is still flaky and the call fails
 * with an ECONNREFUSED-like error, return { ok: false, deferred: true, reason }.
 * Anything else is a hard failure that escalates to admin.
 *
 * This file is wired up by cpanel-job-queue.registerHandler at module load.
 */

const { log } = require('console')
const queue = require('./cpanel-job-queue')

const WHM_CONNECT_ERR_RX = /ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up|connect ETIMEDOUT|connect ECONN/i

function looksLikeCpanelDown(err) {
  if (!err) return false
  if (typeof err === 'string') return WHM_CONNECT_ERR_RX.test(err)
  if (err.code && WHM_CONNECT_ERR_RX.test(err.code)) return true
  if (err.message && WHM_CONNECT_ERR_RX.test(err.message)) return true
  if (err.errors && Array.isArray(err.errors)) {
    return err.errors.some(e => WHM_CONNECT_ERR_RX.test(String(e)))
  }
  return false
}

// ─── Localised user-facing copy ────────────────────────

const COPY = {
  provisionDone: {
    en: (domain) => `🎉 <b>Your hosting for ${domain} is ready!</b>\nLogin details have been delivered above.`,
    fr: (domain) => `🎉 <b>Votre hébergement pour ${domain} est prêt !</b>\nLes identifiants ont été envoyés ci-dessus.`,
    zh: (domain) => `🎉 <b>${domain} 的主机已准备就绪！</b>\n登录详情已在上方发送。`,
    hi: (domain) => `🎉 <b>${domain} के लिए आपकी होस्टिंग तैयार है!</b>\nलॉगिन विवरण ऊपर भेज दिए गए हैं।`,
  },
  mutationDone: {
    en: (label) => `✅ <b>${label}</b> completed.`,
    fr: (label) => `✅ <b>${label}</b> terminé.`,
    zh: (label) => `✅ <b>${label}</b> 已完成。`,
    hi: (label) => `✅ <b>${label}</b> पूर्ण हुआ।`,
  },
  mutationFailed: {
    en: (label) => `❌ Could not complete <b>${label}</b>. Tap 💬 Get Support for help.`,
    fr: (label) => `❌ Impossible de finaliser <b>${label}</b>. Touchez 💬 Obtenir de l'aide.`,
    zh: (label) => `❌ 无法完成 <b>${label}</b>。点击 💬 获取支持。`,
    hi: (label) => `❌ <b>${label}</b> पूरा नहीं हो सका। 💬 सहायता लें पर टैप करें।`,
  },
}
function msg(table, lang, ...args) {
  const fn = (table && (table[lang] || table.en))
  return typeof fn === 'function' ? fn(...args) : ''
}

// ─── Type: 'provision' (post-payment hosting setup) ──────
//
// Re-runs registerDomainAndCreateCpanel with the captured `info` payload.
// The function has its own IDEMPOTENCY guard, so re-runs after partial progress
// are safe (e.g. if domain registration already completed last time).

queue.registerHandler('provision', async ({ job, deps }) => {
  const { send, db } = deps
  const info = job.params?.info
  if (!info) return { ok: false, deferred: false, reason: 'missing params.info' }

  // Lazy-require to avoid circular: cr-register-domain-... → _index
  const { registerDomainAndCreateCpanel } = require('./cr-register-domain-&-create-cpanel')

  // We reuse `send` (deps.send) and inject minimal keyboardButtons.
  // The function returns success/failure objects; on transient WHM error we re-defer.
  const keyboardButtons = deps.rem || { reply_markup: { remove_keyboard: true } }

  // Telegraf-style state collection (mongo) — registerDomainAndCreateCpanel
  // expects a collection-like object with set() etc. We pass the raw db's `state`.
  const state = db.collection('state')

  try {
    const result = await registerDomainAndCreateCpanel(send, info, keyboardButtons, state, deps.bot || null)
    if (result?.success) {
      // Provisioning function already DM'd credentials. Just confirm done.
      try { send(job.chatId, msg(COPY.provisionDone, job.lang, job.domain || info.website_name)) } catch (_) {}
      return { ok: true }
    }
    // If error string smells like CPANEL_DOWN, defer — otherwise hard fail
    const errStr = result?.error || ''
    if (looksLikeCpanelDown(errStr) || /CPANEL_DOWN|hosting setup failed/i.test(errStr)) {
      return { ok: false, deferred: true, reason: errStr || 'CPANEL_DOWN' }
    }
    // Genuine failure — but the function already messaged the user. Escalate.
    return { ok: false, deferred: false, reason: errStr || 'unknown provisioning failure' }
  } catch (err) {
    if (looksLikeCpanelDown(err)) return { ok: false, deferred: true, reason: err.message }
    log(`[cPanel Handlers] provision error: ${err.stack || err.message}`)
    return { ok: false, deferred: false, reason: err.message }
  }
})

// ─── Type: 'mutation' (existing-user write op) ───────────
//
// params: { kind, label, args }
//   kind ∈ { 'saveFile', 'suspend', 'unsuspend', 'enableMaintenance',
//            'disableMaintenance', 'unlinkAddon', 'linkAddon', 'cancelPlan' }
//
// label is a human-readable description like "Save file index.html".
// args is what the underlying function needs to replay the call.

queue.registerHandler('mutation', async ({ job, deps }) => {
  const { send, db } = deps
  const { kind, label, args } = job.params || {}
  if (!kind) return { ok: false, deferred: false, reason: 'missing params.kind' }

  try {
    const ok = await _runMutation(kind, args, db)
    if (ok === true) {
      try { send(job.chatId, msg(COPY.mutationDone, job.lang, label || kind)) } catch (_) {}
      return { ok: true }
    }
    if (ok && ok.deferred) return { ok: false, deferred: true, reason: ok.reason }
    // Hard failure — notify user
    try { send(job.chatId, msg(COPY.mutationFailed, job.lang, label || kind)) } catch (_) {}
    return { ok: false, deferred: false, reason: ok?.reason || 'mutation failed' }
  } catch (err) {
    if (looksLikeCpanelDown(err)) return { ok: false, deferred: true, reason: err.message }
    log(`[cPanel Handlers] mutation(${kind}) error: ${err.stack || err.message}`)
    try { send(job.chatId, msg(COPY.mutationFailed, job.lang, label || kind)) } catch (_) {}
    return { ok: false, deferred: false, reason: err.message }
  }
})

async function _runMutation(kind, args, db) {
  const cpProxy = require('./cpanel-proxy')
  const cpAuth  = require('./cpanel-auth')
  const whmService = require('./whm-service')
  const siteStatus = require('./site-status-service')

  const cpanelAccountsCol = db.collection('cpanelAccounts')

  // helper: load + decrypt cpPass
  async function loadAcct(domainOrUser) {
    const acct = await cpanelAccountsCol.findOne({
      $or: [{ domain: domainOrUser }, { cpUser: domainOrUser?.toLowerCase?.() }, { _id: domainOrUser?.toLowerCase?.() }],
      deleted: { $ne: true },
    })
    if (!acct) return null
    const cpPass = acct.cpPass_encrypted
      ? cpAuth.decrypt({ encrypted: acct.cpPass_encrypted, iv: acct.cpPass_iv, tag: acct.cpPass_tag })
      : null
    return { acct, cpPass }
  }
  function checkResult(r) {
    if (r && r.code === 'CPANEL_DOWN') return { deferred: true, reason: r.code }
    if (r?.errors?.length && r.errors.some(e => looksLikeCpanelDown(e))) return { deferred: true, reason: r.errors[0] }
    if (r?.status === 1) return true
    return { deferred: false, reason: (r?.errors || []).join(', ') || 'unknown' }
  }

  switch (kind) {
    case 'saveFile': {
      const { domain, dir, file, content } = args || {}
      const a = await loadAcct(domain || args?.cpUser)
      if (!a?.cpPass) return { reason: 'no credentials' }
      const r = await cpProxy.saveFileContent(a.acct.cpUser, a.cpPass, dir, file, content, a.acct.whmHost)
      return checkResult(r)
    }
    case 'unlinkAddon': {
      const { domain, addonDomain } = args || {}
      const a = await loadAcct(domain)
      if (!a?.cpPass) return { reason: 'no credentials' }
      const r = await cpProxy.removeAddonDomain(a.acct.cpUser, a.cpPass, addonDomain, undefined, a.acct.domain, a.acct.whmHost)
      const verdict = checkResult(r)
      if (verdict === true) {
        await cpanelAccountsCol.updateOne({ _id: a.acct._id }, { $pull: { addonDomains: addonDomain } })
      }
      return verdict
    }
    case 'suspend': {
      const { domain, reason } = args || {}
      const a = await loadAcct(domain)
      if (!a) return { reason: 'no account' }
      const ok = await whmService.suspendAccount(a.acct.cpUser, reason || 'Taken offline by user')
      if (!ok) return { deferred: false, reason: 'WHM suspend failed' }
      await cpanelAccountsCol.updateOne({ _id: a.acct._id }, { $set: { suspended: true, suspendedAt: new Date(), suspendReason: reason || null } })
      return true
    }
    case 'unsuspend': {
      const { domain } = args || {}
      const a = await loadAcct(domain)
      if (!a) return { reason: 'no account' }
      const ok = await whmService.unsuspendAccount(a.acct.cpUser)
      if (!ok) return { deferred: false, reason: 'WHM unsuspend failed' }
      await cpanelAccountsCol.updateOne({ _id: a.acct._id }, { $set: { suspended: false }, $unset: { suspendedAt: '', suspendReason: '' } })
      return true
    }
    case 'enableMaintenance': {
      const { domain } = args || {}
      const a = await loadAcct(domain)
      if (!a) return { reason: 'no account' }
      const r = await siteStatus.enableMaintenanceMode(a.acct)
      if (r.ok) {
        await cpanelAccountsCol.updateOne({ _id: a.acct._id }, { $set: { maintenanceMode: true, maintenanceAt: new Date() } })
        return true
      }
      if (looksLikeCpanelDown(r.error)) return { deferred: true, reason: r.error }
      return { deferred: false, reason: r.error }
    }
    case 'disableMaintenance': {
      const { domain } = args || {}
      const a = await loadAcct(domain)
      if (!a) return { reason: 'no account' }
      const r = await siteStatus.disableMaintenanceMode(a.acct)
      if (r.ok) {
        await cpanelAccountsCol.updateOne({ _id: a.acct._id }, { $set: { maintenanceMode: false }, $unset: { maintenanceAt: '' } })
        return true
      }
      if (looksLikeCpanelDown(r.error)) return { deferred: true, reason: r.error }
      return { deferred: false, reason: r.error }
    }
    case 'cancelPlan': {
      const { domain } = args || {}
      const a = await loadAcct(domain)
      if (!a) return { reason: 'no account' }
      // No refund on cancellation — just suspend + flag deleted in DB
      await whmService.suspendAccount(a.acct.cpUser, 'Plan cancelled by user').catch(() => {})
      await cpanelAccountsCol.updateOne({ _id: a.acct._id }, { $set: { deleted: true, deletedAt: new Date(), deleteReason: 'user_cancellation' } })
      return true
    }
    default:
      return { deferred: false, reason: `unknown mutation kind: ${kind}` }
  }
}

module.exports = { looksLikeCpanelDown }
