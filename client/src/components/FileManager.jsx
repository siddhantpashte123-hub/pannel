import React, { useEffect, useRef, useState } from 'react';
import {
  Folder,
  FileCode2,
  FileArchive,
  FilePlus,
  FolderPlus,
  Upload,
  FolderUp,
  PackageOpen,
  Trash2,
  ArrowLeft,
  Save,
  RefreshCw,
  Edit3,
  CloudUpload,
} from 'lucide-react';
import IconButton from './IconButton';
import Modal from './Modal';
import { api, formatBytes } from '../api/client';

async function readEntryFiles(entry, prefix = '') {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file(
        (file) => {
          const rel = prefix ? `${prefix}/${file.name}` : file.name;
          resolve([{ file, relativePath: rel }]);
        },
        () => resolve([])
      );
    });
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const dirPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const allEntries = [];
    const readBatch = () =>
      new Promise((resolve) => {
        reader.readEntries(
          (batch) => resolve(batch),
          () => resolve([])
        );
      });

    while (true) {
      const batch = await readBatch();
      if (!batch || batch.length === 0) break;
      allEntries.push(...batch);
    }

    const nested = await Promise.all(
      allEntries.map((child) => readEntryFiles(child, dirPrefix))
    );
    return nested.flat();
  }
  return [];
}

export default function FileManager({ bot }) {
  const [cwd, setCwd] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [autoExtract, setAutoExtract] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Editor state
  const [editingFile, setEditingFile] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  // Modals
  const [newFileModal, setNewFileModal] = useState(false);
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameVal, setRenameVal] = useState('');

  // Extract modal
  const [extractTarget, setExtractTarget] = useState(null);
  const [extractDest, setExtractDest] = useState('');
  const [deleteAfterExtract, setDeleteAfterExtract] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const uploadRef = useRef(null);
  const folderUploadRef = useRef(null);
  const dragDepthRef = useRef(0);

  async function loadDir(dirPath = cwd) {
    setLoading(true);
    setError('');
    try {
      const data = await api(
        `/api/bots/${bot.id}/files?path=${encodeURIComponent(dirPath)}`
      );
      setFiles(data.files || []);
      setCwd(dirPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDir('');
  }, [bot.id]);

  function showNotice(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  }

  async function uploadEntries(entries) {
    if (!entries || entries.length === 0) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('dir', cwd);
      fd.append('autoExtract', String(autoExtract));
      const relPaths = [];
      for (const item of entries) {
        fd.append('files', item.file);
        relPaths.push(item.relativePath || item.file.name);
      }
      fd.append('relativePaths', JSON.stringify(relPaths));

      const res = await api(`/api/bots/${bot.id}/files/upload`, {
        method: 'POST',
        body: fd,
      });
      const extCount = (res.extracted || []).reduce(
        (acc, x) => acc + (x.extractedCount || 0),
        0
      );
      if (extCount > 0) {
        showNotice(
          `Uploaded ${res.uploaded.length} item(s) & auto-extracted ${extCount} archived file(s).`
        );
      } else {
        showNotice(`Uploaded ${res.uploaded.length} file(s) successfully.`);
      }
      await loadDir(cwd);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleFileInput(e) {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    const entries = picked.map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
    }));
    e.target.value = '';
    await uploadEntries(entries);
  }

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (e.dataTransfer?.types?.includes('Files')) {
      setDragging(true);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragging(false);
    }
  }

  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDragging(false);

    const items = Array.from(e.dataTransfer?.items || []);
    if (items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
      const entryLists = await Promise.all(
        items
          .map((it) => it.webkitGetAsEntry())
          .filter(Boolean)
          .map((entry) => readEntryFiles(entry, ''))
      );
      const flat = entryLists.flat();
      if (flat.length > 0) {
        await uploadEntries(flat);
        return;
      }
    }

    const droppedFiles = Array.from(e.dataTransfer?.files || []);
    if (droppedFiles.length > 0) {
      await uploadEntries(
        droppedFiles.map((file) => ({ file, relativePath: file.name }))
      );
    }
  }

  async function openFile(file) {
    setError('');
    try {
      const data = await api(
        `/api/bots/${bot.id}/files/content?path=${encodeURIComponent(file.path)}`
      );
      setEditingFile(file.path);
      setEditorContent(data.content);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveFile() {
    if (!editingFile) return;
    setSaving(true);
    setError('');
    try {
      await api(`/api/bots/${bot.id}/files/content`, {
        method: 'PUT',
        body: { path: editingFile, content: editorContent },
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 1800);
      loadDir(cwd);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateFile(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const rel = cwd ? `${cwd}/${newName.trim()}` : newName.trim();
    try {
      await api(`/api/bots/${bot.id}/files/content`, {
        method: 'PUT',
        body: { path: rel, content: '' },
      });
      setNewFileModal(false);
      setNewName('');
      await loadDir(cwd);
      setEditingFile(rel);
      setEditorContent('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateFolder(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const rel = cwd ? `${cwd}/${newName.trim()}` : newName.trim();
    try {
      await api(`/api/bots/${bot.id}/files/mkdir`, {
        method: 'POST',
        body: { path: rel },
      });
      setNewFolderModal(false);
      setNewName('');
      loadDir(cwd);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(item) {
    try {
      await api(
        `/api/bots/${bot.id}/files?path=${encodeURIComponent(item.path)}`,
        { method: 'DELETE' }
      );
      loadDir(cwd);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRename(e) {
    e.preventDefault();
    if (!renameTarget || !renameVal.trim()) return;
    const parent = renameTarget.path.includes('/')
      ? renameTarget.path.slice(0, renameTarget.path.lastIndexOf('/'))
      : '';
    const newPath = parent ? `${parent}/${renameVal.trim()}` : renameVal.trim();
    try {
      await api(`/api/bots/${bot.id}/files/rename`, {
        method: 'POST',
        body: { oldPath: renameTarget.path, newPath },
      });
      setRenameTarget(null);
      setRenameVal('');
      loadDir(cwd);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleExtract(e) {
    e.preventDefault();
    if (!extractTarget) return;
    setExtracting(true);
    setError('');
    try {
      const res = await api(`/api/bots/${bot.id}/files/extract`, {
        method: 'POST',
        body: {
          path: extractTarget.path,
          destination: extractDest.trim(),
          deleteAfter: deleteAfterExtract,
        },
      });
      setExtractTarget(null);
      showNotice(
        `Extracted ${res.extractedCount} file(s) from ${extractTarget.name} into /${
          res.destination === '/' ? 'root' : res.destination
        }.`
      );
      await loadDir(cwd);
    } catch (err) {
      setError(err.message);
    } finally {
      setExtracting(false);
    }
  }

  function goUp() {
    if (!cwd) return;
    const parts = cwd.split('/');
    parts.pop();
    loadDir(parts.join('/'));
  }

  if (editingFile !== null) {
    return (
      <div className="space-y-3 animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconButton
              icon={ArrowLeft}
              label="Back"
              onClick={() => setEditingFile(null)}
            />
            <span className="text-xs font-mono text-zinc-300 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10">
              /{editingFile}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {savedNotice && (
              <span className="text-xs font-mono text-emerald-400">Saved</span>
            )}
            <IconButton
              icon={Save}
              label={saving ? 'Saving...' : 'Save File'}
              active
              disabled={saving}
              onClick={saveFile}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
            {error}
          </div>
        )}

        <div className="obsidian-card rounded-2xl overflow-hidden border border-white/10">
          <textarea
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveFile();
              }
            }}
            spellCheck={false}
            className="w-full h-[440px] bg-[#030305] text-zinc-100 font-mono text-xs leading-6 p-4 focus:outline-none resize-y"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative space-y-4 animate-fade-up"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Full Overlay */}
      {dragging && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="w-full max-w-lg rounded-3xl border-2 border-dashed border-white/70 bg-[#070709] p-10 text-center shadow-[0_0_60px_rgba(255,255,255,0.18)] animate-scale-in">
            <div className="w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center mx-auto mb-4 shadow-[0_0_25px_rgba(255,255,255,0.6)]">
              <CloudUpload size={30} />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Drop Files, Folders, or Archives Here
            </h3>
            <p className="text-xs font-mono text-zinc-400 mt-1.5">
              Uploading into /{cwd || 'root'} ·{' '}
              {autoExtract ? 'Auto-Extract ZIP/TAR ON' : 'Manual Extract'}
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {cwd && <IconButton icon={ArrowLeft} onClick={goUp} title="Up" />}
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs font-mono text-zinc-300">
            /{cwd || 'root'}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <IconButton
            icon={FilePlus}
            label="New File"
            onClick={() => {
              setNewName('');
              setNewFileModal(true);
            }}
          />
          <IconButton
            icon={FolderPlus}
            label="New Folder"
            onClick={() => {
              setNewName('');
              setNewFolderModal(true);
            }}
          />
          <IconButton
            icon={Upload}
            label="Upload Files"
            onClick={() => uploadRef.current?.click()}
          />
          <IconButton
            icon={FolderUp}
            label="Upload Folder"
            onClick={() => folderUploadRef.current?.click()}
          />
          <IconButton
            icon={RefreshCw}
            title="Refresh"
            onClick={() => loadDir(cwd)}
          />
          <input
            ref={uploadRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
          <input
            ref={folderUploadRef}
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      </div>

      {/* Compact Dropzone Bar + Auto-Extract Toggle */}
      <div className="obsidian-card rounded-2xl px-4 py-3 border border-dashed border-white/15 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-white">
            <CloudUpload size={16} />
          </span>
          <div className="text-xs">
            <span className="text-zinc-200 font-medium">
              {uploading
                ? 'Uploading files to native bot directory...'
                : 'Drag & drop files, entire folders, or .zip / .tar.gz archives anywhere here'}
            </span>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoExtract}
            onChange={(e) => setAutoExtract(e.target.checked)}
            className="w-3.5 h-3.5 accent-white"
          />
          <span>Auto-extract archives on drop</span>
        </label>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-white/[0.07] border border-white/25 text-xs text-white font-mono animate-scale-in">
          {notice}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      {/* File List */}
      <div className="obsidian-card rounded-2xl overflow-hidden divide-y divide-white/[0.06]">
        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-zinc-500">
            Loading files...
          </div>
        ) : files.length === 0 ? (
          <div className="p-10 text-center text-xs font-mono text-zinc-500">
            Directory is empty. Drag & drop a folder or `.zip` bot archive here to begin.
          </div>
        ) : (
          files.map((item) => {
            const isArch = item.isArchive || /\.(zip|tar|tar\.gz|tgz|tar\.bz2|tar\.xz)$/i.test(item.name);
            return (
              <div
                key={item.path}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (item.isDirectory) loadDir(item.path);
                    else if (isArch) {
                      setExtractTarget(item);
                      setExtractDest(cwd);
                      setDeleteAfterExtract(false);
                    } else openFile(item);
                  }}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <span className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:border-white/25 transition-all">
                    {item.isDirectory ? (
                      <Folder size={15} />
                    ) : isArch ? (
                      <FileArchive size={15} />
                    ) : (
                      <FileCode2 size={15} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-200 group-hover:text-white truncate transition-colors">
                      {item.name}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500">
                      {item.isDirectory
                        ? 'Directory'
                        : isArch
                        ? `Archive · ${formatBytes(item.size)}`
                        : formatBytes(item.size)}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1.5">
                  {isArch && (
                    <IconButton
                      icon={PackageOpen}
                      label="Unarchive"
                      title="Extract / Unarchive"
                      size={14}
                      onClick={() => {
                        setExtractTarget(item);
                        setExtractDest(cwd);
                        setDeleteAfterExtract(false);
                      }}
                    />
                  )}
                  <IconButton
                    icon={Edit3}
                    title="Rename"
                    size={14}
                    className="!p-2"
                    onClick={() => {
                      setRenameTarget(item);
                      setRenameVal(item.name);
                    }}
                  />
                  <IconButton
                    icon={Trash2}
                    title="Delete"
                    size={14}
                    className="!p-2"
                    onClick={() => handleDelete(item)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Extract / Unarchive Modal */}
      <Modal
        open={Boolean(extractTarget)}
        onClose={() => setExtractTarget(null)}
        title="Unarchive / Extract Files"
        subtitle={extractTarget ? `Archive: /${extractTarget.path}` : ''}
      >
        <form onSubmit={handleExtract} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1.5">
              Destination Folder (relative to bot root)
            </label>
            <input
              type="text"
              value={extractDest}
              onChange={(e) => setExtractDest(e.target.value)}
              placeholder="Leave empty for bot root /"
              className="w-full bg-black border border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-white/50"
            />
          </div>

          <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] cursor-pointer">
            <span className="text-xs text-zinc-300">
              Delete archive file after extracting
            </span>
            <input
              type="checkbox"
              checked={deleteAfterExtract}
              onChange={(e) => setDeleteAfterExtract(e.target.checked)}
              className="w-4 h-4 accent-white"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setExtractTarget(null)}
              className="px-4 py-2 rounded-xl border border-white/10 text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={extracting}
              className="px-5 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 disabled:opacity-50"
            >
              {extracting ? 'Extracting...' : 'Extract Archive'}
            </button>
          </div>
        </form>
      </Modal>

      {/* New File Modal */}
      <Modal
        open={newFileModal}
        onClose={() => setNewFileModal(false)}
        title="Create New File"
        subtitle={`Location: /${cwd || 'root'}`}
      >
        <form onSubmit={handleCreateFile} className="space-y-4">
          <input
            type="text"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. index.js, .env, bot.py"
            className="w-full bg-black border border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-white/50"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewFileModal(false)}
              className="px-4 py-2 rounded-xl border border-white/10 text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200"
            >
              Create & Edit
            </button>
          </div>
        </form>
      </Modal>

      {/* New Folder Modal */}
      <Modal
        open={newFolderModal}
        onClose={() => setNewFolderModal(false)}
        title="Create Directory"
        subtitle={`Location: /${cwd || 'root'}`}
      >
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <input
            type="text"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. commands, cogs, utils"
            className="w-full bg-black border border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-white/50"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewFolderModal(false)}
              className="px-4 py-2 rounded-xl border border-white/10 text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200"
            >
              Create Folder
            </button>
          </div>
        </form>
      </Modal>

      {/* Rename Modal */}
      <Modal
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title="Rename Entry"
      >
        <form onSubmit={handleRename} className="space-y-4">
          <input
            type="text"
            autoFocus
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            className="w-full bg-black border border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-white/50"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRenameTarget(null)}
              className="px-4 py-2 rounded-xl border border-white/10 text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200"
            >
              Rename
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
