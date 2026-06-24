#!/usr/bin/env node
/**
 * Sweeps orphan smoke-test resources (smoketest-tagged or `nmd*` VM resource family)
 * out of the Azure resource group. Useful when a smoke test bails partway
 * through and leaves IPs/NICs/NSGs/VNets behind.
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const az = require('/app/js/azure-service')
const axios = require('axios')

;(async () => {
  az.resetProvisioningCircuit()
  const t = await az._getToken()
  const SUB = process.env.AZURE_SUBSCRIPTION_ID
  const RG  = process.env.AZURE_RESOURCE_GROUP
  const url = `https://management.azure.com/subscriptions/${SUB}/resourceGroups/${RG}/resources?api-version=2021-04-01`
  const r = await axios.get(url, { headers: { Authorization: `Bearer ${t}` } })
  const items = r.data.value || []
  console.log(`Found ${items.length} resources in ${RG}`)

  // Collect unique "VM family roots" — names like `nmdXXXXXXXXX` derived from
  // smoke test runs. The instance-name pattern is `nmd{hex}` so we extract it
  // from any related resource name.
  const vmNames = new Set()
  for (const i of items) {
    const m = i.name.match(/^(nmd[0-9a-f]+)(-ip|-nic|-nsg|-vnet|-osdisk)?$/i)
    if (m) vmNames.add(m[1])
  }
  console.log(`Identified ${vmNames.size} VM groups to clean:`, [...vmNames].join(', '))

  for (const vmName of vmNames) {
    console.log(`\n─── Cleaning ${vmName} ───`)
    try {
      const r = await az.cancelInstance('az-' + vmName)
      for (const x of r.results) {
        console.log(`  ${x.deleted ? '✅' : '⚠️ '} ${x.type}/${x.name} ${x.deleted ? '' : '(' + (x.err || '') + ')'}`)
      }
    } catch (e) {
      console.error(`  ❌ cancelInstance failed:`, e.message)
    }
  }

  console.log('\n─── Done. Re-verifying RG resources ───')
  const r2 = await axios.get(url, { headers: { Authorization: `Bearer ${t}` } })
  console.log(`${(r2.data.value || []).length} resources remain`)
  for (const i of (r2.data.value || [])) console.log(`  - ${i.type.replace('Microsoft.', '')}/${i.name}`)
})()
