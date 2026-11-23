const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = process.env.PANEL_DATA_DIR
  ? path.resolve(process.env.PANEL_DATA_DIR)
  : path.join(ROOT_DIR, 'data');

const BOTS_DIR = path.join(DATA_DIR, 'bots');
const LOGS_DIR = path.join(DATA_DIR, 'logs');
const DB_PATH = path.join(DATA_DIR, 'panel-db.json');
const SECRET_PATH = path.join(DATA_DIR, '.jwt_secret');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BOTS_DIR, { recursive: true });
fs.mkdirSync(LOGS_DIR, { recursive: true });

function getJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
    return process.env.JWT_SECRET;
  }
  if (fs.existsSync(SECRET_PATH)) {
    const saved = fs.readFileSync(SECRET_PATH, 'utf8').trim();
    if (saved.length >= 16) return saved;
  }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(SECRET_PATH, generated, { mode: 0o600 });
  return generated;
}

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  BOTS_DIR,
  LOGS_DIR,
  DB_PATH,
  PORT: parseInt(process.env.PORT || '2222', 10),
  HOST: process.env.HOST || '0.0.0.0',
  JWT_SECRET: getJwtSecret(),
  CLIENT_DIST: path.join(ROOT_DIR, 'client', 'dist'),
};
