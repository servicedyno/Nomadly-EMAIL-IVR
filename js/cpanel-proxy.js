/* global process */
/**
 * cPanel UAPI Proxy Service
 * Proxies requests to cPanel UAPI, hiding the server IP from the frontend.
 * All responses are sanitized to remove server IP references.
 */

const axios = require('axios')
const https = require('https')
const { log } = require('console')
const FormData = require('form-data')

const WHM_HOST = process.env.WHM_HOST
const CPANEL_PORT = 2083
const BASE_URL = `https://${WHM_HOST}:${CPANEL_PORT}`

// Accept self-signed certs on WHM
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

// ─── Core UAPI call ─────────────────────────────────────

async function uapi(cpUser, cpPass, module, func, params = {}, method = 'GET') {
  const url = `${BASE_URL}/execute/${module}/${func}`
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
    return sanitize(data)
  } catch (err) {
    const status = err.response?.status
    const msg = err.response?.data?.errors?.[0] || err.message
    log(`[cPanel Proxy] ${module}::${func} error (${status}): ${msg}`)
    return { status: 0, errors: [sanitizeString(String(msg))], data: null }
  }
}

/**
 * Upload file to cPanel via multipart/form-data
 */
async function uploadFile(cpUser, cpPass, dir, fileName, fileBuffer) {
  const url = `${BASE_URL}/execute/Fileman/upload_files`
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
    return sanitize(res.data)
  } catch (err) {
    log(`[cPanel Proxy] Fileman::upload_files error: ${err.message}`)
    return { status: 0, errors: [sanitizeString(err.message)], data: null }
  }
}

// ─── Sanitization ───────────────────────────────────────

function sanitizeString(str) {
  if (!str || typeof str !== 'string') return str
  // Replace server IP with [server]
  if (WHM_HOST) {
    str = str.split(WHM_HOST).join('[server]')
  }
  // Also strip common cPanel port references
  str = str.replace(/:2083/g, '').replace(/:2087/g, '').replace(/:2096/g, '')
  return str
}

function sanitize(obj) {
  if (typeof obj === 'string') return sanitizeString(obj)
  if (Array.isArray(obj)) return obj.map(sanitize)
  if (obj && typeof obj === 'object') {
    const clean = {}
    for (const [k, v] of Object.entries(obj)) {
      clean[k] = sanitize(v)
    }
    return clean
  }
  return obj
}

// ─── cPanel API2 call (for functions not available in UAPI) ──
// Normalizes API2 response to match UAPI format: { status, data, errors }

async function api2(cpUser, cpPass, module, func, params = {}) {
  const url = `${BASE_URL}/json-api/cpanel`
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
    const raw = sanitize(res.data)

    // Normalize API2 response to UAPI-like format
    const cp = raw?.cpanelresult || {}
    const eventOk = cp.event?.result === 1
    const dataArr = cp.data || []
    const opOk = dataArr.length > 0 && dataArr[0]?.result === 1
    const errors = []
    if (!eventOk || !opOk) {
      const reason = dataArr[0]?.reason || cp.error || 'Operation failed'
      errors.push(sanitizeString(String(reason)))
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
    return { status: 0, errors: [sanitizeString(String(msg))], data: null }
  }
}

// ─── High-level operations ──────────────────────────────

// FILE MANAGER

async function listFiles(cpUser, cpPass, dir = '/public_html') {
  return uapi(cpUser, cpPass, 'Fileman', 'list_files', {
    dir,
    include_mime: 1,
    include_permissions: 1,
    include_hash: 0,
    include_content: 0,
    types: 'dir|file',
  })
}

async function getFileContent(cpUser, cpPass, dir, file) {
  return uapi(cpUser, cpPass, 'Fileman', 'get_file_content', { dir, file })
}

async function saveFileContent(cpUser, cpPass, dir, file, content) {
  return uapi(cpUser, cpPass, 'Fileman', 'save_file_content', { dir, file, content }, 'POST')
}

async function createDirectory(cpUser, cpPass, dir, name) {
  return api2(cpUser, cpPass, 'Fileman', 'mkdir', {
    path: dir,
    name: name,
  })
}

async function deleteFile(cpUser, cpPass, dir, file) {
  return api2(cpUser, cpPass, 'Fileman', 'fileop', {
    doubledecode: 0,
    op: 'unlink',
    sourcefiles: `${dir}/${file}`,
  })
}

async function renameFile(cpUser, cpPass, dir, oldName, newName) {
  return api2(cpUser, cpPass, 'Fileman', 'fileop', {
    doubledecode: 0,
    op: 'rename',
    sourcefiles: `${dir}/${oldName}`,
    destfiles: `${dir}/${newName}`,
  })
}

async function extractFile(cpUser, cpPass, dir, file, destDir) {
  // Extract uses API2 (UAPI has no fileop equivalent)
  return api2(cpUser, cpPass, 'Fileman', 'fileop', {
    doubledecode: 0,
    op: 'extract',
    sourcefiles: `${dir}/${file}`,
    destfiles: destDir || dir,
  })
}

async function compressFiles(cpUser, cpPass, dir, files, destFile) {
  return api2(cpUser, cpPass, 'Fileman', 'fileop', {
    doubledecode: 0,
    op: 'compress',
    sourcefiles: files.map(f => `${dir}/${f}`).join('\n'),
    destfiles: `${dir}/${destFile}`,
  })
}

// DOMAINS

async function listDomains(cpUser, cpPass) {
  return uapi(cpUser, cpPass, 'DomainInfo', 'list_domains')
}

async function addAddonDomain(cpUser, cpPass, domain, subDomain, dir) {
  // Use cPanel API2 for AddonDomain::addaddondomain (UAPI module not available on all versions)
  const auth = { username: cpUser, password: cpPass }
  const WHM_HOST = process.env.WHM_HOST
  const url = `https://${WHM_HOST}:2083/json-api/cpanel`
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

async function removeAddonDomain(cpUser, cpPass, domain, subDomain, mainDomain) {
  const auth = { username: cpUser, password: cpPass }
  const WHM_HOST = process.env.WHM_HOST
  const url = `https://${WHM_HOST}:2083/json-api/cpanel`
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

async function listEmailAccounts(cpUser, cpPass) {
  return uapi(cpUser, cpPass, 'Email', 'list_pops_with_disk')
}

async function createEmailAccount(cpUser, cpPass, email, password, quota, domain) {
  return uapi(cpUser, cpPass, 'Email', 'add_pop', {
    email,
    password,
    quota: quota || 250, // MB
    domain,
  }, 'POST')
}

async function deleteEmailAccount(cpUser, cpPass, email, domain) {
  return uapi(cpUser, cpPass, 'Email', 'delete_pop', { email, domain }, 'POST')
}

async function changeEmailPassword(cpUser, cpPass, email, password, domain) {
  return uapi(cpUser, cpPass, 'Email', 'passwd_pop', { email, password, domain }, 'POST')
}

async function getEmailDiskUsage(cpUser, cpPass) {
  return uapi(cpUser, cpPass, 'Email', 'get_disk_usage')
}

// Send test email via cPanel webmail (uses the server's sendmail)
async function sendTestEmail(cpUser, cpPass, fromEmail, toEmail, domain) {
  return uapi(cpUser, cpPass, 'Email', 'send_test', {
    from: fromEmail,
    to: toEmail,
    subject: `Test from ${domain} - ${new Date().toISOString().split('T')[0]}`,
  }, 'POST')
}

// STATS

async function getQuotaInfo(cpUser, cpPass) {
  return uapi(cpUser, cpPass, 'Quota', 'get_local_quota_info')
}

async function getBandwidthData(cpUser, cpPass) {
  return uapi(cpUser, cpPass, 'Stats', 'get_bandwidth')
}

// SUBDOMAINS
// Note: listing uses DomainInfo::list_domains (subdomains in the domains response)
// Creation/deletion uses cPanel API2 SubDomain module

async function listSubdomains(cpUser, cpPass) {
  // Subdomains are already part of the domains response
  const domains = await listDomains(cpUser, cpPass)
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

async function createSubdomain(cpUser, cpPass, subdomain, rootdomain, dir) {
  // Use cpanel API2 for SubDomain::addsubdomain
  const auth = { username: cpUser, password: cpPass }
  const WHM_HOST = process.env.WHM_HOST
  const url = `https://${WHM_HOST}:2083/json-api/cpanel`
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

async function deleteSubdomain(cpUser, cpPass, fullSubdomain) {
  // Use cpanel API2 for SubDomain::delsubdomain
  const auth = { username: cpUser, password: cpPass }
  const WHM_HOST = process.env.WHM_HOST
  const url = `https://${WHM_HOST}:2083/json-api/cpanel`
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

async function getSSLStatus(cpUser, cpPass) {
  return uapi(cpUser, cpPass, 'SSL', 'installed_hosts')
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
