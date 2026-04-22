/**
 * One-off admin provision: Golden Anti-Red HostPanel (30 Days) for @onlicpe
 *   - Domain: smilefundsrecoveryservices.com (already OP-registered, CF NS)
 *   - chatId: 7080940684
 *   - Explicit expiry: 2026-05-07T00:00:00Z
 *   - NO wallet debit (gift)
 *   - Full treatment: CF zone + DNS, domain-link in user's account, WHM create,
 *     cpanel credentials + PIN, Anti-Red protection, Telegram notify, tx log,
 *     admin + group notification, health-check schedule.
 *
 * Run:  RAILWAY_DB=1 node scripts/provision-hosting-onlicpe.js
 */

// Force Railway production DB
const RAILWAY_MONGO_URL = 'mongodb://mongo:UCPkknTGVOBzrnOiXoIYyVhampeslSIR@roundhouse.proxy.rlwy.net:52715'
process.env.MONGO_URL = RAILWAY_MONGO_URL
process.env.DB_NAME = 'test'
process.env.BOT_ENVIRONMENT = 'production'

require('dotenv').config()
require('../js/config-setup') // pick production bot token

const { MongoClient } = require('mongodb')
const TelegramBot = require('node-telegram-bot-api')

const whm = require('../js/whm-service')
const cfService = require('../js/cf-service')
const opService = require('../js/op-service')
const cpAuth = require('../js/cpanel-auth')
const antiRedService = require('../js/anti-red-service')
const sendEmail = require('../js/send-email')

const CHAT_ID = '7080940684' // @onlicpe
const DOMAIN = 'smilefundsrecoveryservices.com'
const PLAN_NAME = 'Golden Anti-Red HostPanel (1-Month)' // matches selectPlan naming in _index.js
const EXPIRY_DATE = new Date('2026-05-07T00:00:00Z')
const WHM_HOST = process.env.WHM_HOST
const PANEL_DOMAIN = process.env.PANEL_DOMAIN
const SELF_URL_PROD = process.env.SELF_URL_PROD
const BRAND = process.env.CHAT_BOT_BRAND || 'Nomadly'
const SUPPORT_LINK = process.env.APP_SUPPORT_LINK || '#'
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID
const CHANNEL_ID = process.env.CHANNEL_ID || process.env.TELEGRAM_GROUP_ID

function generateTxnId() {
  return `TX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

function logStep(msg) {
  // eslint-disable-next-line no-console
  console.log(`[ProvisionOnlicpe] ${msg}`)
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('No TELEGRAM_BOT_TOKEN — aborting')
  const bot = new TelegramBot(token, { webHook: false, polling: false })
  logStep(`Bot token loaded: …${token.slice(-6)}`)

  const client = new MongoClient(RAILWAY_MONGO_URL, { serverSelectionTimeoutMS: 30000 })
  await client.connect()
  const db = client.db('test')
  logStep(`Connected to Railway prod DB`)

  // ─── 0. Preflight ────────────────────────────────────────────
  const nameOf = db.collection('nameOf')
  const user = await nameOf.findOne({ _id: CHAT_ID })
  if (!user || user.val?.toLowerCase() !== 'onlicpe') throw new Error(`User mismatch for ${CHAT_ID}: ${JSON.stringify(user)}`)
  logStep(`User verified: ${user.val} (chatId ${CHAT_ID})`)

  const existingCpa = await db.collection('cpanelAccounts').findOne({ domain: DOMAIN, deleted: { $ne: true } })
  if (existingCpa) throw new Error(`cpanelAccount already exists for ${DOMAIN}: ${existingCpa.cpUser}`)
  logStep(`No existing cpanelAccount for ${DOMAIN} ✔︎`)

  // ─── 1. Verify OpenProvider registration ─────────────────────
  logStep(`Checking OpenProvider for ${DOMAIN}…`)
  const opInfo = await opService.getDomainInfo(DOMAIN)
  if (!opInfo || !opInfo.domainId) throw new Error(`Domain not found at OpenProvider`)
  logStep(`OP domainId=${opInfo.domainId} expires=${opInfo.expiresAt} NS=${opInfo.nameservers.join(', ')}`)

  // ─── 2. Ensure Cloudflare zone ───────────────────────────────
  logStep(`Ensuring Cloudflare zone for ${DOMAIN}…`)
  const zoneRes = await cfService.createZone(DOMAIN)
  if (!zoneRes.success || !zoneRes.zoneId) throw new Error(`CF zone failed: ${JSON.stringify(zoneRes.errors)}`)
  const cfZoneId = zoneRes.zoneId
  const cfNameservers = zoneRes.nameservers || []
  logStep(`CF zone ${cfZoneId} status=${zoneRes.status} NS=${cfNameservers.join(', ')}`)

  // Compare OP NS to CF NS — if mismatch, update OP
  const opNsSet = new Set(opInfo.nameservers.map(n => n.toLowerCase()))
  const cfNsSet = new Set(cfNameservers.map(n => n.toLowerCase()))
  const nsMatch = cfNsSet.size > 0 && [...cfNsSet].every(n => opNsSet.has(n))
  if (!nsMatch && cfNameservers.length >= 2) {
    logStep(`OP nameservers don't match CF zone — updating OP NS to CF zone's NS`)
    const upd = await opService.updateNameservers(DOMAIN, cfNameservers)
    if (upd?.error) logStep(`⚠︎ OP updateNameservers error (non-blocking): ${upd.error}`)
    else logStep(`✓ OP nameservers updated`)
  } else {
    logStep(`OP NS already matches CF zone NS ✔︎`)
  }

  // ─── 3. Hosting DNS records + SSL strict + HTTPS enforce ─────
  logStep(`Creating hosting DNS records pointing to WHM_HOST=${WHM_HOST}…`)
  const dnsRes = await cfService.createHostingDNSRecords(cfZoneId, DOMAIN, WHM_HOST)
  logStep(`DNS records: ${JSON.stringify(Object.keys(dnsRes?.results || dnsRes || {}))}`)

  try { await cfService.setSSLMode(cfZoneId, 'strict') ; logStep(`✓ SSL strict`) } catch (e) { logStep(`SSL mode err: ${e.message}`) }
  try { await cfService.enforceHTTPS(cfZoneId) ; logStep(`✓ HTTPS enforced`) } catch (e) { logStep(`enforceHTTPS err: ${e.message}`) }

  // ─── 4. Link domain to user (domainsOf + registeredDomains) ──
  const domainKey = DOMAIN.replace(/\./g, '@')
  await db.collection('domainsOf').updateOne(
    { _id: CHAT_ID },
    { $set: { [domainKey]: true } },
    { upsert: true }
  )
  logStep(`✓ domainsOf.${CHAT_ID}.${domainKey} = true`)

  await db.collection('registeredDomains').updateOne(
    { _id: DOMAIN },
    {
      $set: {
        val: {
          domain: DOMAIN,
          provider: 'OpenProvider',
          registrar: 'OpenProvider',
          nameserverType: 'cloudflare',
          nameservers: cfNameservers,
          autoRenew: false,
          ownerChatId: CHAT_ID,
          status: 'registered',
          registeredAt: new Date(),
          opDomainId: opInfo.domainId,
          opExpiry: opInfo.expiresAt,
          opStatus: opInfo.status,
          cfZoneId,
        },
      },
    },
    { upsert: true }
  )
  logStep(`✓ registeredDomains._id=${DOMAIN} upserted`)

  // ─── 5. WHM createAccount (Golden plan, CF NS mode) ──────────
  const goldenPlanStrings = ['golden anti-red hostpanel (1-month)']
  logStep(`Creating WHM account (plan="${PLAN_NAME}" → pkg lookup via PLAN_MAP)…`)
  const serviceEmail = process.env.NOMADLY_SERVICE_EMAIL
  const whmRes = await whm.createAccount(DOMAIN, PLAN_NAME, serviceEmail, undefined, { useCloudflareNS: true })
  if (!whmRes.success) throw new Error(`WHM createAccount failed: ${whmRes.error}`)
  logStep(`✓ WHM account created: ${whmRes.username} @ ${DOMAIN} (pkg=${whmRes.package})`)

  // ─── 6. Store credentials with explicit May 7, 2026 expiry ───
  const cpanelAccountsCol = db.collection('cpanelAccounts')
  const storeRes = await cpAuth.storeCredentials(cpanelAccountsCol, {
    cpUser: whmRes.username,
    cpPass: whmRes.password,
    chatId: CHAT_ID,
    email: null,
    domain: DOMAIN,
    plan: PLAN_NAME,
    expiryDate: EXPIRY_DATE,
    autoRenew: true,
  })
  const pin = storeRes.pin
  logStep(`✓ cpanelAccounts upsert — expiry=${EXPIRY_DATE.toISOString()} autoRenew=true PIN=${pin}`)

  // Extra safety: explicitly PATCH expiryDate & autoRenew in case storeCredentials applied a fallback
  await cpanelAccountsCol.updateOne(
    { _id: whmRes.username.toLowerCase() },
    { $set: { expiryDate: EXPIRY_DATE, autoRenew: true, plan: PLAN_NAME, chatId: CHAT_ID, adminProvisioned: true, adminProvisionReason: 'gift-onlicpe', adminProvisionedAt: new Date() } }
  )
  const verify = await cpanelAccountsCol.findOne({ _id: whmRes.username.toLowerCase() })
  logStep(`✓ Verified DB record: expiry=${verify.expiryDate?.toISOString ? verify.expiryDate.toISOString() : verify.expiryDate} plan="${verify.plan}" autoRenew=${verify.autoRenew}`)

  // ─── 7. Deploy Anti-Red protection (non-blocking) ────────────
  try {
    const arRes = await antiRedService.deployFullProtection(whmRes.username, DOMAIN, PLAN_NAME)
    logStep(`Anti-Red deployed: htaccess=${arRes?.htaccess?.success} js=${arRes?.jsChallenge?.success} ja3=${arRes?.ja3Rules?.success}`)
  } catch (e) {
    logStep(`Anti-Red deploy error (non-blocking): ${e.message}`)
  }

  // ─── 8. Transaction log (amount 0 — gift) ────────────────────
  const txnId = generateTxnId()
  try {
    await db.collection('transactions').insertOne({
      transactionId: txnId,
      chatId: CHAT_ID,
      type: 'hosting',
      amount: 0,
      currency: 'USD',
      status: 'completed',
      metadata: { domain: DOMAIN, plan: PLAN_NAME, cpUser: whmRes.username, adminProvisioned: true, reason: 'gift-onlicpe' },
      timestamp: new Date(),
    })
    logStep(`✓ Transaction logged: ${txnId}`)
  } catch (e) {
    logStep(`Transaction log error: ${e.message}`)
  }

  // ─── 9. Send "Your hosting is live" message to user ──────────
  const panelUrl = PANEL_DOMAIN ? `https://${PANEL_DOMAIN}` : `${(SELF_URL_PROD || '').replace('/api', '')}/panel`
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
    logStep(`✓ Credentials message sent to ${CHAT_ID}`)
  } catch (e) {
    logStep(`⚠︎ Failed to send credentials message: ${e.message}`)
  }

  // ─── 10. Admin + group notifications ─────────────────────────
  const adminMsg = `🏠 <b>Hosting Activated (Admin Gift)</b>\n`
    + `🆔 User: ${CHAT_ID} (@onlicpe)\n`
    + `🌐 Domain: ${DOMAIN}\n`
    + `📋 Plan: ${PLAN_NAME}\n`
    + `💵 Price: $0 (gift)\n`
    + `🗓 Expires: ${EXPIRY_DATE.toDateString()}\n`
    + `🔐 cpUser: ${whmRes.username}\n`
    + `🪪 TxnID: <code>${txnId}</code>`
  if (TELEGRAM_ADMIN_CHAT_ID) {
    try { await bot.sendMessage(TELEGRAM_ADMIN_CHAT_ID, adminMsg, { parse_mode: 'HTML' }) ; logStep(`✓ Admin notified (${TELEGRAM_ADMIN_CHAT_ID})`) } catch (e) { logStep(`Admin notify err: ${e.message}`) }
  }
  if (CHANNEL_ID) {
    try { await bot.sendMessage(CHANNEL_ID, `🏠 <b>Hosting Activated!</b>\nUser @onlic… just set up hosting for <b>smilef…es.com</b>.\nBuild yours — /start`, { parse_mode: 'HTML' }) ; logStep(`✓ Group notified`) } catch (e) { logStep(`Group notify err: ${e.message}`) }
  }

  // ─── 11. Final state snapshot ────────────────────────────────
  const finalDomainsOf = await db.collection('domainsOf').findOne({ _id: CHAT_ID })
  const finalRegDom = await db.collection('registeredDomains').findOne({ _id: DOMAIN })
  const finalCpa = await db.collection('cpanelAccounts').findOne({ domain: DOMAIN })
  logStep(`\n══════ FINAL SNAPSHOT ══════`)
  logStep(`domainsOf[${CHAT_ID}].${domainKey} = ${finalDomainsOf?.[domainKey]}`)
  logStep(`registeredDomains ownerChatId = ${finalRegDom?.val?.ownerChatId}`)
  logStep(`cpanelAccounts cpUser=${finalCpa?.cpUser} plan="${finalCpa?.plan}" expiry=${finalCpa?.expiryDate?.toISOString ? finalCpa.expiryDate.toISOString() : finalCpa?.expiryDate} autoRenew=${finalCpa?.autoRenew}`)
  logStep(`PIN (single-view): ${pin}`)
  logStep(`cPanel password (single-view, encrypted in DB): ${whmRes.password}`)

  await client.close()
  logStep(`\n✅ DONE — Provisioning complete for @onlicpe / ${DOMAIN}`)

  // tiny delay so last bot.sendMessage flushes
  await new Promise(r => setTimeout(r, 1500))
  process.exit(0)
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('FATAL:', err.stack || err.message || err)
  process.exit(1)
})
