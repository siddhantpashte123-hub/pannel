const express = require('express');
const fs = require('fs');
const path = require('path');
const { db, uid } = require('../db');
const config = require('../config');
const { hashPassword, sanitizeUser } = require('../auth');
const { requireAuth, requireAdmin } = require('../middleware');
const { botManager } = require('../botManager');
const { getSystemStats, getDirSizeBytes } = require('../systemStats');

const router = express.Router();

router.use(requireAuth, requireAdmin);

function enrichUser(u) {
  const safe = sanitizeUser(u);
  const ownedBots = db.data.bots.filter((b) => b.ownerId === u.id);
  const onlineBots = ownedBots.filter((b) => botManager.getBotRuntime(b.id)?.status === 'online').length;
  return {
    ...safe,
    botCount: ownedBots.length,
    onlineBotCount: onlineBots,
  };
}

function seedTemplateFiles(botDir, runtime, botName) {
  fs.mkdirSync(botDir, { recursive: true });
  if (runtime === 'python') {
    fs.writeFileSync(
      path.join(botDir, 'requirements.txt'),
      '# Add your pip packages here (e.g. discord.py, python-telegram-bot)\n'
    );
    fs.writeFileSync(
      path.join(botDir, 'bot.py'),
      `import time\nimport os\n\nprint(f"[OBSIDIAN] {os.getenv('BOT_NAME', '${botName}')} Python runtime booted!")\nwhile True:\n    print("[HEARTBEAT] Python bot running natively (No Docker)")\n    time.sleep(20)\n`
    );
  } else if (runtime === 'bash') {
    fs.writeFileSync(
      path.join(botDir, 'start.sh'),
      `#!/usr/bin/env bash\necho "[OBSIDIAN] ${botName} shell service started"\nwhile true; do\n  echo "[HEARTBEAT] $(date -Is) alive"\n  sleep 20\ndone\n`,
      { mode: 0o755 }
    );
  } else {
    fs.writeFileSync(
      path.join(botDir, 'package.json'),
      JSON.stringify(
        {
          name: botName.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'obsidian-bot',
          version: '1.0.0',
          main: 'index.js',
          scripts: { start: 'node index.js' },
        },
        null,
        2
      )
    );
    fs.writeFileSync(
      path.join(botDir, 'index.js'),
      `console.log('[OBSIDIAN] ${botName} Node.js bot booted natively (No Docker)!');\nsetInterval(() => {\n  console.log('[HEARTBEAT]', new Date().toISOString(), 'RSS:', Math.round(process.memoryUsage().rss / 1048576) + 'MB');\n}, 20000);\n`
    );
  }
}

router.get('/overview', (req, res) => {
  const sys = getSystemStats();
  const bots = db.data.bots.map((b) => {
    const rt = botManager.getBotRuntime(b.id);
    const owner = db.data.users.find((u) => u.id === b.ownerId);
    return {
      ...b,
      ownerUsername: owner?.username || 'unknown',
      runtimeState: rt,
      diskUsedBytes: getDirSizeBytes(botManager.getBotDir(b.id)),
    };
  });

  const onlineBots = bots.filter((b) => b.runtimeState?.status === 'online').length;
  const allocatedMemoryMb = bots.reduce((acc, b) => acc + (b.limits?.memoryMb || 0), 0);

  res.json({
    system: sys,
    summary: {
      totalUsers: db.data.users.length,
      activeUsers: db.data.users.filter((u) => u.status === 'active').length,
      totalBots: bots.length,
      onlineBots,
      allocatedMemoryMb,
    },
    users: db.data.users.map(enrichUser),
    bots,
    auditLogs: db.data.auditLogs.slice(0, 80),
    settings: db.data.settings,
  });
});

// Users CRUD
router.get('/users', (req, res) => {
  res.json({ users: db.data.users.map(enrichUser) });
});

router.post('/users', (req, res) => {
  const { username, email, password, role, maxBots, maxMemoryMb, maxDiskMb } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const cleanUser = String(username).trim();
  if (db.data.users.some((u) => u.username.toLowerCase() === cleanUser.toLowerCase())) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  const user = {
    id: uid('usr_'),
    username: cleanUser,
    email: String(email || `${cleanUser}@obsidian.host`).trim(),
    passwordHash: hashPassword(String(password)),
    role: role === 'admin' ? 'admin' : 'user',
    status: 'active',
    maxBots: Number(maxBots) || db.data.settings.defaultMaxBots || 3,
    maxMemoryMb: Number(maxMemoryMb) || 2048,
    maxDiskMb: Number(maxDiskMb) || 10240,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };

  db.data.users.push(user);
  db.addAudit(req.user, 'ADMIN_CREATE_USER', user.username, `Role: ${user.role}, Max Bots: ${user.maxBots}`);
  res.status(201).json({ user: enrichUser(user) });
});

router.patch('/users/:id', (req, res) => {
  const user = db.data.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { email, password, role, status, maxBots, maxMemoryMb, maxDiskMb } = req.body || {};
  if (email !== undefined) user.email = String(email).trim();
  if (password && String(password).length >= 6) user.passwordHash = hashPassword(String(password));
  if (role && ['admin', 'user'].includes(role)) {
    if (user.id === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot demote your own admin account' });
    }
    user.role = role;
  }
  if (status && ['active', 'suspended'].includes(status)) {
    if (user.id === req.user.id && status === 'suspended') {
      return res.status(400).json({ error: 'Cannot suspend your own account' });
    }
    user.status = status;
  }
  if (maxBots !== undefined) user.maxBots = Number(maxBots) || 1;
  if (maxMemoryMb !== undefined) user.maxMemoryMb = Number(maxMemoryMb) || 512;
  if (maxDiskMb !== undefined) user.maxDiskMb = Number(maxDiskMb) || 1024;

  db.addAudit(req.user, 'ADMIN_UPDATE_USER', user.username, `Status: ${user.status}, Role: ${user.role}`);
  res.json({ user: enrichUser(user) });
});

router.delete('/users/:id', async (req, res) => {
  const user = db.data.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own active admin account' });
  }

  // Stop & remove user's bots or reassign? Cleanly stop and remove owned bots
  const owned = db.data.bots.filter((b) => b.ownerId === user.id);
  for (const bot of owned) {
    await botManager.stopBot(bot.id, true);
    fs.rmSync(path.join(config.BOTS_DIR, bot.id), { recursive: true, force: true });
  }
  db.data.bots = db.data.bots.filter((b) => b.ownerId !== user.id);
  db.data.users = db.data.users.filter((u) => u.id !== user.id);
  db.addAudit(req.user, 'ADMIN_DELETE_USER', user.username, `Deleted user and ${owned.length} bot(s)`);
  res.json({ ok: true });
});

// Bots Allocation / Provisioning
router.post('/bots', (req, res) => {
  const {
    name,
    description,
    ownerId,
    runtime = 'nodejs',
    startupCommand,
    memoryMb = 512,
    cpuPercent = 100,
    diskMb = 2048,
    autoRestart = true,
  } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Bot name is required' });
  }

  const owner = db.data.users.find((u) => u.id === (ownerId || req.user.id));
  if (!owner) return res.status(404).json({ error: 'Assigned owner user not found' });

  const ownedCount = db.data.bots.filter((b) => b.ownerId === owner.id).length;
  if (ownedCount >= owner.maxBots) {
    return res.status(400).json({ error: `User ${owner.username} has reached max bot quota (${owner.maxBots})` });
  }

  const defaultCmd =
    runtime === 'python'
      ? 'python3 bot.py'
      : runtime === 'bash'
      ? 'bash start.sh'
      : 'node index.js';

  const botId = uid('bot_');
  const bot = {
    id: botId,
    name: String(name).trim(),
    description: String(description || `${runtime.toUpperCase()} Native Bot Instance`),
    ownerId: owner.id,
    runtime,
    startupCommand: String(startupCommand || defaultCmd).trim(),
    mainFile: runtime === 'python' ? 'bot.py' : runtime === 'bash' ? 'start.sh' : 'index.js',
    env: {
      BOT_NAME: String(name).trim(),
      NODE_ENV: 'production',
    },
    autoRestart: Boolean(autoRestart),
    limits: {
      memoryMb: Number(memoryMb) || 512,
      cpuPercent: Number(cpuPercent) || 100,
      diskMb: Number(diskMb) || 2048,
    },
    status: 'offline',
    suspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  seedTemplateFiles(botManager.getBotDir(botId), runtime, bot.name);
  db.data.bots.push(bot);
  db.addAudit(
    req.user,
    'ADMIN_PROVISION_BOT',
    bot.name,
    `Provisioned ${runtime} bot (${bot.limits.memoryMb}MB) for ${owner.username}`
  );

  res.status(201).json({
    bot: {
      ...bot,
      ownerUsername: owner.username,
      runtimeState: botManager.getBotRuntime(bot.id),
      diskUsedBytes: getDirSizeBytes(botManager.getBotDir(bot.id)),
    },
  });
});

router.patch('/bots/:id', async (req, res) => {
  const bot = db.data.bots.find((b) => b.id === req.params.id);
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  const { ownerId, memoryMb, cpuPercent, diskMb, suspended, name, runtime, startupCommand } = req.body || {};
  if (ownerId) {
    const owner = db.data.users.find((u) => u.id === ownerId);
    if (!owner) return res.status(404).json({ error: 'Target owner not found' });
    bot.ownerId = owner.id;
  }
  if (name) bot.name = String(name).trim();
  if (runtime) bot.runtime = String(runtime);
  if (startupCommand) bot.startupCommand = String(startupCommand).trim();
  if (memoryMb !== undefined) bot.limits.memoryMb = Number(memoryMb) || 256;
  if (cpuPercent !== undefined) bot.limits.cpuPercent = Number(cpuPercent) || 100;
  if (diskMb !== undefined) bot.limits.diskMb = Number(diskMb) || 1024;
  if (suspended !== undefined) {
    bot.suspended = Boolean(suspended);
    if (bot.suspended) {
      await botManager.stopBot(bot.id, true);
      bot.status = 'suspended';
    } else if (bot.status === 'suspended') {
      bot.status = 'offline';
    }
  }
  bot.updatedAt = new Date().toISOString();
  db.addAudit(req.user, 'ADMIN_UPDATE_BOT', bot.name, `Updated allocation/suspension (${bot.id})`);
  res.json({ bot });
});

router.delete('/bots/:id', async (req, res) => {
  const bot = db.data.bots.find((b) => b.id === req.params.id);
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  await botManager.stopBot(bot.id, true);
  fs.rmSync(path.join(config.BOTS_DIR, bot.id), { recursive: true, force: true });
  try {
    fs.rmSync(path.join(config.LOGS_DIR, `${bot.id}.log`), { force: true });
  } catch {}
  db.data.bots = db.data.bots.filter((b) => b.id !== bot.id);
  db.addAudit(req.user, 'ADMIN_DELETE_BOT', bot.name, `Deleted bot instance ${bot.id}`);
  res.json({ ok: true });
});

router.patch('/settings', (req, res) => {
  const { panelName, panelSubtitle, motd, defaultMaxBots, defaultMemoryMb } = req.body || {};
  if (panelName) db.data.settings.panelName = String(panelName).trim();
  if (panelSubtitle !== undefined) db.data.settings.panelSubtitle = String(panelSubtitle).trim();
  if (motd !== undefined) db.data.settings.motd = String(motd).trim();
  if (defaultMaxBots !== undefined) db.data.settings.defaultMaxBots = Number(defaultMaxBots) || 3;
  if (defaultMemoryMb !== undefined) db.data.settings.defaultMemoryMb = Number(defaultMemoryMb) || 512;
  db.addAudit(req.user, 'ADMIN_UPDATE_SETTINGS', 'panel', 'Updated global panel settings');
  res.json({ settings: db.data.settings });
});

module.exports = router;
