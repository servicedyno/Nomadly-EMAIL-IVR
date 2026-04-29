import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

export default function FileManager() {
  const { api, user } = useAuth();
  const [files, setFiles] = useState([]);
  const [currentDir, setCurrentDir] = useState(`/home/${user?.username}/public_html`);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
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
  const [copyMoveAction, setCopyMoveAction] = useState(null);
  const [destDir, setDestDir] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // { fileName, isDir }
  const [deleting, setDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dismissedGuide, setDismissedGuide] = useState(() => {
    return sessionStorage.getItem('panel_guide_dismissed') === 'true';
  });
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const isPublicHtml = currentDir.includes('/public_html');
  const isPublicHtmlRoot = currentDir.endsWith('/public_html') || currentDir.endsWith('/public_html/');

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

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      await uploadFiles(droppedFiles);
    }
  };

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

  // Auto-switch to chunked upload for files >8 MB to avoid Railway's ~60s
  // per-request ingress timeout (which previously caused large .zip uploads
  // to be cut mid-body and logged as "aborted before multer finished").
  const CHUNK_THRESHOLD = 8 * 1024 * 1024 // 8 MB
  const CHUNK_SIZE = 5 * 1024 * 1024      // 5 MB

  const uploadFileChunked = async (file) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    const uploadId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    for (let idx = 0; idx < totalChunks; idx++) {
      const start = idx * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const blob = file.slice(start, end)
      const formData = new FormData()
      formData.append('chunk', blob, file.name)
      formData.append('uploadId', uploadId)
      formData.append('chunkIndex', String(idx))
      formData.append('totalChunks', String(totalChunks))
      formData.append('fileName', file.name)
      formData.append('dir', currentDir)
      formData.append('fileSize', String(file.size))
      setUploadProgress(`Uploading ${file.name} — chunk ${idx + 1}/${totalChunks} (${Math.round(((idx + 1) / totalChunks) * 100)}%)`)
      const res = await api('/files/upload-chunk', { method: 'POST', body: formData })
      // Last chunk returns the final cPanel response; any error is thrown by `api`
      if (idx === totalChunks - 1 && res?.errors?.length) {
        throw new Error(res.errors[0])
      }
    }
  }

  const uploadFiles = async (selected) => {
    if (!selected.length) return;
    setUploading(true);
    setError('');
    setSuccessMessage('');
    const total = selected.length;
    let done = 0;
    let failures = [];
    try {
      for (const file of selected) {
        try {
          setUploadProgress(`Uploading ${done + 1}/${total}: ${file.name}`);
          if (file.size > CHUNK_THRESHOLD) {
            await uploadFileChunked(file)
          } else {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('dir', currentDir);
            await api('/files/upload', { method: 'POST', body: formData });
          }
          done++;
        } catch (err) {
          failures.push({ name: file.name, msg: friendlyUploadError(err) });
        }
      }

      if (failures.length === 0) {
        if (total === 1) {
          const uploadedUrl = getPublicUrl(selected[0].name, false);
          setSuccessMessage(uploadedUrl
            ? `File uploaded successfully! View it at: ${uploadedUrl}`
            : `File uploaded successfully!`);
        } else {
          setSuccessMessage(`${done} files uploaded successfully!`);
        }
        setTimeout(() => setSuccessMessage(''), 8000);
      } else {
        const first = failures[0];
        setError(failures.length === 1
          ? `${first.name}: ${first.msg}`
          : `${done}/${total} uploaded — ${failures.length} failed. First error — ${first.name}: ${first.msg}`);
      }

      fetchFiles(currentDir);
    } finally {
      setUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpload = async (e) => {
    const selected = Array.from(e.target.files || []);
    await uploadFiles(selected);
  };

  const friendlyUploadError = (err) => {
    const m = String(err?.message || err || '');
    if (/499|aborted|cancelled|interrupted/i.test(m)) {
      return 'Upload interrupted. For files over 8 MB the panel auto-chunks — just retry. For very large sites (>100 MB), zip into parts.';
    }
    if (/413|exceeded|too large|LIMIT_FILE_SIZE|max .* MB/i.test(m)) {
      return 'File exceeds the 120 MB cap. Split your archive into smaller parts, upload each, then use Extract.';
    }
    if (/500/.test(m)) {
      return 'Server error during upload. Try again, or upload a .zip and use Extract.';
    }
    return m || 'Upload failed.';
  };

  const handleDelete = (fileName, isDir = false) => {
    // Open a custom in-app confirmation modal — native window.confirm() is unreliable
    // inside Telegram WebApp and some mobile in-app browsers (silently returns false).
    setDeleteTarget({ fileName, isDir });
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    const { fileName, isDir } = deleteTarget;
    setDeleting(true);
    setError('');
    try {
      await api('/files/delete', {
        method: 'POST',
        body: JSON.stringify({ dir: currentDir, file: fileName, isDirectory: isDir }),
      });
      setDeleteTarget(null);
      setSuccessMessage(`${isDir ? 'Folder' : 'File'} deleted: ${fileName}`);
      setTimeout(() => setSuccessMessage(''), 4000);
      fetchFiles(currentDir);
    } catch (err) {
      // Surface the real cPanel error (e.g., "not a regular file", permissions)
      setError(err.message || `Could not delete ${fileName}`);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
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
        const folderName = fileName.replace(/\.(zip|tar\.gz|tgz|tar)$/i, '');
        const extractedUrl = getPublicUrl(folderName, true);
        if (extractedUrl) {
          setSuccessMessage(`Files extracted! Your site should now be live at: ${extractedUrl}`);
          setTimeout(() => setSuccessMessage(''), 12000);
        } else {
          setSuccessMessage('Files extracted successfully!');
          setTimeout(() => setSuccessMessage(''), 8000);
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

  const openCopyMove = (type, fileName) => {
    setCopyMoveAction({ type, fileName });
    setDestDir(currentDir);
    setError('');
  };

  const handleCopyMove = async () => {
    if (!copyMoveAction || !destDir.trim()) return;
    const { type, fileName } = copyMoveAction;
    setError('');
    setSuccessMessage('');
    try {
      const endpoint = type === 'copy' ? '/files/copy' : '/files/move';
      const res = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({ dir: currentDir, file: fileName, destDir: destDir.trim() }),
      });
      if (res.errors?.length) {
        setError(`${type === 'copy' ? 'Copy' : 'Move'} failed: ${res.errors[0]}`);
      } else {
        setSuccessMessage(`${fileName} ${type === 'copy' ? 'copied' : 'moved'} to ${destDir.trim()}`);
        setTimeout(() => setSuccessMessage(''), 5000);
        setCopyMoveAction(null);
        setDestDir('');
        fetchFiles(currentDir);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const dismissGuide = () => {
    setDismissedGuide(true);
    sessionStorage.setItem('panel_guide_dismissed', 'true');
  };

  const breadcrumbs = currentDir.split('/').filter(Boolean);
  const isTextFile = (name) => /\.(html?|css|js|json|xml|txt|php|py|md|htaccess|conf|log|yml|yaml|env|sh|sql|csv)$/i.test(name);
  const isArchive = (name) => /\.(zip|tar\.gz|tgz|tar\.bz2|gz|bz2|tar)$/i.test(name);
  const isWebFile = (name) => /\.(html?|php|htm)$/i.test(name);

  const getPublicUrl = (fileName, isDirectory) => {
    const publicHtmlIndex = currentDir.indexOf('/public_html');
    if (publicHtmlIndex === -1) return null;
    
    const relativePath = currentDir.substring(publicHtmlIndex + '/public_html'.length);
    const fullPath = relativePath ? `${relativePath}/${fileName}` : `/${fileName}`;
    
    const domain = user?.domain || 'yourdomain.com';
    const protocol = 'https://';
    
    if (isDirectory) {
      return `${protocol}${domain}${fullPath}/`;
    } else if (fileName === 'index.html' || fileName === 'index.php') {
      return `${protocol}${domain}${relativePath || '/'}`;
    } else {
      return `${protocol}${domain}${fullPath}`;
    }
  };

  const copyUrl = async (url, fileName) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(fileName);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      setError('Failed to copy URL');
    }
  };

  // Check if we should show the getting started guide
  const hasUserFiles = files.filter(f => {
    const name = f.file || '';
    return name !== 'cgi-bin' && name !== '.htaccess' && name !== '.user.ini' && name !== '.antired-challenge.php';
  }).length > 0;

  const showGettingStarted = isPublicHtmlRoot && !hasUserFiles && !dismissedGuide && !loading;

  return (
    <div 
      className="fm" 
      data-testid="file-manager"
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fm-drag-overlay" data-testid="fm-drag-overlay">
          <div className="fm-drag-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p>Drop files here to upload</p>
            {isPublicHtml && <span>Files will be accessible on your website</span>}
          </div>
        </div>
      )}

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

      {/* Location Banner - shows domain connection */}
      {isPublicHtml && (
        <div className="fm-location-banner" data-testid="fm-location-banner">
          <div className="fm-location-banner-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/>
            </svg>
          </div>
          <div className="fm-location-banner-text">
            <span className="fm-location-banner-label">Website folder</span>
            <span className="fm-location-banner-domain">
              Files here appear at <a href={`https://${user?.domain}`} target="_blank" rel="noopener noreferrer">https://{user?.domain}</a>
            </span>
          </div>
        </div>
      )}

      {/* Getting Started Guide */}
      {showGettingStarted && (
        <div className="fm-getting-started" data-testid="fm-getting-started">
          <div className="fm-gs-header">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Get your website online
            </h3>
            <button onClick={dismissGuide} className="fm-gs-dismiss" title="Dismiss guide">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <p className="fm-gs-subtitle">You're in the right place! Upload your website files here and they'll be live at <strong>https://{user?.domain}</strong></p>
          
          <div className="fm-gs-steps">
            <div className="fm-gs-step">
              <div className="fm-gs-step-num">1</div>
              <div className="fm-gs-step-content">
                <strong>Upload your files</strong>
                <p>Click "Upload" or drag & drop your website files (HTML, CSS, JS, images) into this area. For a full site, upload a <strong>.zip file</strong> and click "Extract".</p>
              </div>
            </div>
            <div className="fm-gs-step">
              <div className="fm-gs-step-num">2</div>
              <div className="fm-gs-step-content">
                <strong>Make sure index.html exists</strong>
                <p>Your main page should be named <strong>index.html</strong> (or index.php). This is what visitors see when they open your domain.</p>
              </div>
            </div>
            <div className="fm-gs-step">
              <div className="fm-gs-step-num">3</div>
              <div className="fm-gs-step-content">
                <strong>Visit your website</strong>
                <p>Once files are uploaded, your site is live at <a href={`https://${user?.domain}`} target="_blank" rel="noopener noreferrer">https://{user?.domain}</a></p>
              </div>
            </div>
          </div>

          <div className="fm-gs-tips">
            <div className="fm-gs-tip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M9 2v6h6V2"/><path d="M12 8v4"/><path d="M9 12h6"/></svg>
              <span><strong>Pro tip:</strong> Zip your entire website folder, upload the .zip, then click "Extract" — much faster than uploading files one by one!</span>
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
                className={`fm-bread-item ${part === 'public_html' ? 'fm-bread-item--highlight' : ''}`}
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {uploading ? 'Uploading...' : 'Upload Files'}
            <input type="file" multiple ref={fileInputRef} onChange={handleUpload} style={{ display: 'none' }} data-testid="fm-upload-input" />
          </label>
        </div>
      </div>

      {/* Upload progress */}
      {uploadProgress && (
        <div className="fm-upload-progress" data-testid="fm-upload-progress">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="fm-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
          <span>{uploadProgress}</span>
        </div>
      )}

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
      
      {successMessage && (
        <div className="fm-success" data-testid="fm-success">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Inline upload tip when folder has few files but not empty */}
      {!loading && !showGettingStarted && isPublicHtmlRoot && files.length <= 3 && !error && !successMessage && (
        <div className="fm-tip" data-testid="fm-bulk-tip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span><strong>Tip:</strong> Upload a <strong>.zip</strong> of your website and click "Extract" to unpack all files at once. Your site goes live at <strong>https://{user?.domain}</strong></span>
        </div>
      )}

      {/* File List */}
      <div className="fm-list" data-testid="fm-file-list">
        {loading ? (
          <div className="fm-loading">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="fm-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
            <span>Loading files...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="fm-empty" data-testid="fm-empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity: 0.4}}>
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            <p>This folder is empty</p>
            {isPublicHtml && <span>Upload your website files here to get started</span>}
          </div>
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
                        {publicUrl && (
                          <>
                            <button 
                              onClick={() => copyUrl(publicUrl, name)} 
                              className={`fm-action-btn ${copiedUrl === name ? 'fm-action-btn--success' : ''}`}
                              title={copiedUrl === name ? 'Copied!' : 'Copy URL'}
                              data-testid={`fm-copy-${name}`}
                            >
                              {copiedUrl === name ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                              )}
                            </button>
                            {!isDir && isWebFile(name) && (
                              <a 
                                href={publicUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="fm-action-btn fm-action-btn--view"
                                title="Open in browser"
                                data-testid={`fm-view-${name}`}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              </a>
                            )}
                          </>
                        )}
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
                        <button onClick={() => openCopyMove('copy', name)} className="fm-action-btn" title="Copy to..." data-testid={`fm-copy-file-${name}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        </button>
                        <button onClick={() => openCopyMove('move', name)} className="fm-action-btn" title="Move to..." data-testid={`fm-move-file-${name}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                        </button>
                        <button onClick={() => handleDelete(name, isDir)} className="fm-action-btn fm-action-btn--danger" title="Delete" data-testid={`fm-delete-${name}`}>
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
                      {publicUrl && (
                        <>
                          <button 
                            onClick={() => copyUrl(publicUrl, name)} 
                            className={`fm-action-chip ${copiedUrl === name ? 'fm-action-chip--success' : ''}`}
                            data-testid={`fm-copy-mobile-${name}`}
                          >
                            {copiedUrl === name ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                            )}
                            <span>{copiedUrl === name ? 'Copied!' : 'Copy URL'}</span>
                          </button>
                          {!isDir && isWebFile(name) && (
                            <a 
                              href={publicUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="fm-action-chip fm-action-chip--view"
                              data-testid={`fm-view-mobile-${name}`}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              <span>View</span>
                            </a>
                          )}
                        </>
                      )}
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
                          <span>Extract</span>
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
                      <button onClick={() => openCopyMove('copy', name)} className="fm-action-chip" data-testid={`fm-copy-file-mobile-${name}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        <span>Copy</span>
                      </button>
                      <button onClick={() => openCopyMove('move', name)} className="fm-action-chip" data-testid={`fm-move-file-mobile-${name}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                        <span>Move</span>
                      </button>
                      <button onClick={() => handleDelete(name, isDir)} className="fm-action-chip fm-action-chip--danger" data-testid={`fm-delete-mobile-${name}`}>
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

      {/* Copy/Move Modal */}
      {copyMoveAction && (
        <div className="fm-modal-overlay" data-testid="fm-copymove-modal">
          <div className="fm-modal fm-modal--sm">
            <div className="fm-modal-header">
              <span>{copyMoveAction.type === 'copy' ? 'Copy' : 'Move'}: {copyMoveAction.fileName}</span>
              <button onClick={() => setCopyMoveAction(null)} className="fm-modal-close">&times;</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#94a3b8' }}>
                Destination folder:
              </label>
              <input
                type="text"
                className="fm-rename-input"
                value={destDir}
                onChange={(e) => setDestDir(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCopyMove()}
                placeholder={`/home/${user?.username}/public_html`}
                data-testid="fm-copymove-input"
                autoFocus
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                Enter the full path where you want to {copyMoveAction.type} the file.
              </div>
            </div>
            <div className="fm-modal-actions">
              <button onClick={() => setCopyMoveAction(null)} className="fm-btn fm-btn--ghost">Cancel</button>
              <button onClick={handleCopyMove} className="fm-btn fm-btn--primary" data-testid="fm-copymove-submit">
                {copyMoveAction.type === 'copy' ? 'Copy' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fm-modal-overlay" data-testid="fm-delete-modal">
          <div className="fm-modal fm-modal--sm">
            <div className="fm-modal-header">
              <span>Delete {deleteTarget.isDir ? 'folder' : 'file'}?</span>
              <button onClick={() => !deleting && setDeleteTarget(null)} className="fm-modal-close" data-testid="fm-delete-close">&times;</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 14, color: '#e2e8f0', wordBreak: 'break-all', marginBottom: 12 }} data-testid="fm-delete-target-name">
                {deleteTarget.fileName}
              </div>
              {deleteTarget.isDir && (
                <div style={{ fontSize: 13, color: '#fca5a5', marginBottom: 8 }}>
                  This will permanently delete the folder and everything inside it.
                </div>
              )}
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                This cannot be undone.
              </div>
            </div>
            <div className="fm-modal-actions">
              <button
                onClick={() => setDeleteTarget(null)}
                className="fm-btn fm-btn--ghost"
                disabled={deleting}
                data-testid="fm-delete-cancel"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="fm-btn fm-btn--primary"
                disabled={deleting}
                data-testid="fm-delete-confirm"
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
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
