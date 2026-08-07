// READ-ONLY: Full sweep of Twilio 2026 "strictly zero compliance" countries.
// Strictly zero for a (country, numberType) =
//   addressRequirements === 'none'  (no Twilio Address needed)
//   AND no regulatory bundle: across ALL end-user types for that numberType,
//       end_user requirements == 0 AND supporting_document requirements == 0.
const fs = require('fs')
const twilio = require('twilio')
function envVal(key){const m=fs.readFileSync('/app/backend/.env','utf8').match(new RegExp('^'+key+'="?([^"\\n]+)"?','m'));return m?m[1]:null}

const OUT = '/app/tmp_twilio_reg_out.json'
const LOG = '/app/tmp_twilio_reg.log'
function log(s){ fs.appendFileSync(LOG, s + '\n'); console.log(s) }

// available-number accessor -> regulations numberType label
const TYPES = [
  { key: 'local',    avail: 'local',    regType: 'local'     },
  { key: 'mobile',   avail: 'mobile',   regType: 'mobile'    },
  { key: 'tollfree', avail: 'tollFree', regType: 'toll-free' },
]

function docCount(sd){ // supporting_document is array of groups (array of arrays)
  if(!Array.isArray(sd)) return 0
  return sd.reduce((a,x)=>a + (Array.isArray(x)?x.length:1), 0)
}

;(async()=>{
  fs.writeFileSync(LOG,'')
  const client = twilio(envVal('TWILIO_ACCOUNT_SID'), envVal('TWILIO_AUTH_TOKEN'))

  const countries = await client.availablePhoneNumbers.list({ limit: 1000 })
  log('Total Twilio countries: ' + countries.length)

  const results = {}

  for (const c of countries) {
    const iso = c.countryCode, name = c.country
    results[iso] = { country: name, iso, types: {} }

    // Build regulation map: regType -> {maxEnd, maxDoc, hasReg}
    const regMap = {}
    try {
      const regs = await client.numbers.v2.regulatoryCompliance.regulations.list({ isoCountry: iso, limit: 100 })
      for (const r of regs) {
        const nt = (r.numberType || '').toLowerCase()
        const req = r.requirements || {}
        const eu = Array.isArray(req.end_user) ? req.end_user.length : 0
        const sd = docCount(req.supporting_document)
        const m = regMap[nt] || { maxEnd: 0, maxDoc: 0, hasReg: false }
        m.hasReg = true
        m.maxEnd = Math.max(m.maxEnd, eu)
        m.maxDoc = Math.max(m.maxDoc, sd)
        regMap[nt] = m
      }
    } catch (e) {}

    for (const t of TYPES) {
      let sample = null
      try {
        const av = await client.availablePhoneNumbers(iso)[t.avail].list({ limit: 1 })
        if (av && av.length) sample = av[0]
      } catch (e) {}
      if (!sample) continue

      const addrReq = sample.addressRequirements
      const reg = regMap[t.regType] || { maxEnd: 0, maxDoc: 0, hasReg: false }
      const bundleRequired = (reg.maxEnd > 0) || (reg.maxDoc > 0)
      const strictlyZero = (addrReq === 'none') && !bundleRequired
      results[iso].types[t.key] = {
        sampleNumber: sample.phoneNumber,
        addressRequirements: addrReq,
        regHasEntry: reg.hasReg,
        regEndUserFields: reg.maxEnd,
        regSupportingDocs: reg.maxDoc,
        bundleRequired,
        strictlyZero,
      }
    }

    const zeroTypes = Object.entries(results[iso].types).filter(([,v])=>v.strictlyZero).map(([k])=>k)
    log(`${iso} ${name} :: types=${Object.keys(results[iso].types).join(',')||'none'} | ZERO=[${zeroTypes.join(',')||'-'}]`)
  }

  const strictly = [], noAddrButBundle = []
  for (const iso of Object.keys(results)) {
    const r = results[iso]
    const zeroTypes = Object.entries(r.types).filter(([,v])=>v.strictlyZero).map(([k])=>k)
    if (zeroTypes.length) strictly.push({ iso, country: r.country, zeroTypes })
    else {
      const noAddr = Object.entries(r.types).filter(([,v])=>v.addressRequirements==='none').map(([k])=>k)
      if (noAddr.length) noAddrButBundle.push({ iso, country: r.country, noAddrTypesButBundle: noAddr })
    }
  }
  strictly.sort((a,b)=>a.country.localeCompare(b.country))
  noAddrButBundle.sort((a,b)=>a.country.localeCompare(b.country))

  const out = { generatedAt:new Date().toISOString(), totalCountries:countries.length,
    strictlyZeroCompliance:strictly, noAddressButBundleRequired:noAddrButBundle, raw:results }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))

  log('\n================ STRICTLY ZERO COMPLIANCE (no address, no bundle) ================')
  for (const s of strictly) log(`  ${s.iso}  ${s.country}  ->  ${s.zeroTypes.join(', ')}`)
  log('\nTotal strictly-zero countries: ' + strictly.length)
  log('Saved detail to ' + OUT)
  process.exit(0)
})().catch(e=>{ log('FATAL: ' + (e.message||e)); process.exit(1) })
