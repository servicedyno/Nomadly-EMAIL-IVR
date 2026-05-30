import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import PanelToolbar from './shared/PanelToolbar';

const SvgPlus = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SvgTrash = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const SvgExternal = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const SvgKey = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const SvgLink = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);

// Common MySQL privileges — same set cPanel offers in "Manage User Privileges".
const ALL_PRIVS = [
  'ALTER', 'ALTER ROUTINE', 'CREATE', 'CREATE ROUTINE', 'CREATE TEMPORARY TABLES',
  'CREATE VIEW', 'DELETE', 'DROP', 'EVENT', 'EXECUTE', 'INDEX', 'INSERT',
  'LOCK TABLES', 'REFERENCES', 'SELECT', 'SHOW VIEW', 'TRIGGER', 'UPDATE',
];

function generatePassword(len = 16) {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let pw = '';
  for (let i = 0; i < len; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

// cPanel auto-prefixes DB names and users with `<cpuser>_`. We let the user
// type ONLY the suffix and combine for them — matches cPanel's own UX.
function prefixed(prefix, name) {
  if (!prefix) return name;
  return name.startsWith(prefix + '_') ? name : `${prefix}_${name}`;
}

export default function MysqlManager() {
  const { t } = useTranslation();
  const { api, user } = useAuth();
  const cpUser = user?.username || '';

  const [tab, setTab] = useState('databases'); // databases | hosts
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [databases, setDatabases] = useState([]);
  const [dbUsers, setDbUsers] = useState([]);
  const [remoteHosts, setRemoteHosts] = useState([]);

  // Modal state
  const [showCreateDb, setShowCreateDb] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [assignFor, setAssignFor] = useState(null); // { user } — opens privilege modal
  const [pwdFor, setPwdFor] = useState(null); // { user } — opens reset password modal

  const [dbName, setDbName] = useState('');
  const [userName, setUserName] = useState('');
  const [userPass, setUserPass] = useState('');
  const [assignDb, setAssignDb] = useState('');
  const [assignAllPriv, setAssignAllPriv] = useState(true);
  const [assignPrivs, setAssignPrivs] = useState(() => new Set(['ALL PRIVILEGES']));
  const [resetPass, setResetPass] = useState('');
  const [newHost, setNewHost] = useState('');
  const [busy, setBusy] = useState(false);

  const [showPm, setShowPm] = useState(false); // launching phpMyAdmin

  // ─── Fetchers ───────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/mysql/databases');
      if (res.databases?.errors?.length) {
        setError(res.databases.errors[0]);
      }
      const dbList = res.databases?.data || [];
      // UAPI returns either [{ database, users:[], disk_usage }] or { databases:[...] }
      const normalizedDbs = Array.isArray(dbList) ? dbList : (dbList.databases || []);
      setDatabases(normalizedDbs);

      const uList = res.users?.data || [];
      const normalizedUsers = Array.isArray(uList) ? uList : (uList.users || []);
      setDbUsers(normalizedUsers);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHosts = async () => {
    try {
      const res = await api('/mysql/remote-hosts');
      const list = res.data || [];
      setRemoteHosts(Array.isArray(list) ? list : (list.hosts || []));
    } catch (_) {}
  };

  useEffect(() => {
    fetchAll();
    fetchHosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Database actions ───────────────────────────────────────
  const handleCreateDb = async () => {
    const raw = dbName.trim();
    if (!raw) return;
    setBusy(true); setError(''); setInfo('');
    try {
      const full = prefixed(cpUser, raw);
      const res = await api('/mysql/databases/create', {
        method: 'POST',
        body: JSON.stringify({ name: full }),
      });
      if (res.errors?.length) {
        setError(res.errors[0]);
      } else {
        setInfo(t('mysql.dbCreated', { name: full, defaultValue: `Database "${full}" created.` }));
        setDbName('');
        setShowCreateDb(false);
        fetchAll();
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const handleDeleteDb = async (name) => {
    if (!window.confirm(t('mysql.confirmDeleteDb', { name, defaultValue: `Delete database "${name}"? This cannot be undone.` }))) return;
    setBusy(true); setError(''); setInfo('');
    try {
      const res = await api('/mysql/databases/delete', {
        method: 'POST', body: JSON.stringify({ name }),
      });
      if (res.errors?.length) setError(res.errors[0]);
      else { setInfo(t('mysql.dbDeleted', { defaultValue: 'Database deleted.' })); fetchAll(); }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  // ─── User actions ───────────────────────────────────────────
  const handleCreateUser = async () => {
    const raw = userName.trim();
    if (!raw || !userPass) return;
    if (userPass.length < 8) { setError(t('mysql.errPassShort', { defaultValue: 'Password must be at least 8 characters.' })); return; }
    setBusy(true); setError(''); setInfo('');
    try {
      const full = prefixed(cpUser, raw);
      const res = await api('/mysql/users/create', {
        method: 'POST', body: JSON.stringify({ name: full, password: userPass }),
      });
      if (res.errors?.length) setError(res.errors[0]);
      else {
        setInfo(t('mysql.userCreated', { name: full, defaultValue: `User "${full}" created.` }));
        setUserName(''); setUserPass(''); setShowCreateUser(false);
        fetchAll();
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const handleDeleteUser = async (name) => {
    if (!window.confirm(t('mysql.confirmDeleteUser', { name, defaultValue: `Delete user "${name}"?` }))) return;
    setBusy(true); setError(''); setInfo('');
    try {
      const res = await api('/mysql/users/delete', {
        method: 'POST', body: JSON.stringify({ name }),
      });
      if (res.errors?.length) setError(res.errors[0]);
      else { setInfo(t('mysql.userDeleted', { defaultValue: 'User deleted.' })); fetchAll(); }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const handleResetPassword = async () => {
    if (!pwdFor || !resetPass) return;
    if (resetPass.length < 8) { setError(t('mysql.errPassShort', { defaultValue: 'Password must be at least 8 characters.' })); return; }
    setBusy(true); setError(''); setInfo('');
    try {
      const res = await api('/mysql/users/password', {
        method: 'POST', body: JSON.stringify({ user: pwdFor.user, password: resetPass }),
      });
      if (res.errors?.length) setError(res.errors[0]);
      else {
        setInfo(t('mysql.pwdChanged', { defaultValue: 'Password updated.' }));
        setPwdFor(null); setResetPass('');
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const handleAssign = async () => {
    if (!assignFor || !assignDb) return;
    setBusy(true); setError(''); setInfo('');
    try {
      const privs = assignAllPriv ? ['ALL PRIVILEGES'] : Array.from(assignPrivs);
      if (!privs.length) { setError(t('mysql.errNoPrivs', { defaultValue: 'Pick at least one privilege.' })); setBusy(false); return; }
      const res = await api('/mysql/privileges/grant', {
        method: 'POST',
        body: JSON.stringify({ user: assignFor.user, database: assignDb, privileges: privs }),
      });
      if (res.errors?.length) setError(res.errors[0]);
      else {
        setInfo(t('mysql.privsGranted', { defaultValue: 'Privileges granted.' }));
        setAssignFor(null); setAssignDb(''); setAssignPrivs(new Set(['ALL PRIVILEGES']));
        setAssignAllPriv(true);
        fetchAll();
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const handleRevoke = async (userName, database) => {
    if (!window.confirm(t('mysql.confirmRevoke', { user: userName, db: database, defaultValue: `Revoke "${userName}" from "${database}"?` }))) return;
    setBusy(true); setError(''); setInfo('');
    try {
      const res = await api('/mysql/privileges/revoke', {
        method: 'POST', body: JSON.stringify({ user: userName, database }),
      });
      if (res.errors?.length) setError(res.errors[0]);
      else { setInfo(t('mysql.revoked', { defaultValue: 'Access revoked.' })); fetchAll(); }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  // ─── Remote hosts ───────────────────────────────────────────
  const handleAddHost = async () => {
    const h = newHost.trim();
    if (!h) return;
    setBusy(true); setError(''); setInfo('');
    try {
      const res = await api('/mysql/remote-hosts/add', {
        method: 'POST', body: JSON.stringify({ host: h }),
      });
      if (res.errors?.length) setError(res.errors[0]);
      else { setInfo(t('mysql.hostAdded', { host: h, defaultValue: `Host "${h}" allowed.` })); setNewHost(''); fetchHosts(); }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const handleDeleteHost = async (host) => {
    if (!window.confirm(t('mysql.confirmDeleteHost', { host, defaultValue: `Remove host "${host}"?` }))) return;
    setBusy(true); setError(''); setInfo('');
    try {
      const res = await api('/mysql/remote-hosts/delete', {
        method: 'POST', body: JSON.stringify({ host }),
      });
      if (res.errors?.length) setError(res.errors[0]);
      else { setInfo(t('mysql.hostRemoved', { defaultValue: 'Host removed.' })); fetchHosts(); }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  // ─── phpMyAdmin SSO ─────────────────────────────────────────
  const openPhpMyAdmin = async () => {
    setShowPm(true); setError('');
    try {
      const res = await api('/mysql/phpmyadmin');
      if (res.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      } else {
        setError(res.errors?.[0] || t('mysql.pmaFail', { defaultValue: 'Could not open phpMyAdmin.' }));
      }
    } catch (err) { setError(err.message); }
    finally { setShowPm(false); }
  };

  // ─── Derived data ───────────────────────────────────────────
  // Map: dbName → [users] (from databases list, when UAPI returns it inline)
  const dbUserMap = useMemo(() => {
    const m = {};
    for (const db of databases) {
      const name = db.database || db.name;
      if (!name) continue;
      m[name] = db.users || [];
    }
    return m;
  }, [databases]);

  // Inverse: userName → [databases they can access]
  const userDbMap = useMemo(() => {
    const m = {};
    for (const db of databases) {
      const name = db.database || db.name;
      if (!name) continue;
      for (const u of (db.users || [])) {
        const uname = typeof u === 'string' ? u : (u.user || u.name);
        if (!uname) continue;
        if (!m[uname]) m[uname] = [];
        m[uname].push(name);
      }
    }
    return m;
  }, [databases]);

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="email-manager mysql-manager">
      <PanelToolbar
        title={t('mysql.title', { defaultValue: 'MySQL Databases' })}
        subtitle={t('mysql.subtitle', { defaultValue: 'Manage your databases, users and remote access.' })}
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={openPhpMyAdmin}
              disabled={showPm}
              title={t('mysql.pmaTip', { defaultValue: 'Browse tables and run SQL queries in phpMyAdmin.' })}
            >
              {SvgExternal}
              <span style={{ marginLeft: 6 }}>
                {showPm
                  ? t('mysql.opening', { defaultValue: 'Opening…' })
                  : t('mysql.openPma', { defaultValue: 'Open phpMyAdmin' })}
              </span>
            </button>
            {tab === 'databases' && (
              <>
                <button type="button" className="btn-secondary" onClick={() => { setShowCreateUser(true); setUserPass(generatePassword()); }}>
                  {SvgKey}
                  <span style={{ marginLeft: 6 }}>{t('mysql.newUser', { defaultValue: 'New user' })}</span>
                </button>
                <button type="button" className="btn-primary" onClick={() => setShowCreateDb(true)}>
                  {SvgPlus}
                  <span style={{ marginLeft: 6 }}>{t('mysql.newDb', { defaultValue: 'New database' })}</span>
                </button>
              </>
            )}
          </>
        }
      />

      {/* Tabs */}
      <div className="mysql-tabs" style={{ display: 'flex', gap: 8, margin: '12px 0 16px', borderBottom: '1px solid var(--border, #2a2f3a)' }}>
        <button
          type="button"
          className={`tab-btn ${tab === 'databases' ? 'active' : ''}`}
          onClick={() => setTab('databases')}
          style={tabBtnStyle(tab === 'databases')}
        >
          {t('mysql.tabDatabases', { defaultValue: 'Databases & Users' })}
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === 'hosts' ? 'active' : ''}`}
          onClick={() => setTab('hosts')}
          style={tabBtnStyle(tab === 'hosts')}
        >
          {t('mysql.tabHosts', { defaultValue: 'Remote MySQL' })}
        </button>
      </div>

      {error && <div className="alert alert-error" style={alertStyle('#3a1f24', '#ff6b7a')}>{error}</div>}
      {info && <div className="alert alert-info" style={alertStyle('#1f3a2a', '#5fd897')}>{info}</div>}

      {loading ? (
        <div className="loading" style={{ padding: 24, opacity: 0.7 }}>{t('common.loading', { defaultValue: 'Loading…' })}</div>
      ) : tab === 'databases' ? (
        <DatabasesTab
          databases={databases}
          dbUsers={dbUsers}
          dbUserMap={dbUserMap}
          userDbMap={userDbMap}
          onDeleteDb={handleDeleteDb}
          onDeleteUser={handleDeleteUser}
          onAssign={(u) => { setAssignFor({ user: u }); setAssignDb(databases[0]?.database || databases[0]?.name || ''); }}
          onResetPwd={(u) => { setPwdFor({ user: u }); setResetPass(generatePassword()); }}
          onRevoke={handleRevoke}
          cpUser={cpUser}
          t={t}
        />
      ) : (
        <HostsTab
          hosts={remoteHosts}
          newHost={newHost}
          setNewHost={setNewHost}
          onAdd={handleAddHost}
          onDelete={handleDeleteHost}
          busy={busy}
          t={t}
        />
      )}

      {/* ─── Create DB modal ─── */}
      {showCreateDb && (
        <Modal onClose={() => setShowCreateDb(false)} title={t('mysql.newDb', { defaultValue: 'New database' })}>
          <label style={labelStyle}>{t('mysql.dbNameLabel', { defaultValue: 'Database name' })}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <span style={prefixBoxStyle}>{cpUser}_</span>
            <input
              type="text"
              value={dbName}
              onChange={(e) => setDbName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder={t('mysql.dbNamePlaceholder', { defaultValue: 'myblog' })}
              style={{ ...inputStyle, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, flex: 1 }}
              autoFocus
            />
          </div>
          <p style={hintStyle}>{t('mysql.dbNameHint', { defaultValue: 'Letters, numbers and underscores only. cPanel adds the prefix automatically.' })}</p>
          <div style={modalActionsStyle}>
            <button type="button" className="btn-secondary" onClick={() => setShowCreateDb(false)}>{t('common.cancel', { defaultValue: 'Cancel' })}</button>
            <button type="button" className="btn-primary" disabled={busy || !dbName.trim()} onClick={handleCreateDb}>
              {busy ? t('common.creating', { defaultValue: 'Creating…' }) : t('common.create', { defaultValue: 'Create' })}
            </button>
          </div>
        </Modal>
      )}

      {/* ─── Create User modal ─── */}
      {showCreateUser && (
        <Modal onClose={() => setShowCreateUser(false)} title={t('mysql.newUser', { defaultValue: 'New user' })}>
          <label style={labelStyle}>{t('mysql.userNameLabel', { defaultValue: 'Username' })}</label>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={prefixBoxStyle}>{cpUser}_</span>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder={t('mysql.userNamePlaceholder', { defaultValue: 'app' })}
              style={{ ...inputStyle, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, flex: 1 }}
              autoFocus
            />
          </div>
          <label style={{ ...labelStyle, marginTop: 12 }}>{t('mysql.passwordLabel', { defaultValue: 'Password' })}</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={userPass}
              onChange={(e) => setUserPass(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button type="button" className="btn-secondary" onClick={() => setUserPass(generatePassword())}>
              {t('mysql.gen', { defaultValue: 'Generate' })}
            </button>
          </div>
          <div style={modalActionsStyle}>
            <button type="button" className="btn-secondary" onClick={() => setShowCreateUser(false)}>{t('common.cancel', { defaultValue: 'Cancel' })}</button>
            <button type="button" className="btn-primary" disabled={busy || !userName.trim() || !userPass} onClick={handleCreateUser}>
              {busy ? t('common.creating', { defaultValue: 'Creating…' }) : t('common.create', { defaultValue: 'Create' })}
            </button>
          </div>
        </Modal>
      )}

      {/* ─── Reset password modal ─── */}
      {pwdFor && (
        <Modal onClose={() => setPwdFor(null)} title={t('mysql.changePwdFor', { user: pwdFor.user, defaultValue: `Change password for ${pwdFor.user}` })}>
          <label style={labelStyle}>{t('mysql.newPassword', { defaultValue: 'New password' })}</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" value={resetPass} onChange={(e) => setResetPass(e.target.value)} style={{ ...inputStyle, flex: 1 }} autoFocus />
            <button type="button" className="btn-secondary" onClick={() => setResetPass(generatePassword())}>
              {t('mysql.gen', { defaultValue: 'Generate' })}
            </button>
          </div>
          <div style={modalActionsStyle}>
            <button type="button" className="btn-secondary" onClick={() => setPwdFor(null)}>{t('common.cancel', { defaultValue: 'Cancel' })}</button>
            <button type="button" className="btn-primary" disabled={busy || !resetPass} onClick={handleResetPassword}>
              {busy ? t('common.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
            </button>
          </div>
        </Modal>
      )}

      {/* ─── Assign privileges modal ─── */}
      {assignFor && (
        <Modal onClose={() => setAssignFor(null)} title={t('mysql.assignTitle', { user: assignFor.user, defaultValue: `Grant access for ${assignFor.user}` })} wide>
          <label style={labelStyle}>{t('mysql.pickDb', { defaultValue: 'Database' })}</label>
          <select value={assignDb} onChange={(e) => setAssignDb(e.target.value)} style={inputStyle}>
            <option value="">{t('mysql.pickDbPh', { defaultValue: '— select a database —' })}</option>
            {databases.map((db, i) => {
              const n = db.database || db.name;
              return <option key={n + i} value={n}>{n}</option>;
            })}
          </select>

          <label style={{ ...labelStyle, marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={assignAllPriv} onChange={(e) => setAssignAllPriv(e.target.checked)} />
            <span>{t('mysql.allPrivs', { defaultValue: 'All privileges' })}</span>
          </label>

          {!assignAllPriv && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6, maxHeight: 240, overflow: 'auto', padding: 8, background: 'var(--bg-input, #11151c)', borderRadius: 6 }}>
              {ALL_PRIVS.map(p => (
                <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={assignPrivs.has(p)}
                    onChange={(e) => {
                      setAssignPrivs(prev => {
                        const n = new Set(prev);
                        if (e.target.checked) n.add(p); else n.delete(p);
                        return n;
                      });
                    }}
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          )}

          <div style={modalActionsStyle}>
            <button type="button" className="btn-secondary" onClick={() => setAssignFor(null)}>{t('common.cancel', { defaultValue: 'Cancel' })}</button>
            <button type="button" className="btn-primary" disabled={busy || !assignDb} onClick={handleAssign}>
              {busy ? t('common.saving', { defaultValue: 'Saving…' }) : t('mysql.grant', { defaultValue: 'Grant access' })}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function DatabasesTab({ databases, dbUsers, dbUserMap, userDbMap, onDeleteDb, onDeleteUser, onAssign, onResetPwd, onRevoke, t }) {
  if (!databases.length && !dbUsers.length) {
    return (
      <div style={emptyStyle}>
        <h3 style={{ marginBottom: 8 }}>{t('mysql.emptyTitle', { defaultValue: 'No databases yet' })}</h3>
        <p style={{ opacity: 0.7 }}>{t('mysql.emptyBody', { defaultValue: 'Create your first database to power a WordPress site, web app or custom project.' })}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Databases table */}
      <section>
        <h3 style={sectionTitleStyle}>{t('mysql.dbsHeader', { defaultValue: 'Databases' })} <span style={countStyle}>{databases.length}</span></h3>
        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>{t('mysql.colName', { defaultValue: 'Name' })}</th>
                <th style={thStyle}>{t('mysql.colSize', { defaultValue: 'Size' })}</th>
                <th style={thStyle}>{t('mysql.colUsers', { defaultValue: 'Users' })}</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>{t('common.actions', { defaultValue: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody>
              {databases.map((db, i) => {
                const name = db.database || db.name;
                const size = formatBytes(db.disk_usage || db.size_bytes || db.size);
                const users = dbUserMap[name] || [];
                return (
                  <tr key={name + i}>
                    <td style={tdStyle}><code style={codeStyle}>{name}</code></td>
                    <td style={tdStyle}>{size}</td>
                    <td style={tdStyle}>
                      {users.length === 0 ? <span style={{ opacity: 0.5 }}>—</span> : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {users.map((u, idx) => {
                            const uname = typeof u === 'string' ? u : (u.user || u.name);
                            return (
                              <span key={uname + idx} style={chipStyle} title={t('mysql.clickToRevoke', { defaultValue: 'Click to revoke' })} onClick={() => onRevoke(uname, name)}>
                                {uname} <span style={{ marginLeft: 4, opacity: 0.6 }}>×</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button type="button" className="btn-icon" onClick={() => onDeleteDb(name)} title={t('common.delete', { defaultValue: 'Delete' })} style={iconBtnStyle}>
                        {SvgTrash}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Users table */}
      <section>
        <h3 style={sectionTitleStyle}>{t('mysql.usersHeader', { defaultValue: 'Database users' })} <span style={countStyle}>{dbUsers.length}</span></h3>
        {dbUsers.length === 0 ? (
          <div style={{ ...emptyStyle, padding: 16 }}>{t('mysql.noUsers', { defaultValue: 'No database users yet. Create one to connect your app.' })}</div>
        ) : (
          <div style={tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>{t('mysql.colUser', { defaultValue: 'User' })}</th>
                  <th style={thStyle}>{t('mysql.colAccess', { defaultValue: 'Has access to' })}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{t('common.actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody>
                {dbUsers.map((u, i) => {
                  const uname = typeof u === 'string' ? u : (u.user || u.name || u.User);
                  if (!uname) return null;
                  const dbs = userDbMap[uname] || [];
                  return (
                    <tr key={uname + i}>
                      <td style={tdStyle}><code style={codeStyle}>{uname}</code></td>
                      <td style={tdStyle}>
                        {dbs.length === 0 ? <span style={{ opacity: 0.5 }}>{t('mysql.noAccess', { defaultValue: 'no databases' })}</span> : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {dbs.map(d => <span key={d} style={chipStyleStatic}>{d}</span>)}
                          </div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <button type="button" className="btn-icon" onClick={() => onAssign(uname)} title={t('mysql.grant', { defaultValue: 'Grant access' })} style={iconBtnStyle}>
                          {SvgLink}
                        </button>
                        <button type="button" className="btn-icon" onClick={() => onResetPwd(uname)} title={t('mysql.changePwd', { defaultValue: 'Change password' })} style={iconBtnStyle}>
                          {SvgKey}
                        </button>
                        <button type="button" className="btn-icon" onClick={() => onDeleteUser(uname)} title={t('common.delete', { defaultValue: 'Delete' })} style={iconBtnStyle}>
                          {SvgTrash}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Connection info hint */}
      <section style={{ padding: 12, background: 'var(--bg-card, #1a1f2a)', border: '1px solid var(--border, #2a2f3a)', borderRadius: 8, fontSize: 13 }}>
        <strong>{t('mysql.connTitle', { defaultValue: 'Connection details' })}</strong>
        <ul style={{ margin: '8px 0 0 16px', padding: 0, opacity: 0.8 }}>
          <li>{t('mysql.connHost', { defaultValue: 'Host:' })} <code style={codeStyle}>localhost</code> {t('mysql.connHostHint', { defaultValue: '(use from inside your hosting)' })}</li>
          <li>{t('mysql.connPort', { defaultValue: 'Port:' })} <code style={codeStyle}>3306</code></li>
          <li>{t('mysql.connTip', { defaultValue: 'For external apps, allow your IP in the Remote MySQL tab first.' })}</li>
        </ul>
      </section>
    </div>
  );
}

function HostsTab({ hosts, newHost, setNewHost, onAdd, onDelete, busy, t }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section style={{ padding: 12, background: 'var(--bg-card, #1a1f2a)', border: '1px solid var(--border, #2a2f3a)', borderRadius: 8, fontSize: 13 }}>
        <strong>{t('mysql.remoteIntro', { defaultValue: 'Remote MySQL access' })}</strong>
        <p style={{ margin: '6px 0 0 0', opacity: 0.85 }}>
          {t('mysql.remoteHint', { defaultValue: 'Allow specific IPs or hostnames to connect to your MySQL databases from outside the server. Use % for wildcards (e.g. 203.0.113.% or %.example.com).' })}
        </p>
      </section>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={newHost}
          onChange={(e) => setNewHost(e.target.value)}
          placeholder={t('mysql.remotePlaceholder', { defaultValue: '203.0.113.45  or  %.example.com' })}
          style={{ ...inputStyle, flex: 1 }}
          onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
        />
        <button type="button" className="btn-primary" disabled={busy || !newHost.trim()} onClick={onAdd}>
          {SvgPlus}<span style={{ marginLeft: 6 }}>{t('mysql.addHost', { defaultValue: 'Allow host' })}</span>
        </button>
      </div>

      {hosts.length === 0 ? (
        <div style={emptyStyle}>{t('mysql.noHosts', { defaultValue: 'No remote hosts allowed yet.' })}</div>
      ) : (
        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>{t('mysql.colHost', { defaultValue: 'Host' })}</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>{t('common.actions', { defaultValue: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody>
              {hosts.map((h, i) => {
                const host = typeof h === 'string' ? h : (h.host || h.name);
                return (
                  <tr key={host + i}>
                    <td style={tdStyle}><code style={codeStyle}>{host}</code></td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button type="button" className="btn-icon" onClick={() => onDelete(host)} title={t('common.delete', { defaultValue: 'Delete' })} style={iconBtnStyle}>
                        {SvgTrash}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Modal({ onClose, title, children, wide }) {
  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...modalBox, maxWidth: wide ? 600 : 460 }} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <button type="button" onClick={onClose} style={modalCloseBtn} aria-label="Close">×</button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function formatBytes(b) {
  const n = Number(b);
  if (!n || Number.isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ─── Inline styles (matches existing panel look) ────────────
const tabBtnStyle = (active) => ({
  background: 'transparent',
  color: active ? 'var(--accent, #6cb6ff)' : 'var(--text, #c7cdd6)',
  border: 'none',
  borderBottom: active ? '2px solid var(--accent, #6cb6ff)' : '2px solid transparent',
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: active ? 600 : 500,
  fontSize: 14,
});
const inputStyle = {
  background: 'var(--bg-input, #11151c)',
  color: 'var(--text, #fff)',
  border: '1px solid var(--border, #2a2f3a)',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 14,
  outline: 'none',
  width: '100%',
};
const labelStyle = { display: 'block', fontSize: 12, opacity: 0.75, marginBottom: 4 };
const hintStyle = { fontSize: 11, opacity: 0.6, marginTop: 6 };
const prefixBoxStyle = {
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
const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalBox = {
  background: 'var(--bg, #0e1117)', borderRadius: 10, border: '1px solid var(--border, #2a2f3a)',
  width: '100%', maxHeight: '90vh', overflow: 'auto',
};
const modalHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border, #2a2f3a)' };
const modalCloseBtn = { background: 'transparent', color: 'inherit', border: 'none', fontSize: 22, cursor: 'pointer', lineHeight: 1 };
const modalActionsStyle = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 };
const alertStyle = (bg, fg) => ({ background: bg, color: fg, padding: '10px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 });
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const tableWrap = { background: 'var(--bg-card, #1a1f2a)', border: '1px solid var(--border, #2a2f3a)', borderRadius: 8, overflow: 'auto' };
const thStyle = { textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border, #2a2f3a)', fontWeight: 600, opacity: 0.75, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 };
const tdStyle = { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' };
const codeStyle = { background: 'var(--bg, #0e1117)', padding: '2px 6px', borderRadius: 4, fontFamily: 'ui-monospace, monospace', fontSize: 12 };
const chipStyle = { background: 'var(--bg, #0e1117)', border: '1px solid var(--border, #2a2f3a)', padding: '3px 8px', borderRadius: 12, fontSize: 11, cursor: 'pointer', fontFamily: 'ui-monospace, monospace' };
const chipStyleStatic = { ...chipStyle, cursor: 'default' };
const iconBtnStyle = { background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 6, marginLeft: 4, opacity: 0.7 };
const sectionTitleStyle = { fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 };
const countStyle = { background: 'var(--bg-card, #1a1f2a)', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, opacity: 0.75 };
const emptyStyle = { padding: 24, textAlign: 'center', background: 'var(--bg-card, #1a1f2a)', border: '1px dashed var(--border, #2a2f3a)', borderRadius: 8, color: 'var(--text, #c7cdd6)' };
