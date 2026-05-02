import React from 'react';
import PanelBulkBar from '../shared/PanelBulkBar';

/**
 * FileManager bulk-action bar — thin adapter over the shared <PanelBulkBar/>.
 * Preserves every `fm-bulk-*` data-testid used by existing tests while
 * delegating the rendering to the shared primitive.
 */

const SvgMove = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14" />
    <path d="M12 5l7 7-7 7" />
  </svg>
);

const SvgTrash = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

export default function BulkBar({ count, onMove, onDelete, onClear }) {
  return (
    <PanelBulkBar
      count={count}
      label="selected"
      testid="fm-bulk-bar"
      countTestid="fm-bulk-count"
      clearTestid="fm-bulk-clear"
      onClear={onClear}
      actions={[
        {
          key: 'move',
          label: 'Move…',
          icon: SvgMove,
          onClick: onMove,
          testid: 'fm-bulk-move',
          title: 'Move selected items',
        },
        {
          key: 'delete',
          label: 'Delete',
          icon: SvgTrash,
          variant: 'danger',
          onClick: onDelete,
          testid: 'fm-bulk-delete',
          title: 'Delete selected items',
        },
      ]}
    />
  );
}
