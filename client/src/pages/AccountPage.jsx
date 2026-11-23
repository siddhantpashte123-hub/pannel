import React, { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import IconButton from '../components/IconButton';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AccountPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg('');
    setErr('');
    setBusy(true);
    try {
      await api('/api/auth/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setMsg('Password updated successfully.');
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Account Security</h1>
        <p className="text-xs font-mono text-zinc-500 mt-1">
          PROFILE & CREDENTIALS · @{user?.username}
        </p>
      </div>

      <div className="obsidian-card rounded-2xl p-5 grid grid-cols-3 gap-3 text-xs font-mono">
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="text-zinc-500">ROLE</div>
          <div className="text-white mt-0.5 uppercase">{user?.role}</div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="text-zinc-500">MAX BOTS</div>
          <div className="text-white mt-0.5">{user?.maxBots}</div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="text-zinc-500">STATUS</div>
          <div className="text-emerald-400 mt-0.5 uppercase">{user?.status}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="obsidian-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center">
            <KeyRound size={16} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Change Password</h2>
            <p className="text-xs text-zinc-500">Keep your control panel login secure.</p>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1.5">
            Current Password
          </label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/40"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1.5">
            New Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/40"
          />
        </div>

        {err && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
            {err}
          </div>
        )}
        {msg && (
          <div className="p-3 rounded-xl bg-white/[0.06] border border-white/20 text-xs text-white font-mono">
            {msg}
          </div>
        )}

        <div className="flex justify-end">
          <IconButton
            icon={ShieldCheck}
            type="submit"
            active
            disabled={busy}
            label={busy ? 'Updating...' : 'Update Password'}
          />
        </div>
      </form>
    </div>
  );
}
