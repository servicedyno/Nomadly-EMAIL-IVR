// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cloud Phone Scheduler — Expiry, Renewal & Usage Tracking
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const schedule = require('node-schedule')
const axios = require('axios')
const { log } = require('console')
const { get, set, atomicIncrement } = require('./db.js')
const { getBalance } = require('./utils.js')
const { formatPhone, shortDate, plans, OVERAGE_RATE_SMS, OVERAGE_RATE_MIN } = require('./phone-config.js')
const telnyxApi = require('./telnyx-service.js')
const twilioService = require('./twilio-service.js')

const TELNYX_API_KEY = process.env.TELNYX_API_KEY
const TELNYX_BASE = 'https://api.telnyx.com/v2'

const telnyxHeaders = () => ({
  'Authorization': `Bearer ${TELNYX_API_KEY}`,
  'Content-Type': 'application/json'
})

let _bot = null
let _phoneNumbersOf = null
let _phoneTransactions = null
let _phoneLogs = null
let _walletOf = null
let _payments = null
let _nameOf = null
let _notifyGroup = null
let _maskName = null
let _nanoid = null

function initPhoneScheduler(deps) {
  _bot = deps.bot
  _phoneNumbersOf = deps.phoneNumbersOf
  _phoneTransactions = deps.phoneTransactions
  _phoneLogs = deps.phoneLogs
  _walletOf = deps.walletOf
  _payments = deps.payments
  _nameOf = deps.nameOf
  _notifyGroup = deps.notifyGroup
  _maskName = deps.maskName
  _nanoid = deps.nanoid

  // ── Hourly: Check expiry, send reminders, auto-renew ──
  schedule.scheduleJob('0 * * * *', async () => {
    log('[PhoneScheduler] Running hourly expiry check...')
    await runExpiryCheck()
  })

  // ── Daily at 3:00 AM UTC: Pull usage from Telnyx CDR ──
  schedule.scheduleJob('0 3 * * *', async () => {
    log('[PhoneScheduler] Running daily usage tracking...')
    await runUsageTracking()
  })

  // ── Daily at 0:05 AM UTC: Reset monthly counters on billing date ──
  schedule.scheduleJob('5 0 * * *', async () => {
    log('[PhoneScheduler] Running monthly counter reset check...')
    await runMonthlyReset()
  })

  log('[PhoneScheduler] Scheduled: expiry check (hourly), usage tracking (daily 3AM), monthly reset (daily 0:05AM)')
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPIRY CHECK — Reminders + Auto-Renew
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function runExpiryCheck() {
  try {
    const allUsers = await _phoneNumbersOf.find({}).toArray()
    const now = new Date()
    let remindersSent = 0
    let autoRenewed = 0
    let suspended = 0

    for (const user of allUsers) {
      const chatId = user._id
      const numbers = user.val?.numbers || []
      let modified = false

      for (let i = 0; i < numbers.length; i++) {
        const num = numbers[i]
        if (num.status !== 'active' && num.status !== 'suspended') continue

        const expiresAt = new Date(num.expiresAt)
        const msUntilExpiry = expiresAt.getTime() - now.getTime()
        const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24)

        // ── 3-day reminder ──
        if (daysUntilExpiry > 2.5 && daysUntilExpiry <= 3.0 && !num._reminder3Sent) {
          const { usdBal } = await getBalance(_walletOf, chatId)
          const plan = plans[num.plan] || { name: num.plan, price: num.planPrice }
          const msg = buildReminderMsg(num, 3, plan, usdBal)
          sendToUser(chatId, msg)
          numbers[i]._reminder3Sent = true
          modified = true
          remindersSent++
          log(`[PhoneScheduler] 3-day reminder sent: ${chatId} ${num.phoneNumber}`)
        }

        // ── 1-day reminder ──
        if (daysUntilExpiry > 0.5 && daysUntilExpiry <= 1.0 && !num._reminder1Sent) {
          const { usdBal } = await getBalance(_walletOf, chatId)
          const plan = plans[num.plan] || { name: num.plan, price: num.planPrice }
          const msg = buildFinalWarningMsg(num, plan, usdBal)
          sendToUser(chatId, msg)
          numbers[i]._reminder1Sent = true
          modified = true
          remindersSent++
          log(`[PhoneScheduler] 1-day warning sent: ${chatId} ${num.phoneNumber}`)
        }

        // ── Expired — attempt auto-renew or release immediately ──
        if (msUntilExpiry <= 0 && num.status === 'active') {
          if (num.autoRenew) {
            const renewed = await attemptAutoRenew(chatId, num, i, numbers)
            if (renewed) {
              autoRenewed++
              modified = true
            } else {
              // Auto-renew failed — release from provider immediately to stop billing
              numbers[i].status = 'released'
              numbers[i]._reminder3Sent = false
              numbers[i]._reminder1Sent = false
              numbers[i]._released = true
              modified = true
              suspended++
              await releaseFromProvider(num, user.val)
              sendToUser(chatId, buildAutoRenewFailedMsg(num))
              const name = await get(_nameOf, chatId)
              _notifyGroup?.(`❌ <b>Auto-Renew Failed + Released:</b> ${_maskName?.(name)} lost ${formatPhone(num.phoneNumber)} (insufficient balance)`)
              log(`[PhoneScheduler] Auto-renew failed, released from provider: ${chatId} ${num.phoneNumber}`)
            }
          } else {
            // No auto-renew — release from provider immediately
            numbers[i].status = 'released'
            numbers[i]._reminder3Sent = false
            numbers[i]._reminder1Sent = false
            numbers[i]._released = true
            modified = true
            suspended++
            await releaseFromProvider(num, user.val)
            sendToUser(chatId, buildSuspendedMsg(num))
            const name = await get(_nameOf, chatId)
            _notifyGroup?.(`📤 <b>Expired + Released:</b> ${_maskName?.(name)} lost ${formatPhone(num.phoneNumber)} (no auto-renew)`)
            log(`[PhoneScheduler] Expired, released from provider (no auto-renew): ${chatId} ${num.phoneNumber}`)
          }
        }
      }

      if (modified) {
        await set(_phoneNumbersOf, chatId, { numbers })
      }
    }

    log(`[PhoneScheduler] Expiry check complete: ${remindersSent} reminders, ${autoRenewed} auto-renewed, ${suspended} released`)
  } catch (e) {
    log(`[PhoneScheduler] Expiry check error: ${e.message}`)
  }
}

// Release number from provider (Telnyx or Twilio) to stop billing
async function releaseFromProvider(num, userData) {
  const phoneNumber = num.phoneNumber || num
  const provider = num.provider || 'telnyx'

  try {
    if (provider === 'twilio') {
      // Release from Twilio
      const twilioNumberSid = num.twilioNumberSid
      const subSid = num.twilioSubAccountSid || userData?.twilioSubAccountSid
      const subToken = userData?.twilioSubAccountToken
      if (twilioNumberSid) {
        const result = await twilioService.releaseNumber(twilioNumberSid, subSid, subToken)
        if (result?.success) return log(`[PhoneScheduler] Released Twilio number: ${phoneNumber} (sid=${twilioNumberSid})`)
        log(`[PhoneScheduler] Twilio release by SID failed for ${phoneNumber}, trying main account`)
      }
      // Fallback: try main account release
      try {
        const client = twilioService.getClient()
        await client.incomingPhoneNumbers(twilioNumberSid).remove()
        return log(`[PhoneScheduler] Released Twilio number via main account: ${phoneNumber}`)
      } catch (e2) {
        log(`[PhoneScheduler] Could not release Twilio number ${phoneNumber}: ${e2.message}`)
      }
    } else {
      // Release from Telnyx
      const telnyxOrderId = num.telnyxOrderId || num
      if (telnyxOrderId && typeof telnyxOrderId === 'string') {
        const ok = await telnyxApi.releaseNumber(telnyxOrderId)
        if (ok) return log(`[PhoneScheduler] Released Telnyx number by orderId: ${telnyxOrderId}`)
      }
      const ok2 = await telnyxApi.releaseByPhoneNumber(phoneNumber)
      if (ok2) return log(`[PhoneScheduler] Released Telnyx number by phone: ${phoneNumber}`)
      log(`[PhoneScheduler] Could not release Telnyx number ${phoneNumber}`)
    }
  } catch (e) {
    log(`[PhoneScheduler] Provider release error for ${phoneNumber}: ${e.message}`)
  }
}

async function attemptAutoRenew(chatId, num, index, numbers) {
  try {
    const price = num.planPrice
    const { usdBal } = await getBalance(_walletOf, chatId)

    if (usdBal < price) {
      log(`[PhoneScheduler] Auto-renew failed for ${num.phoneNumber}: balance $${usdBal} < $${price}`)
      return false
    }

    // Deduct from wallet
    const name = await get(_nameOf, chatId)
    const ref = _nanoid?.() || `ar_${Date.now()}`
    if (_payments) set(_payments, ref, `AutoRenew,CloudPhone,$${price},${chatId},${name},${new Date()}`)
    await atomicIncrement(_walletOf, chatId, 'usdOut', price)

    // Extend expiry by 1 month
    const newExpiry = new Date(num.expiresAt)
    newExpiry.setMonth(newExpiry.getMonth() + 1)

    numbers[index].expiresAt = newExpiry.toISOString()
    numbers[index].status = 'active'
    numbers[index].smsUsed = 0
    numbers[index].minutesUsed = 0
    numbers[index]._reminder3Sent = false
    numbers[index]._reminder1Sent = false

    // Log transaction
    await _phoneTransactions?.insertOne({
      chatId,
      phoneNumber: num.phoneNumber,
      action: 'auto_renew',
      plan: num.plan,
      amount: price,
      paymentMethod: 'wallet_usd',
      timestamp: new Date().toISOString(),
    })

    // Notify user
    const { usdBal: newBal } = await getBalance(_walletOf, chatId)
    sendToUser(chatId, buildAutoRenewSuccessMsg(num, newExpiry, usdBal, newBal))

    // Notify admin
    _notifyGroup?.(`✅ <b>Auto-Renewed:</b> ${_maskName?.(name)} → ${formatPhone(num.phoneNumber)} ($${price})`)

    log(`[PhoneScheduler] Auto-renewed: ${chatId} ${num.phoneNumber} until ${newExpiry.toISOString()}`)
    return true
  } catch (e) {
    log(`[PhoneScheduler] Auto-renew error: ${e.message}`)
    return false
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USAGE TRACKING — Pull from Telnyx CDR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function runUsageTracking() {
  try {
    if (!TELNYX_API_KEY) return log('[PhoneScheduler] No TELNYX_API_KEY, skipping usage tracking')

    const allUsers = await _phoneNumbersOf.find({}).toArray()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const startDate = yesterday.toISOString().split('T')[0] + 'T00:00:00Z'
    const endDate = yesterday.toISOString().split('T')[0] + 'T23:59:59Z'

    let totalCallsTracked = 0
    let totalSmsTracked = 0

    for (const user of allUsers) {
      const chatId = user._id
      const numbers = user.val?.numbers || []
      let modified = false

      for (let i = 0; i < numbers.length; i++) {
        const num = numbers[i]
        if (num.status !== 'active') continue
        const cleanNumber = num.phoneNumber.replace(/[^+\d]/g, '')

        // ── Pull Call Events ──
        try {
          const callRes = await axios.get(`${TELNYX_BASE}/call_events`, {
            headers: telnyxHeaders(),
            params: {
              'filter[call_leg_id][exists]': true,
              'filter[type]': 'call.hangup',
              'page[size]': 100,
            }
          })
          const callEvents = callRes.data?.data || []
          // Filter for this number and count duration
          const relevantCalls = callEvents.filter(e => {
            const payload = e.payload || {}
            const to = (payload.to || '').replace(/[^+\d]/g, '')
            const from = (payload.from || '').replace(/[^+\d]/g, '')
            return to === cleanNumber || from === cleanNumber
          })

          if (relevantCalls.length > 0) {
            let totalDurationSec = 0
            for (const call of relevantCalls) {
              const dur = call.payload?.duration_secs || call.payload?.duration || 0
              totalDurationSec += dur
            }
            const totalMinutes = Math.ceil(totalDurationSec / 60)
            numbers[i].minutesUsed = (numbers[i].minutesUsed || 0) + totalMinutes
            modified = true
            totalCallsTracked += relevantCalls.length
          }
        } catch (e) {
          // Call events API may not be available for all accounts
          log(`[PhoneScheduler] Call CDR fetch error for ${cleanNumber}: ${e.response?.status || e.message}`)
        }

        // ── Pull SMS usage from our own logs (more reliable than Telnyx CDR) ──
        try {
          const smsCount = await _phoneLogs?.countDocuments({
            phoneNumber: cleanNumber,
            type: 'sms',
            timestamp: { $gte: startDate, $lte: endDate }
          }) || 0

          if (smsCount > 0) {
            numbers[i].smsUsed = (numbers[i].smsUsed || 0) + smsCount
            modified = true
            totalSmsTracked += smsCount
          }
        } catch (e) {
          log(`[PhoneScheduler] SMS log count error for ${cleanNumber}: ${e.message}`)
        }

        // ── Check usage limits & send alerts ──
        const plan = plans[num.plan]
        if (plan) {
          const smsLimit = plan.sms
          const smsUsed = numbers[i].smsUsed || 0
          const smsPercent = Math.round((smsUsed / smsLimit) * 100)

          // 80% SMS usage alert
          if (smsPercent >= 80 && smsPercent < 100 && !numbers[i]._smsAlert80) {
            sendToUser(chatId, buildUsageAlertMsg(num, 'SMS', smsUsed, smsLimit, smsPercent))
            numbers[i]._smsAlert80 = true
            modified = true
          }
          // 100% SMS usage alert
          if (smsPercent >= 100 && !numbers[i]._smsAlert100) {
            sendToUser(chatId, buildUsageLimitMsg(num, 'SMS', smsUsed, smsLimit))
            numbers[i]._smsAlert100 = true
            modified = true
          }

          // Minutes alert (skip for unlimited)
          if (plan.minutes !== 'Unlimited') {
            const minLimit = plan.minutes
            const minUsed = numbers[i].minutesUsed || 0
            const minPercent = Math.round((minUsed / minLimit) * 100)

            if (minPercent >= 80 && minPercent < 100 && !numbers[i]._minAlert80) {
              sendToUser(chatId, buildUsageAlertMsg(num, 'Minutes', minUsed, minLimit, minPercent))
              numbers[i]._minAlert80 = true
              modified = true
            }
            if (minPercent >= 100 && !numbers[i]._minAlert100) {
              sendToUser(chatId, buildUsageLimitMsg(num, 'Minutes', minUsed, minLimit))
              numbers[i]._minAlert100 = true
              modified = true
            }
          }
        }
      }

      if (modified) {
        await set(_phoneNumbersOf, chatId, { numbers })
      }
    }

    log(`[PhoneScheduler] Usage tracking complete: ${totalCallsTracked} calls, ${totalSmsTracked} SMS tracked`)
  } catch (e) {
    log(`[PhoneScheduler] Usage tracking error: ${e.message}`)
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MONTHLY RESET — Reset counters on billing date
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function runMonthlyReset() {
  try {
    const allUsers = await _phoneNumbersOf.find({}).toArray()
    const today = new Date()
    const todayDay = today.getDate()
    let resetCount = 0

    for (const user of allUsers) {
      const chatId = user._id
      const numbers = user.val?.numbers || []
      let modified = false

      for (let i = 0; i < numbers.length; i++) {
        const num = numbers[i]
        if (num.status !== 'active') continue

        // Reset on purchase anniversary day
        const purchaseDay = new Date(num.purchaseDate).getDate()
        if (todayDay === purchaseDay) {
          numbers[i].smsUsed = 0
          numbers[i].minutesUsed = 0
          numbers[i]._smsAlert80 = false
          numbers[i]._smsAlert100 = false
          numbers[i]._minAlert80 = false
          numbers[i]._minAlert100 = false
          numbers[i]._smsLimitNotified = false
          numbers[i]._minLimitNotified = false
          modified = true
          resetCount++
          log(`[PhoneScheduler] Monthly reset: ${chatId} ${num.phoneNumber}`)
        }
      }

      if (modified) {
        await set(_phoneNumbersOf, chatId, { numbers })
      }
    }

    log(`[PhoneScheduler] Monthly reset complete: ${resetCount} numbers reset`)
  } catch (e) {
    log(`[PhoneScheduler] Monthly reset error: ${e.message}`)
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MESSAGE BUILDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildReminderMsg(num, days, plan, balance) {
  const price = num.planPrice
  const surcharge = num.numberSurcharge || 0
  const lowBal = balance < price
  let priceText = `$${price}/mo`
  if (surcharge > 0) priceText = `$${(price - surcharge).toFixed(2)} plan + $${surcharge.toFixed(2)} number = $${price}/mo`
  return `🔔 <b>Renewal Reminder</b>

Your Cloud Phone number ${formatPhone(num.phoneNumber)} (${plan.name} Plan) expires in <b>${days} days</b> (${shortDate(num.expiresAt)}).

Auto-Renew: ${num.autoRenew ? '✅ ON' : '❌ OFF'}
Wallet Balance: $${balance.toFixed(2)}
Renewal Cost: ${priceText}${lowBal ? `

⚠️ Insufficient balance! Deposit at least $${(price - balance).toFixed(2)} to renew.
If not renewed, your number will be <b>permanently deleted</b> and cannot be recovered.` : ''}${num.autoRenew && !lowBal ? `

✅ Your number will auto-renew from your wallet.` : ''}`
}

function buildFinalWarningMsg(num, plan, balance) {
  const price = num.planPrice
  return `🚨 <b>FINAL Renewal Warning</b>

Your number ${formatPhone(num.phoneNumber)} expires <b>TOMORROW</b> (${shortDate(num.expiresAt)}).

If not renewed, your number will be:
• <b>Permanently deleted</b> from our system
• Calls, SMS forwarding & SIP will stop
• The number <b>cannot be recovered</b>

⚠️ This is irreversible — renew now to keep your number.

Wallet: $${balance.toFixed(2)} | Need: $${price}`
}

function buildAutoRenewSuccessMsg(num, newExpiry, oldBal, newBal) {
  const plan = plans[num.plan] || { name: num.plan }
  const surcharge = num.numberSurcharge || 0
  let chargeText = `$${num.planPrice}`
  if (surcharge > 0) chargeText = `$${num.planPrice} ($${(num.planPrice - surcharge).toFixed(2)} plan + $${surcharge.toFixed(2)} number)`
  return `✅ <b>Auto-Renewal Successful</b>

📞 ${formatPhone(num.phoneNumber)}
📦 Plan: ${plan.name}
💰 Charged: ${chargeText} from wallet
📅 New expiry: ${shortDate(newExpiry.toISOString())}

Wallet: $${oldBal.toFixed(2)} → $${newBal.toFixed(2)}`
}

function buildAutoRenewFailedMsg(num) {
  const plan = plans[num.plan] || { name: num.plan }
  return `❌ <b>Auto-Renewal Failed — Number Deleted</b>

📞 ${formatPhone(num.phoneNumber)}
📦 Plan: ${plan.name} ($${num.planPrice}/mo)

⚠️ Insufficient wallet balance. Your number has been <b>permanently deleted</b> to prevent further billing.

This action is irreversible. To get a new number, visit 📞☁️ Cloud Phone → Buy Cloud Phone Plans.`
}

function buildSuspendedMsg(num) {
  return `⚠️ <b>Number Expired — Permanently Deleted</b>

📞 ${formatPhone(num.phoneNumber)} has expired and been <b>permanently deleted</b>.

Auto-Renew was OFF. To avoid losing numbers in the future, enable Auto-Renew on your next number.

Get a new number: 📞☁️ Cloud Phone → Buy Cloud Phone Plans.`
}

function buildUsageAlertMsg(num, type, used, limit, percent) {
  const rate = type === 'SMS' ? OVERAGE_RATE_SMS : OVERAGE_RATE_MIN
  return `⚠️ <b>Usage Alert</b>

📞 ${formatPhone(num.phoneNumber)}

You've used <b>${used}/${limit}</b> inbound ${type} this month (${percent}%).
Once exhausted, overage billing kicks in at <b>$${rate}/${type === 'SMS' ? 'SMS' : 'min'}</b> from your wallet. Service pauses if wallet is empty.`
}

function buildUsageLimitMsg(num, type, used, limit) {
  const rate = type === 'SMS' ? OVERAGE_RATE_SMS : OVERAGE_RATE_MIN
  return `💰 <b>Inbound ${type} — Overage Active</b>

📞 ${formatPhone(num.phoneNumber)}

You've used all <b>${limit}</b> inbound ${type} in your plan this month.
Overage billing is now active — <b>$${rate}/${type === 'SMS' ? 'SMS' : 'min'}</b> charged from your wallet per use.
Service pauses if wallet balance runs out. Top up or upgrade your plan.`
}

function sendToUser(chatId, text) {
  _bot?.sendMessage(chatId, text, { parse_mode: 'HTML' })?.catch(e => {
    log(`[PhoneScheduler] Send error to ${chatId}: ${e.message}`)
  })
}

module.exports = {
  initPhoneScheduler,
  runExpiryCheck,
  runUsageTracking,
  runMonthlyReset,
}
