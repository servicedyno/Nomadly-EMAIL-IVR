/* global process */
/**
 * Hosting Health Check Service
 * 
 * Automated post-setup health checks for hosting plans.
 * Runs 5 minutes after hosting plan activation to detect and auto-fix common issues:
 * 
 * 1. HTTP 500 from broken .htaccess (syntax errors, mod_remoteip in .htaccess, etc.)
 * 2. Blank pages from conflicting JS challenge + CF Worker + user anti-bot code
 * 3. User content uploaded outside public_html or in wrong folder
 * 4. CF IP not being restored (user's antibot blocking CF datacenter IPs)
 * 5. User's .htaccess with syntax errors (e.g. "deny from Amazon Technologies Inc")
 */

require('dotenv').config()
const axios = require('axios')
const https = require('https')
const { log } = require('console')

const WHM_HOST = process.env.WHM_HOST
const WHM_TOKEN = process.env.WHM_TOKEN
const RENDER_APP_IP = process.env.RENDER_APP_IP_ADDRESS || '216.24.57.1'
const TELEGRAM_DEV_CHAT_ID = process.env.TELEGRAM_DEV_CHAT_ID

const whmApi = WHM_HOST && WHM_TOKEN ? axios.create({
  baseURL: `https://${WHM_HOST}:2087/json-api`,
  headers: { Authorization: `whm root:${WHM_TOKEN}` },
  timeout: 30000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
}) : null

// Track scheduled health checks to avoid duplicates
const scheduledChecks = new Map()

/**
 * Schedule a health check to run after a delay (default: 5 minutes)
 */
function scheduleHealthCheck(domain, cpUsername, chatId, delayMs = 5 * 60 * 1000) {
  const key = `${domain}:${cpUsername}`
  
  // Cancel any existing scheduled check for this domain
  if (scheduledChecks.has(key)) {
    clearTimeout(scheduledChecks.get(key))
  }

  log(`[HealthCheck] Scheduled for ${domain} (${cpUsername}) in ${delayMs / 1000}s`)
  
  const timer = setTimeout(async () => {
    scheduledChecks.delete(key)
    try {
      const results = await runHealthCheck(domain, cpUsername)
      await reportResults(domain, cpUsername, chatId, results)
    } catch (err) {
      log(`[HealthCheck] Error running health check for ${domain}: ${err.message}`)
    }
  }, delayMs)

  scheduledChecks.set(key, timer)
}

/**
 * Run a comprehensive health check on a hosted domain
 */
async function runHealthCheck(domain, cpUsername) {
  const results = {
    timestamp: new Date().toISOString(),
    domain,
    cpUsername,
    checks: {},
    autoFixes: [],
    issues: [],
    warnings: [],
  }

  log(`[HealthCheck] Running health check for ${domain} (${cpUsername})...`)

  // ── Check 1: Direct origin access (root path) ──
  try {
    const originRoot = await httpCheck(domain, '/', WHM_HOST, {
      followRedirects: false,
    })
    results.checks.originRoot = originRoot
    log(`[HealthCheck] ${domain} origin root: HTTP ${originRoot.status}`)
  } catch (err) {
    results.checks.originRoot = { error: err.message }
  }

  // ── Check 2: Detect user content location ──
  try {
    const contentInfo = await detectUserContent(cpUsername)
    results.checks.contentLocation = contentInfo
    log(`[HealthCheck] ${domain} content: ${contentInfo.location || 'not found'}`)
  } catch (err) {
    results.checks.contentLocation = { error: err.message }
  }

  // ── Check 3: If root returned redirect, follow it ──
  const rootRedirect = results.checks.originRoot?.redirectUrl
  if (rootRedirect) {
    try {
      const redirectPath = new URL(rootRedirect, `https://${domain}`).pathname
      const originRedirect = await httpCheck(domain, redirectPath, WHM_HOST, {
        headers: { 'CF-Connecting-IP': '98.45.123.67' }, // Simulate real user IP
      })
      results.checks.originRedirectTarget = originRedirect
      log(`[HealthCheck] ${domain} redirect target (${redirectPath}): HTTP ${originRedirect.status}`)
    } catch (err) {
      results.checks.originRedirectTarget = { error: err.message }
    }
  }

  // ── Check 4: Check through Cloudflare ──
  try {
    const cfCheck = await httpCheck(domain, '/', null, {
      followRedirects: true,
    })
    results.checks.throughCF = cfCheck
    log(`[HealthCheck] ${domain} through CF: HTTP ${cfCheck.status}, size=${cfCheck.bodySize}`)
  } catch (err) {
    results.checks.throughCF = { error: err.message }
  }

  // ── Check 5: Verify .htaccess integrity ──
  try {
    const htaccessCheck = await checkHtaccessIntegrity(cpUsername)
    results.checks.htaccess = htaccessCheck
  } catch (err) {
    results.checks.htaccess = { error: err.message }
  }

  // ── Check 6: Verify prepend configuration ──
  try {
    const prependCheck = await checkPrependConfig(cpUsername)
    results.checks.prepend = prependCheck
  } catch (err) {
    results.checks.prepend = { error: err.message }
  }

  // ── Analysis & Auto-Fix Phase ──
  await analyzeAndFix(results)

  // ── Post-fix recheck if fixes were applied ──
  if (results.autoFixes.length > 0) {
    log(`[HealthCheck] ${results.autoFixes.length} auto-fixes applied, rechecking ${domain}...`)
    await sleep(5000) // Wait for changes to propagate

    try {
      const recheck = await httpCheck(domain, '/', WHM_HOST, {
        followRedirects: true,
        headers: { 'CF-Connecting-IP': '98.45.123.67' },
      })
      results.checks.postFixRecheck = recheck
      log(`[HealthCheck] ${domain} post-fix: HTTP ${recheck.status}`)
    } catch (err) {
      results.checks.postFixRecheck = { error: err.message }
    }
  }

  log(`[HealthCheck] Complete for ${domain}: ${results.issues.length} issues, ${results.autoFixes.length} fixes, ${results.warnings.length} warnings`)
  return results
}

/**
 * HTTP check helper — makes a request and returns status + metadata
 */
async function httpCheck(domain, path, directIP, options = {}) {
  const { followRedirects = false, headers = {} } = options
  const url = `https://${domain}${path}`

  const requestConfig = {
    url,
    method: 'GET',
    timeout: 15000,
    maxRedirects: followRedirects ? 5 : 0,
    validateStatus: () => true, // Accept all status codes
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...headers,
    },
  }

  // If directIP provided, resolve to that IP
  if (directIP) {
    requestConfig.httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      lookup: (hostname, opts, callback) => {
        callback(null, directIP, 4)
      },
    })
  }

  try {
    const response = await axios(requestConfig)
    const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '')

    return {
      status: response.status,
      bodySize: body.length,
      redirectUrl: response.headers?.location || null,
      hasAntiRedChallenge: body.includes('Anti-Red JS Challenge'),
      hasAccessDenied: body.includes('Access Denied') || body.includes('AR-'),
      has404Content: body.includes('404 Not Found') || body.includes('not be found'),
      has500Content: body.includes('Internal Server Error'),
      hasActualContent: body.length > 500 && !body.includes('404 Not Found') && !body.includes('Internal Server Error'),
      contentSnippet: body.substring(0, 200),
      xAntiRed: response.headers?.['x-antired'] || null,
    }
  } catch (err) {
    if (err.response) {
      return {
        status: err.response.status,
        error: err.message,
        redirectUrl: err.response.headers?.location || null,
      }
    }
    throw err
  }
}

/**
 * Detect where the user uploaded their content
 */
async function detectUserContent(cpUsername) {
  if (!whmApi) return { error: 'WHM not configured' }

  try {
    // List directories in public_html
    const dirRes = await whmApi.get('/cpanel', {
      params: {
        cpanel_jsonapi_user: cpUsername,
        cpanel_jsonapi_apiversion: 2,
        cpanel_jsonapi_module: 'Fileman',
        cpanel_jsonapi_func: 'listfiles',
        dir: `/home/${cpUsername}/public_html`,
        types: 'dir',
        showdotfiles: 0,
      },
    })
    const dirs = (dirRes.data?.cpanelresult?.data || []).map(d => d.file || d.name).filter(Boolean)

    // List files in public_html
    const fileRes = await whmApi.get('/cpanel', {
      params: {
        cpanel_jsonapi_user: cpUsername,
        cpanel_jsonapi_apiversion: 2,
        cpanel_jsonapi_module: 'Fileman',
        cpanel_jsonapi_func: 'listfiles',
        dir: `/home/${cpUsername}/public_html`,
        types: 'file',
        showdotfiles: 0,
      },
    })
    const files = (fileRes.data?.cpanelresult?.data || []).map(f => f.file || f.name).filter(Boolean)

    // Check for user content indicators
    const hasIndexPhp = files.includes('index.php')
    const hasIndexHtml = files.includes('index.html')
    const userDirs = dirs.filter(d => d !== 'cgi-bin')

    // Check subdirectories for content
    const contentDirs = []
    for (const dir of userDirs) {
      try {
        const subFileRes = await whmApi.get('/cpanel', {
          params: {
            cpanel_jsonapi_user: cpUsername,
            cpanel_jsonapi_apiversion: 2,
            cpanel_jsonapi_module: 'Fileman',
            cpanel_jsonapi_func: 'listfiles',
            dir: `/home/${cpUsername}/public_html/${dir}`,
            types: 'file',
            showdotfiles: 0,
          },
        })
        const subFiles = (subFileRes.data?.cpanelresult?.data || []).map(f => f.file || f.name).filter(Boolean)
        if (subFiles.includes('index.php') || subFiles.includes('index.html')) {
          contentDirs.push({ dir, hasIndex: true, fileCount: subFiles.length })
        } else if (subFiles.length > 0) {
          contentDirs.push({ dir, hasIndex: false, fileCount: subFiles.length })
        }
      } catch (_) {}
    }

    // Determine content location
    let location = 'public_html'
    let needsRedirect = false
    let redirectTarget = null

    if (!hasIndexPhp && !hasIndexHtml && contentDirs.length > 0) {
      // User uploaded content to a subdirectory, not public_html root
      const mainContent = contentDirs.find(d => d.hasIndex) || contentDirs[0]
      location = `public_html/${mainContent.dir}`
      needsRedirect = true
      redirectTarget = `/${mainContent.dir}/`
    } else if (hasIndexPhp || hasIndexHtml) {
      location = 'public_html'
    } else {
      location = 'empty'
    }

    return {
      location,
      rootFiles: files,
      rootDirs: dirs,
      contentDirs,
      hasIndexPhp,
      hasIndexHtml,
      needsRedirect,
      redirectTarget,
    }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Check .htaccess integrity — look for syntax errors
 */
async function checkHtaccessIntegrity(cpUsername) {
  if (!whmApi) return { error: 'WHM not configured' }

  const issues = []

  try {
    // Check root .htaccess
    const readRes = await whmApi.get('/cpanel', {
      params: {
        'api.version': 1,
        cpanel_jsonapi_user: cpUsername,
        cpanel_jsonapi_apiversion: 3,
        cpanel_jsonapi_module: 'Fileman',
        cpanel_jsonapi_func: 'get_file_content',
        dir: '/public_html',
        file: '.htaccess',
      },
    })
    const rootHtaccess = readRes.data?.result?.data?.content || ''

    // Check for common issues
    if (rootHtaccess.includes('&lt;') || rootHtaccess.includes('&gt;')) {
      issues.push({ file: '.htaccess', type: 'html_entities', desc: 'Contains HTML entities instead of < >' })
    }
    if (!rootHtaccess.includes('Anti-Red')) {
      issues.push({ file: '.htaccess', type: 'missing_antired', desc: 'Anti-Red rules not present' })
    }
    if (rootHtaccess.includes('RemoteIPHeader')) {
      issues.push({ file: '.htaccess', type: 'remoteip_in_htaccess', desc: 'mod_remoteip directives in .htaccess (causes 500)' })
    }

    return { issues, rootHtaccessLength: rootHtaccess.length }
  } catch (err) {
    return { error: err.message, issues }
  }
}

/**
 * Check if the prepend configuration is correct
 */
async function checkPrependConfig(cpUsername) {
  if (!whmApi) return { error: 'WHM not configured' }

  try {
    // Read .user.ini
    let userIniContent = ''
    try {
      const iniRes = await whmApi.get('/cpanel', {
        params: {
          'api.version': 1,
          cpanel_jsonapi_user: cpUsername,
          cpanel_jsonapi_apiversion: 3,
          cpanel_jsonapi_module: 'Fileman',
          cpanel_jsonapi_func: 'get_file_content',
          dir: '/public_html',
          file: '.user.ini',
        },
      })
      userIniContent = iniRes.data?.result?.data?.content || ''
    } catch (_) {}

    // Read .antired-challenge.php
    let challengeContent = ''
    try {
      const phpRes = await whmApi.get('/cpanel', {
        params: {
          'api.version': 1,
          cpanel_jsonapi_user: cpUsername,
          cpanel_jsonapi_apiversion: 3,
          cpanel_jsonapi_module: 'Fileman',
          cpanel_jsonapi_func: 'get_file_content',
          dir: '/public_html',
          file: '.antired-challenge.php',
        },
      })
      challengeContent = phpRes.data?.result?.data?.content || ''
    } catch (_) {}

    const hasJsChallenge = challengeContent.includes('JS Challenge') && challengeContent.includes('echo')
    const hasIPFix = challengeContent.includes('ANTIRED_IP_FIXED') || challengeContent.includes('CF_CONNECTING_IP')
    const hasPrepend = userIniContent.includes('auto_prepend_file')

    return {
      hasPrepend,
      hasJsChallenge,
      hasIPFix,
      type: hasIPFix ? 'ip_fix' : hasJsChallenge ? 'js_challenge' : hasPrepend ? 'unknown' : 'none',
    }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Analyze health check results and apply auto-fixes
 */
async function analyzeAndFix(results) {
  const { checks, autoFixes, issues, warnings } = results
  const { domain, cpUsername } = results

  // ── Issue: HTTP 500 from origin ──
  if (checks.originRoot?.status === 500) {
    issues.push('Origin returns HTTP 500 (Internal Server Error)')
    
    // Check if .htaccess has issues
    if (checks.htaccess?.issues?.length > 0) {
      for (const issue of checks.htaccess.issues) {
        if (issue.type === 'html_entities') {
          // .htaccess has HTML entities — redeploy
          try {
            const antiRedService = require('./anti-red-service')
            await antiRedService.deployHtaccess(cpUsername, domain)
            autoFixes.push('Redeployed .htaccess (HTML entity corruption detected)')
          } catch (err) {
            issues.push(`Failed to redeploy .htaccess: ${err.message}`)
          }
        }
        if (issue.type === 'remoteip_in_htaccess') {
          // mod_remoteip in .htaccess causes 500 — redeploy without it
          try {
            const antiRedService = require('./anti-red-service')
            await antiRedService.deployHtaccess(cpUsername, domain)
            autoFixes.push('Redeployed .htaccess (removed mod_remoteip directives)')
          } catch (err) {
            issues.push(`Failed to redeploy .htaccess: ${err.message}`)
          }
        }
      }
    } else {
      // 500 but no .htaccess issues detected — try redeploying anyway
      try {
        const antiRedService = require('./anti-red-service')
        await antiRedService.deployHtaccess(cpUsername, domain)
        autoFixes.push('Redeployed .htaccess (500 error, precautionary)')
      } catch (err) {
        issues.push(`Failed to redeploy .htaccess: ${err.message}`)
      }
    }
  }

  // ── Issue: JS challenge still active with CF Worker ──
  if (checks.prepend?.hasJsChallenge && checks.throughCF?.xAntiRed) {
    // CF Worker is active (x-antired header present) but JS challenge is still deployed
    try {
      const antiRedService = require('./anti-red-service')
      await antiRedService.deployCFIPFix(cpUsername)
      autoFixes.push('Replaced JS challenge with IP-fix prepend (CF Worker handles bot detection)')
    } catch (err) {
      issues.push(`Failed to deploy IP fix: ${err.message}`)
    }
  }

  // ── Issue: No IP fix for CF-proxied domain ──
  if (!checks.prepend?.hasIPFix && checks.throughCF?.xAntiRed) {
    // Domain is behind CF but no IP fix
    try {
      const antiRedService = require('./anti-red-service')
      await antiRedService.deployCFIPFix(cpUsername)
      autoFixes.push('Deployed CF IP-fix prepend (PHP sees real visitor IP)')
    } catch (err) {
      issues.push(`Failed to deploy IP fix: ${err.message}`)
    }
  }

  // ── Issue: Content in subdirectory without redirect ──
  if (checks.contentLocation?.needsRedirect) {
    const target = checks.contentLocation.redirectTarget
    try {
      await addRootRedirect(cpUsername, target)
      autoFixes.push(`Added root redirect to ${target} (user content in subdirectory)`)
    } catch (err) {
      issues.push(`Failed to add redirect: ${err.message}`)
    }
  }

  // ── Issue: Empty content ──
  if (checks.contentLocation?.location === 'empty') {
    warnings.push('No user content found in public_html — user needs to upload files via HostPanel')
  }

  // ── Warning: User has 404-returning antibot ──
  if (checks.originRedirectTarget?.has404Content && !checks.originRedirectTarget?.hasActualContent) {
    warnings.push('Origin returns 404 content — likely user\'s anti-bot code. IP fix should resolve for real visitors.')
  }

  // ── Warning: Through CF shows Access Denied ──
  if (checks.throughCF?.hasAccessDenied) {
    warnings.push('CF Worker showing Access Denied — may be too aggressive for some browsers')
  }
}

/**
 * Add a root redirect to the .htaccess when user content is in a subdirectory
 */
async function addRootRedirect(cpUsername, targetPath) {
  if (!whmApi) throw new Error('WHM not configured')

  // Read current .htaccess
  const readRes = await whmApi.get('/cpanel', {
    params: {
      'api.version': 1,
      cpanel_jsonapi_user: cpUsername,
      cpanel_jsonapi_apiversion: 3,
      cpanel_jsonapi_module: 'Fileman',
      cpanel_jsonapi_func: 'get_file_content',
      dir: '/public_html',
      file: '.htaccess',
    },
  })
  let content = readRes.data?.result?.data?.content || ''

  // Check if redirect already exists
  if (content.includes('Redirect root to website content') || content.includes(`RewriteRule ^$ ${targetPath}`)) {
    return // Already has redirect
  }

  // Add redirect after RewriteEngine On
  const redirectRule = `\n  # Redirect root to website content\n  RewriteRule ^$ ${targetPath} [L,R=302]\n`
  content = content.replace(
    'RewriteEngine On\n',
    'RewriteEngine On\n' + redirectRule
  )

  // Write back
  await whmApi.post('/cpanel', new URLSearchParams({
    'api.version': '1',
    cpanel_jsonapi_user: cpUsername,
    cpanel_jsonapi_apiversion: '3',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'save_file_content',
    dir: '/public_html',
    file: '.htaccess',
    content,
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  log(`[HealthCheck] Added root redirect to ${targetPath} for ${cpUsername}`)
}

/**
 * Report health check results via Telegram
 */
async function reportResults(domain, cpUsername, chatId, results) {
  const { issues, autoFixes, warnings, checks } = results

  // Build status summary
  let status = '✅'
  if (issues.length > 0) status = '❌'
  else if (warnings.length > 0) status = '⚠️'

  let msg = `${status} <b>Health Check: ${domain}</b>\n`
  msg += `User: <code>${cpUsername}</code>\n\n`

  // Origin check
  const originStatus = checks.originRoot?.status || 'N/A'
  msg += `<b>Origin:</b> HTTP ${originStatus}`
  if (checks.originRoot?.redirectUrl) {
    msg += ` → ${checks.originRoot.redirectUrl}`
  }
  msg += '\n'

  // CF check
  const cfStatus = checks.throughCF?.status || 'N/A'
  msg += `<b>Through CF:</b> HTTP ${cfStatus}`
  if (checks.throughCF?.xAntiRed) {
    msg += ` (${checks.throughCF.xAntiRed})`
  }
  msg += '\n'

  // Content location
  if (checks.contentLocation?.location) {
    msg += `<b>Content:</b> ${checks.contentLocation.location}\n`
  }

  // Prepend type
  if (checks.prepend?.type) {
    msg += `<b>Prepend:</b> ${checks.prepend.type}\n`
  }

  // Auto-fixes
  if (autoFixes.length > 0) {
    msg += '\n<b>🔧 Auto-Fixes Applied:</b>\n'
    for (const fix of autoFixes) {
      msg += `• ${fix}\n`
    }
  }

  // Issues
  if (issues.length > 0) {
    msg += '\n<b>❌ Unresolved Issues:</b>\n'
    for (const issue of issues) {
      msg += `• ${issue}\n`
    }
  }

  // Warnings
  if (warnings.length > 0) {
    msg += '\n<b>⚠️ Warnings:</b>\n'
    for (const warn of warnings) {
      msg += `• ${warn}\n`
    }
  }

  // Post-fix status
  if (checks.postFixRecheck) {
    msg += `\n<b>Post-Fix:</b> HTTP ${checks.postFixRecheck.status}`
    if (checks.postFixRecheck.hasActualContent) msg += ' ✅'
    msg += '\n'
  }

  // Send to admin
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN_PROD || process.env.TELEGRAM_BOT_TOKEN_DEV
    const adminChatId = TELEGRAM_DEV_CHAT_ID || chatId
    if (botToken && adminChatId) {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: adminChatId,
        text: msg,
        parse_mode: 'HTML',
      }, { timeout: 10000 })
    }
  } catch (err) {
    log(`[HealthCheck] Failed to send Telegram report for ${domain}: ${err.message}`)
  }

  return msg
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  scheduleHealthCheck,
  runHealthCheck,
  detectUserContent,
  checkHtaccessIntegrity,
  checkPrependConfig,
}
