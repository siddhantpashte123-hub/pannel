const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');
const config = require('./config');

let prevCpuTimes = null;

function getCpuPercent() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }
  if (!prevCpuTimes) {
    prevCpuTimes = { idle, total };
    const load1 = os.loadavg()[0] || 0;
    return Math.min(100, Math.round((load1 / Math.max(1, cpus.length)) * 1000) / 10);
  }
  const idleDiff = idle - prevCpuTimes.idle;
  const totalDiff = total - prevCpuTimes.total;
  prevCpuTimes = { idle, total };
  if (totalDiff <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - idleDiff / totalDiff) * 1000) / 10));
}

function getMemoryInfo() {
  // Prefer /proc/meminfo on Linux for accurate MemAvailable
  try {
    if (fs.existsSync('/proc/meminfo')) {
      const content = fs.readFileSync('/proc/meminfo', 'utf8');
      const map = {};
      for (const line of content.split('\n')) {
        const m = line.match(/^(\w+):\s+(\d+)/);
        if (m) map[m[1]] = parseInt(m[2], 10) * 1024;
      }
      if (map.MemTotal) {
        const total = map.MemTotal;
        const available = map.MemAvailable || map.MemFree || 0;
        const used = Math.max(0, total - available);
        return {
          totalBytes: total,
          usedBytes: used,
          freeBytes: available,
          percent: Math.round((used / total) * 1000) / 10,
        };
      }
    }
  } catch {}
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    totalBytes: total,
    usedBytes: used,
    freeBytes: free,
    percent: Math.round((used / total) * 1000) / 10,
  };
}

function getDiskInfo(targetPath = config.DATA_DIR) {
  try {
    const out = execSync(`df -B1 "${targetPath}" | tail -n 1`, { encoding: 'utf8' }).trim();
    const parts = out.split(/\s+/);
    if (parts.length >= 5) {
      const total = parseInt(parts[1], 10) || 0;
      const used = parseInt(parts[2], 10) || 0;
      const avail = parseInt(parts[3], 10) || 0;
      const pct = total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
      return { totalBytes: total, usedBytes: used, freeBytes: avail, percent: pct };
    }
  } catch {}
  return { totalBytes: 0, usedBytes: 0, freeBytes: 0, percent: 0 };
}

function getOsPrettyName() {
  try {
    if (fs.existsSync('/etc/os-release')) {
      const txt = fs.readFileSync('/etc/os-release', 'utf8');
      const m = txt.match(/PRETTY_NAME="([^"]+)"/);
      if (m) return m[1];
    }
  } catch {}
  return `${os.type()} ${os.release()}`;
}

function getDirSizeBytes(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return 0;
    const out = execSync(`du -sb "${dirPath}" 2>/dev/null | cut -f1`, { encoding: 'utf8' }).trim();
    return parseInt(out, 10) || 0;
  } catch {
    return 0;
  }
}

function getProcessMetrics(pid) {
  if (!pid) return { memoryBytes: 0, cpuPercent: 0 };
  try {
    let memoryBytes = 0;
    const statusPath = `/proc/${pid}/status`;
    if (fs.existsSync(statusPath)) {
      const status = fs.readFileSync(statusPath, 'utf8');
      const rssMatch = status.match(/^VmRSS:\s+(\d+)\s+kB/m);
      if (rssMatch) {
        memoryBytes = parseInt(rssMatch[1], 10) * 1024;
      }
    }
    return { memoryBytes };
  } catch {
    return { memoryBytes: 0 };
  }
}

function getSystemStats() {
  const cpus = os.cpus();
  return {
    hostname: os.hostname(),
    os: getOsPrettyName(),
    kernel: os.release(),
    arch: os.arch(),
    cpuModel: cpus[0]?.model || 'x86_64 CPU',
    cpuCores: cpus.length,
    cpuPercent: getCpuPercent(),
    loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
    memory: getMemoryInfo(),
    disk: getDiskInfo(config.DATA_DIR),
    uptimeSeconds: Math.floor(os.uptime()),
    nodeVersion: process.version,
    runtimeMode: 'Native Process Engine (Docker-Free)',
    port: config.PORT,
  };
}

module.exports = {
  getSystemStats,
  getProcessMetrics,
  getDirSizeBytes,
};
