import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { StoreProvider, useStore } from '../components/store/StoreContext';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const BACKEND = process.env.REACT_APP_BACKEND_URL || '';
const COIN_OPTS = [
  ['USDT-TRC20', 'USDT (TRC20)'], ['BTC', 'Bitcoin'], ['ETH', 'Ethereum'], ['LTC', 'Litecoin'],
  ['DOGE', 'Dogecoin'], ['USDT-ERC20', 'USDT (ERC20)'], ['BCH', 'Bitcoin Cash'], ['TRX', 'TRON'],
];

/* Shared crypto payment box — polls the public order endpoint until provisioned */
function CryptoPayBox({ order, onProvisioned }) {
  const [status, setStatus] = useState('pending');
  const [creds, setCreds] = useState(null);
  useEffect(() => {
    let iv; let done = false;
    const poll = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/store/order/${order.orderId}`).then(x => x.json());
        if (done || !r) return;
        setStatus(r.status);
        if (r.status === 'provisioned') { done = true; clearInterval(iv); setCreds(r); onProvisioned && onProvisioned(r); }
        if (r.status === 'failed') { done = true; clearInterval(iv); setStatus('failed'); }
      } catch { /* keep polling */ }
    };
    poll(); iv = setInterval(() => { if (!done) poll(); }, 6000);
    return () => { done = true; clearInterval(iv); };
  }, [order.orderId, onProvisioned]);

  if (creds) {
    return (
      <div className="store-success" data-testid="store-crypto-provisioned">
        <h2>🎉 Payment received — your hosting is ready!</h2>
        <p>Domain: <b>{creds.domain}</b></p>
        <div className="store-creds">
          <div><span>HostPanel Username</span><code data-testid="store-cred-user">{creds.username}</code></div>
          <div><span>HostPanel PIN</span><code data-testid="store-cred-pin">{creds.pin}</code></div>
        </div>
        <p className="store-muted">These were also emailed to you. Log in anytime with your username + PIN.</p>
        {creds.nameservers?.length > 0 && <p className="store-muted">Point your domain nameservers to: {creds.nameservers.join(', ')}</p>}
        <a className="store-btn store-btn--primary" href="/panel" data-testid="store-crypto-open-panel">Go to HostPanel →</a>
      </div>
    );
  }
  return (
    <div className="store-topup-box" data-testid="store-crypto-pending">
      <p>Send <b>{order.coin}</b> worth <b>{money(order.amountUsd)}</b> to this address:</p>
      <div className="store-qr" data-testid="store-crypto-qr"><QRCode value={String(order.address || '')} size={148} bgColor="#ffffff" fgColor="#0b0e14" /></div>
      <code className="store-addr" data-testid="store-crypto-address">{order.address}</code>
      <p className="store-muted">{status === 'failed' ? '⚠️ Payment issue — contact support.' : 'Waiting for blockchain confirmation… this updates automatically. Keep this page open.'}</p>
    </div>
  );
}

/* Guest "Buy now" modal — no account needed */
function GuestBuyModal({ plan, onClose }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [domainMode, setDomainMode] = useState('byo');
  const [coin, setCoin] = useState('USDT-TRC20');
  const [search, setSearch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);

  const doSearch = async () => {
    if (!domain.trim()) return;
    setSearch(null); setError('');
    try { setSearch(await fetch(`${BACKEND}/api/store/domain/search?domain=${encodeURIComponent(domain.trim())}`).then(r => r.json())); }
    catch (e) { setError(e.message); }
  };
  const total = plan.priceUsd + (domainMode === 'buy' && search?.available ? Number(search.priceUsd) : 0);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const r = await fetch(`${BACKEND}/api/store/guest/checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, domain: domain.trim().toLowerCase(), domainMode, email: email.trim().toLowerCase(), coin }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Checkout failed');
      setOrder(d);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="store-modal-overlay" onClick={onClose} data-testid="store-guest-modal">
      <div className="store-modal" onClick={e => e.stopPropagation()}>
        <button className="store-modal-x" onClick={onClose} data-testid="store-guest-close">×</button>
        <h2>Buy {plan.name}</h2>
        <div className="store-total" data-testid="store-guest-total">Total: <b>{money(total)}</b></div>
        {order ? <CryptoPayBox order={order} /> : (
          <>
            {error && <div className="store-error" data-testid="store-guest-error">{error}</div>}
            <label className="store-label">{t('store.guestEmailLabel')}</label>
            <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} data-testid="store-guest-email" />
            <label className="store-label">Domain</label>
            <div className="store-domain-mode">
              <label><input type="radio" checked={domainMode === 'byo'} onChange={() => { setDomainMode('byo'); setSearch(null); }} data-testid="store-guest-byo" /> {t('store.ownDomain')}</label>
              <label><input type="radio" checked={domainMode === 'buy'} onChange={() => setDomainMode('buy')} data-testid="store-guest-buy" /> {t('store.buyDomain')}</label>
            </div>
            <div className="store-domain-row">
              <input type="text" placeholder="mysite.com" value={domain} onChange={e => setDomain(e.target.value)} data-testid="store-guest-domain" />
              {domainMode === 'buy' && <button className="store-btn" onClick={doSearch} data-testid="store-guest-check">Check</button>}
            </div>
            {domainMode === 'buy' && search && <div className={`store-domain-result ${search.available ? 'ok' : 'no'}`}>{search.available ? `✓ ${search.domain} — ${money(search.priceUsd)}` : `✕ ${search.message || 'Not available'}`}</div>}
            <label className="store-label">{t('store.payWith')}</label>
            <select value={coin} onChange={e => setCoin(e.target.value)} data-testid="store-guest-coin">
              {COIN_OPTS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
            <button className="store-btn store-btn--primary" disabled={busy || !email.trim() || !domain.trim() || (domainMode === 'buy' && !search?.available)} onClick={submit} data-testid="store-guest-submit">
              {busy ? 'Creating order…' : `Pay ${money(total)} with crypto →`}
            </button>
            <p className="store-muted">{t('store.guestNote')}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function Storefront() {
  return (
    <StoreProvider>
      <StoreInner />
    </StoreProvider>
  );
}

function StoreInner() {
  const { user } = useStore();
  const [plans, setPlans] = useState([]);
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/store/plans`).then(r => r.json()).then(d => setPlans(d.plans || [])).catch(() => {});
  }, [BACKEND_URL]);

  return (
    <div className="store-root" data-testid="storefront">
      {user ? <Dashboard plans={plans} /> : <AuthGate plans={plans} />}
    </div>
  );
}

/* ─────────────── Not logged in: showcase + auth ─────────────── */
function AuthGate({ plans }) {
  const { login, signup } = useStore();
  const { t } = useTranslation();
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [buyPlan, setBuyPlan] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (mode === 'signup') await signup(email.trim().toLowerCase(), password);
      else await login(email.trim().toLowerCase(), password);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="store-landing">
      <header className="store-top">
        <div className="store-brand"><span className="store-logo">H</span> HostBay <span className="store-sub">Anti-Red Hosting</span></div>
        <div className="store-top-right"><LanguageSwitcher /><a className="store-link" href="/panel" data-testid="store-existing-login">{t('store.panelLogin')}</a></div>
      </header>

      <section className="store-hero">
        <h1>{t('store.heroTitle')}</h1>
        <p>{t('store.tagline')}</p>
      </section>

      <section className="store-plan-grid" data-testid="store-plans">
        {plans.map(p => (
          <div key={p.id} className={`store-plan-card ${p.tier === 'gold' ? 'store-plan-card--gold' : ''}`} data-testid={`store-plan-${p.id}`}>
            <div className="store-plan-name">{p.name}</div>
            <div className="store-plan-price">{money(p.priceUsd)}<span>/{p.durationDays === 7 ? 'wk' : 'mo'}</span></div>
            <ul className="store-plan-feats">{(p.features || []).map((f, i) => <li key={i}>✓ {f}</li>)}</ul>
            <button className="store-btn store-btn--primary" onClick={() => setBuyPlan(p)} data-testid={`store-buynow-${p.id}`}>{t('store.buyNow')}</button>
          </div>
        ))}
      </section>

      {buyPlan && <GuestBuyModal plan={buyPlan} onClose={() => setBuyPlan(null)} />}

      <section className="store-auth-card" data-testid="store-auth-card">
        <div className="store-auth-tabs">
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')} data-testid="store-tab-signup">{t('store.createAccount')}</button>
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} data-testid="store-tab-login">{t('store.login')}</button>
        </div>
        <form onSubmit={submit}>
          {error && <div className="store-error" data-testid="store-auth-error">{error}</div>}
          <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} required data-testid="store-email" />
          <input type="password" placeholder="Password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} required data-testid="store-password" />
          <button type="submit" className="store-btn store-btn--primary" disabled={busy} data-testid="store-auth-submit">
            {busy ? t('store.pleaseWait') : (mode === 'signup' ? t('store.createBtn') : t('store.loginBtn'))}
          </button>
        </form>
      </section>
    </div>
  );
}

/* ─────────────── Logged in: dashboard ─────────────── */
function Dashboard({ plans }) {
  const { user, logout } = useStore();
  const { t } = useTranslation();
  const [tab, setTab] = useState('buy');

  return (
    <div className="store-dash">
      <header className="store-top">
        <div className="store-brand"><span className="store-logo">H</span> HostBay</div>
        <div className="store-top-right">
          <LanguageSwitcher />
          <span className="store-wallet-pill" data-testid="store-wallet-balance">{t('store.walletLabel')} {money(user.walletUsd)}</span>
          <span className="store-email">{user.email}</span>
          <button className="store-link" onClick={logout} data-testid="store-logout">{t('store.logout')}</button>
        </div>
      </header>

      <nav className="store-tabs" data-testid="store-tabs">
        <button className={tab === 'buy' ? 'active' : ''} onClick={() => setTab('buy')} data-testid="store-tab-buy">{t('store.tabBuy')}</button>
        <button className={tab === 'wallet' ? 'active' : ''} onClick={() => setTab('wallet')} data-testid="store-tab-wallet">{t('store.tabWallet')}</button>
        <button className={tab === 'plans' ? 'active' : ''} onClick={() => setTab('plans')} data-testid="store-tab-plans">{t('store.tabPlans')}</button>
      </nav>

      <main className="store-main">
        {tab === 'buy' && <BuyTab plans={plans} goWallet={() => setTab('wallet')} goPlans={() => setTab('plans')} />}
        {tab === 'wallet' && <WalletTab />}
        {tab === 'plans' && <PlansTab />}
      </main>
    </div>
  );
}

function openPanel(api, cpUser, setBusy, setError) {
  setBusy(true); setError('');
  api('/open-panel', { method: 'POST', body: JSON.stringify({ cpUser }) })
    .then(r => {
      const session = { token: r.token, username: r.cpUser, domain: r.domain, isGold: false, plan: '' };
      sessionStorage.setItem('panel_session', JSON.stringify(session));
      window.location.href = '/panel';
    })
    .catch(err => { setError(err.message); setBusy(false); });
}

/* ── Buy Hosting ── */
function BuyTab({ plans, goWallet, goPlans }) {
  const { api, setWallet } = useStore();
  const [planId, setPlanId] = useState(plans[0]?.id || '');
  const [domain, setDomain] = useState('');
  const [domainMode, setDomainMode] = useState('byo');
  const [search, setSearch] = useState(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [openBusy, setOpenBusy] = useState(false);
  const [payMethod, setPayMethod] = useState('wallet');
  const [coin, setCoin] = useState('USDT-TRC20');
  const [cryptoOrder, setCryptoOrder] = useState(null);

  useEffect(() => { if (!planId && plans[0]) setPlanId(plans[0].id); }, [plans, planId]);
  const plan = plans.find(p => p.id === planId);

  const doSearch = async () => {
    if (!domain.trim()) return;
    setSearching(true); setSearch(null); setError('');
    try { setSearch(await api(`/domain/search?domain=${encodeURIComponent(domain.trim())}`)); }
    catch (err) { setError(err.message); } finally { setSearching(false); }
  };

  const total = (plan?.priceUsd || 0) + (domainMode === 'buy' && search?.available ? Number(search.priceUsd) : 0);

  const buy = async () => {
    setBusy(true); setError(''); setResult(null);
    try {
      if (payMethod === 'crypto') {
        const r = await api('/hosting/pay-crypto', { method: 'POST', body: JSON.stringify({ planId, domain: domain.trim().toLowerCase(), domainMode, coin }) });
        setCryptoOrder(r);
      } else {
        const r = await api('/hosting/purchase', { method: 'POST', body: JSON.stringify({ planId, domain: domain.trim().toLowerCase(), domainMode }) });
        if (r.success) { setResult(r); if (typeof r.balanceUsd === 'number') setWallet(r.balanceUsd); }
      }
    } catch (err) {
      if (err.status === 402) setError(`${err.message}`);
      else setError(err.message);
    } finally { setBusy(false); }
  };

  if (cryptoOrder) {
    return (
      <div className="store-card" data-testid="store-buy-crypto">
        <h2>Pay with crypto</h2>
        <p className="store-muted">Plan: <b>{cryptoOrder.plan}</b> · Domain: <b>{cryptoOrder.domain}</b></p>
        <CryptoPayBox order={cryptoOrder} onProvisioned={() => {}} />
      </div>
    );
  }

  if (result) {
    return (
      <div className="store-card store-success" data-testid="store-purchase-success">
        <h2>🎉 Your hosting is being set up!</h2>
        <p>Domain: <b>{result.domain}</b> · Plan: <b>{result.plan}</b></p>
        <div className="store-creds">
          <div><span>HostPanel Username</span><code data-testid="store-cred-user">{result.username}</code></div>
          <div><span>HostPanel PIN</span><code data-testid="store-cred-pin">{result.pin}</code></div>
        </div>
        <p className="store-muted">These were also emailed to you. Use them to log into the panel anytime.</p>
        {result.nameservers?.length > 0 && (
          <p className="store-muted">Point your domain nameservers to: {result.nameservers.join(', ')}</p>
        )}
        <button className="store-btn store-btn--primary" disabled={openBusy} onClick={() => openPanel(api, result.username, setOpenBusy, setError)} data-testid="store-open-panel-success">
          {openBusy ? 'Opening…' : 'Open HostPanel →'}
        </button>
        <button className="store-btn" onClick={goPlans}>View My Plans</button>
        {error && <div className="store-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="store-card" data-testid="store-buy">
      <h2>Buy a Hosting Plan</h2>
      {error && (
        <div className="store-error" data-testid="store-buy-error">
          {error} {error.includes('top up') && <button className="store-link" onClick={goWallet} data-testid="store-goto-wallet">Top up wallet →</button>}
        </div>
      )}

      <label className="store-label">Plan</label>
      <div className="store-plan-pick">
        {plans.map(p => (
          <button key={p.id} className={`store-pick ${planId === p.id ? 'store-pick--active' : ''}`} onClick={() => setPlanId(p.id)} data-testid={`store-pick-${p.id}`}>
            <span>{p.name}</span><b>{money(p.priceUsd)}</b>
          </button>
        ))}
      </div>

      <label className="store-label">Domain</label>
      <div className="store-domain-mode">
        <label><input type="radio" checked={domainMode === 'byo'} onChange={() => { setDomainMode('byo'); setSearch(null); }} data-testid="store-domain-byo" /> I already own a domain</label>
        <label><input type="radio" checked={domainMode === 'buy'} onChange={() => setDomainMode('buy')} data-testid="store-domain-buy" /> Buy a new domain</label>
      </div>
      <div className="store-domain-row">
        <input type="text" placeholder="mysite.com" value={domain} onChange={e => setDomain(e.target.value)} data-testid="store-domain-input" />
        {domainMode === 'buy' && <button className="store-btn" onClick={doSearch} disabled={searching} data-testid="store-domain-check">{searching ? 'Checking…' : 'Check'}</button>}
      </div>
      {domainMode === 'buy' && search && (
        <div className={`store-domain-result ${search.available ? 'ok' : 'no'}`} data-testid="store-domain-result">
          {search.available ? `✓ ${search.domain} is available — ${money(search.priceUsd)}` : `✕ ${search.message || 'Not available'}`}
        </div>
      )}

      <div className="store-total" data-testid="store-total">Total: <b>{money(total)}</b> {domainMode === 'buy' && search?.available ? `(plan ${money(plan?.priceUsd)} + domain ${money(search.priceUsd)})` : ''}</div>

      <label className="store-label">Payment method</label>
      <div className="store-domain-mode">
        <label><input type="radio" checked={payMethod === 'wallet'} onChange={() => setPayMethod('wallet')} data-testid="store-pay-wallet" /> Pay from wallet</label>
        <label><input type="radio" checked={payMethod === 'crypto'} onChange={() => setPayMethod('crypto')} data-testid="store-pay-crypto" /> Pay with crypto directly</label>
      </div>
      {payMethod === 'crypto' && (
        <select value={coin} onChange={e => setCoin(e.target.value)} data-testid="store-pay-coin" style={{ marginBottom: 8 }}>
          {COIN_OPTS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
      )}

      <button
        className="store-btn store-btn--primary"
        onClick={buy}
        disabled={busy || !planId || !domain.trim() || (domainMode === 'buy' && !search?.available)}
        data-testid="store-buy-submit"
      >
        {busy ? 'Processing…' : (payMethod === 'crypto' ? `Pay ${money(total)} with crypto →` : `Pay ${money(total)} from wallet →`)}
      </button>
    </div>
  );
}

/* ── Wallet + crypto top-up ── */
function WalletTab() {
  const { api, setWallet } = useStore();
  const [wallet, setW] = useState(null);
  const [coin, setCoin] = useState('USDT-TRC20');
  const [amount, setAmount] = useState('25');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [topup, setTopup] = useState(null);

  const load = useCallback(async () => {
    try { const w = await api('/wallet'); setW(w); if (typeof w.balanceUsd === 'number') setWallet(w.balanceUsd); }
    catch (err) { setError(err.message); }
  }, [api, setWallet]);

  useEffect(() => { load(); }, [load]);

  const minFor = (c) => (wallet?.coins || []).find(x => x.code === c)?.min || 10;

  const startTopup = async () => {
    setBusy(true); setError(''); setTopup(null);
    try {
      const r = await api('/wallet/topup', { method: 'POST', body: JSON.stringify({ amountUsd: Number(amount), coin }) });
      setTopup(r);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  // Poll the active top-up until credited
  useEffect(() => {
    if (!topup?.orderId || topup.status === 'credited') return;
    const iv = setInterval(async () => {
      try {
        const s = await api(`/wallet/topup/${topup.orderId}`);
        if (s.status === 'credited') { setTopup(t => ({ ...t, status: 'credited' })); if (typeof s.balanceUsd === 'number') setWallet(s.balanceUsd); load(); clearInterval(iv); }
      } catch { /* keep polling */ }
    }, 6000);
    return () => clearInterval(iv);
  }, [topup, api, setWallet, load]);

  return (
    <div className="store-card" data-testid="store-wallet">
      <div className="store-wallet-head">
        <div>Balance</div>
        <div className="store-bigbal" data-testid="store-wallet-bigbal">{money(wallet?.balanceUsd)}</div>
      </div>
      {error && <div className="store-error">{error}</div>}

      <h3>Top up with crypto</h3>
      <div className="store-topup-row">
        <select value={coin} onChange={e => setCoin(e.target.value)} data-testid="store-topup-coin">
          {(wallet?.coins || []).map(c => <option key={c.code} value={c.code}>{c.name} (min ${c.min})</option>)}
        </select>
        <input type="number" min={minFor(coin)} value={amount} onChange={e => setAmount(e.target.value)} data-testid="store-topup-amount" />
        <button className="store-btn store-btn--primary" onClick={startTopup} disabled={busy} data-testid="store-topup-submit">
          {busy ? 'Creating…' : 'Get deposit address'}
        </button>
      </div>
      <div className="store-muted">Minimum {money(minFor(coin))} for {coin}.</div>

      {topup && (
        <div className="store-topup-box" data-testid="store-topup-box">
          {topup.status === 'credited' ? (
            <div className="store-success-inline" data-testid="store-topup-credited">✓ Payment received — wallet credited!</div>
          ) : (
            <>
              <p>Send <b>{coin}</b> worth <b>{money(topup.amountUsd)}</b> to:</p>
              <div className="store-qr" data-testid="store-topup-qr"><QRCode value={String(topup.address || '')} size={148} bgColor="#ffffff" fgColor="#0b0e14" /></div>
              <code className="store-addr" data-testid="store-topup-address">{topup.address}</code>
              <p className="store-muted">Waiting for payment confirmation… this updates automatically.</p>
            </>
          )}
        </div>
      )}

      <h3>Recent activity</h3>
      <div className="store-txns" data-testid="store-txns">
        {(wallet?.txns || []).length === 0 && <div className="store-muted">No transactions yet.</div>}
        {(wallet?.txns || []).map(t => (
          <div key={t.id} className="store-txn">
            <span>{t.note || t.type}</span>
            <b className={t.amountUsd >= 0 ? 'pos' : 'neg'}>{t.amountUsd >= 0 ? '+' : ''}{money(t.amountUsd)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── My Plans ── */
function PlansTab() {
  const { api } = useStore();
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState('');
  const [openBusy, setOpenBusy] = useState('');

  useEffect(() => { api('/my-plans').then(d => setPlans(d.plans || [])).catch(e => setError(e.message)); }, [api]);

  return (
    <div className="store-card" data-testid="store-myplans">
      <h2>My Hosting Plans</h2>
      {error && <div className="store-error">{error}</div>}
      {plans === null ? <div className="store-muted">Loading…</div> :
        plans.length === 0 ? <div className="store-muted">No plans yet — buy one from the “Buy Hosting” tab.</div> :
        plans.map(p => (
          <div key={p.cpUser} className="store-myplan" data-testid={`store-myplan-${p.domain}`}>
            <div>
              <div className="store-myplan-domain">{p.domain}</div>
              <div className="store-muted">{p.plan} · {p.addonCount} addon(s){p.suspended ? ' · SUSPENDED' : ''}</div>
            </div>
            <button
              className="store-btn store-btn--primary"
              disabled={openBusy === p.cpUser}
              onClick={() => { setOpenBusy(p.cpUser); openPanel(api, p.cpUser, () => {}, setError); }}
              data-testid={`store-open-${p.domain}`}
            >
              {openBusy === p.cpUser ? 'Opening…' : 'Open Panel →'}
            </button>
          </div>
        ))}
    </div>
  );
}
