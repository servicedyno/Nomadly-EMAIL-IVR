/**
 * End-to-end smoke test of the bot's VPS provisioning flow against OVH.
 * Walks every screen the user goes through (region → disk → tier → OS),
 * then dry-run-creates an instance. NEVER triggers a real OVH checkout.
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })

const vps = require('../vm-instance-setup')

function assert(cond, label) {
  if (cond) console.log(`  ✓ ${label}`)
  else { console.log(`  ✗ ${label}`); process.exitCode = 1 }
}

;(async () => {
  console.log('━━━ Step 1: fetchAvailableCountries (region picker)')
  const countries = await vps.fetchAvailableCountries()
  console.log(`  Got ${countries?.length} country/region buttons:`)
  for (const c of (countries || [])) console.log(`     ${c}`)
  assert(Array.isArray(countries) && countries.length === 9, '9 datacenter buttons (BHS+8 others)')

  console.log('\n━━━ Step 2: fetchAvailableRegionsOfCountry (Canada BHS)')
  const regionsOfCanada = await vps.fetchAvailableRegionsOfCountry(countries[0])
  console.log(`  Got ${regionsOfCanada?.length} regions for ${countries[0]}`)
  assert(regionsOfCanada?.length >= 1, 'At least one region per country')
  const region = regionsOfCanada[0].value
  console.log(`  Picked region: ${region}`)

  console.log('\n━━━ Step 3: fetchAvailableZones')
  const zones = await vps.fetchAvailableZones(region)
  console.log(`  Got ${zones?.length} zones: ${zones?.map(z => z.label).join(', ')}`)
  assert(zones?.length === 1, 'One zone per region (OVH datacenter == zone)')

  console.log('\n━━━ Step 4: fetchAvailableDiskTpes (should be NVMe-only on OVH)')
  const diskTypes = await vps.fetchAvailableDiskTpes(region)
  console.log(`  Got ${diskTypes?.length} disk options: ${diskTypes?.map(d => d.label).join(', ')}`)
  assert(diskTypes?.length === 1 && diskTypes[0].name === 'NVMe', 'Only NVMe (OVH has no SSD split)')

  console.log('\n━━━ Step 5a: fetchAvailableVPSConfigs (Linux)')
  const cfgLinux = await vps.fetchAvailableVPSConfigs(999, { region, diskType: 'nvme', isRDP: false })
  for (const c of cfgLinux) {
    console.log(`  Tier ${c.tier} ${c.name}: ${c.cpuCores}c/${c.ramGb}G/${c.diskGb}G → $${c.monthlyPrice}/mo`)
  }
  assert(cfgLinux.length === 6, 'Six Linux tiers')
  assert(cfgLinux[0].monthlyPrice === 12.60, 'Tier 1 Linux = $12.60 (vps-starter)')

  console.log('\n━━━ Step 5b: fetchAvailableVPSConfigs (RDP)')
  const cfgRdp = await vps.fetchAvailableVPSConfigs(999, { region, diskType: 'nvme', isRDP: true })
  for (const c of cfgRdp) {
    console.log(`  Tier ${c.tier} RDP ${c.name}: ${c.cpuCores}c/${c.ramGb}G/${c.diskGb}G → $${c.monthlyPrice}/mo`)
  }
  assert(cfgRdp.length === 5, 'Five RDP tiers (Tier 1 Linux-only)')
  assert(cfgRdp[0].monthlyPrice === 47.10, 'First RDP tier = $47.10 (vps-value-1-4-20 + win)')

  console.log('\n━━━ Step 6: fetchAvailableOS')
  const oses = await vps.fetchAvailableOS(null)
  for (const o of oses) console.log(`  ${o.name} (${o.osType}) RDP=${o.isRDP}`)
  assert(oses.find(o => o.isRDP), 'RDP option included')
  assert(oses.find(o => o.name === 'ubuntu-24.04'), 'ubuntu-24.04 included')

  console.log('\n━━━ Step 7: createVPSInstance (DRY RUN — no real order)')
  process.env.OVH_DRY_RUN = 'true'
  try {
    const result = await vps.createVPSInstance(999999, {
      region,
      diskType: 'nvme',
      config: { _id: 'VST1' },     // Tier 1 productId
      productId: 'VST1',
      os: { id: 'ubuntu-24.04', isRDP: false },
    })
    console.log(`  Result: ${JSON.stringify(result, null, 2).slice(0, 500)}`)
    assert(!result.error, 'No error from createVPSInstance')
  } catch (e) {
    console.log(`  Caught: ${e.message}`)
  } finally {
    delete process.env.OVH_DRY_RUN
  }

  console.log('\n━━━ DONE. Exit code:', process.exitCode || 0)
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
