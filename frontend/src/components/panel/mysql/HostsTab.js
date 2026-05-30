// Remote MySQL hosts UI. The description + input are ALWAYS interactive,
// even while the initial list is still loading — only the table shows
// skeleton rows. This is what makes the sub-tab usable immediately.
import React from 'react';
import {
  SvgPlus, SvgTrash, Skeleton,
  inputStyle, emptyStyle,
  tableWrap, tableStyle, thStyle, tdStyle,
  codeStyle, iconBtnStyle,
} from './shared';

export default function HostsTab({
  loading, hosts, newHost, setNewHost, onAdd, onDelete, busy, t,
}) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      data-testid="mysql-hosts-tab"
    >
      <section
        style={{
          padding: 12,
          background: 'var(--bg-card, #1a1f2a)',
          border: '1px solid var(--border, #2a2f3a)',
          borderRadius: 8,
          fontSize: 13,
        }}
      >
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
          data-testid="mysql-add-host-input"
        />
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !newHost.trim()}
          onClick={onAdd}
          data-testid="mysql-add-host-btn"
        >
          {SvgPlus}
          <span style={{ marginLeft: 6 }}>{t('mysql.addHost', { defaultValue: 'Allow host' })}</span>
        </button>
      </div>

      {loading ? (
        <div style={tableWrap} data-testid="mysql-hosts-skeleton">
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>{t('mysql.colHost', { defaultValue: 'Host' })}</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>{t('common.actions', { defaultValue: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td style={tdStyle}><Skeleton width="55%" height={12} /></td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}><Skeleton width={20} height={12} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : hosts.length === 0 ? (
        <div style={emptyStyle} data-testid="mysql-hosts-empty">
          {t('mysql.noHosts', { defaultValue: 'No remote hosts allowed yet.' })}
        </div>
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
                  <tr key={host + i} data-testid={`mysql-host-row-${host}`}>
                    <td style={tdStyle}><code style={codeStyle}>{host}</code></td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => onDelete(host)}
                        title={t('common.delete', { defaultValue: 'Delete' })}
                        style={iconBtnStyle}
                        data-testid={`mysql-delete-host-${host}`}
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
    </div>
  );
}
