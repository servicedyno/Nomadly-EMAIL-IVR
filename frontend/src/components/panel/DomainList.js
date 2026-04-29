import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

export default function DomainList() {
  const { api } = useAuth();
  const [domains, setDomains] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [nsStatus, setNsStatus] = useState({});
  const [nsLoading, setNsLoading] = useState({});
  const [addResult, setAddResult] = useState(null);
  // SSL
  const [sslStatus, setSslStatus] = useState({});
  const [sslLoading, setSslLoading] = useState(false);
  const [cfSSLMode, setCfSSLMode] = useState(null);
  // Subdomain
  const [showSubCreate, setShowSubCreate] = useState(false);
  const [subName, setSubName] = useState('');
  const [subRoot, setSubRoot] = useState('');
  const [creatingSub, setCreatingSub] = useState(false);
  const [subdomains, setSubdomains] = useState([]);
  const [subLoading, setSubLoading] = useState(true);

  const fetchDomains = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/domains');
      if (res.errors?.length) {
        setError(res.errors[0]);
      } else {
        setDomains(res.data || {});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const fetchSubdomains = useCallback(async () => {
    setSubLoading(true);
    try {
      const res = await api('/subdomains');
      if (res.data && Array.isArray(res.data)) {
        setSubdomains(res.data);
      }
    } catch (_) {}
    setSubLoading(false);
  }, [api]);

  const fetchSSL = useCallback(async () => {
    setSslLoading(true);
    try {
      const res = await api('/domains/ssl');
      if (res.data) {
        setSslStatus(res.data);
      }
      if (res.cfSSLMode) {
        setCfSSLMode(res.cfSSLMode);
      }
    } catch (_) {}
    setSslLoading(false);
  }, [api]);

  useEffect(() => {
    fetchDomains();
    fetchSubdomains();
    fetchSSL();
  }, [fetchDomains, fetchSubdomains, fetchSSL]);

  // Auto-check NS status for all domains on load
  useEffect(() => {
    if (!domains) return;
    const mainDomain = domains.main_domain;
    const addonDomains = domains.addon_domains || [];
    const allDoms = [mainDomain, ...addonDomains].filter(Boolean);
    allDoms.forEach((d) => {
      if (!nsStatus[d] && !nsLoading[d]) {
        checkNS(d);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domains]);

  const checkNS = async (domain) => {
    setNsLoading(p => ({ ...p, [domain]: true }));
    try {
      const res = await api(`/domains/ns-status?domain=${encodeURIComponent(domain)}`);
      setNsStatus(p => ({ ...p, [domain]: res }));
      // If NS is active, refresh SSL status (but don't auto-trigger AutoSSL — that's a manual action)
      if (res.status === 'active') {
        fetchSSL();
      }
    } catch (_) {
      setNsStatus(p => ({ ...p, [domain]: { status: 'error' } }));
    }
    setNsLoading(p => ({ ...p, [domain]: false }));
  };

  const [autoSSLLoading, setAutoSSLLoading] = useState(false);
  const [autoSSLResult, setAutoSSLResult] = useState(null);

  // Visitor Captcha (Anti-Red) per-domain toggle state
  const [captchaInfo, setCaptchaInfo] = useState({ isGold: false, plan: '', loaded: false });
  const [captchaByDomain, setCaptchaByDomain] = useState({});
  const [captchaToggling, setCaptchaToggling] = useState({});
  const [captchaError, setCaptchaError] = useState('');

  const fetchCaptcha = useCallback(async () => {
    try {
      const res = await api('/security/captcha/status');
      const map = {};
      (res.domains || []).forEach(d => { map[d.domain] = d; });
      setCaptchaByDomain(map);
      setCaptchaInfo({ isGold: !!res.isGold, plan: res.plan || '', loaded: true });
    } catch (_) {
      setCaptchaInfo({ isGold: false, plan: '', loaded: true });
    }
  }, [api]);

  useEffect(() => { fetchCaptcha(); }, [fetchCaptcha]);

  const toggleCaptcha = async (domain) => {
    const current = captchaByDomain[domain];
    if (!current) return;
    if (!captchaInfo.isGold) return; // locked — handled in UI
    if (!current.hasCloudflare) {
      setCaptchaError(`${domain} is not on Cloudflare. Visitor Captcha requires Cloudflare nameservers.`);
      return;
    }
    if (current.enabled) {
      const ok = window.confirm(`Disable Visitor Captcha for ${domain}?\n\nVisitors will no longer see the "Verifying your browser" check. Bots and scanners will not be blocked at the edge.`);
      if (!ok) return;
    }
    setCaptchaToggling(p => ({ ...p, [domain]: true }));
    setCaptchaError('');
    try {
      const res = await api('/security/captcha/toggle', {
        method: 'POST',
        body: JSON.stringify({ domain, enabled: !current.enabled }),
      });
      if (res.success) {
        setCaptchaByDomain(p => ({ ...p, [domain]: { ...p[domain], enabled: !!res.enabled } }));
      } else {
        setCaptchaError(res.error || 'Failed to toggle Visitor Captcha');
      }
    } catch (err) {
      setCaptchaError(err.message);
    } finally {
      setCaptchaToggling(p => ({ ...p, [domain]: false }));
    }
  };

  const CaptchaBadge = ({ domain }) => {
    const info = captchaByDomain[domain];
    const isGold = captchaInfo.isGold;
    const toggling = !!captchaToggling[domain];
    if (!captchaInfo.loaded || !info) {
      return <span className="dl-cap-badge dl-cap-badge--loading" data-testid={`dl-cap-loading-${domain}`}>Captcha...</span>;
    }
    if (!isGold) {
      return (
        <span
          className="dl-cap-badge dl-cap-badge--locked"
          title={`Visitor Captcha is exclusive to Golden Anti-Red HostPanel plans. Your plan: ${captchaInfo.plan || 'unknown'}`}
          data-testid={`dl-cap-locked-${domain}`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          🔒 Captcha (Gold)
        </span>
      );
    }
    if (!info.hasCloudflare) {
      return (
        <span className="dl-cap-badge dl-cap-badge--nocf" title="Visitor Captcha requires Cloudflare nameservers" data-testid={`dl-cap-nocf-${domain}`}>
          Captcha N/A
        </span>
      );
    }
    return (
      <button
        type="button"
        className={`dl-cap-toggle ${info.enabled ? 'dl-cap-toggle--on' : 'dl-cap-toggle--off'}`}
        onClick={() => toggleCaptcha(domain)}
        disabled={toggling}
        title={info.enabled ? 'Visitor Captcha is ON — click to disable' : 'Visitor Captcha is OFF — click to enable'}
        data-testid={`dl-cap-toggle-${domain}`}
      >
        <span className="dl-cap-knob" />
        <span className="dl-cap-label">{toggling ? '...' : (info.enabled ? '🛡️ Captcha ON' : '🛡️ Captcha OFF')}</span>
      </button>
    );
  };

  const triggerAutoSSL = async () => {
    setAutoSSLLoading(true);
    setAutoSSLResult(null);
    try {
      const res = await api('/domains/ssl/autossl', { method: 'POST' });
      if (res.success) {
        setAutoSSLResult({ success: true, message: res.message || 'AutoSSL check started' });
        // Refresh SSL status after a delay to let certs issue
        setTimeout(() => fetchSSL(), 10000);
      } else {
        setAutoSSLResult({ success: false, message: res.error || 'AutoSSL failed' });
      }
    } catch (err) {
      setAutoSSLResult({ success: false, message: err.message || 'AutoSSL request failed' });
    }
    setAutoSSLLoading(false);
  };

  const handleAdd = async () => {
    if (!newDomain.trim()) return;
    setAdding(true);
    setError('');
    setAddResult(null);
    try {
      const res = await api('/domains/add-enhanced', {
        method: 'POST',
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      if (res.errors?.length) {
        setError(res.errors[0]);
      } else {
        setAddResult(res.nsInfo || null);
        // Update NS status immediately for the new domain
        if (res.nsInfo) {
          setNsStatus(p => ({ ...p, [newDomain.trim()]: res.nsInfo }));
        }
        setNewDomain('');
        fetchDomains();
        fetchSubdomains();
        fetchSSL();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (domain) => {
    if (!window.confirm(`Remove addon domain: ${domain}?`)) return;
    try {
      const res = await api('/domains/remove', {
        method: 'POST',
        body: JSON.stringify({ domain }),
      });
      if (res.errors?.length) {
        setError(res.errors[0]);
      } else {
        fetchDomains();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateSub = async () => {
    if (!subName.trim() || !subRoot) return;
    setCreatingSub(true);
    setError('');
    try {
      const res = await api('/subdomains/create', {
        method: 'POST',
        body: JSON.stringify({ subdomain: subName.trim(), rootdomain: subRoot }),
      });
      if (res.errors?.length) {
        setError(res.errors[0]);
      } else {
        setSubName('');
        setShowSubCreate(false);
        fetchSubdomains();
        fetchDomains();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingSub(false);
    }
  };

  const handleDeleteSub = async (sub) => {
    if (!window.confirm(`Delete subdomain: ${sub}?`)) return;
    try {
      const res = await api('/subdomains/delete', {
        method: 'POST',
        body: JSON.stringify({ subdomain: sub }),
      });
      if (res.errors?.length) {
        setError(res.errors[0]);
      } else {
        fetchSubdomains();
        fetchDomains();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const mainDomain = domains?.main_domain;
  const addonDomains = domains?.addon_domains || [];
  const allDomains = [mainDomain, ...addonDomains].filter(Boolean);

  // Set default root domain for subdomain creation
  useEffect(() => {
    if (allDomains.length > 0 && !subRoot) setSubRoot(allDomains[0]);
  }, [allDomains, subRoot]);

  const NSBadge = ({ domain }) => {
    const info = nsStatus[domain];
    const isLoading = nsLoading[domain];
    if (isLoading) return <span className="dl-ns-badge dl-ns-badge--loading">Checking...</span>;
    if (!info) return (
      <button className="dl-ns-check-btn" onClick={() => checkNS(domain)} data-testid={`dl-ns-check-${domain}`}>
        Check NS
      </button>
    );
    if (info.status === 'active') return <span className="dl-ns-badge dl-ns-badge--active" data-testid={`dl-ns-active-${domain}`}>NS Active</span>;
    if (info.status === 'pending' && info.autoManaged) return (
      <span className="dl-ns-badge dl-ns-badge--propagating" data-testid={`dl-ns-propagating-${domain}`}>
        Propagating
      </span>
    );
    if (info.status === 'pending') return (
      <span className="dl-ns-badge dl-ns-badge--pending" data-testid={`dl-ns-pending-${domain}`}>
        NS Pending
      </span>
    );
    return <span className="dl-ns-badge dl-ns-badge--unknown" data-testid={`dl-ns-unknown-${domain}`}>NS Unknown</span>;
  };

  const SSLBadge = ({ domain }) => {
    const info = sslStatus[domain];
    if (sslLoading && !info) return <span className="dl-ssl-badge dl-ssl-badge--loading" data-testid={`dl-ssl-loading-${domain}`}>SSL...</span>;
    if (!info) return <span className="dl-ssl-badge dl-ssl-badge--none" data-testid={`dl-ssl-none-${domain}`}>No SSL</span>;
    if (info.status === 'valid') {
      const isCF = info.cloudflare;
      const tip = isCF
        ? `Cloudflare SSL (${info.cfSSLMode || 'active'})`
        : `${info.issuer}${info.daysLeft != null && info.daysLeft >= 0 ? ` - ${info.daysLeft}d left` : ''}`;
      return (
        <span className={`dl-ssl-badge dl-ssl-badge--valid${isCF ? ' dl-ssl-badge--cf' : ''}`} title={tip} data-testid={`dl-ssl-valid-${domain}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          {isCF ? 'CF SSL' : 'SSL'}
          {!isCF && info.daysLeft != null && info.daysLeft >= 0 && <span className="dl-ssl-days">{info.daysLeft}d</span>}
        </span>
      );
    }
    if (info.status === 'expiring') {
      return (
        <span className="dl-ssl-badge dl-ssl-badge--expiring" title={`Expires in ${info.daysLeft} days`} data-testid={`dl-ssl-expiring-${domain}`}>
          SSL {info.daysLeft}d
        </span>
      );
    }
    if (info.status === 'expired') {
      return (
        <span className="dl-ssl-badge dl-ssl-badge--expired" data-testid={`dl-ssl-expired-${domain}`}>
          Expired
        </span>
      );
    }
    return <span className="dl-ssl-badge dl-ssl-badge--none" data-testid={`dl-ssl-none-${domain}`}>No SSL</span>;
  };

  // Inline NS pending info component
  const NSPendingInfo = ({ domain }) => {
    const info = nsStatus[domain];
    if (!info || info.status !== 'pending') return null;

    // Auto-managed domains (registered through our platform): NS already set, just propagating
    if (info.autoManaged) {
      return (
        <div className="dl-ns-inline-info dl-ns-inline-info--auto" data-testid={`dl-ns-info-${domain}`}>
          <div className="dl-ns-inline-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>Nameservers configured automatically. Propagation in progress...</span>
          </div>
          <p className="dl-ns-inline-note">This usually completes within a few minutes. <button className="dl-ns-recheck-btn" onClick={() => checkNS(domain)} data-testid={`dl-ns-recheck-${domain}`}>Re-check now</button></p>
        </div>
      );
    }

    // External domains: show NS update instructions
    if (!info.nameservers?.length) return null;
    return (
      <div className="dl-ns-inline-info" data-testid={`dl-ns-info-${domain}`}>
        <div className="dl-ns-inline-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Update your nameservers at your domain registrar:</span>
        </div>
        <div className="dl-ns-inline-codes">
          {info.nameservers.map((ns, i) => (
            <code key={i} className="dl-ns-code" data-testid={`dl-ns-code-${domain}-${i}`}>{ns}</code>
          ))}
        </div>
        <p className="dl-ns-inline-note">Propagation can take up to 24-48 hours. <button className="dl-ns-recheck-btn" onClick={() => checkNS(domain)} data-testid={`dl-ns-recheck-${domain}`}>Re-check now</button> (also triggers SSL issuance if NS active)</p>
      </div>
    );
  };

  return (
    <div className="dl" data-testid="domain-list">
      <div className="dl-header">
        <h2>Domains</h2>
        <div className="dl-header-actions">
          <button onClick={triggerAutoSSL} className="fm-btn fm-btn--ghost" data-testid="dl-autossl-btn" title="Issue/renew SSL certificates for all domains" disabled={autoSSLLoading}>
            {autoSSLLoading ? 'Running...' : '🔒 Run AutoSSL'}
          </button>
          <button onClick={fetchSSL} className="fm-btn fm-btn--ghost" data-testid="dl-refresh-ssl" title="Refresh SSL status" disabled={sslLoading}>
            {sslLoading ? 'Checking...' : 'Refresh SSL'}
          </button>
          <button onClick={() => { setShowSubCreate(!showSubCreate); setShowAdd(false); }} className="fm-btn fm-btn--ghost" data-testid="dl-sub-btn">
            + Subdomain
          </button>
          <button onClick={() => { setShowAdd(!showAdd); setShowSubCreate(false); }} className="fm-btn fm-btn--primary" data-testid="dl-add-btn">
            + Add Domain
          </button>
        </div>
      </div>

      {/* AutoSSL Result Banner */}
      {autoSSLResult && (
        <div className={`fm-${autoSSLResult.success ? 'success' : 'error'}`} data-testid="dl-autossl-result" style={{marginBottom: '0.5rem'}}>
          {autoSSLResult.success ? '✅' : '❌'} {autoSSLResult.message}
          {autoSSLResult.success && <span style={{marginLeft: '0.5rem', opacity: 0.7}}>(SSL status will refresh shortly)</span>}
        </div>
      )}

      {/* Cloudflare SSL Mode Indicator */}
      {cfSSLMode && (
        <div className="dl-cf-ssl-mode" data-testid="dl-cf-ssl-mode">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Cloudflare SSL: <strong>{cfSSLMode}</strong></span>
        </div>
      )}

      {error && <div className="fm-error" data-testid="dl-error">{error}</div>}
      {captchaError && <div className="fm-error" data-testid="dl-captcha-error">{captchaError}</div>}

      {/* Visitor Captcha plan banner */}
      {captchaInfo.loaded && !captchaInfo.isGold && (
        <div className="dl-captcha-banner" data-testid="dl-captcha-upgrade-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          <div className="dl-captcha-banner-text">
            <strong>🛡️ Visitor Captcha — Gold-only feature</strong>
            <span>Block scanners, scrapers and bots at the Cloudflare edge with a per-domain "Verifying your browser" challenge. Available exclusively on <b>👑 Golden Anti-Red HostPanel</b> plans.</span>
          </div>
        </div>
      )}

      {/* Add Domain Form */}
      {showAdd && (
        <div className="dl-add-form" data-testid="dl-add-form">
          <div className="dl-add-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>The domain will be linked to its own directory under <code>public_html/{'{domain}'}</code>. Upload your website files there after adding.</span>
          </div>
          <div className="dl-add-row">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="example.com"
              data-testid="dl-add-input"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button onClick={handleAdd} className="fm-btn fm-btn--primary" disabled={adding} data-testid="dl-add-submit">
              {adding ? 'Adding...' : 'Add'}
            </button>
            <button onClick={() => { setShowAdd(false); setNewDomain(''); setAddResult(null); }} className="fm-btn fm-btn--ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* Add Domain Result - NS Info */}
      {addResult && (
        <div className={`dl-ns-result ${addResult.autoUpdated ? 'dl-ns-result--auto' : 'dl-ns-result--manual'}`} data-testid="dl-add-result">
          <div className="dl-ns-result-header">
            {addResult.autoUpdated ? (
              <><span className="dl-ns-icon dl-ns-icon--ok">&#10003;</span> DNS auto-configured via Cloudflare</>
            ) : (
              <><span className="dl-ns-icon dl-ns-icon--warn">!</span> Update your nameservers</>
            )}
          </div>
          {!addResult.autoUpdated && addResult.nameservers?.length > 0 && (
            <div className="dl-ns-list">
              <p>Point your domain to these Cloudflare nameservers:</p>
              {addResult.nameservers.map((ns, i) => (
                <code key={i} className="dl-ns-code" data-testid={`dl-ns-${i}`}>{ns}</code>
              ))}
              <p className="dl-ns-note">Status will show as "Pending" until NS propagation completes (up to 24-48h).</p>
            </div>
          )}
          <button onClick={() => setAddResult(null)} className="fm-btn fm-btn--ghost dl-ns-dismiss">Dismiss</button>
        </div>
      )}

      {/* Subdomain Create Form */}
      {showSubCreate && (
        <div className="dl-add-form dl-sub-form" data-testid="dl-sub-form">
          <div className="dl-add-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>Subdomain will be linked to <code>public_html/{'{subdomain}'}</code> directory.</span>
          </div>
          <div className="dl-sub-input-row">
            <input
              type="text"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="blog"
              data-testid="dl-sub-name-input"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSub()}
            />
            <span className="dl-sub-dot">.</span>
            <select value={subRoot} onChange={(e) => setSubRoot(e.target.value)} data-testid="dl-sub-root-select">
              {allDomains.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="dl-sub-actions">
            <button onClick={handleCreateSub} className="fm-btn fm-btn--primary" disabled={creatingSub || !subName.trim()} data-testid="dl-sub-submit">
              {creatingSub ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => { setShowSubCreate(false); setSubName(''); }} className="fm-btn fm-btn--ghost">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="fm-loading">Loading domains...</div>
      ) : (
        <div className="dl-sections">
          {/* Main Domain */}
          {mainDomain && (
            <div className="dl-section">
              <h3>Main Domain</h3>
              <div className="dl-domain-card dl-domain-card--main" data-testid="dl-main-domain">
                <div className="dl-domain-card-top">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/></svg>
                  <span className="dl-domain-name">{mainDomain}</span>
                  <div className="dl-badges-row">
                    <SSLBadge domain={mainDomain} />
                    <NSBadge domain={mainDomain} />
                    <CaptchaBadge domain={mainDomain} />
                    <span className="dl-badge dl-badge--primary">Primary</span>
                  </div>
                </div>
                <div className="dl-domain-docroot">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                  <span>Document root: <code>public_html/</code></span>
                </div>
              </div>
              <NSPendingInfo domain={mainDomain} />
            </div>
          )}

          {/* Addon Domains */}
          {addonDomains.length > 0 && (
            <div className="dl-section">
              <h3>Addon Domains ({addonDomains.length})</h3>
              {addonDomains.map((d, i) => (
                <React.Fragment key={i}>
                  <div className="dl-domain-card" data-testid={`dl-addon-${d}`}>
                    <div className="dl-domain-card-top">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/></svg>
                      <span className="dl-domain-name">{d}</span>
                      <div className="dl-badges-row">
                        <SSLBadge domain={d} />
                        <NSBadge domain={d} />
                        <CaptchaBadge domain={d} />
                        <span className="dl-badge">Addon</span>
                      </div>
                      <button onClick={() => handleRemove(d)} className="fm-action-btn fm-action-btn--danger" title="Remove" data-testid={`dl-remove-${d}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                    <div className="dl-domain-docroot">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                      <span>Document root: <code>public_html/{d}</code></span>
                    </div>
                  </div>
                  <NSPendingInfo domain={d} />
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Subdomains */}
          {!subLoading && subdomains.length > 0 && (
            <div className="dl-section">
              <h3>Subdomains ({subdomains.length})</h3>
              {subdomains.map((s, i) => {
                const fullSub = s.domain || s;
                const rootDom = s.rootdomain || '';
                const display = rootDom ? `${fullSub}.${rootDom}` : fullSub;
                const docRoot = s.dir || s.documentroot || `public_html/${fullSub}`;
                return (
                  <div key={i} className="dl-domain-card" data-testid={`dl-sub-${display}`}>
                    <div className="dl-domain-card-top">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                      <span className="dl-domain-name">{display}</span>
                      <div className="dl-badges-row">
                        <SSLBadge domain={display} />
                        <span className="dl-badge dl-badge--sub">Sub</span>
                      </div>
                      <button onClick={() => handleDeleteSub(display)} className="fm-action-btn fm-action-btn--danger" title="Delete" data-testid={`dl-sub-del-${display}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                    <div className="dl-domain-docroot">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                      <span>Document root: <code>{docRoot}</code></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!mainDomain && addonDomains.length === 0 && subdomains.length === 0 && (
            <div className="fm-empty">No domains configured</div>
          )}
        </div>
      )}
    </div>
  );
}
