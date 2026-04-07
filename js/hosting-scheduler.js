/* global process */
/**
 * Hosting Auto-Renew Scheduler
 *
 * Runs hourly checks on all cPanel hosting accounts:
 * 1. 24h advance notification — warns user their plan is about to expire
 * 2. Auto-renew — charges wallet and extends plan (MONTHLY plans only, if enabled & funds available)
 * 3. Immediate suspension — cPanel account suspended the moment plan expires (website goes offline)
 * 4. Delete — terminates cPanel account after 48h grace period if not renewed
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

  const { smartWalletDeduct, usdToNgn, getBalance } = require('./utils')

  log('[HostingScheduler] Initialized — checking every hour')
  log('[HostingScheduler] Policy: weekly plans NEVER auto-renew, monthly plans auto-renew if enabled')

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
            renewText = `This is a <b>weekly plan</b> — it does not auto-renew.\nYour hosting will be <b>suspended immediately</b> on expiry and deleted after ${GRACE_PERIOD_HOURS}h if not manually renewed.`
          } else if (isAutoRenew) {
            renewText = `Your wallet will be auto-charged <b>$${price}</b> on expiry.`
          } else {
            renewText = `Auto-renew is <b>OFF</b>. Your hosting will be <b>suspended immediately</b> on expiry and deleted after ${GRACE_PERIOD_HOURS}h if not manually renewed.`
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
            // ━━━ LAYER 1: Fresh-read idempotency guard (prevents duplicate renewal across pods) ━━━
            const freshAccount = await cpanelAccounts.findOne({ _id: account._id })
            if (freshAccount && new Date(freshAccount.expiryDate) > now) {
              log(`[HostingScheduler] Skipped ${domain} — already renewed by another process (expires ${freshAccount.expiryDate})`)
              continue
            }

            const result = await smartWalletDeduct(walletOf, chatId, price)

            if (result.success) {
              // Auto-renew: wallet charged — extend expiry
              const newExpiry = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000)

              // ━━━ LAYER 2: Atomic claim — only extend if still expired ━━━
              const claimResult = await cpanelAccounts.findOneAndUpdate(
                {
                  _id: account._id,
                  expiryDate: { $lte: now }  // must still be expired
                },
                {
                  $set: {
                    expiryDate: newExpiry,
                    expiryNotified: false,
                    lastRenewedAt: now,
                    suspended: false,
                    renewalCount: (account.renewalCount || 0) + 1,
                  },
                },
                { returnDocument: 'after' }
              )

              if (!claimResult) {
                // Another pod already renewed — REFUND
                log(`[HostingScheduler] ⚠️ DUPLICATE RENEWAL PREVENTED: ${domain} already renewed — refunding ${result.currency === 'ngn' ? '₦' + result.chargedNgn : '$' + price} to chatId ${chatId}`)
                if (result.currency === 'ngn') {
                  await walletOf.updateOne({ _id: chatId }, { $inc: { ngnOut: -result.chargedNgn } })
                } else {
                  await walletOf.updateOne({ _id: chatId }, { $inc: { usdOut: -price } })
                }
                continue
              }

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

              const chargedStr = result.currency === 'ngn' ? `₦${result.chargedNgn.toLocaleString()} NGN` : `$${price}`
              const { usdBal: remUsd, ngnBal: remNgn } = await getBalance(walletOf, chatId)
              const balStr = result.currency === 'ngn' ? `₦${remNgn.toFixed(2)}` : `$${remUsd.toFixed(2)}`

              notify(chatId,
                `✅ <b>Plan Auto-Renewed!</b>\n\n`
                + `<b>${plan}</b> for <b>${domain}</b> has been renewed.\n`
                + `<b>Charged:</b> ${chargedStr}\n`
                + `<b>New Expiry:</b> ${newExpiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}\n`
                + `<b>Remaining Balance:</b> ${balStr}`
              )
              renewed++
              log(`[HostingScheduler] Auto-renewed ${domain} (${plan}) for ${chatId} — charged ${chargedStr}`)
              continue
            } else {
              // Insufficient funds in both wallets — notify (only if not already suspended)
              if (!account.suspended) {
                const { usdBal, ngnBal } = result
                const priceNgn = await usdToNgn(price)
                notify(chatId,
                  `⚠️ <b>Auto-Renew Failed — Insufficient Funds</b>\n\n`
                  + `<b>${plan}</b> for <b>${domain}</b> has expired.\n`
                  + `<b>Renewal Price:</b> $${price}${priceNgn ? ` (≈ ₦${priceNgn.toLocaleString()})` : ''}\n`
                  + `<b>Your Balance:</b> $${(usdBal || 0).toFixed(2)} / ₦${(ngnBal || 0).toFixed(2)}\n\n`
                  + `Please deposit funds to renew.\n`
                  + `Your hosting has been <b>suspended</b>. Deposit funds to reactivate.\n`
                + `Your account will be <b>deleted</b> in ${GRACE_PERIOD_HOURS}h if not renewed.`
                )
                log(`[HostingScheduler] Auto-renew failed (low funds) for ${domain} — USD: $${(usdBal || 0).toFixed(2)}, NGN: ₦${(ngnBal || 0).toFixed(2)}, needed: $${price}`)
              }
            }
          } else if (weekly && expiry <= now) {
            // Weekly plan expired — notify user (weekly plans never auto-renew)
            if (!account.expiryUserNotified) {
              notify(chatId,
                `⏰ <b>Weekly Plan Expired</b>\n\n`
                + `Your plan <b>${plan}</b> for <b>${domain}</b> has expired.\n\n`
                + `⚠️ Weekly plans do <b>not</b> auto-renew.\n`
                + `Your hosting has been <b>suspended</b> — website is now offline.\n`
                + `Please renew manually from <b>My Hosting Plans → ${domain}</b> to reactivate.\n\n`
                + `Your account will be <b>permanently deleted</b> in ${GRACE_PERIOD_HOURS}h if not renewed.`
              )
              await cpanelAccounts.updateOne(
                { _id: account._id },
                { $set: { expiryUserNotified: true } }
              )
            }
            log(`[HostingScheduler] Weekly plan expired: ${domain} (${plan}) for ${chatId} — no auto-renew (weekly plans never auto-renew)`)
          }

          // ── Immediate suspension on expiry — website goes offline right away ──
          if (!account.suspended) {
            await suspendAccount(account.cpUser, 'Plan expired — hosting suspended')

            await cpanelAccounts.updateOne(
              { _id: account._id },
              { $set: { suspended: true, suspendedAt: now } }
            )

            suspended++
            log(`[HostingScheduler] SUSPENDED ${domain} (${plan}) for ${chatId} — plan expired, immediate suspension`)
          }

          // ── Grace period check — delete after 48h if still not renewed ──
          if (expiry <= gracePeriodAgo && account.suspended && !account.deleted) {
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

      if (renewed || notified || suspended || deleted) {
        log(`[HostingScheduler] Check complete: ${renewed} renewed, ${notified} notified, ${suspended} suspended, ${deleted} deleted`)
      }
    } catch (err) {
      log(`[HostingScheduler] Error during check: ${err.message}`)
    }
  }

  /**
   * Startup enforcement — catch-up sweep for any accounts that expired while bot was offline.
   * Suspends all expired-but-unsuspended accounts, deletes all past-grace-period accounts.
   */
  async function startupEnforcement() {
    try {
      const now = new Date()
      const gracePeriodAgo = new Date(now.getTime() - GRACE_PERIOD_HOURS * 60 * 60 * 1000)

      const expiredNotDeleted = await cpanelAccounts.find({
        expiryDate: { $lte: now },
        deleted: { $ne: true },
      }).toArray()

      if (expiredNotDeleted.length === 0) {
        log(`[HostingScheduler] Startup enforcement: no expired accounts need action`)
        return
      }

      let enforcedSuspend = 0, enforcedDelete = 0

      for (const account of expiredNotDeleted) {
        const expiry = new Date(account.expiryDate)
        const domain = account.domain || account.cpUser
        const plan = account.plan
        const chatId = account.chatId
        const hoursExpired = ((now - expiry) / 3600000).toFixed(1)

        // ── Step 1: Suspend if not already suspended ──
        if (!account.suspended) {
          const result = await suspendAccount(account.cpUser, 'Plan expired — startup enforcement')

          await cpanelAccounts.updateOne(
            { _id: account._id },
            { $set: { suspended: true, suspendedAt: now } }
          )

          notify(chatId,
            `🚫 <b>Hosting Suspended</b>\n\n`
            + `<b>${domain}</b> has been suspended — your plan <b>${plan}</b> expired ${hoursExpired}h ago.\n\n`
            + `⚠️ Your site is now <b>offline</b>.\n`
            + `Renew from <b>My Hosting Plans → ${domain}</b> to reactivate.\n`
            + `Account will be <b>permanently deleted</b> ${GRACE_PERIOD_HOURS}h after expiry if not renewed.`
          )

          enforcedSuspend++
          log(`[HostingScheduler] STARTUP ENFORCE: Suspended ${domain} (${plan}) for ${chatId} — expired ${hoursExpired}h ago, was NOT suspended`)
        }

        // ── Step 2: Delete if past grace period and suspended ──
        if (expiry <= gracePeriodAgo && !account.deleted) {
          // Ensure it's suspended before deleting (should be by now)
          if (!account.suspended) {
            await suspendAccount(account.cpUser, 'Plan expired — pre-delete suspension')
            await cpanelAccounts.updateOne(
              { _id: account._id },
              { $set: { suspended: true, suspendedAt: now } }
            )
          }

          const terminated = await terminateAccount(account.cpUser)
          await cleanupAntiRed(domain)

          await cpanelAccounts.updateOne(
            { _id: account._id },
            { $set: { deleted: true, deletedAt: now } }
          )

          notify(chatId,
            `🗑️ <b>Hosting Deleted</b>\n\n`
            + `<b>${domain}</b> cPanel account has been permanently deleted.\n`
            + `Plan: ${plan} — expired ${hoursExpired}h ago (${GRACE_PERIOD_HOURS}h grace period exceeded).\n\n`
            + `All files, databases, and emails have been removed.\n`
            + `To start fresh, purchase a new hosting plan.`
          )

          enforcedDelete++
          log(`[HostingScheduler] STARTUP ENFORCE: Deleted ${domain} (${plan}) for ${chatId} — expired ${hoursExpired}h ago, past ${GRACE_PERIOD_HOURS}h grace`)
        }
      }

      log(`[HostingScheduler] Startup enforcement complete: ${enforcedSuspend} suspended, ${enforcedDelete} deleted (of ${expiredNotDeleted.length} expired accounts)`)
    } catch (err) {
      log(`[HostingScheduler] Startup enforcement error: ${err.message}`)
    }
  }

  // Run startup enforcement first (10s), then regular hourly checks (30s+)
  setTimeout(startupEnforcement, 10000)
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
