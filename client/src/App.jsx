import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BotDetailPage from './pages/BotDetailPage';
import AdminPage, { ProvisionBotModal } from './pages/AdminPage';
import AccountPage from './pages/AccountPage';
import { api } from './api/client';

function PanelShell() {
  const { user, loading } = useAuth();
  const [view, setView] = useState('bots');
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [bots, setBots] = useState([]);
  const [users, setUsers] = useState([]);
  const [provisionModal, setProvisionModal] = useState(false);

  async function refreshBots() {
    if (!user) return;
    try {
      const res = await api('/api/bots');
      setBots(res.bots || []);
    } catch {}
  }

  async function refreshAdminUsers() {
    if (!user || user.role !== 'admin') return;
    try {
      const res = await api('/api/admin/users');
      setUsers(res.users || []);
    } catch {}
  }

  useEffect(() => {
    if (!user) return;
    refreshBots();
    refreshAdminUsers();
    const timer = setInterval(refreshBots, 5000);
    return () => clearInterval(timer);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-xs font-mono tracking-[0.25em] text-zinc-400 animate-pulse">
          BOOTING OBSIDIAN...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  function handleNavigate(nextView) {
    setView(nextView);
    if (nextView !== 'bot-detail') setSelectedBotId(null);
  }

  function openBot(botId) {
    setSelectedBotId(botId);
    setView('bot-detail');
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col lg:flex-row">
      <Sidebar activeView={view} onNavigate={handleNavigate} />

      <main className="flex-1 min-w-0 obsidian-grid-bg p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {view === 'bots' && (
            <DashboardPage
              bots={bots}
              onSelectBot={openBot}
              onRefresh={refreshBots}
              onOpenProvision={() => {
                refreshAdminUsers();
                setProvisionModal(true);
              }}
            />
          )}

          {view === 'bot-detail' && selectedBotId && (
            <BotDetailPage
              botId={selectedBotId}
              onBack={() => handleNavigate('bots')}
              onGlobalRefresh={refreshBots}
            />
          )}

          {view === 'account' && <AccountPage />}

          {user.role === 'admin' &&
            (view === 'admin-overview' ||
              view === 'admin-users' ||
              view === 'admin-system') && (
              <AdminPage
                mode={view}
                onSelectBot={openBot}
                onGlobalRefresh={refreshBots}
              />
            )}
        </div>
      </main>

      {user.role === 'admin' && (
        <ProvisionBotModal
          open={provisionModal}
          onClose={() => setProvisionModal(false)}
          users={users}
          onCreated={refreshBots}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PanelShell />
    </AuthProvider>
  );
}
