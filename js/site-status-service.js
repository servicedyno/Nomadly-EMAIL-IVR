/* global process */
/**
 * Site Status Service — encapsulates "Take site offline / Bring back online".
 *
 * Two offline modes:
 *   - 'suspended':   WHM suspendacct → blocks HTTP, FTP, email, databases atomically.
 *                    Visitor sees the standard cPanel "Account Suspended" page.
 *   - 'maintenance': writes a clean maintenance.html to public_html and prepends a
 *                    503-redirect block (delimited by BEGIN/END NOMADLY MAINTENANCE
 *                    markers) to .htaccess. HTTP visitors see a friendly "We'll be
 *                    back soon" page; email/FTP/databases keep working.
 *
 * Going back online cleanly reverses whichever mode is active.
 *
 * IMPORTANT — this is a visibility toggle ONLY. It does NOT pause:
 *   - The expiry countdown
 *   - Auto-renewal billing
 * The UI layers (bot + web panel) MUST surface this prominently before users flip.
 */

const cpProxy = require('./cpanel-proxy')
const cpAuth = require('./cpanel-auth')
const whmService = require('./whm-service')
const { log } = require('console')

const HTACCESS_BEGIN = '# BEGIN NOMADLY MAINTENANCE'
const HTACCESS_END   = '# END NOMADLY MAINTENANCE'

const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>We'll be back soon</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif;
      background: #0f0f17;
      color: #f3f4f6;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .wrap { max-width: 520px; text-align: center; }
    .logo {
      width: 56px; height: 56px;
      margin: 0 auto 24px;
      border-radius: 14px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      display: flex; align-items: center; justify-content: center;
    }
    h1 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 15px;
      line-height: 1.65;
      color: #b8b8c8;
      margin-bottom: 8px;
    }
    .meta {
      margin-top: 24px;
      font-size: 13px;
      color: #6b6b80;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    </div>
    <h1>We'll be back soon</h1>
    <p>This site is temporarily offline for maintenance.</p>
    <p>Please check back in a little while.</p>
    <div class="meta">If you're the site owner, sign in to your hosting panel to bring the site back online.</div>
  </div>
</body>
</html>
`

const HTACCESS_BLOCK = [
  HTACCESS_BEGIN,
  '# Auto-managed by Nomadly. Do not edit between BEGIN/END markers.',
  '<IfModule mod_rewrite.c>',
  '  RewriteEngine On',
  '  RewriteCond %{REQUEST_URI} !^/maintenance\\.html$',
  '  RewriteCond %{REQUEST_URI} !\\.(css|js|png|jpe?g|gif|svg|ico|woff2?)$',
  '  RewriteRule ^.*$ /maintenance.html [R=503,L]',
  '</IfModule>',
  '<IfModule mod_headers.c>',
  '  Header set Retry-After "3600"',
  '</IfModule>',
  'ErrorDocument 503 /maintenance.html',
  HTACCESS_END,
].join('\n')

/**
 * Decrypt cPanel password from an account record.
 */
function decryptCpPass(account) {
  if (!account?.cpPass_encrypted) return null
  try {
    return cpAuth.decrypt({
      encrypted: account.cpPass_encrypted,
      iv: account.cpPass_iv,
      tag: account.cpPass_tag,
    })
  } catch (err) {
    log(`[SiteStatus] decrypt error for ${account.cpUser}: ${err.message}`)
    return null
  }
}

/**
 * Strip any existing Nomadly-managed maintenance block from an .htaccess body.
 * Idempotent — safe to call when no block is present.
 */
function stripMaintenanceBlock(body) {
  if (!body) return ''
  const re = new RegExp(`(?:^|\\n)${escapeRegex(HTACCESS_BEGIN)}[\\s\\S]*?${escapeRegex(HTACCESS_END)}\\n?`, 'g')
  return body.replace(re, '').replace(/^\n+/, '')
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Enable maintenance mode on a cPanel account.
 *  - Writes /public_html/maintenance.html
 *  - Prepends the redirect block to /public_html/.htaccess
 */
async function enableMaintenanceMode(account) {
  const cpPass = decryptCpPass(account)
  if (!cpPass) return { ok: false, error: 'Failed to decrypt cPanel password.' }
  const host = account.whmHost || process.env.WHM_HOST
  const dir = '/public_html'

  // 1. Write maintenance.html (overwrite; idempotent)
  const writeMaint = await cpProxy.saveFileContent(account.cpUser, cpPass, dir, 'maintenance.html', MAINTENANCE_HTML, host)
  if (writeMaint?.errors && writeMaint.errors.length) {
    log(`[SiteStatus] write maintenance.html failed for ${account.cpUser}: ${JSON.stringify(writeMaint.errors)}`)
    return { ok: false, error: 'Could not write maintenance page.' }
  }

  // 2. Read existing .htaccess (may not exist)
  let existing = ''
  try {
    const read = await cpProxy.getFileContent(account.cpUser, cpPass, dir, '.htaccess', host)
    existing = (read && read.data && (read.data.content || read.data.contents)) || ''
  } catch (_) {
    existing = ''
  }

  // 3. Strip any prior block we left, then prepend a fresh one
  const cleaned = stripMaintenanceBlock(existing)
  const newBody = HTACCESS_BLOCK + (cleaned ? '\n\n' + cleaned : '\n')

  const writeHt = await cpProxy.saveFileContent(account.cpUser, cpPass, dir, '.htaccess', newBody, host)
  if (writeHt?.errors && writeHt.errors.length) {
    log(`[SiteStatus] write .htaccess failed for ${account.cpUser}: ${JSON.stringify(writeHt.errors)}`)
    return { ok: false, error: 'Could not update .htaccess.' }
  }

  return { ok: true }
}

/**
 * Disable maintenance mode — strips the Nomadly block from .htaccess.
 * Leaves maintenance.html in place (harmless; user may want to keep it).
 */
async function disableMaintenanceMode(account) {
  const cpPass = decryptCpPass(account)
  if (!cpPass) return { ok: false, error: 'Failed to decrypt cPanel password.' }
  const host = account.whmHost || process.env.WHM_HOST
  const dir = '/public_html'

  let existing = ''
  try {
    const read = await cpProxy.getFileContent(account.cpUser, cpPass, dir, '.htaccess', host)
    existing = (read && read.data && (read.data.content || read.data.contents)) || ''
  } catch (_) {
    return { ok: true } // No .htaccess, nothing to undo
  }

  const cleaned = stripMaintenanceBlock(existing)
  if (cleaned === existing) return { ok: true } // Nothing to remove

  const writeHt = await cpProxy.saveFileContent(account.cpUser, cpPass, dir, '.htaccess', cleaned, host)
  if (writeHt?.errors && writeHt.errors.length) {
    log(`[SiteStatus] cleanup .htaccess failed for ${account.cpUser}: ${JSON.stringify(writeHt.errors)}`)
    return { ok: false, error: 'Could not update .htaccess.' }
  }

  return { ok: true }
}

/**
 * Suspend a cPanel account via WHM (full HTTP+FTP+email+DB block).
 */
async function suspend(account, reason = 'Taken offline by user') {
  const ok = await whmService.suspendAccount(account.cpUser, reason)
  return ok ? { ok: true } : { ok: false, error: 'WHM suspend failed.' }
}

/**
 * Unsuspend a cPanel account via WHM.
 */
async function unsuspend(account) {
  const ok = await whmService.unsuspendAccount(account.cpUser)
  return ok ? { ok: true } : { ok: false, error: 'WHM unsuspend failed.' }
}

/**
 * Read the current site status for an account record.
 * Returns one of: 'online' | 'suspended' | 'maintenance'.
 */
function readStatus(account) {
  if (!account) return 'online'
  if (account.suspended) return 'suspended'
  if (account.maintenanceMode) return 'maintenance'
  return 'online'
}

module.exports = {
  enableMaintenanceMode,
  disableMaintenanceMode,
  suspend,
  unsuspend,
  readStatus,
  // Exported for tests
  _stripMaintenanceBlock: stripMaintenanceBlock,
  HTACCESS_BEGIN,
  HTACCESS_END,
}
