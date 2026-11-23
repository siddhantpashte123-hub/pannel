const { verifyToken, sanitizeUser } = require('./auth');
const { db } = require('./db');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const decoded = verifyToken(token);
    const user = db.data.users.find((u) => u.id === decoded.id);
    if (!user) return res.status(401).json({ error: 'Account no longer exists' });
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended' });
    }
    req.user = user;
    req.safeUser = sanitizeUser(user);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator privileges required' });
  }
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
};
