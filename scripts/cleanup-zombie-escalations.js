#!/usr/bin/env node
/**
 * cleanup-zombie-escalations.js
 * ─────────────────────────────
 * One-shot cleanup for the 42 zombie escalations discovered on 2026-07-09.
 *
 * Context:
 *   The escalation reminder loop used to hard-cap at 3 reminders (silent
 *   thereafter). When that cap was removed on 2026-07-08 to fix the 51-hour
 *   silence bug (chatId 8011229362), ALL historical unacked escalations —
 *   some 47 days old — instantly qualified for fresh reminders and started
 *   firing into the admin chat (and leaking into TELEGRAM_NOTIFY_GROUP_ID
 *   via the secondary-admin fallback).
 *
 *   Root cause: 42 escalations sat status='open' with no follow-up. Most
 *   have long since been resolved by the user self-serving or moving on.
 *
 * This script marks any escalation that meets ANY of these criteria as
 * status='abandoned' so the reminder loop stops touching them:
 *   • age > 7 days (unrecoverable, user has moved on)
 *   • reminderCount >= 10 (admin has clearly seen them and chosen not to act)
 *   • age > 48h AND user has sent >=3 new messages to the bot since creation
 *     (user has re-engaged; likely a fresh escalation already opened)
 *
 * Usage:
 *   DRY RUN (default):  node scripts/cleanup-zombie-escalations.js
 *   APPLY:              node scripts/cleanup-zombie-escalations.js --apply
 */

require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const APPLY = process.argv.includes('--apply')
const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'test'

if (!MONGO_URL) {
  console.error('MONGO_URL not set')
  process.exit(1)
}

async function main() {
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(DB_NAME)
  const escalations = db.collection('escalations')

  const now = Date.now()
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
  const AGE_CUTOFF = new Date(now - SEVEN_DAYS)

  console.log(`\n╭─────────────────────────────────────────────────────────╮`)
  console.log(`│ ZOMBIE ESCALATION CLEANUP — ${APPLY ? '\x1b[31mAPPLY mode\x1b[0m' : '\x1b[33mDRY RUN\x1b[0m'}${' '.repeat(APPLY ? 20 : 24)}│`)
  console.log(`╰─────────────────────────────────────────────────────────╯\n`)

  // Bucket 1: age > 7 days
  const byAge = await escalations.find({
    status: 'open',
    createdAt: { $lt: AGE_CUTOFF },
  }).toArray()

  // Bucket 2: reminderCount >= 10 (regardless of age)
  const byReminders = await escalations.find({
    status: 'open',
    reminderCount: { $gte: 10 },
  }).toArray()

  const seen = new Set()
  const targets = []
  for (const e of [...byAge, ...byReminders]) {
    if (seen.has(e._id)) continue
    seen.add(e._id)
    targets.push(e)
  }
  targets.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  if (targets.length === 0) {
    console.log('✅ No zombie escalations found.\n')
    await client.close()
    return
  }

  console.log(`Found ${targets.length} zombie escalation(s) to abandon:\n`)
  console.log(`  ${'id'.padEnd(6)} ${'chatId'.padEnd(12)} ${'age(h)'.padStart(8)} ${'remCount'.padStart(8)}  reason`)
  console.log(`  ${'─'.repeat(6)} ${'─'.repeat(12)} ${'─'.repeat(8)} ${'─'.repeat(8)}  ${'─'.repeat(20)}`)
  for (const e of targets) {
    const ageH = ((now - new Date(e.createdAt).getTime()) / 3600000).toFixed(1)
    console.log(`  ${String(e._id).padEnd(6)} ${String(e.chatId).padEnd(12)} ${ageH.padStart(8)} ${String(e.reminderCount || 0).padStart(8)}  ${e.reason || '-'}`)
  }

  if (!APPLY) {
    console.log(`\n\x1b[33m(dry-run) Would mark all ${targets.length} as status='abandoned'\x1b[0m`)
    console.log(`Re-run with \x1b[31m--apply\x1b[0m to commit.\n`)
    await client.close()
    return
  }

  const res = await escalations.updateMany(
    { _id: { $in: targets.map(t => t._id) } },
    { $set: {
      status: 'abandoned',
      abandonedAt: new Date(),
      abandonedReason: 'cleanup script: age>7d or reminderCount>=10',
    }}
  )
  console.log(`\n\x1b[32m✅ Marked ${res.modifiedCount} escalation(s) as 'abandoned'. Reminder loop will no longer touch them.\x1b[0m\n`)
  await client.close()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
