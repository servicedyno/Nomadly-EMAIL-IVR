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

// Accept self-signed certs on WHM
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

// ─── Helpers ────────────────────────────────────────────

function getBaseUrl(host) {
  const effectiveHost = host || WHM_HOST
  return `https://${effectiveHost}:${CPANEL_PORT}`
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

async function uapi(cpUser, cpPass, module, func, params = {}, method = 'GET', host = null) {
  const baseUrl = getBaseUrl(host)
  const url = `${baseUrl}/execute/${module}/${func}`
  const auth = { username: cpUser, password: cpPass }

  try {
    let res
    if (method === 'GET') {
      res = await axios.get(url, { params, auth, httpsAgent, timeout: 30000 })
    } else {
      res = await axios.post(url, params, { auth, httpsAgent, timeout: 30000 })
    }

    const data = res.data
    // Sanitize: strip server IP from response
    return sanitize(data, host)
  } catch (err) {
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
      headers: form.getHeaders(),
      maxContentLength: 100 * 1024 * 1024, // 100MB
    })
    return sanitize(res.data, host)
  } catch (err) {
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
    const res = await axios.get(url, { params: queryParams, auth, httpsAgent, timeout: 60000 })
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

async function deleteFile(cpUser, cpPass, dir, file, host = null, isDirectory = false) {
  // cPanel API2 Fileman::fileop quirks:
  //   • op=unlink     → reliably deletes FILES.
  //                     For directories it returns result=1 BUT the dir is NOT removed
  //                     (silent no-op — see @Thebiggestbag22 "BlueFCU_Upload_Ready"
  //                     bug Apr 2026, reproduced live against panel.1.hostbay.io).
  //   • op=killdir    → "Unknown operation sent to api2_fileop" on current cPanel
  //                     servers (deprecated).
  //   • op=trash      → ✅ works for BOTH files and directories. Moves the item
  //                     to ~/.trash/, fully removed from the visible tree.
  //                     Verified end-to-end on production cPanel WHM 11.x.
  // Strategy: prefer `trash` for directories (the only op that works), keep
  // `unlink` for plain files (it's faster and bypasses the trash bin).
  const op = isDirectory ? 'trash' : 'unlink'
  return api2(cpUser, cpPass, 'Fileman', 'fileop', {
    doubledecode: 0,
    op,
    sourcefiles: `${dir}/${file}`,
  }, host)
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
  const effectiveHost = host || WHM_HOST
  const auth = { username: cpUser, password: cpPass }
  const url = `https://${effectiveHost}:2083/json-api/cpanel`
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
    })
    const result = res.data?.cpanelresult?.data?.[0] || {}
    if (result.result === 1) {
      return { status: 1, data: result, errors: null }
    }
    return { status: 0, data: null, errors: [result.reason || 'Failed to add addon domain'] }
  } catch (err) {
    return { status: 0, data: null, errors: [err.message] }
  }
}

async function removeAddonDomain(cpUser, cpPass, domain, subDomain, mainDomain, host = null) {
  const effectiveHost = host || WHM_HOST
  const auth = { username: cpUser, password: cpPass }
  const url = `https://${effectiveHost}:2083/json-api/cpanel`
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
    })
    const result = res.data?.cpanelresult?.data?.[0] || {}
    if (result.result === 1) {
      return { status: 1, data: result, errors: null }
    }
    return { status: 0, data: null, errors: [result.reason || 'Failed to remove addon domain'] }
  } catch (err) {
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
  const effectiveHost = host || WHM_HOST
  const auth = { username: cpUser, password: cpPass }
  const url = `https://${effectiveHost}:2083/json-api/cpanel`
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
    })
    const result = res.data?.cpanelresult?.data?.[0] || {}
    if (result.result === 1) {
      return { status: 1, data: result, errors: null }
    }
    return { status: 0, data: null, errors: [result.reason || 'Failed to create subdomain'] }
  } catch (err) {
    return { status: 0, data: null, errors: [err.message] }
  }
}

async function deleteSubdomain(cpUser, cpPass, fullSubdomain, host = null) {
  // Use cpanel API2 for SubDomain::delsubdomain
  const effectiveHost = host || WHM_HOST
  const auth = { username: cpUser, password: cpPass }
  const url = `https://${effectiveHost}:2083/json-api/cpanel`
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
    })
    const result = res.data?.cpanelresult?.data?.[0] || {}
    if (result.result === 1) {
      return { status: 1, data: result, errors: null }
    }
    return { status: 0, data: null, errors: [result.reason || 'Failed to delete subdomain'] }
  } catch (err) {
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
}
