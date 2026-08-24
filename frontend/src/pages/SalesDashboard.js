import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, PiggyBank, CalendarDays, ShoppingCart,
  Receipt, RefreshCw, LogOut, Download, Search, Wallet, Gift, BarChart3,
  Layers, Users, Package, Lock,
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api/admin/sales`;

const RANGES = [
  { k: 'today', label: 'Today' },
  { k: '7d', label: '7 Days' },
  { k: '30d', label: '30 Days' },
  { k: '90d', label: '90 Days' },
  { k: '1y', label: '1 Year' },
  { k: 'all', label: 'All Time' },
];

const CAT_COLORS = {
  Domains: '#34d399', Hosting: '#38bdf8', VPS: '#a78bfa', 'Cloud Phone': '#fbbf24',
  Calls: '#f472b6', SMS: '#22d3ee', 'Digital Products': '#f59e0b', Subscriptions: '#4ade80',
  Leads: '#e879f9', Marketplace: '#60a5fa', Other: '#94a3b8',
};
const colorFor = (c) => CAT_COLORS[c] || '#94a3b8';

const fmtUsd = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUsd0 = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtNum = (n) => (Number(n) || 0).toLocaleString('en-US');

// ─────────────────────────────────────────────────────────────
// Login gate
// ─────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('salesToken', data.token);
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0b0d] px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white/[0.04] border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Lock className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-white text-lg font-semibold leading-tight">Sales & Profit</h1>
            <p className="text-slate-400 text-xs">Nomadly Admin Analytics</p>
          </div>
        </div>
        <label className="block text-slate-300 text-sm mb-2">Dashboard password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          data-testid="sales-password-input"
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition"
          placeholder="Enter password"
        />
        {error && <p className="text-rose-400 text-sm mt-3" data-testid="sales-login-error">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          data-testid="sales-login-btn"
          className="mt-5 w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-lg py-2.5 transition"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────
function Kpi({ icon: Icon, label, value, accent = 'emerald', delta, sub, testid }) {
  const accents = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    sky: 'text-sky-400 bg-sky-500/10',
    violet: 'text-violet-400 bg-violet-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
    slate: 'text-slate-300 bg-white/5',
  };
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 flex flex-col gap-2" data-testid={testid}>
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs uppercase tracking-wide">{label}</span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${accents[accent]}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <div className="text-white text-2xl font-semibold tabular-nums">{value}</div>
      <div className="flex items-center gap-2 min-h-[18px]">
        {delta != null && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(delta)}%
          </span>
        )}
        {sub && <span className="text-slate-500 text-xs">{sub}</span>}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#14161b] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-slate-300 mb-1 font-medium">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400 capitalize">{p.dataKey}:</span>
          <span className="text-white font-medium">{fmtUsd(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function CategoryTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#14161b] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-white font-medium mb-1">{d.category}</div>
      <div className="text-slate-400">Revenue: <span className="text-white">{fmtUsd(d.revenue)}</span></div>
      <div className="text-slate-400">Profit: <span className="text-emerald-400">{fmtUsd(d.profit)}</span></div>
      <div className="text-slate-400">Orders: <span className="text-white">{d.orders}</span></div>
    </div>
  );
}

function WeeklyTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#14161b] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-white font-medium mb-1">{d.label}</div>
      <div className="text-slate-400">Profit: <span className="text-emerald-400">{fmtUsd(d.profit)}</span></div>
      <div className="text-slate-400">Revenue: <span className="text-white">{fmtUsd(d.revenue)}</span></div>
      <div className="text-slate-400">Orders: <span className="text-white">{d.orders}</span></div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main dashboard
// ─────────────────────────────────────────────────────────────
function Dashboard({ token, onLogout }) {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // transactions table
  const [txns, setTxns] = useState(null);
  const [txnFilters, setTxnFilters] = useState({ group: 'sale', category: '', status: '', search: '' });
  const [txnPage, setTxnPage] = useState(1);
  const [txnLoading, setTxnLoading] = useState(false);
  const searchTimer = useRef(null);

  const authFetch = useCallback(async (path) => {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { onLogout(); throw new Error('Session expired — please log in again'); }
    return res;
  }, [token, onLogout]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`/overview?range=${range}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, range]);

  const loadTxns = useCallback(async () => {
    setTxnLoading(true);
    try {
      const q = new URLSearchParams({
        range, page: String(txnPage), limit: '25',
        group: txnFilters.group, category: txnFilters.category,
        status: txnFilters.status, search: txnFilters.search,
      });
      const res = await authFetch(`/transactions?${q.toString()}`);
      const json = await res.json();
      if (res.ok) setTxns(json);
    } catch (err) { /* handled by overview */ }
    finally { setTxnLoading(false); }
  }, [authFetch, range, txnPage, txnFilters]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadTxns(); }, [loadTxns]);

  // auto refresh every 60s
  useEffect(() => {
    const id = setInterval(() => { loadOverview(); loadTxns(); }, 60000);
    return () => clearInterval(id);
  }, [loadOverview, loadTxns]);

  const onSearchChange = (v) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setTxnPage(1);
      setTxnFilters((f) => ({ ...f, search: v }));
    }, 400);
  };

  const exportCsv = async () => {
    try {
      const q = new URLSearchParams({
        range, group: txnFilters.group, category: txnFilters.category,
        status: txnFilters.status, search: txnFilters.search,
      });
      const res = await authFetch(`/export.csv?${q.toString()}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nomadly-sales-${range}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) { /* noop */ }
  };

  const summary = data?.summary;
  const deltas = data?.deltas;
  const maxCatRev = data?.byCategory?.length ? Math.max(...data.byCategory.map((c) => c.revenue)) : 0;

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur bg-[#0a0b0d]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-semibold leading-tight">Sales &amp; Profit</h1>
              <p className="text-slate-500 text-xs leading-tight">Nomadly Bot Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/5 transition hidden sm:block">Admin Home</a>
            <button onClick={() => { loadOverview(); loadTxns(); }} data-testid="sales-refresh-btn"
              className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={onLogout} data-testid="sales-logout-btn"
              className="inline-flex items-center gap-1.5 text-slate-300 hover:text-rose-300 text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/10 transition">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Range selector */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="inline-flex bg-white/5 border border-white/10 rounded-xl p-1" data-testid="sales-range-selector">
            {RANGES.map((r) => (
              <button key={r.k} onClick={() => setRange(r.k)} data-testid={`range-${r.k}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${range === r.k ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'}`}>
                {r.label}
              </button>
            ))}
          </div>
          {lastUpdated && (
            <span className="text-slate-500 text-xs">Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl px-4 py-3 text-sm" data-testid="sales-error">{error}</div>
        )}

        {loading && !data ? (
          <div className="text-slate-400 py-20 text-center">Loading sales data…</div>
        ) : summary ? (
          <>
            {/* Primary KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="sales-kpis">
              <Kpi icon={DollarSign} label="Gross Revenue" value={fmtUsd(summary.grossRevenue)} accent="emerald" delta={deltas?.grossRevenue} sub="vs prev" testid="kpi-revenue" />
              <Kpi icon={PiggyBank} label="Net Profit" value={fmtUsd(summary.netProfit)} accent="sky" delta={deltas?.netProfit} sub="vs prev" testid="kpi-profit" />
              <Kpi icon={CalendarDays} label="This Week's Profit" value={fmtUsd(summary.thisWeekProfit)} accent="violet" sub="current week" testid="kpi-weekprofit" />
              <Kpi icon={ShoppingCart} label="Orders" value={fmtNum(summary.orders)} accent="amber" delta={deltas?.orders} sub={`AOV ${fmtUsd(summary.avgOrderValue)}`} testid="kpi-orders" />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Kpi icon={Wallet} label="Wallet Deposits" value={fmtUsd(summary.deposits)} accent="slate" sub="funded (not sales)" testid="kpi-deposits" />
              <Kpi icon={Gift} label="Bonuses Given" value={fmtUsd(summary.bonuses)} accent="slate" sub="welcome + credits" testid="kpi-bonuses" />
              <Kpi icon={Receipt} label="Refunds" value={fmtUsd(summary.refunds)} accent="rose" sub="returned to users" testid="kpi-refunds" />
            </div>

            {/* Revenue vs Profit chart */}
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 sm:p-5" data-testid="sales-timeseries">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" /> Revenue &amp; Profit</h2>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Revenue</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Profit</span>
                </div>
              </div>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <AreaChart data={data.timeseries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(d) => (d || '').slice(5)} minTickGap={24} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" stroke="#34d399" strokeWidth={2} fill="url(#gRev)" />
                    <Area type="monotone" dataKey="profit" stroke="#38bdf8" strokeWidth={2} fill="url(#gProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Weekly Profit chart */}
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 sm:p-5" data-testid="sales-weekly">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-400" /> Weekly Profit</h2>
                <span className="text-xs text-slate-500">Total profit per week</span>
              </div>
              {data.weekly && data.weekly.length ? (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.weekly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} minTickGap={12} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} axisLine={false} tickLine={false} width={48} />
                      <Tooltip cursor={{ fill: '#ffffff08' }} content={<WeeklyTooltip />} />
                      <Bar dataKey="profit" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-slate-500 text-sm py-10 text-center">No weekly data in this period.</div>
              )}
            </div>

            {/* Category breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 bg-white/[0.04] border border-white/10 rounded-2xl p-4 sm:p-5" data-testid="sales-by-category">
                <h2 className="font-semibold flex items-center gap-2 mb-4"><Layers className="w-4 h-4 text-violet-400" /> Profit by Category</h2>
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.byCategory} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="category" tick={{ fill: '#cbd5e1', fontSize: 12 }} width={100} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#ffffff08' }} content={<CategoryTooltip />} />
                      <Bar dataKey="profit" radius={[0, 4, 4, 0]} barSize={18}>
                        {data.byCategory.map((c) => <Cell key={c.category} fill={colorFor(c.category)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-2 bg-white/[0.04] border border-white/10 rounded-2xl p-4 sm:p-5 overflow-hidden">
                <h2 className="font-semibold mb-3">Category Detail</h2>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs border-b border-white/10">
                        <th className="text-left font-medium py-2 px-1">Category</th>
                        <th className="text-right font-medium py-2 px-1">Revenue</th>
                        <th className="text-right font-medium py-2 px-1">Profit</th>
                        <th className="text-right font-medium py-2 px-1">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byCategory.map((c) => (
                        <tr key={c.category} className="border-b border-white/5 last:border-0">
                          <td className="py-2 px-1">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ background: colorFor(c.category) }} />
                              {c.category}
                            </span>
                          </td>
                          <td className="text-right tabular-nums py-2 px-1">{fmtUsd0(c.revenue)}</td>
                          <td className="text-right tabular-nums py-2 px-1 text-emerald-400">{fmtUsd0(c.profit)}</td>
                          <td className="text-right tabular-nums py-2 px-1 text-slate-400">{c.orders}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Top products + customers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 sm:p-5" data-testid="sales-top-products">
                <h2 className="font-semibold flex items-center gap-2 mb-3"><Package className="w-4 h-4 text-amber-400" /> Top Products</h2>
                <div className="space-y-1">
                  {(data.topProducts || []).map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                      <div className="min-w-0">
                        <div className="truncate text-sm">{p.product}</div>
                        <div className="text-xs text-slate-500">{p.category} · {p.orders} orders</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm tabular-nums">{fmtUsd(p.revenue)}</div>
                        <div className="text-xs text-emerald-400 tabular-nums">+{fmtUsd(p.profit)}</div>
                      </div>
                    </div>
                  ))}
                  {(!data.topProducts || !data.topProducts.length) && <div className="text-slate-500 text-sm py-4">No sales in this period.</div>}
                </div>
              </div>

              <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 sm:p-5" data-testid="sales-top-customers">
                <h2 className="font-semibold flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-sky-400" /> Top Customers</h2>
                <div className="space-y-1">
                  {(data.topCustomers || []).map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-white/5 text-xs flex items-center justify-center text-slate-400 shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <div className="truncate text-sm">{c.name || `User ${c.chatId}`}</div>
                          <div className="text-xs text-slate-500">{c.orders} orders</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm tabular-nums">{fmtUsd(c.revenue)}</div>
                        <div className="text-xs text-emerald-400 tabular-nums">+{fmtUsd(c.profit)}</div>
                      </div>
                    </div>
                  ))}
                  {(!data.topCustomers || !data.topCustomers.length) && <div className="text-slate-500 text-sm py-4">No customers in this period.</div>}
                </div>
              </div>
            </div>

            {/* Transactions table */}
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 sm:p-5" data-testid="sales-transactions">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <h2 className="font-semibold flex items-center gap-2"><Receipt className="w-4 h-4 text-emerald-400" /> Transactions</h2>
                <button onClick={exportCsv} data-testid="sales-export-btn"
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition">
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>

              {/* filters */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input placeholder="Search id, user, product…" data-testid="txn-search"
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm w-56 focus:outline-none focus:border-emerald-500/60" />
                </div>
                <select value={txnFilters.group} data-testid="txn-group"
                  onChange={(e) => { setTxnPage(1); setTxnFilters((f) => ({ ...f, group: e.target.value })); }}
                  className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-emerald-500/60">
                  <option value="">All types</option>
                  <option value="sale">Sales</option>
                  <option value="deposit">Deposits</option>
                  <option value="bonus">Bonuses</option>
                  <option value="refund">Refunds</option>
                  <option value="adjustment">Adjustments</option>
                </select>
                <select value={txnFilters.category} data-testid="txn-category"
                  onChange={(e) => { setTxnPage(1); setTxnFilters((f) => ({ ...f, category: e.target.value })); }}
                  className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-emerald-500/60">
                  <option value="">All categories</option>
                  {(data.byCategory || []).map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="text-slate-500 text-xs border-b border-white/10">
                      <th className="text-left font-medium py-2 px-2">Transaction</th>
                      <th className="text-left font-medium py-2 px-2">Date</th>
                      <th className="text-left font-medium py-2 px-2">Category</th>
                      <th className="text-left font-medium py-2 px-2">Product</th>
                      <th className="text-right font-medium py-2 px-2">Amount</th>
                      <th className="text-right font-medium py-2 px-2">Profit</th>
                      <th className="text-left font-medium py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className={txnLoading ? 'opacity-50' : ''}>
                    {(txns?.rows || []).map((r) => (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-2 px-2 font-mono text-xs text-slate-300">{r.id}</td>
                        <td className="py-2 px-2 text-slate-400 whitespace-nowrap">{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td>
                        <td className="py-2 px-2">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: colorFor(r.category) }} />
                            {r.category}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-300 max-w-[200px] truncate">{r.product}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{fmtUsd(r.amountUsd)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-emerald-400">{r.group === 'sale' ? fmtUsd(r.profit) : '—'}</td>
                        <td className="py-2 px-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : r.status === 'refunded' || r.status === 'reversed' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-500/10 text-slate-400'}`}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                    {txns && !txns.rows.length && (
                      <tr><td colSpan={7} className="text-center text-slate-500 py-8">No transactions match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* pagination */}
              {txns && txns.pages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm">
                  <span className="text-slate-500">{fmtNum(txns.total)} transactions · page {txns.page}/{txns.pages}</span>
                  <div className="flex items-center gap-2">
                    <button disabled={txnPage <= 1} onClick={() => setTxnPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition">Prev</button>
                    <button disabled={txnPage >= txns.pages} onClick={() => setTxnPage((p) => p + 1)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition">Next</button>
                  </div>
                </div>
              )}
            </div>

            {/* assumptions footnote */}
            <div className="pb-6" />
          </>
        ) : null}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
export default function SalesDashboard() {
  const [token, setToken] = useState(() => localStorage.getItem('salesToken'));
  const logout = () => { localStorage.removeItem('salesToken'); setToken(null); };
  if (!token) return <Login onLogin={setToken} />;
  return <Dashboard token={token} onLogout={logout} />;
}
