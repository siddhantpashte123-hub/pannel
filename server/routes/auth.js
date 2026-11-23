const express = require('express');
const { db } = require('../db');
const { verifyPassword, hashPassword, signToken, sanitizeUser } = require('../auth');
const { requireAuth } = require('../middleware');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.data.users.find(
    (u) =>
      u.username.toLowerCase() === String(username).trim().toLowerCase() ||
      (u.email && u.email.toLowerCase() === String(username).trim().toLowerCase())
  );

  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'Your account has been suspended by an administrator' });
  }

  user.lastLoginAt = new Date().toISOString();
  db.addAudit(user, 'USER_LOGIN', user.username, 'Signed into Obsidian Panel');

  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user), settings: db.data.settings });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.safeUser, settings: db.data.settings });
});

router.post('/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  if (!verifyPassword(String(currentPassword), req.user.passwordHash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  req.user.passwordHash = hashPassword(String(newPassword));
  db.addAudit(req.user, 'PASSWORD_CHANGED', req.user.username, 'Updated account password');
  res.json({ ok: true });
});

module.exports = router;
