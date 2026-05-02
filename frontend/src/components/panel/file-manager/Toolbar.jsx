import React from 'react';

/**
 * Sticky toolbar above the file table. Owns the breadcrumb navigation,
 * the search input (with `/` shortcut hint), and the four primary actions
 * (Up · + Folder · Upload Folder · Upload Files).
 *
 * Pure-render component — every action is a callback supplied by FileManager.
 */
export default function Toolbar({
  homeUsername,
  breadcrumbs,
  onCrumbClick,
  searchRef,
  search,
  onSearchChange,
  onGoUp,
  onToggleNewDir,
  uploading,
  fileInputRef,
  folderInputRef,
  onUpload,
}) {
  return (
    <div className="fm-toolbar" data-testid="fm-toolbar">
      <div className="fm-breadcrumb">
        <button onClick={() => onCrumbClick(`/home/${homeUsername}`)} className="fm-bread-item">/home</button>
        {breadcrumbs.slice(1).map((part, i) => (
          <React.Fragment key={i}>
            <span className="fm-bread-sep">/</span>
            <button
              onClick={() => onCrumbClick('/' + breadcrumbs.slice(0, i + 2).join('/'))}
              className={`fm-bread-item ${part === 'public_html' ? 'fm-bread-item--highlight' : ''}`}
            >{part}</button>
          </React.Fragment>
        ))}
      </div>
      <div className="fm-toolbar-actions">
        <div className="fm-search">
          <span className="fm-search-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search files…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            data-testid="fm-search-input"
            aria-label="Search files in current folder"
          />
          {!search && <span className="fm-search-shortcut" aria-hidden="true">/</span>}
        </div>
        <button onClick={onGoUp} className="fm-btn fm-btn--ghost" data-testid="fm-go-up" title="Go up">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Up
        </button>
        <button onClick={onToggleNewDir} className="fm-btn fm-btn--ghost" data-testid="fm-new-dir-btn">
          + Folder
        </button>
        <label className={`fm-btn fm-btn--ghost ${uploading ? 'fm-btn--loading' : ''}`} title="Upload an entire folder (preserves structure)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <polyline points="9 14 12 11 15 14" />
          </svg>
          Upload Folder
          <input
            type="file"
            ref={folderInputRef}
            onChange={onUpload}
            style={{ display: 'none' }}
            data-testid="fm-upload-folder-input"
            webkitdirectory=""
            directory=""
            mozdirectory=""
            multiple
          />
        </label>
        <label className={`fm-btn fm-btn--primary ${uploading ? 'fm-btn--loading' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {uploading ? 'Uploading...' : 'Upload Files'}
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={onUpload}
            style={{ display: 'none' }}
            data-testid="fm-upload-input"
          />
        </label>
      </div>
    </div>
  );
}
