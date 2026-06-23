import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';

/**
 * AntiRedStatusCard
 *
 * Dynamically renders ONLY when the customer's anti-red protection needs
 * attention. Hidden completely when status === 'active' — we don't want
 * to nag healthy accounts with a banner they don't need.
 *
 * Two visible states:
 *   repairing — amber inline card with a helpful note + restore button
 *   stuck     — red urgent banner with stronger CTA
 *
 * The endpoint behind this card is the safety net for FTP/SFTP uploads,
 * STUCK cooldown override, failed auto-restore retry, and CMS-overwritten
 * protection files. The hourly heartbeat + post-extract auto-restore
 * handle the 95%+ majority of cases automatically.
 */
export default function AntiRedStatusCard() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const [status, setStatus] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [feedback, setFeedback] = useState(null);  // { type: 'ok' | 'error', message: string }
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api('/anti-red/status');
      setStatus(data);
    } catch (e) {
      // Silent — status card is non-critical; don't disturb the file manager.
      setStatus(null);
    }
  }, [api]);

  useEffect(() => {
    fetchStatus();
    // Light poll (30s) — matches the cadence the rest of the panel uses.
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    setError('');
    setFeedback(null);
    try {
      const r = await api('/anti-red/restore', { method: 'POST' });
      if (r.success) {
        setFeedback({ type: 'ok', message: t('antiRed.restoredOk') });
        // Re-fetch status so the card hides itself if we're now healthy
        await fetchStatus();
      } else {
        setFeedback({ type: 'error', message: r.error || t('antiRed.restoreFailed') });
      }
    } catch (e) {
      if (e.message && /wait a moment/i.test(e.message)) {
        setError(t('antiRed.cooldown'));
      } else {
        setError(e.message || t('antiRed.restoreFailed'));
      }
    } finally {
      setRestoring(false);
      // Auto-clear feedback after 5s so the panel doesn't keep the toast
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  // Hide the card completely when there's no concern. This is the whole
  // point — customers with healthy protection shouldn't even see this UI.
  if (!status || status.status === 'active') return null;

  const isStuck = status.status === 'stuck';

  return (
    <div
      className={`acct-card ${isStuck ? 'acct-card--offline' : 'acct-card--online'}`}
      data-testid={`anti-red-card-${status.status}`}
      style={{ marginBottom: '1rem' }}
    >
      <div className="acct-card-head">
        <div className="acct-card-icon acct-card-icon--warn" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
          </svg>
        </div>
        <div>
          <h3 className="acct-card-title">
            {isStuck ? `🔴 ${t('antiRed.statusStuck')}` : `⚠️ ${t('antiRed.statusRepairing')}`}
          </h3>
          <p className="acct-card-sub">
            {isStuck ? t('antiRed.helpNoteStuck') : t('antiRed.helpNoteRepairing')}
          </p>
        </div>
      </div>

      {error && <p className="acct-error" data-testid="anti-red-error">{error}</p>}
      {feedback && (
        <p
          className={feedback.type === 'ok' ? 'acct-success-msg' : 'acct-error'}
          data-testid={`anti-red-feedback-${feedback.type}`}
        >
          {feedback.message}
        </p>
      )}

      <div className="acct-actions">
        <button
          type="button"
          className={`acct-btn ${isStuck ? 'acct-btn--warn' : 'acct-btn--success'}`}
          onClick={handleRestore}
          disabled={restoring}
          data-testid="anti-red-restore-btn"
        >
          {restoring ? t('antiRed.restoring') : `🛡️ ${t('antiRed.restoreButton')}`}
        </button>
      </div>
    </div>
  );
}
