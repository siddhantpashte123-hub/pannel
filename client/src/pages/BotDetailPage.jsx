import React, { useEffect, useState } from 'react';
import { ArrowLeft, Terminal, FolderOpen, Sliders } from 'lucide-react';
import IconButton from '../components/IconButton';
import StatusBadge from '../components/StatusBadge';
import ConsoleTerminal from '../components/ConsoleTerminal';
import FileManager from '../components/FileManager';
import StartupConfig from '../components/StartupConfig';
import { api, createPanelSocket } from '../api/client';

export default function BotDetailPage({ botId, onBack, onGlobalRefresh }) {
  const [bot, setBot] = useState(null);
  const [tab, setTab] = useState('console');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchBot() {
    try {
      const data = await api(`/api/bots/${botId}`);
      setBot(data.bot);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    fetchBot();

    const ws = createPanelSocket();
    if (!ws) return;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', botId }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.botId !== botId) return;
        if (msg.type === 'history') {
          setLogs(msg.logs || []);
          if (msg.runtime) {
            setBot((prev) => (prev ? { ...prev, runtimeState: msg.runtime } : prev));
          }
        } else if (msg.type === 'log') {
          setLogs((prev) => [...prev.slice(-599), msg.entry]);
        } else if (msg.type === 'logs_cleared') {
          setLogs([]);
        } else if (msg.type === 'status') {
          setBot((prev) => (prev ? { ...prev, runtimeState: msg.runtime } : prev));
        }
      } catch {}
    };

    return () => {
      try {
        ws.close();
      } catch {}
    };
  }, [botId]);

  if (loading || !bot) {
    return (
      <div className="p-12 text-center text-xs font-mono text-zinc-500">
        Loading bot control center...
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <IconButton icon={ArrowLeft} onClick={onBack} title="Back to Bots" />
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {bot.name}
              </h1>
              <StatusBadge status={bot.runtimeState?.status || bot.status} />
            </div>
            <p className="text-xs font-mono text-zinc-500 mt-0.5">
              ID: {bot.id} · {bot.runtime?.toUpperCase()} · Owner @{bot.ownerUsername}
            </p>
          </div>
        </div>

        {/* Tab Switcher Icons (Click -> White + Smooth Animation) */}
        <div className="flex items-center gap-2">
          <IconButton
            icon={Terminal}
            label="Console"
            active={tab === 'console'}
            onClick={() => setTab('console')}
          />
          <IconButton
            icon={FolderOpen}
            label="Files"
            active={tab === 'files'}
            onClick={() => setTab('files')}
          />
          <IconButton
            icon={Sliders}
            label="Startup & Env"
            active={tab === 'startup'}
            onClick={() => setTab('startup')}
          />
        </div>
      </div>

      {tab === 'console' && (
        <ConsoleTerminal
          bot={bot}
          logs={logs}
          onClearLogs={() => setLogs([])}
          onBotUpdate={(updated) => {
            setBot(updated);
            if (onGlobalRefresh) onGlobalRefresh();
          }}
        />
      )}

      {tab === 'files' && <FileManager bot={bot} />}

      {tab === 'startup' && (
        <StartupConfig
          bot={bot}
          onBotUpdate={(updated) => {
            setBot(updated);
            if (onGlobalRefresh) onGlobalRefresh();
          }}
        />
      )}
    </div>
  );
}
