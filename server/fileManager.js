const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const AdmZip = require('adm-zip');
const config = require('./config');

const ARCHIVE_RE = /\.(zip|tar|tar\.gz|tgz|tar\.bz2|tar\.xz)$/i;

function isArchiveName(filename = '') {
  return ARCHIVE_RE.test(String(filename).trim());
}

function resolveBotPath(botId, relPath = '') {
  const root = path.resolve(config.BOTS_DIR, botId);
  fs.mkdirSync(root, { recursive: true });
  const cleanRel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
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
      const isDir = entry.isDirectory();
      return {
        name: entry.name,
        path: relPath ? path.posix.join(relPath.replace(/\\/g, '/'), entry.name) : entry.name,
        isDirectory: isDir,
        isArchive: !isDir && isArchiveName(entry.name),
        size: isDir ? 0 : s.size,
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

function extractArchive(botId, archiveRel, destRel) {
  const src = resolveBotPath(botId, archiveRel);
  if (!fs.existsSync(src.target)) throw new Error('Archive file not found');
  if (fs.statSync(src.target).isDirectory()) throw new Error('Cannot extract a directory');
  if (!isArchiveName(src.target)) {
    throw new Error('Unsupported archive format (use .zip, .tar, .tar.gz, .tgz, .tar.bz2, .tar.xz)');
  }

  const defaultDest = archiveRel.includes('/')
    ? archiveRel.slice(0, archiveRel.lastIndexOf('/'))
    : '';
  const targetDirRel = destRel !== undefined && destRel !== null ? destRel : defaultDest;
  const dst = resolveBotPath(botId, targetDirRel);
  fs.mkdirSync(dst.target, { recursive: true });

  const lower = src.target.toLowerCase();
  let extractedCount = 0;

  if (lower.endsWith('.zip')) {
    const zip = new AdmZip(src.target);
    const entries = zip.getEntries();
    for (const entry of entries) {
      const normalized = entry.entryName.replace(/\\/g, '/').replace(/^\/+/, '');
      if (!normalized || normalized.startsWith('__MACOSX/')) continue;
      if (normalized.split('/').includes('..')) {
        throw new Error(`Unsafe archive entry blocked: ${entry.entryName}`);
      }
      const outPath = path.resolve(dst.target, normalized);
      if (outPath !== dst.target && !outPath.startsWith(dst.target + path.sep)) {
        throw new Error(`Unsafe archive path blocked: ${entry.entryName}`);
      }
      if (entry.isDirectory) {
        fs.mkdirSync(outPath, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, entry.getData());
        extractedCount++;
      }
    }
  } else {
    // Validate tar archive entries before extracting
    const listOut = execFileSync('tar', ['-tf', src.target], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    const entries = listOut.split('\n').filter(Boolean);
    for (const entryName of entries) {
      const normalized = entryName.replace(/\\/g, '/');
      if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
        throw new Error(`Unsafe tar entry blocked: ${entryName}`);
      }
    }
    execFileSync('tar', ['-xf', src.target, '-C', dst.target, '--no-same-owner'], {
      maxBuffer: 20 * 1024 * 1024,
    });
    extractedCount = entries.length;
  }

  return {
    ok: true,
    archive: archiveRel,
    destination: targetDirRel || '/',
    extractedCount,
  };
}

module.exports = {
  isArchiveName,
  resolveBotPath,
  listFiles,
  readFileContent,
  writeFileContent,
  createDirectory,
  deleteEntry,
  renameEntry,
  extractArchive,
};
