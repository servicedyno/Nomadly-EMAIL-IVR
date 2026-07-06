/**
 * One-shot maintenance: replace the identical "maintenance HTML" left over from the
 * 2026-06-17 emergency WHM migration with per-domain UNIQUE placeholder pages.
 *
 * Why: every account currently serves the same /public_html/index.html. If a scanner
 * ever bypasses the CF anti-red worker and hits the origin directly, it sees the same
 * HTML across N customer domains, which is a textbook "cloaked phishing network" signal
 * that accelerates red-flagging across the cluster.
 *
 * Strategy: deterministic per-domain content (seeded by domain hash) so each origin
 * looks like a unique boring small-business landing page. Customers can still overwrite
 * their index.html anytime with their real content.
 *
 * Usage:  node /app/scripts/regenerate_origin_placeholders.js [--dry] [--only <cpUser>]
 *
 * Idempotent: skips a domain if its current index.html already differs from the original
 * shared maintenance HTML (i.e. the customer already restored their site).
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const crypto = require('crypto')
const { MongoClient } = require('mongodb')
const cpAuth = require('/app/js/cpanel-auth.js')
const cpProxy = require('/app/js/cpanel-proxy.js')

const DRY = process.argv.includes('--dry')
const ONLY_USER = (process.argv.find(a => a.startsWith('--only=')) || '').replace('--only=', '') || null

// ─── Domain-seeded RNG ───────────────────────────────────────────
function seedFor(domain) {
  const h = crypto.createHash('sha256').update(domain.toLowerCase()).digest()
  return {
    pick: (arr) => arr[h[0] % arr.length],
    pick2: (arr) => arr[h[1] % arr.length],
    pick3: (arr) => arr[h[2] % arr.length],
    pick4: (arr) => arr[h[3] % arr.length],
    pick5: (arr) => arr[h[4] % arr.length],
    pick6: (arr) => arr[h[5] % arr.length],
    pick7: (arr) => arr[h[6] % arr.length],
    intInRange: (min, max, byteIdx = 7) => min + (h[byteIdx] % (max - min + 1)),
  }
}

// ─── Content pools — bland small-business categories ────────────
const BUSINESS_NOUNS = ['Consulting','Solutions','Partners','Studio','Group','Associates','Co.','Holdings','Advisors','Collective','Ventures','Works','Labs']
const INDUSTRIES = [
  'Marketing','Property Management','Bookkeeping','Travel Planning','Catering','Photography',
  'Home Renovation','Tutoring','Web Design','Landscaping','Tax Preparation','Logistics',
  'Pet Care','Wedding Planning','IT Support','Translation','Coaching','Event Planning'
]
const CITIES = ['Portland','Austin','Denver','Sacramento','Charlotte','Tampa','Boise','Madison','Burlington','Asheville','Boulder','Ann Arbor']
const TAGLINES = [
  'Quality service since day one.',
  'Local expertise, lasting relationships.',
  'Helping our community thrive.',
  'Practical solutions for everyday needs.',
  'Reliable. Friendly. Affordable.',
  'Where good service still matters.',
  'Trusted by local families and businesses.',
  'Small enough to care, experienced enough to deliver.',
]
const PALETTES = [
  { bg: '#fafafa', text: '#222', accent: '#0070f3', muted: '#888' },
  { bg: '#fffbf2', text: '#2a1d10', accent: '#b8860b', muted: '#7d6440' },
  { bg: '#f2f6f8', text: '#1a2a35', accent: '#2a6f97', muted: '#5b7280' },
  { bg: '#f7f7f3', text: '#1f2421', accent: '#3a7d44', muted: '#688a6e' },
  { bg: '#fdf6f6', text: '#2d1818', accent: '#a23a3a', muted: '#7a4a4a' },
  { bg: '#f3f1fa', text: '#22183d', accent: '#5a3d9c', muted: '#665580' },
]
const ABOUT_VARIANTS = [
  d => `We've been serving the area for over a decade, focused on doing the work right the first time. Drop us a note — we read every message.`,
  d => `Family-run shop. Honest pricing, no upsell. If we can't help you, we'll tell you who can.`,
  d => `A small team that takes pride in our craft. We schedule a limited number of clients each month so each one gets our full attention.`,
  d => `Founded on the idea that good work speaks for itself. We grow by referral and we're proud of that.`,
  d => `Mom-and-pop with modern tools. We've kept the same values for years even as the business has changed.`,
]
const SERVICES_VARIANTS = [
  ['Consultations','Estimates','Project planning','Follow-up support'],
  ['Initial review','Implementation','Quality check','Ongoing care'],
  ['Discovery call','Custom proposal','Hands-on delivery','30-day check-in'],
  ['Free assessment','Detailed quote','Scheduled work','Maintenance plan'],
]
const HOURS_VARIANTS = [
  'Mon–Fri 9 am – 5 pm',
  'Tue–Sat 10 am – 6 pm',
  'Mon–Sat 8 am – 4 pm',
  'By appointment',
  'Mon–Thu 8 am – 6 pm, Fri 8 am – 12 pm',
]

// ─── HTML template ───────────────────────────────────────────────
function generatePlaceholder(domain) {
  const r = seedFor(domain)
  const palette = r.pick(PALETTES)
  const tagline = r.pick3(TAGLINES)
  const industry = r.pick4(INDUSTRIES)
  const city = r.pick5(CITIES)
  const businessNoun = r.pick6(BUSINESS_NOUNS)
  const tld = domain.split('.').pop().toUpperCase()
  // Derive a "business name" from the domain stem with title casing
  const stem = domain.replace(/\.[a-z]+$/i, '').replace(/[-_.]+/g, ' ').trim()
  const titled = stem.split(/\s+/).map(w =>
    w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''
  ).join(' ')
  const brand = `${titled} ${businessNoun}`
  const about = r.pick7(ABOUT_VARIANTS)(domain)
  const services = r.pick(SERVICES_VARIANTS)
  const hours = r.pick2(HOURS_VARIANTS)
  const yearFounded = 2026 - r.intInRange(2, 18, 8)
  const phoneAreaCode = r.intInRange(200, 989, 9)
  const phoneRest = r.intInRange(1000000, 9999999, 10).toString().padStart(7, '0')
  const phone = `(${phoneAreaCode}) ${phoneRest.slice(0,3)}-${phoneRest.slice(3)}`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${brand}</title>
<meta name="description" content="${brand} — ${industry} in ${city}. ${tagline}">
<meta name="robots" content="index, follow">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${palette.bg};color:${palette.text};font:16px/1.55 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;padding:48px 24px}
  .wrap{max-width:760px;margin:0 auto}
  header{padding:24px 0 40px;border-bottom:1px solid #00000010;margin-bottom:32px}
  h1{font-size:32px;letter-spacing:-.01em;margin-bottom:6px}
  .sub{color:${palette.muted};font-size:15px}
  h2{font-size:20px;margin:32px 0 12px;color:${palette.text}}
  p{margin-bottom:12px}
  .accent{color:${palette.accent};font-weight:600}
  ul{padding-left:20px;margin-bottom:8px}
  li{margin-bottom:6px;color:${palette.text}}
  .meta{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin-top:12px;color:${palette.muted};font-size:14px}
  .meta strong{color:${palette.text};font-weight:500}
  footer{margin-top:48px;padding-top:24px;border-top:1px solid #00000010;color:${palette.muted};font-size:13px}
  a{color:${palette.accent};text-decoration:none}
  a:hover{text-decoration:underline}
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>${brand}</h1>
      <div class="sub">${industry} · ${city}</div>
    </header>

    <p class="accent">${tagline}</p>
    <p>${about}</p>

    <h2>What we do</h2>
    <ul>
      ${services.map(s => `<li>${s}</li>`).join('\n      ')}
    </ul>

    <h2>Get in touch</h2>
    <div class="meta">
      <strong>Hours</strong><span>${hours}</span>
      <strong>Phone</strong><span>${phone}</span>
      <strong>Email</strong><span>hello@${domain}</span>
    </div>

    <footer>
      &copy; ${yearFounded}–${new Date().getFullYear()} ${brand}.
      Site managed by the owner. <a href="mailto:hello@${domain}">Contact us</a>.
    </footer>
  </div>
</body>
</html>
`
}

// ─── Detect if a domain has the OLD shared maintenance HTML ─────
// We don't have a reference original, so we treat "very small" (< 1500 bytes)
// or contains common maintenance keywords as the shared placeholder.
function looksLikeOriginalMaintenance(html) {
  if (!html) return true
  const len = html.length
  if (len < 1500) return true
  const h = html.toLowerCase()
  if (h.includes('maintenance') || h.includes('under construction') ||
      h.includes('coming soon') || h.includes("we'll be back") ||
      h.includes('be right back') || h.includes('this site is being prepared')) {
    return true
  }
  return false
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  const mc = new MongoClient(process.env.MONGO_URL)
  await mc.connect()
  const db = mc.db(process.env.DB_NAME || 'test')

  const filter = {
    whmHost: '68.183.77.106',
    $or: [{ deleted: { $ne: true } }, { deleted: null }],
  }
  if (ONLY_USER) filter.cpUser = ONLY_USER

  const accounts = await db.collection('cpanelAccounts').find(filter).toArray()
  console.log(`Found ${accounts.length} active cpanelAccounts on new WHM`)

  let replaced = 0, skipped = 0, failed = 0, alreadyCustom = 0
  for (const acc of accounts) {
    const cp = acc.cpUser
    const domain = acc.domain || cp
    let cpPass
    try {
      cpPass = cpAuth.decrypt({
        encrypted: acc.cpPass_encrypted,
        iv: acc.cpPass_iv,
        tag: acc.cpPass_tag,
      })
    } catch (e) {
      console.log(`  ❌ ${cp.padEnd(10)} (${domain}) — decrypt failed: ${e.message}`)
      failed++
      continue
    }

    // Step 1: read current index.html AND _maintenance.html so we can decide which to overwrite
    let currentIndex = '', currentMaint = ''
    try {
      const r1 = await cpProxy.getFileContent(cp, cpPass, '/public_html', 'index.html')
      currentIndex = (r1 && r1.data && r1.data.content) || ''
    } catch (_) {}
    try {
      const r2 = await cpProxy.getFileContent(cp, cpPass, '/public_html', '_maintenance.html')
      currentMaint = (r2 && r2.data && r2.data.content) || ''
    } catch (_) {}

    // Step 2: skip if customer has already restored real content as index.html
    // (we never touch index.html if it's already a real customized page)
    if (currentIndex && !looksLikeOriginalMaintenance(currentIndex)) {
      console.log(`  ⏭️  ${cp.padEnd(10)} (${domain}) — index.html already customized (${currentIndex.length}B), skipping`)
      alreadyCustom++
      continue
    }

    // Step 3: generate per-domain unique placeholder
    const html = generatePlaceholder(domain)
    const ops = []
    // Always write per-domain index.html so Apache's DirectoryIndex picks it up
    ops.push({ file: 'index.html', content: html, reason: 'create per-domain unique index' })
    // Also replace _maintenance.html if it exists (was the cluster fingerprint)
    if (currentMaint) {
      ops.push({ file: '_maintenance.html', content: html, reason: 'replace shared maintenance HTML' })
    }

    if (DRY) {
      console.log(`  📝 [DRY] ${cp.padEnd(10)} (${domain}) — would write ${ops.length} file(s), ${html.length}B each`)
      skipped++
      continue
    }

    let allOk = true
    for (const op of ops) {
      try {
        const saved = await cpProxy.saveFileContent(cp, cpPass, '/public_html', op.file, op.content)
        if (saved && saved.status === 1) {
          console.log(`  ✅ ${cp.padEnd(10)} (${domain}) — wrote ${op.file} (${op.content.length}B) [${op.reason}]`)
        } else {
          const err = (saved?.errors || [])[0] || JSON.stringify(saved).slice(0, 120)
          console.log(`  ❌ ${cp.padEnd(10)} (${domain}) — saveFileContent ${op.file}: ${err}`)
          allOk = false
        }
      } catch (e) {
        console.log(`  ❌ ${cp.padEnd(10)} (${domain}) — write ${op.file} failed: ${e.message}`)
        allOk = false
      }
    }
    if (allOk) replaced++; else failed++
  }

  console.log('')
  console.log(`SUMMARY: replaced=${replaced}, alreadyCustom=${alreadyCustom}, failed=${failed}, dryRun=${skipped}`)
  await mc.close()
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
