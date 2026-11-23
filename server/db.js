const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { hashPassword } = require('./auth');

function uid(prefix = '') {
  return prefix + crypto.randomBytes(6).toString('hex');
}

function defaultState() {
  const adminUser = process.env.PANEL_ADMIN_USER || 'admin';
  const adminPass = process.env.PANEL_ADMIN_PASS || 'admin123';
  const adminId = 'usr_admin_01';
  const demoBotId = 'bot_sentinel_01';

  return {
    users: [
      {
        id: adminId,
        username: adminUser,
        email: 'admin@obsidian.host',
        passwordHash: hashPassword(adminPass),
        role: 'admin',
        status: 'active',
        maxBots: 100,
        maxMemoryMb: 32768,
        maxDiskMb: 102400,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
      },
    ],
    bots: [
      {
        id: demoBotId,
        name: 'Sentinel Echo Bot',
        description: 'Native Node.js bot runtime with live telemetry & interactive console',
        ownerId: adminId,
        runtime: 'nodejs',
        startupCommand: 'node index.js',
        mainFile: 'index.js',
        env: {
          BOT_NAME: 'Sentinel',
          BOT_PREFIX: '!',
          NODE_ENV: 'production',
        },
        autoRestart: true,
        limits: {
          memoryMb: 512,
          cpuPercent: 100,
          diskMb: 2048,
        },
        status: 'offline',
        suspended: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    auditLogs: [
      {
        id: uid('aud_'),
        actorId: 'system',
        actorName: 'SYSTEM',
        action: 'PANEL_INITIALIZED',
        target: 'obsidian-panel',
        details: 'Docker-free native bot hosting runtime initialized on port ' + config.PORT,
        timestamp: new Date().toISOString(),
      },
    ],
    settings: {
      panelName: 'OBSIDIAN',
      panelSubtitle: 'NATIVE BOT HOSTING',
      motd: 'Zero-Docker Native Process Isolation Engine Active',
      defaultMaxBots: 3,
      defaultMemoryMb: 512,
      defaultDiskMb: 2048,
    },
  };
}

function ensureDemoBotFiles(botId) {
  const botDir = path.join(config.BOTS_DIR, botId);
  fs.mkdirSync(botDir, { recursive: true });
  const indexPath = path.join(botDir, 'index.js');
  const pkgPath = path.join(botDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(
      pkgPath,
      JSON.stringify(
        {
          name: 'sentinel-echo-bot',
          version: '1.0.0',
          main: 'index.js',
          scripts: {
            start: 'node index.js',
          },
        },
        null,
        2
      )
    );
  }

  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(
      indexPath,
      `// Obsidian Native Bot Runtime - Demo Bot
const readline = require('readline');

const botName = process.env.BOT_NAME || 'Sentinel';
const prefix = process.env.BOT_PREFIX || '!';

console.log(\`[\${new Date().toISOString()}] [\${botName}] Booting native runtime (No Docker)...\`);
console.log(\`[\${new Date().toISOString()}] [\${botName}] Node \${process.version} | PID \${process.pid} | Prefix "\${prefix}"\`);
console.log(\`[\${new Date().toISOString()}] [\${botName}] Ready! Type "help", "ping", or "stats" in the console.\`);

let ticks = 0;
const heartbeat = setInterval(() => {
  ticks++;
  const memMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  console.log(\`[\${new Date().toISOString()}] [HEARTBEAT #\${ticks}] Online | RSS: \${memMb} MB\`);
}, 15000);

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const cmd = line.trim();
  if (!cmd) return;
  if (cmd === 'help') {
    console.log('[CMD] Available commands: help, ping, stats, env, quit');
  } else if (cmd === 'ping') {
    console.log('[CMD] PONG! Latency: 0.4ms (native process)');
  } else if (cmd === 'stats') {
    const memMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
    console.log(\`[CMD] Uptime: \${process.uptime().toFixed(1)}s | Memory: \${memMb} MB | Ticks: \${ticks}\`);
  } else if (cmd === 'env') {
    console.log(\`[CMD] BOT_NAME=\${botName}, BOT_PREFIX=\${prefix}\`);
  } else if (cmd === 'quit') {
    console.log('[CMD] Graceful shutdown requested...');
    clearInterval(heartbeat);
    process.exit(0);
  } else {
    console.log(\`[ECHO] Received input: "\${cmd}"\`);
  }
});

process.on('SIGTERM', () => {
  console.log(\`[\${new Date().toISOString()}] [\${botName}] SIGTERM received. Cleaning up...\`);
  clearInterval(heartbeat);
  process.exit(0);
});
`
    );
  }
}

class Store {
  constructor() {
    this.data = this._load();
    // Reset all bot statuses to offline on cold server boot (manager will update running ones)
    for (const bot of this.data.bots) {
      if (!bot.suspended) bot.status = 'offline';
    }
    ensureDemoBotFiles('bot_sentinel_01');
    this.save();
  }

  _load() {
    if (fs.existsSync(config.DB_PATH)) {
      try {
        const raw = fs.readFileSync(config.DB_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.bots)) {
          return parsed;
        }
      } catch (err) {
        console.error('[DB] Failed to load DB, backing up and reinitializing:', err.message);
        try {
          fs.copyFileSync(config.DB_PATH, config.DB_PATH + '.bak-' + Date.now());
        } catch {}
      }
    }
    return defaultState();
  }

  save() {
    const tmp = config.DB_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, config.DB_PATH);
  }

  addAudit(actor, action, target, details = '') {
    this.data.auditLogs.unshift({
      id: uid('aud_'),
      actorId: actor?.id || 'system',
      actorName: actor?.username || 'SYSTEM',
      action,
      target,
      details,
      timestamp: new Date().toISOString(),
    });
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
    this.save();
  }
}

const db = new Store();

module.exports = {
  db,
  uid,
};
