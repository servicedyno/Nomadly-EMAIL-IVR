import React from 'react';

/**
 * Full-screen tinted overlay that appears while the user is dragging
 * something over the file-manager surface. Keeps the messaging consistent
 * between "you can drop a single file here" and "you can drop a whole folder
 * — the structure is preserved".
 */
export default function DragOverlay({ isPublicHtml }) {
  return (
    <div className="fm-drag-overlay" data-testid="fm-drag-overlay">
      <div className="fm-drag-content">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p>Drop files or folders here to upload</p>
        {isPublicHtml
          ? <span>Folder structure is preserved · Files go live on your website</span>
          : <span>Folder structure is preserved · Subdirectories will be created automatically</span>}
      </div>
    </div>
  );
}
