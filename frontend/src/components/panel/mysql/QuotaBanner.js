// "Your plan limit was reached" upgrade banner with CTA to the Telegram bot.
// Shown when cPanel rejects a create call with a "maximum reached" pattern.
import React from 'react';
import { BOT_URL, quotaBannerStyle, quotaCtaStyle } from './shared';

export default function QuotaBanner({ message, onDismiss, t }) {
  return (
    <div
      className="alert alert-quota"
      data-testid="mysql-quota-banner"
      style={quotaBannerStyle}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 24, lineHeight: 1 }} aria-hidden>⬆️</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {t('mysql.quotaTitle', { defaultValue: 'Your plan limit was reached' })}
          </div>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 10 }}>
            {t('mysql.quotaBody', { defaultValue: 'Your hosting plan caps how many MySQL databases and users you can create. Upgrade in the bot to unlock more — instant activation.' })}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10, fontFamily: 'ui-monospace, monospace' }}>
            cPanel: {message}
          </div>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="mysql-quota-upgrade-cta"
            style={quotaCtaStyle}
          >
            {t('mysql.quotaCta', { defaultValue: 'Upgrade plan in the bot' })} →
          </a>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('common.close', { defaultValue: 'Close' })}
          data-testid="mysql-quota-dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            fontSize: 20,
            cursor: 'pointer',
            lineHeight: 1,
            opacity: 0.6,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
