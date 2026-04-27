import React, { useState } from 'react';
import { useAuth } from './AuthContext';

/**
 * AccountSettings — Danger Zone.
 * Currently exposes "Cancel Hosting Plan" which mirrors the Telegram bot's
 * confirmCancelHostingPlan action: terminates the cPanel account on WHM,
 * cleans up Cloudflare for primary + every addon, and soft-deletes the record.
 *
 * UX guard rails:
 *   1. Two-step flow: review → type-to-confirm.
 *   2. User must type the literal word "CANCEL" (case-sensitive) before the
 *      confirm button is enabled. Backend independently re-validates the same
 *      string in the request body.
 *   3. On success, the user is auto-signed-out so a stale session can't try
 *      to interact with a torn-down cPanel account.
 */
export default function AccountSettings() {
  const { user, api, logout } = useAuth();
  const [stage, setStage] = useState('idle'); // idle | reviewing | submitting | done | error
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');

  const requiredPhrase = 'CANCEL';
  const isPhraseValid = confirmText === requiredPhrase;

  const startReview = () => {
    setError('');
    setConfirmText('');
    setStage('reviewing');
  };

  const cancelReview = () => {
    setError('');
    setConfirmText('');
    setStage('idle');
  };

  const submitCancel = async () => {
    if (!isPhraseValid) return;
    setError('');
    setStage('submitting');
    try {
      await api('/account/cancel', {
        method: 'POST',
        body: JSON.stringify({ confirm: requiredPhrase }),
      });
      setStage('done');
    } catch (err) {
      setError(err.message || 'Failed to cancel hosting plan.');
      setStage('error');
    }
  };

  if (stage === 'done') {
    return (
      <div className="acct-section" data-testid="account-cancel-done">
        <div className="acct-card acct-card--success">
          <div className="acct-card-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 className="acct-card-title">Hosting plan cancelled</h2>
          <p className="acct-card-body">
            Your hosting for <strong>{user?.domain}</strong> has been terminated. The cPanel account, files,
            email accounts, databases, and all addon domains have been removed.
          </p>
          <p className="acct-card-body">
            <strong>Your domain itself stays registered to your account</strong> — it&apos;s just no longer
            attached to a hosting plan. You can purchase a new hosting plan anytime from the Telegram bot.
          </p>
          <button
            type="button"
            className="acct-btn acct-btn--neutral"
            onClick={logout}
            data-testid="account-cancel-signout-btn"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="acct-section" data-testid="account-settings-section">
      <div className="acct-header">
        <h2 className="acct-header-title">Account</h2>
        <p className="acct-header-sub">
          Signed in as <strong>{user?.username}</strong> · <strong>{user?.domain}</strong>
        </p>
      </div>

      <div className="acct-card acct-card--danger" data-testid="account-danger-zone">
        <div className="acct-card-head">
          <div className="acct-card-icon acct-card-icon--danger" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h3 className="acct-card-title">Cancel hosting plan</h3>
            <p className="acct-card-sub">
              Permanently terminate this hosting plan for <strong>{user?.domain}</strong>.
            </p>
          </div>
        </div>

        {stage === 'idle' && (
          <>
            <ul className="acct-warn-list">
              <li>Your cPanel account and all files will be permanently deleted</li>
              <li>All email accounts, databases, and FTP accounts will be removed</li>
              <li>All addon domains attached to this plan will be unlinked</li>
              <li>Anti-Red protection and Cloudflare DNS records will be cleaned up</li>
              <li>This <strong>cannot be undone</strong> and <strong>no refund</strong> will be issued</li>
              <li>The domain itself remains registered to you — only the hosting is cancelled</li>
            </ul>
            <div className="acct-actions">
              <button
                type="button"
                className="acct-btn acct-btn--danger"
                onClick={startReview}
                data-testid="account-cancel-start-btn"
              >
                Cancel hosting plan
              </button>
            </div>
          </>
        )}

        {(stage === 'reviewing' || stage === 'submitting' || stage === 'error') && (
          <>
            <div className="acct-confirm-box">
              <p className="acct-confirm-prompt">
                To confirm, type <code>CANCEL</code> in the box below. The button stays disabled until the
                phrase matches exactly.
              </p>
              <input
                type="text"
                className="acct-confirm-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type CANCEL to confirm"
                aria-label="Type CANCEL to confirm"
                disabled={stage === 'submitting'}
                autoFocus
                data-testid="account-cancel-confirm-input"
              />
              {error && (
                <p className="acct-error" data-testid="account-cancel-error">{error}</p>
              )}
            </div>
            <div className="acct-actions">
              <button
                type="button"
                className="acct-btn acct-btn--neutral"
                onClick={cancelReview}
                disabled={stage === 'submitting'}
                data-testid="account-cancel-back-btn"
              >
                Go back
              </button>
              <button
                type="button"
                className="acct-btn acct-btn--danger"
                onClick={submitCancel}
                disabled={!isPhraseValid || stage === 'submitting'}
                data-testid="account-cancel-confirm-btn"
              >
                {stage === 'submitting' ? 'Cancelling…' : 'Permanently cancel'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
