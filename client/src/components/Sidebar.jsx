import React from 'react';
import {
  Bot,
  ShieldCheck,
  Users,
  Cpu,
  KeyRound,
  LogOut,
  Sparkles,
} from 'lucide-react';
import IconButton from './IconButton';
import ObsidianLogo from './ObsidianLogo';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ activeView, onNavigate }) {
  const { user, settings, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-[#050507] flex flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Brand */}
        <div
          onClick={() => onNavigate('bots')}
          className="flex items-center gap-3 px-2 py-1.5 cursor-pointer group"
        >
          <ObsidianLogo
            size={38}
            className="shrink-0 shadow-[0_0_22px_rgba(255,255,255,0.12)] group-hover:scale-105 group-hover:shadow-[0_0_26px_rgba(255,255,255,0.28)] transition-all duration-300 rounded-xl"
          />
          <div>
            <div className="text-sm font-bold tracking-[0.22em] text-white uppercase">
              {settings?.panelName || 'OBSIDIAN'}
            </div>
            <div className="text-[10px] font-mono tracking-[0.18em] text-zinc-500">
              BOT HOSTING
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1.5">
          <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">
            Workspace
          </div>
          <IconButton
            variant="nav"
            icon={Bot}
            label="Bot Instances"
            active={activeView === 'bots' || activeView === 'bot-detail'}
            onClick={() => onNavigate('bots')}
          />
          <IconButton
            variant="nav"
            icon={KeyRound}
            label="Account Security"
            active={activeView === 'account'}
            onClick={() => onNavigate('account')}
          />

          {isAdmin && (
            <>
              <div className="px-2 pt-4 pb-1 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">
                Administration
              </div>
              <IconButton
                variant="nav"
                icon={ShieldCheck}
                label="Admin Overview"
                active={activeView === 'admin-overview'}
                onClick={() => onNavigate('admin-overview')}
              />
              <IconButton
                variant="nav"
                icon={Users}
                label="Users & Quotas"
                active={activeView === 'admin-users'}
                onClick={() => onNavigate('admin-users')}
              />
              <IconButton
                variant="nav"
                icon={Cpu}
                label="VPS Telemetry"
                active={activeView === 'admin-system'}
                onClick={() => onNavigate('admin-system')}
              />
            </>
          )}
        </nav>
      </div>

      {/* Bottom User Card */}
      <div className="mt-6 pt-4 border-t border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white truncate">{user?.username}</span>
              {isAdmin && (
                <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase rounded bg-white text-black font-bold">
                  ADMIN
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-500 truncate">{user?.email}</div>
          </div>
          <IconButton
            icon={LogOut}
            title="Sign out"
            onClick={logout}
            size={15}
            className="!p-2 shrink-0"
          />
        </div>
        <div className="flex items-center gap-2 px-2 text-[10px] font-mono text-zinc-600">
          <Sparkles size={11} className="text-zinc-500" />
          <span>Native Linux Supervisor</span>
        </div>
      </div>
    </aside>
  );
}
