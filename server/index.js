const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const config = require('./config');
const { db } = require('./db');
const { verifyToken } = require('./auth');
const { botManager } = require('./botManager');
const { getSystemStats } = require('./systemStats');

const authRoutes = require('./routes/auth');
const botsRoutes = require('./routes/bots');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    panel: db.data.settings.panelName,
    port: config.PORT,
    dockerRequired: false,
    runtime: 'native-process-engine',
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bots', botsRoutes);
app.use('/api/admin', adminRoutes);

// Serve Frontend Static Assets (Production)
if (fs.existsSync(config.CLIENT_DIST)) {
  app.use(express.static(config.CLIENT_DIST));
  app.get(/^(?!\/api|\/ws).*/, (req, res) => {
    res.sendFile(path.join(config.CLIENT_DIST, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(
      'Obsidian Panel API running on port ' +
        config.PORT +
        '. Build frontend with `npm run build`.'
    );
  });
}

const server = http.createServer(app);

// WebSocket Server for live bot console & telemetry
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  let user = null;
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');
    if (!token) {
      ws.close(4001, 'Unauthorized');
      return;
    }
    const decoded = verifyToken(token);
    user = db.data.users.find((u) => u.id === decoded.id);
    if (!user || user.status === 'suspended') {
      ws.close(4003, 'Forbidden');
      return;
    }
  } catch {
    ws.close(4001, 'Invalid token');
    return;
  }

  ws.user = user;
  ws.subscriptions = new Set(); // botIds

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'subscribe' && msg.botId) {
        const bot = db.data.bots.find((b) => b.id === msg.botId);
        if (!bot) return;
        if (ws.user.role !== 'admin' && bot.ownerId !== ws.user.id) return;
        ws.subscriptions.add(bot.id);
        ws.send(
          JSON.stringify({
            type: 'history',
            botId: bot.id,
            logs: botManager.getLogs(bot.id),
            runtime: botManager.getBotRuntime(bot.id),
          })
        );
      } else if (msg.type === 'unsubscribe' && msg.botId) {
        ws.subscriptions.delete(msg.botId);
      }
    } catch {}
  });
});

function broadcastBotEvent(botId, payload) {
  const bot = db.data.bots.find((b) => b.id === botId);
  const str = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState !== 1) continue;
    if (!client.user) continue;
    const isAllowed = client.user.role === 'admin' || (bot && bot.ownerId === client.user.id);
    if (!isAllowed) continue;
    if (client.subscriptions.has(botId) || payload.type === 'status') {
      client.send(str);
    }
  }
}

botManager.on('log', ({ botId, entry }) => {
  broadcastBotEvent(botId, { type: 'log', botId, entry });
});

botManager.on('logs_cleared', ({ botId }) => {
  broadcastBotEvent(botId, { type: 'logs_cleared', botId });
});

botManager.on('status', ({ botId, runtime }) => {
  broadcastBotEvent(botId, { type: 'status', botId, runtime });
});

// Broadcast system stats to connected admins every 3s
const sysBroadcast = setInterval(() => {
  if (wss.clients.size === 0) return;
  let stats = null;
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.user?.role === 'admin') {
      if (!stats) stats = getSystemStats();
      client.send(JSON.stringify({ type: 'system_stats', stats }));
    }
  }
}, 3000);

server.listen(config.PORT, config.HOST, () => {
  console.log(`\n  OBSIDIAN BOT HOSTING PANEL`);
  console.log(`  Runtime : Native Process Engine (Zero-Docker)`);
  console.log(`  Listen  : http://${config.HOST}:${config.PORT}`);
  console.log(`  DataDir : ${config.DATA_DIR}\n`);
});

async function gracefulShutdown(signal) {
  console.log(`\n[OBSIDIAN] Received ${signal}, shutting down gracefully...`);
  clearInterval(sysBroadcast);
  await botManager.shutdownAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
