import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

function formatNum(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function statusColor(code) {
  if (code >= 200 && code < 300) return '#34d399';
  if (code >= 300 && code < 400) return '#6d9eff';
  if (code >= 400 && code < 500) return '#fbbf24';
  return '#f87171';
}

function truncateUA(ua, len = 60) {
  if (!ua) return '(empty)';
  return ua.length > len ? ua.slice(0, len) + '...' : ua;
}

export default function Analytics() {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(7);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api(`/analytics?days=${days}`);
      if (res.success) {
        setData(res);
      } else {
        setError(res.error || 'Failed to load analytics');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api, days]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const totals = data?.totals;
  const timeseries = data?.timeseries || [];
  const tq = data?.trafficQuality;
  const byHost = data?.byHost || [];
  const byCountry = data?.byCountry || [];
  const byStatus = data?.byStatus || [];
  const topPaths = data?.topPaths || [];
  const topUserAgents = data?.topUserAgents || [];

  const maxVisitors = Math.max(1, ...timeseries.map(t => t.uniqueVisitors));

  return (
    <div className="an" data-testid="analytics">
      <div className="dl-header">
        <h2>Visitor Analytics</h2>
        <div className="an-period-toggle">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              className={`an-period-btn ${days === d ? 'an-period-btn--active' : ''}`}
              onClick={() => setDays(d)}
              data-testid={`an-period-${d}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {error && <div className="fm-error" data-testid="an-error">{error}</div>}

      {loading ? (
        <div className="fm-loading">Loading analytics...</div>
      ) : !totals ? (
        <div className="fm-empty">No analytics data available. Ensure your domain is active on Cloudflare.</div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="an-cards" data-testid="an-cards">
            <StatCard icon="visitors" value={formatNum(totals.uniqueVisitors)} label="Unique Visitors" testId="an-visitors" />
            <StatCard icon="requests" value={formatNum(totals.requests)} label="Total Requests" testId="an-requests" />
            <StatCard icon="bandwidth" value={formatBytes(totals.bandwidth)} label="Bandwidth" testId="an-bandwidth" />
            <StatCard icon="threats" value={formatNum(totals.threats)} label="Threats Blocked" testId="an-threats" />
          </div>

          {/* Traffic Quality */}
          {tq && (tq.estimatedHuman > 0 || tq.estimatedBot > 0) && (
            <div className="an-section" data-testid="an-traffic-quality">
              <h3>Traffic Quality <span className="an-section-badge">(last 24h)</span></h3>
              <div className="an-tq-row">
                <div className="an-tq-bar-wrap">
                  <div className="an-tq-bar an-tq-bar--human" style={{ width: `${100 - (tq.botPercentage || 0)}%` }} />
                  <div className="an-tq-bar an-tq-bar--bot" style={{ width: `${tq.botPercentage || 0}%` }} />
                </div>
                <div className="an-tq-legend">
                  <span className="an-tq-dot an-tq-dot--human" /> Human: {formatNum(tq.estimatedHuman)} ({100 - (tq.botPercentage || 0)}%)
                  <span className="an-tq-dot an-tq-dot--bot" style={{ marginLeft: 16 }} /> Bot: {formatNum(tq.estimatedBot)} ({tq.botPercentage || 0}%)
                </div>
              </div>
            </div>
          )}

          {/* Visitor Chart */}
          {timeseries.length > 0 && (
            <div className="an-chart-container" data-testid="an-chart">
              <h3>Daily Visitors</h3>
              <div className="an-chart">
                {timeseries.map((t, i) => {
                  const pct = (t.uniqueVisitors / maxVisitors) * 100;
                  const date = new Date(t.date || t.since);
                  const label = `${date.getMonth() + 1}/${date.getDate()}`;
                  return (
                    <div key={i} className="an-bar-col" title={`${label}: ${t.uniqueVisitors} visitors, ${t.requests} req`}>
                      <div className="an-bar-wrapper">
                        <div className="an-bar" style={{ height: `${Math.max(pct, 2)}%` }} data-testid={`an-bar-${i}`} />
                      </div>
                      {(i % Math.max(1, Math.floor(timeseries.length / 8)) === 0 || i === timeseries.length - 1) && (
                        <span className="an-bar-label">{label}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Two-column grid: Host + Country */}
          <div className="an-grid-2" data-testid="an-breakdowns">
            {/* Per-Domain Breakdown */}
            {byHost.length > 0 && (
              <div className="an-section" data-testid="an-by-host">
                <h3>Per Domain <span className="an-section-badge">(last 24h)</span></h3>
                <div className="an-table">
                  {byHost.map((h, i) => {
                    const pct = (h.requests / (byHost[0]?.requests || 1)) * 100;
                    return (
                      <div key={i} className="an-table-row" data-testid={`an-host-${i}`}>
                        <span className="an-table-name">{h.host}</span>
                        <div className="an-table-bar-wrap">
                          <div className="an-table-bar" style={{ width: `${pct}%`, background: '#6d9eff' }} />
                        </div>
                        <span className="an-table-val">{formatNum(h.requests)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Country Breakdown */}
            {byCountry.length > 0 && (
              <div className="an-section" data-testid="an-by-country">
                <h3>By Country</h3>
                <div className="an-table">
                  {byCountry.slice(0, 10).map((c, i) => {
                    const pct = (c.requests / (byCountry[0]?.requests || 1)) * 100;
                    return (
                      <div key={i} className="an-table-row" data-testid={`an-country-${i}`}>
                        <span className="an-table-name">{c.country}</span>
                        <div className="an-table-bar-wrap">
                          <div className="an-table-bar" style={{ width: `${pct}%`, background: '#a78bfa' }} />
                        </div>
                        <span className="an-table-val">{formatNum(c.requests)}</span>
                        {c.threats > 0 && <span className="an-table-threat">{c.threats} threats</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Two-column grid: Status Codes + Top Paths */}
          <div className="an-grid-2">
            {/* HTTP Status Codes */}
            {byStatus.length > 0 && (
              <div className="an-section" data-testid="an-by-status">
                <h3>HTTP Status Codes</h3>
                <div className="an-table">
                  {byStatus.map((s, i) => {
                    const pct = (s.requests / (byStatus[0]?.requests || 1)) * 100;
                    return (
                      <div key={i} className="an-table-row" data-testid={`an-status-${i}`}>
                        <span className="an-table-name" style={{ color: statusColor(s.status), fontWeight: 600, fontFamily: 'monospace' }}>
                          {s.status}
                        </span>
                        <div className="an-table-bar-wrap">
                          <div className="an-table-bar" style={{ width: `${pct}%`, background: statusColor(s.status) }} />
                        </div>
                        <span className="an-table-val">{formatNum(s.requests)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Paths */}
            {topPaths.length > 0 && (
              <div className="an-section" data-testid="an-top-paths">
                <h3>Top Paths <span className="an-section-badge">(last 24h)</span></h3>
                <div className="an-table">
                  {topPaths.slice(0, 10).map((p, i) => {
                    const pct = (p.requests / (topPaths[0]?.requests || 1)) * 100;
                    const statuses = Object.entries(p.statuses || {}).map(([code, cnt]) => (
                      <span key={code} className="an-path-status" style={{ color: statusColor(parseInt(code)) }}>
                        {code}:{cnt}
                      </span>
                    ));
                    return (
                      <div key={i} className="an-table-row an-table-row--path" data-testid={`an-path-${i}`}>
                        <span className="an-table-name an-table-name--path" title={p.path}>{p.path}</span>
                        <div className="an-table-bar-wrap">
                          <div className="an-table-bar" style={{ width: `${pct}%`, background: '#34d399' }} />
                        </div>
                        <span className="an-table-val">{formatNum(p.requests)}</span>
                        <div className="an-path-statuses">{statuses}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Top User Agents */}
          {topUserAgents.length > 0 && (
            <div className="an-section an-section--full" data-testid="an-top-ua">
              <h3>Top User Agents <span className="an-section-badge">(last 24h)</span></h3>
              <div className="an-table">
                {topUserAgents.map((u, i) => (
                  <div key={i} className="an-table-row an-table-row--ua" data-testid={`an-ua-${i}`}>
                    <span className={`an-ua-badge an-ua-badge--${u.type}`}>{u.type}</span>
                    <span className="an-table-name an-table-name--ua" title={u.userAgent}>{truncateUA(u.userAgent, 80)}</span>
                    <span className="an-table-val">{formatNum(u.requests)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pageviews */}
          {totals.pageviews > 0 && (
            <div className="an-extra" data-testid="an-pageviews">
              <span className="an-extra-label">Page Views:</span>
              <span className="an-extra-value">{formatNum(totals.pageviews)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, testId }) {
  const icons = {
    visitors: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    requests: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    bandwidth: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    threats: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  };
  return (
    <div className="an-card" data-testid={testId}>
      <div className={`an-card-icon an-card-icon--${icon}`}>{icons[icon]}</div>
      <div className="an-card-data">
        <span className="an-card-value">{value}</span>
        <span className="an-card-label">{label}</span>
      </div>
    </div>
  );
}
