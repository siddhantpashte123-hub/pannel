import React, { useEffect, useState } from 'react';
import {
  Users,
  Bot,
  Cpu,
  HardDrive,
  Server,
  UserPlus,
  Plus,
  Ban,
  CheckCircle2,
  Trash2,
  Terminal,
  Activity,
  RefreshCw,
} from 'lucide-react';
import IconButton from '../components/IconButton';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { api, formatBytes, formatUptime } from '../api/client';

export function ProvisionBotModal({ open, onClose, users, onCreated }) {
  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [runtime, setRuntime] = useState('nodejs');
  const [startupCommand, setStartupCommand] = useState('node index.js');
  const [memoryMb, setMemoryMb] = useState(512);
  const [cpuPercent, setCpuPercent] = useState(100);
  const [diskMb, setDiskMb] = useState(2048);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && users?.length && !ownerId) {
      setOwnerId(users[0].id);
    }
  }, [open, users]);

  function onRuntimeChange(rt) {
    setRuntime(rt);
    if (rt === 'nodejs') setStartupCommand('node index.js');
    else if (rt === 'python') setStartupCommand('python3 bot.py');
    else if (rt === 'bash') setStartupCommand('bash start.sh');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/api/admin/bots', {
        method: 'POST',
        body: {
          name,
          ownerId: ownerId || users[0]?.id,
          runtime,
          startupCommand,
          memoryMb: Number(memoryMb),
          cpuPercent: Number(cpuPercent),
          diskMb: Number(diskMb),
          description,
        },
      });
      setName('');
      setDescription('');
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Serve New Bot Instance"
      subtitle="Allocate a native Docker-free bot server to any user"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
              Bot Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Discord Music Bot"
              className="w-full bg-black border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/50"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
              Assign To User
            </label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full bg-black border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/50"
            >
              {(users || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.botCount}/{u.maxBots} bots)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
              Runtime
            </label>
            <select
              value={runtime}
              onChange={(e) => onRuntimeChange(e.target.value)}
              className="w-full bg-black border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/50"
            >
              <option value="nodejs">Node.js</option>
              <option value="python">Python 3</option>
              <option value="bash">Bash / Shell</option>
              <option value="custom">Custom Command</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
              Startup Command
            </label>
            <input
              type="text"
              required
              value={startupCommand}
              onChange={(e) => setStartupCommand(e.target.value)}
              className="w-full bg-black border border-white/15 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-white/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
              RAM (MB)
            </label>
            <input
              type="number"
              min="128"
              value={memoryMb}
              onChange={(e) => setMemoryMb(e.target.value)}
              className="w-full bg-black border border-white/15 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-white/50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
              CPU (%)
            </label>
            <input
              type="number"
              min="25"
              value={cpuPercent}
              onChange={(e) => setCpuPercent(e.target.value)}
              className="w-full bg-black border border-white/15 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-white/50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
              Disk (MB)
            </label>
            <input
              type="number"
              min="256"
              value={diskMb}
              onChange={(e) => setDiskMb(e.target.value)}
              className="w-full bg-black border border-white/15 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-white/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
            Description (Optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Client bot service notes..."
            className="w-full bg-black border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/50"
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-white/10 text-xs text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 disabled:opacity-50"
          >
            {busy ? 'Provisioning...' : 'Create & Serve Bot'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminPage({ mode, onSelectBot, onGlobalRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);

  // Create User form
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPass, setUPass] = useState('');
  const [uRole, setURole] = useState('user');
  const [uMaxBots, setUMaxBots] = useState(5);
  const [uErr, setUErr] = useState('');

  async function loadOverview() {
    try {
      const res = await api('/api/admin/overview');
      setData(res);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    loadOverview();
    const t = setInterval(loadOverview, 5000);
    return () => clearInterval(t);
  }, []);

  async function handleCreateUser(e) {
    e.preventDefault();
    setUErr('');
    try {
      await api('/api/admin/users', {
        method: 'POST',
        body: {
          username: uName,
          email: uEmail,
          password: uPass,
          role: uRole,
          maxBots: Number(uMaxBots),
        },
      });
      setUName('');
      setUEmail('');
      setUPass('');
      setUserModalOpen(false);
      loadOverview();
    } catch (err) {
      setUErr(err.message);
    }
  }

  async function toggleUserSuspend(u) {
    const next = u.status === 'suspended' ? 'active' : 'suspended';
    await api(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      body: { status: next },
    });
    loadOverview();
  }

  async function deleteUser(u) {
    await api(`/api/admin/users/${u.id}`, { method: 'DELETE' });
    loadOverview();
    if (onGlobalRefresh) onGlobalRefresh();
  }

  async function toggleBotSuspend(b) {
    await api(`/api/admin/bots/${b.id}`, {
      method: 'PATCH',
      body: { suspended: !b.suspended },
    });
    loadOverview();
    if (onGlobalRefresh) onGlobalRefresh();
  }

  async function deleteBot(b) {
    await api(`/api/admin/bots/${b.id}`, { method: 'DELETE' });
    loadOverview();
    if (onGlobalRefresh) onGlobalRefresh();
  }

  if (loading || !data) {
    return (
      <div className="p-12 text-center text-xs font-mono text-zinc-500">
        Loading Administrator Control Plane...
      </div>
    );
  }

  const { system, summary, users, bots, auditLogs } = data;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {mode === 'admin-users'
              ? 'Users & Client Quotas'
              : mode === 'admin-system'
              ? 'VPS Telemetry & Audit Logs'
              : 'Administrator Control Plane'}
          </h1>
          <p className="text-xs font-mono text-zinc-500 mt-1">
            {system.os} · {system.runtimeMode} · PORT {system.port}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <IconButton icon={RefreshCw} title="Refresh" onClick={loadOverview} />
          <IconButton
            icon={UserPlus}
            label="New User"
            onClick={() => setUserModalOpen(true)}
          />
          <IconButton
            icon={Plus}
            label="Serve Bot"
            active
            onClick={() => setProvisionOpen(true)}
          />
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="obsidian-card rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-[11px] font-mono uppercase">Active Bots</span>
            <Bot size={16} className="text-white" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {summary.onlineBots}
            <span className="text-sm text-zinc-500 font-normal"> / {summary.totalBots}</span>
          </div>
        </div>

        <div className="obsidian-card rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-[11px] font-mono uppercase">Client Accounts</span>
            <Users size={16} className="text-white" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {summary.activeUsers}
            <span className="text-sm text-zinc-500 font-normal"> / {summary.totalUsers}</span>
          </div>
        </div>

        <div className="obsidian-card rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-[11px] font-mono uppercase">VPS CPU</span>
            <Cpu size={16} className="text-white" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {system.cpuPercent}%
            <span className="text-xs text-zinc-500 font-normal ml-1.5">
              ({system.cpuCores} vCPU)
            </span>
          </div>
        </div>

        <div className="obsidian-card rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-[11px] font-mono uppercase">VPS Memory</span>
            <Activity size={16} className="text-white" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {system.memory.percent}%
            <span className="text-xs text-zinc-500 font-normal ml-1.5">
              {formatBytes(system.memory.usedBytes)}
            </span>
          </div>
        </div>
      </div>

      {/* Overview Mode: Manage All Served Bots */}
      {mode === 'admin-overview' && (
        <div className="obsidian-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Served Bot Instances</h2>
              <p className="text-xs text-zinc-500">
                All client & admin bot servers running natively on this VPS
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              {summary.allocatedMemoryMb} MB Allocated
            </span>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {bots.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="min-w-[200px]">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-white">{b.name}</span>
                    <StatusBadge status={b.runtimeState?.status || b.status} />
                  </div>
                  <div className="text-xs font-mono text-zinc-500 mt-0.5">
                    Owner: <span className="text-zinc-300">@{b.ownerUsername}</span> ·{' '}
                    {b.runtime?.toUpperCase()} · Limit {b.limits?.memoryMb}MB
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <IconButton
                    icon={Terminal}
                    label="Console"
                    size={14}
                    onClick={() => onSelectBot(b.id)}
                  />
                  <IconButton
                    icon={b.suspended ? CheckCircle2 : Ban}
                    title={b.suspended ? 'Unsuspend' : 'Suspend'}
                    size={14}
                    className="!p-2"
                    onClick={() => toggleBotSuspend(b)}
                  />
                  <IconButton
                    icon={Trash2}
                    title="Delete Bot"
                    size={14}
                    className="!p-2"
                    onClick={() => deleteBot(b)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Mode */}
      {mode === 'admin-users' && (
        <div className="obsidian-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.07]">
            <h2 className="text-sm font-semibold text-white">Accounts & Quotas</h2>
            <p className="text-xs text-zinc-500">
              Create user logins and serve dedicated bot slots to each client
            </p>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{u.username}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-white/[0.07] text-zinc-300 border border-white/10">
                      {u.role}
                    </span>
                    {u.status === 'suspended' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        SUSPENDED
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-zinc-500 mt-0.5">
                    {u.email} · Bots: {u.botCount}/{u.maxBots} ({u.onlineBotCount} online)
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <IconButton
                    icon={u.status === 'suspended' ? CheckCircle2 : Ban}
                    label={u.status === 'suspended' ? 'Activate' : 'Suspend'}
                    size={14}
                    onClick={() => toggleUserSuspend(u)}
                  />
                  <IconButton
                    icon={Trash2}
                    title="Delete User"
                    size={14}
                    className="!p-2"
                    onClick={() => deleteUser(u)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Telemetry Mode */}
      {mode === 'admin-system' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="obsidian-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <Server size={18} className="text-white" />
              <h2 className="text-sm font-semibold text-white">Host VPS Specifications</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-zinc-500">HOSTNAME</div>
                <div className="text-white mt-0.5 truncate">{system.hostname}</div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-zinc-500">OS / KERNEL</div>
                <div className="text-white mt-0.5 truncate">{system.kernel}</div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-zinc-500">CPU MODEL</div>
                <div className="text-white mt-0.5 truncate">{system.cpuModel}</div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-zinc-500">HOST UPTIME</div>
                <div className="text-white mt-0.5">{formatUptime(system.uptimeSeconds)}</div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-zinc-500">TOTAL RAM</div>
                <div className="text-white mt-0.5">{formatBytes(system.memory.totalBytes)}</div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-zinc-500">DISK SPACE</div>
                <div className="text-white mt-0.5">
                  {formatBytes(system.disk.usedBytes)} / {formatBytes(system.disk.totalBytes)}
                </div>
              </div>
            </div>
          </div>

          <div className="obsidian-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <HardDrive size={18} className="text-white" />
              <h2 className="text-sm font-semibold text-white">Recent Audit Logs</h2>
            </div>
            <div className="max-h-[270px] overflow-y-auto space-y-2 pr-1">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs font-mono"
                >
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-white font-semibold">{log.action}</span>
                    <span className="text-[10px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-zinc-500 text-[11px] mt-0.5">
                    @{log.actorName} → {log.target} · {log.details}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Provision Bot Modal */}
      <ProvisionBotModal
        open={provisionOpen}
        onClose={() => setProvisionOpen(false)}
        users={users}
        onCreated={() => {
          loadOverview();
          if (onGlobalRefresh) onGlobalRefresh();
        }}
      />

      {/* Create User Modal */}
      <Modal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title="Create Client Account"
        subtitle="Add a user so you can serve bot instances to them"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={uName}
                onChange={(e) => setUName(e.target.value)}
                placeholder="client01"
                className="w-full bg-black border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/50"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                Email
              </label>
              <input
                type="email"
                value={uEmail}
                onChange={(e) => setUEmail(e.target.value)}
                placeholder="client@domain.com"
                className="w-full bg-black border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                Role
              </label>
              <select
                value={uRole}
                onChange={(e) => setURole(e.target.value)}
                className="w-full bg-black border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/50"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                Max Bots
              </label>
              <input
                type="number"
                min="1"
                value={uMaxBots}
                onChange={(e) => setUMaxBots(e.target.value)}
                className="w-full bg-black border border-white/15 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-white/50"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={uPass}
                onChange={(e) => setUPass(e.target.value)}
                placeholder="min 6 chars"
                className="w-full bg-black border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/50"
              />
            </div>
          </div>

          {uErr && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
              {uErr}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setUserModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-white/10 text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200"
            >
              Create Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
