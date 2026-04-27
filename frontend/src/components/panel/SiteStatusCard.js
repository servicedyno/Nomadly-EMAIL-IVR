import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

/**
 * SiteStatusCard — toggle between online / maintenance / suspended.
 *
 * Mirrors the Telegram bot's site-offline flow exactly. Visibility-only;
 * does NOT pause expiry or auto-renewal — the UI shouts that loudly so
 * users don't expect billing relief.
 */
export default function SiteStatusCard() {
  const { user, api } = useAuth();
  const [status, setStatus] = useState(null);
  const [stage, setStage] = useState('view'); // view | choosing-mode | confirming-offline | confirming-online | submitting
  const [pendingMode, setPendingMode] = useState(null); // 'maintenance' | 'suspended'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setError('');
    try {
      const data = await api('/account/site-status');
      setStatus(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const reset = () => {
    setStage('view');
    setPendingMode(null);
    setError('');
  };

  const startTakeOffline = () => {
    setError('');
    setStage('choosing-mode');
  };

  const pickMode = (mode) => {
    setPendingMode(mode);
    setStage('confirming-offline');
  };

  const startBringOnline = () => {
    setError('');
    setStage('confirming-online');
  };

  const submitOffline = async () => {
    if (!pendingMode) return;
    setError('');
    setStage('submitting');
    try {
      await api('/account/site-status', {
        method: 'POST',
        body: JSON.stringify({ action: 'take_offline', mode: pendingMode }),
      });
      await fetchStatus();
      reset();
    } catch (err) {
      setError(err.message || 'Failed to take site offline.');
      setStage('confirming-offline');
    }
  };

  const submitOnline = async () => {
    setError('');
    setStage('submitting');
    try {
      await api('/account/site-status', {
        method: 'POST',
        body: JSON.stringify({ action: 'bring_online' }),
      });
      await fetchStatus();
      reset();
    } catch (err) {
      setError(err.message || 'Failed to bring site online.');
      setStage('confirming-online');
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return '—'; }
  };

  if (loading) {
    return (
      <div className="acct-card" data-testid="site-status-loading">
        <p className="acct-card-body">Loading site status…</p>
      </div>
    );
  }

  const current = status?.status || 'online';
  const cardClass = current === 'online' ? 'acct-card--online' : 'acct-card--offline';
  const statusLabel = current === 'online'
    ? '✅ Online'
    : current === 'maintenance' ? '🛠️ Maintenance Mode' : '🚫 Suspended';
  const statusDesc = current === 'online'
    ? 'Your site is publicly accessible.'
    : current === 'maintenance'
      ? 'Visitors see a "We\'ll be back soon" page. Email, FTP, and databases still work.'
      : 'HTTP, FTP, email, and databases are all paused. Visitors see the standard "Account Suspended" notice.';

  return (
    <div className={`acct-card ${cardClass}`} data-testid="site-status-card">
      <div className="acct-card-head">
        <div className={`acct-card-icon ${current === 'online' ? '' : 'acct-card-icon--warn'}`} aria-hidden="true">
          {current === 'online' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 11-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          )}
        </div>
        <div>
          <h3 className="acct-card-title">Site status — {statusLabel}</h3>
          <p className="acct-card-sub">{statusDesc}</p>
        </div>
      </div>

      <div className="acct-meta-grid" data-testid="site-status-meta">
        <div><span>Domain</span><strong>{status?.domain || user?.domain}</strong></div>
        <div><span>Plan</span><strong>{status?.plan || '—'}</strong></div>
        <div><span>Expires</span><strong>{formatDate(status?.expiryDate)}</strong></div>
        <div><span>Auto-renew</span><strong>{status?.autoRenew ? '✅ ON' : '❌ OFF'}</strong></div>
      </div>

      {/* ── VIEW (no action selected yet) ─────────────────── */}
      {stage === 'view' && current === 'online' && (
        <div className="acct-actions">
          <button
            type="button"
            className="acct-btn acct-btn--warn"
            onClick={startTakeOffline}
            data-testid="site-take-offline-btn"
          >
            Take site offline
          </button>
        </div>
      )}

      {stage === 'view' && current !== 'online' && (
        <div className="acct-actions">
          <button
            type="button"
            className="acct-btn acct-btn--success"
            onClick={startBringOnline}
            data-testid="site-bring-online-btn"
          >
            Bring site back online
          </button>
        </div>
      )}

      {/* ── CHOOSING MODE ──────────────────────────────────── */}
      {stage === 'choosing-mode' && (
        <div className="acct-mode-picker" data-testid="site-mode-picker">
          <div className="acct-billing-warning" data-testid="site-billing-warning">
            <strong>Heads up:</strong> Taking your site offline does <strong>not</strong> pause your
            expiry countdown or auto-renewal billing. The plan keeps ticking like normal — this is
            a visibility toggle only.
          </div>
          <button
            type="button"
            className="acct-mode-option"
            onClick={() => pickMode('maintenance')}
            data-testid="site-mode-maintenance-btn"
          >
            <span className="acct-mode-emoji" aria-hidden="true">🛠️</span>
            <span className="acct-mode-text">
              <strong>Maintenance Mode</strong>
              <span className="acct-mode-desc">Recommended. Visitors see a clean "We'll be back soon" page. Email, FTP, and databases keep working.</span>
            </span>
          </button>
          <button
            type="button"
            className="acct-mode-option"
            onClick={() => pickMode('suspended')}
            data-testid="site-mode-suspend-btn"
          >
            <span className="acct-mode-emoji" aria-hidden="true">🚫</span>
            <span className="acct-mode-text">
              <strong>Full Suspend</strong>
              <span className="acct-mode-desc">Stops HTTP, FTP, email, and databases. Visitors see the standard cPanel "Account Suspended" page.</span>
            </span>
          </button>
          <div className="acct-actions">
            <button
              type="button"
              className="acct-btn acct-btn--neutral"
              onClick={reset}
              data-testid="site-mode-cancel-btn"
            >
              Go back
            </button>
          </div>
        </div>
      )}

      {/* ── CONFIRMING OFFLINE ─────────────────────────────── */}
      {(stage === 'confirming-offline' || (stage === 'submitting' && pendingMode)) && (
        <div className="acct-confirm-box" data-testid="site-confirm-offline">
          <p className="acct-card-body">
            {pendingMode === 'maintenance' ? (
              <>You&apos;re about to enable <strong>Maintenance Mode</strong> on <strong>{status?.domain}</strong>. Visitors will see a "We&apos;ll be back soon" page. Email, FTP, and databases will keep working.</>
            ) : (
              <>You&apos;re about to <strong>fully suspend</strong> <strong>{status?.domain}</strong>. HTTP, FTP, email, and databases will all stop. Visitors will see cPanel&apos;s "Account Suspended" page.</>
            )}
          </p>
          <p className="acct-card-body acct-billing-warning-inline">
            <strong>Reminder:</strong> billing keeps running. Your expiry date stays the same and auto-renewal will still trigger if enabled.
          </p>
          {error && <p className="acct-error" data-testid="site-status-error">{error}</p>}
          <div className="acct-actions">
            <button
              type="button"
              className="acct-btn acct-btn--neutral"
              onClick={reset}
              disabled={stage === 'submitting'}
              data-testid="site-offline-back-btn"
            >
              Go back
            </button>
            <button
              type="button"
              className="acct-btn acct-btn--warn"
              onClick={submitOffline}
              disabled={stage === 'submitting'}
              data-testid="site-offline-confirm-btn"
            >
              {stage === 'submitting' ? 'Working…' : (pendingMode === 'suspended' ? 'Suspend now' : 'Enable maintenance')}
            </button>
          </div>
        </div>
      )}

      {/* ── CONFIRMING ONLINE ──────────────────────────────── */}
      {(stage === 'confirming-online' || (stage === 'submitting' && !pendingMode)) && (
        <div className="acct-confirm-box" data-testid="site-confirm-online">
          <p className="acct-card-body">
            Bring <strong>{status?.domain}</strong> back online? Public access resumes immediately.
            Allow up to 1 minute for caching/CDN to fully clear.
          </p>
          {error && <p className="acct-error" data-testid="site-status-error">{error}</p>}
          <div className="acct-actions">
            <button
              type="button"
              className="acct-btn acct-btn--neutral"
              onClick={reset}
              disabled={stage === 'submitting'}
              data-testid="site-online-back-btn"
            >
              Go back
            </button>
            <button
              type="button"
              className="acct-btn acct-btn--success"
              onClick={submitOnline}
              disabled={stage === 'submitting'}
              data-testid="site-online-confirm-btn"
            >
              {stage === 'submitting' ? 'Working…' : 'Bring online now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
