import React, { useState } from 'react';
import { ArrowRight, Lock, User } from 'lucide-react';
import ObsidianLogo from '../components/ObsidianLogo';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, settings } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black obsidian-grid-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md obsidian-card rounded-3xl p-8 border border-white/15 animate-scale-in">
        <div className="flex flex-col items-center text-center mb-8">
          <ObsidianLogo
            size={58}
            className="mb-4 shadow-[0_0_35px_rgba(255,255,255,0.16)] rounded-2xl"
          />
          <h1 className="text-xl font-bold tracking-[0.28em] text-white uppercase">
            {settings?.panelName || 'OBSIDIAN'}
          </h1>
          <p className="text-xs font-mono tracking-[0.2em] text-zinc-500 mt-1">
            BOT HOSTING CONTROL PANEL
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Username or Email
            </label>
            <div className="relative">
              <User
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="text"
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/40 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/40 transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-zinc-200 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
          >
            <span>{busy ? 'Authenticating...' : 'Enter Control Panel'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-white/[0.07] text-center text-[11px] font-mono text-zinc-600">
          Zero-Docker Process Engine · Ubuntu Native
        </div>
      </div>
    </div>
  );
}
