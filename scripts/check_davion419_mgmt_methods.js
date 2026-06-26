#!/usr/bin/env node
/** Confirm every bot VPS management action routes to Azure for davion419's record. */
'use strict'
require('dotenv').config()
const { MongoClient } = require('mongodb')

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  const rec = await db.collection('vpsPlansOf').findOne({ contaboInstanceId: 'az-nmdcbaec20f3' })
  const { getProviderForRecord } = require('/app/js/vps-provider.js')
  const svc = getProviderForRecord(rec)
  console.log('record.provider =', rec.provider, '| svc.PROVIDER =', svc.PROVIDER)
  const methods = ['getInstance','startInstance','stopInstance','restartInstance','shutdownInstance',
                   'resetPassword','reinstallInstance','cancelInstance','upgradeInstance','updateInstanceName']
  for (const m of methods) {
    console.log(`  ${m.padEnd(18)} -> ${typeof svc[m] === 'function' ? '✅ function (azure)' : '❌ MISSING'}`)
  }
  await client.close()
  process.exit(0)
})().catch(e => { console.error('FATAL', e); process.exit(1) })
