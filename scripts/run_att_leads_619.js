// ─────────────────────────────────────────────────────────────────────────
// AT&T leads in area code 619 → owner name (CNAM) → deliver to @onarrival1
// Reuses the bot's tested modules: validatePhoneAlcazar + lookupCnam +
// isRealPersonName. Standalone, send-only Telegram (no polling/webhook).
//
// Env config:
//   LEAD_TARGET     (default 500)  target count
//   LEAD_REQUIRE_NAME (0/1)        when 1, only count numbers WITH a real owner name
//   LEAD_EXCLUDE_FILE path         skip numbers already present in this file (1st token = phone)
//   LEAD_COMBINE_WITH path         after run, merge new named leads with this prior named file
//   LEAD_MAX_MIN    (default 90)   wall-clock cap
//   LEAD_AREA       (default 619)
//   LEAD_PARALLEL   (default 8)
//   LEAD_DELIVER    (0/1, default 1)
// ─────────────────────────────────────────────────────────────────────────
require('dotenv').config({ path: '/app/scripts/.env.leadgen' })

const fs = require('fs')
const { customAlphabet } = require('nanoid')
const validatePhoneAlcazar = require('/app/js/validatePhoneAlcazar')
const { lookupCnam } = require('/app/js/cnam-service')
const { isRealPersonName } = require('/app/js/validatePhoneBulk')
const TelegramBot = require('node-telegram-bot-api')

const CARRIER  = 'AT&T'
const CC       = '1'
const AREA     = process.env.LEAD_AREA || '619'
const TARGET   = Number(process.env.LEAD_TARGET || 500)
const REQUIRE_NAME = process.env.LEAD_REQUIRE_NAME === '1'
const EXCLUDE_FILE = process.env.LEAD_EXCLUDE_FILE || ''
const COMBINE_WITH = process.env.LEAD_COMBINE_WITH || ''
const MAX_MIN  = Number(process.env.LEAD_MAX_MIN || 90)
const PARALLEL = Number(process.env.LEAD_PARALLEL || 8)
const DELIVER  = process.env.LEAD_DELIVER !== '0'
const ADMIN    = process.env.TELEGRAM_ADMIN_CHAT_ID || '5590563715'

const part1 = customAlphabet('23456789', 1)
const part2 = customAlphabet('0123456789', 6)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const ts = () => new Date().toISOString().slice(11, 19)

const seen = new Set()
const results = [] // { phone:'+1619…', carrier, name }
let attFound = 0   // total AT&T numbers found (named or not)

// Parse "phone" (digits) from the first token of a leads line: "+16195551234 NAME"
function digitsFromLine(line) {
  const tok = (line.trim().split(/\s+/)[0] || '').replace(/[^0-9]/g, '')
  return tok
}

// Pre-seed the exclude set so we never regenerate previously-delivered numbers
if (EXCLUDE_FILE && fs.existsSync(EXCLUDE_FILE)) {
  let n = 0
  for (const line of fs.readFileSync(EXCLUDE_FILE, 'utf8').split('\n')) {
    const d = digitsFromLine(line)
    if (d.length === 11 && d.startsWith('1')) { seen.add(d); n++ }
  }
  console.log(`[${ts()}] excluded ${n} previously-generated numbers from ${EXCLUDE_FILE}`)
}

async function oneNumber() {
  const phone = CC + AREA + part1() + part2() // 11 digits: 1 619 X XXXXXX
  if (seen.has(phone)) return null
  seen.add(phone)
  let res1
  try { res1 = await validatePhoneAlcazar(CARRIER, phone) } catch (e) { return { _err: e.message } }
  if (!res1) return null
  let name = ''
  try { const n = await lookupCnam(phone); if (n && isRealPersonName(n)) name = String(n).trim() } catch (_) {}
  return { phone: res1[0], carrier: res1[1], name }
}

async function main() {
  console.log(`[${ts()}] START AT&T — area ${AREA}, target ${TARGET} (${REQUIRE_NAME ? 'WITH owner name' : 'numbers'}), parallel ${PARALLEL}, maxMin ${MAX_MIN}`)
  const start = Date.now()
  let attempts = 0, lastLog = 0

  while (results.length < TARGET) {
    if ((Date.now() - start) > MAX_MIN * 60 * 1000) {
      console.log(`[${ts()}] TIME LIMIT (${MAX_MIN}min) at ${results.length}/${TARGET}`)
      break
    }
    const batch = await Promise.all(Array.from({ length: PARALLEL }, oneNumber))
    attempts += PARALLEL
    for (const r of batch) {
      if (!r) continue
      if (r._err) continue
      attFound++
      if (REQUIRE_NAME) { if (r.name) results.push(r) }
      else results.push(r)
    }

    // Early abort only if the validation provider yields ZERO AT&T hits at all
    if (attempts >= 300 && attFound === 0) {
      console.log(`[${ts()}] EARLY ABORT — 0 AT&T hits after ${attempts} attempts. Alcazar key/quota likely bad.`)
      if (DELIVER) {
        try {
          const b = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN_PROD, { polling: false })
          await b.sendMessage(ADMIN, `⚠️ AT&T ${AREA} run aborted — 0 validation hits after ${attempts} attempts (check Alcazar key/quota).`)
        } catch (_) {}
      }
      process.exit(1)
    }

    if (attempts - lastLog >= 250) {
      lastLog = attempts
      console.log(`[${ts()}] progress: ${results.length}/${TARGET} ${REQUIRE_NAME ? 'named' : 'numbers'} | AT&T found ${attFound} | attempts ${attempts} | ${Math.round((Date.now()-start)/1000)}s`)
    }
    await sleep(1000)
  }

  const elapsedMin = ((Date.now() - start) / 60000).toFixed(1)
  console.log(`[${ts()}] DONE — ${results.length} ${REQUIRE_NAME ? 'named' : 'numbers'} | AT&T found ${attFound} | ${attempts} attempts | ${elapsedMin}min`)

  // ── Write new-batch file (named leads) ──
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const named = results.filter(r => r.name)
  const newNamedPath = `/app/scripts/ATT_${AREA}_NEW_named_${stamp}.txt`
  fs.writeFileSync(newNamedPath, named.map(r => `${r.phone} ${r.name}`).join('\n'))
  console.log(`[${ts()}] wrote ${newNamedPath} (${named.length})`)

  // ── Combine with a prior named file (dedupe by phone) → >500 total ──
  let combinedPath = null, combinedCount = 0
  if (COMBINE_WITH && fs.existsSync(COMBINE_WITH)) {
    const map = new Map()
    for (const line of fs.readFileSync(COMBINE_WITH, 'utf8').split('\n')) {
      const t = line.trim(); if (!t) continue
      const sp = t.indexOf(' ')
      if (sp === -1) continue
      const phone = t.slice(0, sp).trim(); const nm = t.slice(sp + 1).trim()
      if (phone) map.set(phone, nm)
    }
    for (const r of named) map.set(r.phone, r.name)
    combinedCount = map.size
    combinedPath = `/app/scripts/ATT_${AREA}_COMBINED_with_names_${stamp}.txt`
    fs.writeFileSync(combinedPath, [...map.entries()].map(([p, n]) => `${p} ${n}`).join('\n'))
    console.log(`[${ts()}] wrote ${combinedPath} (${combinedCount} combined named)`)
  }

  if (!DELIVER) { console.log('[deliver disabled]'); return }

  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN_PROD, { polling: false })
  let summary =
    `📞 <b>AT&T Leads — Area Code ${AREA} (batch 2)</b>\n\n` +
    `👤 New numbers WITH owner name: <b>${named.length}</b>\n` +
    `🌐 Format: <code>+1XXXXXXXXXX</code>\n` +
    `⏱️ ${elapsedMin} min`
  if (combinedPath) summary += `\n\n📦 Combined with previous batch → <b>${combinedCount}</b> total with owner name.`
  await bot.sendMessage(ADMIN, summary, { parse_mode: 'HTML' })
  await bot.sendDocument(ADMIN, newNamedPath, {}, { filename: `ATT_${AREA}_${named.length}_NEW_with_owner_name.txt`, contentType: 'text/plain' })
  if (combinedPath) {
    await bot.sendDocument(ADMIN, combinedPath, {}, { filename: `ATT_${AREA}_${combinedCount}_with_owner_name.txt`, contentType: 'text/plain' })
  }
  console.log(`[${ts()}] delivered to admin ${ADMIN}`)
}

main().then(() => process.exit(0)).catch(e => { console.error('FATAL', e); process.exit(1) })
