import React, { createContext, useContext, useState, useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const StoreContext = createContext(null);

export function useStore() {
  return useContext(StoreContext);
}

export function StoreProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('store_session');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const persist = useCallback((session) => {
    if (session) localStorage.setItem('store_session', JSON.stringify(session));
    else localStorage.removeItem('store_session');
    setUser(session);
  }, []);

  const api = useCallback(async (path, options = {}) => {
    const token = (() => { try { return JSON.parse(localStorage.getItem('store_session') || '{}').token; } catch { return null; } })();
    const res = await fetch(`${BACKEND_URL}/api/store${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    let data = {};
    try { data = await res.json(); } catch { /* noop */ }
    if (res.status === 401 && token) { persist(null); }
    if (!res.ok) {
      const err = new Error(data.error || data.message || `Request failed (${res.status})`);
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  }, [persist]);

  const signup = useCallback(async (email, password) => {
    const r = await api('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
    persist({
      token: r.token, email: r.user.email, walletUsd: r.user.walletUsd,
      tgChatId: r.user.tgChatId || null, tgDisplay: r.user.tgDisplay || '', tgLinked: !!r.user.tgLinked,
    });
    return r;
  }, [api, persist]);

  const login = useCallback(async (email, password) => {
    const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    persist({
      token: r.token, email: r.user.email, walletUsd: r.user.walletUsd,
      tgChatId: r.user.tgChatId || null, tgDisplay: r.user.tgDisplay || '', tgLinked: !!r.user.tgLinked,
    });
    return r;
  }, [api, persist]);

  // Exchange a bot-issued auto-login token (?bt=…) for a web session.
  const botLogin = useCallback(async (bt) => {
    const r = await api('/auth/bot-login', { method: 'POST', body: JSON.stringify({ bt }) });
    persist({
      token: r.token,
      email: r.user.email,
      walletUsd: r.user.walletUsd,
      tgChatId: r.user.tgChatId || null,
      tgDisplay: r.user.tgDisplay || '',
      tgLinked: !!r.user.tgLinked,
    });
    return r;
  }, [api, persist]);

  const logout = useCallback(() => persist(null), [persist]);

  const setWallet = useCallback((walletUsd) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, walletUsd };
      localStorage.setItem('store_session', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <StoreContext.Provider value={{ user, api, signup, login, botLogin, logout, setWallet }}>
      {children}
    </StoreContext.Provider>
  );
}
