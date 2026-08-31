/* Janitorial cleanup: remove ONLY test-artifact subdomains (qa*) created by the
 * QA runs on testingbays.sbs. Uses the real panel API path (login → list →
 * delete) so it exercises the same WHM-root fallback. NEVER touches shop/blog/api/dev. */
const axios = require('axios')
const NODE = 'http://127.0.0.1:5000'
const TEST_RE = /^(qasub|qabulk|qatest|qaaddon|qa-|qadb)/i
const KEEP = new Set(['shop', 'blog', 'api', 'dev'])

function subName(s) {
  if (typeof s === 'string') return s
  if (s.fullDomain) return s.fullDomain
  const d = typeof s.domain === 'string' ? s.domain : ''
  if (d.includes('.')) return d
  if (d && s.rootdomain) return `${d}.${s.rootdomain}`
  return d || String(s)
}

;(async () => {
  const login = await axios.post(`${NODE}/panel/login`, { username: 'nbayftest', pin: '241743' }, { timeout: 30000 })
  const token = login.data.token
  const H = { Authorization: `Bearer ${token}` }
  console.log('logged in, token len', token?.length)

  const list = await axios.get(`${NODE}/panel/subdomains`, { headers: H, timeout: 40000 })
  const subs = list.data.data || list.data.subdomains || []
  const names = subs.map(subName)
  console.log('current subdomains:', names.join(', '))

  const toDelete = names.filter(n => {
    const prefix = n.split('.')[0]
    return TEST_RE.test(n) && !KEEP.has(prefix)
  })
  console.log('will delete (test artifacts only):', toDelete.join(', ') || '(none)')

  for (const fqdn of toDelete) {
    try {
      const r = await axios.post(`${NODE}/panel/subdomains/delete`, { subdomain: fqdn }, { headers: H, timeout: 60000 })
      console.log(`  deleted ${fqdn} → status=${r.data.status} via=${r.data.via || '-'}`)
    } catch (e) {
      console.log(`  FAILED ${fqdn} → ${e.response?.status} ${JSON.stringify(e.response?.data)?.slice(0,120)}`)
    }
  }

  // Re-list to confirm
  const after = await axios.get(`${NODE}/panel/subdomains`, { headers: H, timeout: 40000 })
  console.log('\nremaining subdomains:', (after.data.data || []).map(subName).join(', '))
})().catch(e => { console.error('FATAL', e.response?.status, e.response?.data || e.message); process.exit(1) })
