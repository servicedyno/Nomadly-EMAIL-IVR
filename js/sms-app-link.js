/**
 * Resilient SMS-app download link resolver.
 *
 * BUG (Nomadly 48h scan 2026-08-07, user 8571206732 FreemanHuey0):
 *   "the app download link ... just tells you to buy a Domain, you don't even
 *    land in the download page for the app."
 *
 * ROOT CAUSE: SMS_APP_LINK was set to the cPanel STOREFRONT host
 *   (panel.1.hostbay.io/sms-app/download). That host serves the "buy a domain"
 *   storefront, NOT the APK. The bot's own Express server serves the real APK
 *   at `${SELF_URL}/sms-app/download` (same URL the in-app update button uses).
 *
 * FIX: prefer the configured SMS_APP_LINK, BUT if it's empty, not a valid URL,
 *   or points at the panel/storefront host, fall back to the bot's own
 *   guaranteed-working download route. This corrects production behaviour
 *   without requiring an env change/redeploy.
 */

/* global process */

function _hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

function resolveSmsAppLink(opts = {}) {
  const envLink = String(
    opts.envLink !== undefined ? opts.envLink : (process.env.SMS_APP_LINK || '')
  ).trim()

  const self = String(
    opts.self !== undefined ? opts.self : (process.env.SELF_URL_PROD || process.env.SELF_URL || '')
  ).replace(/\/+$/, '')

  const botDownload = self ? `${self}/sms-app/download` : ''

  const panelHost = String(
    opts.panelDomain !== undefined ? opts.panelDomain : (process.env.PANEL_DOMAIN || '')
  )
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()

  // No configured link → use the bot's own route.
  if (!envLink) return botDownload || envLink

  const host = _hostOf(envLink)

  // Not a valid absolute URL → don't trust it, use the bot's own route.
  if (!host) return botDownload || envLink

  // Points at the cPanel storefront/panel host → would show "buy a domain".
  const isPanel = (panelHost && host === panelHost) || /^panel\./i.test(host)
  if (isPanel) return botDownload || envLink

  // Otherwise the configured link looks legit — respect it.
  return envLink
}

module.exports = { resolveSmsAppLink }
