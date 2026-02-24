import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

export default function FileManager() {
  const { api, user } = useAuth();
  const [files, setFiles] = useState([]);
  const [currentDir, setCurrentDir] = useState(`/home/${user?.username}/public_html`);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(null);
  const [showNewDir, setShowNewDir] = useState(false);
  const [newDirName, setNewDirName] = useState('');
  const [editingFile, setEditingFile] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef(null);

  const fetchFiles = useCallback(async (dir) => {
    setLoading(true);
    setError('');
    try {
      const res = await api(`/files?dir=${encodeURIComponent(dir)}`);
      if (res.errors?.length) {
        setError(res.errors[0]);
        setFiles([]);
      } else {
        const items = res.data || [];
        items.sort((a, b) => {
          if (a.type === 'dir' && b.type !== 'dir') return -1;
          if (a.type !== 'dir' && b.type === 'dir') return 1;
          return (a.file || '').localeCompare(b.file || '');
        });
        setFiles(items);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchFiles(currentDir);
  }, [currentDir, fetchFiles]);

  const navigate = (dirName) => {
    const newDir = currentDir.endsWith('/') ? currentDir + dirName : currentDir + '/' + dirName;
    setCurrentDir(newDir);
  };

  const goUp = () => {
    const parts = currentDir.split('/');
    parts.pop();
    const parent = parts.join('/') || '/';
    setCurrentDir(parent);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    setSuccessMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dir', currentDir);
      await api('/files/upload', { method: 'POST', body: formData });
      
      // Show success message with URL
      const uploadedUrl = getPublicUrl(file.name, false);
      if (uploadedUrl) {
        setSuccessMessage(`✅ File uploaded! Access it at: ${uploadedUrl}`);
        setTimeout(() => setSuccessMessage(''), 8000);
      }
      
      fetchFiles(currentDir);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileName) => {
    if (!window.confirm(`Delete ${fileName}?`)) return;
    try {
      await api('/files/delete', {
        method: 'POST',
        body: JSON.stringify({ dir: currentDir, file: fileName }),
      });
      fetchFiles(currentDir);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExtract = async (fileName) => {
    setExtracting(fileName);
    setError('');
    setSuccessMessage('');
    try {
      const res = await api('/files/extract', {
        method: 'POST',
        body: JSON.stringify({ dir: currentDir, file: fileName, destDir: currentDir }),
      });
      if (res.errors?.length) {
        setError(`Extract failed: ${res.errors[0]}`);
      } else {
        // Show success with directory URL
        const folderName = fileName.replace(/\.(zip|tar\.gz|tgz|tar)$/i, '');
        const extractedUrl = getPublicUrl(folderName, true);
        if (extractedUrl) {
          setSuccessMessage(`✅ Files extracted! View your site at: ${extractedUrl}`);
          setTimeout(() => setSuccessMessage(''), 10000);
        }
        fetchFiles(currentDir);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExtracting(null);
    }
  };

  const handleCreateDir = async () => {
    if (!newDirName.trim()) return;
    setError('');
    try {
      const res = await api('/files/mkdir', {
        method: 'POST',
        body: JSON.stringify({ dir: currentDir, name: newDirName.trim() }),
      });
      if (res.errors?.length) {
        setError(`Create folder failed: ${res.errors[0]}`);
      } else {
        setNewDirName('');
        setShowNewDir(false);
        fetchFiles(currentDir);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = async (fileName) => {
    setError('');
    try {
      const res = await api(`/files/content?dir=${encodeURIComponent(currentDir)}&file=${encodeURIComponent(fileName)}`);
      if (res.errors?.length) {
        setError(res.errors[0]);
      } else {
        setEditingFile(fileName);
        setEditContent(res.data?.content || '');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api('/files/save', {
        method: 'POST',
        body: JSON.stringify({ dir: currentDir, file: editingFile, content: editContent }),
      });
      setEditingFile(null);
      setEditContent('');
      fetchFiles(currentDir);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (oldName) => {
    if (!renameValue.trim() || renameValue.trim() === oldName) {
      setRenaming(null);
      return;
    }
    try {
      await api('/files/rename', {
        method: 'POST',
        body: JSON.stringify({ dir: currentDir, oldName, newName: renameValue.trim() }),
      });
      setRenaming(null);
      setRenameValue('');
      fetchFiles(currentDir);
    } catch (err) {
      setError(err.message);
    }
  };

  const breadcrumbs = currentDir.split('/').filter(Boolean);
  const isTextFile = (name) => /\.(html?|css|js|json|xml|txt|php|py|md|htaccess|conf|log|yml|yaml|env|sh|sql|csv)$/i.test(name);
  const isArchive = (name) => /\.(zip|tar\.gz|tgz|tar\.bz2|gz|bz2|tar)$/i.test(name);
  const isWebFile = (name) => /\.(html?|php|htm)$/i.test(name);

  // Calculate public URL for a file/folder
  const getPublicUrl = (fileName, isDirectory) => {
    // Extract path relative to public_html
    const publicHtmlIndex = currentDir.indexOf('/public_html');
    if (publicHtmlIndex === -1) return null;
    
    const relativePath = currentDir.substring(publicHtmlIndex + '/public_html'.length);
    const fullPath = relativePath ? `${relativePath}/${fileName}` : `/${fileName}`;
    
    // Construct the full URL
    const domain = user?.domain || 'yourdomain.com';
    const protocol = 'https://';
    
    // For directories, add trailing slash; for index files, show directory URL
    if (isDirectory) {
      return `${protocol}${domain}${fullPath}/`;
    } else if (fileName === 'index.html' || fileName === 'index.php') {
      // For index files, show the directory URL (cleaner)
      return `${protocol}${domain}${relativePath || '/'}`;
    } else {
      return `${protocol}${domain}${fullPath}`;
    }
  };

  // Copy URL to clipboard
  const copyUrl = async (url, fileName) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(fileName);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      setError('Failed to copy URL');
    }
  };

  return (
    <div className="fm" data-testid="file-manager">
      {/* Editor Modal */}
      {editingFile && (
        <div className="fm-modal-overlay" data-testid="fm-editor-modal">
          <div className="fm-modal">
            <div className="fm-modal-header">
              <span>Editing: {editingFile}</span>
              <button onClick={() => setEditingFile(null)} className="fm-modal-close">&times;</button>
            </div>
            <textarea
              className="fm-editor"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              data-testid="fm-editor-textarea"
              spellCheck={false}
            />
            <div className="fm-modal-actions">
              <button onClick={() => setEditingFile(null)} className="fm-btn fm-btn--ghost">Cancel</button>
              <button onClick={handleSave} className="fm-btn fm-btn--primary" disabled={saving} data-testid="fm-editor-save">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="fm-toolbar" data-testid="fm-toolbar">
        <div className="fm-breadcrumb">
          <button onClick={() => setCurrentDir(`/home/${user?.username}`)} className="fm-bread-item">/home</button>
          {breadcrumbs.slice(1).map((part, i) => (
            <React.Fragment key={i}>
              <span className="fm-bread-sep">/</span>
              <button
                onClick={() => setCurrentDir('/' + breadcrumbs.slice(0, i + 2).join('/'))}
                className="fm-bread-item"
              >{part}</button>
            </React.Fragment>
          ))}
        </div>
        <div className="fm-toolbar-actions">
          <button onClick={goUp} className="fm-btn fm-btn--ghost" data-testid="fm-go-up" title="Go up">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            Up
          </button>
          <button onClick={() => setShowNewDir(!showNewDir)} className="fm-btn fm-btn--ghost" data-testid="fm-new-dir-btn">
            + Folder
          </button>
          <label className={`fm-btn fm-btn--primary ${uploading ? 'fm-btn--loading' : ''}`}>
            {uploading ? 'Uploading...' : 'Upload'}
            <input type="file" ref={fileInputRef} onChange={handleUpload} style={{ display: 'none' }} data-testid="fm-upload-input" />
          </label>
        </div>
      </div>

      {/* New Directory Input */}
      {showNewDir && (
        <div className="fm-new-dir" data-testid="fm-new-dir-form">
          <input
            type="text"
            value={newDirName}
            onChange={(e) => setNewDirName(e.target.value)}
            placeholder="Folder name"
            data-testid="fm-new-dir-input"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateDir()}
          />
          <button onClick={handleCreateDir} className="fm-btn fm-btn--primary" data-testid="fm-new-dir-create">Create</button>
          <button onClick={() => { setShowNewDir(false); setNewDirName(''); }} className="fm-btn fm-btn--ghost">Cancel</button>
        </div>
      )}

      {error && <div className="fm-error" data-testid="fm-error">{error}</div>}

      {/* File List */}
      <div className="fm-list" data-testid="fm-file-list">
        {loading ? (
          <div className="fm-loading">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="fm-empty">This directory is empty</div>
        ) : (
          <>
            {/* Desktop: Table view */}
            <table className="fm-table fm-table--desktop">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Public URL</th>
                  <th>Size</th>
                  <th>Modified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f, i) => {
                  const name = f.file || f.fullpath?.split('/').pop() || 'unknown';
                  const isDir = f.type === 'dir';
                  const size = isDir ? '-' : formatSize(f.size || f.rawsize || 0);
                  const modified = f.mtime ? new Date(f.mtime * 1000).toLocaleDateString() : '-';
                  const publicUrl = getPublicUrl(name, isDir);

                  return (
                    <tr key={i} data-testid={`fm-row-${name}`}>
                      <td>
                        {isDir ? (
                          <button className="fm-file-link fm-file-link--dir" onClick={() => navigate(name)} data-testid={`fm-nav-${name}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                            {name}
                          </button>
                        ) : (
                          <span className="fm-file-name">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            {name}
                          </span>
                        )}
                      </td>
                      <td className="fm-cell-url">
                        {publicUrl ? (
                          <a 
                            href={publicUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="fm-url-link"
                            title={publicUrl}
                            data-testid={`fm-url-${name}`}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            {publicUrl.replace(/^https?:\/\//, '').substring(0, 40)}
                            {publicUrl.length > 50 ? '...' : ''}
                          </a>
                        ) : (
                          <span className="fm-url-none">-</span>
                        )}
                      </td>
                      <td className="fm-cell-size">{size}</td>
                      <td className="fm-cell-date">{modified}</td>
                      <td className="fm-cell-actions">
                        {!isDir && isTextFile(name) && (
                          <button onClick={() => handleEdit(name)} className="fm-action-btn" title="Edit" data-testid={`fm-edit-${name}`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                        )}
                        {!isDir && isArchive(name) && (
                          <button
                            onClick={() => handleExtract(name)}
                            className={`fm-action-btn fm-action-btn--extract ${extracting === name ? 'fm-action-btn--spinning' : ''}`}
                            title="Extract/Unzip here"
                            data-testid={`fm-extract-${name}`}
                            disabled={!!extracting}
                          >
                            {extracting === name ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="fm-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M9 2v6h6V2"/><path d="M12 8v4"/><path d="M9 12h6"/></svg>
                            )}
                          </button>
                        )}
                        <button onClick={() => { setRenaming(name); setRenameValue(name); }} className="fm-action-btn" title="Rename" data-testid={`fm-rename-${name}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => handleDelete(name)} className="fm-action-btn fm-action-btn--danger" title="Delete" data-testid={`fm-delete-${name}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile: Card view */}
            <div className="fm-cards fm-cards--mobile">
              {files.map((f, i) => {
                const name = f.file || f.fullpath?.split('/').pop() || 'unknown';
                const isDir = f.type === 'dir';
                const size = isDir ? '-' : formatSize(f.size || f.rawsize || 0);
                const modified = f.mtime ? new Date(f.mtime * 1000).toLocaleDateString() : '-';
                const publicUrl = getPublicUrl(name, isDir);

                return (
                  <div key={i} className="fm-card" data-testid={`fm-card-${name}`}>
                    <div className="fm-card-main" onClick={isDir ? () => navigate(name) : undefined}>
                      <div className={`fm-card-icon ${isDir ? 'fm-card-icon--dir' : isArchive(name) ? 'fm-card-icon--zip' : ''}`}>
                        {isDir ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                        ) : isArchive(name) ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M9 2v6h6V2"/><path d="M12 8v4"/><path d="M9 12h6"/></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        )}
                      </div>
                      <div className="fm-card-info">
                        <span className={`fm-card-name ${isDir ? 'fm-card-name--dir' : ''}`}>{name}</span>
                        <span className="fm-card-meta">{size} &middot; {modified}</span>
                        {publicUrl && (
                          <a 
                            href={publicUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="fm-card-url"
                            title={publicUrl}
                            data-testid={`fm-url-mobile-${name}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            {publicUrl.replace(/^https?:\/\//, '').substring(0, 35)}
                            {publicUrl.length > 45 ? '...' : ''}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="fm-card-actions">
                      {!isDir && isArchive(name) && (
                        <button
                          onClick={() => handleExtract(name)}
                          className={`fm-action-chip fm-action-chip--extract ${extracting === name ? 'fm-action-chip--spinning' : ''}`}
                          data-testid={`fm-extract-mobile-${name}`}
                          disabled={!!extracting}
                        >
                          {extracting === name ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="fm-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M9 2v6h6V2"/><path d="M12 8v4"/><path d="M9 12h6"/></svg>
                          )}
                          <span>Unzip</span>
                        </button>
                      )}
                      {!isDir && isTextFile(name) && (
                        <button onClick={() => handleEdit(name)} className="fm-action-chip" data-testid={`fm-edit-mobile-${name}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          <span>Edit</span>
                        </button>
                      )}
                      <button onClick={() => { setRenaming(name); setRenameValue(name); }} className="fm-action-chip" data-testid={`fm-rename-mobile-${name}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        <span>Rename</span>
                      </button>
                      <button onClick={() => handleDelete(name)} className="fm-action-chip fm-action-chip--danger" data-testid={`fm-delete-mobile-${name}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Rename Modal */}
      {renaming && (
        <div className="fm-modal-overlay" data-testid="fm-rename-modal">
          <div className="fm-modal fm-modal--sm">
            <div className="fm-modal-header">
              <span>Rename: {renaming}</span>
              <button onClick={() => setRenaming(null)} className="fm-modal-close">&times;</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <input
                type="text"
                className="fm-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename(renaming)}
                data-testid="fm-rename-input"
                autoFocus
              />
            </div>
            <div className="fm-modal-actions">
              <button onClick={() => setRenaming(null)} className="fm-btn fm-btn--ghost">Cancel</button>
              <button onClick={() => handleRename(renaming)} className="fm-btn fm-btn--primary" data-testid="fm-rename-submit">Rename</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
