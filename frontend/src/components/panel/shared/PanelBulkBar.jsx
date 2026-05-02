import React from 'react';

/**
 * PanelBulkBar — shared bulk-action bar for panel list views.
 *
 * Renders nothing when `count === 0`. Otherwise shows:
 *   "[count chip] [label] · [actions...] · Clear"
 *
 * Props:
 *  - count:   number of currently-selected items
 *  - label:   text after the count, e.g. "files", "emails" — also used to pluralise
 *  - actions: array of { key, label, icon, variant ('default' | 'danger'),
 *                        onClick, testid, title }
 *  - onClear: callback to reset selection
 *  - testid:  outer container testid (e.g. "fm-bulk-bar", "em-bulk-bar")
 *  - countTestid: testid of the count chip (default: "panel-bulk-count")
 *  - clearTestid: testid of the Clear button (default: "panel-bulk-clear")
 */
export default function PanelBulkBar({
  count,
  label = 'selected',
  actions = [],
  onClear,
  testid,
  countTestid = 'panel-bulk-count',
  clearTestid = 'panel-bulk-clear',
}) {
  if (count <= 0) return null;
  return (
    <div className="panel-bulk-bar" data-testid={testid}>
      <div className="panel-bulk-info">
        <span className="panel-bulk-count" data-testid={countTestid}>{count}</span>
        <span>{label}</span>
      </div>
      <div className="panel-bulk-actions">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={a.onClick}
            className={`panel-bulk-btn ${a.variant === 'danger' ? 'panel-bulk-btn--danger' : ''}`.trim()}
            data-testid={a.testid}
            title={a.title}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="panel-bulk-btn"
            data-testid={clearTestid}
            title="Clear selection"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
