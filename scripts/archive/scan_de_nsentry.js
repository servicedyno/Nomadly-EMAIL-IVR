/**
 * One-shot fleet audit: detect .de domains currently stuck in DENIC
 * "Nsentry mode" — a known OpenProvider race where the domain ends up
 * with `Nsentry: <domain> IN A <ip>` instead of `Nserver: <ns>` at the
 * .de registry. Symptom: live DNS returns OP's parking IP, CF zone
 * stuck at `status: pending`, customer site times out.
 *
 * Root incident: @HHR2009 / rsvpeviteopen.de (Feb 2026, see CHANGELOG.md).
 * Fix: PUT to OP with `name_servers + ns_group: ''` triggers a registry
 * chprov that flips Nsentry → Nserver. The upstream fix was added to
 * `_sendNsUpdate` so all future NS updates carry `ns_group: ''`.
 *
 * Usage:
 *   node scripts/scan_de_nsentry.js                   # dry-run, report only
 *   node scripts/scan_de_nsentry.js --apply           # auto-heal each Nsentry
 *   node scripts/scan_de_nsentry.js --report <path>   # write JSON report
 *
 * The auto-heal is safe: it calls opService.updateNameservers() with the
 * SAME nameservers the DB already records as the intended delegation
 * (typically the two CF nameservers). All it does is re-push them with
 * the chprov-triggering `ns_group: ''` field. No state changes if the
 * DB has no recorded nameservers or if the domain is already in
 * Nserver mode.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const { execSync } = require('child_process')
const opService = require('/app/js/op-service.js')

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const reportIdx = args.indexOf('--report')
const REPORT_PATH = reportIdx !== -1 ? args[reportIdx + 1] : null
const ONLY_DOMAIN_IDX = args.indexOf('--domain')
const ONLY_DOMAIN = ONLY_DOMAIN_IDX !== -1 ? args[ONLY_DOMAIN_IDX + 1] : null
const WHOIS_TIMEOUT_MS = 15000
const BATCH_SIZE = 5
const SLEEP_BETWEEN_BATCHES_MS = 2000  // be polite to DENIC whois server

function whoisLookup(domain) {
  try {
    const out = execSync(`whois ${domain}`, { timeout: WHOIS_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf-8')
    return out
  } catch (e) {
    return `__WHOIS_ERROR__ ${e.message}`
  }
}

function parseDenic(rawWhois) {
  if (!rawWhois || rawWhois.startsWith('__WHOIS_ERROR__')) {
    return { mode: 'ERROR', raw: rawWhois || '' }
  }
  const lines = rawWhois.split('\n')
  const nserverLines = lines.filter((l) => /^Nserver:/i.test(l)).map((l) => l.split(':').slice(1).join(':').trim().toLowerCase())
  const nsentryLines = lines.filter((l) => /^Nsentry:/i.test(l)).map((l) => l.split(':').slice(1).join(':').trim())
  const statusLine = lines.find((l) => /^Status:/i.test(l))
  const status = statusLine ? statusLine.split(':').slice(1).join(':').trim() : ''
  const changedLine = lines.find((l) => /^Changed:/i.test(l))
  const changed = changedLine ? changedLine.split(':').slice(1).join(':').trim() : ''

  if (nsentryLines.length > 0 && nserverLines.length === 0) return { mode: 'NSENTRY', status, changed, nsentry: nsentryLines }
  if (nserverLines.length > 0) return { mode: 'NSERVER', status, changed, nserver: nserverLines }
  if (/free|invalid/i.test(status)) return { mode: 'UNREGISTERED', status }
  return { mode: 'UNKNOWN', status, changed, raw: rawWhois.slice(0, 400) }
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

;(async () => {
  const startedAt = new Date().toISOString()
  console.log(`\n=== .de DENIC Nsentry audit — ${APPLY ? 'APPLY' : 'DRY-RUN'} — ${startedAt} ===\n`)

  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')

  // Build candidate list: .de domains from registeredDomains + domainsOf
  let candidates = new Set()
  if (ONLY_DOMAIN) {
    candidates.add(ONLY_DOMAIN.toLowerCase())
  } else {
    const r1 = await db.collection('registeredDomains').find({ _id: /\.de$/i }).project({ _id: 1 }).toArray()
    for (const r of r1) if (r._id) candidates.add(String(r._id).toLowerCase())
    const r2 = await db.collection('domainsOf').find({ domainName: /\.de$/i }).project({ domainName: 1 }).toArray()
    for (const r of r2) if (r.domainName) candidates.add(String(r.domainName).toLowerCase())
  }
  const domains = Array.from(candidates).sort()
  console.log(`Found ${domains.length} .de domain(s) to audit\n`)

  const results = []
  for (let i = 0; i < domains.length; i += BATCH_SIZE) {
    const batch = domains.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(batch.map(async (domain) => {
      const whois = whoisLookup(domain)
      const parsed = parseDenic(whois)
      const reg = await db.collection('registeredDomains').findOne({ _id: domain })
      const dof = await db.collection('domainsOf').findOne({ domainName: domain })
      const intendedNs = (reg?.val?.nameservers && Array.isArray(reg.val.nameservers) ? reg.val.nameservers : null)
        || (dof?.nameservers && Array.isArray(dof.nameservers) ? dof.nameservers : null)
        || null
      return {
        domain,
        denicMode: parsed.mode,
        denicStatus: parsed.status,
        denicChanged: parsed.changed,
        denicNsentry: parsed.nsentry,
        denicNserver: parsed.nserver,
        nameserverType: reg?.val?.nameserverType || dof?.nameserverType || null,
        cfZoneId: reg?.val?.cfZoneId || dof?.cfZoneId || null,
        intendedNs,
        chatId: dof?.chatId || reg?.val?.ownerChatId || null,
        healAction: null,
        healResult: null,
      }
    }))

    // Auto-heal NSENTRY domains in this batch
    for (const r of batchResults) {
      if (r.denicMode === 'NSENTRY' && APPLY) {
        const nsToSet = r.intendedNs && r.intendedNs.length >= 2
          ? r.intendedNs
          : null
        if (!nsToSet) {
          r.healAction = 'SKIP — no intended NS recorded in DB'
        } else {
          try {
            const out = await opService.updateNameservers(r.domain, nsToSet)
            r.healAction = `RE-PUSHED NS via OP (ns_group:'' force-chprov)`
            r.healResult = out
          } catch (e) {
            r.healAction = `ERROR ${e.message}`
          }
        }
      } else if (r.denicMode === 'NSENTRY' && !APPLY) {
        r.healAction = 'DRY-RUN — would re-push NS to trigger chprov'
      }
    }

    for (const r of batchResults) results.push(r)
    process.stdout.write(`  scanned ${Math.min(i + BATCH_SIZE, domains.length)}/${domains.length}\r`)
    if (i + BATCH_SIZE < domains.length) await sleep(SLEEP_BETWEEN_BATCHES_MS)
  }

  // Summary
  const summary = { NSERVER: 0, NSENTRY: 0, UNREGISTERED: 0, UNKNOWN: 0, ERROR: 0, HEALED: 0, HEAL_SKIPPED: 0, HEAL_FAILED: 0 }
  for (const r of results) {
    summary[r.denicMode] = (summary[r.denicMode] || 0) + 1
    if (r.healAction && r.healAction.startsWith('RE-PUSHED')) summary.HEALED++
    else if (r.healAction && r.healAction.startsWith('SKIP')) summary.HEAL_SKIPPED++
    else if (r.healAction && r.healAction.startsWith('ERROR')) summary.HEAL_FAILED++
  }

  console.log('\n=== Summary ===')
  console.log(`  NSERVER     (proper)   : ${summary.NSERVER}`)
  console.log(`  NSENTRY     (BROKEN)   : ${summary.NSENTRY}`)
  console.log(`  UNREGISTERED           : ${summary.UNREGISTERED}`)
  console.log(`  UNKNOWN                : ${summary.UNKNOWN}`)
  console.log(`  ERROR (whois)          : ${summary.ERROR || 0}`)
  if (APPLY) {
    console.log(`  HEALED                 : ${summary.HEALED}`)
    console.log(`  HEAL_SKIPPED           : ${summary.HEAL_SKIPPED}`)
    console.log(`  HEAL_FAILED            : ${summary.HEAL_FAILED}`)
  }
  console.log(`  TOTAL                  : ${results.length}\n`)

  // Detail for non-NSERVER findings
  for (const r of results) {
    if (r.denicMode === 'NSERVER' || r.denicMode === 'UNREGISTERED') continue
    console.log(`[${r.denicMode}] ${r.domain} (chatId=${r.chatId || '?'}, status=${r.denicStatus || '?'})`)
    if (r.denicNsentry) console.log(`        nsentry: ${r.denicNsentry.join(', ')}`)
    if (r.intendedNs) console.log(`        intended NS: ${r.intendedNs.join(', ')}`)
    if (r.healAction) console.log(`        action: ${r.healAction}`)
    console.log()
  }

  const finishedAt = new Date().toISOString()
  if (REPORT_PATH) {
    require('fs').writeFileSync(REPORT_PATH, JSON.stringify({ startedAt, finishedAt, mode: APPLY ? 'APPLY' : 'DRY-RUN', summary, results }, null, 2))
    console.log(`Report written: ${REPORT_PATH}`)
  }

  await client.close()
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
