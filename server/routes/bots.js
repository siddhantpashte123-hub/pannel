const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { db } = require('../db');
const { requireAuth } = require('../middleware');
const { botManager } = require('../botManager');
const fileManager = require('../fileManager');
const { getDirSizeBytes } = require('../systemStats');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function loadBotAccess(req, res, next) {
  const bot = db.data.bots.find((b) => b.id === req.params.id);
  if (!bot) return res.status(404).json({ error: 'Bot instance not found' });
  if (req.user.role !== 'admin' && bot.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'You do not have access to this bot instance' });
  }
  req.bot = bot;
  next();
}

function enrichBot(bot) {
  const owner = db.data.users.find((u) => u.id === bot.ownerId);
  const runtime = botManager.getBotRuntime(bot.id);
  const botDir = botManager.getBotDir(bot.id);
  return {
    ...bot,
    ownerUsername: owner?.username || 'unknown',
    runtimeState: runtime,
    diskUsedBytes: getDirSizeBytes(botDir),
  };
}

router.get('/', requireAuth, (req, res) => {
  const list =
    req.user.role === 'admin'
      ? db.data.bots
      : db.data.bots.filter((b) => b.ownerId === req.user.id);
  res.json({ bots: list.map(enrichBot) });
});

router.get('/:id', requireAuth, loadBotAccess, (req, res) => {
  res.json({ bot: enrichBot(req.bot) });
});

router.post('/:id/power', requireAuth, loadBotAccess, async (req, res) => {
  const { action } = req.body || {};
  try {
    let runtime;
    if (action === 'start') {
      runtime = botManager.startBot(req.bot.id);
      db.addAudit(req.user, 'BOT_START', req.bot.name, `Started bot ${req.bot.id}`);
    } else if (action === 'stop') {
      runtime = await botManager.stopBot(req.bot.id, false);
      db.addAudit(req.user, 'BOT_STOP', req.bot.name, `Stopped bot ${req.bot.id}`);
    } else if (action === 'kill') {
      runtime = await botManager.stopBot(req.bot.id, true);
      db.addAudit(req.user, 'BOT_KILL', req.bot.name, `Force killed bot ${req.bot.id}`);
    } else if (action === 'restart') {
      runtime = await botManager.restartBot(req.bot.id);
      db.addAudit(req.user, 'BOT_RESTART', req.bot.name, `Restarted bot ${req.bot.id}`);
    } else {
      return res.status(400).json({ error: 'Invalid power action' });
    }
    res.json({ runtime, bot: enrichBot(req.bot) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/logs', requireAuth, loadBotAccess, (req, res) => {
  res.json({ logs: botManager.getLogs(req.bot.id) });
});

router.delete('/:id/logs', requireAuth, loadBotAccess, (req, res) => {
  botManager.clearLogs(req.bot.id);
  res.json({ ok: true });
});

router.post('/:id/command', requireAuth, loadBotAccess, (req, res) => {
  const { command } = req.body || {};
  if (typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({ error: 'Command cannot be empty' });
  }
  try {
    botManager.sendCommand(req.bot.id, command);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/install-deps', requireAuth, loadBotAccess, (req, res) => {
  const { command } = req.body || {};
  if (!command) return res.status(400).json({ error: 'Command required' });
  try {
    const result = botManager.runInstallTask(req.bot.id, command);
    db.addAudit(req.user, 'BOT_INSTALL_DEPS', req.bot.name, command);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/startup', requireAuth, loadBotAccess, (req, res) => {
  const { name, description, runtime, startupCommand, mainFile, env, autoRestart } = req.body || {};
  if (name !== undefined && String(name).trim()) req.bot.name = String(name).trim();
  if (description !== undefined) req.bot.description = String(description);
  if (runtime !== undefined) req.bot.runtime = String(runtime);
  if (startupCommand !== undefined && String(startupCommand).trim()) {
    req.bot.startupCommand = String(startupCommand).trim();
  }
  if (mainFile !== undefined) req.bot.mainFile = String(mainFile).trim();
  if (env !== undefined && typeof env === 'object' && !Array.isArray(env)) {
    req.bot.env = env;
  }
  if (autoRestart !== undefined) req.bot.autoRestart = Boolean(autoRestart);
  req.bot.updatedAt = new Date().toISOString();
  db.save();
  db.addAudit(req.user, 'BOT_CONFIG_UPDATED', req.bot.name, `Updated startup/env for ${req.bot.id}`);
  res.json({ bot: enrichBot(req.bot) });
});

// File Manager endpoints
router.get('/:id/files', requireAuth, loadBotAccess, (req, res) => {
  try {
    const dir = String(req.query.path || '');
    const files = fileManager.listFiles(req.bot.id, dir);
    res.json({ path: dir, files });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/files/content', requireAuth, loadBotAccess, (req, res) => {
  try {
    const rel = String(req.query.path || '');
    const data = fileManager.readFileContent(req.bot.id, rel);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/files/content', requireAuth, loadBotAccess, (req, res) => {
  try {
    const { path: relPath, content } = req.body || {};
    if (!relPath) return res.status(400).json({ error: 'File path is required' });
    const data = fileManager.writeFileContent(req.bot.id, relPath, content);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/files/mkdir', requireAuth, loadBotAccess, (req, res) => {
  try {
    const { path: relPath } = req.body || {};
    if (!relPath) return res.status(400).json({ error: 'Folder path is required' });
    const data = fileManager.createDirectory(req.bot.id, relPath);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/files/rename', requireAuth, loadBotAccess, (req, res) => {
  try {
    const { oldPath, newPath } = req.body || {};
    const data = fileManager.renameEntry(req.bot.id, oldPath, newPath);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/files', requireAuth, loadBotAccess, (req, res) => {
  try {
    const rel = String(req.query.path || '');
    const data = fileManager.deleteEntry(req.bot.id, rel);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/files/upload', requireAuth, loadBotAccess, upload.array('files', 20), (req, res) => {
  try {
    const targetDir = String(req.body?.dir || '');
    const uploaded = [];
    for (const file of req.files || []) {
      const cleanName = path.basename(file.originalname);
      const rel = targetDir ? path.posix.join(targetDir, cleanName) : cleanName;
      const { target } = fileManager.resolveBotPath(req.bot.id, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.buffer);
      uploaded.push(rel);
    }
    db.addAudit(req.user, 'FILES_UPLOADED', req.bot.name, `Uploaded ${uploaded.length} file(s)`);
    res.json({ ok: true, uploaded });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
