import React, { createContext, useContext, useState, useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('panel_session');
    return saved ? JSON.parse(saved) : null;
  });

  const login = useCallback(async (username, pin) => {
    const res = await fetch(`${BACKEND_URL}/api/panel/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, pin }),
    });
    let data;
    try {
      const text = await res.clone().text();
      data = JSON.parse(text);
    } catch {
      try { data = await res.json(); } catch { data = { error: `Server error (${res.status})` }; }
    }
    if (!res.ok) throw new Error(data.error || 'Login failed');
    const session = { token: data.token, username: data.username, domain: data.domain };
    sessionStorage.setItem('panel_session', JSON.stringify(session));
    setUser(session);
    return session;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('panel_session');
    setUser(null);
  }, []);

  const api = useCallback(async (path, options = {}) => {
    if (!user?.token) throw new Error('Not authenticated');
    const res = await fetch(`${BACKEND_URL}/api/panel${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${user.token}`,
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      },
    });
    if (res.status === 401) {
      logout();
      throw new Error('Session expired');
    }
    // Safely parse JSON — use clone() to avoid "Body is disturbed or locked" errors
    let data;
    try {
      const text = await res.clone().text();
      data = JSON.parse(text);
    } catch (e) {
      try {
        data = await res.json();
      } catch {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        throw new Error('Invalid response from server');
      }
    }
    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed (${res.status})`);
    }
    return data;
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, login, logout, api }}>
      {children}
    </AuthContext.Provider>
  );
}
