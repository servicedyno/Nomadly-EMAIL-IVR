import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const COUNTRIES = [
  {code:'AF',name:'Afghanistan'},{code:'AL',name:'Albania'},{code:'DZ',name:'Algeria'},{code:'AR',name:'Argentina'},
  {code:'AU',name:'Australia'},{code:'AT',name:'Austria'},{code:'BD',name:'Bangladesh'},{code:'BE',name:'Belgium'},
  {code:'BR',name:'Brazil'},{code:'CA',name:'Canada'},{code:'CL',name:'Chile'},{code:'CN',name:'China'},
  {code:'CO',name:'Colombia'},{code:'HR',name:'Croatia'},{code:'CZ',name:'Czech Republic'},{code:'DK',name:'Denmark'},
  {code:'EG',name:'Egypt'},{code:'FI',name:'Finland'},{code:'FR',name:'France'},{code:'DE',name:'Germany'},
  {code:'GH',name:'Ghana'},{code:'GR',name:'Greece'},{code:'HK',name:'Hong Kong'},{code:'HU',name:'Hungary'},
  {code:'IN',name:'India'},{code:'ID',name:'Indonesia'},{code:'IR',name:'Iran'},{code:'IQ',name:'Iraq'},
  {code:'IE',name:'Ireland'},{code:'IL',name:'Israel'},{code:'IT',name:'Italy'},{code:'JP',name:'Japan'},
  {code:'KE',name:'Kenya'},{code:'KR',name:'South Korea'},{code:'KW',name:'Kuwait'},{code:'MY',name:'Malaysia'},
  {code:'MX',name:'Mexico'},{code:'MA',name:'Morocco'},{code:'NL',name:'Netherlands'},{code:'NZ',name:'New Zealand'},
  {code:'NG',name:'Nigeria'},{code:'NO',name:'Norway'},{code:'PK',name:'Pakistan'},{code:'PE',name:'Peru'},
  {code:'PH',name:'Philippines'},{code:'PL',name:'Poland'},{code:'PT',name:'Portugal'},{code:'QA',name:'Qatar'},
  {code:'RO',name:'Romania'},{code:'RU',name:'Russia'},{code:'SA',name:'Saudi Arabia'},{code:'SG',name:'Singapore'},
  {code:'ZA',name:'South Africa'},{code:'ES',name:'Spain'},{code:'SE',name:'Sweden'},{code:'CH',name:'Switzerland'},
  {code:'TW',name:'Taiwan'},{code:'TH',name:'Thailand'},{code:'TR',name:'Turkey'},{code:'UA',name:'Ukraine'},
  {code:'AE',name:'UAE'},{code:'GB',name:'United Kingdom'},{code:'US',name:'United States'},{code:'VN',name:'Vietnam'},
];

export default function GeoManager() {
  const { api } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [mode, setMode] = useState('block');
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState('');

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/geo');
      setRules(res.rules || []);
      if (res.error) setError(res.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const toggleCountry = (code) => {
    setSelected(p => p.includes(code) ? p.filter(c => c !== code) : [...p, code]);
  };

  const handleCreate = async () => {
    if (!selected.length) return;
    setCreating(true);
    setError('');
    try {
      const desc = mode === 'block'
        ? `Block: ${selected.join(', ')}`
        : `Allow only: ${selected.join(', ')}`;
      const res = await api('/geo/create', {
        method: 'POST',
        body: JSON.stringify({ countries: selected, mode, description: desc }),
      });
      if (res.success) {
        setSelected([]);
        setShowCreate(false);
        fetchRules();
      } else {
        setError(res.errors?.[0]?.message || 'Failed to create rule');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (ruleId) => {
    if (!window.confirm('Delete this geo rule?')) return;
    setDeleting(ruleId);
    try {
      const res = await api('/geo/delete', {
        method: 'POST',
        body: JSON.stringify({ ruleId }),
      });
      if (res.success) {
        fetchRules();
      } else {
        setError(res.errors?.[0]?.message || 'Failed to delete rule');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting('');
    }
  };

  const parseExpression = (expr) => {
    const isAllow = expr.startsWith('not ');
    const codes = [...expr.matchAll(/ip\.geoip\.country eq "([A-Z]{2})"/g)].map(m => m[1]);
    return { isAllow, codes };
  };

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="geo" data-testid="geo-manager">
      <div className="dl-header">
        <h2>Geo Settings</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="fm-btn fm-btn--primary" data-testid="geo-create-btn">
          + New Rule
        </button>
      </div>

      {error && <div className="fm-error" data-testid="geo-error">{error}</div>}

      {showCreate && (
        <div className="geo-create-form" data-testid="geo-create-form">
          <div className="geo-mode-toggle">
            <button
              className={`geo-mode-btn ${mode === 'block' ? 'geo-mode-btn--active geo-mode-btn--block' : ''}`}
              onClick={() => setMode('block')}
              data-testid="geo-mode-block"
            >
              Block Countries
            </button>
            <button
              className={`geo-mode-btn ${mode === 'allow' ? 'geo-mode-btn--active geo-mode-btn--allow' : ''}`}
              onClick={() => setMode('allow')}
              data-testid="geo-mode-allow"
            >
              Allow Only
            </button>
          </div>

          <p className="geo-mode-desc">
            {mode === 'block'
              ? 'Visitors from selected countries will be BLOCKED from your website.'
              : 'ONLY visitors from selected countries can access your website. All others will be blocked.'}
          </p>

          <input
            className="geo-search"
            type="text"
            placeholder="Search countries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="geo-search"
          />

          {selected.length > 0 && (
            <div className="geo-selected" data-testid="geo-selected">
              {selected.map(code => {
                const c = COUNTRIES.find(x => x.code === code);
                return (
                  <span key={code} className="geo-tag" onClick={() => toggleCountry(code)} data-testid={`geo-tag-${code}`}>
                    {c?.name || code} &times;
                  </span>
                );
              })}
            </div>
          )}

          <div className="geo-country-grid" data-testid="geo-country-grid">
            {filtered.map(c => (
              <label key={c.code} className={`geo-country-item ${selected.includes(c.code) ? 'geo-country-item--selected' : ''}`} data-testid={`geo-country-${c.code}`}>
                <input
                  type="checkbox"
                  checked={selected.includes(c.code)}
                  onChange={() => toggleCountry(c.code)}
                />
                <span>{c.name}</span>
                <span className="geo-country-code">{c.code}</span>
              </label>
            ))}
          </div>

          <div className="geo-form-actions">
            <button
              onClick={handleCreate}
              className="fm-btn fm-btn--primary"
              disabled={creating || !selected.length}
              data-testid="geo-submit"
            >
              {creating ? 'Creating...' : `${mode === 'block' ? 'Block' : 'Allow Only'} ${selected.length} Countries`}
            </button>
            <button onClick={() => { setShowCreate(false); setSelected([]); setSearch(''); }} className="fm-btn fm-btn--ghost">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="fm-loading">Loading geo rules...</div>
      ) : rules.length === 0 ? (
        <div className="fm-empty">
          No geo rules configured. All countries can access your website.
        </div>
      ) : (
        <div className="geo-rules-list" data-testid="geo-rules-list">
          {rules.map(rule => {
            const { isAllow, codes } = parseExpression(rule.expression);
            return (
              <div key={rule.id} className={`geo-rule-card ${isAllow ? 'geo-rule-card--allow' : 'geo-rule-card--block'}`} data-testid={`geo-rule-${rule.id}`}>
                <div className="geo-rule-header">
                  <span className={`geo-rule-badge ${isAllow ? 'geo-rule-badge--allow' : 'geo-rule-badge--block'}`}>
                    {isAllow ? 'Allow Only' : 'Block'}
                  </span>
                  <span className="geo-rule-count">{codes.length} countries</span>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="fm-action-btn fm-action-btn--danger"
                    disabled={deleting === rule.id}
                    title="Delete rule"
                    data-testid={`geo-delete-${rule.id}`}
                  >
                    {deleting === rule.id ? '...' : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>}
                  </button>
                </div>
                <div className="geo-rule-countries">
                  {codes.map(code => {
                    const c = COUNTRIES.find(x => x.code === code);
                    return <span key={code} className="geo-rule-tag">{c?.name || code}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
