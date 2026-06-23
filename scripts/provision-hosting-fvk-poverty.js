/**
 * One-off admin provision: 1-Week Premium Anti-Red plan for @fvk_poverty
 *   - Domain: nymcub.com (EXTERNAL — user owns it elsewhere, not registered through us)
 *   - chatId: 928068276
 *   - Plan:   "Premium Anti-Red (1-Week)" → WHM pkg Premium-Anti-Red-1-Week
 *   - Pricing: $0 GIFT (no wallet debit), $30 list price stamped as priceUsd
 *              so renewal scheduler is not biased (autoRenew is OFF for weekly)
 *   - Expiry: now + 7 days
 *   - Full treatment: CF zone + DNS, domain-link in user's account, WHM create,
 *     cpanel credentials + PIN, Anti-Red protection, Telegram notify, tx log,
 *     admin + group notification, health-check schedule, external-NS-update warning.
 *
 * Run:  node scripts/provision-hosting-fvk-poverty.js
 */

// Force production bot token so the credentials DM lands in the user's REAL chat
process.env.BOT_ENVIRONMENT = 'production'

require('dotenv').config({ path: '/app/backend/.env' })
require('../js/config-setup') // picks production bot token because BOT_ENVIRONMENT=production

const { MongoClient } = require('mongodb')
const TelegramBot = require('node-telegram-bot-api')

const whm = require('../js/whm-service')
const cfService = require('../js/cf-service')
const cpAuth = require('../js/cpanel-auth')
const antiRedService = require('../js/anti-red-service')
const domainService = require('../js/domain-service')
const cpHealth = require('../js/cpanel-health')

const CHAT_ID = '928068276' // @fvk_poverty
const EXPECTED_NAME = 'fvk_poverty'
const DOMAIN = 'nymcub.com'
const PLAN_NAME = 'Premium Anti-Red (1-Week)' // matches PLAN_MAP key (case-insensitive) → Premium-Anti-Red-1-Week
const DURATION_DAYS = 7
const EXPIRY_DATE = new Date(Date.now() + DURATION_DAYS * 24 * 60 * 60 * 1000)
const LIST_PRICE_USD = parseFloat(process.env.PREMIUM_ANTIRED_WEEKLY_PRICE || '30')

const WHM_HOST = process.env.WHM_HOST
const PANEL_DOMAIN = process.env.PANEL_DOMAIN
const SELF_URL_PROD = process.env.SELF_URL_PROD
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID
const CHANNEL_ID = process.env.CHANNEL_ID || process.env.TELEGRAM_GROUP_ID

function generateTxnId() {
  return `TX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

function logStep(msg) {
  console.log(`[ProvisionFvkPoverty] ${msg}`)
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('No TELEGRAM_BOT_TOKEN — aborting')
  const bot = new TelegramBot(token, { webHook: false, polling: false })
  logStep(`Bot token loaded: …${token.slice(-6)}`)

  if (!WHM_HOST) throw new Error('WHM_HOST not configured')
  if (!process.env.WHM_TOKEN) throw new Error('WHM_TOKEN not configured')

  const client = new MongoClient(process.env.MONGO_URL, { serverSelectionTimeoutMS: 30000 })
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  logStep(`Connected to MongoDB (Railway prod)`)

  // ─── 0. Preflight ────────────────────────────────────────────
  const nameOf = db.collection('nameOf')
  const user = await nameOf.findOne({ _id: CHAT_ID })
  if (!user) throw new Error(`User ${CHAT_ID} not found in nameOf`)
  if (user.val?.toLowerCase() !== EXPECTED_NAME) {
    throw new Error(`User mismatch: expected ${EXPECTED_NAME}, got ${JSON.stringify(user)}`)
  }
  logStep(`User verified: ${user.val} (chatId ${CHAT_ID})`)

  const existingCpa = await db.collection('cpanelAccounts').findOne({ domain: DOMAIN, deleted: { $ne: true } })
  if (existingCpa) throw new Error(`cpanelAccount already exists for ${DOMAIN}: ${existingCpa.cpUser} (chatId=${existingCpa.chatId})`)
  logStep(`No existing cpanelAccount for ${DOMAIN} ✔︎`)

  // ─── 1. WHM reachability probe ───────────────────────────────
  const whmOk = await cpHealth.isWhmReachable()
  if (!whmOk) throw new Error(`WHM at ${WHM_HOST} is not reachable — aborting (will not silently queue)`)
  logStep(`WHM reachable ✔︎`)

  // ─── 2. Cloudflare zone for the external domain ──────────────
  logStep(`Creating/ensuring Cloudflare zone for ${DOMAIN}…`)
  const zoneRes = await cfService.createZone(DOMAIN)
  if (!zoneRes.success || !zoneRes.zoneId) {
    throw new Error(`CF zone failed: ${JSON.stringify(zoneRes.errors || zoneRes)}`)
  }
  const cfZoneId = zoneRes.zoneId
  const cfNameservers = zoneRes.nameservers || []
  logStep(`CF zone ${cfZoneId} status=${zoneRes.status} NS=${cfNameservers.join(', ')}`)
  if (cfNameservers.length < 2) {
    throw new Error(`CF returned <2 nameservers for ${DOMAIN}: ${JSON.stringify(cfNameservers)}`)
  }

  // ─── 3. CF DNS records pointing to WHM + SSL + HTTPS enforce ─
  // Mirrors cr-register-domain logic: cleanup conflicts first, then create proxied records
  try {
    const cleanup = await cfService.cleanupConflictingDNS(cfZoneId, DOMAIN)
    if (cleanup?.deleted?.length) {
      logStep(`Cleaned up ${cleanup.deleted.length} conflicting DNS records`)
    }
  } catch (e) { logStep(`DNS cleanup warning (non-blocking): ${e.message}`) }

  const dnsRes = await cfService.createHostingDNSRecords(cfZoneId, DOMAIN, WHM_HOST, true)
  logStep(`CF DNS records: ${dnsRes?.success ? 'all created (proxied)' : 'partial — ' + JSON.stringify(Object.keys(dnsRes?.results || {}))}`)

  try { await cfService.setSSLMode(cfZoneId, 'flexible'); logStep(`✓ SSL mode = flexible`) } catch (e) { logStep(`SSL mode err: ${e.message}`) }
  try { await cfService.enforceHTTPS(cfZoneId);          logStep(`✓ HTTPS enforced`) } catch (e) { logStep(`enforceHTTPS err: ${e.message}`) }
  try { await cfService.enableAuthenticatedOriginPulls(cfZoneId); logStep(`✓ AOP enabled`) } catch (e) { logStep(`AOP warning: ${e.message}`) }

  // ─── 4. Link domain to user (domainsOf + registeredDomains) ──
  const domainKey = DOMAIN.replace(/\./g, '@')
  await db.collection('domainsOf').updateOne(
    { _id: CHAT_ID },
    { $set: { [domainKey]: true } },
    { upsert: true }
  )
  logStep(`✓ domainsOf.${CHAT_ID}.${domainKey} = true`)

  // Try to detect registrar; external domains we don't own end up `external_unmanaged`
  let detectedRegistrar = null
  try {
    detectedRegistrar = await domainService.detectRegistrarForDomain(DOMAIN, db)
  } catch (e) { logStep(`registrar detect failed (non-blocking): ${e.message}`) }
  const registrarTag = detectedRegistrar || 'external_unmanaged'
  logStep(`Registrar tag for ${DOMAIN}: ${registrarTag}`)

  await db.collection('registeredDomains').updateOne(
    { _id: DOMAIN },
    { $set: {
      val: {
        domain: DOMAIN,
        provider: registrarTag,
        registrar: registrarTag,
        nameserverType: 'cloudflare',
        nameservers: cfNameservers,
        autoRenew: false,
        ownerChatId: CHAT_ID,
        status: 'registered',
        registeredAt: new Date(),
        linkedAt: new Date(),
        cfZoneId,
        external: true,
        adminProvisioned: true,
        adminProvisionReason: 'gift-fvk_poverty',
      },
    }},
    { upsert: true }
  )
  logStep(`✓ registeredDomains._id=${DOMAIN} upserted (external + adminProvisioned)`)

  // ─── 5. WHM createAccount (Weekly plan, CF NS mode) ──────────
  logStep(`Creating WHM account (plan="${PLAN_NAME}" → pkg Premium-Anti-Red-1-Week)…`)
  const serviceEmail = process.env.NOMADLY_SERVICE_EMAIL
  const whmRes = await whm.createAccount(DOMAIN, PLAN_NAME, serviceEmail, undefined, { useCloudflareNS: true })
  if (!whmRes.success) throw new Error(`WHM createAccount failed: ${whmRes.error}${whmRes.code ? ' (' + whmRes.code + ')' : ''}`)
  logStep(`✓ WHM account: ${whmRes.username} @ ${DOMAIN} (pkg=${whmRes.package})`)

  // Trigger AutoSSL (CF accepts self-signed in flexible mode but AutoSSL upgrades to real cert)
  try {
    const sslRes = await whm.startAutoSSL(whmRes.username)
    logStep(`AutoSSL: ${sslRes?.success ? 'started' : (sslRes?.error || 'no-op')}`)
  } catch (e) { logStep(`AutoSSL warning: ${e.message}`) }

  // ─── 6. Store credentials with 7-day expiry + price-lock ─────
  // priceUsd=0 (gift) makes the renewal scheduler skip — but we keep
  // renewalPriceUsd at LIST_PRICE_USD so a future renewal works correctly.
  const cpanelAccountsCol = db.collection('cpanelAccounts')
  const storeRes = await cpAuth.storeCredentials(cpanelAccountsCol, {
    cpUser: whmRes.username,
    cpPass: whmRes.password,
    chatId: CHAT_ID,
    email: null,
    domain: DOMAIN,
    plan: PLAN_NAME,
    expiryDate: EXPIRY_DATE,
    autoRenew: false, // weekly plans are not auto-renewing per durationDays>=30 rule
    priceUsd: 0, // GIFT
  })
  const pin = storeRes.pin
  logStep(`✓ cpanelAccounts upsert — expiry=${EXPIRY_DATE.toISOString()} autoRenew=false PIN=${pin}`)

  // Stamp gift flags + ensure the renewal scheduler has the list price recorded
  await cpanelAccountsCol.updateOne(
    { _id: whmRes.username.toLowerCase() },
    { $set: {
      expiryDate: EXPIRY_DATE,
      autoRenew: false,
      plan: PLAN_NAME,
      chatId: CHAT_ID,
      adminProvisioned: true,
      adminProvisionReason: 'gift-fvk_poverty',
      adminProvisionedAt: new Date(),
      // Lock the renewal price to the published list ($30) so if the user
      // EVER manually renews, the scheduler doesn't fall back to env defaults.
      renewalPriceUsd: LIST_PRICE_USD,
      external: true,
    }}
  )
  const verify = await cpanelAccountsCol.findOne({ _id: whmRes.username.toLowerCase() })
  logStep(`✓ Verified DB: expiry=${verify.expiryDate?.toISOString?.() || verify.expiryDate} plan="${verify.plan}" autoRenew=${verify.autoRenew} priceUsd=${verify.priceUsd} renewalPriceUsd=${verify.renewalPriceUsd}`)

  // ─── 7. Deploy Anti-Red protection (non-blocking) ────────────
  try {
    const arRes = await antiRedService.deployFullProtection(whmRes.username, DOMAIN, PLAN_NAME)
    logStep(`Anti-Red deployed: htaccess=${arRes?.htaccess?.success} ja3=${arRes?.ja3Rules?.success} hardenedWorker=${arRes?.hardenedWorker?.success}`)
  } catch (e) {
    logStep(`Anti-Red deploy error (non-blocking): ${e.message}`)
  }

  // ─── 8. Schedule the standard 5-min health-check ─────────────
  try {
    const healthCheck = require('../js/hosting-health-check')
    healthCheck.scheduleHealthCheck(DOMAIN, whmRes.username, CHAT_ID)
    logStep(`✓ Health-check scheduled (5min)`)
  } catch (e) { logStep(`Health-check schedule warning (non-blocking): ${e.message}`) }

  // ─── 9. Transaction log (amount 0 — gift) ────────────────────
  const txnId = generateTxnId()
  try {
    await db.collection('transactions').insertOne({
      transactionId: txnId,
      chatId: CHAT_ID,
      type: 'hosting',
      amount: 0,
      currency: 'USD',
      status: 'completed',
      metadata: {
        domain: DOMAIN,
        plan: PLAN_NAME,
        cpUser: whmRes.username,
        adminProvisioned: true,
        reason: 'gift-fvk_poverty',
        external: true,
        listPriceUsd: LIST_PRICE_USD,
      },
      timestamp: new Date(),
    })
    logStep(`✓ Transaction logged: ${txnId}`)
  } catch (e) {
    logStep(`Transaction log error (non-blocking): ${e.message}`)
  }

  // payments breadcrumb (matches walletPay bot flow)
  try {
    await db.collection('payments').insertOne({
      _id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      val: `Wallet,Hosting,${DOMAIN},$0(gift),${CHAT_ID},${user.val},${new Date()}`
    })
  } catch (e) { /* breadcrumb is best-effort */ }

  // ─── 10. Deliver credentials DM to user (same template as bot) ──
  const panelUrl = PANEL_DOMAIN
    ? (PANEL_DOMAIN.startsWith('http') ? PANEL_DOMAIN : `https://${PANEL_DOMAIN}`)
    : `${(SELF_URL_PROD || '').replace('/api', '')}/panel`

  const credentialsMsg =
    `🎉 <b>Your hosting is live!</b>\n\n`
    + `<b>Domain:</b> ${DOMAIN}\n`
    + `<b>Plan:</b> ${PLAN_NAME}\n`
    + `DNS auto-configured via Cloudflare.\n\n`
    + `<b>HostPanel Login</b>\n`
    + `Username: <code>${whmRes.username}</code>\n`
    + `PIN: <code>${pin}</code>\n`
    + `Login: ${panelUrl}\n\n`
    + `<b>Transaction ID:</b> <code>${txnId}</code>\n\n`
    + `<i>Quote this ID when contacting support</i>`
  try {
    await bot.sendMessage(CHAT_ID, credentialsMsg, { parse_mode: 'HTML', disable_web_page_preview: true })
    logStep(`✓ Credentials DM sent to ${CHAT_ID}`)
  } catch (e) {
    logStep(`⚠︎ Failed to send credentials DM: ${e.message}`)
  }

  // ─── 11. External-domain NS-update warning ───────────────────
  const nsWarn =
    `⚠️ <b>Action Required for External Domain</b>\n\n`
    + `Your domain <b>${DOMAIN}</b> requires a nameserver update at your domain registrar.\n\n`
    + `Please update the nameservers to:\n`
    + `NS1: <code>${cfNameservers[0]}</code>\n`
    + `NS2: <code>${cfNameservers[1]}</code>\n\n`
    + `Go to your domain registrar's panel → DNS/Nameserver settings → Replace existing NS with the above.\n\n`
    + `Your site won't be live until nameservers are updated and propagated (up to 24h).`
  try {
    await bot.sendMessage(CHAT_ID, nsWarn, { parse_mode: 'HTML', disable_web_page_preview: true })
    logStep(`✓ NS-update warning sent`)
  } catch (e) { logStep(`⚠︎ NS warning send err: ${e.message}`) }

  // ─── 12. Admin + group notifications ─────────────────────────
  const adminMsg =
    `🏠 <b>Hosting Activated (Admin Gift)</b>\n`
    + `🆔 User: ${user.val} (<code>${CHAT_ID}</code>)\n`
    + `🌐 Domain: ${DOMAIN} <i>(external, NS pending)</i>\n`
    + `📋 Plan: ${PLAN_NAME}\n`
    + `💵 Price: $0 (gift) · list $${LIST_PRICE_USD}\n`
    + `🗓 Expires: ${EXPIRY_DATE.toISOString().slice(0,10)} (${DURATION_DAYS}d)\n`
    + `🔐 cpUser: <code>${whmRes.username}</code>\n`
    + `🪪 TxnID: <code>${txnId}</code>`
  if (TELEGRAM_ADMIN_CHAT_ID) {
    try { await bot.sendMessage(TELEGRAM_ADMIN_CHAT_ID, adminMsg, { parse_mode: 'HTML' }); logStep(`✓ Admin notified (${TELEGRAM_ADMIN_CHAT_ID})`) }
    catch (e) { logStep(`Admin notify err: ${e.message}`) }
  }
  if (CHANNEL_ID) {
    const groupMsg = `🏠 <b>Hosting Activated!</b>\nUser @fvk… just set up hosting for <b>nymc…b.com</b>.\nBuild yours — /start`
    try { await bot.sendMessage(CHANNEL_ID, groupMsg, { parse_mode: 'HTML' }); logStep(`✓ Group notified`) }
    catch (e) { logStep(`Group notify err: ${e.message}`) }
  }

  // ─── 13. Final snapshot ──────────────────────────────────────
  const finalDomainsOf = await db.collection('domainsOf').findOne({ _id: CHAT_ID })
  const finalRegDom = await db.collection('registeredDomains').findOne({ _id: DOMAIN })
  const finalCpa = await db.collection('cpanelAccounts').findOne({ domain: DOMAIN, deleted: { $ne: true } })
  logStep(`\n══════ FINAL SNAPSHOT ══════`)
  logStep(`domainsOf[${CHAT_ID}].${domainKey} = ${finalDomainsOf?.[domainKey]}`)
  logStep(`registeredDomains ownerChatId = ${finalRegDom?.val?.ownerChatId} registrar=${finalRegDom?.val?.registrar} external=${finalRegDom?.val?.external}`)
  logStep(`cpanelAccounts cpUser=${finalCpa?.cpUser} plan="${finalCpa?.plan}" expiry=${finalCpa?.expiryDate?.toISOString?.() || finalCpa?.expiryDate} autoRenew=${finalCpa?.autoRenew} priceUsd=${finalCpa?.priceUsd}`)
  logStep(`PIN (single-view): ${pin}`)

  await client.close()
  logStep(`\n✅ DONE — Provisioning complete for @${user.val} / ${DOMAIN}`)

  await new Promise(r => setTimeout(r, 1500))
  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err.stack || err.message || err)
  process.exit(1)
})
