import React from 'react';
import PanelToolbar from '../shared/PanelToolbar';

/**
 * FileManager toolbar — built on top of the shared <PanelToolbar/>. Owns
 * the breadcrumb navigation in the leftSlot, plus the four file-manager
 * specific actions (Up · + Folder · Upload Folder · Upload Files). Every
 * `fm-*` data-testid is preserved for backwards compatibility with existing
 * tests.
 */

const SearchIconSlash = '/'; // shortcut hint shown inside the search input

const SvgUp = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
);
const SvgFolder = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <polyline points="9 14 12 11 15 14" />
  </svg>
);
const SvgUpload = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

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
  const breadcrumbSlot = (
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
  );

  return (
    <PanelToolbar
      testid="fm-toolbar"
      className="fm-toolbar"
      leftSlot={breadcrumbSlot}
      search={{
        value: search,
        onChange: onSearchChange,
        placeholder: 'Search files…',
        shortcutHint: SearchIconSlash,
        inputRef: searchRef,
        testid: 'fm-search-input',
        ariaLabel: 'Search files in current folder',
      }}
      actions={[
        {
          key: 'up',
          label: 'Up',
          icon: SvgUp,
          variant: 'ghost',
          onClick: onGoUp,
          testid: 'fm-go-up',
          title: 'Go up',
        },
        {
          key: 'new-dir',
          label: '+ Folder',
          variant: 'ghost',
          onClick: onToggleNewDir,
          testid: 'fm-new-dir-btn',
        },
        {
          key: 'upload-folder',
          label: 'Upload Folder',
          icon: SvgFolder,
          variant: 'ghost',
          onClick: onUpload,
          loading: uploading,
          loadingLabel: 'Uploading…',
          title: 'Upload an entire folder (preserves structure)',
          fileInput: true,
          fileInputProps: {
            ref: folderInputRef,
            'data-testid': 'fm-upload-folder-input',
            webkitdirectory: '',
            directory: '',
            mozdirectory: '',
            multiple: true,
          },
        },
        {
          key: 'upload-files',
          label: 'Upload Files',
          icon: SvgUpload,
          variant: 'primary',
          onClick: onUpload,
          loading: uploading,
          loadingLabel: 'Uploading...',
          fileInput: true,
          fileInputProps: {
            ref: fileInputRef,
            'data-testid': 'fm-upload-input',
            multiple: true,
          },
        },
      ]}
    />
  );
}
