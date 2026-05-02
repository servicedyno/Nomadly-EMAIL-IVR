import React from 'react';

/**
 * PanelToolbar — shared toolbar primitive for every panel list view.
 *
 * One toolbar style across FileManager, EmailManager, DomainList (future).
 * Composes three slots:
 *   - leftSlot: any JSX (breadcrumb, title + count, etc.)
 *   - search:   optional { value, onChange, placeholder, shortcutHint, inputRef, testid, ariaLabel }
 *   - actions:  array of { key, label, icon, variant ('primary' | 'ghost'),
 *                          onClick, fileInput, fileInputProps, testid,
 *                          loading, loadingLabel, disabled, title }
 *
 * The `fileInput` flag turns a button into a label-wrapped <input type="file">
 * (used by FileManager's Upload Files / Upload Folder buttons).
 *
 * Pure-render. Every action is a callback supplied by the consumer.
 */
export default function PanelToolbar({
  leftSlot,
  search,
  actions = [],
  testid,
  className = '',
}) {
  return (
    <div className={`panel-toolbar ${className}`.trim()} data-testid={testid}>
      {leftSlot && <div className="panel-toolbar-left">{leftSlot}</div>}
      <div className="panel-toolbar-actions">
        {search && (
          <div className="panel-search">
            <span className="panel-search-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              ref={search.inputRef}
              type="search"
              placeholder={search.placeholder || 'Search…'}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              data-testid={search.testid}
              aria-label={search.ariaLabel || search.placeholder || 'Search'}
            />
            {!search.value && search.shortcutHint && (
              <span className="panel-search-shortcut" aria-hidden="true">{search.shortcutHint}</span>
            )}
          </div>
        )}
        {actions.map((a) => {
          const variantClass = a.variant === 'primary' ? 'panel-btn--primary' : 'panel-btn--ghost';
          const loadingClass = a.loading ? 'panel-btn--loading' : '';
          const disabled = a.disabled || a.loading;
          if (a.fileInput) {
            return (
              <label
                key={a.key}
                className={`panel-btn ${variantClass} ${loadingClass}`.trim()}
                title={a.title}
              >
                {a.icon}
                {a.loading ? (a.loadingLabel || 'Working…') : a.label}
                <input
                  type="file"
                  onChange={a.onClick}
                  style={{ display: 'none' }}
                  {...(a.fileInputProps || {})}
                />
              </label>
            );
          }
          return (
            <button
              key={a.key}
              type="button"
              onClick={a.onClick}
              className={`panel-btn ${variantClass} ${loadingClass}`.trim()}
              data-testid={a.testid}
              disabled={disabled}
              title={a.title}
            >
              {a.icon}
              {a.loading ? (a.loadingLabel || 'Working…') : a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
