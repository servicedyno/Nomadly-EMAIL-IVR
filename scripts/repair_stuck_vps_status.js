#!/usr/bin/env node
/**
 * Repair stuck VPS status: DigitalOcean records left at 'provisioning'/'new'
 * in vpsPlansOf that are actually ACTIVE (running) on DO get corrected to
 * 'RUNNING'. Verifies live provider status BEFORE writing. Only touches DO
 * records with a non-terminal stuck status. No provider mutations.
 *
 * Usage:
 *   node scripts/repair_stuck_vps_status.js          # dry-run (report only)
 *   node scripts/repair_stuck_vps_status.js --apply   # perform the DB update
 */
'use strict'
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const { MongoClient } = require('mongodb')

const APPLY = process.argv.includes('--apply')
const TOKEN = process.env.DIGITALOCEAN_API_TOKEN || ''
const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'test'
const STUCK = ['provisioning', 'installing', 'new', 'INSTALLING', 'PROVISIONING', 'NEW']

const http = axios.create({
  baseURL: 'https://api.digitalocean.com/v2',
  timeout: 30000,
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
})

async function liveDropletStatus(rawId) {
  try {
    const { data } = await http.get(`/droplets/${rawId}`)
    return data.droplet ? data.droplet.status : null  // active | off | new | archive
  } catch (e) {
    if (e.response && e.response.status === 404) return '404'
    return `err:${e.response ? e.response.status : e.message}`
  }
}

;(async () => {
  console.log(`\n=== Repair stuck VPS status (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`)
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const col = client.db(DB_NAME).collection('vpsPlansOf')

  const isDO = (p) => {
    const prov = String(p.provider || '').toLowerCase()
    if (prov === 'digitalocean' || prov === 'do') return true
    return String(p.vpsId || p.contaboInstanceId || '').startsWith('do-')
  }

  const all = await col.find({}).toArray()
  const candidates = all.filter(p => isDO(p) && STUCK.includes(String(p.status)))

  console.log(`DO records with stuck status: ${candidates.length}\n`)
  if (!candidates.length) { console.log('Nothing to repair.'); await client.close(); return }

  let fixed = 0
  for (const p of candidates) {
    const wrapped = String(p.vpsId || p.contaboInstanceId || '')
    const rawId = wrapped.replace(/^do-/, '')
    const live = await liveDropletStatus(rawId)
    const owner = p.chatId || p._id
    let action
    if (live === 'active') {
      action = 'FIX -> RUNNING'
      if (APPLY) {
        const r = await col.updateOne(
          { _id: p._id },
          { $set: { status: 'RUNNING', _statusRepairedAt: new Date(), _statusRepairFrom: p.status } }
        )
        action += r.modifiedCount === 1 ? ' [written]' : ' [no-op]'
        if (r.modifiedCount === 1) fixed++
      }
    } else if (live === 'off') {
      action = 'skip (droplet powered OFF -> leave as-is)'
    } else if (live === '404') {
      action = 'skip (droplet not found on DO)'
    } else {
      action = `skip (live status=${live})`
    }
    console.log(`  ${wrapped}  owner=${owner}  db='${p.status}'  live='${live}'  => ${action}`)
  }

  console.log(`\n${APPLY ? `Applied: ${fixed} record(s) set to RUNNING.` : 'Dry-run only. Re-run with --apply to write.'}`)
  await client.close()
})().catch(e => { console.error('REPAIR ERROR:', e.message); process.exit(1) })
