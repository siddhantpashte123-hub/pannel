const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const EventEmitter = require('events');
const config = require('./config');
const { db } = require('./db');
const { getProcessMetrics } = require('./systemStats');

const MAX_LOG_LINES = 600;

class BotManager extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map(); // botId -> runtime info
    this.logs = new Map(); // botId -> array of log entries
    this.tasks = new Map(); // botId -> running install task
    this.metricsTimer = setInterval(() => this._pollMetrics(), 2000);
  }

  getBotDir(botId) {
    const dir = path.join(config.BOTS_DIR, botId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  getLogs(botId) {
    if (this.logs.has(botId)) return this.logs.get(botId);
    const logFile = path.join(config.LOGS_DIR, `${botId}.log`);
    if (fs.existsSync(logFile)) {
      try {
        const lines = fs
          .readFileSync(logFile, 'utf8')
          .split('\n')
          .filter(Boolean)
          .slice(-MAX_LOG_LINES)
          .map((line) => ({
            ts: new Date().toISOString(),
            stream: 'system',
            text: line,
          }));
        this.logs.set(botId, lines);
        return lines;
      } catch {}
    }
    this.logs.set(botId, []);
    return [];
  }

  appendLog(botId, stream, text) {
    const clean = text.replace(/\r$/, '');
    if (!clean) return;
    const entry = {
      ts: new Date().toISOString(),
      stream,
      text: clean,
    };
    const arr = this.getLogs(botId);
    arr.push(entry);
    if (arr.length > MAX_LOG_LINES) {
      arr.splice(0, arr.length - MAX_LOG_LINES);
    }

    try {
      const logFile = path.join(config.LOGS_DIR, `${botId}.log`);
      fs.appendFileSync(logFile, `${clean}\n`);
    } catch {}

    this.emit('log', { botId, entry });
  }

  clearLogs(botId) {
    this.logs.set(botId, []);
    try {
      const logFile = path.join(config.LOGS_DIR, `${botId}.log`);
      if (fs.existsSync(logFile)) fs.writeFileSync(logFile, '');
    } catch {}
    this.emit('logs_cleared', { botId });
  }

  getBotRuntime(botId) {
    const bot = db.data.bots.find((b) => b.id === botId);
    const proc = this.processes.get(botId);
    if (!bot) return null;

    return {
      status: bot.suspended ? 'suspended' : proc ? proc.status : 'offline',
      pid: proc?.pid || null,
      startedAt: proc?.startedAt || null,
      uptimeSeconds: proc?.startedAt ? Math.floor((Date.now() - proc.startedAt) / 1000) : 0,
      memoryBytes: proc?.memoryBytes || 0,
      cpuPercent: proc?.cpuPercent || 0,
      restarts: proc?.restarts || 0,
    };
  }

  _emitStatus(botId) {
    const runtime = this.getBotRuntime(botId);
    this.emit('status', { botId, runtime });
  }

  _buildSafeEnv(bot) {
    const baseEnv = { ...process.env };
    delete baseEnv.JWT_SECRET;
    delete baseEnv.PANEL_ADMIN_PASS;
    return {
      ...baseEnv,
      ...(bot.env || {}),
      PYTHONUNBUFFERED: '1',
      FORCE_COLOR: '1',
      TERM: 'xterm-256color',
      OBSIDIAN_BOT_ID: bot.id,
      OBSIDIAN_BOT_NAME: bot.name,
    };
  }

  _readProcCpuTicks(pid) {
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      const rparen = stat.lastIndexOf(')');
      if (rparen === -1) return null;
      const fields = stat.slice(rparen + 2).split(' ');
      const utime = parseInt(fields[11], 10) || 0;
      const stime = parseInt(fields[12], 10) || 0;
      return utime + stime;
    } catch {
      return null;
    }
  }

  _pollMetrics() {
    for (const [botId, proc] of this.processes.entries()) {
      if (!proc.pid || proc.status !== 'online') continue;
      const { memoryBytes } = getProcessMetrics(proc.pid);
      proc.memoryBytes = memoryBytes;

      const ticks = this._readProcCpuTicks(proc.pid);
      const now = Date.now();
      if (ticks !== null && proc._lastTicks !== undefined && proc._lastTickTime) {
        const dtSec = (now - proc._lastTickTime) / 1000;
        const dTicks = ticks - proc._lastTicks;
        // Linux USER_HZ is typically 100
        if (dtSec > 0) {
          proc.cpuPercent = Math.max(0, Math.round(((dTicks / 100) / dtSec) * 1000) / 10);
        }
      }
      proc._lastTicks = ticks;
      proc._lastTickTime = now;

      const bot = db.data.bots.find((b) => b.id === botId);
      const limitBytes = (bot?.limits?.memoryMb || 0) * 1024 * 1024;
      if (limitBytes > 0 && memoryBytes > limitBytes * 1.15) {
        this.appendLog(
          botId,
          'system',
          `[OBSIDIAN] Memory limit exceeded (${Math.round(memoryBytes / 1048576)}MB / ${bot.limits.memoryMb}MB). Restarting process...`
        );
        this.restartBot(botId);
        continue;
      }

      this._emitStatus(botId);
    }
  }

  startBot(botId) {
    const bot = db.data.bots.find((b) => b.id === botId);
    if (!bot) throw new Error('Bot not found');
    if (bot.suspended) throw new Error('Bot server is suspended by administrator');

    const existing = this.processes.get(botId);
    if (existing && (existing.status === 'online' || existing.status === 'starting')) {
      return this.getBotRuntime(botId);
    }

    const botDir = this.getBotDir(botId);
    const cmd = (bot.startupCommand || '').trim();
    if (!cmd) throw new Error('Startup command is empty');

    let launchCmd = cmd;
    const pkgPath = path.join(botDir, 'package.json');
    const nmPath = path.join(botDir, 'node_modules');
    if (fs.existsSync(pkgPath) && !fs.existsSync(nmPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const hasDeps =
          (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) ||
          (pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0);
        if (hasDeps) {
          this.appendLog(
            botId,
            'system',
            '[OBSIDIAN] node_modules missing — auto-installing dependencies from package.json...'
          );
          launchCmd = `npm install --no-audit --no-fund && ${cmd}`;
        }
      } catch {}
    }

    this.appendLog(botId, 'system', `[OBSIDIAN] Starting native runtime: ${cmd}`);

    const child = spawn('/bin/bash', ['-lc', launchCmd], {
      cwd: botDir,
      env: this._buildSafeEnv(bot),
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const procInfo = {
      child,
      pid: child.pid,
      status: 'online',
      startedAt: Date.now(),
      memoryBytes: 0,
      cpuPercent: 0,
      manualStop: false,
      restarts: existing?.restarts || 0,
      recentCrashes: existing?.recentCrashes || [],
    };

    this.processes.set(botId, procInfo);
    bot.status = 'online';
    db.save();
    this._emitStatus(botId);

    const streamLines = (streamName) => {
      let buf = '';
      return (chunk) => {
        buf += chunk.toString('utf8');
        const parts = buf.split('\n');
        buf = parts.pop();
        for (const line of parts) {
          this.appendLog(botId, streamName, line);
        }
      };
    };

    child.stdout.on('data', streamLines('stdout'));
    child.stderr.on('data', streamLines('stderr'));

    child.on('error', (err) => {
      this.appendLog(botId, 'stderr', `[OBSIDIAN] Process error: ${err.message}`);
    });

    child.on('exit', (code, signal) => {
      const current = this.processes.get(botId);
      const wasManual = current?.manualStop;
      const restarts = current?.restarts || 0;
      const recentCrashes = (current?.recentCrashes || []).filter((t) => Date.now() - t < 60000);

      this.processes.delete(botId);
      const latestBot = db.data.bots.find((b) => b.id === botId);
      if (latestBot) {
        latestBot.status = wasManual || code === 0 ? 'offline' : 'crashed';
        db.save();
      }

      this.appendLog(
        botId,
        'system',
        `[OBSIDIAN] Process exited (code=${code ?? 'null'}, signal=${signal ?? 'none'})`
      );
      this._emitStatus(botId);

      if (!wasManual && latestBot && !latestBot.suspended && latestBot.autoRestart && code !== 0) {
        recentCrashes.push(Date.now());
        if (recentCrashes.length <= 5) {
          this.appendLog(botId, 'system', `[OBSIDIAN] Auto-restart triggered in 3s (attempt ${recentCrashes.length}/5)...`);
          setTimeout(() => {
            if (!this.processes.has(botId)) {
              try {
                const next = this.startBot(botId);
                const p = this.processes.get(botId);
                if (p) {
                  p.restarts = restarts + 1;
                  p.recentCrashes = recentCrashes;
                }
                return next;
              } catch {}
            }
          }, 3000);
        } else {
          this.appendLog(botId, 'stderr', '[OBSIDIAN] Crash loop detected (>5 crashes in 60s). Auto-restart paused.');
        }
      }
    });

    return this.getBotRuntime(botId);
  }

  async stopBot(botId, force = false) {
    const proc = this.processes.get(botId);
    if (!proc) {
      const bot = db.data.bots.find((b) => b.id === botId);
      if (bot && !bot.suspended) {
        bot.status = 'offline';
        db.save();
      }
      this._emitStatus(botId);
      return this.getBotRuntime(botId);
    }

    proc.manualStop = true;
    const pid = proc.pid;
    this.appendLog(botId, 'system', `[OBSIDIAN] Sending ${force ? 'SIGKILL' : 'SIGTERM'} to process group (${pid})...`);

    try {
      process.kill(-pid, force ? 'SIGKILL' : 'SIGTERM');
    } catch {
      try {
        proc.child.kill(force ? 'SIGKILL' : 'SIGTERM');
      } catch {}
    }

    if (!force) {
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          if (this.processes.has(botId)) {
            this.appendLog(botId, 'system', '[OBSIDIAN] Graceful stop timeout. Forcing SIGKILL...');
            try {
              process.kill(-pid, 'SIGKILL');
            } catch {}
          }
          resolve();
        }, 4000);

        proc.child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }

    return this.getBotRuntime(botId);
  }

  async restartBot(botId) {
    await this.stopBot(botId, false);
    await new Promise((r) => setTimeout(r, 400));
    return this.startBot(botId);
  }

  sendCommand(botId, command) {
    const proc = this.processes.get(botId);
    if (!proc || !proc.child.stdin || proc.child.stdin.destroyed) {
      throw new Error('Bot is not running');
    }
    this.appendLog(botId, 'stdin', `> ${command}`);
    proc.child.stdin.write(command + '\n');
  }

  runInstallTask(botId, command) {
    const bot = db.data.bots.find((b) => b.id === botId);
    if (!bot) throw new Error('Bot not found');
    if (this.tasks.has(botId)) throw new Error('An install task is already running for this bot');

    const allowed = /^(npm\s+(install|ci|update)|pip3?\s+install|yarn\s+install|pnpm\s+install)/;
    if (!allowed.test(command.trim())) {
      throw new Error('Only npm/yarn/pnpm/pip package install commands are allowed here');
    }

    const botDir = this.getBotDir(botId);
    this.appendLog(botId, 'system', `[OBSIDIAN] Running package task: ${command}`);

    const task = spawn('/bin/bash', ['-lc', command], {
      cwd: botDir,
      env: this._buildSafeEnv(bot),
      detached: true,
    });

    this.tasks.set(botId, task);

    const stream = (s) => (chunk) => {
      for (const line of chunk.toString('utf8').split('\n')) {
        if (line.trim()) this.appendLog(botId, s, line);
      }
    };

    task.stdout.on('data', stream('stdout'));
    task.stderr.on('data', stream('stderr'));

    task.on('exit', (code) => {
      this.tasks.delete(botId);
      this.appendLog(botId, 'system', `[OBSIDIAN] Package task finished with exit code ${code}`);
    });

    return { started: true, command };
  }

  async shutdownAll() {
    clearInterval(this.metricsTimer);
    const ids = Array.from(this.processes.keys());
    await Promise.all(ids.map((id) => this.stopBot(id, false)));
  }
}

const botManager = new BotManager();

module.exports = { botManager };
