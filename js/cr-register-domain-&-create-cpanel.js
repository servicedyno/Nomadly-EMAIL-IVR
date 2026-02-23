require('dotenv').config()
const { log } = require('console')
const sendEmail = require('./send-email')
const { assignPackageToUser, set, removeKeysFromDocumentById } = require('./db')
const { translation } = require('./translation')
const { rem } = require('./config')
const whm = require('./whm-service')
const cfService = require('./cf-service')
const opService = require('./op-service')
const cpAuth = require('./cpanel-auth')
const domainService = require('./domain-service')

const WHM_HOST = process.env.WHM_HOST
const TELEGRAM_DEV_CHAT_ID = process.env.TELEGRAM_DEV_CHAT_ID

async function registerDomainAndCreateCpanel(send, info, keyboardButtons, state) {
  const lang = info?.userLanguage ?? 'en'
  const chatId = info._id
  const domain = info.website_name

  // ── Step 1: Payment confirmed ──
  send(chatId, `✅ <b>Payment confirmed</b> — $${info.totalPrice || info.hostingPrice}\n\nProvisioning your hosting now...`, rem)

  try {
    // ── Step 2: Creating hosting account ──
    send(chatId, `⚙️ Creating hosting account...`, rem)

    const nsChoice = info?.nameserver || info?.nsChoice
    const isCloudflareNS = nsChoice === 'cloudflare' || nsChoice === 'Cloudflare'
    const result = await whm.createAccount(
      domain,
      info.plan,
      info.email || process.env.NOMADLY_SERVICE_EMAIL,
      undefined,
      { useCloudflareNS: isCloudflareNS },
    )

    if (!result.success) {
      log(`[Hosting] WHM createAccount failed: ${result.error}`)
      send(chatId, `❌ Hosting setup failed. Tap 💬 Get Support for help.`, keyboardButtons)
      return { success: false, error: `Hosting setup failed: ${result.error}` }
    }

    send(chatId, `✅ Hosting account created`, rem)

    // ── Step 3: Domain setup ──
    const isExisting = info.existingDomain
    const isExternal = info.connectExternalDomain
    if (isExisting) {
      send(chatId, `🔗 Linking <b>${domain}</b> to your hosting...`, rem)
    } else if (isExternal) {
      send(chatId, `🔗 Connecting external domain <b>${domain}</b>...`, rem)
    } else {
      send(chatId, `🌐 Registering <b>${domain}</b>...`, rem)
    }

    // Cloudflare DNS setup
    if (isCloudflareNS) {
      try {
        const zone = await cfService.createZone(domain)
        if (zone.success && zone.zoneId) {
          const dnsResult = await cfService.createHostingDNSRecords(zone.zoneId, domain, WHM_HOST)
          await cfService.setSSLMode(zone.zoneId, 'strict')
          await cfService.enforceHTTPS(zone.zoneId)
          log(`[Hosting] CF DNS records for ${domain}: ${dnsResult.success ? 'all created' : 'some failed'}`)

          const cfNameservers = zone.nameservers || []
          if (cfNameservers.length >= 2) {
            try {
              // Determine registrar and update NS at the correct provider
              const registrar = info?.registrar || 'ConnectReseller'
              const domainService = require('./domain-service')
              const nsResult = await domainService.postRegistrationNSUpdate(domain, registrar, 'cloudflare', cfNameservers, null)
              if (nsResult.success) {
                log(`[Hosting] Updated NS at ${registrar} for ${domain} → ${cfNameservers.join(', ')}`)
              } else {
                log(`[Hosting] NS update at ${registrar} failed for ${domain}: ${nsResult.error || 'unknown'} (non-blocking)`)
              }
            } catch (nsErr) {
              log(`[Hosting] NS update error (non-blocking): ${nsErr.message}`)
            }
          }

          // Store CF zone info in registeredDomains for Anti-Red cron and panel
          try {
            const { MongoClient } = require('mongodb')
            const nsClient = new MongoClient(process.env.MONGO_URL)
            await nsClient.connect()
            const nsDb = nsClient.db(process.env.DB_NAME || 'test')
            await nsDb.collection('registeredDomains').updateOne(
              { _id: domain },
              { $set: { 'val.cfZoneId': zone.zoneId, 'val.nameservers': cfNameservers, 'val.nameserverType': 'cloudflare' } },
              { upsert: false }
            )
            await nsClient.close()
          } catch (_) {}
        } else {
          log(`[Hosting] CF zone creation failed for ${domain}, DNS records skipped`)
        }
      } catch (cfErr) {
        log(`[Hosting] CF DNS setup error (non-blocking): ${cfErr.message}`)
      }
    }

    send(chatId, `✅ Domain configured · DNS auto-set via Cloudflare`, rem)

    // ── Step 4: Storing credentials & deploying protection ──
    send(chatId, `🛡️ Activating Anti-Red protection...`, rem)

    const response = {
      username: result.username,
      password: result.password,
      url: result.url,
      nameservers: result.nameservers,
    }

    // Store encrypted credentials & generate PIN
    let pin = null
    try {
      const { MongoClient } = require('mongodb')
      const client = new MongoClient(process.env.MONGO_URL)
      await client.connect()
      const db = client.db(process.env.DB_NAME || 'test')
      const cpanelAccountsCol = db.collection('cpanelAccounts')

      const stored = await cpAuth.storeCredentials(cpanelAccountsCol, {
        cpUser: result.username,
        cpPass: result.password,
        chatId: String(chatId),
        email: info.email || null,
        domain: domain,
        plan: info.plan,
        expiryDate: new Date(Date.now() + (info.plan.includes('1-Week') ? 7 : 30) * 24 * 60 * 60 * 1000),
        autoRenew: !info.plan.includes('1-Week'),
      })
      pin = stored.pin

      await client.close()
      log(`[Hosting] Panel credentials stored for ${result.username} (PIN generated)`)
    } catch (pinErr) {
      log(`[Hosting] Failed to store panel credentials (non-blocking): ${pinErr.message}`)
    }

    // Deploy Anti-Red protection (non-blocking)
    try {
      const antiRedService = require('./anti-red-service')
      antiRedService.deployFullProtection(result.username, domain, info.plan)
        .then(r => log(`[Hosting] Anti-Red protection deployed for ${result.username}: htaccess=${r.htaccess?.success}, js=${r.jsChallenge?.success}, ja3=${r.ja3Rules?.success}`))
        .catch(err => log(`[Hosting] Anti-Red protection failed (non-blocking): ${err.message}`))
    } catch (_) {}

    // ── Step 5: Finalizing ──
    send(chatId, `✅ Anti-Red protection active`, rem)

    // ── Step 6: Deliver HostPanel credentials only ──
    // NOTE: Do NOT send cPanel credentials (username/password/panel URL) to users
    // Users should only get the HostPanel PIN login
    if (pin) {
      const panelDomain = process.env.PANEL_DOMAIN
      const panelUrl = panelDomain
        ? `https://${panelDomain}`
        : `${process.env.SELF_URL_PROD?.replace('/api', '')}/panel`
      const credentialsMsg = `🎉 <b>Your hosting is live!</b>

<b>Domain:</b> ${domain}
${info.email ? `<b>Email:</b> ${info.email}\n` : ''}DNS auto-configured via Cloudflare.

<b>HostPanel Login</b>
Username: <code>${result.username}</code>
PIN: <code>${pin}</code>
Login: ${panelUrl}`
      send(chatId, credentialsMsg, keyboardButtons)
    }

    assignPackageToUser(state, chatId, info.plan)

    // Send email (if provided)
    if (info.email) {
      try {
        await sendEmail(info, response, pin)
        send(chatId, `📧 Credentials sent to <b>${info.email}</b>`, rem)
      } catch (error) {
        log('Error sending email:', error)
        send(TELEGRAM_DEV_CHAT_ID, 'Error sending email', keyboardButtons)
      }
    }

    set(state, chatId, 'action', 'none')

    removeKeysFromDocumentById(state, chatId, [
      'plan',
      'existingDomain',
      'connectExternalDomain',
      'price',
      'domain',
      'website_name',
      'nameserver',
      'originalPrice',
      'continue_domain_last_state',
      'email',
      'couponDiscount',
      'hostingPrice',
      'couponApplied',
      'totalPrice',
      'newPrice',
      'hostingType',
      'planName',
      'duration',
    ])
    return { success: true }
  } catch (err) {
    log('err registerDomain&CreateCPanel via WHM', err.message)
    send(chatId, `❌ Setup failed. Tap 💬 Get Support for help.\n\nError: ${err.message}`, keyboardButtons)
    return { success: false, error: `HostPanel creation error: ${err.message}` }
  }
}

module.exports = { registerDomainAndCreateCpanel }
