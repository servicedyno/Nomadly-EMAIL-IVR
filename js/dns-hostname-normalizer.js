/**
 * DNS Hostname Normalization
 *
 * Cloudflare (and most DNS providers) expect a hostname relative to the zone.
 * Users often paste the FULL FQDN — e.g. `www.example.com` while managing the
 * `example.com` zone — which results in a duplicated record name
 * `www.example.com.example.com`.
 *
 * Industry-standard fix: auto-strip a trailing `.{zoneName}` (with or without
 * trailing dot). This module centralizes that logic so it's testable and
 * consistent across A/AAAA/CNAME/MX/TXT add/update paths.
 *
 * It also catches when a user types a hostname under a DIFFERENT domain
 * (e.g. `www.other.com` while managing `example.com`) — that's almost always
 * a mistake; we reject and let the bot show a helpful error.
 */

/**
 * Normalize a hostname entered by a user against a specific zone.
 *
 * @param {string} rawHostname  - what the user typed (already .trim()'d by the caller)
 * @param {string} zone         - the zone they are managing (e.g. "example.com")
 * @returns {{
 *   ok: boolean,
 *   value: string,           // normalized hostname (sub-label only, or "@")
 *   reason?: string,         // when ok=false, one of: 'foreign-domain'
 *   stripped?: boolean,      // true when we removed the trailing zone
 * }}
 *
 * Examples (zone = "example.com"):
 *   "@"                  → { ok:true, value:"@" }
 *   "www"                → { ok:true, value:"www" }
 *   "www.example.com"    → { ok:true, value:"www",        stripped:true }
 *   "www.example.com."   → { ok:true, value:"www",        stripped:true }
 *   "example.com"        → { ok:true, value:"@",          stripped:true }
 *   "example.com."       → { ok:true, value:"@",          stripped:true }
 *   "api.sub.example.com"→ { ok:true, value:"api.sub",    stripped:true }
 *   "www.other-domain.com" → { ok:false, reason:"foreign-domain" }
 *   "_dmarc.example.com" → { ok:true, value:"_dmarc",     stripped:true }
 */
function normalizeHostname(rawHostname, zone) {
  if (typeof rawHostname !== 'string' || typeof zone !== 'string') {
    return { ok: true, value: rawHostname }
  }
  let h = rawHostname.trim()
  const z = zone.trim().toLowerCase().replace(/\.$/, '')
  if (!h || !z) return { ok: true, value: h }

  // Pass-through for root sentinel.
  if (h === '@') return { ok: true, value: '@' }

  // Strip a single trailing dot (FQDN form).
  const hadTrailingDot = h.endsWith('.')
  if (hadTrailingDot) h = h.slice(0, -1)

  const hLower = h.toLowerCase()

  // Case 1: user pasted exactly the zone — collapse to "@"
  if (hLower === z) {
    return { ok: true, value: '@', stripped: true }
  }

  // Case 2: user pasted "<sub>.<zone>" — strip the trailing zone.
  const suffix = '.' + z
  if (hLower.endsWith(suffix)) {
    const sub = h.slice(0, h.length - suffix.length)
    return { ok: true, value: sub, stripped: true }
  }

  // Case 3: it looks like a FQDN under a different domain.
  // The input didn't match the zone suffix (Cases 1-2), so if it looks like
  // a full domain name (sub.other-domain.tld), flag it.
  //
  // Improved heuristic (avoids false positives on multi-label sub-labels
  // like `api.v2`, `cdn.static`, `mail.old` which are legitimate DNS names):
  //  - 3+ labels → likely a full FQDN (e.g. `www.other.com`) — always flag.
  //  - 2 labels  → only flag when the last label is a well-known TLD.
  //  - Skip underscore-prefixed inputs (DKIM, DMARC, ACME, etc.).
  if (h.includes('.') && !h.startsWith('_')) {
    const labels = h.split('.')
    const last = labels[labels.length - 1].toLowerCase()

    if (labels.length >= 3) {
      // 3+ labels (e.g. www.other.com, blog.other.io) — almost certainly a FQDN.
      if (/^[a-zA-Z]{2,63}$/.test(last)) {
        return { ok: false, reason: 'foreign-domain', value: h }
      }
    } else if (labels.length === 2) {
      // 2 labels (e.g. api.v2 vs blog.io) — only flag well-known TLDs.
      const commonTLDs = new Set([
        'com','net','org','io','co','me','info','biz','us','uk','de','fr',
        'ru','cn','jp','br','in','au','ca','nl','eu','ch','se','no','fi',
        'dk','es','it','pt','pl','cz','at','be','ie','nz','za','mx','ar',
        'cl','tv','cc','ai','app','dev','xyz','online','site','store',
        'tech','cloud','pro','live','shop','space','fun','top','icu',
        'website','club','work','link','click','host','pw','mobi',
      ])
      if (commonTLDs.has(last)) {
        return { ok: false, reason: 'foreign-domain', value: h }
      }
    }
  }

  // Otherwise leave the user's input as-is (e.g. `api`, `_dmarc.foo`, `neo1._domainkey`).
  return { ok: true, value: h }
}

/**
 * Detect a record whose `recordName` got duplicated like `www.zone.zone`.
 * Returns the corrected sub-label or `null` when not duplicated.
 */
function detectDuplicatedZone(recordName, zone) {
  if (typeof recordName !== 'string' || typeof zone !== 'string') return null
  const r = recordName.trim().toLowerCase().replace(/\.$/, '')
  const z = zone.trim().toLowerCase().replace(/\.$/, '')
  if (!r || !z) return null
  const dup = `.${z}.${z}`
  const dupLower = dup.toLowerCase()
  if (!r.endsWith(dupLower)) return null
  // Recover the user's original sub-label by stripping ONE trailing `.zone`.
  const stripOnce = recordName.slice(0, recordName.length - z.length - 1).replace(/\.$/, '')
  return stripOnce
}

module.exports = {
  normalizeHostname,
  detectDuplicatedZone,
}
