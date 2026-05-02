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
    // We use XMLHttpRequest here (instead of fetch) because some preview/host
    // environments wrap window.fetch for telemetry and consume the response
    // body before our code can read it — leaving us with a "body stream already
    // read" failure that masks the server's actual error/rate-limit payload.
    const data = await new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BACKEND_URL}/api/panel/login`, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = () => {
          let body = {};
          try { body = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch (_) { /* leave as {} */ }
          resolve({ status: xhr.status, body });
        };
        xhr.onerror = () => reject(new Error('Network error — could not reach server'));
        xhr.ontimeout = () => reject(new Error('Request timed out'));
        xhr.send(JSON.stringify({ username, pin }));
      } catch (e) {
        reject(e);
      }
    });
    const { status, body } = data;
    if (status < 200 || status >= 300) {
      const err = new Error(body.error || `Login failed (${status})`);
      if (status === 429 || body.rateLimited) {
        err.rateLimited = true;
        err.lockedSeconds = body.lockedSeconds;
        err.lockedMinutes = body.lockedMinutes;
        err.lockedUntil = body.lockedUntil;
      }
      if (typeof body.attemptsRemaining === 'number') {
        err.attemptsRemaining = body.attemptsRemaining;
      }
      throw err;
    }
    const session = { token: body.token, username: body.username, domain: body.domain };
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
