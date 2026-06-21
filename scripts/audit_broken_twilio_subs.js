/**
 * Identify owners of the 12 broken Twilio sub-accounts.
 * Report subscription / paid-customer status before any rotation action.
 * READ-ONLY — does not modify any data.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const BROKEN_SUBS = [
  'AC[REDACTED]',
  'AC[REDACTED]',
  'AC[REDACTED]',
  'AC[REDACTED]',
  'AC[REDACTED]',
  'AC[REDACTED]',
  'AC[REDACTED]',
  'AC[REDACTED]',
  'AC[REDACTED]',
  'AC[REDACTED]',
]
// Plus the 2 that were truncated in our earlier scan – wider sweep
// We'll query for ANY sub-account that's currently failing 401 in logs

;(async () => {
  const c = new MongoClient(process.env.MONGO_URL, { serverSelectionTimeoutMS: 10000 })
  await c.connect()
  const db = c.db()
  console.log('DB:', db.databaseName)

  // Step 1: find all twilio sub-accounts currently registered to users
  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  STEP 1 — All Twilio sub-accounts in active use')
  console.log('══════════════════════════════════════════════════════════')

  const phoneDocs = await db.collection('phoneNumbersOf').find({}).toArray()
  console.log(`Total phoneNumbersOf docs: ${phoneDocs.length}`)

  const subToUsers = new Map() // sid -> [{chatId, phoneNumber, status, plan}]
  for (const doc of phoneDocs) {
    const nums = doc?.val?.numbers || []
    for (const n of nums) {
      if (n.provider === 'twilio' && n.twilioSubAccountSid) {
        if (!subToUsers.has(n.twilioSubAccountSid)) subToUsers.set(n.twilioSubAccountSid, [])
        subToUsers.get(n.twilioSubAccountSid).push({
          chatId: doc._id,
          phoneNumber: n.phoneNumber,
          status: n.status || 'unknown',
          plan: n.plan || '',
          purchasedAt: n.purchasedAt || n.acquiredAt || '',
          expiresAt: n.expiresAt || n.renewalDate || '',
        })
      }
    }
  }
  console.log(`Distinct sub-accounts registered to users: ${subToUsers.size}`)

  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  STEP 2 — Cross-reference with the 12 broken sub-accounts')
  console.log('══════════════════════════════════════════════════════════')

  const findings = []
  for (const sid of BROKEN_SUBS) {
    const owners = subToUsers.get(sid) || []
    findings.push({ sid, owners })
    if (owners.length === 0) {
      console.log(`\n${sid}`)
      console.log(`  ⚠ NOT registered to any user in phoneNumbersOf`)
      // It might be cleaned up but still configured. Search transactions.
      const tx = await db.collection('transactions').find({
        $or: [
          { 'metadata.subAccountSid': sid },
          { 'meta.twilioSubAccountSid': sid },
          { 'meta.subAccountSid': sid },
          { 'twilioSubAccountSid': sid },
        ],
      }).limit(5).toArray()
      if (tx.length) {
        const total = tx.reduce((s, t) => s + (Number(t.amount) || 0), 0)
        console.log(`  ↳ ${tx.length} historical transaction(s), total ≈ $${total.toFixed(2)}`)
        for (const t of tx.slice(0, 3)) {
          console.log(`      ${t.createdAt || t.ts || ''}  ${t.type || ''}  chat=${t.chatId || t.userId || '?'}  $${t.amount || '?'}  ${(t.description || '').slice(0, 60)}`)
        }
      } else {
        console.log(`  ↳ no transactions found for this sub-account`)
      }
      continue
    }
    console.log(`\n${sid}`)
    console.log(`  → ${owners.length} number(s) registered:`)
    for (const o of owners) {
      console.log(`     chat=${o.chatId}  ${o.phoneNumber}  status=${o.status}  plan=${o.plan}`)
    }
  }

  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  STEP 3 — Paid-subscription status of each owner')
  console.log('══════════════════════════════════════════════════════════')
  const allOwners = new Set(findings.flatMap(f => f.owners.map(o => String(o.chatId))))
  console.log(`Distinct owner chatIds: ${allOwners.size}`)

  // Look for paid sub indicators: walletBalance, plan, subscription, transactions
  for (const chatId of allOwners) {
    console.log(`\n──── chat=${chatId} ────`)
    // wallet balance
    const wb = await db.collection('walletBalanceOf').findOne({ _id: Number(chatId) }) ||
               await db.collection('walletBalanceOf').findOne({ _id: chatId })
    if (wb) {
      console.log(`  walletBalance: $${(wb.val?.balance ?? wb.balance ?? '?')}`)
    }
    // username / profile
    const profile = await db.collection('chatsOf').findOne({ _id: Number(chatId) }) ||
                    await db.collection('chatsOf').findOne({ _id: chatId })
    if (profile?.val) {
      console.log(`  username: @${profile.val.username || '—'}, name: ${profile.val.firstName || ''} ${profile.val.lastName || ''}`)
      console.log(`  joined: ${profile.val.joinedAt || profile.val.createdAt || '?'}`)
    }
    // sum of deposits
    const deposits = await db.collection('transactions').find({
      $or: [{ chatId: Number(chatId) }, { chatId: chatId }, { userId: Number(chatId) }, { userId: chatId }],
      type: { $in: ['deposit', 'credit', 'topup'] },
    }).toArray()
    if (deposits.length) {
      const total = deposits.reduce((s, t) => s + (Number(t.amount) || 0), 0)
      console.log(`  lifetime deposits: ${deposits.length} (~$${total.toFixed(2)})`)
    } else {
      console.log(`  lifetime deposits: 0`)
    }
    // active phone subscription?
    const subs = await db.collection('phoneSubscriptions').find({ chatId: Number(chatId) }).toArray().catch(() => [])
    if (subs.length) {
      const active = subs.filter(s => !s.cancelled && (!s.expiresAt || new Date(s.expiresAt) > new Date()))
      console.log(`  phoneSubscriptions: ${subs.length} total, ${active.length} ACTIVE`)
      for (const s of active.slice(0, 3)) {
        console.log(`     plan=${s.plan} expires=${s.expiresAt} amount=$${s.amount || '?'}`)
      }
    }
    // VPS / domain holdings
    const vpsOf = await db.collection('vpsOf').findOne({ _id: Number(chatId) }) || await db.collection('vpsOf').findOne({ _id: chatId })
    const vpsCount = vpsOf?.val?.length || 0
    const domainsOf = await db.collection('domainsOf').findOne({ _id: Number(chatId) }) || await db.collection('domainsOf').findOne({ _id: chatId })
    const domainCount = domainsOf?.val?.length || 0
    console.log(`  holdings: ${vpsCount} VPS, ${domainCount} domain(s)`)
  }

  // Final summary
  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  SUMMARY')
  console.log('══════════════════════════════════════════════════════════')
  const result = {
    broken_subs: BROKEN_SUBS.length,
    registered: findings.filter(f => f.owners.length > 0).length,
    orphan: findings.filter(f => f.owners.length === 0).length,
    distinct_owners: allOwners.size,
    findings,
  }
  console.log(`Broken sub-accounts checked: ${result.broken_subs}`)
  console.log(`Registered to a user        : ${result.registered}`)
  console.log(`Orphaned (no DB owner)      : ${result.orphan}`)
  console.log(`Distinct owners affected    : ${result.distinct_owners}`)

  require('fs').writeFileSync('/app/logs_prod/_twilio_owner_audit.json', JSON.stringify(result, null, 2))
  console.log('\nSaved → /app/logs_prod/_twilio_owner_audit.json')

  await c.close()
})()
