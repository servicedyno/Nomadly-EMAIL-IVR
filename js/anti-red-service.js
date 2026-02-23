/* global process */
/**
 * Anti-Red Protection Service
 * 
 * Provides four layers of scanner/bot protection for hosted sites:
 * 1. .htaccess rules — Block known scanner IP ranges & user-agents (full cloaking)
 * 2. JS Challenge — Client-side bot detection (headless browser, WebDriver, missing APIs)
 *    → Static sites: injected directly into HTML
 *    → PHP sites: via auto_prepend_file
 * 3. TLS/JA3 fingerprinting — Cloudflare WAF rules blocking known scanner TLS fingerprints
 * 4. Cloudflare Worker — Edge-level challenge injection & scanner blocking (survives redeployments)
 */

require('dotenv').config()
const axios = require('axios')
const { log } = require('console')

const WHM_HOST = process.env.WHM_HOST
const WHM_USERNAME = process.env.WHM_USERNAME || 'root'
const WHM_TOKEN = process.env.WHM_TOKEN

const whmApi = WHM_HOST && WHM_TOKEN ? axios.create({
  baseURL: `https://${WHM_HOST}:2087/json-api`,
  headers: { Authorization: `whm ${WHM_USERNAME}:${WHM_TOKEN}` },
  timeout: 30000,
  httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
}) : null

// ─── Known Scanner / Anti-Phishing IP Ranges ────────────
// Google Safe Browsing, VirusTotal, PhishTank, Norton, McAfee, etc.
// These crawlers flag/red-list websites. Cloaking = returning clean page or 403 to them.

const SCANNER_IP_RANGES = [
  // ─── Anti-Phishing / Safe Browsing Crawlers ───
  // Google Safe Browsing / Transparency Report crawlers
  '66.249.64.0/19',
  '66.249.79.0/24',
  '72.14.199.0/24',
  '209.85.238.0/24',
  '216.239.32.0/19',
  '74.125.0.0/16',
  // Google fetch-as (used by manual SB review)
  '64.233.160.0/19',
  '108.177.0.0/17',
  // VirusTotal scanners
  '208.100.26.228',
  '5.189.183.72',
  // PhishTank
  '69.46.27.0/24',
  // Sucuri SiteCheck
  '192.232.249.0/24',
  // Norton/Symantec SafeWeb
  '199.16.156.0/24',
  // McAfee SiteAdvisor
  '208.65.144.0/21',
  // Yandex SafeBrowsing
  '5.255.253.0/24',
  '77.88.55.0/24',
  '87.250.250.0/24',
  '93.158.161.0/24',
  // URLScan.io
  '18.213.240.0/24',
  '3.220.57.0/24',
  // Microsoft SmartScreen / Defender
  '13.107.21.0/24',
  '204.79.197.0/24',
  '52.96.0.0/14',
  // Netcraft (expanded — they use multiple ranges for phishing verification)
  '194.72.238.0/24',
  '194.72.0.0/16',
  '195.22.26.0/24',
  '46.183.103.0/24',
  '185.117.215.0/24',
  '82.69.0.0/16',
  // Kaspersky
  '77.74.181.0/24',
  '93.159.230.0/24',
  // ESET
  '91.228.166.0/24',
  '91.228.167.0/24',
  // Avast/AVG
  '5.45.72.0/24',
  // Bitdefender
  '91.199.104.0/24',
  // Fortinet FortiGuard
  '208.91.112.0/20',
  // Comodo (Sectigo)
  '178.255.82.0/24',
  // ─── Port / Recon Scanners ───
  // Censys
  '162.142.125.0/24',
  '167.94.138.0/24',
  '167.94.145.0/24',
  '167.94.146.0/24',
  '167.248.133.0/24',
  // Shodan
  '71.6.135.0/24',
  '71.6.146.0/24',
  '71.6.158.0/24',
  '71.6.165.0/24',
  '66.240.192.0/24',
  '66.240.205.0/24',
  '66.240.236.0/24',
  '198.20.69.0/24',
  '198.20.70.0/24',
  '198.20.87.0/24',
  '198.20.99.0/24',
  // ZoomEye
  '106.75.64.0/18',
  '106.11.248.0/22',
  // Qualys
  '64.39.96.0/20',
  // Rapid7
  '71.6.233.0/24',
  // GreyNoise
  '71.6.199.0/24',
  // Binaryedge
  '149.102.128.0/18',
  // Internet Census
  '74.82.47.0/24',
  // SecurityTrails
  '52.86.0.0/16',
  // SSL Labs
  '64.41.200.0/24',
  // DNSstuff
  '216.52.0.0/16',
  // NOTE: Do NOT block Cloudflare proxy IPs (173.245.48.0/20, 103.21.244.0/22, 103.22.200.0/22)
  // When sites are behind CF, ALL traffic comes through these IPs — blocking them = blocking everyone
]

// Known bot user agents used by security scanners (anti-phishing + recon)
const SCANNER_USER_AGENTS = [
  // Anti-Phishing / Safe Browsing
  'GoogleSafeBrowsing',
  'PhishTank',
  'Sucuri',
  'SiteAdvisor',
  'SafeBrowsing',
  'VirusTotal',
  'URLScan',
  'Netcraft',
  'Norton',
  'SmartScreen',
  'ClamAV',
  'Sophos',
  'Kaspersky',
  'ESET',
  'Avast',
  'Bitdefender',
  'FortiGuard',
  'Comodo',
  'MalwareBytes',
  'Palo Alto',
  // Recon / Port Scanners
  'Censys',
  'CensysInspect',
  'Shodan',
  'ShodanBot',
  'ZmEu',
  'Nmap',
  'nikto',
  'sqlmap',
  'masscan',
  'Zgrab',
  'gobuster',
  'dirbuster',
  'wpscan',
  'nuclei',
  'httpx',
  'BinaryEdge',
  'NetcraftSurveyAgent',
  'SecurityTrails',
  'Project.Discovery',
  'RustBot',
  'InternetMeasurement',
  'ScanWorld',
  'BuiltWith',
  'WhatWeb',
  'Harvester',
  'Scrapy',
  'python-requests',
  'Go-http-client',
  'Java/',
  'curl/',
  'Wget/',
]

// ─── 1. .htaccess Scanner IP Cloaking ──────────────────

/**
 * Convert a CIDR to an Apache 2.4 Require directive
 * or a mod_rewrite regex pattern for Apache 2.2 compatibility
 */
function cidrToApachePattern(cidr) {
  if (!cidr.includes('/')) {
    // Single IP
    return cidr
  }
  const [base, bits] = cidr.split('/')
  const mask = parseInt(bits)
  const parts = base.split('.')

  if (mask >= 24) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.`
  } else if (mask >= 16) {
    return `${parts[0]}.${parts[1]}.`
  } else if (mask >= 8) {
    return `${parts[0]}.`
  }
  return base
}

/**
 * Generate .htaccess rules to fully cloak from scanners.
 * Combines anti-phishing scanner IPs + recon scanner IPs.
 * For Cloudflare-proxied sites: uses mod_rewrite UA blocking only (IP blocking useless behind CF).
 * For direct-IP sites: also includes Apache 2.4 Require not ip.
 * Blocks scanner user-agents, empty UAs, and direct access to challenge file.
 */
function generateHtaccessRules(cpUsername, options = {}) {
  const { behindCloudflare = true, staticSiteBuildPath = '' } = options

  let rules = `# ====== Anti-Red Protection — Scanner IP Cloaking & Bot Blocking ======
# Auto-generated by Nomadly Anti-Red Service
# DO NOT EDIT — changes will be overwritten on renewal
`

  // Only add IP blocking if NOT behind Cloudflare (behind CF, all IPs are CF's)
  if (!behindCloudflare) {
    rules += `
# --- Scanner IP Blocking (Apache 2.4+) ---
<IfModule mod_authz_core.c>
  <RequireAll>
    Require all granted
`
    for (const ip of SCANNER_IP_RANGES) {
      rules += `    Require not ip ${ip.replace('/32', '')}\n`
    }
    rules += `  </RequireAll>
</IfModule>
`
  }

  rules += `
<IfModule mod_rewrite.c>
  RewriteEngine On

  # Deny direct access to hidden anti-red files
  RewriteRule ^\\.antired- - [F,L]

  # Block empty user-agents
  RewriteCond %{HTTP_USER_AGENT} ^$ [NC]
  RewriteRule ^(.*)$ - [F,L]

  # Block known scanner user-agents
`
  // Group UAs into batches for efficient matching
  const batchSize = 6
  for (let i = 0; i < SCANNER_USER_AGENTS.length; i += batchSize) {
    const batch = SCANNER_USER_AGENTS.slice(i, i + batchSize)
    const pattern = batch.join('|')
    const isLast = i + batchSize >= SCANNER_USER_AGENTS.length
    const flag = isLast ? '[NC]' : '[NC,OR]'
    rules += `  RewriteCond %{HTTP_USER_AGENT} (${pattern}) ${flag}\n`
  }
  rules += `  RewriteRule ^(.*)$ - [F,L]

  # Block dangerous HTTP methods
  RewriteCond %{REQUEST_METHOD} ^(TRACE|TRACK|DEBUG) [NC]
  RewriteRule ^(.*)$ - [F,L]
`

  // For static sites, add build directory rewrite inside the same mod_rewrite block
  if (staticSiteBuildPath) {
    rules += `
  # --- Serve static site from build directory ---
  # Root URL: serve build/index.html directly
  RewriteRule ^$ ${staticSiteBuildPath}/index.html [L]

  # Other paths: serve from build dir if the original file doesn't exist
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ ${staticSiteBuildPath}/$1 [L]
`
  }

  rules += `</IfModule>

# --- Security Headers ---
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set X-XSS-Protection "1; mode=block"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# ====== End Anti-Red Protection ======
`
  return rules
}

/**
 * Deploy .htaccess rules to a cPanel account's public_html.
 * Detects whether the site is behind Cloudflare and whether it serves static files.
 * Preserves cPanel-generated PHP handler.
 */
async function deployHtaccess(cpUsername, domain) {
  if (!whmApi) {
    log('[AntiRed] WHM not configured, skipping .htaccess deployment')
    return { success: false, error: 'WHM not configured' }
  }

  try {
    // Detect if behind Cloudflare
    let behindCloudflare = false
    try {
      const cfService = require('./cf-service')
      const zone = await cfService.getZoneByName(domain)
      behindCloudflare = !!zone
    } catch (_) {}

    // Read existing .htaccess to detect static site build path & cPanel handler
    let existingContent = ''
    try {
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
      existingContent = readRes.data?.result?.data?.content || ''
    } catch (_) {}

    // Extract static site build path from existing rewrite rules
    let staticSiteBuildPath = ''
    const buildPathMatch = existingContent.match(/RewriteRule\s+\^\(.*\)\$\s+(\S+\/build)\//)
    if (buildPathMatch) {
      staticSiteBuildPath = buildPathMatch[1]
    }

    // Extract cPanel PHP handler (must be preserved)
    const cpanelHandlerMatch = existingContent.match(/# php -- BEGIN cPanel-generated handler[^\n]*\n[\s\S]*?# php -- END cPanel-generated handler[^\n]*/)
    const cpanelHandler = cpanelHandlerMatch ? cpanelHandlerMatch[0] : ''

    // Extract any CORS headers section
    const corsMatch = existingContent.match(/# --- CORS headers[\s\S]*?<\/IfModule>\s*$/m)
    const corsSection = corsMatch ? corsMatch[0] : ''

    // Generate new rules
    const rules = generateHtaccessRules(cpUsername, { behindCloudflare, staticSiteBuildPath })

    // Build final content
    let finalContent = ''
    if (cpanelHandler) {
      finalContent = cpanelHandler + '\n\n'
    }
    finalContent += rules
    if (corsSection && !finalContent.includes('cross-origin')) {
      finalContent += '\n' + corsSection
    }

    const writeRes = await whmApi.get('/cpanel', {
      params: {
        'api.version': 1,
        cpanel_jsonapi_user: cpUsername,
        cpanel_jsonapi_apiversion: 3,
        cpanel_jsonapi_module: 'Fileman',
        cpanel_jsonapi_func: 'save_file_content',
        dir: '/public_html',
        file: '.htaccess',
        content: finalContent,
      },
    })

    const ok = writeRes.data?.result?.status === 1 || writeRes.data?.metadata?.result === 1
    log(`[AntiRed] .htaccess deployed for ${cpUsername}: ${ok ? 'OK' : 'FAIL'} (CF=${behindCloudflare}, IPs=${SCANNER_IP_RANGES.length}, UAs=${SCANNER_USER_AGENTS.length}, staticBuild=${staticSiteBuildPath || 'none'})`)
    return { success: ok, ipRanges: SCANNER_IP_RANGES.length, userAgents: SCANNER_USER_AGENTS.length, behindCloudflare, staticSiteBuildPath }
  } catch (err) {
    log(`[AntiRed] .htaccess deploy error for ${cpUsername}: ${err.message}`)
    return { success: false, error: err.message }
  }
}

// ─── 2. JS Challenge (Client-Side Bot Detection) ────────

/**
 * Generate the anti-bot JS challenge script.
 * Runs on client side, detects headless browsers / bots.
 */
function generateJSChallenge() {
  return `<!-- Anti-Red JS Challenge -->
<script>
(function(){
  'use strict';
  var s=0;
  if(navigator.webdriver)s+=40;
  if(/HeadlessChrome/.test(navigator.userAgent))s+=50;
  if(navigator.plugins.length===0)s+=15;
  if(!navigator.languages||navigator.languages.length===0)s+=15;
  if(window._phantom||window.__nightmare||window.callPhantom)s+=50;
  if(document.__selenium_unwrapped||document.__webdriver_evaluate||document.__driver_evaluate)s+=50;
  if(window.chrome===undefined&&/Chrome/.test(navigator.userAgent))s+=30;
  if(navigator.permissions){
    navigator.permissions.query({name:'notifications'}).then(function(p){
      if(Notification.permission==='denied'&&p.state==='prompt')s+=25;
    }).catch(function(){});
  }
  try{var c=document.createElement('canvas');var g=c.getContext('2d');g.fillText('test',10,10);if(c.toDataURL().length<1000)s+=20;}catch(e){}
  var conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  if(conn&&conn.rtt===0)s+=20;
  setTimeout(function(){
    if(s>=50){
      document.documentElement.innerHTML='<div style=\"display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#f5f5f5\"><div style=\"text-align:center;padding:40px\"><h1>Access Denied</h1><p>Your browser failed our security check.</p><p style=\"color:#666;font-size:14px\">Error: 403 AR-'+(Math.random()*1e6|0)+'</p></div></div>';
    }
  },800);
})();
</script>`
}

/**
 * Generate the PHP challenge file content with recursion guard.
 * Prevents 503 when the file is accessed directly (auto_prepend self-inclusion loop).
 */
function generateChallengePhp(jsChallenge) {
  return `<?php
// Anti-Red JS Challenge — Auto-generated by Nomadly
// Recursion guard: prevent 503 when this file is accessed directly via auto_prepend
if (defined('ANTIRED_CHALLENGE_LOADED')) return;
define('ANTIRED_CHALLENGE_LOADED', true);

// Skip injection for static assets (images, css, js, fonts)
\$uri = \$_SERVER['REQUEST_URI'] ?? '';
if (preg_match('/\\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map|json)$/i', \$uri)) return;

echo '${jsChallenge.replace(/'/g, "\\'")}';
?>`
}

/**
 * Detect if a cPanel account serves static HTML (React build, etc.)
 * and create an index.php wrapper to enable JS challenge injection.
 */
async function ensurePhpEntrypoint(cpUsername) {
  if (!whmApi) return { hasPhp: false }

  try {
    // Check if index.php exists in public_html
    let hasIndexPhp = false
    try {
      const res = await whmApi.get('/cpanel', {
        params: {
          'api.version': 1,
          cpanel_jsonapi_user: cpUsername,
          cpanel_jsonapi_apiversion: 3,
          cpanel_jsonapi_module: 'Fileman',
          cpanel_jsonapi_func: 'get_file_content',
          dir: '/public_html',
          file: 'index.php',
        },
      })
      const content = res.data?.result?.data?.content || ''
      hasIndexPhp = content.length > 0
    } catch (_) {}

    if (hasIndexPhp) return { hasPhp: true, method: 'existing' }

    // Check if index.html exists (static site indicator)
    let indexHtmlContent = ''
    try {
      const res = await whmApi.get('/cpanel', {
        params: {
          'api.version': 1,
          cpanel_jsonapi_user: cpUsername,
          cpanel_jsonapi_apiversion: 3,
          cpanel_jsonapi_module: 'Fileman',
          cpanel_jsonapi_func: 'get_file_content',
          dir: '/public_html',
          file: 'index.html',
        },
      })
      indexHtmlContent = res.data?.result?.data?.content || ''
    } catch (_) {}

    if (!indexHtmlContent) return { hasPhp: false, note: 'No index.html found' }

    // Static site detected — create index.php wrapper that serves index.html through PHP
    // This allows auto_prepend_file to inject the JS challenge
    const wrapperPhp = `<?php
// Anti-Red: PHP wrapper for static HTML — enables JS challenge injection via auto_prepend
// Original index.html is served through PHP so the challenge script gets prepended
readfile(__DIR__ . '/index.html');
?>`

    await whmApi.get('/cpanel', {
      params: {
        'api.version': 1,
        cpanel_jsonapi_user: cpUsername,
        cpanel_jsonapi_apiversion: 3,
        cpanel_jsonapi_module: 'Fileman',
        cpanel_jsonapi_func: 'save_file_content',
        dir: '/public_html',
        file: 'index.php',
        content: wrapperPhp,
      },
    })

    log(`[AntiRed] Created index.php wrapper for static site (${cpUsername})`)
    return { hasPhp: true, method: 'wrapper_created' }
  } catch (err) {
    log(`[AntiRed] ensurePhpEntrypoint error for ${cpUsername}: ${err.message}`)
    return { hasPhp: false, error: err.message }
  }
}

/**
 * Deploy JS challenge to a cPanel account.
 * Strategy depends on the site type:
 * - PHP sites: Uses auto_prepend_file via .user.ini (best approach)
 * - Static sites (React builds, etc.): Injects JS challenge directly into index.html
 *   because auto_prepend only works with PHP-processed files
 */
async function deployJSChallenge(cpUsername) {
  if (!whmApi) {
    return { success: false, error: 'WHM not configured' }
  }

  const jsChallenge = generateJSChallenge()

  try {
    // Detect site type: check for static build paths in .htaccess
    let isStaticSite = false
    let buildDir = ''
    try {
      const htRes = await whmApi.get('/cpanel', {
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
      const htContent = htRes.data?.result?.data?.content || ''
      const buildMatch = htContent.match(/RewriteRule\s+\^\(.*\)\$\s+(\S+)\/\$1/)
      if (buildMatch) {
        buildDir = buildMatch[1]
        // Check if this path has an index.html (static site indicator)
        try {
          const checkRes = await whmApi.get('/cpanel', {
            params: {
              'api.version': 1,
              cpanel_jsonapi_user: cpUsername,
              cpanel_jsonapi_apiversion: 3,
              cpanel_jsonapi_module: 'Fileman',
              cpanel_jsonapi_func: 'get_file_content',
              dir: `/public_html/${buildDir}`,
              file: 'index.html',
            },
          })
          const buildHtml = checkRes.data?.result?.data?.content || ''
          if (buildHtml && !buildHtml.includes('<?php')) {
            isStaticSite = true
          }
        } catch (_) {}
      }
    } catch (_) {}

    if (isStaticSite && buildDir) {
      // STATIC SITE: Inject JS challenge directly into index.html
      const readRes = await whmApi.get('/cpanel', {
        params: {
          'api.version': 1,
          cpanel_jsonapi_user: cpUsername,
          cpanel_jsonapi_apiversion: 3,
          cpanel_jsonapi_module: 'Fileman',
          cpanel_jsonapi_func: 'get_file_content',
          dir: `/public_html/${buildDir}`,
          file: 'index.html',
        },
      })
      let html = readRes.data?.result?.data?.content || ''

      if (html.includes('Anti-Red JS Challenge')) {
        log(`[AntiRed] JS Challenge already in HTML for ${cpUsername}`)
        return { success: true, method: 'static_html_existing' }
      }

      // Inject after <head> tag
      if (html.includes('<head>')) {
        html = html.replace('<head>', '<head>' + jsChallenge)
      } else {
        html = jsChallenge + '\n' + html
      }

      await whmApi.get('/cpanel', {
        params: {
          'api.version': 1,
          cpanel_jsonapi_user: cpUsername,
          cpanel_jsonapi_apiversion: 3,
          cpanel_jsonapi_module: 'Fileman',
          cpanel_jsonapi_func: 'save_file_content',
          dir: `/public_html/${buildDir}`,
          file: 'index.html',
          content: html,
        },
      })

      log(`[AntiRed] JS Challenge injected directly into HTML for ${cpUsername} (static site: ${buildDir})`)
      return { success: true, method: 'static_html_injection', buildDir }
    }

    // PHP SITE: Use auto_prepend_file via .user.ini
    const phpContent = generateChallengePhp(jsChallenge)

    await whmApi.get('/cpanel', {
      params: {
        'api.version': 1,
        cpanel_jsonapi_user: cpUsername,
        cpanel_jsonapi_apiversion: 3,
        cpanel_jsonapi_module: 'Fileman',
        cpanel_jsonapi_func: 'save_file_content',
        dir: '/public_html',
        file: '.antired-challenge.php',
        content: phpContent,
      },
    })

    const userIniContent = `; Anti-Red JS Challenge
auto_prepend_file = /home/${cpUsername}/public_html/.antired-challenge.php`

    await whmApi.get('/cpanel', {
      params: {
        'api.version': 1,
        cpanel_jsonapi_user: cpUsername,
        cpanel_jsonapi_apiversion: 3,
        cpanel_jsonapi_module: 'Fileman',
        cpanel_jsonapi_func: 'save_file_content',
        dir: '/public_html',
        file: '.user.ini',
        content: userIniContent,
      },
    })

    log(`[AntiRed] JS Challenge deployed for ${cpUsername} (via .user.ini, PHP site)`)
    return { success: true, method: 'user.ini' }
  } catch (err) {
    log(`[AntiRed] JS Challenge deploy error for ${cpUsername}: ${err.message}`)
    return { success: false, error: err.message }
  }
}

/**
 * Disable JS challenge for a cPanel account.
 * 
 * IMPORTANT: This ONLY disables the JS challenge (bot detection script).
 * All other Anti-Red protections remain FULLY ACTIVE:
 * - .htaccess scanner IP cloaking (32+ scanner IP ranges)
 * - .htaccess scanner UA blocking (20 scanner user-agents)
 * - .htaccess empty UA blocking
 * - .htaccess TRACE/TRACK/DEBUG method blocking
 * - Cloudflare WAF rules (JA3 fingerprinting, anti-bot profile)
 */
async function removeJSChallenge(cpUsername) {
  if (!whmApi) {
    return { success: false, error: 'WHM not configured' }
  }

  try {
    // Disable the JS challenge by writing an empty PHP file
    await whmApi.get('/cpanel', {
      params: {
        'api.version': 1,
        cpanel_jsonapi_user: cpUsername,
        cpanel_jsonapi_apiversion: 3,
        cpanel_jsonapi_module: 'Fileman',
        cpanel_jsonapi_func: 'save_file_content',
        dir: '/public_html',
        file: '.antired-challenge.php',
        content: '<?php\n// JS Challenge is currently DISABLED for this domain.\n// All other Anti-Red protections (IP cloaking, UA blocking, TLS fingerprinting) remain ACTIVE.\n?>',
      },
    })

    // Clean up .user.ini (remove auto_prepend)
    try {
      const readRes = await whmApi.get('/cpanel', {
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
      let iniContent = readRes.data?.result?.data?.content || ''
      if (iniContent.includes('antired-challenge.php')) {
        iniContent = iniContent.replace(/; Anti-Red JS Challenge\n?/g, '')
        iniContent = iniContent.replace(/auto_prepend_file\s*=\s*[^\n]*antired-challenge\.php\n?/g, '')
        await whmApi.get('/cpanel', {
          params: {
            'api.version': 1,
            cpanel_jsonapi_user: cpUsername,
            cpanel_jsonapi_apiversion: 3,
            cpanel_jsonapi_module: 'Fileman',
            cpanel_jsonapi_func: 'save_file_content',
            dir: '/public_html',
            file: '.user.ini',
            content: iniContent.trim() || '; empty',
          },
        })
      }
    } catch (_) {}

    // Also clean legacy php_value from .htaccess (backwards compatibility)
    try {
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
      let htContent = readRes.data?.result?.data?.content || ''
      if (htContent.includes('antired-challenge.php') || htContent.includes('php_value auto_prepend_file')) {
        htContent = htContent.replace(/\n?# Anti-Red JS Challenge auto-prepend\n?php_value auto_prepend_file[^\n]*\n?/g, '\n')
        await whmApi.get('/cpanel', {
          params: {
            'api.version': 1,
            cpanel_jsonapi_user: cpUsername,
            cpanel_jsonapi_apiversion: 3,
            cpanel_jsonapi_module: 'Fileman',
            cpanel_jsonapi_func: 'save_file_content',
            dir: '/public_html',
            file: '.htaccess',
            content: htContent.trim(),
          },
        })
      }
    } catch (_) {}

    log(`[AntiRed] JS Challenge disabled for ${cpUsername} (all other protections remain active)`)
    return { success: true, note: 'JS challenge disabled. Scanner IP cloaking, UA blocking, and TLS fingerprinting remain active.' }
  } catch (err) {
    log(`[AntiRed] JS Challenge disable error for ${cpUsername}: ${err.message}`)
    return { success: false, error: err.message }
  }
}

/**
 * Check if JS challenge is currently enabled for a cPanel account
 */
async function isJSChallengeEnabled(cpUsername) {
  if (!whmApi) return false

  try {
    const readRes = await whmApi.get('/cpanel', {
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
    const content = readRes.data?.result?.data?.content || ''
    return content.includes('Anti-Red JS Challenge') && !content.includes('disabled')
  } catch (_) {
    return false
  }
}

// ─── 3. TLS/JA3 Fingerprinting (Cloudflare WAF) ────────

const SCANNER_JA3_HASHES = [
  'b32309a26951912be7dba376398abc3b', // Python requests
  'e7d705a3286e19ea42f587b344ee6865', // Python urllib
  'cd08e31494f9531f560d64c695473da9', // Go HTTP client
  '456523fc94726331a4d5a2e1d40b2cd7', // curl
  'b4f7bcb23b6b763e18e4b2e4bc2a2b91', // Headless Chrome
  'f5a90abb09e397ac90e0b48e4e75d221', // Node.js fetch/axios
  'a0e9f5d64349fb13191bc781f81f42e1', // Scrapy
  '05af1f5ca1b87cc9cc9b25185115607d', // Java HttpClient
]

/**
 * Create Cloudflare WAF rules for TLS/JA3 fingerprinting
 */
async function createJA3Rules(zoneId) {
  const CF_API_KEY = process.env.CLOUDFLARE_API_KEY
  const CF_EMAIL = process.env.CLOUDFLARE_EMAIL
  if (!CF_API_KEY || !CF_EMAIL) {
    return { success: false, error: 'Cloudflare not configured' }
  }

  const headers = {
    'X-Auth-Email': CF_EMAIL,
    'X-Auth-Key': CF_API_KEY,
    'Content-Type': 'application/json',
  }

  const ja3Conditions = SCANNER_JA3_HASHES
    .map(hash => `cf.bot_management.ja3_hash eq "${hash}"`)
    .join(' or ')

  const expression = `(${ja3Conditions})`

  try {
    const filterRes = await axios.post(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/filters`,
      [{ expression, description: 'Anti-Red: Block scanner TLS fingerprints (JA3)' }],
      { headers, timeout: 15000 }
    )

    if (!filterRes.data?.success) {
      const existingFilters = await axios.get(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/filters?description=Anti-Red`,
        { headers, timeout: 15000 }
      )
      if (existingFilters.data?.result?.length > 0) {
        return { success: true, message: 'JA3 rules already exist', existing: true }
      }
      return { success: false, error: 'Failed to create JA3 filter' }
    }

    const filterId = filterRes.data.result[0]?.id
    if (!filterId) return { success: false, error: 'No filter ID returned' }

    const ruleRes = await axios.post(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/rules`,
      [{
        filter: { id: filterId },
        action: 'js_challenge',
        description: 'Anti-Red: Challenge scanner TLS fingerprints (JA3)',
        priority: 1,
      }],
      { headers, timeout: 15000 }
    )

    const ok = ruleRes.data?.success || false
    log(`[AntiRed] JA3 WAF rule created for zone ${zoneId}: ${ok ? 'OK' : 'FAIL'}`)
    return { success: ok, rule: ruleRes.data?.result?.[0], hashCount: SCANNER_JA3_HASHES.length }
  } catch (err) {
    if (err.response?.data?.errors?.some(e => e.message?.includes('already exists'))) {
      return { success: true, message: 'JA3 rules already exist', existing: true }
    }
    // cf.bot_management.ja3_hash requires Enterprise Bot Management — skip gracefully
    const status = err.response?.status
    if (status === 400 || status === 403) {
      log(`[AntiRed] JA3 WAF skipped for zone ${zoneId} (requires Enterprise Bot Management)`)
      return { success: false, error: 'Requires Enterprise Bot Management', planLimitation: true }
    }
    log(`[AntiRed] JA3 WAF rule error: ${err.message}`)
    return { success: false, error: err.message }
  }
}

/**
 * Create Cloudflare WAF rule to block anti-phishing scanner user-agents at the edge.
 * This is critical when the origin is behind CF — .htaccess UA rules only see CF's IP,
 * but Cloudflare preserves the original User-Agent header for WAF matching.
 */
async function createAntiPhishingScannerRules(zoneId) {
  const CF_API_KEY = process.env.CLOUDFLARE_API_KEY
  const CF_EMAIL = process.env.CLOUDFLARE_EMAIL
  if (!CF_API_KEY || !CF_EMAIL) {
    return { success: false, error: 'Cloudflare not configured' }
  }

  const headers = {
    'X-Auth-Email': CF_EMAIL,
    'X-Auth-Key': CF_API_KEY,
    'Content-Type': 'application/json',
  }

  // Anti-phishing scanner UAs — these MUST be blocked at Cloudflare edge
  const phishingScanners = [
    'GoogleSafeBrowsing', 'PhishTank', 'Sucuri', 'SiteAdvisor',
    'SafeBrowsing', 'VirusTotal', 'URLScan', 'Netcraft',
    'Norton', 'SmartScreen', 'Kaspersky', 'ESET',
    'Avast', 'Bitdefender', 'FortiGuard', 'Comodo',
    'MalwareBytes', 'ClamAV', 'Sophos',
  ]

  const expression = phishingScanners
    .map(ua => `http.user_agent contains "${ua}"`)
    .join(' or ')

  try {
    // Check if rule already exists
    const existingRules = await axios.get(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/rules`,
      { headers, timeout: 15000 }
    )
    const hasAntiPhishing = (existingRules.data?.result || []).some(
      r => r.description?.includes('Anti-Red: Block anti-phishing scanners')
    )
    if (hasAntiPhishing) {
      return { success: true, message: 'Anti-phishing scanner rules already exist', existing: true }
    }

    const filterRes = await axios.post(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/filters`,
      [{ expression: `(${expression})`, description: 'Anti-Red: Block anti-phishing scanners' }],
      { headers, timeout: 15000 }
    )

    if (!filterRes.data?.success) {
      return { success: false, error: 'Failed to create anti-phishing scanner filter', detail: filterRes.data }
    }

    const filterId = filterRes.data.result[0]?.id
    if (!filterId) return { success: false, error: 'No filter ID returned' }

    const ruleRes = await axios.post(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/rules`,
      [{
        filter: { id: filterId },
        action: 'block',
        description: 'Anti-Red: Block anti-phishing scanners',
        priority: 1,
      }],
      { headers, timeout: 15000 }
    )

    const ok = ruleRes.data?.success || false
    log(`[AntiRed] Anti-phishing scanner CF rule created for zone ${zoneId}: ${ok ? 'OK' : 'FAIL'} (${phishingScanners.length} UAs)`)
    return { success: ok, scannerCount: phishingScanners.length }
  } catch (err) {
    if (err.response?.data?.errors?.some(e => e.message?.includes('already exists'))) {
      return { success: true, message: 'Rule already exists', existing: true }
    }
    log(`[AntiRed] Anti-phishing scanner CF rule error: ${err.message}`)
    return { success: false, error: err.message }
  }
}

// ─── Full Protection Deployment ──────────────────────────

/**
 * Deploy Cloudflare Worker for edge-level challenge injection.
 * The Worker intercepts HTML responses and injects the JS challenge at the edge,
 * surviving site redeployments and covering all routes (not just index.html).
 * Also blocks scanner UAs at the edge before they reach origin.
 */
async function deployCFWorker(domain, zoneId) {
  const CF_API_KEY = process.env.CLOUDFLARE_API_KEY
  const CF_EMAIL = process.env.CLOUDFLARE_EMAIL

  if (!CF_API_KEY || !CF_EMAIL) {
    return { success: false, error: 'Cloudflare not configured' }
  }

  const cfHeaders = {
    'X-Auth-Email': CF_EMAIL,
    'X-Auth-Key': CF_API_KEY,
  }

  try {
    // Get account ID from zone
    const zoneRes = await axios.get(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}`,
      { headers: cfHeaders, timeout: 15000 }
    )
    const accountId = zoneRes.data?.result?.account?.id
    if (!accountId) return { success: false, error: 'Could not determine account ID' }

    const workerName = `antired-${domain.replace(/\./g, '-')}`

    // Build scanner UA list for the Worker
    const blockedUAs = SCANNER_USER_AGENTS.map(ua => `'${ua}'`).join(', ')
    const jsChallenge = generateJSChallenge()
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')

    // Worker script
    const workerScript = `
addEventListener('fetch', event => { event.respondWith(handleRequest(event.request)); });
const BLOCKED_UAS = [${blockedUAs}];
const JS_CHALLENGE = '<script data-antired="edge">' + ${JSON.stringify(generateJSChallenge().replace('<!-- Anti-Red JS Challenge -->\n<script>', '').replace('</script>', ''))} + '</script>';

async function handleRequest(request) {
  const ua = request.headers.get('User-Agent') || '';
  const url = new URL(request.url);
  if (!ua || BLOCKED_UAS.some(b => ua.includes(b))) {
    return new Response('<!DOCTYPE html><html><body><h1>403 Forbidden</h1></body></html>', {
      status: 403, headers: { 'Content-Type': 'text/html', 'X-AntiRed': 'blocked-edge' },
    });
  }
  if (url.pathname.startsWith('/.antired')) {
    return new Response('Forbidden', { status: 403 });
  }
  const response = await fetch(request);
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) return response;
  let html = await response.text();
  if (html.includes('data-antired')) {
    return new Response(html, { status: response.status, headers: response.headers });
  }
  if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>' + JS_CHALLENGE);
  } else if (html.includes('<HEAD>')) {
    html = html.replace('<HEAD>', '<HEAD>' + JS_CHALLENGE);
  } else {
    html = JS_CHALLENGE + html;
  }
  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-AntiRed', 'challenge-injected');
  newHeaders.delete('Content-Length');
  return new Response(html, { status: response.status, headers: newHeaders });
}`

    // Upload Worker
    await axios.put(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
      workerScript,
      { headers: { ...cfHeaders, 'Content-Type': 'application/javascript' }, timeout: 30000 }
    )

    // Check if route already exists before creating
    const existingRoutes = await axios.get(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
      { headers: cfHeaders, timeout: 10000 }
    )
    const routes = existingRoutes.data?.result || []
    const existingRoute = routes.find(r => r.pattern === `${domain}/*`)

    if (existingRoute) {
      // Update existing route to use the new worker
      if (existingRoute.script !== workerName) {
        await axios.put(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes/${existingRoute.id}`,
          { pattern: `${domain}/*`, script: workerName },
          { headers: { ...cfHeaders, 'Content-Type': 'application/json' }, timeout: 15000 }
        )
        log(`[AntiRed] CF Worker route updated for ${domain}: ${existingRoute.script} -> ${workerName}`)
      } else {
        log(`[AntiRed] CF Worker route already exists for ${domain} with correct script`)
      }
      return { success: true, workerName, routeId: existingRoute.id, existing: true }
    }

    // Create new route
    const routeRes = await axios.post(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
      { pattern: `${domain}/*`, script: workerName },
      { headers: { ...cfHeaders, 'Content-Type': 'application/json' }, timeout: 15000 }
    )

    const routeOk = routeRes.data?.success
    log(`[AntiRed] CF Worker deployed for ${domain}: route=${routeOk ? 'OK' : 'FAIL'}`)
    return { success: routeOk, workerName, routeId: routeRes.data?.result?.id }
  } catch (err) {
    if (err.response?.data?.errors?.some(e => e.message?.includes('duplicate'))) {
      return { success: true, message: 'Worker route already exists', existing: true }
    }
    log(`[AntiRed] CF Worker deploy error for ${domain}: ${err.message}`)
    return { success: false, error: err.message }
  }
}

/**
 * Deploy the shared 'antired-challenge' Worker route to a Cloudflare zone.
 * This is the lightweight version used for auto-deployment on new domains.
 * It only creates the route — the shared worker script must already be uploaded.
 * Falls back to uploading the script if the route creation fails due to missing script.
 */
async function deploySharedWorkerRoute(domain, zoneId) {
  const CF_API_KEY = process.env.CLOUDFLARE_API_KEY
  const CF_EMAIL = process.env.CLOUDFLARE_EMAIL

  if (!CF_API_KEY || !CF_EMAIL || !zoneId) {
    log(`[AntiRed] Skipping Worker auto-deploy for ${domain}: missing CF creds or zoneId`)
    return { success: false, error: 'Missing Cloudflare credentials or zoneId' }
  }

  const cfHeaders = {
    'X-Auth-Email': CF_EMAIL,
    'X-Auth-Key': CF_API_KEY,
  }
  const workerName = 'antired-challenge'

  try {
    // Check if route already exists
    const routesRes = await axios.get(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
      { headers: cfHeaders, timeout: 10000 }
    )
    const routes = routesRes.data?.result || []
    const existingMain = routes.find(r => r.pattern === `${domain}/*`)
    const existingWww = routes.find(r => r.pattern === `www.${domain}/*`)

    const results = []

    // Deploy main domain route
    if (existingMain) {
      log(`[AntiRed] Worker route already exists for ${domain}`)
      results.push({ domain, status: 'already_deployed', routeId: existingMain.id })
    } else {
      try {
        const routeRes = await axios.post(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
          { pattern: `${domain}/*`, script: workerName },
          { headers: { ...cfHeaders, 'Content-Type': 'application/json' }, timeout: 10000 }
        )
        if (routeRes.data?.success) {
          log(`[AntiRed] Worker route deployed for ${domain} -> ${workerName}`)
          results.push({ domain, status: 'deployed', routeId: routeRes.data.result?.id })
        }
      } catch (e) {
        if (e.response?.data?.errors?.some(err => err.message?.includes('duplicate'))) {
          results.push({ domain, status: 'already_deployed' })
        } else {
          log(`[AntiRed] Worker route error for ${domain}: ${e.message}`)
        }
      }
    }

    // Deploy bare domain route (domain without wildcard — catches root URL)
    const existingBare = routes.find(r => r.pattern === domain)
    if (existingBare) {
      log(`[AntiRed] Worker route already exists for bare ${domain}`)
      results.push({ domain, status: 'already_deployed', routeId: existingBare.id, bare: true })
    } else {
      try {
        const bareRes = await axios.post(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
          { pattern: domain, script: workerName },
          { headers: { ...cfHeaders, 'Content-Type': 'application/json' }, timeout: 10000 }
        )
        if (bareRes.data?.success) {
          log(`[AntiRed] Worker route deployed for bare ${domain} -> ${workerName}`)
          results.push({ domain, status: 'deployed', routeId: bareRes.data.result?.id, bare: true })
        }
      } catch (e) {
        if (e.response?.data?.errors?.some(err => err.message?.includes('duplicate'))) {
          results.push({ domain, status: 'already_deployed', bare: true })
        } else {
          log(`[AntiRed] Worker route error for bare ${domain}: ${e.message}`)
        }
      }
    }

    // Deploy www variant route
    if (existingWww) {
      log(`[AntiRed] Worker route already exists for www.${domain}`)
      results.push({ domain: `www.${domain}`, status: 'already_deployed', routeId: existingWww.id })
    } else {
      try {
        const wwwRes = await axios.post(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
          { pattern: `www.${domain}/*`, script: workerName },
          { headers: { ...cfHeaders, 'Content-Type': 'application/json' }, timeout: 10000 }
        )
        if (wwwRes.data?.success) {
          log(`[AntiRed] Worker route deployed for www.${domain} -> ${workerName}`)
          results.push({ domain: `www.${domain}`, status: 'deployed', routeId: wwwRes.data.result?.id })
        }
      } catch (e) {
        if (e.response?.data?.errors?.some(err => err.message?.includes('duplicate'))) {
          results.push({ domain: `www.${domain}`, status: 'already_deployed' })
        } else {
          log(`[AntiRed] Worker route error for www.${domain}: ${e.message}`)
        }
      }
    }

    return { success: true, status: results.length > 0 ? 'deployed' : 'no_changes', routes: results }
  } catch (err) {
    log(`[AntiRed] Worker auto-deploy error for ${domain}: ${err.message}`)
    return { success: false, error: err.message }
  }
}

// ─── Hardened Shared Worker Script ──────────────────────
// Cookie-gated challenge: origin content NEVER served without valid challenge cookie.
// Uses redirect-based cookie setting (no fetch() needed — more reliable).
// Flow: Challenge page → JS checks pass → redirect to /__ar_verify → Set-Cookie → redirect back → origin served

function generateHardenedWorkerScript() {
  const blockedUAs = SCANNER_USER_AGENTS.map(ua => `'${ua}'`).join(',')
  const scannerIPs = SCANNER_IP_RANGES.map(ip => `'${ip}'`).join(',')
  const secretSeed = require('crypto').randomBytes(16).toString('hex')

  return `
addEventListener('fetch', e => e.respondWith(handleRequest(e.request)));

const BLOCKED_UAS = [${blockedUAs}];
const SCANNER_IPS = [${scannerIPs}];
const COOKIE_NAME = '__ar_v';
const COOKIE_MAX_AGE = 86400;
const SECRET = '${secretSeed}';

function ipInRange(ip, cidr) {
  if (!cidr.includes('/')) return ip === cidr;
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  const ipNum = ip.split('.').reduce((a, o) => (a << 8) + parseInt(o), 0);
  const rangeNum = range.split('.').reduce((a, o) => (a << 8) + parseInt(o), 0);
  return (ipNum & mask) === (rangeNum & mask);
}

async function hmac(message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

async function verifyCookie(cookieHeader) {
  if (!cookieHeader) return false;
  const match = cookieHeader.match(new RegExp(COOKIE_NAME + '=([^;]+)'));
  if (!match) return false;
  try {
    const decoded = decodeURIComponent(match[1]);
    const [ts, sig] = atob(decoded).split('|');
    const age = Math.floor(Date.now() / 1000) - parseInt(ts);
    if (isNaN(age) || age < 0 || age > COOKIE_MAX_AGE) return false;
    const expected = await hmac(ts);
    return sig === expected;
  } catch { return false; }
}

async function makeCookieValue() {
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = await hmac(ts);
  return btoa(ts + '|' + sig);
}

function challengePage(originalUrl) {
  const safeUrl = encodeURIComponent(originalUrl);
  return \`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Security Check</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#e0e0e0;display:flex;justify-content:center;align-items:center;min-height:100vh}.c{text-align:center;padding:40px;max-width:420px}.s{width:40px;height:40px;border:3px solid #333;border-top-color:#4f8fff;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 24px}@keyframes spin{to{transform:rotate(360deg)}}.t{font-size:18px;margin-bottom:8px;color:#fff}.d{color:#888;font-size:14px}.p{margin-top:20px;height:4px;background:#222;border-radius:2px;overflow:hidden}.pb{height:100%;background:linear-gradient(90deg,#4f8fff,#7c5cff);width:0%;transition:width 0.3s;border-radius:2px}.f{margin-top:16px;color:#555;font-size:12px}</style>
</head><body><div class="c"><div class="s"></div><div class="t">Verifying your browser</div><div class="d">This is an automatic security check</div><div class="p"><div class="pb" id="pb"></div></div><div class="f" id="st">Please wait...</div></div>
<script>
(function(){
  var sc=0,pb=document.getElementById('pb'),st=document.getElementById('st');
  function up(p,t){pb.style.width=p+'%';st.textContent=t;}
  up(10,'Checking browser environment...');
  if(navigator.webdriver)sc+=40;
  if(/HeadlessChrome|PhantomJS|Nightmare/.test(navigator.userAgent))sc+=50;
  if(navigator.plugins.length===0&&!/Mobile|Android|iPhone/.test(navigator.userAgent))sc+=15;
  if(!navigator.languages||navigator.languages.length===0)sc+=20;
  if(window._phantom||window.__nightmare||window.callPhantom)sc+=50;
  if(document.__selenium_unwrapped||document.__webdriver_evaluate||document.__driver_evaluate)sc+=50;
  if(window.chrome===undefined&&/Chrome/.test(navigator.userAgent)&&!/Edge|Edg|OPR/.test(navigator.userAgent))sc+=25;
  try{var c=document.createElement('canvas'),g=c.getContext('2d');g.fillText('ar',2,2);if(c.toDataURL().length<500)sc+=20;}catch(e){sc+=10;}
  var cn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  if(cn&&cn.rtt===0&&!/localhost/.test(location.hostname))sc+=15;
  if(!window.requestAnimationFrame)sc+=10;
  try{if(window.outerWidth===0||window.outerHeight===0)sc+=20;}catch(e){}
  setTimeout(function(){up(40,'Verifying identity...');},500);
  setTimeout(function(){up(70,'Almost done...');},1500);
  setTimeout(function(){
    if(sc>=40){
      up(100,'Verification failed');
      st.style.color='#f44';
      document.querySelector('.s').style.borderTopColor='#f44';
      document.querySelector('.s').style.animationPlayState='paused';
      return;
    }
    up(100,'Verified ✓');
    st.style.color='#4ade80';
    document.querySelector('.s').style.display='none';
    var verifyUrl='/__ar_verify?r=\${safeUrl}&t='+Math.floor(Date.now()/1000);
    setTimeout(function(){window.location.href=verifyUrl;},300);
  },2500);
})();
</script></body></html>\`;
}

async function handleRequest(request) {
  const ua = request.headers.get('User-Agent') || '';
  const url = new URL(request.url);
  const ip = request.headers.get('CF-Connecting-IP') || '';

  // 1. Block known scanner UAs immediately
  if (!ua || BLOCKED_UAS.some(b => ua.includes(b))) {
    return new Response('<!DOCTYPE html><html><body><h1>403 Forbidden</h1></body></html>', {
      status: 403, headers: { 'Content-Type': 'text/html', 'X-AntiRed': 'blocked-ua' },
    });
  }

  // 2. Block known scanner IPs
  if (ip && SCANNER_IPS.some(cidr => ipInRange(ip, cidr))) {
    return new Response('<!DOCTYPE html><html><body><h1>403 Forbidden</h1></body></html>', {
      status: 403, headers: { 'Content-Type': 'text/html', 'X-AntiRed': 'blocked-ip' },
    });
  }

  // 3. Skip challenge for static assets
  const ext = url.pathname.split('.').pop().toLowerCase();
  const staticExts = ['css','js','png','jpg','jpeg','gif','svg','ico','woff','woff2','ttf','eot','map','xml','txt','pdf','zip','mp4','mp3','webp','avif','webmanifest'];
  if (staticExts.includes(ext)) {
    return fetch(request);
  }

  // 4. Handle verification redirect — set cookie and redirect to original URL
  if (url.pathname === '/__ar_verify') {
    const returnUrl = url.searchParams.get('r') || '/';
    const timestamp = url.searchParams.get('t');

    // Verify timestamp is recent (within 30 seconds) to prevent replay attacks
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp);
    if (isNaN(ts) || Math.abs(now - ts) > 30) {
      // Expired or invalid — redirect back to challenge
      return Response.redirect(url.origin + decodeURIComponent(returnUrl), 302);
    }

    // Generate signed cookie
    const cookieValue = await makeCookieValue();
    const expiry = new Date(Date.now() + COOKIE_MAX_AGE * 1000).toUTCString();

    return new Response(null, {
      status: 302,
      headers: {
        'Location': decodeURIComponent(returnUrl),
        'Set-Cookie': COOKIE_NAME + '=' + encodeURIComponent(cookieValue) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=' + expiry,
        'Cache-Control': 'no-store, no-cache',
        'X-AntiRed': 'cookie-set',
      },
    });
  }

  // 5. Check for valid challenge cookie
  const cookies = request.headers.get('Cookie') || '';
  if (await verifyCookie(cookies)) {
    // Cookie valid — pass through to origin
    const response = await fetch(request);
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-AntiRed', 'verified');
    return new Response(response.body, { status: response.status, headers: newHeaders });
  }

  // 6. No valid cookie — serve challenge page (NEVER show origin content)
  return new Response(challengePage(url.pathname + url.search), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache',
      'X-AntiRed': 'challenge',
    },
  });
}
`
}

/**
 * Upload/update the shared 'antired-challenge' worker script to Cloudflare.
 * This is the hardened version with cookie-gated challenge.
 */
async function upgradeSharedWorker() {
  const CF_API_KEY = process.env.CLOUDFLARE_API_KEY
  const CF_EMAIL = process.env.CLOUDFLARE_EMAIL
  const ACCOUNT_ID = 'ed6035ebf6bd3d85f5b26c60189a21e2' // From CF account

  if (!CF_API_KEY || !CF_EMAIL) {
    return { success: false, error: 'Missing Cloudflare credentials' }
  }

  const workerScript = generateHardenedWorkerScript()

  try {
    const res = await axios.put(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/antired-challenge`,
      workerScript,
      {
        headers: {
          'X-Auth-Email': CF_EMAIL,
          'X-Auth-Key': CF_API_KEY,
          'Content-Type': 'application/javascript',
        },
        timeout: 30000,
      }
    )
    const ok = res.data?.success !== false
    log(`[AntiRed] Shared worker upgraded: ${ok ? 'OK' : 'FAIL'}`)
    return { success: ok }
  } catch (err) {
    log(`[AntiRed] Shared worker upgrade error: ${err.message}`)
    return { success: false, error: err.message }
  }
}

/**
 * Deploy ALL anti-red protections for a hosting account
 */
async function deployFullProtection(cpUsername, domain, plan = '') {
  const results = {
    htaccess: { success: false },
    jsChallenge: { success: false },
    ja3Rules: { success: false },
    antiPhishingCfRules: { success: false },
    cfWorker: { success: false },
  }

  log(`[AntiRed] Deploying full protection for ${cpUsername}@${domain} (${plan})`)

  // 1. Deploy .htaccess scanner IP cloaking + UA blocking (all plans)
  results.htaccess = await deployHtaccess(cpUsername, domain)

  // 2. Deploy JS Challenge via .user.ini + static site wrapper if needed (all plans)
  const jsResult = await deployJSChallenge(cpUsername)
  results.jsChallenge = jsResult

  // 3. Deploy Cloudflare-level protections
  try {
    const cfService = require('./cf-service')
    const zone = await cfService.getZoneByName(domain)
    if (zone) {
      // 3a. JA3 fingerprinting via Cloudflare WAF
      results.ja3Rules = await createJA3Rules(zone.id)

      // 3b. Anti-phishing scanner UA blocking at CF edge (critical for CF-proxied sites)
      results.antiPhishingCfRules = await createAntiPhishingScannerRules(zone.id)

      // 3c. Set anti-bot profile level based on plan
      if (plan.toLowerCase().includes('golden')) {
        await cfService.setAntiBotProfile(zone.id, 'high')
      } else {
        await cfService.setAntiBotProfile(zone.id, 'medium')
      }
      await cfService.createAntiBotRules(zone.id)

      // 3d. Deploy shared Cloudflare Worker routes (3 routes: domain/*, domain, www.domain/*)
      results.cfWorker = await deploySharedWorkerRoute(domain, zone.id)
    } else {
      results.ja3Rules = { success: false, error: 'Cloudflare zone not found' }
      results.antiPhishingCfRules = { success: false, error: 'Cloudflare zone not found' }
      results.cfWorker = { success: false, error: 'Cloudflare zone not found' }
    }
  } catch (err) {
    log(`[AntiRed] Cloudflare protection error: ${err.message}`)
    results.ja3Rules = { success: false, error: err.message }
    results.antiPhishingCfRules = { success: false, error: err.message }
    results.cfWorker = { success: false, error: err.message }
  }

  log(`[AntiRed] Protection deployed for ${domain}: htaccess=${results.htaccess.success}, js=${results.jsChallenge.success}, ja3=${results.ja3Rules.success}, antiPhishCF=${results.antiPhishingCfRules.success}, cfWorker=${results.cfWorker.success}`)
  return { success: results.htaccess.success || results.jsChallenge.success, ...results }
}

/**
 * Remove Cloudflare Worker routes for a domain.
 * This stops the "Verifying your browser" challenge page from showing.
 * Other protections (IP blocking, UA blocking, JA3, WAF) remain active.
 */
async function removeWorkerRoutes(domain, zoneId) {
  const CF_API_KEY = process.env.CLOUDFLARE_API_KEY
  const CF_EMAIL = process.env.CLOUDFLARE_EMAIL

  if (!CF_API_KEY || !CF_EMAIL || !zoneId) {
    return { success: false, error: 'Missing Cloudflare credentials or zoneId' }
  }

  const cfHeaders = {
    'X-Auth-Email': CF_EMAIL,
    'X-Auth-Key': CF_API_KEY,
    'Content-Type': 'application/json',
  }

  try {
    // Get all worker routes for this zone
    const routesRes = await axios.get(
      `${CF_BASE}/zones/${zoneId}/workers/routes`,
      { headers: cfHeaders, timeout: 10000 }
    )
    const routes = routesRes.data?.result || []

    // Find routes matching this domain (domain/*, www.domain/*, and bare domain)
    const toRemove = routes.filter(r =>
      r.pattern === `${domain}/*` || r.pattern === `www.${domain}/*` || r.pattern === domain
    )

    const removed = []
    for (const route of toRemove) {
      try {
        await axios.delete(
          `${CF_BASE}/zones/${zoneId}/workers/routes/${route.id}`,
          { headers: cfHeaders, timeout: 10000 }
        )
        removed.push(route.pattern)
      } catch (e) {
        log(`[AntiRed] Failed to remove worker route ${route.pattern}: ${e.message}`)
      }
    }

    log(`[AntiRed] Removed ${removed.length} worker routes for ${domain}: ${removed.join(', ') || 'none found'}`)
    return { success: true, removed }
  } catch (err) {
    log(`[AntiRed] Error removing worker routes for ${domain}: ${err.message}`)
    return { success: false, error: err.message }
  }
}

module.exports = {
  generateHtaccessRules,
  deployHtaccess,
  generateJSChallenge,
  generateChallengePhp,
  ensurePhpEntrypoint,
  deployJSChallenge,
  removeJSChallenge,
  isJSChallengeEnabled,
  createJA3Rules,
  createAntiPhishingScannerRules,
  deployCFWorker,
  deploySharedWorkerRoute,
  removeWorkerRoutes,
  upgradeSharedWorker,
  generateHardenedWorkerScript,
  deployFullProtection,
  SCANNER_IP_RANGES,
  SCANNER_USER_AGENTS,
  SCANNER_JA3_HASHES,
}
