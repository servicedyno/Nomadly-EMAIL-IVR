/* global process */
/**
 * cPanel Panel Routes
 * Express routes for the cPanel management frontend.
 * All routes prefixed with /panel
 */

const express = require('express')
const multer = require('multer')
const nodemailer = require('nodemailer')
const cpAuth = require('./cpanel-auth')
const cpProxy = require('./cpanel-proxy')
const cfService = require('./cf-service')
const safeBrowsing = require('./safe-browsing-service')
const whmService = require('./whm-service')
const { log } = require('console')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })

function createCpanelRoutes(getCpanelCol) {
  const router = express.Router()

  // ─── Auth Middleware ────────────────────────────────────

  function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const token = authHeader.split(' ')[1]
    const decoded = cpAuth.verifyToken(token)
    if (!decoded) {
      return res.status(401).json({ error: 'Session expired. Please login again.' })
    }
    req.cpUser = decoded.cpUser
    req.cpDomain = decoded.domain
    req.cpChatId = decoded.chatId
    next()
  }

  // Resolve cPanel password from encrypted storage
  async function resolveCpPass(req, res, next) {
    try {
      const col = getCpanelCol()
      if (!col || !col.findOne) return res.status(503).json({ error: 'Service starting up, try again shortly.' })
      const account = await col.findOne({ _id: req.cpUser.toLowerCase() })
      if (!account) return res.status(401).json({ error: 'Account not found' })

      req.cpPass = cpAuth.decrypt({
        encrypted: account.cpPass_encrypted,
        iv: account.cpPass_iv,
        tag: account.cpPass_tag,
      })
      // Per-account WHM host — accounts created on different servers keep their original host
      req.whmHost = account.whmHost || null
      next()
    } catch (err) {
      log(`[Panel] Credential resolve error: ${err.message}`)
      return res.status(500).json({ error: 'Authentication error' })
    }
  }

  const auth = [authMiddleware, resolveCpPass]

  // ─── Login ──────────────────────────────────────────────

  router.post('/login', async (req, res) => {
    const { username, pin } = req.body
    if (!username || !pin) return res.status(400).json({ error: 'Username and PIN are required.' })

    const col = getCpanelCol()
    if (!col || !col.findOne) return res.status(503).json({ error: 'Service starting up, try again shortly.' })

    const result = await cpAuth.login(col, username, pin)
    if (!result.success) return res.status(401).json({ error: result.error })

    res.json({
      token: result.token,
      username: result.cpUser,
      domain: result.domain,
    })
  })

  // Verify session
  router.get('/session', authMiddleware, (req, res) => {
    res.json({ username: req.cpUser, domain: req.cpDomain })
  })

  // ─── File Manager ──────────────────────────────────────

  // Protected anti-red files that users should not modify/delete
  const PROTECTED_FILES = ['.htaccess', '.user.ini', '.antired-challenge.php']

  function isProtectedAntiRedFile(dir, file) {
    // Only protect files in the public_html root directory
    const isPublicHtml = dir && (dir.endsWith('/public_html') || dir.endsWith('/public_html/'))
    return isPublicHtml && PROTECTED_FILES.includes(file)
  }

  router.get('/files', ...auth, async (req, res) => {
    const dir = req.query.dir || `/home/${req.cpUser}/public_html`
    const result = await cpProxy.listFiles(req.cpUser, req.cpPass, dir, req.whmHost)
    res.json(result)
  })

  router.get('/files/content', ...auth, async (req, res) => {
    const { dir, file } = req.query
    if (!dir || !file) return res.status(400).json({ error: 'dir and file are required' })
    const result = await cpProxy.getFileContent(req.cpUser, req.cpPass, dir, file, req.whmHost)
    res.json(result)
  })

  router.post('/files/save', express.json({ limit: '50mb' }), ...auth, async (req, res) => {
    const { dir, file, content } = req.body
    if (!dir || !file) return res.status(400).json({ error: 'dir and file are required' })
    if (isProtectedAntiRedFile(dir, file)) {
      return res.status(403).json({ error: `Cannot modify ${file} — this file is managed by the anti-red protection system. Changes would be overwritten automatically.` })
    }
    const result = await cpProxy.saveFileContent(req.cpUser, req.cpPass, dir, file, content, req.whmHost)
    res.json(result)
  })

  router.post('/files/upload', ...auth, (req, res, next) => {
    // Gracefully handle client disconnection during upload
    let aborted = false
    req.on('aborted', () => { aborted = true })
    req.on('close', () => { if (!res.writableEnded) aborted = true })

    upload.single('file')(req, res, (err) => {
      if (aborted) {
        log(`[Panel] Upload aborted by client before multer finished (user: ${req.cpUser || 'unknown'}, dir: ${req.body?.dir || 'unknown'})`)
        if (!res.headersSent) return res.status(499).json({ error: 'Upload cancelled by client' })
        return
      }
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE'
          ? `File too large (max 100 MB)`
          : `Upload error: ${err.message}`
        log(`[Panel] Upload error: ${err.message} (user: ${req.cpUser || 'unknown'})`)
        if (!res.headersSent) return res.status(400).json({ error: msg })
        return
      }
      next()
    })
  }, async (req, res) => {
    const dir = req.body.dir || `/home/${req.cpUser}/public_html`
    if (!req.file) return res.status(400).json({ error: 'No file provided' })
    log(`[Panel] Upload: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB) → ${dir} (user: ${req.cpUser})`)
    // Prevent overwriting protected anti-red files via upload
    if (isProtectedAntiRedFile(dir, req.file.originalname)) {
      return res.status(403).json({ error: `Cannot upload ${req.file.originalname} — this file is managed by the anti-red protection system.` })
    }
    const result = await cpProxy.uploadFile(req.cpUser, req.cpPass, dir, req.file.originalname, req.file.buffer, req.whmHost)
    res.json(result)
  })

  router.post('/files/mkdir', ...auth, async (req, res) => {
    const { dir, name } = req.body
    if (!dir || !name) return res.status(400).json({ error: 'dir and name are required' })
    const result = await cpProxy.createDirectory(req.cpUser, req.cpPass, dir, name, req.whmHost)
    res.json(result)
  })

  router.post('/files/delete', ...auth, async (req, res) => {
    const { dir, file } = req.body
    if (!dir || !file) return res.status(400).json({ error: 'dir and file are required' })
    if (isProtectedAntiRedFile(dir, file)) {
      return res.status(403).json({ error: `Cannot delete ${file} — this file is managed by the anti-red protection system and will be re-created automatically.` })
    }
    const result = await cpProxy.deleteFile(req.cpUser, req.cpPass, dir, file, req.whmHost)
    res.json(result)
  })

  router.post('/files/rename', ...auth, async (req, res) => {
    const { dir, oldName, newName } = req.body
    if (!dir || !oldName || !newName) return res.status(400).json({ error: 'dir, oldName, newName required' })
    // Prevent renaming protected anti-red files (both source and destination)
    if (isProtectedAntiRedFile(dir, oldName)) {
      return res.status(403).json({ error: `Cannot rename ${oldName} — this file is managed by the anti-red protection system.` })
    }
    if (isProtectedAntiRedFile(dir, newName)) {
      return res.status(403).json({ error: `Cannot overwrite ${newName} — this file is managed by the anti-red protection system.` })
    }
    const result = await cpProxy.renameFile(req.cpUser, req.cpPass, dir, oldName, newName, req.whmHost)
    res.json(result)
  })

  router.post('/files/extract', ...auth, async (req, res) => {
    const { dir, file, destDir } = req.body
    if (!dir || !file) return res.status(400).json({ error: 'dir and file are required' })
    const result = await cpProxy.extractFile(req.cpUser, req.cpPass, dir, file, destDir || dir, req.whmHost)
    res.json(result)
  })

  router.post('/files/compress', ...auth, async (req, res) => {
    const { dir, files, destFile } = req.body
    if (!dir || !files?.length || !destFile) return res.status(400).json({ error: 'dir, files, and destFile are required' })
    const result = await cpProxy.compressFiles(req.cpUser, req.cpPass, dir, files, destFile, req.whmHost)
    res.json(result)
  })

  // ─── Domains ────────────────────────────────────────────

  router.get('/domains', ...auth, async (req, res) => {
    const result = await cpProxy.listDomains(req.cpUser, req.cpPass, req.whmHost)
    res.json(result)
  })

  router.post('/domains/add', ...auth, async (req, res) => {
    const { domain, subDomain, dir } = req.body
    if (!domain) return res.status(400).json({ error: 'domain is required' })

    // ── Blocked domain check (phishing/abuse) ──
    try {
      const blockedCol = db.collection('blockedDomains')
      const blocked = await blockedCol.findOne({ domain: domain.toLowerCase() })
      if (blocked) {
        log(`[Panel] add: BLOCKED domain rejected: ${domain} (reason: ${blocked.reason})`)
        return res.status(403).json({
          error: `This domain (${domain}) has been permanently blocked due to abuse policy violations and cannot be added.`,
          blocked: true,
        })
      }
    } catch (blockErr) {
      log(`[Panel] add: blocklist check error (non-blocking): ${blockErr.message}`)
    }

    // ── Addon domain limit enforcement ──
    try {
      const col = getCpanelCol()
      if (col) {
        const account = await col.findOne({ _id: req.cpUser.toLowerCase() })
        if (account) {
          const { getAddonLimit } = require('./whm-service')
          const limit = getAddonLimit(account.plan)
          const currentAddons = (account.addonDomains || []).length
          if (limit !== -1 && currentAddons >= limit) {
            const isWeekly = (account.plan || '').toLowerCase().includes('week')
            const upgradeMsg = isWeekly
              ? `Domain limit reached (${limit} addon${limit !== 1 ? 's' : ''}). Upgrade to a monthly plan for more domains — use the Upgrade Plan button in your hosting details on the bot.`
              : `Domain limit reached (${limit} addon domains). Upgrade to Golden Anti-Red for unlimited domains.`
            return res.status(403).json({ error: upgradeMsg, limitReached: true, currentAddons, limit })
          }
        }
      }
    } catch (limitErr) {
      log(`[Panel] add: limit check error (non-blocking): ${limitErr.message}`)
    }

    const result = await cpProxy.addAddonDomain(req.cpUser, req.cpPass, domain, subDomain, dir, req.whmHost)

    // Persist addon domain in cpanelAccounts.addonDomains[] for protection-enforcer discovery
    if (!result.errors?.length) {
      try {
        const col = getCpanelCol()
        if (col) {
          await col.updateOne(
            { _id: req.cpUser.toLowerCase() },
            { $addToSet: { addonDomains: domain.toLowerCase() } }
          )
          log(`[Panel] Stored addon domain ${domain} in cpanelAccounts for ${req.cpUser}`)
        }
      } catch (dbErr) {
        log(`[Panel] add: failed to persist addon ${domain}: ${dbErr.message}`)
      }

      // Deploy anti-red protection + DNS for addon domain (non-blocking, with retry)
      ;(async () => {
        const MAX_RETRIES = 3
        const RETRY_DELAYS = [5000, 15000, 45000] // 5s, 15s, 45s

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            const accountWhmHost = req.whmHost || process.env.WHM_HOST
            let zone = await cfService.getZoneByName(domain)
            if (!zone) {
              const newZone = await cfService.createZone(domain)
              if (newZone.success) zone = { id: newZone.zoneId }
            }
            if (zone) {
              await cfService.cleanupConflictingDNS(zone.id, domain)
              await cfService.createHostingDNSRecords(zone.id, domain, accountWhmHost)
              await cfService.setSSLMode(zone.id, 'full')
              await cfService.enforceHTTPS(zone.id)
              const antiRedService = require('./anti-red-service')
              const col2 = getCpanelCol()
              const account = col2 ? await col2.findOne({ _id: req.cpUser.toLowerCase() }) : null
              if (account) {
                await antiRedService.deployFullProtection(req.cpUser, domain, account.plan || '')
              } else {
                await antiRedService.deploySharedWorkerRoute(domain, zone.id)
              }

              // Verify protection is active (delay to allow propagation)
              setTimeout(async () => {
                try {
                  const antiRedService = require('./anti-red-service')
                  const verification = await antiRedService.verifyProtection(domain)
                  if (verification.active) {
                    log(`[Panel] add: ✅ protection VERIFIED for addon ${domain} (worker=${verification.workerDetected}, challenge=${verification.challengeDetected})`)
                  } else {
                    log(`[Panel] add: ⚠️ protection deployed but NOT verified for addon ${domain}: ${verification.error || 'no worker/challenge detected'}`)
                    // Notify user via bot
                    if (account?.chatId) {
                      const bot = require('./_index')?._bot
                      if (bot) {
                        bot.sendMessage(account.chatId,
                          `⚠️ <b>Anti-Red Protection Warning</b>\n\n` +
                          `Protection was deployed for <b>${domain}</b> but could not be verified.\n` +
                          `This may happen if DNS hasn't propagated yet.\n\n` +
                          `<b>Action needed:</b> Ensure your domain's nameservers point to Cloudflare. Protection will be re-checked automatically.`,
                          { parse_mode: 'HTML' }
                        ).catch(() => {})
                      }
                    }
                  }
                } catch (verifyErr) {
                  log(`[Panel] add: verification check failed for ${domain}: ${verifyErr.message}`)
                }
              }, 30000) // Wait 30s before verification

              log(`[Panel] add: anti-red + DNS deployed for addon ${domain} (attempt ${attempt})`)
              break // Success — exit retry loop
            } else {
              throw new Error('Cloudflare zone could not be created or found')
            }
          } catch (protErr) {
            log(`[Panel] add: protection deploy attempt ${attempt}/${MAX_RETRIES} failed for ${domain}: ${protErr.message}`)
            if (attempt < MAX_RETRIES) {
              await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]))
            } else {
              // Final attempt failed — notify user
              log(`[Panel] add: ❌ all ${MAX_RETRIES} protection deploy attempts failed for addon ${domain}`)
              try {
                const col2 = getCpanelCol()
                const account = col2 ? await col2.findOne({ _id: req.cpUser.toLowerCase() }) : null
                if (account?.chatId) {
                  const bot = require('./_index')?._bot
                  if (bot) {
                    bot.sendMessage(account.chatId,
                      `🚨 <b>Anti-Red Protection Failed</b>\n\n` +
                      `Protection could not be deployed for <b>${domain}</b> after ${MAX_RETRIES} attempts.\n` +
                      `Error: ${protErr.message}\n\n` +
                      `<b>Your domain may be unprotected.</b>\n` +
                      `Please ensure your domain's nameservers point to Cloudflare, then try adding the domain again.`,
                      { parse_mode: 'HTML' }
                    ).catch(() => {})
                  }
                }
              } catch (_) {}
            }
          }
        }

        // Schedule health check for addon domain (same 3-stage pipeline as primary)
        try {
          const healthCheck = require('./hosting-health-check')
          const col3 = getCpanelCol()
          const account = col3 ? await col3.findOne({ _id: req.cpUser.toLowerCase() }) : null
          healthCheck.scheduleHealthCheck(domain, req.cpUser, account?.chatId || '')
          log(`[Panel] add: health check scheduled for addon ${domain}`)
        } catch (_) {}
      })()
    }

    res.json(result)
  })

  router.post('/domains/remove', ...auth, async (req, res) => {
    const { domain, subDomain } = req.body
    if (!domain) return res.status(400).json({ error: 'domain is required' })

    // 1. Remove addon domain from cPanel
    const result = await cpProxy.removeAddonDomain(req.cpUser, req.cpPass, domain, subDomain, req.cpDomain, req.whmHost)

    // 2. Remove addon domain from cpanelAccounts.addonDomains[] (protection-enforcer tracking)
    try {
      const col = getCpanelCol()
      if (col) {
        await col.updateOne(
          { _id: req.cpUser.toLowerCase() },
          { $pull: { addonDomains: domain.toLowerCase() } }
        )
        log(`[Panel] Removed addon domain ${domain} from cpanelAccounts for ${req.cpUser}`)
      }
    } catch (dbErr) {
      log(`[Panel] remove: failed to unpersist addon ${domain}: ${dbErr.message}`)
    }

    // 3. Clean up Cloudflare: remove DNS records and Worker routes for the removed domain
    try {
      const zone = await cfService.getZoneByName(domain)
      if (zone) {
        // Remove Worker routes
        const antiRedService = require('./anti-red-service')
        await antiRedService.removeWorkerRoutes(domain, zone.id).catch(() => {})
        // Remove DNS records pointing to our WHM
        await cfService.cleanupConflictingDNS(zone.id, domain).catch(() => {})
        log(`[Panel] Cleaned up CF resources for removed domain: ${domain}`)
      }
    } catch (cfErr) {
      log(`[Panel] CF cleanup warning for removed domain ${domain}: ${cfErr.message}`)
    }

    res.json(result)
  })

  // ─── Email ──────────────────────────────────────────────

  router.get('/email', ...auth, async (req, res) => {
    const result = await cpProxy.listEmailAccounts(req.cpUser, req.cpPass, req.whmHost)
    res.json(result)
  })

  router.post('/email/create', ...auth, async (req, res) => {
    const { email, password, quota, domain } = req.body
    if (!email || !password || !domain) return res.status(400).json({ error: 'email, password, and domain are required' })
    const result = await cpProxy.createEmailAccount(req.cpUser, req.cpPass, email, password, quota, domain, req.whmHost)
    res.json(result)
  })

  router.post('/email/delete', ...auth, async (req, res) => {
    const { email, domain } = req.body
    if (!email || !domain) return res.status(400).json({ error: 'email and domain are required' })
    const result = await cpProxy.deleteEmailAccount(req.cpUser, req.cpPass, email, domain, req.whmHost)
    res.json(result)
  })

  router.post('/email/password', ...auth, async (req, res) => {
    const { email, password, domain } = req.body
    if (!email || !password || !domain) return res.status(400).json({ error: 'email, password, and domain required' })
    const result = await cpProxy.changeEmailPassword(req.cpUser, req.cpPass, email, password, domain, req.whmHost)
    res.json(result)
  })

  // ─── Stats ──────────────────────────────────────────────

  router.get('/stats', ...auth, async (req, res) => {
    const [quota, bandwidth] = await Promise.all([
      cpProxy.getQuotaInfo(req.cpUser, req.cpPass, req.whmHost),
      cpProxy.getBandwidthData(req.cpUser, req.cpPass, req.whmHost),
    ])
    res.json({ quota, bandwidth })
  })

  // ─── Subdomains ─────────────────────────────────────────

  router.get('/subdomains', ...auth, async (req, res) => {
    const result = await cpProxy.listSubdomains(req.cpUser, req.cpPass, req.whmHost)
    res.json(result)
  })

  router.post('/subdomains/create', ...auth, async (req, res) => {
    const { subdomain, rootdomain, dir } = req.body
    if (!subdomain || !rootdomain) return res.status(400).json({ error: 'subdomain and rootdomain are required' })

    // 1. Create subdomain in cPanel
    const result = await cpProxy.createSubdomain(req.cpUser, req.cpPass, subdomain, rootdomain, dir, req.whmHost)

    // 2. Create DNS record in Cloudflare for the subdomain
    try {
      const subdomainWhmHost = req.whmHost || process.env.WHM_HOST
      const zone = await cfService.getZoneByName(rootdomain)
      if (zone && subdomainWhmHost) {
        const fqdn = `${subdomain}.${rootdomain}`
        // Create A record for the subdomain pointing to our WHM server, proxied
        await cfService.createDNSRecord(zone.id, 'A', fqdn, subdomainWhmHost, 1, true)
        log(`[Panel] Created CF DNS A record for subdomain: ${fqdn} → ${subdomainWhmHost}`)
      }
    } catch (cfErr) {
      // Non-blocking — subdomain still works via wildcard if CF has one
      log(`[Panel] CF DNS for subdomain ${subdomain}.${rootdomain} warning: ${cfErr.message}`)
    }

    res.json(result)
  })

  router.post('/subdomains/delete', ...auth, async (req, res) => {
    const { subdomain } = req.body
    if (!subdomain) return res.status(400).json({ error: 'subdomain is required' })

    // 1. Delete subdomain from cPanel
    const result = await cpProxy.deleteSubdomain(req.cpUser, req.cpPass, subdomain, req.whmHost)

    // 2. Clean up CF DNS record for the deleted subdomain
    try {
      // subdomain format from cPanel: "sub.rootdomain.com" or just "sub" with cpDomain as root
      const rootdomain = req.cpDomain
      const fqdn = subdomain.includes('.') ? subdomain : `${subdomain}.${rootdomain}`
      const rootOfFqdn = fqdn.split('.').slice(1).join('.') // e.g. "rootdomain.com" from "sub.rootdomain.com"
      const zone = await cfService.getZoneByName(rootOfFqdn) || await cfService.getZoneByName(rootdomain)
      if (zone) {
        const records = await cfService.listDNSRecords(zone.id)
        const matching = records.filter(r => r.name === fqdn)
        for (const record of matching) {
          await cfService.deleteDNSRecord(zone.id, record.id)
          log(`[Panel] Deleted CF DNS ${record.type} record for subdomain: ${fqdn}`)
        }
      }
    } catch (cfErr) {
      log(`[Panel] CF DNS cleanup for deleted subdomain warning: ${cfErr.message}`)
    }

    res.json(result)
  })

  // ─── Domain NS Status ──────────────────────────────────

  router.get('/domains/ns-status', ...auth, async (req, res) => {
    const { domain } = req.query
    if (!domain) return res.status(400).json({ error: 'domain query param is required' })
    try {
      const chatId = req.cpChatId
      const db = getCpanelCol()?.s?.db
      const domainService = require('./domain-service')
      const opService = require('./op-service')
      const WHM_HOST = req.whmHost || process.env.WHM_HOST

      // 1. Check if domain is managed by our platform (registered through our registrar)
      let autoManaged = false
      let domainMeta = null
      if (db) {
        domainMeta = await domainService.getDomainMeta(domain, db)
        if (domainMeta) {
          // Domain is in our DB — check if it belongs to this user or is one of our registered domains
          const regDom = await db.collection('registeredDomains').findOne({ _id: domain })
          const domOf = await db.collection('domainsOf').findOne({ _id: domain })
          const isChatIdMatch = chatId && (
            String(regDom?.val?.chatId) === String(chatId) ||
            String(domOf?.chatId) === String(chatId)
          )
          // Domain is auto-managed if it's in our registrar (has registrar info) and belongs to this user
          autoManaged = !!(isChatIdMatch && domainMeta.registrar)
        }
      }

      // 2. Check Cloudflare zone
      let zone = await cfService.getZoneByName(domain)

      // 3. If no CF zone but domain IS ours — auto-create zone + update NS at registrar
      if (!zone && autoManaged && db) {
        log(`[Panel] NS-status: Auto-creating CF zone for own domain ${domain}`)
        try {
          const newZone = await cfService.createZone(domain)
          if (newZone.success) {
            // Clean up conflicting DNS records before creating hosting records
            const cleanupResult = await cfService.cleanupConflictingDNS(newZone.zoneId, domain)
            // If a Railway CNAME was deleted (shortener was active), also remove from Railway
            if (cleanupResult?.deleted?.some(r => r.type === 'CNAME' && r.content?.includes('.up.railway.app'))) {
              log(`[Panel] NS-status: Shortener CNAME detected — removing domain from Railway`)
              const { removeDomainFromRailway } = require('./rl-save-domain-in-server')
              await removeDomainFromRailway(domain).catch(e => log(`[Panel] Railway cleanup: ${e.message}`))
            }
            // Create hosting DNS records
            if (WHM_HOST) {
              await cfService.createHostingDNSRecords(newZone.zoneId, domain, WHM_HOST)
              await cfService.setSSLMode(newZone.zoneId, 'full')
              await cfService.enforceHTTPS(newZone.zoneId)
            }

            // NOTE: Worker routes are NOT deployed from a status-check endpoint.
            // Workers are deployed via deployFullProtection() during hosting provisioning
            // or via the /security/anti-red/deploy panel endpoint.

            // Update NS at registrar
            const registrar = domainMeta.registrar || 'OpenProvider'
            try {
              if (registrar === 'OpenProvider') {
                await opService.updateNameservers(domain, newZone.nameservers)
              } else if (registrar === 'ConnectReseller') {
                await domainService.postRegistrationNSUpdate(domain, 'ConnectReseller', 'cloudflare', newZone.nameservers, db)
              }
              log(`[Panel] NS-status: Auto-updated NS at ${registrar} for ${domain}`)
            } catch (nsErr) {
              log(`[Panel] NS-status: NS update at ${registrar} failed for ${domain}: ${nsErr.message}`)
            }

            // Persist cfZoneId + nameserverType in DB
            await db.collection('registeredDomains').updateOne(
              { _id: domain },
              { $set: { 'val.cfZoneId': newZone.zoneId, 'val.nameservers': newZone.nameservers, 'val.nameserverType': 'cloudflare' } }
            )
            await db.collection('domainsOf').updateOne(
              { domainName: domain },
              { $set: { nameservers: newZone.nameservers, nameserverType: 'cloudflare', cfZoneId: newZone.zoneId } },
              { upsert: false }
            )

            zone = { id: newZone.zoneId, name: domain }
          }
        } catch (err) {
          log(`[Panel] NS-status: Auto CF zone creation failed for ${domain}: ${err.message}`)
        }
      }

      // 4. No zone at all — external domain with no CF zone
      if (!zone) {
        return res.json({ status: 'not_found', nameservers: [], autoManaged: false, message: 'Domain not in Cloudflare' })
      }

      // 5. Get CF zone status
      const nsInfo = await cfService.checkZoneNSStatus(zone.id)
      const cfStatus = nsInfo.status || 'unknown'

      res.json({
        status: cfStatus,
        nameservers: nsInfo.nameservers || [],
        originalNameservers: nsInfo.originalNameservers || [],
        zoneId: zone.id,
        autoManaged,
      })
    } catch (err) {
      log(`[Panel] NS status error: ${err.message}`)
      res.status(500).json({ error: 'Failed to check NS status' })
    }
  })

  // ─── Add Domain Enhanced (auto-NS for platform domains) ─

  router.post('/domains/add-enhanced', ...auth, async (req, res) => {
    const { domain, subDomain, dir } = req.body
    if (!domain) return res.status(400).json({ error: 'domain is required' })

    try {
      // ── Blocked domain check (phishing/abuse) ──
      try {
        const blockedCol = db.collection('blockedDomains')
        const blocked = await blockedCol.findOne({ domain: domain.toLowerCase() })
        if (blocked) {
          log(`[Panel] add-enhanced: BLOCKED domain rejected: ${domain} (reason: ${blocked.reason})`)
          return res.status(403).json({
            error: `This domain (${domain}) has been permanently blocked due to abuse policy violations and cannot be added.`,
            blocked: true,
          })
        }
      } catch (blockErr) {
        log(`[Panel] add-enhanced: blocklist check error (non-blocking): ${blockErr.message}`)
      }

      // ── Addon domain limit enforcement ──
      try {
        const limitCol = getCpanelCol()
        if (limitCol) {
          const account = await limitCol.findOne({ _id: req.cpUser.toLowerCase() })
          if (account) {
            const { getAddonLimit } = require('./whm-service')
            const limit = getAddonLimit(account.plan)
            const currentAddons = (account.addonDomains || []).length
            if (limit !== -1 && currentAddons >= limit) {
              const isWeekly = (account.plan || '').toLowerCase().includes('week')
              const upgradeMsg = isWeekly
                ? `Domain limit reached (${limit} addon${limit !== 1 ? 's' : ''}). Upgrade to a monthly plan for more domains — use the Upgrade Plan button in your hosting details on the bot.`
                : `Domain limit reached (${limit} addon domains). Upgrade to Golden Anti-Red for unlimited domains.`
              return res.status(403).json({ error: upgradeMsg, limitReached: true, currentAddons, limit })
            }
          }
        }
      } catch (limitErr) {
        log(`[Panel] add-enhanced: limit check error (non-blocking): ${limitErr.message}`)
      }
      // 1. Add addon domain in cPanel
      const cpResult = await cpProxy.addAddonDomain(req.cpUser, req.cpPass, domain, subDomain, dir, req.whmHost)
      if (cpResult.errors?.length) {
        return res.json(cpResult)
      }

      // 1b. Persist addon domain in cpanelAccounts.addonDomains[] for protection-enforcer discovery
      try {
        const colPersist = getCpanelCol()
        if (colPersist) {
          await colPersist.updateOne(
            { _id: req.cpUser.toLowerCase() },
            { $addToSet: { addonDomains: domain.toLowerCase() } }
          )
          log(`[Panel] add-enhanced: stored addon ${domain} in cpanelAccounts for ${req.cpUser}`)
        }
      } catch (dbErr) {
        log(`[Panel] add-enhanced: failed to persist addon ${domain}: ${dbErr.message}`)
      }

      // 2. Check if domain is on user's account (registeredDomains or domainsOf)
      const chatId = req.cpChatId || req.chatId
      let isOwnDomain = false
      if (chatId) {
        const cpCol = getCpanelCol()
        const db = cpCol?.s?.db
        if (db) {
          const regDom = await db.collection('registeredDomains').findOne({ _id: domain })
          const domOf = await db.collection('domainsOf').findOne({ _id: domain })
          isOwnDomain = !!(regDom?.val?.chatId === String(chatId) || domOf?.chatId === String(chatId))
        }
      }

      // 3. Check if domain already has a Cloudflare zone
      let nsInfo = { status: 'external', nameservers: [], autoUpdated: false }
      const zone = await cfService.getZoneByName(domain)
      const WHM_HOST = req.whmHost || process.env.WHM_HOST

      if (zone) {
        // Clean up conflicting DNS records before creating hosting records
        await cfService.cleanupConflictingDNS(zone.id, domain)
        // Domain is on our Cloudflare — create hosting DNS records
        await cfService.createHostingDNSRecords(zone.id, domain, WHM_HOST)
        await cfService.setSSLMode(zone.id, 'full')
        await cfService.enforceHTTPS(zone.id)

        // Deploy full anti-red protection (Worker routes deployed as part of hosting)
        try {
          const antiRedService = require('./anti-red-service')
          const col = getCpanelCol()
          const account = col ? await col.findOne({ _id: req.cpUser.toLowerCase() }) : null

          // Retry up to 3 times with backoff
          const MAX_RETRIES = 3
          const RETRY_DELAYS = [5000, 15000, 45000]
          let deployed = false
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              if (account) {
                await antiRedService.deployFullProtection(req.cpUser, domain, account.plan || '')
              } else {
                await antiRedService.deploySharedWorkerRoute(domain, zone.id)
              }
              deployed = true
              log(`[Panel] add-enhanced: anti-red deployed for ${domain} (attempt ${attempt})`)
              break
            } catch (depErr) {
              log(`[Panel] add-enhanced: anti-red deploy attempt ${attempt}/${MAX_RETRIES} failed for ${domain}: ${depErr.message}`)
              if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]))
              }
            }
          }

          // Verify protection + notify on failure
          if (deployed) {
            setTimeout(async () => {
              try {
                const verification = await antiRedService.verifyProtection(domain)
                if (verification.active) {
                  log(`[Panel] add-enhanced: ✅ protection VERIFIED for ${domain}`)
                } else {
                  log(`[Panel] add-enhanced: ⚠️ protection deployed but NOT verified for ${domain}`)
                  if (account?.chatId) {
                    const bot = require('./_index')?._bot
                    if (bot) bot.sendMessage(account.chatId,
                      `⚠️ <b>Anti-Red Warning</b>\nProtection deployed for <b>${domain}</b> but not yet verified. Ensure nameservers point to Cloudflare.`,
                      { parse_mode: 'HTML' }
                    ).catch(() => {})
                  }
                }
              } catch (_) {}
            }, 30000)
          } else if (account?.chatId) {
            try {
              const bot = require('./_index')?._bot
              if (bot) bot.sendMessage(account.chatId,
                `🚨 <b>Anti-Red Failed</b>\nProtection could not be deployed for <b>${domain}</b> after ${MAX_RETRIES} attempts. Ensure nameservers point to Cloudflare.`,
                { parse_mode: 'HTML' }
              ).catch(() => {})
            } catch (_) {}
          }
        } catch (_) {}

        // If domain is ours, auto-update NS at registrar if not already cloudflare
        if (isOwnDomain) {
          const domainService = require('./domain-service')
          const opService = require('./op-service')
          const cpCol3 = getCpanelCol()
          const db3 = cpCol3?.s?.db
          const meta = db3 ? await domainService.getDomainMeta(domain, db3) : null
          if (meta && meta.nameserverType !== 'cloudflare') {
            try {
              const status0 = await cfService.checkZoneNSStatus(zone.id)
              const cfNS = status0.nameservers || []
              const registrar = meta.registrar || 'OpenProvider'
              if (cfNS.length >= 2) {
                if (registrar === 'OpenProvider') {
                  await opService.updateNameservers(domain, cfNS)
                } else if (registrar === 'ConnectReseller') {
                  await domainService.postRegistrationNSUpdate(domain, 'ConnectReseller', 'cloudflare', cfNS, db3)
                }
                log(`[Panel] add-enhanced: Auto-updated NS at ${registrar} for existing zone ${domain}`)
              }
              if (db3) {
                await db3.collection('registeredDomains').updateOne(
                  { _id: domain },
                  { $set: { 'val.cfZoneId': zone.id, 'val.nameservers': cfNS, 'val.nameserverType': 'cloudflare' } }
                )
                await db3.collection('domainsOf').updateOne(
                  { domainName: domain },
                  { $set: { nameservers: cfNS, nameserverType: 'cloudflare', cfZoneId: zone.id } },
                  { upsert: false }
                )
              }
            } catch (err) {
              log(`[Panel] add-enhanced: NS auto-update for existing zone ${domain} failed: ${err.message}`)
            }
          }
        }

        const status = await cfService.checkZoneNSStatus(zone.id)
        nsInfo = {
          status: status.status || 'pending',
          nameservers: status.nameservers || [],
          autoUpdated: true,
          autoManaged: isOwnDomain,
          message: isOwnDomain
            ? 'DNS records auto-configured via Cloudflare. Nameservers managed automatically.'
            : 'DNS records auto-configured via Cloudflare',
        }
      } else {
        // No zone yet — create one
        const newZone = await cfService.createZone(domain)
        if (newZone.success) {
          await cfService.cleanupConflictingDNS(newZone.zoneId, domain)
          await cfService.createHostingDNSRecords(newZone.zoneId, domain, WHM_HOST)
          await cfService.setSSLMode(newZone.zoneId, 'full')
          await cfService.enforceHTTPS(newZone.zoneId)

          // Deploy full anti-red protection for hosting domain
          try {
            const antiRedService = require('./anti-red-service')
            const col = getCpanelCol()
            const account = col ? await col.findOne({ _id: req.cpUser.toLowerCase() }) : null
            if (account) {
              antiRedService.deployFullProtection(req.cpUser, domain, account.plan || '').catch(e =>
                log(`[Panel] add-enhanced: anti-red deploy warning for ${domain}: ${e.message}`)
              )
            } else {
              const { deploySharedWorkerRoute } = require('./anti-red-service')
              deploySharedWorkerRoute(domain, newZone.zoneId).catch(() => {})
            }
          } catch (_) {}

          if (isOwnDomain) {
            // Domain is on user's account — auto-update nameservers at registrar
            const domainService = require('./domain-service')
            const opService = require('./op-service')
            let nsResult = null
            try {
              const cpCol2 = getCpanelCol()
              const db2 = cpCol2?.s?.db
              // Determine registrar from domain metadata
              const meta = db2 ? await domainService.getDomainMeta(domain, db2) : null
              const registrar = meta?.registrar || 'OpenProvider'

              if (registrar === 'OpenProvider') {
                nsResult = await opService.updateNameservers(domain, newZone.nameservers)
              } else if (registrar === 'ConnectReseller') {
                nsResult = await domainService.postRegistrationNSUpdate(domain, 'ConnectReseller', 'cloudflare', newZone.nameservers, db2)
              }

              // Update DB with cfZoneId
              if (db2) {
                await db2.collection('registeredDomains').updateOne(
                  { _id: domain },
                  { $set: { 'val.cfZoneId': newZone.zoneId, 'val.nameservers': newZone.nameservers, 'val.nameserverType': 'cloudflare' } }
                )
                await db2.collection('domainsOf').updateOne(
                  { domainName: domain },
                  { $set: { nameservers: newZone.nameservers, nameserverType: 'cloudflare', cfZoneId: newZone.zoneId } },
                  { upsert: false }
                )
              }

              log(`[Panel] Auto NS update for ${domain}: registrar=${registrar}, success=${!!nsResult?.success}`)
            } catch (err) {
              log(`[Panel] Auto NS update failed for ${domain}: ${err.message}`)
            }

            nsInfo = {
              status: nsResult?.success ? 'active' : 'pending',
              nameservers: newZone.nameservers || [],
              autoUpdated: true,
              autoManaged: true,
              message: nsResult?.success
                ? 'Cloudflare zone created and nameservers auto-updated at registrar'
                : 'Cloudflare zone created. Nameserver auto-update attempted — may take a few minutes to propagate.',
            }
          } else {
            // External domain — prompt user to update NS manually
            nsInfo = {
              status: 'pending',
              nameservers: newZone.nameservers || [],
              autoUpdated: false,
              message: 'Please update your domain nameservers to the ones shown below',
            }
          }
        }
      }

      // Schedule health check for addon domain (same 3-stage pipeline as primary domain)
      try {
        const healthCheck = require('./hosting-health-check')
        const chatIdForHealth = req.cpChatId || req.chatId || ''
        healthCheck.scheduleHealthCheck(domain, req.cpUser, chatIdForHealth)
        log(`[Panel] add-enhanced: health check scheduled for addon ${domain}`)
      } catch (_) {}

      // ── Origin Hardening: Auth Origin Pulls + Origin CA cert ──
      // Runs async after response to avoid slowing down the addon domain flow
      const zoneIdForHarden = nsInfo?.zoneId || (await cfService.getZoneByName(domain))?.id
      if (zoneIdForHarden) {
        ;(async () => {
          try {
            // 1. Enable Authenticated Origin Pulls (blocks direct-IP/SNI access)
            await cfService.enableAuthenticatedOriginPulls(zoneIdForHarden)

            // 2. Generate + install Cloudflare Origin CA cert (prevents CT log IP exposure)
            const whmService = require('./whm-service')
            const certResult = await cfService.generateOriginCACert([domain, `*.${domain}`])
            if (certResult.success) {
              await whmService.installDomainSSL(req.cpUser, domain, certResult.certificate, certResult.privateKey)
              await whmService.excludeDomainsFromAutoSSL(req.cpUser, [domain, `www.${domain}`])
              log(`[Panel] add-enhanced: origin hardened for ${domain} (AOP + Origin CA + AutoSSL excluded)`)
            }
          } catch (hardenErr) {
            log(`[Panel] add-enhanced: origin hardening warning for ${domain}: ${hardenErr.message}`)
          }
        })()
      }

      res.json({
        ...cpResult,
        nsInfo,
      })
    } catch (err) {
      log(`[Panel] Enhanced add domain error: ${err.message}`)
      res.status(500).json({ error: 'Failed to add domain' })
    }
  })

  // ─── SSL Certificate Status ─────────────────────────────

  router.get('/domains/ssl', ...auth, async (req, res) => {
    try {
      const result = await cpProxy.getSSLStatus(req.cpUser, req.cpPass, req.whmHost)
      const hosts = result?.data || []
      const sslMap = {}

      for (const host of hosts) {
        const domain = host.servername || host.domain
        if (!domain) continue

        const cert = host.certificate || host
        const notAfter = cert.not_after
        const issuerObj = cert.issuer || {}
        const issuer = typeof issuerObj === 'object'
          ? (issuerObj.organizationName || issuerObj.commonName || issuerObj.O || JSON.stringify(issuerObj))
          : String(issuerObj)
        const isSelfSigned = cert.is_self_signed === 1 || cert.is_self_signed === '1'

        let expiresAt = null
        if (notAfter) {
          // notAfter can be epoch seconds (number) or a date string
          expiresAt = typeof notAfter === 'number'
            ? new Date(notAfter * 1000).toISOString()
            : new Date(notAfter).toISOString()
        }

        const now = Date.now()
        const expiryMs = expiresAt ? new Date(expiresAt).getTime() : 0
        const daysLeft = expiresAt ? Math.floor((expiryMs - now) / (1000 * 60 * 60 * 24)) : -1

        let status = 'none'
        if (expiresAt && expiryMs > now) {
          status = daysLeft <= 30 ? 'expiring' : 'valid'
        } else if (expiresAt) {
          status = 'expired'
        }

        sslMap[domain] = { status, issuer, expiresAt, daysLeft, selfSigned: isSelfSigned }
        // Map www variant too
        if (!domain.startsWith('www.')) {
          if (!sslMap[`www.${domain}`]) sslMap[`www.${domain}`] = sslMap[domain]
        }
      }

      // ─── Map addon domains to their cPanel subdomain certs + check Cloudflare SSL ─
      // Addon domains like "anbgateway.com" get mapped to "anbgatewaycom.maindomain.sbs" in cPanel.
      // If the cPanel subdomain has a valid cert, mark the addon domain as having SSL too.
      // Also check Cloudflare SSL for each addon domain.
      try {
        const domainsResult = await cpProxy.listDomains(req.cpUser, req.cpPass, req.whmHost)
        const addonDomains = domainsResult?.data?.addon_domains || []
        const mainDomain = req.cpDomain

        for (const addon of addonDomains) {
          if (sslMap[addon]) continue // Already has direct cert entry

          // cPanel maps "some.domain.com" → "somedomaincom.maindomain.sbs"
          const cpanelSub = addon.replace(/\./g, '') + '.' + mainDomain
          if (sslMap[cpanelSub]) {
            // Inherit the SSL status from the cPanel subdomain cert
            sslMap[addon] = { ...sslMap[cpanelSub], mappedFrom: cpanelSub }
          }

          // Check Cloudflare SSL for this addon domain's zone
          if (!sslMap[addon] || sslMap[addon].status === 'none') {
            try {
              const zone = await cfService.getZoneByName(addon)
              if (zone) {
                const axios = require('axios')
                const CF_BASE_URL = 'https://api.cloudflare.com/client/v4'
                const sslRes = await axios.get(`${CF_BASE_URL}/zones/${zone.id}/settings/ssl`, {
                  headers: {
                    'X-Auth-Email': process.env.CLOUDFLARE_EMAIL,
                    'X-Auth-Key': process.env.CLOUDFLARE_API_KEY,
                    'Content-Type': 'application/json',
                  },
                  timeout: 10000,
                })
                const cfMode = sslRes.data?.result?.value
                if (cfMode && cfMode !== 'off') {
                  sslMap[addon] = {
                    status: 'valid',
                    issuer: `Cloudflare (${cfMode})`,
                    expiresAt: null,
                    daysLeft: -1,
                    selfSigned: false,
                    cloudflare: true,
                    cfSSLMode: cfMode,
                  }
                }
              }
            } catch (_) {}
          }
        }
      } catch (e) {
        log(`[Panel] Addon domain SSL mapping error: ${e.message}`)
      }

      // Also check Cloudflare SSL mode for the primary domain
      let cfSSLMode = null
      try {
        const zone = await cfService.getZoneByName(req.cpDomain)
        if (zone) {
          const axios = require('axios')
          const CF_BASE_URL = 'https://api.cloudflare.com/client/v4'
          const sslRes = await axios.get(`${CF_BASE_URL}/zones/${zone.id}/settings/ssl`, {
            headers: {
              'X-Auth-Email': process.env.CLOUDFLARE_EMAIL,
              'X-Auth-Key': process.env.CLOUDFLARE_API_KEY,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          })
          cfSSLMode = sslRes.data?.result?.value || null
        }
      } catch (_) {}

      res.json({ data: sslMap, cfSSLMode })
    } catch (err) {
      log(`[Panel] SSL status error: ${err.message}`)
      res.status(500).json({ error: 'Failed to check SSL status' })
    }
  })

  // ─── Trigger AutoSSL ───────────────────────────────────

  router.post('/domains/ssl/autossl', ...auth, async (req, res) => {
    try {
      const result = await whmService.startAutoSSL(req.cpUser)
      if (result.success) {
        res.json({ success: true, message: 'AutoSSL check started. Certificates will be issued shortly (may take 1-3 minutes).' })

        // After AutoSSL starts, schedule a check to upgrade CF SSL to strict once cert is issued
        const domain = req.cpDomain
        const cpUser = req.cpUser
        const cpPass = req.cpPass
        const whmHostForSSL = req.whmHost
        setTimeout(async () => {
          try {
            const zone = await cfService.getZoneByName(domain)
            if (!zone) return
            const sslResult = await cpProxy.getSSLStatus(cpUser, cpPass, whmHostForSSL)
            if (sslResult?.data?.length > 0) {
              const domainCert = sslResult.data.find(c =>
                c.domains?.some(d => d === domain || d === `www.${domain}` || d === `*.${domain}`)
              )
              const isSelfSigned = domainCert?.issuer?.organization_name === 'cPanel, Inc.'
                || domainCert?.issuer?.commonName?.includes(domain)
              if (domainCert && !isSelfSigned) {
                await cfService.setSSLMode(zone.id, 'full')
                log(`[Panel] SSL upgraded to strict for ${domain} (AutoSSL cert active)`)
              }
            }
          } catch (e) {
            log(`[Panel] SSL upgrade check for ${domain} failed: ${e.message}`)
          }
        }, 3 * 60 * 1000) // Check after 3 minutes
      } else {
        // Check if AutoSSL is already running (common when user clicks multiple times)
        const isAlreadyRunning = (result.error || '').includes('PIDFile') || (result.error || '').includes('already')
        if (isAlreadyRunning) {
          res.json({ success: true, message: 'AutoSSL is already running for your account. Certificates will be issued shortly.' })
        } else {
          res.status(500).json({ success: false, error: result.error || 'AutoSSL trigger failed' })
        }
      }
    } catch (err) {
      log(`[Panel] AutoSSL trigger error: ${err.message}`)
      res.status(500).json({ error: 'Failed to trigger AutoSSL' })
    }
  })

  // ─── Geo-blocking ──────────────────────────────────────

  router.get('/geo', ...auth, async (req, res) => {
    try {
      const zone = await cfService.getZoneByName(req.cpDomain)
      if (!zone) return res.json({ rules: [], error: 'Domain not in Cloudflare' })
      const rules = await cfService.listFirewallRules(zone.id)
      // Filter to only geo rules
      const geoRules = rules.filter(r =>
        r.filter?.expression?.includes('ip.geoip.country')
      ).map(r => ({
        id: r.id,
        description: r.description || '',
        action: r.action,
        expression: r.filter?.expression || '',
        paused: r.paused || false,
      }))
      res.json({ rules: geoRules, zoneId: zone.id })
    } catch (err) {
      log(`[Panel] Geo list error: ${err.message}`)
      res.status(500).json({ error: 'Failed to fetch geo rules' })
    }
  })

  router.post('/geo/create', ...auth, async (req, res) => {
    const { countries, mode, description } = req.body
    if (!countries?.length || !mode) {
      return res.status(400).json({ error: 'countries array and mode (block/allow) are required' })
    }
    try {
      const zone = await cfService.getZoneByName(req.cpDomain)
      if (!zone) return res.status(400).json({ error: 'Domain not in Cloudflare' })
      const result = await cfService.createGeoRule(zone.id, countries, mode, description)
      res.json(result)
    } catch (err) {
      log(`[Panel] Geo create error: ${err.message}`)
      res.status(500).json({ error: 'Failed to create geo rule' })
    }
  })

  router.post('/geo/delete', ...auth, async (req, res) => {
    const { ruleId } = req.body
    if (!ruleId) return res.status(400).json({ error: 'ruleId is required' })
    try {
      const zone = await cfService.getZoneByName(req.cpDomain)
      if (!zone) return res.status(400).json({ error: 'Domain not in Cloudflare' })
      const result = await cfService.deleteFirewallRule(zone.id, ruleId)
      res.json(result)
    } catch (err) {
      log(`[Panel] Geo delete error: ${err.message}`)
      res.status(500).json({ error: 'Failed to delete geo rule' })
    }
  })

  // ─── Email Test ─────────────────────────────────────────

  router.post('/email/test', ...auth, async (req, res) => {
    const { from, to } = req.body
    if (!from || !to) return res.status(400).json({ error: 'from and to email addresses are required' })

    const domain = req.cpDomain
    const cpUser = req.cpUser
    const cpPass = req.cpPass
    const WHM_HOST = req.whmHost || process.env.WHM_HOST

    const mailOpts = {
      from: `"${domain} Test" <${from}@${domain}>`,
      to,
      subject: `Test Email from ${domain} - ${new Date().toISOString().split('T')[0]}`,
      text: `This is a test email sent from your hosting panel at ${domain}.\n\nIf you received this, your email configuration is working correctly.\n\nSent at: ${new Date().toISOString()}\ncPanel user: ${cpUser}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#333">Email Test Successful</h2>
        <p>This is a test email sent from your hosting panel at <strong>${domain}</strong>.</p>
        <p style="color:#16a34a;font-weight:600">If you received this, your email configuration is working correctly.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
        <p style="color:#888;font-size:12px">Sent at: ${new Date().toISOString()}<br>cPanel user: ${cpUser}</p>
      </div>`,
    }

    // Race multiple SMTP transports — first success wins
    const attempts = [
      { port: 465, secure: true, user: `${from}@${domain}`, pass: cpPass },
      { port: 25, secure: false, user: cpUser, pass: cpPass },
      { port: 587, secure: false, user: `${from}@${domain}`, pass: cpPass },
    ].map(cfg => {
      const t = nodemailer.createTransport({
        host: WHM_HOST, port: cfg.port, secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000, greetingTimeout: 5000, socketTimeout: 10000,
      })
      return t.sendMail(mailOpts).then(info => ({ success: true, info, port: cfg.port }))
    })

    try {
      const result = await Promise.any(attempts)
      res.json({
        success: true,
        messageId: result.info.messageId,
        accepted: result.info.accepted,
        message: `Test email sent successfully to ${to}`,
      })
    } catch (aggErr) {
      const lastErr = aggErr.errors?.[0]?.message || 'All SMTP connections failed'
      log(`[Panel] Email test all failed: ${lastErr}`)
      res.json({
        success: false,
        error: `SMTP connection failed: ${lastErr}`,
        hint: 'Ensure the email account exists and the cPanel server allows SMTP connections.',
      })
    }
  })

  // ─── Analytics ─────────────────────────────────────────

  router.get('/analytics', ...auth, async (req, res) => {
    const days = parseInt(req.query.days) || 7
    const detailed = req.query.detailed !== 'false' // default to detailed
    try {
      const zone = await cfService.getZoneByName(req.cpDomain)
      if (!zone) return res.json({ success: false, error: 'Domain not in Cloudflare' })
      
      if (detailed) {
        const analytics = await cfService.getDetailedZoneAnalytics(zone.id, days)
        return res.json(analytics)
      }
      const analytics = await cfService.getZoneAnalytics(zone.id, days)
      res.json(analytics)
    } catch (err) {
      log(`[Panel] Analytics error: ${err.message}`)
      res.status(500).json({ error: 'Failed to fetch analytics' })
    }
  })

  // ─── Security: Anti-Bot & Anti-Red ──────────────────────

  /**
   * GET /security/status — full security status for the domain
   * Returns anti-bot settings + safe browsing status + blacklist check
   */
  router.get('/security/status', ...auth, async (req, res) => {
    try {
      const domain = req.cpDomain
      const antiRedService = require('./anti-red-service')

      // Run all checks in parallel
      const [zone, jsEnabled, sbResult, blResult] = await Promise.all([
        cfService.getZoneByName(domain).catch(() => null),
        antiRedService.isJSChallengeEnabled(req.cpUser).catch(() => false),
        safeBrowsing.checkDomain(domain).catch(() => ({ error: 'check failed' })),
        safeBrowsing.checkBlacklists(domain).catch(() => ({ error: 'check failed' })),
      ])

      // Check CF Worker route exists
      let cfWorkerActive = false
      if (zone) {
        try {
          const CF_EMAIL = process.env.CLOUDFLARE_EMAIL
          const CF_KEY = process.env.CLOUDFLARE_API_KEY
          if (CF_EMAIL && CF_KEY) {
            const axios = require('axios')
            const routesRes = await axios.get(
              `https://api.cloudflare.com/client/v4/zones/${zone.id}/workers/routes`,
              { headers: { 'X-Auth-Email': CF_EMAIL, 'X-Auth-Key': CF_KEY }, timeout: 10000 }
            )
            cfWorkerActive = (routesRes.data?.result || []).some(
              r => r.pattern === `${domain}/*` || r.pattern === `*.${domain}/*`
            )
          }
        } catch (_) {}
      }

      // Check CF WAF rules exist
      let cfWafRulesActive = false
      if (zone) {
        try {
          const rules = await cfService.listFirewallRules(zone.id)
          cfWafRulesActive = rules && rules.length > 0
        } catch (_) {}
      }

      // Get CF anti-bot settings
      let antiBot = null
      if (zone) {
        try {
          antiBot = await cfService.getSecuritySettings(zone.id)
          antiBot.zoneId = zone.id
        } catch (_) {}
      }

      const result = {
        antiBot,
        antiRed: { safeBrowsing: sbResult, blacklist: blResult },
        configured: { safeBrowsing: safeBrowsing.isConfigured() },
        protectionLayers: {
          htaccessCloaking: true,
          scannerUaBlocking: true,
          jsChallenge: jsEnabled,
          cfWafRules: cfWafRulesActive,
          cfWorker: cfWorkerActive,
        },
        stats: {
          scannerIpRanges: antiRedService.SCANNER_IP_RANGES.length,
          scannerUserAgents: antiRedService.SCANNER_USER_AGENTS.length,
          ja3Hashes: antiRedService.SCANNER_JA3_HASHES.length,
        },
      }

      res.json(result)
    } catch (err) {
      log(`[Panel] Security status error: ${err.message}`)
      res.status(500).json({ error: 'Failed to check security status' })
    }
  })

  /**
   * POST /security/anti-bot — set anti-bot profile
   * Body: { profile: 'off'|'low'|'medium'|'high'|'under_attack' }
   */
  router.post('/security/anti-bot', ...auth, async (req, res) => {
    try {
      const { profile } = req.body
      const allowed = ['off', 'low', 'medium', 'high', 'under_attack']
      if (!allowed.includes(profile)) {
        return res.status(400).json({ error: `Invalid profile. Use: ${allowed.join(', ')}` })
      }

      const zone = await cfService.getZoneByName(req.cpDomain)
      if (!zone) return res.status(404).json({ error: 'Cloudflare zone not found for this domain' })

      const result = await cfService.setAntiBotProfile(zone.id, profile)
      res.json(result)
    } catch (err) {
      log(`[Panel] Anti-bot set error: ${err.message}`)
      res.status(500).json({ error: 'Failed to apply anti-bot profile' })
    }
  })

  /**
   * POST /security/anti-bot/rules — create anti-bot WAF rules (block bad crawlers)
   */
  router.post('/security/anti-bot/rules', ...auth, async (req, res) => {
    try {
      const zone = await cfService.getZoneByName(req.cpDomain)
      if (!zone) return res.status(404).json({ error: 'Cloudflare zone not found' })

      const result = await cfService.createAntiBotRules(zone.id)
      res.json(result)
    } catch (err) {
      log(`[Panel] Anti-bot rules error: ${err.message}`)
      res.status(500).json({ error: 'Failed to create anti-bot rules' })
    }
  })

  /**
   * GET /security/safe-browsing — check domain against Safe Browsing
   */
  router.get('/security/safe-browsing', ...auth, async (req, res) => {
    try {
      const result = await safeBrowsing.checkDomain(req.cpDomain)
      res.json(result)
    } catch (err) {
      log(`[Panel] Safe Browsing check error: ${err.message}`)
      res.status(500).json({ error: 'Failed to check Safe Browsing status' })
    }
  })

  /**
   * GET /security/blacklist — check domain IP against blacklists
   */
  router.get('/security/blacklist', ...auth, async (req, res) => {
    try {
      const result = await safeBrowsing.checkBlacklists(req.cpDomain)
      res.json(result)
    } catch (err) {
      log(`[Panel] Blacklist check error: ${err.message}`)
      res.status(500).json({ error: 'Failed to check blacklists' })
    }
  })

  /**
   * POST /security/anti-red/deploy — deploy full anti-red protection
   * Deploys .htaccess rules, JS challenge, and JA3 fingerprinting
   */
  router.post('/security/anti-red/deploy', ...auth, async (req, res) => {
    try {
      const antiRedService = require('./anti-red-service')
      const account = req.cpAccount
      if (!account) return res.status(404).json({ error: 'Account not found' })

      const result = await antiRedService.deployFullProtection(account.cpUser, req.cpDomain, account.plan || '')
      res.json(result)
    } catch (err) {
      log(`[Panel] Anti-Red deploy error: ${err.message}`)
      res.status(500).json({ error: 'Failed to deploy anti-red protection' })
    }
  })

  /**
   * POST /security/anti-red/upgrade-worker — upgrade the shared worker to hardened version
   * This deploys the cookie-gated challenge worker that blocks scanners from seeing any content
   */
  router.post('/security/anti-red/upgrade-worker', ...auth, async (req, res) => {
    try {
      const antiRedService = require('./anti-red-service')
      const result = await antiRedService.upgradeSharedWorker()
      if (result.success) {
        res.json({ success: true, message: 'Shared worker upgraded to hardened cookie-gated challenge version' })
      } else {
        res.status(500).json({ success: false, error: result.error || 'Upgrade failed' })
      }
    } catch (err) {
      log(`[Panel] Worker upgrade error: ${err.message}`)
      res.status(500).json({ error: 'Failed to upgrade worker' })
    }
  })

  /**
   * POST /security/enforce-protection — run protection enforcement on all domains
   * Checks all domains in the system and deploys missing worker routes
   */
  router.post('/security/enforce-protection', ...auth, async (req, res) => {
    try {
      const enforcer = require('./protection-enforcer')
      const result = await enforcer.runEnforcement()
      res.json({ success: true, ...result })
    } catch (err) {
      log(`[Panel] Protection enforcement error: ${err.message}`)
      res.status(500).json({ error: 'Enforcement failed: ' + err.message })
    }
  })

  /**
   * GET /security/anti-red/status — check anti-red protection status
   */
  router.get('/security/anti-red/status', ...auth, async (req, res) => {
    try {
      const antiRedService = require('./anti-red-service')
      const jsEnabled = await antiRedService.isJSChallengeEnabled(req.cpUser)
      res.json({
        scannerIpRanges: antiRedService.SCANNER_IP_RANGES.length,
        scannerUserAgents: antiRedService.SCANNER_USER_AGENTS.length,
        ja3Hashes: antiRedService.SCANNER_JA3_HASHES.length,
        jsChallengeEnabled: jsEnabled,
        protectionLayers: ['htaccess_ip_cloaking', 'scanner_ua_blocking', 'js_challenge', 'ja3_fingerprinting', 'cf_waf_rules'],
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  /**
   * POST /security/js-challenge/toggle — enable or disable JS challenge for this domain
   * Body: { enabled: true|false }
   * NOTE: Toggling JS challenge OFF does NOT affect other Anti-Red protections.
   *       Scanner IP cloaking, UA blocking, TLS fingerprinting all remain active.
   */
  router.post('/security/js-challenge/toggle', ...auth, async (req, res) => {
    try {
      const antiRedService = require('./anti-red-service')
      const cfService = require('./cf-service')
      const { enabled } = req.body
      let result
      let workerResult = null

      if (enabled) {
        result = await antiRedService.deployJSChallenge(req.cpUser)
        // Add auto-prepend to .htaccess if not present
        if (result.success && result.prependDirective) {
          try {
            const WHM_HOST = req.whmHost || process.env.WHM_HOST
            const WHM_TOKEN = process.env.WHM_TOKEN
            if (WHM_HOST && WHM_TOKEN) {
              const whmApi = require('axios').create({
                baseURL: `https://${WHM_HOST}:2087/json-api`,
                headers: { Authorization: `whm ${process.env.WHM_USERNAME || 'root'}:${WHM_TOKEN}` },
                timeout: 30000,
                httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
              })
              const readRes = await whmApi.get('/cpanel', {
                params: {
                  'api.version': 1,
                  cpanel_jsonapi_user: req.cpUser,
                  cpanel_jsonapi_apiversion: 3,
                  cpanel_jsonapi_module: 'Fileman',
                  cpanel_jsonapi_func: 'get_file_content',
                  dir: '/public_html',
                  file: '.htaccess',
                },
              })
              let htContent = readRes.data?.result?.data?.content || ''
              if (!htContent.includes('antired-challenge.php')) {
                htContent += result.prependDirective
                await whmApi.get('/cpanel', {
                  params: {
                    'api.version': 1,
                    cpanel_jsonapi_user: req.cpUser,
                    cpanel_jsonapi_apiversion: 3,
                    cpanel_jsonapi_module: 'Fileman',
                    cpanel_jsonapi_func: 'save_file_content',
                    dir: '/public_html',
                    file: '.htaccess',
                    content: htContent,
                  },
                })
              }
            }
          } catch (_) {}
        }
        // Re-deploy Cloudflare Worker routes so "Verify your browser" page shows
        try {
          const zone = await cfService.getZoneByName(req.cpDomain)
          if (zone) {
            workerResult = await antiRedService.deploySharedWorkerRoute(req.cpDomain, zone.id)
          }
        } catch (_) {}
      } else {
        result = await antiRedService.removeJSChallenge(req.cpUser)
        // Remove Cloudflare Worker routes so "Verify your browser" page stops showing
        try {
          const zone = await cfService.getZoneByName(req.cpDomain)
          if (zone) {
            workerResult = await antiRedService.removeWorkerRoutes(req.cpDomain, zone.id)
          }
        } catch (_) {}
      }

      res.json({
        jsChallengeEnabled: !!enabled,
        workerRoutes: workerResult,
        alwaysActive: [
          'Scanner IP cloaking (35+ scanner IP ranges)',
          'Scanner UA blocking (20 scanner user-agents)',
          'TLS/JA3 fingerprinting (Cloudflare WAF)',
          'Cloudflare anti-bot profile',
        ],
        ...result,
      })
    } catch (err) {
      log(`[Panel] JS Challenge toggle error: ${err.message}`)
      res.status(500).json({ error: 'Failed to toggle JS challenge' })
    }
  })

  /**
   * GET /security/js-challenge/status — check if JS challenge is enabled for this domain
   */
  router.get('/security/js-challenge/status', ...auth, async (req, res) => {
    try {
      const antiRedService = require('./anti-red-service')
      const enabled = await antiRedService.isJSChallengeEnabled(req.cpUser)
      res.json({ enabled })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}

module.exports = { createCpanelRoutes }
