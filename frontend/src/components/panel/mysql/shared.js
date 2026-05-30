// Shared icons, constants, helpers and inline styles for the MySQL UI.
// Extracted from the original MysqlManager so the panel can grow without
// recreating these in every sub-file.

import React from 'react';

// ─── SVG icons ────────────────────────────────────────────────
export const SvgPlus = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const SvgTrash = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

export const SvgExternal = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export const SvgKey = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

export const SvgLink = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);

// ─── Constants ────────────────────────────────────────────────
// Common MySQL privileges — same set cPanel offers in "Manage User Privileges".
export const ALL_PRIVS = [
  'ALTER', 'ALTER ROUTINE', 'CREATE', 'CREATE ROUTINE', 'CREATE TEMPORARY TABLES',
  'CREATE VIEW', 'DELETE', 'DROP', 'EVENT', 'EXECUTE', 'INDEX', 'INSERT',
  'LOCK TABLES', 'REFERENCES', 'SELECT', 'SHOW VIEW', 'TRIGGER', 'UPDATE',
];

export const BOT_URL = 'https://t.me/nomadlybot';

// ─── Helpers ──────────────────────────────────────────────────
export function generatePassword(len = 16) {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let pw = '';
  for (let i = 0; i < len; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

// cPanel auto-prefixes DB names and users with `<cpuser>_`. We let the user
// type ONLY the suffix and combine for them — matches cPanel's own UX.
export function prefixed(prefix, name) {
  if (!prefix) return name;
  return name.startsWith(prefix + '_') ? name : `${prefix}_${name}`;
}

// Detect cPanel "you have reached your maximum allowed number of …" errors.
// cPanel returns variants like "You have reached your maximum allowed number of MySQL databases."
// or "...maximum allowed number of MySQL users." — both for plan-quota gating.
export function isQuotaError(msg) {
  if (!msg || typeof msg !== 'string') return false;
  return /reached.{0,40}max|maximum.{0,40}(allowed|number|limit)|exceed.{0,40}(limit|quota|maximum)|limit.{0,20}reach/i.test(msg);
}

export function formatBytes(b) {
  const n = Number(b);
  if (!n || Number.isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ─── Inline styles (matches existing panel look) ──────────────
export const tabBtnStyle = (active) => ({
  background: 'transparent',
  color: active ? 'var(--accent, #6cb6ff)' : 'var(--text, #c7cdd6)',
  border: 'none',
  borderBottom: active ? '2px solid var(--accent, #6cb6ff)' : '2px solid transparent',
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: active ? 600 : 500,
  fontSize: 14,
});
export const inputStyle = {
  background: 'var(--bg-input, #11151c)',
  color: 'var(--text, #fff)',
  border: '1px solid var(--border, #2a2f3a)',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 14,
  outline: 'none',
  width: '100%',
};
export const labelStyle = { display: 'block', fontSize: 12, opacity: 0.75, marginBottom: 4 };
export const hintStyle = { fontSize: 11, opacity: 0.6, marginTop: 6 };
export const prefixBoxStyle = {
  background: 'var(--bg-card, #1a1f2a)',
  border: '1px solid var(--border, #2a2f3a)',
  borderRight: 'none',
  padding: '8px 10px',
  borderTopLeftRadius: 6,
  borderBottomLeftRadius: 6,
  fontSize: 14,
  opacity: 0.7,
  fontFamily: 'ui-monospace, monospace',
  whiteSpace: 'nowrap',
};
export const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
export const modalBox = {
  background: 'var(--bg, #0e1117)', borderRadius: 10, border: '1px solid var(--border, #2a2f3a)',
  width: '100%', maxHeight: '90vh', overflow: 'auto',
};
export const modalHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border, #2a2f3a)' };
export const modalCloseBtn = { background: 'transparent', color: 'inherit', border: 'none', fontSize: 22, cursor: 'pointer', lineHeight: 1 };
export const modalActionsStyle = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 };
export const alertStyle = (bg, fg) => ({ background: bg, color: fg, padding: '10px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 });
export const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
export const tableWrap = { background: 'var(--bg-card, #1a1f2a)', border: '1px solid var(--border, #2a2f3a)', borderRadius: 8, overflow: 'auto' };
export const thStyle = { textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border, #2a2f3a)', fontWeight: 600, opacity: 0.75, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 };
export const tdStyle = { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' };
export const codeStyle = { background: 'var(--bg, #0e1117)', padding: '2px 6px', borderRadius: 4, fontFamily: 'ui-monospace, monospace', fontSize: 12 };
export const chipStyle = { background: 'var(--bg, #0e1117)', border: '1px solid var(--border, #2a2f3a)', padding: '3px 8px', borderRadius: 12, fontSize: 11, cursor: 'pointer', fontFamily: 'ui-monospace, monospace' };
export const chipStyleStatic = { ...chipStyle, cursor: 'default' };
export const iconBtnStyle = { background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 6, marginLeft: 4, opacity: 0.7 };
export const sectionTitleStyle = { fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 };
export const countStyle = { background: 'var(--bg-card, #1a1f2a)', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, opacity: 0.75 };
export const emptyStyle = { padding: 24, textAlign: 'center', background: 'var(--bg-card, #1a1f2a)', border: '1px dashed var(--border, #2a2f3a)', borderRadius: 8, color: 'var(--text, #c7cdd6)' };
export const quotaBannerStyle = {
  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12))',
  border: '1px solid rgba(168, 85, 247, 0.35)',
  borderRadius: 10,
  padding: '14px 16px',
  marginBottom: 14,
  color: 'var(--text, #e4e7ec)',
};
export const quotaCtaStyle = {
  display: 'inline-block',
  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
  color: '#fff',
  padding: '8px 16px',
  borderRadius: 6,
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: 13,
};

// ─── Skeleton bar (used by both tabs while data is loading) ──
// Shimmer keyframes are injected ONCE at module load (not during render)
// to keep the component pure and satisfy React 19's strict-mode checks.
if (typeof document !== 'undefined') {
  const id = 'mysql-skeleton-shimmer';
  if (!document.getElementById(id)) {
    const styleEl = document.createElement('style');
    styleEl.id = id;
    styleEl.textContent = '@keyframes mysql-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}';
    document.head.appendChild(styleEl);
  }
}

export function Skeleton({ width = '100%', height = 14, radius = 4, style = {} }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 100%)',
        backgroundSize: '800px 100%',
        animation: 'mysql-shimmer 1.6s linear infinite',
        ...style,
      }}
    />
  );
}
