/* global process */
/**
 * Hosting Auto-Renew Scheduler
 *
 * Runs hourly checks on all cPanel hosting accounts:
 * 1. 24h advance notification — warns user their plan is about to expire
 * 2. Auto-renew — charges wallet and extends plan (MONTHLY plans only, if enabled & funds available)
 * 3. Grace period — 48h grace after expiry before cPanel is DELETED
 * 4. Delete — terminates cPanel account after 48h grace period
 *
 * IMPORTANT: Weekly plans NEVER auto-renew. Only monthly plans auto-renew.
 *
 * Depends on: cpanelAccounts collection, users collection, WHM service, Telegram bot
 */

require('dotenv').config()
const { log } = require('console')

const PREMIUM_ANTIRED_WEEKLY_PRICE = parseFloat(process.env.PREMIUM_ANTIRED_WEEKLY_PRICE) || 50
const PREMIUM_ANTIRED_CPANEL_PRICE = parseFloat(process.env.PREMIUM_ANTIRED_CPANEL_PRICE) || 75
const GOLDEN_ANTIRED_CPANEL_PRICE = parseFloat(process.env.GOLDEN_ANTIRED_CPANEL_PRICE) || 100

const GRACE_PERIOD_HOURS = 48
const ADVANCE_NOTIFY_HOURS = 24
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Check if a plan is a weekly plan (should NOT auto-renew)
 */
function isWeeklyPlan(planName) {
  const name = (planName || '').toLowerCase()
  return name.includes('week') || name.includes('1-week')
}

/**
 * Get renewal price for a plan
 */
function getPlanPrice(planName) {
  const name = (planName || '').toLowerCase()
  if (name.includes('golden')) return GOLDEN_ANTIRED_CPANEL_PRICE
  if (name.includes('premium') && name.includes('hostpanel')) return PREMIUM_ANTIRED_CPANEL_PRICE
  if (name.includes('premium') && name.includes('week')) return PREMIUM_ANTIRED_WEEKLY_PRICE
  if (name.includes('business')) return GOLDEN_ANTIRED_CPANEL_PRICE
  if (name.includes('pro')) return PREMIUM_ANTIRED_CPANEL_PRICE
  if (name.includes('starter')) return PREMIUM_ANTIRED_WEEKLY_PRICE
  return 0
}

/**
 * Get renewal duration in days for a plan
 */
function getPlanDuration(planName) {
  const name = (planName || '').toLowerCase()
  if (name.includes('week') || name.includes('1-week')) return 7
  return 30
}

/**
 * Initialize the scheduler
 * @param {object} deps - { bot, db, whmService }
 */
function initScheduler(deps) {
  const { bot, db, whmService } = deps
  const cpanelAccounts = db.collection('cpanelAccounts')
  const walletOf = db.collection('walletOf')

  let antiRedService = null
  try {
    antiRedService = require('./anti-red-service')
  } catch (_) {
    log('[HostingScheduler] Anti-Red service not available')
  }

  log('[HostingScheduler] Initialized — checking every hour')
  log('[HostingScheduler] Policy: weekly plans NEVER auto-renew, monthly plans auto-renew if enabled')

  /**
   * Get user's wallet balance (usdIn - usdOut)
   */
  async function getWalletBalance(chatId) {
    const wallet = await walletOf.findOne({ chatId: String(chatId) })
    if (!wallet) return 0
    return parseFloat(wallet.usdIn || 0) - parseFloat(wallet.usdOut || 0)
  }

  /**
   * Deduct from user's wallet (increment usdOut)
   */
  async function deductWallet(chatId, amount) {
    await walletOf.updateOne(
      { chatId: String(chatId) },
      { $inc: { usdOut: amount } }
    )
  }

  /**
   * Send Telegram notification
   */
  function notify(chatId, message) {
    if (!bot) return
    bot.sendMessage(chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true }).catch(err => {
      log(`[HostingScheduler] Notify error for ${chatId}: ${err.message}`)
    })
  }

  /**
   * Suspend a cPanel account via WHM
   */
  async function suspendAccount(cpUsername, reason) {
    if (!whmService) return { success: false }
    try {
      return await whmService.suspendAccount(cpUsername, reason)
    } catch (err) {
      log(`[HostingScheduler] Suspend error for ${cpUsername}: ${err.message}`)
      return { success: false, error: err.message }
    }
  }

  /**
   * Unsuspend a cPanel account via WHM
   */
  async function unsuspendAccount(cpUsername) {
    if (!whmService) return { success: false }
    try {
      return await whmService.unsuspendAccount(cpUsername)
    } catch (err) {
      log(`[HostingScheduler] Unsuspend error for ${cpUsername}: ${err.message}`)
      return { success: false, error: err.message }
    }
  }

  /**
   * Terminate/delete a cPanel account via WHM
   */
  async function terminateAccount(cpUsername) {
    if (!whmService) return false
    try {
      const result = await whmService.terminateAccount(cpUsername)
      log(`[HostingScheduler] Terminated cPanel account: ${cpUsername} — result: ${result}`)
      return result
    } catch (err) {
      log(`[HostingScheduler] Terminate error for ${cpUsername}: ${err.message}`)
      return false
    }
  }

  /**
   * Remove anti-red worker routes for a domain (cleanup on deletion)
   */
  async function cleanupAntiRed(domain) {
    if (!antiRedService) return
    try {
      if (typeof antiRedService.removeWorkerRoute === 'function') {
        await antiRedService.removeWorkerRoute(domain)
        log(`[HostingScheduler] Anti-Red cleanup done for ${domain}`)
      }
    } catch (_) {
      // Non-blocking — cleanup is best-effort
    }
  }

  /**
   * Main check — run hourly
   */
  async function runCheck() {
    try {
      const now = new Date()
      const in24h = new Date(now.getTime() + ADVANCE_NOTIFY_HOURS * 60 * 60 * 1000)
      const gracePeriodAgo = new Date(now.getTime() - GRACE_PERIOD_HOURS * 60 * 60 * 1000)

      const allAccounts = await cpanelAccounts.find({ expiryDate: { $exists: true } }).toArray()

      let renewed = 0, notified = 0, suspended = 0, deleted = 0

      for (const account of allAccounts) {
        const expiry = new Date(account.expiryDate)
        const chatId = account.chatId
        const domain = account.domain
        const plan = account.plan
        const weekly = isWeeklyPlan(plan)

        // Weekly plans NEVER auto-renew — only monthly plans can auto-renew
        const isAutoRenew = !weekly && account.autoRenew !== false

        // ── Case 1: Expiring within 24h — send advance notification ──
        if (expiry > now && expiry <= in24h && !account.expiryNotified) {
          const price = getPlanPrice(plan)

          let renewText
          if (weekly) {
            renewText = `This is a <b>weekly plan</b> — it does not auto-renew.\nYour account will be deleted after a ${GRACE_PERIOD_HOURS}h grace period if not manually renewed.`
          } else if (isAutoRenew) {
            renewText = `Your wallet will be auto-charged <b>$${price}</b> on expiry.`
          } else {
            renewText = `Auto-renew is <b>OFF</b>. Your account will be deleted after ${GRACE_PERIOD_HOURS}h grace period if not manually renewed.`
          }

          notify(chatId,
            `⏰ <b>Hosting Expiry Notice</b>\n\n`
            + `Your plan <b>${plan}</b> for <b>${domain}</b> expires in less than 24 hours.\n\n`
            + `${renewText}\n\n`
            + `Wallet Balance: Check via /wallet\n`
            + (weekly ? '' : `To toggle auto-renew: Go to My Hosting Plans → ${domain}`)
          )

          await cpanelAccounts.updateOne(
            { _id: account._id },
            { $set: { expiryNotified: true } }
          )
          notified++
          log(`[HostingScheduler] Notified ${chatId} — ${domain} (${plan}) expiring soon${weekly ? ' [WEEKLY, no auto-renew]' : ''}`)
        }

        // ── Case 2: Expired — attempt auto-renew (monthly only) or grace period ──
        if (expiry <= now && !account.deleted) {
          const price = getPlanPrice(plan)
          const duration = getPlanDuration(plan)

          // Only attempt auto-renew for monthly plans with auto-renew enabled
          if (isAutoRenew && price > 0) {
            const balance = await getWalletBalance(chatId)

            if (balance >= price) {
              // Auto-renew: charge wallet & extend
              await deductWallet(chatId, price)
              const newExpiry = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000)

              await cpanelAccounts.updateOne(
                { _id: account._id },
                {
                  $set: {
                    expiryDate: newExpiry,
                    expiryNotified: false,
                    lastRenewedAt: now,
                    suspended: false,
                    renewalCount: (account.renewalCount || 0) + 1,
                  },
                }
              )

              // Re-deploy anti-red protection on renewal
              if (antiRedService) {
                try {
                  await antiRedService.deployFullProtection(account.cpUser, domain, plan)
                } catch (_) {}
              }

              // Unsuspend if was previously suspended
              if (account.suspended) {
                await unsuspendAccount(account.cpUser)
              }

              notify(chatId,
                `✅ <b>Plan Auto-Renewed!</b>\n\n`
                + `<b>${plan}</b> for <b>${domain}</b> has been renewed.\n`
                + `<b>Charged:</b> $${price}\n`
                + `<b>New Expiry:</b> ${newExpiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}\n`
                + `<b>Remaining Balance:</b> $${(balance - price).toFixed(2)}`
              )
              renewed++
              log(`[HostingScheduler] Auto-renewed ${domain} (${plan}) for ${chatId} — charged $${price}`)
              continue
            } else {
              // Insufficient funds — notify (only if not already suspended)
              if (!account.suspended) {
                notify(chatId,
                  `⚠️ <b>Auto-Renew Failed — Insufficient Funds</b>\n\n`
                  + `<b>${plan}</b> for <b>${domain}</b> has expired.\n`
                  + `<b>Renewal Price:</b> $${price}\n`
                  + `<b>Your Balance:</b> $${balance.toFixed(2)}\n\n`
                  + `Please deposit at least <b>$${(price - balance).toFixed(2)}</b> to renew.\n`
                  + `Your account will be <b>deleted</b> in ${GRACE_PERIOD_HOURS}h if not renewed.`
                )
                log(`[HostingScheduler] Auto-renew failed (low funds) for ${domain} — balance: $${balance.toFixed(2)}, needed: $${price}`)
              }
            }
          } else if (weekly && expiry <= now && !account.suspended) {
            // Weekly plan expired — log that we're skipping auto-renew
            log(`[HostingScheduler] Weekly plan expired: ${domain} (${plan}) for ${chatId} — no auto-renew (weekly plans never auto-renew)`)
          }

          // ── Grace period check — suspend first, then delete ──
          if (expiry <= gracePeriodAgo) {
            if (!account.suspended) {
              // First: suspend the account
              await suspendAccount(account.cpUser, 'Plan expired — grace period reached')

              await cpanelAccounts.updateOne(
                { _id: account._id },
                { $set: { suspended: true, suspendedAt: now } }
              )

              notify(chatId,
                `🚫 <b>Hosting Suspended</b>\n\n`
                + `<b>${domain}</b> has been suspended due to expired plan (${plan}).\n\n`
                + `⚠️ Your cPanel account will be <b>permanently deleted</b> shortly.\n`
                + `To reactivate: deposit funds and renew your plan immediately, or contact support.`
              )
              suspended++
              log(`[HostingScheduler] Suspended ${domain} (${plan}) for ${chatId} — grace period expired`)
            } else if (account.suspended && !account.deleted) {
              // Already suspended — now terminate/delete the cPanel account
              const terminated = await terminateAccount(account.cpUser)

              // Cleanup anti-red routes
              await cleanupAntiRed(domain)

              await cpanelAccounts.updateOne(
                { _id: account._id },
                { $set: { deleted: true, deletedAt: now } }
              )

              notify(chatId,
                `🗑️ <b>Hosting Deleted</b>\n\n`
                + `<b>${domain}</b> cPanel account has been permanently deleted.\n`
                + `Plan: ${plan}\n\n`
                + `All files, databases, and emails have been removed.\n`
                + `To start fresh, purchase a new hosting plan.`
              )
              deleted++
              log(`[HostingScheduler] DELETED cPanel for ${domain} (${plan}), user ${chatId} — WHM terminate: ${terminated}`)
            }
          }
        }
      }

      if (renewed || notified || suspended || deleted) {
        log(`[HostingScheduler] Check complete: ${renewed} renewed, ${notified} notified, ${suspended} suspended, ${deleted} deleted`)
      }
    } catch (err) {
      log(`[HostingScheduler] Error during check: ${err.message}`)
    }
  }

  // Run immediately on startup, then every hour
  setTimeout(runCheck, 30000) // 30s after startup
  const interval = setInterval(runCheck, CHECK_INTERVAL_MS)

  log(`[HostingScheduler] Scheduled: expiry check (every ${CHECK_INTERVAL_MS / 60000} min)`)

  return {
    runCheck,
    stop: () => clearInterval(interval),
    getPlanPrice,
    getPlanDuration,
    isWeeklyPlan,
  }
}

module.exports = { initScheduler, getPlanPrice, getPlanDuration, isWeeklyPlan }
