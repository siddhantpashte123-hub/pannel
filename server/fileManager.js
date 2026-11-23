const fs = require('fs');
const path = require('path');
const config = require('./config');

function resolveBotPath(botId, relPath = '') {
  const root = path.resolve(config.BOTS_DIR, botId);
  fs.mkdirSync(root, { recursive: true });
  const cleanRel = String(relPath || '').replace(/^\/+/, '');
  const target = path.resolve(root, cleanRel);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('Invalid path: directory traversal blocked');
  }
  return { root, target, rel: path.relative(root, target) };
}

function listFiles(botId, relPath = '') {
  const { target } = resolveBotPath(botId, relPath);
  if (!fs.existsSync(target)) throw new Error('Directory does not exist');
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) throw new Error('Path is not a directory');

  const entries = fs.readdirSync(target, { withFileTypes: true });
  const items = entries
    .map((entry) => {
      const full = path.join(target, entry.name);
      let s;
      try {
        s = fs.statSync(full);
      } catch {
        return null;
      }
      return {
        name: entry.name,
        path: relPath ? path.posix.join(relPath.replace(/\\/g, '/'), entry.name) : entry.name,
        isDirectory: entry.isDirectory(),
        size: entry.isDirectory() ? 0 : s.size,
        modifiedAt: s.mtime.toISOString(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return items;
}

function readFileContent(botId, relPath) {
  const { target } = resolveBotPath(botId, relPath);
  if (!fs.existsSync(target)) throw new Error('File not found');
  const stat = fs.statSync(target);
  if (stat.isDirectory()) throw new Error('Cannot read a directory');
  if (stat.size > 2 * 1024 * 1024) {
    throw new Error('File exceeds 2MB editor limit');
  }
  return {
    path: relPath,
    size: stat.size,
    content: fs.readFileSync(target, 'utf8'),
  };
}

function writeFileContent(botId, relPath, content) {
  const { target } = resolveBotPath(botId, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content ?? '', 'utf8');
  return { ok: true, path: relPath };
}

function createDirectory(botId, relPath) {
  const { target } = resolveBotPath(botId, relPath);
  fs.mkdirSync(target, { recursive: true });
  return { ok: true, path: relPath };
}

function deleteEntry(botId, relPath) {
  const { root, target } = resolveBotPath(botId, relPath);
  if (target === root) throw new Error('Cannot delete bot root directory');
  if (!fs.existsSync(target)) throw new Error('Path not found');
  fs.rmSync(target, { recursive: true, force: true });
  return { ok: true };
}

function renameEntry(botId, oldRel, newRel) {
  const src = resolveBotPath(botId, oldRel);
  const dst = resolveBotPath(botId, newRel);
  if (src.target === src.root || dst.target === dst.root) {
    throw new Error('Cannot rename bot root directory');
  }
  if (!fs.existsSync(src.target)) throw new Error('Source path not found');
  fs.mkdirSync(path.dirname(dst.target), { recursive: true });
  fs.renameSync(src.target, dst.target);
  return { ok: true };
}

module.exports = {
  resolveBotPath,
  listFiles,
  readFileContent,
  writeFileContent,
  createDirectory,
  deleteEntry,
  renameEntry,
};
