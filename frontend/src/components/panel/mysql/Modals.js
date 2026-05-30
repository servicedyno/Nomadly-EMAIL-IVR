// All MySQL modals: Modal wrapper + CreateDbModal + CreateUserModal +
// ChangePasswordModal + AssignPrivilegesModal. Pure presentational —
// state and handlers live in MysqlManager.
import React from 'react';
import {
  ALL_PRIVS,
  generatePassword,
  inputStyle, labelStyle, hintStyle, prefixBoxStyle,
  modalOverlay, modalBox, modalHeader, modalCloseBtn, modalActionsStyle,
} from './shared';

export function Modal({ onClose, title, children, wide, testid }) {
  return (
    <div style={modalOverlay} onClick={onClose} data-testid={testid}>
      <div
        style={{ ...modalBox, maxWidth: wide ? 600 : 460 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div style={modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <button type="button" onClick={onClose} style={modalCloseBtn} aria-label="Close">×</button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

export function CreateDbModal({ t, cpUser, dbName, setDbName, busy, onClose, onSubmit }) {
  return (
    <Modal onClose={onClose} testid="mysql-create-db-modal" title={t('mysql.newDb', { defaultValue: 'New database' })}>
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
          data-testid="mysql-create-db-input"
        />
      </div>
      <p style={hintStyle}>{t('mysql.dbNameHint', { defaultValue: 'Letters, numbers and underscores only. cPanel adds the prefix automatically.' })}</p>
      <div style={modalActionsStyle}>
        <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel', { defaultValue: 'Cancel' })}</button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !dbName.trim()}
          onClick={onSubmit}
          data-testid="mysql-create-db-submit"
        >
          {busy ? t('common.creating', { defaultValue: 'Creating…' }) : t('common.create', { defaultValue: 'Create' })}
        </button>
      </div>
    </Modal>
  );
}

export function CreateUserModal({ t, cpUser, userName, setUserName, userPass, setUserPass, busy, onClose, onSubmit }) {
  return (
    <Modal onClose={onClose} testid="mysql-create-user-modal" title={t('mysql.newUser', { defaultValue: 'New user' })}>
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
          data-testid="mysql-create-user-input"
        />
      </div>
      <label style={{ ...labelStyle, marginTop: 12 }}>{t('mysql.passwordLabel', { defaultValue: 'Password' })}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={userPass}
          onChange={(e) => setUserPass(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
          data-testid="mysql-create-user-password-input"
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setUserPass(generatePassword())}
          data-testid="mysql-create-user-generate-btn"
        >
          {t('mysql.gen', { defaultValue: 'Generate' })}
        </button>
      </div>
      <div style={modalActionsStyle}>
        <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel', { defaultValue: 'Cancel' })}</button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !userName.trim() || !userPass}
          onClick={onSubmit}
          data-testid="mysql-create-user-submit"
        >
          {busy ? t('common.creating', { defaultValue: 'Creating…' }) : t('common.create', { defaultValue: 'Create' })}
        </button>
      </div>
    </Modal>
  );
}

export function ChangePasswordModal({ t, pwdFor, resetPass, setResetPass, busy, onClose, onSubmit }) {
  if (!pwdFor) return null;
  return (
    <Modal
      onClose={onClose}
      testid="mysql-change-password-modal"
      title={t('mysql.changePwdFor', { user: pwdFor.user, defaultValue: `Change password for ${pwdFor.user}` })}
    >
      <label style={labelStyle}>{t('mysql.newPassword', { defaultValue: 'New password' })}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={resetPass}
          onChange={(e) => setResetPass(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
          autoFocus
          data-testid="mysql-change-password-input"
        />
        <button type="button" className="btn-secondary" onClick={() => setResetPass(generatePassword())}>
          {t('mysql.gen', { defaultValue: 'Generate' })}
        </button>
      </div>
      <div style={modalActionsStyle}>
        <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel', { defaultValue: 'Cancel' })}</button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !resetPass}
          onClick={onSubmit}
          data-testid="mysql-change-password-submit"
        >
          {busy ? t('common.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
        </button>
      </div>
    </Modal>
  );
}

export function AssignPrivilegesModal({
  t, assignFor, databases,
  assignDb, setAssignDb,
  assignAllPriv, setAssignAllPriv,
  assignPrivs, setAssignPrivs,
  busy, onClose, onSubmit,
}) {
  if (!assignFor) return null;
  return (
    <Modal
      onClose={onClose}
      testid="mysql-assign-privileges-modal"
      title={t('mysql.assignTitle', { user: assignFor.user, defaultValue: `Grant access for ${assignFor.user}` })}
      wide
    >
      <label style={labelStyle}>{t('mysql.pickDb', { defaultValue: 'Database' })}</label>
      <select
        value={assignDb}
        onChange={(e) => setAssignDb(e.target.value)}
        style={inputStyle}
        data-testid="mysql-assign-db-select"
      >
        <option value="">{t('mysql.pickDbPh', { defaultValue: '— select a database —' })}</option>
        {databases.map((db, i) => {
          const n = db.database || db.name;
          return <option key={n + i} value={n}>{n}</option>;
        })}
      </select>

      <label style={{ ...labelStyle, marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={assignAllPriv}
          onChange={(e) => setAssignAllPriv(e.target.checked)}
          data-testid="mysql-assign-all-privs-checkbox"
        />
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
        <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel', { defaultValue: 'Cancel' })}</button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !assignDb}
          onClick={onSubmit}
          data-testid="mysql-assign-submit"
        >
          {busy ? t('common.saving', { defaultValue: 'Saving…' }) : t('mysql.grant', { defaultValue: 'Grant access' })}
        </button>
      </div>
    </Modal>
  );
}
