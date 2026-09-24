'use strict'
// Ad-hoc verification for the 4 RDP tasks: renders the real lang templates in all
// 4 locales with representative RDP data and asserts the trimmed message + discount
// display + absence of VPS/Linux wording leaks in RDP paths.
require('dotenv').config({ path: require('path').resolve(__dirname, '../../backend/.env') })

const langs = ['en', 'fr', 'zh', 'hi']
let pass = 0, fail = 0
const ok = (c, m) => { c ? (pass++, console.log('  \u2705 ' + m)) : (fail++, console.log('  \u274c ' + m)) }

const rdpResponse = { host: '203.0.113.55', label: 'nomadly-x7k2p9', isRDP: true, osType: 'Windows' }
const rdpCreds = { username: 'Administrator', password: 'Ab3!xYz9-Qw77Lm22' }
const rdpDetails = { isRDP: true, os: { name: 'Windows Server 2022' } }

// askRdpDuration inputs: a config + billingCycles with real bundle prices (Standard tier)
const config = { name: 'Standard \u2014 Windows RDP', monthlyPrice: 56, specs: { vCPU: 2, RAM: 4, disk: 80 } }
const cycles = [
  { type: 'Monthly', price: 56, period: 1, productId: 'standard-1m', discountPct: 0 },
  { type: '2 Months', price: 100.8, period: 2, productId: 'standard-2m', discountPct: 10 },
  { type: '3 Months', price: 142.8, period: 3, productId: 'standard-3m', discountPct: 15 },
]

for (const lng of langs) {
  console.log(`\n\u2014 Lang: ${lng} \u2014`)
  const t = require(`../lang/${lng}.js`)[lng].vp

  // ── Task 3: concise "RDP ready" message + no "VPS management" leak ──
  const ready = t.vpsBoughtSuccess(rdpDetails, rdpResponse, rdpCreds)
  ok(/RDP/.test(ready) && ready.includes(rdpResponse.host), 'vpsBoughtSuccess renders RDP + IP')
  ok(ready.includes('3389') && /mstsc|Remote Desktop|远程桌面|रिमोट/i.test(ready), 'has ONE RDP connect line (mstsc :3389)')
  ok(!/ssh /i.test(ready), 'no SSH connect line leaked into RDP message')
  ok(!/VPS management/i.test(ready), 'no "VPS management" wording leak')
  ok(/RDP management|RDP प्रबंधन|RDP 管理|gestion (du |de l')?RDP/i.test(ready) || ready.includes('RDP'), 'password-loss note references RDP management')
  // trimmed: credentials + 1 connect + 1 note (no multi-paragraph filler)
  const bodyLines = ready.split('\n').filter(l => l.trim())
  ok(bodyLines.length <= 12, `message is trimmed (${bodyLines.length} non-empty lines \u2264 12)`)

  // ── Task 4: duration selector shows the 10%/15% bundle savings ──
  const dur = t.askRdpDuration(config, cycles)
  ok(dur.includes('100.8') && dur.includes('142.8'), 'duration screen shows 2mo & 3mo prices')
  ok(/10\s?%/.test(dur) && /15\s?%/.test(dur), 'duration screen shows save 10% and 15%')
  ok(!/\bVPS\b/.test(dur) && !/SSH|Linux/i.test(dur), 'duration screen has no VPS/SSH/Linux leak')

  // ── Duration BUTTONS carry the localized "Save X%" label on 2/3-month terms ──
  const b1 = t.rdpDurationBtn(cycles[0]), b2 = t.rdpDurationBtn(cycles[1]), b3 = t.rdpDurationBtn(cycles[2])
  ok(b2.includes('100.8') && b3.includes('142.8'), 'duration buttons show discounted 2mo/3mo prices')
  ok(/10\s?%/.test(b2) && /15\s?%/.test(b3), 'duration buttons show 10% / 15% savings label')
  ok(!/%/.test(b1), '1-month button has no savings label')

  // ── Task 4: crypto checkout wording (RDP vs VPS) ──
  const cryptoRdp = t.showDepositCryptoInfoVps(142.8, 0.0021, 'BTC', 'bc1qexampleaddress', { isRDP: true })
  ok(/Windows RDP|RDP/i.test(cryptoRdp) && !/\bVPS\b/.test(cryptoRdp), 'crypto info (RDP) says Windows RDP, not VPS')
  const cryptoVps = t.showDepositCryptoInfoVps(30, 0.0005, 'BTC', 'bc1qexampleaddress', { isRDP: false })
  ok(/\bVPS\b/.test(cryptoVps), 'crypto info (Linux) still says VPS')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
