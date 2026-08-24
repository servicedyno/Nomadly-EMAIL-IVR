/**
 * White-label brand config for the FRONTEND (single source of truth for the UI).
 * ---------------------------------------------------------------------------
 * Values are read at build time from REACT_APP_BRAND_* env vars (frontend/.env)
 * and fall back to the current brand, so nothing changes until you override
 * them. To rebrand the web UI, set these vars and rebuild/restart the frontend.
 * The bot/back end has a matching config in js/branding.js. See /app/BRANDING.md.
 */
const E = process.env;

export const BRAND = {
  // Primary brand (bot + analytics)
  name: E.REACT_APP_BRAND_NAME || 'Nomadly',
  botName: E.REACT_APP_BRAND_BOT_NAME || 'NomadlyBot',
  botUsername: (E.REACT_APP_BRAND_BOT_USERNAME || 'Nomadlybot').replace(/^@/, ''),
  tagline: E.REACT_APP_BRAND_TAGLINE || 'Bot Analytics',
  poweredBy: E.REACT_APP_BRAND_POWERED_BY || 'Speechcue',
  supportHandle: E.REACT_APP_BRAND_SUPPORT || '@onarrival1',
  primaryColor: E.REACT_APP_BRAND_COLOR || '#34d399',

  // Sub-brands (set all three to the same value to fully unify the branding)
  panelName: E.REACT_APP_BRAND_PANEL_NAME || 'HostBay',
  phoneName: E.REACT_APP_BRAND_PHONE_NAME || 'Speechcue',

  // Domains
  panelDomain: (E.REACT_APP_PANEL_DOMAIN || 'panel.hostbay.io').toLowerCase(),

  // Logo / favicon — set a hosted image URL to show your logo (no code change needed)
  logoUrl: E.REACT_APP_BRAND_LOGO_URL || '',
  faviconUrl: E.REACT_APP_BRAND_FAVICON_URL || '',
};

// lowercase, filesystem/url-safe slug for filenames etc.
export const brandSlug = (BRAND.name || 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default BRAND;
