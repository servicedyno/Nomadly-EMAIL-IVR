import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

function StatusBadge({ active, loading, label }) {
  if (loading) return <span className="sec-badge sec-badge--loading">{label}</span>;
  return (
    <span className={`sec-badge ${active ? 'sec-badge--active' : 'sec-badge--inactive'}`} data-testid={`sec-badge-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span className={`sec-badge-dot ${active ? 'sec-badge-dot--on' : 'sec-badge-dot--off'}`} />
      {label}
    </span>
  );
}

const LAYERS = [
  { key: 'htaccessCloaking', label: '.htaccess IP Cloaking', desc: 'Blocks 35+ known scanner IP ranges at server level' },
  { key: 'scannerUaBlocking', label: 'Scanner UA Blocking', desc: 'Blocks 40+ scanner user-agents via .htaccess' },
  { key: 'cfWafRules', label: 'Cloudflare WAF Rules', desc: 'WAF rules blocking malicious crawlers at the edge' },
  { key: 'cfWorker', label: 'Cloudflare Worker', desc: 'Edge-level challenge injection & scanner blocking' },
  { key: 'jsChallenge', label: 'Visitor Captcha (JS Challenge)', desc: 'Per-domain bot challenge — Golden plan only. Manage per-domain in the Domains tab.' },
];

export default function SecurityPanel() {
  const { api } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/security/status');
      setStatus(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const toggleJsChallenge = async () => {
    const current = status?.protectionLayers?.jsChallenge;
    if (captchaGoldOnly && !isGold) {
      setError('Visitor Captcha is exclusive to Golden Anti-Red HostPanel plans. Upgrade your plan to enable it.');
      return;
    }
    if (current) {
      const confirmed = window.confirm(
        '⚠️ Warning: Disabling Visitor Captcha significantly reduces your protection against automated scanners and bots. We strongly recommend keeping it enabled for maximum security.\n\nAre you sure you want to disable it?'
      );
      if (!confirmed) return;
    }
    setToggling(true);
    setError('');
    setSuccess('');
    try {
      const res = await api('/security/js-challenge/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled: !current }),
      });
      if (res.jsChallengeEnabled !== undefined) {
        setSuccess(`Visitor Captcha ${res.jsChallengeEnabled ? 'enabled' : 'disabled'}`);
        fetchStatus();
      } else if (res.captchaGoldOnly) {
        setError(res.error || 'Visitor Captcha is exclusive to Golden Anti-Red HostPanel plans.');
      } else {
        setError(res.error || 'Failed to toggle');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setToggling(false);
    }
  };

  const layers = status?.protectionLayers || {};
  const stats = status?.stats || {};
  const sb = status?.antiRed?.safeBrowsing;
  const bl = status?.antiRed?.blacklist;
  const isGold = !!status?.isGold;
  const captchaGoldOnly = !!status?.captchaGoldOnly;
  const activeCount = Object.values(layers).filter(Boolean).length;
  const totalCount = LAYERS.length;

  return (
    <div className="sec" data-testid="security-panel">
      <div className="dl-header">
        <h2>Security</h2>
        <div className="dl-header-actions">
          <button onClick={fetchStatus} className="fm-btn fm-btn--ghost" disabled={loading} data-testid="sec-refresh">
            {loading ? 'Checking...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="fm-error" data-testid="sec-error">{error}</div>}
      {success && <div className="sec-success" data-testid="sec-success">{success}</div>}

      {loading ? (
        <div className="fm-loading">Checking security status...</div>
      ) : (
        <>
          {/* Overall Protection Score */}
          <div className="sec-overview" data-testid="sec-overview">
            <div className="sec-overview-ring">
              <svg viewBox="0 0 36 36" className="sec-ring-svg">
                <path className="sec-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="sec-ring-fill" strokeDasharray={`${(activeCount / totalCount) * 100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <span className="sec-ring-text">{activeCount}/{totalCount}</span>
            </div>
            <div className="sec-overview-info">
              <span className="sec-overview-title">Protection Active</span>
              <span className="sec-overview-sub">{activeCount} of {totalCount} security layers enabled</span>
            </div>
          </div>

          {/* Protection Layers */}
          <div className="sec-section" data-testid="sec-layers">
            <h3>Protection Layers</h3>
            <div className="sec-layers">
              {LAYERS.map(layer => {
                const active = layers[layer.key];
                const isJsChallenge = layer.key === 'jsChallenge';
                return (
                  <div key={layer.key} className={`sec-layer ${active ? 'sec-layer--active' : 'sec-layer--inactive'}`} data-testid={`sec-layer-${layer.key}`}>
                    <div className="sec-layer-left">
                      <span className={`sec-layer-indicator ${active ? 'sec-layer-indicator--on' : 'sec-layer-indicator--off'}`} />
                      <div className="sec-layer-text">
                        <span className="sec-layer-name">{layer.label}</span>
                        <span className="sec-layer-desc">{layer.desc}</span>
                      </div>
                    </div>
                    <div className="sec-layer-right">
                      {isJsChallenge ? (
                        captchaGoldOnly && !isGold ? (
                          <span
                            className="sec-badge sec-badge--locked"
                            title={`Visitor Captcha is exclusive to Golden Anti-Red HostPanel plans. Your plan: ${status?.plan || 'unknown'}`}
                            data-testid="sec-js-locked"
                          >
                            🔒 Gold only
                          </span>
                        ) : (
                          <button
                            className={`sec-toggle ${active ? 'sec-toggle--on' : 'sec-toggle--off'}`}
                            onClick={toggleJsChallenge}
                            disabled={toggling}
                            data-testid="sec-js-toggle"
                            title={active ? 'Disable Visitor Captcha' : 'Enable Visitor Captcha'}
                          >
                            <span className="sec-toggle-knob" />
                          </button>
                        )
                      ) : (
                        <StatusBadge active={active} loading={false} label={active ? 'Active' : 'Inactive'} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats */}
          {(stats.scannerIpRanges > 0 || stats.scannerUserAgents > 0) && (
            <div className="sec-stats" data-testid="sec-stats">
              <div className="sec-stat">
                <span className="sec-stat-val">{stats.scannerIpRanges || 0}</span>
                <span className="sec-stat-label">Blocked IP Ranges</span>
              </div>
              <div className="sec-stat">
                <span className="sec-stat-val">{stats.scannerUserAgents || 0}</span>
                <span className="sec-stat-label">Blocked User Agents</span>
              </div>
              <div className="sec-stat">
                <span className="sec-stat-val">{stats.ja3Hashes || 0}</span>
                <span className="sec-stat-label">JA3 Fingerprints</span>
              </div>
            </div>
          )}

          {/* Domain Health */}
          <div className="sec-section" data-testid="sec-health">
            <h3>Domain Health</h3>
            <div className="sec-health-items">
              <div className={`sec-health-item ${bl?.listed === false ? 'sec-health-item--ok' : bl?.listed === true ? 'sec-health-item--bad' : 'sec-health-item--unknown'}`} data-testid="sec-health-bl">
                <span className={`sec-health-dot ${bl?.listed === false ? 'sec-health-dot--ok' : bl?.listed === true ? 'sec-health-dot--bad' : 'sec-health-dot--unknown'}`} />
                <span className="sec-health-name">IP Blacklist</span>
                <span className="sec-health-status">
                  {bl?.listed === false ? `Clean (${bl?.ip || ''})` : bl?.listed === true ? 'Listed' : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
