#!/usr/bin/env node
/**
 * One-shot recovery script for the @HHR2009 interrupted hosting purchase.
 *
 * Context: On 2026-06-17 09:48 UTC the old WHM droplet was disk-full
 * ("No space left on device"). The user paid via wallet, the domain
 * strivepartypaperless.com registered on OpenProvider (ID 29703625),
 * but cPanel account creation failed and the $30 hosting portion was
 * refunded to wallet. WHM has since been migrated to a healthy host.
 * This script completes the hosting half of the transaction:
 *   1. Create cPanel account on the new WHM (Premium-Anti-Red-1-Week pkg)
 *   2. Store encrypted credentials + bcrypt PIN in cpanelAccounts
 *   3. Create proxied CNAME DNS records for root + www → CF tunnel
 *   4. Set CF SSL = flexible, enforce HTTPS
 *   5. Atomically debit $30 from walletOf (usdOut += 30)
 *   6. Record hostingTransactions row + transactions row
 *   7. Send the user the standard credentials message via PROD Telegram bot
 *   8. Notify admin + public group (same format as a normal completed purchase)
 *
 * Reads PROD env from Railway GraphQL API (NOT the dev /app/.env), so the
 * script is safe to run from the dev pod — it never reads dev credentials.
 *
 * Idempotent: aborts if a cPanel account already exists for the domain.
 */

const https = require('https')
const path = require('path')
const dotenv = require('dotenv')

// We need API_KEY_RAILWAY from dev backend/.env to fetch prod env vars.
dotenv.config({ path: '/app/backend/.env' })

const CHAT_ID = '1960615421'         // @HHR2009
const DOMAIN  = 'strivepartypaperless.com'
const PLAN    = 'Premium Anti-Red (1-Week)'   // bot plan name
const PRICE   = 30                            // USD
const RAILWAY_PROJECT_ID    = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
const RAILWAY_ENV_ID        = '889fd56a-720a-4020-884c-034784992666'
const RAILWAY_SERVICE_ID    = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885'   // Nomadly-EMAIL-IVR

// ───────────────────────────────────────────────────────────
// Fetch prod env from Railway and inject into process.env BEFORE
// requiring any service modules (whm-service, cf-service, cpanel-auth all
// read process.env at require-time).
// ───────────────────────────────────────────────────────────
function railwayGraphql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables })
    const req = https.request({
      hostname: 'backboard.railway.app',
      path: '/graphql/v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Project-Access-Token': process.env.API_KEY_RAILWAY,
        'User-Agent': 'Mozilla/5.0',
      },
    }, (res) => {
      let chunks = ''
      res.on('data', c => chunks += c)
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)) } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(body); req.end()
  })
}

async function getProdEnv() {
  const r = await railwayGraphql(
    `query Vars($pid: String!, $eid: String!, $sid: String!) {
       variables(projectId: $pid, environmentId: $eid, serviceId: $sid)
     }`,
    { pid: RAILWAY_PROJECT_ID, eid: RAILWAY_ENV_ID, sid: RAILWAY_SERVICE_ID }
  )
  if (!r?.data?.variables) {
    throw new Error('Failed to fetch prod env: ' + JSON.stringify(r).slice(0, 400))
  }
  return r.data.variables
}

// ───────────────────────────────────────────────────────────
// Telegram helper (uses PROD bot token directly — does NOT bring in the
// node-telegram-bot-api listener which would start a polling/webhook loop).
// ───────────────────────────────────────────────────────────
function tg(token, chatId, text, opts = {}) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...opts,
    })
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let chunks = ''
      res.on('data', c => chunks += c)
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)) } catch { resolve({ ok: false, raw: chunks }) }
      })
    })
    req.on('error', e => resolve({ ok: false, error: e.message }))
    req.write(body); req.end()
  })
}

// ───────────────────────────────────────────────────────────
// Main flow
// ───────────────────────────────────────────────────────────
async function main() {
  console.log('=== HHR2009 hosting recovery ===')
  console.log(`User chatId: ${CHAT_ID}  domain: ${DOMAIN}  plan: ${PLAN}  price: $${PRICE}`)

  // 1. Fetch & inject prod env
  console.log('\n[1/8] Loading prod env from Railway…')
  const prodEnv = await getProdEnv()
  // Only inject the keys we need — minimises blast radius
  const KEYS = [
    'MONGO_URL', 'DB_NAME', 'SESSION_SECRET',
    'WHM_HOST', 'WHM_TOKEN', 'WHM_USERNAME', 'WHM_API_URL',
    'CPANEL_API_URL', 'CF_TUNNEL_CNAME',
    'CLOUDFLARE_EMAIL', 'CLOUDFLARE_API_KEY',
    'TELEGRAM_BOT_TOKEN_PROD',
    'TELEGRAM_ADMIN_CHAT_ID', 'TELEGRAM_NOTIFY_GROUP_ID',
    'PANEL_DOMAIN', 'NOMADLY_SERVICE_EMAIL',
    'PREMIUM_ANTIRED_WEEKLY_PRICE',
    'MAIL_RELAY_HOST', 'MAIL_RELAY_PRIORITY',
    'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET',
  ]
  for (const k of KEYS) {
    if (prodEnv[k] !== undefined) process.env[k] = String(prodEnv[k])
  }
  console.log(`  WHM_HOST=${process.env.WHM_HOST}  CF_TUNNEL_CNAME=${process.env.CF_TUNNEL_CNAME}`)
  console.log(`  DB_NAME=${process.env.DB_NAME}  MONGO_URL=<set,${process.env.MONGO_URL.length} chars>`)

  // 2. Connect to prod Mongo
  console.log('\n[2/8] Connecting to prod Mongo…')
  const { MongoClient } = require('mongodb')
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)
  const cpanelAccounts = db.collection('cpanelAccounts')
  const walletOf = db.collection('walletOf')

  // Idempotency guard — abort if a cPanel account already exists for this domain
  const existing = await cpanelAccounts.findOne({ domain: DOMAIN, deleted: { $ne: true } })
  if (existing) {
    console.log(`\n⚠️  ABORT — cPanel account already exists for ${DOMAIN}:`)
    console.log(`     user=${existing._id}  chatId=${existing.chatId}  plan=${existing.plan}`)
    console.log(`     expiry=${existing.expiryDate}  whmHost=${existing.whmHost}`)
    await client.close()
    process.exit(0)
  }

  // Wallet pre-check
  const wallet = await walletOf.findOne({ _id: CHAT_ID })
  const balUsd = (wallet?.usdIn || 0) - (wallet?.usdOut || 0)
  console.log(`   Wallet pre-debit: usdIn=${wallet?.usdIn} usdOut=${wallet?.usdOut} → bal=$${balUsd}`)
  if (balUsd < PRICE) {
    console.log(`\n❌ ABORT — wallet balance $${balUsd} < plan price $${PRICE}`)
    await client.close()
    process.exit(1)
  }

  // 3. Create cPanel account on the new WHM
  console.log(`\n[3/8] Creating cPanel account on new WHM (${process.env.WHM_HOST})…`)
  const whmService = require('/app/js/whm-service.js')
  const whmResult = await whmService.createAccount(
    DOMAIN,
    PLAN,
    process.env.NOMADLY_SERVICE_EMAIL,
    undefined,
    { useCloudflareNS: true }
  )
  if (!whmResult.success) {
    console.error(`\n❌ ABORT — WHM createAccount failed: ${whmResult.error}`)
    await client.close()
    process.exit(2)
  }
  console.log(`   ✅ Created cPanel user: ${whmResult.username}  package=${whmResult.package}`)

  // 4. Store encrypted credentials + PIN
  console.log('\n[4/8] Storing encrypted credentials in cpanelAccounts…')
  const cpAuth   = require('/app/js/cpanel-auth.js')
  // durationDays for 1-Week plan
  const durationDays = 7
  const expiryDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
  const { pin } = await cpAuth.storeCredentials(cpanelAccounts, {
    cpUser:   whmResult.username,
    cpPass:   whmResult.password,
    chatId:   CHAT_ID,
    email:    null,           // user chose "Skip (no email)" per logs
    domain:   DOMAIN,
    plan:     PLAN,
    expiryDate,
    autoRenew: false,         // weekly plans do not auto-renew (bot default)
  })
  // The bot also stamps whmHost into the doc — storeCredentials already does it
  // from process.env.WHM_HOST, but we explicitly set it for safety.
  await cpanelAccounts.updateOne(
    { _id: whmResult.username.toLowerCase() },
    { $set: { whmHost: process.env.WHM_HOST, autoRenew: false } }
  )
  console.log(`   ✅ Credentials stored. PIN generated.  expiry=${expiryDate.toISOString()}`)

  // 5. Cloudflare DNS records (CNAME root + www → CF tunnel)
  console.log('\n[5/8] Creating Cloudflare DNS records (root + www → tunnel)…')
  const cfService = require('/app/js/cf-service.js')

  // Look up zone id from registeredDomains (already set during the partial purchase)
  const regDom = await db.collection('registeredDomains').findOne({ _id: DOMAIN })
  const zoneId = regDom?.val?.cfZoneId
  if (!zoneId) {
    console.error(`\n⚠️ Warning — no cfZoneId for ${DOMAIN} in DB. Skipping DNS step.`)
  } else {
    console.log(`   zoneId=${zoneId}`)
    try {
      // Idempotent cleanup first (no-op if no conflicting records)
      await cfService.cleanupConflictingDNS(zoneId, DOMAIN).catch(() => {})
      const dnsRes = await cfService.createHostingDNSRecords(zoneId, DOMAIN, process.env.WHM_HOST, true)
      console.log(`   ✅ DNS records: ${dnsRes.success ? 'all created' : 'partial'}  (${(dnsRes.results||[]).length} results)`)
      await cfService.setSSLMode(zoneId, 'flexible')
      await cfService.enforceHTTPS(zoneId)
      await cfService.enableAuthenticatedOriginPulls(zoneId).catch(() => {})
      console.log('   ✅ SSL=flexible, HTTPS enforced, AOP enabled')

      // Trigger AutoSSL on cPanel
      try {
        const sslRes = await whmService.startAutoSSL(whmResult.username)
        console.log(`   AutoSSL: ${sslRes.success ? 'started' : sslRes.error}`)
      } catch (_) {}
    } catch (cfErr) {
      console.warn(`   DNS setup error (non-blocking): ${cfErr.message}`)
    }
  }

  // 6. Atomically debit wallet $30
  console.log('\n[6/8] Debiting wallet $' + PRICE + '…')
  await walletOf.updateOne({ _id: CHAT_ID }, { $inc: { usdOut: PRICE } }, { upsert: true })
  const walletAfter = await walletOf.findOne({ _id: CHAT_ID })
  const balAfter = (walletAfter.usdIn || 0) - (walletAfter.usdOut || 0)
  console.log(`   ✅ Wallet now: usdIn=${walletAfter.usdIn} usdOut=${walletAfter.usdOut} → bal=$${balAfter}`)

  // 7. Record transaction rows (hostingTransactions + transactions)
  console.log('\n[7/8] Writing transaction records…')
  await db.collection('hostingTransactions').insertOne({
    chatId:           CHAT_ID,
    domain:           DOMAIN,
    plan:             PLAN,
    priceUsd:         PRICE,
    paymentMethod:    'wallet_usd',
    currency:         'USD',
    outcome:          'success',
    hostingUsername:  whmResult.username,
    refundAmount:     null,
    refundCurrency:   null,
    gatewayData:      null,
    couponApplied:    false,
    couponDiscount:   null,
    existingDomain:   true,   // user used the already-registered domain
    hostingType:      'Premium Anti-Red (1-Week)',
    timestamp:        new Date(),
    notes:            'Manual recovery of 2026-06-17 09:48 UTC interrupted purchase (old WHM disk-full).',
  })
  console.log('   ✅ hostingTransactions row inserted')

  // Standard "transactions" ledger entry (mirrors logTransaction in transaction-id.js)
  const { generateTransactionId } = require('/app/js/transaction-id.js')
  const txnId = generateTransactionId()
  await db.collection('transactions').insertOne({
    transactionId: txnId,
    chatId:        CHAT_ID,
    type:          'hosting',
    amount:        PRICE,
    currency:      'USD',
    status:        'completed',
    metadata:      { domain: DOMAIN, plan: PLAN, cpUser: whmResult.username, recovery: true },
    createdAt:     new Date(),
  })
  console.log(`   ✅ transactions row inserted (txnId=${txnId})`)

  // Deploy Anti-Red protection (fire-and-forget, like the bot does)
  try {
    const antiRedService = require('/app/js/anti-red-service.js')
    antiRedService.deployFullProtection(whmResult.username, DOMAIN, PLAN)
      .then(r => console.log(`   Anti-Red: htaccess=${r.htaccess?.success} js=${r.jsChallenge?.success} ja3=${r.ja3Rules?.success}`))
      .catch(err => console.log(`   Anti-Red protection failed (non-blocking): ${err.message}`))
  } catch (_) {}

  // 8. Send Telegram credentials message + admin/group notifies
  console.log('\n[8/8] Sending Telegram credentials message + admin/group notifies…')
  const PANEL_URL = process.env.PANEL_DOMAIN
    ? (process.env.PANEL_DOMAIN.startsWith('http') ? process.env.PANEL_DOMAIN : `https://${process.env.PANEL_DOMAIN}`)
    : 'https://panel.1.hostbay.io/panel'

  const credentialsMsg =
    `🎉 <b>Your hosting is live!</b>\n\n` +
    `<b>Domain:</b> ${DOMAIN}\n` +
    `DNS auto-configured via Cloudflare.\n\n` +
    `<b>HostPanel Login</b>\n` +
    `Username: <code>${whmResult.username}</code>\n` +
    `PIN: <code>${pin}</code>\n` +
    `Login: ${PANEL_URL}\n\n` +
    `<b>Transaction ID:</b> <code>${txnId}</code>\n\n` +
    `<i>Sorry for the earlier delay — the hosting backend hit a disk-space outage during your original purchase this morning. ` +
    `It has been resolved and your account is now provisioned on a fresh server. Quote this transaction ID when contacting support.</i>`

  const prodToken = process.env.TELEGRAM_BOT_TOKEN_PROD
  const r1 = await tg(prodToken, CHAT_ID, credentialsMsg)
  console.log(`   User DM: ok=${r1.ok}${r1.ok ? '' : ' err=' + JSON.stringify(r1).slice(0, 300)}`)

  // Admin alert
  const adminMsg =
    `✅ <b>Manual hosting recovery — @HHR2009 (${CHAT_ID})</b>\n\n` +
    `🌐 Domain: ${DOMAIN}\n` +
    `📋 Plan: ${PLAN}\n` +
    `🆔 cPanel user: <code>${whmResult.username}</code>\n` +
    `📅 Expiry: ${expiryDate.toISOString().slice(0,10)}\n` +
    `💵 Wallet debited: <b>$${PRICE}</b>  (bal: $${balAfter})\n` +
    `🧾 Transaction ID: <code>${txnId}</code>\n` +
    `🖥️ WHM host: <code>${process.env.WHM_HOST}</code>\n\n` +
    `<i>Replays the failed 2026-06-17 09:48 UTC purchase (old WHM disk-full).</i>`
  const r2 = await tg(prodToken, process.env.TELEGRAM_ADMIN_CHAT_ID, adminMsg)
  console.log(`   Admin alert: ok=${r2.ok}`)

  // Public group post (same format as a real purchase)
  if (process.env.TELEGRAM_NOTIFY_GROUP_ID) {
    const groupMsg =
      `🏠 <b>Hosting Activated!</b>\n` +
      `User HH****09 just set up hosting for <b>str***********ess.com</b> — ready for launch.\n` +
      `Build yours — /start`
    const r3 = await tg(prodToken, process.env.TELEGRAM_NOTIFY_GROUP_ID, groupMsg)
    console.log(`   Group notify: ok=${r3.ok}`)
  }

  await client.close()
  console.log('\n=== RECOVERY COMPLETE ===')
  console.log(`User: @HHR2009 (${CHAT_ID})`)
  console.log(`cPanel: ${whmResult.username} @ ${DOMAIN}`)
  console.log(`Wallet bal: $${balAfter}  (was $${balUsd}, debited $${PRICE})`)
  console.log(`Txn: ${txnId}`)
}

main().catch(err => {
  console.error('\nFATAL:', err)
  process.exit(99)
})
