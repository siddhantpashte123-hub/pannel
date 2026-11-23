import React from 'react';

export default function StatusBadge({ status = 'offline' }) {
  const map = {
    online: {
      dot: 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
      text: 'text-emerald-300',
      border: 'border-emerald-500/25 bg-emerald-500/10',
      label: 'ONLINE',
    },
    starting: {
      dot: 'bg-amber-400 animate-pulse',
      text: 'text-amber-300',
      border: 'border-amber-500/25 bg-amber-500/10',
      label: 'STARTING',
    },
    crashed: {
      dot: 'bg-rose-500 shadow-[0_0_8px_#f43f5e]',
      text: 'text-rose-300',
      border: 'border-rose-500/25 bg-rose-500/10',
      label: 'CRASHED',
    },
    suspended: {
      dot: 'bg-amber-500',
      text: 'text-amber-200',
      border: 'border-amber-500/30 bg-amber-500/10',
      label: 'SUSPENDED',
    },
    offline: {
      dot: 'bg-zinc-600',
      text: 'text-zinc-400',
      border: 'border-white/10 bg-white/[0.03]',
      label: 'OFFLINE',
    },
  };

  const cfg = map[status] || map.offline;

  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[10px] font-mono font-semibold tracking-widest uppercase ${cfg.border} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
