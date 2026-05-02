import React from 'react';

/**
 * Sticky bulk-action bar that surfaces above the file list whenever one or
 * more rows are selected. Only renders when `count > 0`.
 *
 * Props:
 *  - count: number of currently-selected files
 *  - onMove: open the bulk-move modal
 *  - onDelete: open the bulk-delete confirmation
 *  - onClear: reset the selection
 */
export default function BulkBar({ count, onMove, onDelete, onClear }) {
  if (count <= 0) return null;
  return (
    <div className="fm-bulk-bar" data-testid="fm-bulk-bar">
      <div className="fm-bulk-info">
        <span className="fm-bulk-count" data-testid="fm-bulk-count">{count}</span>
        <span>selected</span>
      </div>
      <div className="fm-bulk-actions">
        <button
          onClick={onMove}
          className="fm-bulk-btn"
          data-testid="fm-bulk-move"
          title="Move selected items"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
          Move…
        </button>
        <button
          onClick={onDelete}
          className="fm-bulk-btn fm-bulk-btn--danger"
          data-testid="fm-bulk-delete"
          title="Delete selected items"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          Delete
        </button>
        <button
          onClick={onClear}
          className="fm-bulk-btn"
          data-testid="fm-bulk-clear"
          title="Clear selection"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
