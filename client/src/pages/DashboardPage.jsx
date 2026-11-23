import React, { useState } from 'react';
import {
  Bot,
  Play,
  Square,
  RotateCw,
  Terminal,
  Plus,
  Search,
  Cpu,
  HardDrive,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import IconButton from '../components/IconButton';
import { api, formatBytes, formatUptime } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage({ bots, onSelectBot, onRefresh, onOpenProvision }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  const filtered = bots.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.runtime || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.ownerUsername || '').toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = bots.filter((b) => b.runtimeState?.status === 'online').length;

  async function quickPower(e, botId, action) {
    e.stopPropagation();
    setBusyId(botId);
    try {
      await api(`/api/bots/${botId}/power`, {
        method: 'POST',
        body: { action },
      });
      await onRefresh();
    } catch {}
    setBusyId(null);
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Bot Instances</h1>
          <p className="text-xs font-mono text-zinc-500 mt-1">
            {onlineCount} ONLINE · {bots.length} TOTAL SERVERS · NATIVE ENGINE
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bots..."
              className="bg-[#08080b] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white/35 w-52"
            />
          </div>
          {user?.role === 'admin' && (
            <IconButton
              icon={Plus}
              label="Serve Bot"
              active
              onClick={onOpenProvision}
            />
          )}
        </div>
      </div>

      {/* Bot Cards Grid */}
      {filtered.length === 0 ? (
        <div className="obsidian-card rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
            <Bot size={22} />
          </div>
          <div className="text-sm font-medium text-white">No bot instances found</div>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            {user?.role === 'admin'
              ? 'Click "Serve Bot" above to allocate a new Node.js or Python bot server.'
              : 'Ask your administrator to provision a bot instance for your account.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((bot, idx) => {
            const rt = bot.runtimeState || {};
            const isOnline = rt.status === 'online';
            const memPct = Math.min(
              100,
              Math.round(((rt.memoryBytes || 0) / ((bot.limits?.memoryMb || 512) * 1048576)) * 100)
            );

            return (
              <div
                key={bot.id}
                onClick={() => onSelectBot(bot.id)}
                style={{ animationDelay: `${idx * 45}ms` }}
                className="obsidian-card obsidian-card-interactive rounded-2xl p-5 cursor-pointer flex flex-col justify-between gap-4 animate-fade-up"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-300 ${
                          isOnline
                            ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.35)]'
                            : 'bg-white/[0.04] text-zinc-400 border-white/10'
                        }`}
                      >
                        <Bot size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {bot.name}
                        </h3>
                        <div className="text-[11px] font-mono text-zinc-500 truncate">
                          {bot.runtime?.toUpperCase()} · @{bot.ownerUsername}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={rt.status || bot.status} />
                  </div>

                  <p className="text-xs text-zinc-400 line-clamp-2 min-h-[32px]">
                    {bot.description || bot.startupCommand}
                  </p>

                  {/* Resource Bars */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-zinc-500 flex items-center gap-1.5">
                        <Cpu size={11} /> RAM
                      </span>
                      <span className="text-zinc-300">
                        {isOnline ? formatBytes(rt.memoryBytes) : '0 B'} / {bot.limits?.memoryMb || 512} MB
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full bg-white transition-all duration-500 rounded-full"
                        style={{ width: `${isOnline ? memPct : 0}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                      <span className="text-zinc-500 flex items-center gap-1.5">
                        <HardDrive size={11} /> Disk
                      </span>
                      <span className="text-zinc-300">
                        {formatBytes(bot.diskUsedBytes)} ·{' '}
                        {isOnline ? `Up ${formatUptime(rt.uptimeSeconds)}` : 'Idle'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Icons */}
                <div
                  className="pt-3 border-t border-white/[0.07] flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5">
                    <IconButton
                      icon={Play}
                      title="Start Bot"
                      size={14}
                      className="!p-2"
                      active={isOnline}
                      disabled={busyId === bot.id || isOnline || bot.suspended}
                      onClick={(e) => quickPower(e, bot.id, 'start')}
                    />
                    <IconButton
                      icon={RotateCw}
                      title="Restart Bot"
                      size={14}
                      className="!p-2"
                      disabled={busyId === bot.id || bot.suspended}
                      onClick={(e) => quickPower(e, bot.id, 'restart')}
                    />
                    <IconButton
                      icon={Square}
                      title="Stop Bot"
                      size={14}
                      className="!p-2"
                      disabled={busyId === bot.id || !isOnline}
                      onClick={(e) => quickPower(e, bot.id, 'stop')}
                    />
                  </div>

                  <IconButton
                    icon={Terminal}
                    label="Open"
                    size={14}
                    onClick={() => onSelectBot(bot.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
