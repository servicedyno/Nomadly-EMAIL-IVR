/* global process */
/**
 * cPanel UAPI Proxy Service
 * Proxies requests to cPanel UAPI, hiding the server IP from the frontend.
 * All responses are sanitized to remove server IP references.
 *
 * Supports per-account WHM host override — accounts created on different
 * servers use their stored whmHost instead of the global WHM_HOST.
 */

const axios = require('axios')
const https = require('https')
const { log } = require('console')
const FormData = require('form-data')

const WHM_HOST = process.env.WHM_HOST
const CPANEL_PORT = 2083
// ── Tunnel routing (origin-IP-hidden) ──
// When CPANEL_API_URL is set, every cPanel UAPI call is routed through that
// URL instead of `https://<WHM_HOST>:2083`. Used to route through Cloudflare
// Tunnel so the origin IP and ports 2083/2087 can stay locked down.
// Example value: "https://cpanel-api.hostbay.io"
const CPANEL_API_URL = (process.env.CPANEL_API_URL || '').replace(/\/+$/, '')

// Cloudflare Access service token (Zero Trust). When set, every request to
// the tunneled cPanel hostname carries CF-Access-Client-Id/Secret headers so
// the public-facing tunnel hostname is auth-locked to the bot.
const CF_ACCESS_CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID || ''
const CF_ACCESS_CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET || ''
const _accessHeaders = (CF_ACCESS_CLIENT_ID && CF_ACCESS_CLIENT_SECRET)
  ? { 'CF-Access-Client-Id': CF_ACCESS_CLIENT_ID, 'CF-Access-Client-Secret': CF_ACCESS_CLIENT_SECRET }
  : {}
function _maybeAccessHeaders(url) {
  return CPANEL_API_URL && url && url.startsWith(CPANEL_API_URL) ? _accessHeaders : {}
}

// Accept self-signed certs on WHM
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

// ─── Connection-level error detection ───────────────────
// When axios fails because the cPanel control plane is down (host refusing
// connections, license invalid → cpsrvd not running, network drop), the user
// should NEVER see raw "ECONNREFUSED" or server IPs. We tag the response with
// code: 'CPANEL_DOWN' so callers can switch to friendly UX + queue the action.

const WHM_CONNECT_ERR_RX = /ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up|connect ETIMEDOUT|connect ECONN/i
function isControlPlaneDown(err) {
  if (!err) return false
  if (err.response) return false // got an HTTP response — server up
  if (err.code && WHM_CONNECT_ERR_RX.test(err.code)) return true
  if (err.message && WHM_CONNECT_ERR_RX.test(err.message)) return true
  return false
}

// Throttled admin alert — first downward transition + a reminder every 15min.
let _lastDownAlertAt = 0
const DOWN_ALERT_THROTTLE_MS = 15 * 60 * 1000
let _adminNotifier = null
function setAdminNotifier(fn) { if (typeof fn === 'function') _adminNotifier = fn }
function _adminAlertDown(reason, host) {
  const now = Date.now()
  if (now - _lastDownAlertAt < DOWN_ALERT_THROTTLE_MS) return
  // Defensive: never page the admin for an obviously-fake hostname.
  // Test fixtures historically used "test" / "test.host" — those rows can
  // end up in the DB via the captcha seed script and would otherwise spam
  // the admin chat with ENOTFOUND every time someone touches them.
  const h = String(host || '').toLowerCase()
  if (!h || h === 'test' || h === 'test.host' || h === 'localhost' || h === '127.0.0.1') return
  _lastDownAlertAt = now
  if (!_adminNotifier) return
  try {
    _adminNotifier(
      `🚨 <b>cPanel control plane unreachable</b>\n` +
      `Host: <code>${host || WHM_HOST}</code>\n` +
      `Reason: <code>${reason}</code>\n` +
      `<i>New users continue to check out (provisioning is queued). Existing-user mutations are queued. Check /hostingstatus.</i>`
    )
  } catch (e) { log(`[cPanel Proxy] admin alert error: ${e.message}`) }
}

// ─── Helpers ────────────────────────────────────────────

function getBaseUrl(host) {
  // Route every call for the default/shared WHM server through the CF tunnel
  // (`CPANEL_API_URL`, e.g. https://cpanel-api.hostbay.io) when one is
  // configured. This is critical: the DO firewall lockdown blocks direct
  // access to the origin IP on port 2083, so accounts whose stored
  // `whmHost` equals the default `WHM_HOST` MUST be normalised onto the
  // tunnel — otherwise the UAPI call times out silently and the panel shows
  // "This folder is empty" (see @ciroovblzz production report where the
  // website served files fine but /files returned nothing because
  // Fileman::list_files couldn't reach 209.38.241.9:2083).
  //
  // Only resellers on a genuinely DIFFERENT WHM box get direct routing —
  // those servers aren't behind our tunnel.
  if (CPANEL_API_URL && (!host || host === WHM_HOST)) return CPANEL_API_URL
  const effectiveHost = host || WHM_HOST
  return `https://${effectiveHost}:${CPANEL_PORT}`
}

// Friendly user-facing copy in every language the bot/frontend supports.
// Returned alongside `code: 'CPANEL_DOWN'` so callers can pick by user lang.
const DOWN_MESSAGES = {
  en: 'Hosting service is temporarily unavailable. Please try again in a few minutes — your data is safe.',
  fr: "Le service d'hébergement est temporairement indisponible. Veuillez réessayer dans quelques minutes — vos données sont en sécurité.",
  zh: '主机服务暂时不可用，请几分钟后再试 — 您的数据是安全的。',
  hi: 'होस्टिंग सेवा अस्थायी रूप से अनुपलब्ध है। कृपया कुछ मिनटों में फिर से प्रयास करें — आपका डेटा सुरक्षित है।',
}
function getDownMessage(lang) {
  return DOWN_MESSAGES[lang] || DOWN_MESSAGES.en
}

function downResponse(reason) {
  return {
    status: 0,
    code: 'CPANEL_DOWN',
    // English fallback for legacy callers; localized variants for i18n-aware ones
    errors: [DOWN_MESSAGES.en],
    localizedMessages: DOWN_MESSAGES,
    data: null,
    _internalReason: reason,
  }
}

// ─── Sanitization ───────────────────────────────────────

function sanitizeString(str, extraHost) {
  if (!str || typeof str !== 'string') return str
  // Replace server IP with [server]
  if (WHM_HOST) {
    str = str.split(WHM_HOST).join('[server]')
  }
  if (extraHost && extraHost !== WHM_HOST) {
    str = str.split(extraHost).join('[server]')
  }
  // Also strip common cPanel port references
  str = str.replace(/:2083/g, '').replace(/:2087/g, '').replace(/:2096/g, '')
  return str
}

function sanitize(obj, extraHost) {
  if (typeof obj === 'string') return sanitizeString(obj, extraHost)
  if (Array.isArray(obj)) return obj.map(o => sanitize(o, extraHost))
  if (obj && typeof obj === 'object') {
    const clean = {}
    for (const [k, v] of Object.entries(obj)) {
      clean[k] = sanitize(v, extraHost)
    }
    return clean
  }
  return obj
}

// ─── Core UAPI call ─────────────────────────────────────

// Idempotent UAPI reads that are safe to auto-retry ONCE on a transient
// upstream timeout. These are pure GETs — they don't mutate cPanel state, so
// a retry can only recover from a flaky control-plane blip (which the Railway
// logs show is the dominant failure pattern: a single 30s timeout surrounded
// by successful calls within a few seconds). This directly addresses the
// @ciroovblzz post-login "error screen" reports.
const RETRY_SAFE_UAPI = new Set([
  'Fileman::list_files',
  'Fileman::get_file_content',
  'DomainInfo::list_domains',
  'DomainInfo::domains_data',
  'DomainInfo::single_domain_data',
  'SSL::installed_hosts',
  'StatsBar::get_stats',
  'Quota::get_quota_info',
])
const UPSTREAM_TIMEOUT_RX = /ECONNABORTED|ETIMEDOUT|timeout of \d+ms exceeded/i

async function uapi(cpUser, cpPass, module, func, params = {}, method = 'GET', host = null) {
  const baseUrl = getBaseUrl(host)
  const url = `${baseUrl}/execute/${module}/${func}`
  const auth = { username: cpUser, password: cpPass }
  const headers = _maybeAccessHeaders(baseUrl)
  const key = `${module}::${func}`

  const doCall = async () => {
    if (method === 'GET') {
      return axios.get(url, { params, auth, httpsAgent, timeout: 30000, headers })
    }
    return axios.post(url, params, { auth, httpsAgent, timeout: 30000, headers })
  }

  try {
    let res
    try {
      res = await doCall()
    } catch (err) {
      // Single retry on transient timeouts for known-idempotent reads — the
      // panel would otherwise surface a jarring "timeout of 30000ms exceeded"
      // banner right after login while the cPanel control plane is recovering.
      const transient = UPSTREAM_TIMEOUT_RX.test(err.code || '') || UPSTREAM_TIMEOUT_RX.test(err.message || '')
      if (transient && RETRY_SAFE_UAPI.has(key)) {
        log(`[cPanel Proxy] ${key} transient timeout — retrying once`)
        await new Promise(r => setTimeout(r, 500))
        res = await doCall()
      } else {
        throw err
      }
    }

    const data = res.data
    // Sanitize: strip server IP from response
    return sanitize(data, host)
  } catch (err) {
    if (isControlPlaneDown(err)) {
      log(`[cPanel Proxy] ${module}::${func} CPANEL_DOWN (${err.code || err.message})`)
      _adminAlertDown(err.code || err.message, host || WHM_HOST)
      return downResponse(err.code || err.message)
    }
    const status = err.response?.status
    const msg = err.response?.data?.errors?.[0] || err.message
    log(`[cPanel Proxy] ${module}::${func} error (${status}): ${msg}`)
    return { status: 0, errors: [sanitizeString(String(msg), host)], data: null }
  }
}

/**
 * Upload file to cPanel via multipart/form-data
 */
async function uploadFile(cpUser, cpPass, dir, fileName, fileBuffer, host = null) {
  const baseUrl = getBaseUrl(host)
  const url = `${baseUrl}/execute/Fileman/upload_files`
  const auth = { username: cpUser, password: cpPass }

  const form = new FormData()
  form.append('dir', dir)
  form.append('file-1', fileBuffer, { filename: fileName })

  try {
    const res = await axios.post(url, form, {
      auth,
      httpsAgent,
      timeout: 120000,
      headers: { ...form.getHeaders(), ..._maybeAccessHeaders(baseUrl) },
      maxContentLength: 100 * 1024 * 1024, // 100MB
    })
    return sanitize(res.data, host)
  } catch (err) {
    if (isControlPlaneDown(err)) {
      log(`[cPanel Proxy] Fileman::upload_files CPANEL_DOWN (${err.code || err.message})`)
      _adminAlertDown(err.code || err.message, host || WHM_HOST)
      return downResponse(err.code || err.message)
    }
    log(`[cPanel Proxy] Fileman::upload_files error: ${err.message}`)
    return { status: 0, errors: [sanitizeString(err.message, host)], data: null }
  }
}

// ─── cPanel API2 call (for functions not available in UAPI) ──
// Normalizes API2 response to match UAPI format: { status, data, errors }

async function api2(cpUser, cpPass, module, func, params = {}, host = null) {
  const baseUrl = getBaseUrl(host)
  const url = `${baseUrl}/json-api/cpanel`
  const auth = { username: cpUser, password: cpPass }
  const queryParams = {
    cpanel_jsonapi_user: cpUser,
    cpanel_jsonapi_apiversion: 2,
    cpanel_jsonapi_module: module,
    cpanel_jsonapi_func: func,
    ...params,
  }

  try {
    const res = await axios.get(url, { params: queryParams, auth, httpsAgent, timeout: 60000, headers: _maybeAccessHeaders(baseUrl) })
    const raw = sanitize(res.data, host)

    // Normalize API2 response to UAPI-like format
    const cp = raw?.cpanelresult || {}
    const eventOk = cp.event?.result === 1
    const dataArr = cp.data || []
    const opOk = dataArr.length > 0 && dataArr[0]?.result === 1
    const errors = []
    if (!eventOk || !opOk) {
      const reason = dataArr[0]?.reason || cp.error || 'Operation failed'
      errors.push(sanitizeString(String(reason), host))
    }

    return {
      status: (eventOk && opOk) ? 1 : 0,
      data: dataArr,
      errors: errors.length ? errors : null,
      messages: null,
      metadata: {},
    }
  } catch (err) {
    if (isControlPlaneDown(err)) {
      log(`[cPanel Proxy API2] ${module}::${func} CPANEL_DOWN (${err.code || err.message})`)
      _adminAlertDown(err.code || err.message, host || WHM_HOST)
      return downResponse(err.code || err.message)
    }
    const status = err.response?.status
    const msg = err.response?.data?.errors?.[0] || err.message
    log(`[cPanel Proxy API2] ${module}::${func} error (${status}): ${msg}`)
    return { status: 0, errors: [sanitizeString(String(msg), host)], data: null }
  }
}

// ─── High-level operations ──────────────────────────────

// FILE MANAGER

async function listFiles(cpUser, cpPass, dir = '/public_html', host = null) {
  return uapi(cpUser, cpPass, 'Fileman', 'list_files', {
    dir,
    include_mime: 1,
    include_permissions: 1,
    include_hash: 0,
    include_content: 0,
    types: 'dir|file',
  }, 'GET', host)
}

async function getFileContent(cpUser, cpPass, dir, file, host = null) {
  return uapi(cpUser, cpPass, 'Fileman', 'get_file_content', { dir, file }, 'GET', host)
}

async function saveFileContent(cpUser, cpPass, dir, file, content, host = null) {
  return uapi(cpUser, cpPass, 'Fileman', 'save_file_content', { dir, file, content }, 'POST', host)
}

async function createDirectory(cpUser, cpPass, dir, name, host = null) {
  const result = await api2(cpUser, cpPass, 'Fileman', 'mkdir', {
    path: dir,
    name: name,
  }, host)
  // api2 normalizer misreads mkdir success — check data for actual result
  if (result.data?.length > 0 && result.data[0]?.path && result.data[0]?.name) {
    result.status = 1
    result.errors = null
  }
  return result
}

/**
 * Run a single Fileman::fileop deletion attempt. Returns the raw api2 result.
 */
async function _fileopDelete(cpUser, cpPass, dir, file, op, host) {
  return api2(cpUser, cpPass, 'Fileman', 'fileop', {
    doubledecode: 0,
    op,
    sourcefiles: `${dir}/${file}`,
  }, host)
}

/**
 * Verify a target file/dir is no longer present in `dir` by listing the parent.
 * Returns true when target is gone, false when it still appears, null if the
 * listing call itself failed (treat null as "unknown — assume best").
 */
async function _verifyDeleted(cpUser, cpPass, dir, file, host) {
  try {
    const listing = await listFiles(cpUser, cpPass, dir, host)
    const items = listing?.data || []
    if (!Array.isArray(items)) return null
    return !items.some(f => f && (f.file === file || f.fullname === file))
  } catch (_) {
    return null
  }
}

async function deleteFile(cpUser, cpPass, dir, file, host = null, isDirectory = false) {
  // cPanel API2 Fileman::fileop quirks observed on production WHM 11.x:
  //   • op=unlink     → reliably deletes FILES.
  //                     For directories it returns result=1 BUT the dir is NOT removed
  //                     (silent no-op — see @Thebiggestbag22 "BlueFCU_Upload_Ready"
  //                     bug Apr 2026, reproduced live against panel.1.hostbay.io).
  //   • op=killdir    → "Unknown operation sent to api2_fileop" on current cPanel
  //                     servers (deprecated).
  //   • op=trash      → ✅ works for BOTH files and directories. Moves the item
  //                     to ~/.trash/, fully removed from the visible tree.
  //                     Verified end-to-end on production cPanel WHM 11.x.
  //
  // Strategy:
  //   1. Try the preferred op (trash for dirs, unlink for files).
  //   2. Verify by re-listing the parent dir — if the target is still there,
  //      retry with the alternate op (the silent-no-op guard suggested by the
  //      BlueFCU post-mortem).
  //   3. Re-verify. If still present, surface a clear error to the caller.
  const primary = isDirectory ? 'trash' : 'unlink'
  const fallback = isDirectory ? 'unlink' : 'trash'

  let result = await _fileopDelete(cpUser, cpPass, dir, file, primary, host)
  let gone = await _verifyDeleted(cpUser, cpPass, dir, file, host)

  if (gone === false) {
    // Silent no-op detected — try the alternate op.
    const fallbackResult = await _fileopDelete(cpUser, cpPass, dir, file, fallback, host)
    const goneAfter = await _verifyDeleted(cpUser, cpPass, dir, file, host)
    if (goneAfter === false) {
      return {
        ...result,
        status: 0,
        errors: [
          `Both '${primary}' and '${fallback}' returned success but the target is still present. ` +
          `Permission issue or read-only filesystem? Original op response was kept above.`,
        ],
        attempted_ops: [primary, fallback],
        fallback_response: fallbackResult,
      }
    }
    // Fallback worked — promote it.
    return {
      ...fallbackResult,
      status: 1,
      attempted_ops: [primary, fallback],
      verified_via: 'fallback',
    }
  }

  // Primary worked (or verification failed but we'll trust the API's success).
  if (gone === true) {
    return { ...result, status: 1, attempted_ops: [primary], verified_via: 'primary' }
  }
  return result
}

async function renameFile(cpUser, cpPass, dir, oldName, newName, host = null) {
  return api2(cpUser, cpPass, 'Fileman', 'fileop', {
    doubledecode: 0,
    op: 'rename',
    sourcefiles: `${dir}/${oldName}`,
    destfiles: `${dir}/${newName}`,
  }, host)
}

async function extractFile(cpUser, cpPass, dir, file, destDir, host = null) {
  // Extract uses API2 (UAPI has no fileop equivalent)
  return api2(cpUser, cpPass, 'Fileman', 'fileop', {
    doubledecode: 0,
    op: 'extract',
    sourcefiles: `${dir}/${file}`,
    destfiles: destDir || dir,
  }, host)
}

async function compressFiles(cpUser, cpPass, dir, files, destFile, host = null) {
  return api2(cpUser, cpPass, 'Fileman', 'fileop', {
    doubledecode: 0,
    op: 'compress',
    sourcefiles: files.map(f => `${dir}/${f}`).join('\n'),
    destfiles: `${dir}/${destFile}`,
  }, host)
}

async function copyFile(cpUser, cpPass, sourceDir, fileName, destDir, host = null) {
  return api2(cpUser, cpPass, 'Fileman', 'fileop', {
    doubledecode: 0,
    op: 'copy',
    sourcefiles: `${sourceDir}/${fileName}`,
    destfiles: destDir,
  }, host)
}

async function moveFile(cpUser, cpPass, sourceDir, fileName, destDir, host = null) {
  return api2(cpUser, cpPass, 'Fileman', 'fileop', {
    doubledecode: 0,
    op: 'move',
    sourcefiles: `${sourceDir}/${fileName}`,
    destfiles: `${destDir}/${fileName}`,
  }, host)
}

// DOMAINS

async function listDomains(cpUser, cpPass, host = null) {
  return uapi(cpUser, cpPass, 'DomainInfo', 'list_domains', {}, 'GET', host)
}

async function addAddonDomain(cpUser, cpPass, domain, subDomain, dir, host = null) {
  // Use cPanel API2 for AddonDomain::addaddondomain (UAPI module not available on all versions)
  const auth = { username: cpUser, password: cpPass }
  const url = `${getBaseUrl(host)}/json-api/cpanel`
  const params = {
    cpanel_jsonapi_user: cpUser,
    cpanel_jsonapi_apiversion: 2,
    cpanel_jsonapi_module: 'AddonDomain',
    cpanel_jsonapi_func: 'addaddondomain',
    newdomain: domain,
    subdomain: subDomain || domain.replace(/\./g, ''),
    dir: dir || `public_html/${domain}`,
  }
  try {
    const res = await axios.get(url, {
      params,
      auth,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      timeout: 30000,
      headers: _maybeAccessHeaders(getBaseUrl(host)),
    })
    const result = res.data?.cpanelresult?.data?.[0] || {}
    if (result.result === 1) {
      return { status: 1, data: result, errors: null }
    }
    return { status: 0, data: null, errors: [result.reason || 'Failed to add addon domain'] }
  } catch (err) {
    if (isControlPlaneDown(err)) {
      _adminAlertDown(err.code || err.message, host || WHM_HOST)
      return downResponse(err.code || err.message)
    }
    return { status: 0, data: null, errors: [err.message] }
  }
}

async function removeAddonDomain(cpUser, cpPass, domain, subDomain, mainDomain, host = null) {
  const auth = { username: cpUser, password: cpPass }
  const url = `${getBaseUrl(host)}/json-api/cpanel`
  const params = {
    cpanel_jsonapi_user: cpUser,
    cpanel_jsonapi_apiversion: 2,
    cpanel_jsonapi_module: 'AddonDomain',
    cpanel_jsonapi_func: 'deladdondomain',
    domain: domain,
    subdomain: subDomain || (mainDomain ? `${domain.replace(/\./g, '')}.${mainDomain}` : domain.replace(/\./g, '')),
  }
  try {
    const res = await axios.get(url, {
      params,
      auth,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      timeout: 30000,
      headers: _maybeAccessHeaders(getBaseUrl(host)),
    })
    const result = res.data?.cpanelresult?.data?.[0] || {}
    if (result.result === 1) {
      return { status: 1, data: result, errors: null }
    }
    return { status: 0, data: null, errors: [result.reason || 'Failed to remove addon domain'] }
  } catch (err) {
    if (isControlPlaneDown(err)) {
      _adminAlertDown(err.code || err.message, host || WHM_HOST)
      return downResponse(err.code || err.message)
    }
    return { status: 0, data: null, errors: [err.message] }
  }
}

// EMAIL

async function listEmailAccounts(cpUser, cpPass, host = null) {
  return uapi(cpUser, cpPass, 'Email', 'list_pops_with_disk', {}, 'GET', host)
}

async function createEmailAccount(cpUser, cpPass, email, password, quota, domain, host = null) {
  return uapi(cpUser, cpPass, 'Email', 'add_pop', {
    email,
    password,
    quota: quota || 250, // MB
    domain,
  }, 'POST', host)
}

async function deleteEmailAccount(cpUser, cpPass, email, domain, host = null) {
  return uapi(cpUser, cpPass, 'Email', 'delete_pop', { email, domain }, 'POST', host)
}

async function changeEmailPassword(cpUser, cpPass, email, password, domain, host = null) {
  return uapi(cpUser, cpPass, 'Email', 'passwd_pop', { email, password, domain }, 'POST', host)
}

async function getEmailDiskUsage(cpUser, cpPass, host = null) {
  return uapi(cpUser, cpPass, 'Email', 'get_disk_usage', {}, 'GET', host)
}

// Send test email via cPanel webmail (uses the server's sendmail)
async function sendTestEmail(cpUser, cpPass, fromEmail, toEmail, domain, host = null) {
  return uapi(cpUser, cpPass, 'Email', 'send_test', {
    from: fromEmail,
    to: toEmail,
    subject: `Test from ${domain} - ${new Date().toISOString().split('T')[0]}`,
  }, 'POST', host)
}

// STATS

async function getQuotaInfo(cpUser, cpPass, host = null) {
  return uapi(cpUser, cpPass, 'Quota', 'get_local_quota_info', {}, 'GET', host)
}

async function getBandwidthData(cpUser, cpPass, host = null) {
  return uapi(cpUser, cpPass, 'Stats', 'get_bandwidth', {}, 'GET', host)
}

// SUBDOMAINS
// Note: listing uses DomainInfo::list_domains (subdomains in the domains response)
// Creation/deletion uses cPanel API2 SubDomain module

async function listSubdomains(cpUser, cpPass, host = null) {
  // Subdomains are already part of the domains response
  const domains = await listDomains(cpUser, cpPass, host)
  return {
    data: (domains.data?.sub_domains || []).map(s => {
      if (typeof s === 'string') {
        const parts = s.split('.')
        return { domain: parts[0], rootdomain: parts.slice(1).join('.'), fullDomain: s }
      }
      return s
    }),
    status: domains.status,
    errors: domains.errors,
  }
}

async function createSubdomain(cpUser, cpPass, subdomain, rootdomain, dir, host = null) {
  // Use cpanel API2 for SubDomain::addsubdomain
  const auth = { username: cpUser, password: cpPass }
  const url = `${getBaseUrl(host)}/json-api/cpanel`
  const params = {
    cpanel_jsonapi_user: cpUser,
    cpanel_jsonapi_apiversion: 2,
    cpanel_jsonapi_module: 'SubDomain',
    cpanel_jsonapi_func: 'addsubdomain',
    domain: subdomain,
    rootdomain: rootdomain,
    dir: dir || `public_html/${subdomain}.${rootdomain}`,
  }
  try {
    const res = await axios.get(url, {
      params,
      auth,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      timeout: 30000,
      headers: _maybeAccessHeaders(getBaseUrl(host)),
    })
    const result = res.data?.cpanelresult?.data?.[0] || {}
    if (result.result === 1) {
      return { status: 1, data: result, errors: null }
    }
    return { status: 0, data: null, errors: [result.reason || 'Failed to create subdomain'] }
  } catch (err) {
    if (isControlPlaneDown(err)) {
      _adminAlertDown(err.code || err.message, host || WHM_HOST)
      return downResponse(err.code || err.message)
    }
    return { status: 0, data: null, errors: [err.message] }
  }
}

async function deleteSubdomain(cpUser, cpPass, fullSubdomain, host = null) {
  // Use cpanel API2 for SubDomain::delsubdomain
  const effectiveHost = host || WHM_HOST
  const auth = { username: cpUser, password: cpPass }
  const url = `${getBaseUrl(host)}/json-api/cpanel`
  const params = {
    cpanel_jsonapi_user: cpUser,
    cpanel_jsonapi_apiversion: 2,
    cpanel_jsonapi_module: 'SubDomain',
    cpanel_jsonapi_func: 'delsubdomain',
    domain: fullSubdomain,
  }
  try {
    const res = await axios.get(url, {
      params,
      auth,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      timeout: 30000,
      headers: _maybeAccessHeaders(getBaseUrl(host)),
    })
    const result = res.data?.cpanelresult?.data?.[0] || {}
    if (result.result === 1) {
      return { status: 1, data: result, errors: null }
    }
    return { status: 0, data: null, errors: [result.reason || 'Failed to delete subdomain'] }
  } catch (err) {
    if (isControlPlaneDown(err)) {
      _adminAlertDown(err.code || err.message, host || WHM_HOST)
      return downResponse(err.code || err.message)
    }
    return { status: 0, data: null, errors: [err.message] }
  }
}

// SSL

async function getSSLStatus(cpUser, cpPass, host = null) {
  return uapi(cpUser, cpPass, 'SSL', 'installed_hosts', {}, 'GET', host)
}

module.exports = {
  uapi,
  uploadFile,
  // Files
  listFiles,
  getFileContent,
  saveFileContent,
  createDirectory,
  deleteFile,
  renameFile,
  extractFile,
  compressFiles,
  copyFile,
  moveFile,
  // Domains
  listDomains,
  addAddonDomain,
  removeAddonDomain,
  // Subdomains
  listSubdomains,
  createSubdomain,
  deleteSubdomain,
  // Email
  listEmailAccounts,
  createEmailAccount,
  deleteEmailAccount,
  changeEmailPassword,
  getEmailDiskUsage,
  sendTestEmail,
  // Stats
  getQuotaInfo,
  getBandwidthData,
  // SSL
  getSSLStatus,
  // Health hooks
  setAdminNotifier,
  isControlPlaneDown,
  getDownMessage,
}
