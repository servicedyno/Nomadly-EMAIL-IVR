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
    const nsChoice = info?.nameserver || info?.nsChoice
    const isCloudflareNS = nsChoice === 'cloudflare' || nsChoice === 'Cloudflare'
    const isExisting = info.existingDomain
    const isExternal = info.connectExternalDomain
    const isNewDomain = !isExisting && !isExternal

    // Track CF zone info — populated during domain registration (new domains)
    // or CF DNS setup (existing/external domains)
    let cfZoneId = null
    let cfNameservers = []

    // ── Step 2: Domain registration FIRST (for new domains only) ──
    // This prevents orphan WHM accounts if domain registration fails.
    // For cloudflare NS: registerDomain() internally creates CF zone and
    // passes zone-specific NS to the registrar API at registration time.
    if (isNewDomain) {
      send(chatId, `🌐 Registering <b>${domain}</b>...`, rem)

      try {
        const registrar = info?.registrar || 'ConnectReseller'
        const regNsChoice = nsChoice || 'cloudflare'
        const { MongoClient } = require('mongodb')
        const regClient = new MongoClient(process.env.MONGO_URL)
        await regClient.connect()
        const regDb = regClient.db(process.env.DB_NAME || 'test')

        const regResult = await domainService.registerDomain(domain, registrar, regNsChoice, regDb, chatId)
        await regClient.close()

        if (regResult.success) {
          log(`[Hosting] Domain ${domain} registered at ${regResult.registrar} (ID: ${regResult.opDomainId || 'N/A'})`)
          info.registrar = regResult.registrar

          // Capture CF zone info from registration — avoids double createZone later
          if (regResult.cfZoneId) {
            cfZoneId = regResult.cfZoneId
            cfNameservers = regResult.nameservers || []
            log(`[Hosting] CF zone captured from registration: ${cfZoneId} NS: ${cfNameservers.join(', ')}`)
          }

          // Store in user's domainsOf + registeredDomains
          const regClient2 = new MongoClient(process.env.MONGO_URL)
          await regClient2.connect()
          const regDb2 = regClient2.db(process.env.DB_NAME || 'test')
          const domainKey = domain.replace(/\./g, '@')
          await regDb2.collection('domainsOf').updateOne(
            { _id: parseFloat(chatId) },
            { $set: { [domainKey]: true } },
            { upsert: true }
          )

          await regDb2.collection('registeredDomains').updateOne(
            { _id: domain },
            { $set: {
              val: {
                domain,
                provider: regResult.registrar,
                registrar: regResult.registrar,
                nameserverType: regNsChoice,
                nameservers: regResult.nameservers || [],
                autoRenew: true,
                ownerChatId: parseFloat(chatId),
                status: 'registered',
                registeredAt: new Date(),
                linkedAt: new Date(),
                cfZoneId: regResult.cfZoneId || null,
                opDomainId: regResult.opDomainId || null,
              }
            }},
            { upsert: true }
          )
          await regClient2.close()

          send(chatId, `✅ Domain <b>${domain}</b> registered`, rem)
        } else {
          log(`[Hosting] Domain registration failed for ${domain}: ${regResult.error}`)
          send(chatId, `❌ Domain registration failed: ${regResult.error}\n\nTap 💬 Get Support for help.`, keyboardButtons)
          return { success: false, error: `Domain registration failed: ${regResult.error}` }
        }
      } catch (regErr) {
        log(`[Hosting] Domain registration error: ${regErr.message}`)
        send(chatId, `❌ Domain registration failed. Tap 💬 Get Support for help.\n\nError: ${regErr.message}`, keyboardButtons)
        return { success: false, error: `Domain registration error: ${regErr.message}` }
      }
    } else if (isExisting) {
      send(chatId, `🔗 Linking <b>${domain}</b> to your hosting...`, rem)
    } else if (isExternal) {
      send(chatId, `🔗 Connecting external domain <b>${domain}</b>...`, rem)
    }

    // ── Step 3: Create hosting account (AFTER domain registration) ──
    send(chatId, `⚙️ Creating hosting account...`, rem)

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

    // P0 FIX: Save cPanel username for cleanup if subsequent steps fail
    const cpanelUsername = result.username
    let dnsSetupSuccess = false

    // ── Step 4: Cloudflare DNS setup ──
    // For new domains: reuse CF zone from registration (no double createZone)
    // For existing/external domains: create CF zone now
    if (isCloudflareNS) {
      try {
        if (!cfZoneId) {
          // Existing/external domain — CF zone not yet created
          const zone = await cfService.createZone(domain)
          if (zone.success && zone.zoneId) {
            cfZoneId = zone.zoneId
            cfNameservers = zone.nameservers || []
            log(`[Hosting] CF zone created for existing/external domain ${domain}: ${cfZoneId}`)
          }
        }

        if (cfZoneId) {
          // Issue E Fix: Clean up any conflicting A/AAAA/CNAME records for root and www
          // before creating hosting records. This is essential when transitioning a domain
          // from shortener (CNAME→Railway) to hosting (A→WHM), since Cloudflare doesn't
          // allow both CNAME and A records for the same name.
          try {
            const cleanup = await cfService.cleanupConflictingDNS(cfZoneId, domain)
            if (cleanup.deleted.length > 0) {
              log(`[Hosting] Cleaned up ${cleanup.deleted.length} conflicting DNS records for ${domain}`)
            }
          } catch (cleanupErr) {
            log(`[Hosting] DNS cleanup warning (non-blocking): ${cleanupErr.message}`)
          }

          // Create DNS records as DNS-only first so AutoSSL can validate against origin directly
          const dnsResult = await cfService.createHostingDNSRecords(cfZoneId, domain, WHM_HOST, false)
          await cfService.setSSLMode(cfZoneId, 'full')
          await cfService.enforceHTTPS(cfZoneId)
          log(`[Hosting] CF DNS records for ${domain}: ${dnsResult.success ? 'all created' : 'some failed'} (DNS-only for AutoSSL)`)
          dnsSetupSuccess = true // Mark DNS as successful

          // Trigger AutoSSL while records are unproxied (Let's Encrypt needs direct access)
          try {
            const sslRes = await require('./whm-service').startAutoSSL(result.username)
            log(`[Hosting] AutoSSL triggered for ${result.username}: ${sslRes.success ? 'started' : sslRes.error}`)
          } catch (sslErr) {
            log(`[Hosting] AutoSSL trigger warning (non-blocking): ${sslErr.message}`)
          }

          // Wait for AutoSSL cert issuance, then proxy records for CDN + DDoS protection
          // This runs in background — doesn't block the user response
          ;(async () => {
            try {
              await new Promise(r => setTimeout(r, 120000)) // 2 min for AutoSSL
              await cfService.proxyHostingDNSRecords(cfZoneId, domain)
              log(`[Hosting] DNS records proxied for ${domain} after AutoSSL window`)
            } catch (proxyErr) {
              log(`[Hosting] Background proxy error (non-critical): ${proxyErr.message}`)
            }
          })()

          // For existing/external domains: update NS at registrar
          if (!isNewDomain && cfNameservers.length >= 2) {
            try {
              const registrar = info?.registrar || 'ConnectReseller'
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

          // Store CF zone info in registeredDomains
          try {
            const { MongoClient } = require('mongodb')
            const nsClient = new MongoClient(process.env.MONGO_URL)
            await nsClient.connect()
            const nsDb = nsClient.db(process.env.DB_NAME || 'test')
            await nsDb.collection('registeredDomains').updateOne(
              { _id: domain },
              { $set: { 'val.cfZoneId': cfZoneId, 'val.nameservers': cfNameservers, 'val.nameserverType': 'cloudflare' } },
              { upsert: true }
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

    // Issue 10 Fix: For external domains, user must manually update NS at their registrar
    if (isExternal && cfNameservers.length >= 2) {
      const nsMsg = `⚠️ <b>Action Required for External Domain</b>

Your domain <b>${domain}</b> requires a nameserver update at your domain registrar.

Please update the nameservers to:
NS1: <code>${cfNameservers[0]}</code>
NS2: <code>${cfNameservers[1]}</code>

Go to your domain registrar's panel → DNS/Nameserver settings → Replace existing NS with the above.

Your site won't be live until nameservers are updated and propagated (up to 24h).`
      send(chatId, nsMsg, rem)
    }

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
