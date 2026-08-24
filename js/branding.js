/**
 * Central white-label branding config (single source of truth for the BOT/back end).
 * ---------------------------------------------------------------------------
 * Every value falls back to the current brand, so nothing changes until you
 * override it in .env. To rebrand the whole platform, set these env vars and
 * restart. The frontend has a matching build-time config in
 * frontend/src/branding.js (fed by REACT_APP_BRAND_* + the /api/branding
 * endpoint below). See /app/BRANDING.md for the full checklist.
 */
const E = process.env

const branding = {
  // Identity
  name: E.CHAT_BOT_BRAND || 'Nomadly',
  botName: E.CHAT_BOT_NAME || 'Nomadly Bot',
  smsAppName: E.SMS_APP_NAME || 'Nomadly BulkSMS App',
  phoneBrand: E.BRAND_PHONE_NAME || 'SpeechCue',
  botHandle: E.CHAT_BOT_USERNAME ? ('@' + String(E.CHAT_BOT_USERNAME).replace(/^@/, '')) : '@NomadlyBot',
  tagline: E.BRAND_TAGLINE || 'Domains, Hosting, Cloud Phone, VPS & more',
  website: E.BRAND_WEBSITE || '',
  logoUrl: E.BRAND_LOGO_URL || '',
  primaryColor: E.BRAND_PRIMARY_COLOR || '#34d399',

  // Support & social
  supportHandle: E.SUPPORT_HANDLE || '@onarrival1',
  // Secondary/support-group handle (previously hardcoded as @Hostbay_support)
  supportHandle2: E.SUPPORT_HANDLE_2 || '@Hostbay_support',
  supportLink: E.APP_SUPPORT_LINK || 'https://t.me/nomadlysupport',
  supportEmail: E.NOMADLY_SERVICE_EMAIL || 'support@nomadly.com',
  tgChannel: E.TG_CHANNEL || 'https://t.me/Hostbay',
  tgHandle: E.TG_HANDLE || '@Hostbay',

  // Infrastructure domains (rebrand these to your own hosts)
  panelDomain: E.PANEL_DOMAIN || 'panel.1.hostbay.io',
  sipDomain: E.SIP_DOMAIN || 'sip.speechcue.com',
  callPageUrl: E.CALL_PAGE_URL || '',
  nameservers: String(E.BRAND_NAMESERVERS || 'ns1.hostbay.io,ns2.hostbay.io')
    .split(',').map((s) => s.trim()).filter(Boolean),
}

// Frontend-safe subset (never expose secrets) served by GET /api/branding.
function publicBranding() {
  return {
    name: branding.name,
    botName: branding.botName,
    smsAppName: branding.smsAppName,
    tagline: branding.tagline,
    website: branding.website,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    supportHandle: branding.supportHandle,
    supportLink: branding.supportLink,
    supportEmail: branding.supportEmail,
    tgChannel: branding.tgChannel,
    tgHandle: branding.tgHandle,
    panelDomain: branding.panelDomain,
  }
}

module.exports = { branding, publicBranding }
