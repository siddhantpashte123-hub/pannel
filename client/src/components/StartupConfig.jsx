import React, { useState } from 'react';
import { Save, Plus, Trash2, TerminalSquare, ShieldAlert } from 'lucide-react';
import IconButton from './IconButton';
import { api } from '../api/client';

export default function StartupConfig({ bot, onBotUpdate }) {
  const [name, setName] = useState(bot.name);
  const [description, setDescription] = useState(bot.description || '');
  const [runtime, setRuntime] = useState(bot.runtime || 'nodejs');
  const [startupCommand, setStartupCommand] = useState(bot.startupCommand || 'node index.js');
  const [autoRestart, setAutoRestart] = useState(Boolean(bot.autoRestart));
  const [envPairs, setEnvPairs] = useState(
    Object.entries(bot.env || {}).map(([key, value]) => ({ key, value: String(value) }))
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function addEnvRow() {
    setEnvPairs((prev) => [...prev, { key: '', value: '' }]);
  }

  function removeEnvRow(idx) {
    setEnvPairs((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateEnvRow(idx, field, val) {
    setEnvPairs((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row))
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const envObj = {};
    for (const row of envPairs) {
      const k = row.key.trim();
      if (k) envObj[k] = row.value;
    }

    try {
      const data = await api(`/api/bots/${bot.id}/startup`, {
        method: 'PATCH',
        body: {
          name,
          description,
          runtime,
          startupCommand,
          autoRestart,
          env: envObj,
        },
      });
      if (data.bot && onBotUpdate) onBotUpdate(data.bot);
      setMessage('Startup configuration saved. Restart bot to apply changes.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 animate-fade-up">
      <div className="obsidian-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center">
            <TerminalSquare size={16} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">Native Execution & Runtime</h3>
            <p className="text-xs text-zinc-500">
              Runs directly on Linux without Docker overhead.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Bot Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/40"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Runtime Engine
            </label>
            <select
              value={runtime}
              onChange={(e) => setRuntime(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/40"
            >
              <option value="nodejs">Node.js (v18/v20/v22)</option>
              <option value="python">Python 3</option>
              <option value="bash">Bash / Shell</option>
              <option value="custom">Custom Binary</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
            Startup Command
          </label>
          <input
            type="text"
            value={startupCommand}
            onChange={(e) => setStartupCommand(e.target.value)}
            placeholder="e.g. node index.js or python3 bot.py"
            className="w-full bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-white/40"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/40"
          />
        </div>

        <label className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] cursor-pointer">
          <div>
            <div className="text-sm font-medium text-white">Auto-Restart on Crash</div>
            <div className="text-xs text-zinc-500">
              Automatically reboot process if it exits with a non-zero status.
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoRestart}
            onChange={(e) => setAutoRestart(e.target.checked)}
            className="w-4 h-4 accent-white"
          />
        </label>
      </div>

      {/* Environment Variables */}
      <div className="obsidian-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Environment Variables</h3>
            <p className="text-xs text-zinc-500">
              Injected securely into your bot process (e.g. DISCORD_TOKEN, BOT_PREFIX).
            </p>
          </div>
          <IconButton icon={Plus} label="Add Variable" onClick={addEnvRow} />
        </div>

        <div className="space-y-2.5">
          {envPairs.length === 0 ? (
            <div className="text-xs font-mono text-zinc-500 py-4 text-center border border-dashed border-white/10 rounded-xl">
              No environment variables configured.
            </div>
          ) : (
            envPairs.map((pair, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={pair.key}
                  onChange={(e) => updateEnvRow(idx, 'key', e.target.value)}
                  placeholder="KEY"
                  className="w-1/3 bg-black border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/40"
                />
                <input
                  type="text"
                  value={pair.value}
                  onChange={(e) => updateEnvRow(idx, 'value', e.target.value)}
                  placeholder="VALUE"
                  className="flex-1 bg-black border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/40"
                />
                <IconButton
                  icon={Trash2}
                  size={14}
                  className="!p-2"
                  onClick={() => removeEnvRow(idx)}
                  title="Remove"
                />
              </div>
            ))
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
          <ShieldAlert size={14} /> {error}
        </div>
      )}
      {message && (
        <div className="p-3 rounded-xl bg-white/[0.06] border border-white/20 text-xs text-white font-mono">
          {message}
        </div>
      )}

      <div className="flex justify-end">
        <IconButton
          icon={Save}
          type="submit"
          active
          disabled={saving}
          label={saving ? 'Saving...' : 'Save Configuration'}
        />
      </div>
    </form>
  );
}
