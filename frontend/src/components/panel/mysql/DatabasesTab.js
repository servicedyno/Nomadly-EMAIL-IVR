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

function SkeletonRows({ cols, rows = 4 }) {
  return (
    <tbody data-testid="mysql-databases-skeleton">
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} style={tdStyle}>
              <Skeleton width={c === cols - 1 ? 80 : `${50 + (c * 15) % 40}%`} height={12} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export default function DatabasesTab({
  loading, databases, dbUsers, dbUserMap, userDbMap,
  onDeleteDb, onDeleteUser, onAssign, onResetPwd, onRevoke, t,
}) {
  // While loading on first render, show skeleton tables (still themed).
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} data-testid="mysql-databases-loading">
        <section>
          <h3 style={sectionTitleStyle}>
            {t('mysql.dbsHeader', { defaultValue: 'Databases' })}
            <span style={countStyle}><Skeleton width={16} height={10} /></span>
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
              <SkeletonRows cols={4} rows={3} />
            </table>
          </div>
        </section>
        <section>
          <h3 style={sectionTitleStyle}>
            {t('mysql.usersHeader', { defaultValue: 'Database users' })}
            <span style={countStyle}><Skeleton width={16} height={10} /></span>
          </h3>
          <div style={tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>{t('mysql.colUser', { defaultValue: 'User' })}</th>
                  <th style={thStyle}>{t('mysql.colAccess', { defaultValue: 'Has access to' })}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{t('common.actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <SkeletonRows cols={3} rows={2} />
            </table>
          </div>
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
