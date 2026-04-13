/**
 * Retroactive IVR Forward Billing Script
 * 
 * Bills IVR forward calls that were unbilled due to the missing voice-dial-status
 * callback bug. Only bills calls that actually connected (determined by Railway
 * deployment cutoff + call duration evidence).
 * 
 * Usage: node js/retroactive-ivr-billing.js [--dry-run] [--chatId=XXXXX]
 */
require('dotenv').config()
const { MongoClient } = require('mongodb')
const { nanoid } = require('nanoid')

const OVERAGE_RATE_MIN = parseFloat(process.env.OVERAGE_RATE_MIN || '0.15')
const CALL_FORWARDING_RATE_MIN = parseFloat(process.env.CALL_FORWARDING_RATE_MIN || '0.50')
const isDryRun = process.argv.includes('--dry-run')
const chatIdArg = process.argv.find(a => a.startsWith('--chatId='))
const targetChatId = chatIdArg ? parseInt(chatIdArg.split('=')[1]) : null

function isUSCanada(phone) {
  return phone && phone.replace(/[^+\d]/g, '').startsWith('+1')
}

function getCallRate(dest) {
  return isUSCanada(dest) ? OVERAGE_RATE_MIN : CALL_FORWARDING_RATE_MIN
}

/**
 * Known unbilled IVR forward calls confirmed via Railway deployment logs.
 * Only calls after the fix deployment (cf8179d1, 2026-04-13T18:38:26) actually
 * connected the forward leg. Earlier calls (old code) dropped with "Thank you. Goodbye."
 */
const CONFIRMED_UNBILLED_CALLS = [
  {
    chatId: 8273560746,
    timestamp: '2026-04-13T18:45:10.601Z',
    callSid: 'CA3cb7610ce904cc3e06175b4be986a33f',
    from: '+19106516884',
    to: '+18339561373',
    forwardTo: '+18088000692',    // User had configured this at the time
    callDurationSec: 31,          // From Railway voice-status log
    forwardDurationSec: 25,       // Approx: 31s total - 6s IVR greeting
  },
  {
    chatId: 8273560746,
    timestamp: '2026-04-13T18:47:34.462Z',
    callSid: 'CAaa402a6b4f9be55f073d50a705bb5578',
    from: '+19106516884',
    to: '+18339561373',
    forwardTo: '+18088000969',    // User had reconfigured to this
    callDurationSec: 22,          // From Railway voice-status log
    forwardDurationSec: 16,       // Approx: 22s total - 6s IVR
  },
]

async function main() {
  const url = process.env.MONGO_URL || 'mongodb://localhost:27017'
  const dbName = process.env.DB_NAME
  const client = await MongoClient.connect(url)
  const db = client.db(dbName)

  const walletOf = db.collection('walletOf')
  const payments = db.collection('payments')
  const phoneLogs = db.collection('phoneLogs')

  console.log('=== Retroactive IVR Forward Billing ===')
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Target: ${targetChatId ? `chatId ${targetChatId}` : 'confirmed unbilled calls'}`)
  console.log()

  // Get wallet balance before
  const walletBefore = await walletOf.findOne({ _id: 8273560746 })
  const balBefore = (walletBefore?.usdIn || 0) - (walletBefore?.usdOut || 0)
  console.log(`Wallet balance BEFORE: $${balBefore.toFixed(2)} (usdIn=$${walletBefore?.usdIn || 0}, usdOut=$${(walletBefore?.usdOut || 0).toFixed(4)})`)
  console.log()

  let totalCharged = 0

  for (const call of CONFIRMED_UNBILLED_CALLS) {
    if (targetChatId && call.chatId !== targetChatId) continue

    // Check if already retroactively billed (idempotent)
    const existingLog = await phoneLogs.findOne({
      chatId: call.chatId,
      timestamp: call.timestamp,
      retroBilled: true
    })
    if (existingLog) {
      console.log(`✅ ALREADY BILLED: ${call.timestamp} | ${call.to} → ${call.forwardTo}`)
      continue
    }

    const rate = getCallRate(call.forwardTo)
    const minutesBilled = Math.ceil(call.forwardDurationSec / 60)
    const charge = +(minutesBilled * rate).toFixed(4)

    console.log(`── Call: ${call.callSid} ──`)
    console.log(`  Time: ${call.timestamp}`)
    console.log(`  Route: ${call.from} → ${call.to} → ${call.forwardTo}`)
    console.log(`  Duration: ${call.callDurationSec}s total, ${call.forwardDurationSec}s forward leg`)
    console.log(`  Billing: ${minutesBilled} min × $${rate}/min (${isUSCanada(call.forwardTo) ? 'US/CA' : 'International'}) = $${charge.toFixed(2)}`)

    if (isDryRun) {
      console.log(`  [DRY RUN] Would charge $${charge.toFixed(2)} and create payment record`)
      console.log()
      totalCharged += charge
      continue
    }

    // Atomic wallet deduction
    const deductResult = await walletOf.findOneAndUpdate(
      {
        _id: call.chatId,
        $expr: { $gte: [{ $subtract: [{ $ifNull: ['$usdIn', 0] }, { $ifNull: ['$usdOut', 0] }] }, charge] }
      },
      { $inc: { usdOut: charge } },
      { returnDocument: 'after' }
    )

    if (deductResult) {
      const newBal = (deductResult.usdIn || 0) - (deductResult.usdOut || 0)
      console.log(`  ✅ Wallet charged: $${charge.toFixed(2)} | New balance: $${newBal.toFixed(2)}`)
    } else {
      // Insufficient balance — force charge as debt
      console.log(`  ⚠️ Insufficient balance — force-charging as debt...`)
      await walletOf.updateOne(
        { _id: call.chatId },
        { $inc: { usdOut: charge } },
        { upsert: true }
      )
      const wallet = await walletOf.findOne({ _id: call.chatId })
      const newBal = (wallet?.usdIn || 0) - (wallet?.usdOut || 0)
      console.log(`  ✅ Force-charged: $${charge.toFixed(2)} | New balance: $${newBal.toFixed(2)}`)
    }

    // Create payment record
    const ref = nanoid()
    const paymentVal = `Outbound,Twilio_Forwarding,$${charge.toFixed(2)},${call.chatId},${call.to},${call.forwardTo},${call.timestamp},loyaltyDiscount=0,retroBilled=true,callSid=${call.callSid}`
    await payments.updateOne(
      { _id: ref },
      { $set: { val: paymentVal } },
      { upsert: true }
    )
    console.log(`  ✅ Payment record: ${ref} → ${paymentVal}`)

    // Mark phone log as retroactively billed
    await phoneLogs.updateOne(
      { chatId: call.chatId, timestamp: call.timestamp, type: 'ivr_inbound', action: 'forward' },
      { $set: { retroBilled: true, retroBilledAt: new Date().toISOString(), retroCharge: charge, callSid: call.callSid, forwardTo: call.forwardTo } }
    )
    console.log(`  ✅ Phone log marked as retroBilled`)

    // Also mark earlier failed-forward calls as non-billable (so they won't be picked up in future scans)
    const updateResult = await phoneLogs.updateMany(
      {
        chatId: call.chatId,
        type: 'ivr_inbound',
        action: 'forward',
        to: call.to,
        timestamp: { $lt: '2026-04-13T18:38:00Z' }, // Before fix deployment
        retroBilled: { $ne: true }
      },
      { $set: { retroBilled: true, retroBilledAt: new Date().toISOString(), retroCharge: 0, note: 'Forward never connected (pre-fix bug)' } }
    )
    if (updateResult.modifiedCount > 0) {
      console.log(`  ✅ Marked ${updateResult.modifiedCount} pre-fix failed forward calls as non-billable`)
    }

    totalCharged += charge
    console.log()
  }

  // Final balance
  const walletAfter = await walletOf.findOne({ _id: 8273560746 })
  const balAfter = (walletAfter?.usdIn || 0) - (walletAfter?.usdOut || 0)

  console.log('=== Billing Complete ===')
  console.log(`Total charged: $${totalCharged.toFixed(2)}`)
  console.log(`Wallet balance BEFORE: $${balBefore.toFixed(2)}`)
  console.log(`Wallet balance AFTER:  $${balAfter.toFixed(2)}`)
  console.log(`Difference: -$${(balBefore - balAfter).toFixed(2)}`)

  await client.close()
}

main().catch(e => {
  console.error('Fatal error:', e.message)
  process.exit(1)
})
