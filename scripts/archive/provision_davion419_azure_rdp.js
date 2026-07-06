#!/usr/bin/env node
/**
 * Provision ONE Azure D2s_v6 (RDP 10) Windows RDP for @davion419 (chatId 404562920)
 * as goodwill remediation for the orphaned Contabo RDP. Uses the bot's own
 * createVPSInstance() pipeline so the vpsPlansOf record + routing match exactly.
 *
 * READ THIS: spends real Azure money (~$30/mo, authorized by operator).
 * Run:  node /app/scripts/provision_davion419_azure_rdp.js
 */
'use strict'
require('dotenv').config()
const { MongoClient } = require('mongodb')

const CHAT = '404562920'

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  console.log('[prov] connected to', process.env.DB_NAME)

  const vmSetup = require('/app/js/vm-instance-setup.js')
  vmSetup.initVpsDb(db)

  const vpsProvider = require('/app/js/vps-provider.js')
  console.log('[prov] RDP provider =', vpsProvider.RDP_PROVIDER, '| default =', vpsProvider.DEFAULT_PROVIDER)

  // Build vpsDetails for Azure RDP 10 (Standard_D2s_v6), US-east region.
  const azure = require('/app/js/azure-service.js')
  const product = azure.getProduct('Standard_D2s_v6')
  const pricing = azure.calculatePrice(product, 'US-east', true)
  console.log('[prov] product:', product.name, product.cpuCores + 'vCPU', Math.round(product.ramMb/1024)+'GB',
              '| ourCost $' + product.basePriceUsd, '| customerPrice $' + pricing.totalWithMarkup)

  const vpsDetails = {
    isRDP: true,
    os: { name: '🖥 RDP', value: 'win', osType: 'Windows', isRDP: true, pricePerMonth: 0 },
    config: Object.assign({}, product, { monthlyPrice: pricing.totalWithMarkup, billingCycles: [{ type: 'Monthly', price: pricing.totalWithMarkup, period: 1 }] }),
    productId: 'Standard_D2s_v6',
    region: 'US-east',
    regionName: 'US East',
    zone: 'US-east',
    zoneName: 'US East',
    plantotalPrice: pricing.totalWithMarkup,
    monthlyPrice: pricing.totalWithMarkup,
  }

  console.log('[prov] calling createVPSInstance...')
  const result = await vmSetup.createVPSInstance(CHAT, vpsDetails)
  console.log('[prov] createVPSInstance result:', JSON.stringify(result, null, 2))

  if (!result || !result.success) {
    console.error('[prov] PROVISION FAILED'); await client.close(); process.exit(1)
  }

  const data = result.data
  const instanceId = String(data.contaboInstanceId || data._id)
  console.log('[prov] instanceId =', instanceId)

  // Tag the new record with comp/remediation metadata
  await db.collection('vpsPlansOf').updateOne(
    { contaboInstanceId: instanceId },
    { $set: {
        comp: true,
        compReason: 'contabo-orphan-remediation-2026-06 (one Azure RDP replacing lost Contabo RDP)',
        compAt: new Date(),
        compBy: 'admin/orphan-remediation',
        defaultUser: 'nomadly',   // Azure VM admin user (from _safeUsername fallback)
      }
    }
  )
  console.log('[prov] record tagged comp + defaultUser=nomadly')

  // Poll Azure for the public IP (up to ~8 min)
  console.log('[prov] polling Azure for public IP...')
  let ip = null
  for (let i = 1; i <= 32; i++) {
    await new Promise(r => setTimeout(r, 15000))
    try {
      const live = await azure.getInstance(instanceId)
      const cand = live?.ipConfig?.v4?.ip || live?.mainIp || live?.ipv4 || null
      const status = live?.status
      console.log(`[prov] poll ${i}: status=${status} ip=${cand}`)
      if (cand && cand !== 'provisioning...' && cand !== '0.0.0.0') {
        ip = cand
        await db.collection('vpsPlansOf').updateOne({ contaboInstanceId: instanceId }, { $set: { host: ip, status: 'RUNNING' } })
        break
      }
    } catch (e) {
      console.log(`[prov] poll ${i} err: ${e.message || e}`)
    }
  }
  console.log('[prov] FINAL IP =', ip)
  console.log('[prov] credentials from createVPSInstance:', JSON.stringify(data.credentials))

  await client.close()
  console.log('[prov] DONE')
  process.exit(0)
})().catch(e => { console.error('[prov] FATAL', e); process.exit(1) })
