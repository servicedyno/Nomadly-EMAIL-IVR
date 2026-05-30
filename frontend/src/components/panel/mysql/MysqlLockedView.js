// Locked / upgrade card shown when a non-Gold user opens the Databases tab.
// Uses the same purple gradient + Telegram-bot CTA as the quota banner so the
// upgrade path is visually consistent across the panel.
import React from 'react';
import { BOT_URL, quotaCtaStyle } from './shared';

// Explicit colors instead of var(--text) — the panel's light theme leaves
// inline-style fallbacks unset, which renders this card's text invisible.
// Use the panel's own --pv-text-primary/secondary CSS vars (defined in
// panel-v2.css :root) so the card auto-adapts to dark/light theme without
// breaking when the theme switcher flips.
const wrapStyle = {
  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.10), rgba(168, 85, 247, 0.10))',
  border: '1px solid rgba(168, 85, 247, 0.35)',
  borderRadius: 12,
  padding: '40px 32px',
  textAlign: 'center',
  color: 'var(--pv-text-primary, #1f1f2a)',
  maxWidth: 560,
  margin: '40px auto',
};

const lockIcon = (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const featureItemStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  fontSize: 13,
  marginBottom: 6,
  opacity: 0.85,
};

const checkIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.5" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function MysqlLockedView({ t, plan }) {
  return (
    <div data-testid="mysql-locked-view" style={wrapStyle}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, color: '#a855f7' }}>
        {lockIcon}
      </div>
      <h2 style={{ margin: '0 0 8px 0', fontSize: 22, fontWeight: 700 }}>
        {t('mysql.lockedTitle', { defaultValue: 'MySQL is a Golden Plan feature' })}
      </h2>
      <p style={{ margin: '0 0 24px 0', opacity: 0.85, fontSize: 14, lineHeight: 1.5 }}>
        {t('mysql.lockedBody', {
          defaultValue:
            'Upgrade to the Golden Anti-Red HostPanel plan to unlock MySQL databases, users, privileges, Remote MySQL access, and one-click phpMyAdmin.',
        })}
      </p>

      <div style={{ textAlign: 'left', maxWidth: 360, margin: '0 auto 28px' }}>
        <div style={featureItemStyle}>{checkIcon}<span>{t('mysql.lockedFeat1', { defaultValue: 'Unlimited MySQL databases & users' })}</span></div>
        <div style={featureItemStyle}>{checkIcon}<span>{t('mysql.lockedFeat2', { defaultValue: 'Remote MySQL connections (whitelist any IP)' })}</span></div>
        <div style={featureItemStyle}>{checkIcon}<span>{t('mysql.lockedFeat3', { defaultValue: 'One-click phpMyAdmin SSO' })}</span></div>
        <div style={featureItemStyle}>{checkIcon}<span>{t('mysql.lockedFeat4', { defaultValue: 'Visitor captcha, unlimited addon domains & more' })}</span></div>
      </div>

      <a
        href={BOT_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="mysql-locked-upgrade-cta"
        style={{ ...quotaCtaStyle, padding: '12px 24px', fontSize: 14 }}
      >
        {t('mysql.lockedCta', { defaultValue: 'Upgrade to Golden Plan' })} →
      </a>

      {plan && (
        <div style={{ marginTop: 18, fontSize: 11, opacity: 0.5 }} data-testid="mysql-locked-current-plan">
          {t('mysql.lockedCurrentPlan', { plan, defaultValue: `Current plan: ${plan}` })}
        </div>
      )}
    </div>
  );
}
