import React, { useState } from 'react';
import { useAuth } from '../components/panel/AuthContext';
import useTheme from '../components/panel/useTheme';

export default function PanelLogin() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { theme, toggleTheme, isDark } = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), pin.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`panel-login-page ${theme === 'light' ? 'panel-light' : ''}`} data-testid="panel-login-page" data-panel-theme={theme}>
      <button onClick={toggleTheme} className="panel-theme-btn panel-theme-btn--login" data-testid="panel-theme-toggle-login" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
        {isDark ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
        )}
      </button>

      <div className="panel-login-card" data-testid="panel-login-card">
        <div className="panel-login-logo">
          <div className="panel-login-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="8" rx="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2"/>
              <circle cx="6" cy="6" r="1" fill="currentColor"/>
              <circle cx="6" cy="18" r="1" fill="currentColor"/>
            </svg>
          </div>
          <h1>Nomadly Hosting</h1>
          <p>Upload your website files, manage domains & emails</p>
        </div>

        <form onSubmit={handleSubmit} data-testid="panel-login-form">
          {error && (
            <div className="panel-login-error" data-testid="panel-login-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink: 0}}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              <span>{error}</span>
            </div>
          )}

          <div className="panel-input-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              data-testid="panel-login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your hosting username"
              autoComplete="username"
              required
            />
            <span className="panel-input-hint">The username sent to you on Telegram</span>
          </div>

          <div className="panel-input-group">
            <label htmlFor="pin">PIN Code</label>
            <input
              id="pin"
              data-testid="panel-login-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit PIN"
              autoComplete="current-password"
              required
            />
            <span className="panel-input-hint">6-digit code from your Telegram message</span>
          </div>

          <button
            type="submit"
            className="panel-login-btn"
            data-testid="panel-login-submit"
            disabled={loading || !username || pin.length < 6}
          >
            {loading ? (
              <span className="panel-login-btn-loading">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="panel-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        <button 
          className="panel-login-help-btn" 
          onClick={() => setShowHelp(!showHelp)}
          data-testid="panel-help-toggle"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          {showHelp ? 'Hide help' : "Can't find your login details?"}
        </button>

        {showHelp && (
          <div className="panel-login-help-box" data-testid="panel-help-box">
            <div className="panel-help-step">
              <span className="panel-help-num">1</span>
              <span>Open <strong>@NomadlyBot</strong> on Telegram</span>
            </div>
            <div className="panel-help-step">
              <span className="panel-help-num">2</span>
              <span>Look for the message with your <strong>hosting credentials</strong> (sent when you purchased hosting)</span>
            </div>
            <div className="panel-help-step">
              <span className="panel-help-num">3</span>
              <span>Copy your <strong>Username</strong> and <strong>6-digit PIN</strong> from that message</span>
            </div>
            <div className="panel-help-divider"></div>
            <p className="panel-help-note">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Forgot your PIN? <a href="https://t.me/Nomadlybot?start=pinreset" target="_blank" rel="noopener noreferrer" className="panel-help-link">Tap here to reset it via the bot</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
