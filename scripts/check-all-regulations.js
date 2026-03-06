/**
 * Fetch Twilio regulatory requirements for ALL countries used in the Nomadly bot.
 * This helps us understand what documents each country needs for number purchases.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const twilio = require('twilio')
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

// All Twilio countries from phone-config.js (excluding US/CA which are Telnyx)
const TWILIO_COUNTRIES = [
  { code: 'US', types: ['local', 'toll_free'] },
  { code: 'CA', types: ['local', 'toll_free'] },
  { code: 'GB', types: ['mobile'] },
  { code: 'IE', types: ['local'] },
  { code: 'IL', types: ['local', 'mobile'] },
  { code: 'AU', types: ['toll_free', 'mobile'] },
  { code: 'NZ', types: ['local', 'toll_free'] },
  { code: 'HK', types: ['toll_free', 'mobile'] },
  { code: 'NL', types: ['mobile'] },
  { code: 'IT', types: ['toll_free'] },
  { code: 'PR', types: ['local'] },
  { code: 'TN', types: ['local'] },
  { code: 'FI', types: ['toll_free', 'mobile'] },
  { code: 'MX', types: ['toll_free'] },
  { code: 'CO', types: ['toll_free'] },
  { code: 'BG', types: ['toll_free'] },
  { code: 'CZ', types: ['local', 'toll_free'] },
  { code: 'EE', types: ['local', 'toll_free', 'mobile'] },
  { code: 'ID', types: ['toll_free'] },
  { code: 'KE', types: ['local'] },
  { code: 'MY', types: ['local'] },
  { code: 'PL', types: ['mobile'] },
  { code: 'RO', types: ['toll_free'] },
  { code: 'SK', types: ['toll_free'] },
  { code: 'ZA', types: ['local'] },
  { code: 'TH', types: ['toll_free', 'mobile'] },
]

async function run() {
  console.log('━━━ Twilio Regulatory Requirements for All Bot Countries ━━━\n')

  const results = []

  for (const country of TWILIO_COUNTRIES) {
    for (const numType of country.types) {
      try {
        // Fetch regulations for this country + type
        const regulations = await client.numbers.v2.regulatoryCompliance.regulations.list({
          isoCountry: country.code,
          numberType: numType,
          endUserType: 'individual',
          limit: 1,
        })

        if (regulations.length === 0) {
          results.push({
            country: country.code,
            numberType: numType,
            regulation: 'NONE',
            endUser: [],
            supportingDocs: [],
          })
          continue
        }

        const reg = regulations[0]
        const reqs = reg.requirements || {}

        // Parse end-user requirements
        const endUserReqs = (reqs.end_user || []).map(eu => ({
          type: eu.type,
          fields: eu.fields,
        }))

        // Parse supporting document requirements
        const docReqs = []
        const docGroups = reqs.supporting_document || []
        // supporting_document can be an array of arrays (OR groups)
        const flatDocs = Array.isArray(docGroups[0]) ? docGroups[0] : docGroups
        for (const docGroup of flatDocs) {
          const acceptedTypes = (docGroup.accepted_documents || []).map(d => ({
            type: d.type,
            name: d.name,
            fields: d.fields,
          }))
          docReqs.push({
            requirementName: docGroup.requirement_name,
            name: docGroup.name,
            description: docGroup.description,
            acceptedTypes,
          })
        }

        results.push({
          country: country.code,
          numberType: numType,
          regulation: reg.sid,
          regName: reg.friendlyName,
          endUser: endUserReqs,
          supportingDocs: docReqs,
        })

      } catch (e) {
        results.push({
          country: country.code,
          numberType: numType,
          error: e.message,
        })
      }
    }
  }

  // Print summary
  console.log('\n━━━ SUMMARY ━━━\n')

  // Group by requirement level
  const noBundle = []
  const addressOnly = []
  const docsRequired = []

  for (const r of results) {
    if (r.error) {
      console.log(`❓ ${r.country} ${r.numberType}: ERROR - ${r.error}`)
      continue
    }
    if (r.regulation === 'NONE') {
      noBundle.push(r)
      continue
    }
    if (r.supportingDocs.length === 0) {
      addressOnly.push(r)
      continue
    }
    docsRequired.push(r)
  }

  console.log('── NO REGULATION (instant buy) ──')
  for (const r of noBundle) {
    console.log(`  ✅ ${r.country} ${r.numberType}`)
  }

  console.log('\n── ADDRESS ONLY (end-user info, no documents) ──')
  for (const r of addressOnly) {
    console.log(`  📍 ${r.country} ${r.numberType} — ${r.regName}`)
    console.log(`     End-user fields: ${r.endUser.map(e => e.fields.join(', ')).join('; ')}`)
  }

  console.log('\n── DOCUMENTS REQUIRED (full regulatory bundle) ──')
  for (const r of docsRequired) {
    console.log(`  📄 ${r.country} ${r.numberType} — ${r.regName}`)
    console.log(`     End-user fields: ${r.endUser.map(e => e.fields.join(', ')).join('; ')}`)
    for (const doc of r.supportingDocs) {
      const types = doc.acceptedTypes.map(t => `${t.type}(${t.fields.join(',')})`).join(' OR ')
      console.log(`     📋 ${doc.name} [${doc.requirementName}]: ${types}`)
      if (doc.description) console.log(`        ℹ️ ${doc.description.trim().substring(0, 120)}`)
    }
  }

  // Output full JSON
  console.log('\n━━━ FULL JSON DATA ━━━')
  console.log(JSON.stringify(results, null, 2))
}

run().catch(err => console.error('Fatal:', err))
