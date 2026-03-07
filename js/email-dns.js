/**
 * Email DNS Service — Cloudflare API for SPF/DKIM/DMARC/A/MX management
 * Used by the Email Blast service to auto-configure sending domains
 */

const fetch = require('node-fetch');

const CF_EMAIL = process.env.CLOUDFLARE_EMAIL;
const CF_KEY   = process.env.CLOUDFLARE_API_KEY;
const CF_BASE  = 'https://api.cloudflare.com/client/v4';

function cfHeaders() {
  return {
    'X-Auth-Email': CF_EMAIL,
    'X-Auth-Key': CF_KEY,
    'Content-Type': 'application/json'
  };
}

async function cfGet(path) {
  const r = await fetch(`${CF_BASE}${path}`, { headers: cfHeaders() });
  return r.json();
}

async function cfPost(path, body) {
  const r = await fetch(`${CF_BASE}${path}`, { method: 'POST', headers: cfHeaders(), body: JSON.stringify(body) });
  return r.json();
}

async function cfPut(path, body) {
  const r = await fetch(`${CF_BASE}${path}`, { method: 'PUT', headers: cfHeaders(), body: JSON.stringify(body) });
  return r.json();
}

async function cfDelete(path) {
  const r = await fetch(`${CF_BASE}${path}`, { method: 'DELETE', headers: cfHeaders() });
  return r.json();
}

/**
 * Get Cloudflare zone ID for a domain
 */
async function getZoneId(domain) {
  const res = await cfGet(`/zones?name=${domain}`);
  if (res.success && res.result && res.result.length > 0) {
    return res.result[0].id;
  }
  return null;
}

/**
 * List all DNS records for a zone
 */
async function listRecords(zoneId, type, name) {
  let url = `/zones/${zoneId}/dns_records?per_page=100`;
  if (type) url += `&type=${type}`;
  if (name) url += `&name=${name}`;
  const res = await cfGet(url);
  return res.success ? res.result : [];
}

/**
 * Create or update a DNS record
 */
async function upsertRecord(zoneId, type, name, content, opts = {}) {
  const existing = await listRecords(zoneId, type, name);
  const body = {
    type,
    name,
    content,
    ttl: opts.ttl || 1, // 1 = auto
    proxied: opts.proxied || false,
    ...(opts.priority !== undefined ? { priority: opts.priority } : {})
  };

  if (existing.length > 0) {
    // Update existing record
    const res = await cfPut(`/zones/${zoneId}/dns_records/${existing[0].id}`, body);
    return { action: 'updated', success: res.success, record: res.result };
  } else {
    // Create new record
    const res = await cfPost(`/zones/${zoneId}/dns_records`, body);
    return { action: 'created', success: res.success, record: res.result };
  }
}

/**
 * Delete a DNS record by type and name
 */
async function deleteRecord(zoneId, type, name) {
  const existing = await listRecords(zoneId, type, name);
  const results = [];
  for (const rec of existing) {
    const res = await cfDelete(`/zones/${zoneId}/dns_records/${rec.id}`);
    results.push({ id: rec.id, success: res.success });
  }
  return results;
}

/**
 * Set up ALL DNS records for a sending domain
 * @param {string} domain - e.g. "tracking-assist.com"
 * @param {string} vpsIp - e.g. "5.189.166.127"
 * @param {string} dkimSelector - e.g. "mail2025"
 * @param {string} dkimPublicKey - raw base64 public key
 * @param {string[]} allIps - all IPs for SPF (including future ones)
 * @returns {object} results
 */
async function setupDomainDns(domain, vpsIp, dkimSelector, dkimPublicKey, allIps = []) {
  const zoneId = await getZoneId(domain);
  if (!zoneId) {
    return { success: false, error: `Domain ${domain} not found on Cloudflare` };
  }

  const ips = allIps.length > 0 ? allIps : [vpsIp];
  const results = {};

  // 1. A record: mail.domain.com → VPS IP
  results.a = await upsertRecord(zoneId, 'A', `mail.${domain}`, vpsIp, { proxied: false });

  // 2. MX record: domain.com → mail.domain.com
  results.mx = await upsertRecord(zoneId, 'MX', domain, `mail.${domain}`, { priority: 10 });

  // 3. SPF record
  const spfIps = ips.map(ip => `ip4:${ip}`).join(' ');
  const spfValue = `v=spf1 ${spfIps} ~all`;
  results.spf = await upsertRecord(zoneId, 'TXT', domain, spfValue);

  // 4. DKIM record
  const dkimName = `${dkimSelector}._domainkey.${domain}`;
  const dkimValue = `v=DKIM1; k=rsa; p=${dkimPublicKey}`;
  results.dkim = await upsertRecord(zoneId, 'TXT', dkimName, dkimValue);

  // 5. DMARC record
  const dmarcValue = `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}; fo=1`;
  results.dmarc = await upsertRecord(zoneId, 'TXT', `_dmarc.${domain}`, dmarcValue);

  return { success: true, zoneId, results };
}

/**
 * Update SPF record to include additional IPs
 */
async function updateSpf(domain, allIps) {
  const zoneId = await getZoneId(domain);
  if (!zoneId) return { success: false, error: 'Zone not found' };
  const spfIps = allIps.map(ip => `ip4:${ip}`).join(' ');
  const spfValue = `v=spf1 ${spfIps} ~all`;
  return upsertRecord(zoneId, 'TXT', domain, spfValue);
}

/**
 * Remove ALL email DNS records for a domain
 */
async function removeDomainDns(domain, dkimSelector) {
  const zoneId = await getZoneId(domain);
  if (!zoneId) return { success: false, error: 'Zone not found' };

  const results = {};
  results.a = await deleteRecord(zoneId, 'A', `mail.${domain}`);
  results.mx = await deleteRecord(zoneId, 'MX', domain);
  // Be careful not to delete existing TXT records unrelated to email
  results.dkim = await deleteRecord(zoneId, 'TXT', `${dkimSelector}._domainkey.${domain}`);
  results.dmarc = await deleteRecord(zoneId, 'TXT', `_dmarc.${domain}`);
  // Note: SPF is on the root TXT — we don't delete it to avoid breaking other services
  return { success: true, results };
}

module.exports = {
  getZoneId,
  listRecords,
  upsertRecord,
  deleteRecord,
  setupDomainDns,
  updateSpf,
  removeDomainDns
};
