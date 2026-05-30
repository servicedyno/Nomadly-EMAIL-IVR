// Databases + Users + Connection-info view. Pure presentational —
// receives data + callbacks from MysqlManager.
import React from 'react';
import {
  SvgKey, SvgLink, SvgTrash,
  Skeleton,
  formatBytes,
  emptyStyle, tableWrap, tableStyle, thStyle, tdStyle,
  codeStyle, chipStyle, chipStyleStatic, iconBtnStyle,
  sectionTitleStyle, countStyle,
} from './shared';

// Skeleton placeholder built with <div>s (NOT <table>/<tr>/<td>) — the
// Emergent Visual Editor wraps every JSX element in a <span style="display:contents">,
// which produces invalid <span><tr>/<td></span> nesting that React 19 flags.
// Plain divs sidestep this entirely while still looking like loading rows.
const skelRowStyle = {
  display: 'flex',
  gap: 16,
  padding: '12px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  alignItems: 'center',
};
const skelHeadStyle = {
  display: 'flex',
  gap: 16,
  padding: '10px 16px',
  borderBottom: '1px solid var(--border, #2a2f3a)',
  fontWeight: 600,
  opacity: 0.75,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--text, #c7cdd6)',
};

function SkeletonBars({ testid, headers, rows = 3, weights }) {
  // weights: relative flex weights for each "column"
  return (
    <div style={tableWrap} data-testid={testid}>
      <div style={skelHeadStyle} aria-hidden="true">
        {headers.map((h, i) => (
          <div key={h + i} style={{ flex: weights[i] }}>{h}</div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={skelRowStyle}>
          {headers.map((_, c) => (
            <div key={c} style={{ flex: weights[c] }}>
              <Skeleton width={`${40 + ((r + c) * 17) % 50}%`} height={12} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function DatabasesTab({
  loading, databases, dbUsers, dbUserMap, userDbMap,
  onDeleteDb, onDeleteUser, onAssign, onResetPwd, onRevoke, t,
}) {
  // While loading on first render, show skeleton placeholders.
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} data-testid="mysql-databases-loading">
        <section>
          <h3 style={sectionTitleStyle}>
            {t('mysql.dbsHeader', { defaultValue: 'Databases' })}
          </h3>
          <SkeletonBars
            testid="mysql-databases-skeleton"
            rows={3}
            headers={[
              t('mysql.colName', { defaultValue: 'Name' }),
              t('mysql.colSize', { defaultValue: 'Size' }),
              t('mysql.colUsers', { defaultValue: 'Users' }),
              t('common.actions', { defaultValue: 'Actions' }),
            ]}
            weights={[2.5, 1, 2.5, 1]}
          />
        </section>
        <section>
          <h3 style={sectionTitleStyle}>
            {t('mysql.usersHeader', { defaultValue: 'Database users' })}
          </h3>
          <SkeletonBars
            testid="mysql-users-skeleton"
            rows={2}
            headers={[
              t('mysql.colUser', { defaultValue: 'User' }),
              t('mysql.colAccess', { defaultValue: 'Has access to' }),
              t('common.actions', { defaultValue: 'Actions' }),
            ]}
            weights={[2, 4, 1]}
          />
        </section>
      </div>
    );
  }

  if (!databases.length && !dbUsers.length) {
    return (
      <div style={emptyStyle} data-testid="mysql-databases-empty">
        <h3 style={{ marginBottom: 8 }}>{t('mysql.emptyTitle', { defaultValue: 'No databases yet' })}</h3>
        <p style={{ opacity: 0.7 }}>{t('mysql.emptyBody', { defaultValue: 'Create your first database to power a WordPress site, web app or custom project.' })}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} data-testid="mysql-databases-content">
      {/* Databases table */}
      <section>
        <h3 style={sectionTitleStyle}>
          {t('mysql.dbsHeader', { defaultValue: 'Databases' })}
          <span style={countStyle}>{databases.length}</span>
        </h3>
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
                  <tr key={name + i} data-testid={`mysql-db-row-${name}`}>
                    <td style={tdStyle}><code style={codeStyle}>{name}</code></td>
                    <td style={tdStyle}>{size}</td>
                    <td style={tdStyle}>
                      {users.length === 0 ? <span style={{ opacity: 0.5 }}>—</span> : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {users.map((u, idx) => {
                            const uname = typeof u === 'string' ? u : (u.user || u.name);
                            return (
                              <span
                                key={uname + idx}
                                style={chipStyle}
                                title={t('mysql.clickToRevoke', { defaultValue: 'Click to revoke' })}
                                onClick={() => onRevoke(uname, name)}
                              >
                                {uname} <span style={{ marginLeft: 4, opacity: 0.6 }}>×</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => onDeleteDb(name)}
                        title={t('common.delete', { defaultValue: 'Delete' })}
                        style={iconBtnStyle}
                        data-testid={`mysql-delete-db-${name}`}
                      >
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
        <h3 style={sectionTitleStyle}>
          {t('mysql.usersHeader', { defaultValue: 'Database users' })}
          <span style={countStyle}>{dbUsers.length}</span>
        </h3>
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
                    <tr key={uname + i} data-testid={`mysql-user-row-${uname}`}>
                      <td style={tdStyle}><code style={codeStyle}>{uname}</code></td>
                      <td style={tdStyle}>
                        {dbs.length === 0 ? (
                          <span style={{ opacity: 0.5 }}>{t('mysql.noAccess', { defaultValue: 'no databases' })}</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {dbs.map(d => <span key={d} style={chipStyleStatic}>{d}</span>)}
                          </div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => onAssign(uname)}
                          title={t('mysql.grant', { defaultValue: 'Grant access' })}
                          style={iconBtnStyle}
                          data-testid={`mysql-assign-${uname}`}
                        >
                          {SvgLink}
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => onResetPwd(uname)}
                          title={t('mysql.changePwd', { defaultValue: 'Change password' })}
                          style={iconBtnStyle}
                          data-testid={`mysql-reset-pwd-${uname}`}
                        >
                          {SvgKey}
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => onDeleteUser(uname)}
                          title={t('common.delete', { defaultValue: 'Delete' })}
                          style={iconBtnStyle}
                          data-testid={`mysql-delete-user-${uname}`}
                        >
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
