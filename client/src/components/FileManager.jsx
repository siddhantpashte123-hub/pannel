import React, { useEffect, useRef, useState } from 'react';
import {
  Folder,
  FileCode2,
  FilePlus,
  FolderPlus,
  Upload,
  Trash2,
  ArrowLeft,
  Save,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import IconButton from './IconButton';
import Modal from './Modal';
import { api, formatBytes } from '../api/client';

export default function FileManager({ bot }) {
  const [cwd, setCwd] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
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

  const uploadRef = useRef(null);

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

  async function handleUpload(e) {
    const picked = e.target.files;
    if (!picked || picked.length === 0) return;
    const fd = new FormData();
    fd.append('dir', cwd);
    for (const f of picked) fd.append('files', f);
    try {
      await api(`/api/bots/${bot.id}/files/upload`, {
        method: 'POST',
        body: fd,
      });
      loadDir(cwd);
    } catch (err) {
      setError(err.message);
    } finally {
      e.target.value = '';
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
    <div className="space-y-4 animate-fade-up">
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
            label="Upload"
            onClick={() => uploadRef.current?.click()}
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
            onChange={handleUpload}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      <div className="obsidian-card rounded-2xl overflow-hidden divide-y divide-white/[0.06]">
        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-zinc-500">
            Loading files...
          </div>
        ) : files.length === 0 ? (
          <div className="p-10 text-center text-xs font-mono text-zinc-500">
            Directory is empty. Create a file or upload your bot code.
          </div>
        ) : (
          files.map((item) => (
            <div
              key={item.path}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group"
            >
              <button
                type="button"
                onClick={() =>
                  item.isDirectory ? loadDir(item.path) : openFile(item)
                }
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
              >
                <span className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:border-white/25 transition-all">
                  {item.isDirectory ? <Folder size={15} /> : <FileCode2 size={15} />}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-200 group-hover:text-white truncate transition-colors">
                    {item.name}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500">
                    {item.isDirectory ? 'Directory' : formatBytes(item.size)}
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-1.5">
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
          ))
        )}
      </div>

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
