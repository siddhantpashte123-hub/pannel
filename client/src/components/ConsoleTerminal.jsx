import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  RotateCw,
  Square,
  Skull,
  Trash2,
  Send,
  Package,
  ArrowDownToLine,
  Cpu,
  HardDrive,
  Clock,
  Activity,
} from 'lucide-react';
import IconButton from './IconButton';
import { api, formatBytes, formatUptime } from '../api/client';

export default function ConsoleTerminal({ bot, logs, onClearLogs, onBotUpdate }) {
  const [command, setCommand] = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [powerBusy, setPowerBusy] = useState(false);
  const [pkgCmd, setPkgCmd] = useState(
    bot.runtime === 'python' ? 'pip3 install -r requirements.txt' : 'npm install'
  );
  const [showPkgBar, setShowPkgBar] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const scrollRef = useRef(null);

  const rt = bot.runtimeState || {};
  const isOnline = rt.status === 'online';

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  async function triggerPower(action) {
    setPowerBusy(true);
    setErrMsg('');
    try {
      const data = await api(`/api/bots/${bot.id}/power`, {
        method: 'POST',
        body: { action },
      });
      if (data.bot && onBotUpdate) onBotUpdate(data.bot);
    } catch (err) {
      setErrMsg(err.message);
    } finally {
      setPowerBusy(false);
    }
  }

  async function handleSendCommand(e) {
    e.preventDefault();
    if (!command.trim()) return;
    const cmd = command.trim();
    setCommand('');
    setCmdHistory((prev) => [cmd, ...prev.slice(0, 30)]);
    setHistIdx(-1);
    setErrMsg('');
    try {
      await api(`/api/bots/${bot.id}/command`, {
        method: 'POST',
        body: { command: cmd },
      });
    } catch (err) {
      setErrMsg(err.message);
    }
  }

  async function handleClear() {
    try {
      await api(`/api/bots/${bot.id}/logs`, { method: 'DELETE' });
      if (onClearLogs) onClearLogs();
    } catch {}
  }

  async function handleInstallDeps(e) {
    e.preventDefault();
    setErrMsg('');
    try {
      await api(`/api/bots/${bot.id}/install-deps`, {
        method: 'POST',
        body: { command: pkgCmd },
      });
      setShowPkgBar(false);
    } catch (err) {
      setErrMsg(err.message);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(cmdHistory.length - 1, histIdx + 1);
      if (cmdHistory[next] !== undefined) {
        setHistIdx(next);
        setCommand(cmdHistory[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = histIdx - 1;
      if (next < 0) {
        setHistIdx(-1);
        setCommand('');
      } else {
        setHistIdx(next);
        setCommand(cmdHistory[next] || '');
      }
    }
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Live Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="obsidian-card rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-white">
            <Cpu size={16} />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">CPU Load</div>
            <div className="text-sm font-mono font-semibold text-white">
              {isOnline ? `${rt.cpuPercent ?? 0}%` : '0.0%'}
              <span className="text-[11px] text-zinc-500 ml-1">/ {bot.limits?.cpuPercent || 100}%</span>
            </div>
          </div>
        </div>

        <div className="obsidian-card rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-white">
            <Activity size={16} />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Memory</div>
            <div className="text-sm font-mono font-semibold text-white">
              {isOnline ? formatBytes(rt.memoryBytes) : '0 B'}
              <span className="text-[11px] text-zinc-500 ml-1">/ {bot.limits?.memoryMb || 512} MB</span>
            </div>
          </div>
        </div>

        <div className="obsidian-card rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-white">
            <HardDrive size={16} />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Storage</div>
            <div className="text-sm font-mono font-semibold text-white">
              {formatBytes(bot.diskUsedBytes)}
              <span className="text-[11px] text-zinc-500 ml-1">/ {bot.limits?.diskMb || 2048} MB</span>
            </div>
          </div>
        </div>

        <div className="obsidian-card rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-white">
            <Clock size={16} />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Uptime / PID</div>
            <div className="text-sm font-mono font-semibold text-white">
              {isOnline ? formatUptime(rt.uptimeSeconds) : 'Offline'}
              {rt.pid ? <span className="text-[11px] text-zinc-500 ml-1.5">#{rt.pid}</span> : null}
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <IconButton
            icon={Play}
            label="Start"
            active={isOnline}
            disabled={powerBusy || isOnline || bot.suspended}
            onClick={() => triggerPower('start')}
          />
          <IconButton
            icon={RotateCw}
            label="Restart"
            disabled={powerBusy || bot.suspended}
            onClick={() => triggerPower('restart')}
          />
          <IconButton
            icon={Square}
            label="Stop"
            disabled={powerBusy || !isOnline}
            onClick={() => triggerPower('stop')}
          />
          <IconButton
            icon={Skull}
            label="Kill"
            disabled={powerBusy || !isOnline}
            onClick={() => triggerPower('kill')}
          />
        </div>

        <div className="flex items-center gap-2">
          <IconButton
            icon={Package}
            label="Install Deps"
            active={showPkgBar}
            onClick={() => setShowPkgBar((v) => !v)}
          />
          <IconButton
            icon={ArrowDownToLine}
            title="Toggle Auto-Scroll"
            active={autoScroll}
            onClick={() => setAutoScroll((v) => !v)}
          />
          <IconButton icon={Trash2} title="Clear Console" onClick={handleClear} />
        </div>
      </div>

      {showPkgBar && (
        <form
          onSubmit={handleInstallDeps}
          className="obsidian-card rounded-xl p-3 flex flex-wrap items-center gap-2 animate-scale-in border border-white/15"
        >
          <input
            type="text"
            value={pkgCmd}
            onChange={(e) => setPkgCmd(e.target.value)}
            placeholder="npm install or pip3 install -r requirements.txt"
            className="flex-1 min-w-[220px] bg-black border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/40"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition"
          >
            Run Installer
          </button>
        </form>
      )}

      {errMsg && (
        <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
          {errMsg}
        </div>
      )}

      {/* Terminal Screen */}
      <div className="obsidian-card rounded-2xl overflow-hidden border border-white/10">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#060608] border-b border-white/[0.07]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <span className="ml-2 text-[11px] font-mono text-zinc-400">
              {bot.name} — {bot.startupCommand}
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">NATIVE PTY STREAM</span>
        </div>

        <div
          ref={scrollRef}
          className="h-[380px] overflow-y-auto p-4 bg-[#020203] font-mono text-xs leading-relaxed space-y-1"
        >
          {logs.length === 0 ? (
            <div className="text-zinc-600 py-8 text-center">
              Console buffer is empty. Click <span className="text-zinc-300">Start</span> to launch this bot natively.
            </div>
          ) : (
            logs.map((entry, idx) => {
              let color = 'text-zinc-300';
              if (entry.stream === 'stderr') color = 'text-rose-400';
              else if (entry.stream === 'system') color = 'text-zinc-400';
              else if (entry.stream === 'stdin') color = 'text-white font-semibold';
              return (
                <div key={idx} className={`whitespace-pre-wrap break-words ${color}`}>
                  {entry.text}
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={handleSendCommand}
          className="flex items-center gap-2 px-3 py-2.5 bg-[#060608] border-t border-white/[0.08]"
        >
          <span className="text-white font-mono text-sm pl-1">&gt;</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isOnline}
            placeholder={isOnline ? 'Type a command to send to bot stdin...' : 'Start bot to send stdin commands...'}
            className="flex-1 bg-transparent text-xs font-mono text-white placeholder-zinc-600 focus:outline-none disabled:opacity-50"
          />
          <IconButton icon={Send} type="submit" disabled={!isOnline} title="Send Command" size={14} className="!p-2" />
        </form>
      </div>
    </div>
  );
}
