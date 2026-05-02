import { useEffect } from 'react';

/**
 * File Manager keyboard shortcuts:
 *   '/'                  → focus the search input
 *   Esc                  → cascade close: image preview → modals → search → selection
 *   Ctrl/Cmd + A         → select all visible files (toggles)
 *   Delete / Backspace   → open bulk-delete confirmation when selection non-empty
 *
 * The hook is a thin wrapper around a single window keydown listener; it owns
 * no state — every "if X exists, do Y" branch reads/writes through the
 * setters/refs passed in by the caller.
 */
export default function useHotkeys({
  searchRef,
  visibleFilesRef,
  selected,
  setSelected,
  search,
  setSearch,
  showNewDir,
  setShowNewDir,
  setNewDirName,
  editingFile,
  setEditingFile,
  renaming,
  setRenaming,
  copyMoveAction,
  setCopyMoveAction,
  deleteTarget,
  setDeleteTarget,
  bulkMoveTarget,
  setBulkMoveTarget,
  imagePreview,
  setImagePreview,
  deleting,
}) {
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toUpperCase();
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable;

      if (e.key === '/' && !inField && !editingFile && !renaming && !copyMoveAction && !deleteTarget && !bulkMoveTarget && !imagePreview) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (imagePreview) { setImagePreview(null); return; }
        if (deleteTarget) { if (!deleting) setDeleteTarget(null); return; }
        if (bulkMoveTarget) { setBulkMoveTarget(null); return; }
        if (copyMoveAction) { setCopyMoveAction(null); return; }
        if (renaming) { setRenaming(null); return; }
        if (editingFile) { setEditingFile(null); return; }
        if (showNewDir) { setShowNewDir(false); setNewDirName(''); return; }
        if (search) { setSearch(''); return; }
        if (selected.size > 0) { setSelected(new Set()); return; }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !inField && !editingFile) {
        e.preventDefault();
        const visible = visibleFilesRef.current || [];
        if (selected.size === visible.length && visible.length > 0) {
          setSelected(new Set());
        } else {
          setSelected(new Set(visible.map(f => f.file || f.fullpath?.split('/').pop()).filter(Boolean)));
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !inField && selected.size > 0 && !deleteTarget) {
        e.preventDefault();
        const items = (visibleFilesRef.current || [])
          .filter(f => selected.has(f.file || f.fullpath?.split('/').pop()))
          .map(f => ({ name: f.file || f.fullpath?.split('/').pop(), isDir: f.type === 'dir' }));
        if (items.length) setDeleteTarget({ bulk: true, items });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingFile, renaming, copyMoveAction, deleteTarget, bulkMoveTarget, imagePreview, showNewDir, search, selected, deleting, searchRef, setSelected, setSearch, setShowNewDir, setNewDirName, setEditingFile, setRenaming, setCopyMoveAction, setDeleteTarget, setBulkMoveTarget, setImagePreview, visibleFilesRef]);
}
