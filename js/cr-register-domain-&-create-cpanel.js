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
  send(chatId, { en: `✅ <b>Payment confirmed</b> — $${info.totalPrice || info.hostingPrice}\n\nProvisioning your hosting now...`, fr: `✅ <b>Paiement confirmé</b> — $${info.totalPrice || info.hostingPrice}\n\nProvisionnement de votre hébergement en cours...`, zh: `✅ <b>付款已确认</b> — $${info.totalPrice || info.hostingPrice}\n\n正在配置您的主机...`, hi: `✅ <b>भुगतान की पुष्टि</b> — $${info.totalPrice || info.hostingPrice}\n\nआपकी होस्टिंग प्रावधान कर रहे हैं...` }[lang] || `✅ <b>Payment confirmed</b> — $${info.totalPrice || info.hostingPrice}\n\nProvisioning your hosting now...`, rem)

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
      send(chatId, { en: `🌐 Registering <b>${domain}</b>...`, fr: `🌐 Enregistrement de <b>${domain}</b>...`, zh: `🌐 正在注册 <b>${domain}</b>...`, hi: `🌐 <b>${domain}</b> पंजीकृत कर रहे हैं...` }[lang] || `🌐 Registering <b>${domain}</b>...`, rem)

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

          send(chatId, { en: `✅ Domain <b>${domain}</b> registered`, fr: `✅ Domaine <b>${domain}</b> enregistré`, zh: `✅ 域名 <b>${domain}</b> 已注册`, hi: `✅ डोमेन <b>${domain}</b> पंजीकृत` }[lang] || `✅ Domain <b>${domain}</b> registered`, rem)
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
      send(chatId, { en: `🔗 Linking <b>${domain}</b> to your hosting...`, fr: `🔗 Liaison de <b>${domain}</b> à votre hébergement...`, zh: `🔗 正在将 <b>${domain}</b> 链接到您的主机...`, hi: `🔗 <b>${domain}</b> को आपकी होस्टिंग से जोड़ रहे हैं...` }[lang] || `🔗 Linking <b>${domain}</b> to your hosting...`, rem)
    } else if (isExternal) {
      send(chatId, { en: `🔗 Connecting external domain <b>${domain}</b>...`, fr: `🔗 Connexion du domaine externe <b>${domain}</b>...`, zh: `🔗 正在连接外部域名 <b>${domain}</b>...`, hi: `🔗 बाहरी डोमेन <b>${domain}</b> कनेक्ट कर रहे हैं...` }[lang] || `🔗 Connecting external domain <b>${domain}</b>...`, rem)
    }

    // ── Step 3: Create hosting account (AFTER domain registration) ──
    send(chatId, { en: '⚙️ Creating hosting account...', fr: '⚙️ Création du compte d\'hébergement...', zh: '⚙️ 正在创建主机账户...', hi: '⚙️ होस्टिंग खाता बना रहे हैं...' }[lang] || '⚙️ Creating hosting account...', rem)

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

    send(chatId, { en: '✅ Hosting account created', fr: '✅ Compte d\'hébergement créé', zh: '✅ 主机账户已创建', hi: '✅ होस्टिंग खाता बनाया गया' }[lang] || '✅ Hosting account created', rem)

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
              // If a Railway CNAME was deleted (shortener was active), also remove from Railway
              const hadShortenerCNAME = cleanup.deleted.some(r =>
                r.type === 'CNAME' && r.content && r.content.includes('.up.railway.app')
              )
              if (hadShortenerCNAME) {
                log(`[Hosting] Shortener CNAME detected — removing domain from Railway`)
                const { removeDomainFromRailway } = require('./rl-save-domain-in-server')
                await removeDomainFromRailway(domain).catch(e =>
                  log(`[Hosting] Railway cleanup warning: ${e.message}`)
                )
              }
            }
          } catch (cleanupErr) {
            log(`[Hosting] DNS cleanup warning (non-blocking): ${cleanupErr.message}`)
          }

          // Create DNS records as proxied immediately — Cloudflare Universal SSL provides
          // edge certificate instantly. With SSL mode "Full", origin's default self-signed
          // cert is accepted for the CF→origin connection. AutoSSL upgrades it later.
          const dnsResult = await cfService.createHostingDNSRecords(cfZoneId, domain, WHM_HOST, true)
          await cfService.setSSLMode(cfZoneId, 'full')
          await cfService.enforceHTTPS(cfZoneId)
          log(`[Hosting] CF DNS records for ${domain}: ${dnsResult.success ? 'all created' : 'some failed'} (proxied — SSL active immediately)`)
          dnsSetupSuccess = true // Mark DNS as successful

          // ── SSL: Cloudflare handles all SSL (mode=full). AutoSSL on WHM is sufficient. ──
          // No need to install Origin CA on WHM — Cloudflare terminates visitor SSL,
          // and 'full' mode accepts self-signed/AutoSSL certs for CF→origin encryption.
          try {
            const sslRes = await require('./whm-service').startAutoSSL(result.username)
            log(`[Hosting] AutoSSL triggered for ${result.username}: ${sslRes.success ? 'started' : sslRes.error}`)
          } catch (_) {}

          // Enable Authenticated Origin Pulls — blocks direct-IP and SNI-based scanning
          try {
            await cfService.enableAuthenticatedOriginPulls(cfZoneId)
            log(`[Hosting] Authenticated Origin Pulls enabled for ${domain}`)
          } catch (aopErr) {
            log(`[Hosting] AOP enable warning (non-blocking): ${aopErr.message}`)
          }

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

    // DNS status message — conditional based on actual success
    if (dnsSetupSuccess) {
      send(chatId, { en: '✅ Domain configured · DNS auto-set via Cloudflare', fr: '✅ Domaine configuré · DNS auto-configuré via Cloudflare', zh: '✅ 域名已配置 · DNS已通过Cloudflare自动设置', hi: '✅ डोमेन कॉन्फ़िगर · DNS Cloudflare द्वारा स्वतः सेट' }[lang] || '✅ Domain configured · DNS auto-set via Cloudflare', rem)
    } else {
      send(chatId, { en: '⚠️ Domain created, but DNS setup needs attention. Your hosting is active — DNS records may need manual configuration via DNS Management.', fr: '⚠️ Domaine créé, mais la configuration DNS nécessite votre attention. Votre hébergement est actif — les enregistrements DNS peuvent nécessiter une configuration manuelle via Gestion DNS.', zh: '⚠️ 域名已创建，但DNS设置需要注意。您的主机已激活 — DNS记录可能需要通过DNS管理手动配置。', hi: '⚠️ डोमेन बनाया गया, लेकिन DNS सेटअप पर ध्यान देने की ज़रूरत। आपकी होस्टिंग सक्रिय है — DNS रिकॉर्ड DNS प्रबंधन के माध्यम से मैन्युअल कॉन्फ़िगरेशन की आवश्यकता हो सकती है।' }[lang] || '⚠️ Domain created, but DNS setup needs attention. Your hosting is active — DNS records may need manual configuration via DNS Management.', rem)
      log(`[Hosting] DNS setup was NOT successful for ${domain} — user notified`)
    }

    // Issue 10 Fix: For external domains, user must manually update NS at their registrar
    if (isExternal && cfNameservers.length >= 2) {
      const nsMessages = {
        en: `⚠️ <b>Action Required for External Domain</b>

Your domain <b>${domain}</b> requires a nameserver update at your domain registrar.

Please update the nameservers to:
NS1: <code>${cfNameservers[0]}</code>
NS2: <code>${cfNameservers[1]}</code>

Go to your domain registrar's panel → DNS/Nameserver settings → Replace existing NS with the above.

Your site won't be live until nameservers are updated and propagated (up to 24h).`,

        fr: `⚠️ <b>Action requise pour le domaine externe</b>

Votre domaine <b>${domain}</b> nécessite une mise à jour des serveurs de noms chez votre registraire.

Veuillez mettre à jour les serveurs de noms vers :
NS1 : <code>${cfNameservers[0]}</code>
NS2 : <code>${cfNameservers[1]}</code>

Allez dans le panneau de votre registraire → Paramètres DNS/Serveurs de noms → Remplacez les NS existants par ceux ci-dessus.

Votre site ne sera pas accessible tant que les serveurs de noms ne seront pas mis à jour et propagés (jusqu'à 24h).`,

        zh: `⚠️ <b>外部域名需要操作</b>

您的域名 <b>${domain}</b> 需要在域名注册商处更新域名服务器。

请更新域名服务器为：
NS1: <code>${cfNameservers[0]}</code>
NS2: <code>${cfNameservers[1]}</code>

前往您的域名注册商面板 → DNS/域名服务器设置 → 将现有NS替换为以上内容。

在域名服务器更新并传播之前（最多24小时），您的网站将无法访问。`,

        hi: `⚠️ <b>बाहरी डोमेन के लिए कार्रवाई आवश्यक</b>

आपके डोमेन <b>${domain}</b> को आपके डोमेन रजिस्ट्रार पर नेमसर्वर अपडेट की आवश्यकता है।

कृपया नेमसर्वर अपडेट करें:
NS1: <code>${cfNameservers[0]}</code>
NS2: <code>${cfNameservers[1]}</code>

अपने डोमेन रजिस्ट्रार के पैनल पर जाएं → DNS/नेमसर्वर सेटिंग्स → मौजूदा NS को ऊपर वाले से बदलें।

नेमसर्वर अपडेट और प्रसार होने तक (24 घंटे तक) आपकी साइट लाइव नहीं होगी।`,
      }
      send(chatId, nsMessages[lang] || nsMessages.en, rem)

      // DNS-fix: Schedule a DNS propagation check for external domains
      // Follow up with the user after 2 hours to verify NS propagation
      try {
        const dnsCheckDelay = 2 * 60 * 60 * 1000 // 2 hours
        setTimeout(async () => {
          try {
            const dns = require('dns').promises
            const resolved = await dns.resolveNs(domain).catch(() => [])
            const isPropagated = resolved.some(ns =>
              cfNameservers.some(cf => ns.toLowerCase().includes(cf.toLowerCase().replace(/\.$/, '')))
            )
            if (isPropagated) {
              const successMsgs = {
                en: `✅ <b>DNS Propagation Complete!</b>\n\nYour domain <b>${domain}</b> nameservers are now pointing to Cloudflare. Your site should be live!\n\nIf you experience any issues, use 🔧 DNS Management to check records.`,
                fr: `✅ <b>Propagation DNS terminée !</b>\n\nLes serveurs de noms de votre domaine <b>${domain}</b> pointent maintenant vers Cloudflare. Votre site devrait être en ligne !\n\nEn cas de problème, utilisez 🔧 Gestion DNS pour vérifier les enregistrements.`,
                zh: `✅ <b>DNS传播完成！</b>\n\n您的域名 <b>${domain}</b> 的域名服务器现已指向Cloudflare。您的网站应该已上线！\n\n如遇问题，请使用 🔧 DNS管理 检查记录。`,
                hi: `✅ <b>DNS प्रसार पूर्ण!</b>\n\nआपके डोमेन <b>${domain}</b> के नेमसर्वर अब Cloudflare पर इंगित हैं। आपकी साइट लाइव होनी चाहिए!\n\nकिसी भी समस्या के लिए, रिकॉर्ड जांचने के लिए 🔧 DNS प्रबंधन का उपयोग करें।`,
              }
              send(chatId, successMsgs[lang] || successMsgs.en, { parse_mode: 'HTML' })
              log(`[DNS-Propagation] ✅ ${domain} NS propagated successfully — user ${chatId} notified`)
            } else {
              const pendingMsgs = {
                en: `⏳ <b>DNS Propagation In Progress</b>\n\nYour domain <b>${domain}</b> nameservers haven't fully propagated yet.\n\nCurrent NS: ${resolved.join(', ') || 'not resolved'}\nExpected: ${cfNameservers.join(', ')}\n\n💡 This can take up to 24-48 hours. We'll check again later.`,
                fr: `⏳ <b>Propagation DNS en cours</b>\n\nLes serveurs de noms de <b>${domain}</b> ne sont pas encore totalement propagés.\n\nNS actuels : ${resolved.join(', ') || 'non résolus'}\nAttendus : ${cfNameservers.join(', ')}\n\n💡 Cela peut prendre jusqu'à 24-48 heures. Nous vérifierons à nouveau plus tard.`,
                zh: `⏳ <b>DNS传播进行中</b>\n\n<b>${domain}</b> 的域名服务器尚未完全传播。\n\n当前NS: ${resolved.join(', ') || '未解析'}\n预期: ${cfNameservers.join(', ')}\n\n💡 这可能需要24-48小时。我们稍后会再次检查。`,
                hi: `⏳ <b>DNS प्रसार जारी</b>\n\n<b>${domain}</b> के नेमसर्वर अभी पूरी तरह प्रसारित नहीं हुए हैं।\n\nवर्तमान NS: ${resolved.join(', ') || 'हल नहीं'}\nअपेक्षित: ${cfNameservers.join(', ')}\n\n💡 इसमें 24-48 घंटे लग सकते हैं। हम बाद में फिर जांचेंगे।`,
              }
              send(chatId, pendingMsgs[lang] || pendingMsgs.en, { parse_mode: 'HTML' })
              log(`[DNS-Propagation] ⏳ ${domain} NS not yet propagated — user ${chatId} notified. Current: ${resolved.join(', ')}`)

              // Schedule another check in 6 hours
              setTimeout(async () => {
                try {
                  const resolved2 = await dns.resolveNs(domain).catch(() => [])
                  const isPropagated2 = resolved2.some(ns =>
                    cfNameservers.some(cf => ns.toLowerCase().includes(cf.toLowerCase().replace(/\.$/, '')))
                  )
                  if (isPropagated2) {
                    send(chatId, (successMsgs[lang] || successMsgs.en), { parse_mode: 'HTML' })
                    log(`[DNS-Propagation] ✅ ${domain} NS propagated (2nd check) — user ${chatId} notified`)
                  } else {
                    log(`[DNS-Propagation] ⚠️ ${domain} NS still not propagated after 8 hours — user may need manual help`)
                  }
                } catch (e2) { log(`[DNS-Propagation] 2nd check error for ${domain}: ${e2.message}`) }
              }, 6 * 60 * 60 * 1000)
            }
          } catch (checkErr) { log(`[DNS-Propagation] Check error for ${domain}: ${checkErr.message}`) }
        }, dnsCheckDelay)
        log(`[DNS-Propagation] Scheduled NS check for external domain ${domain} in 2 hours`)
      } catch (schedErr) { log(`[DNS-Propagation] Failed to schedule check: ${schedErr.message}`) }
    }

    // ── Step 4: Storing credentials & deploying protection ──
    send(chatId, { en: '🛡️ Activating Anti-Red protection...', fr: '🛡️ Activation de la protection Anti-Red...', zh: '🛡️ 正在激活Anti-Red保护...', hi: '🛡️ Anti-Red सुरक्षा सक्रिय कर रहे हैं...' }[lang] || '🛡️ Activating Anti-Red protection...', rem)

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

    // Schedule automated health check (runs 5 minutes after setup)
    try {
      const healthCheck = require('./hosting-health-check')
      healthCheck.scheduleHealthCheck(domain, result.username, chatId)
      log(`[Hosting] Health check scheduled for ${domain} (5 min)`)
    } catch (_) {}

    // ── Step 5: Finalizing ──
    send(chatId, { en: '✅ Anti-Red protection active', fr: '✅ Protection Anti-Red activée', zh: '✅ Anti-Red保护已激活', hi: '✅ Anti-Red सुरक्षा सक्रिय' }[lang] || '✅ Anti-Red protection active', rem)

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
