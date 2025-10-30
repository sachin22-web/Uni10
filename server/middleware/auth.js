const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

async function authOptional(req, res, next) {
  const authHeader = req.headers && req.headers.authorization;
  const token = (req.cookies && req.cookies.token) || (authHeader ? (authHeader.split(' ')[1] || null) : null) || req.query.token || null;
  if (!token) return next();
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (user) req.user = user;
  } catch (e) {
    // ignore
  }
  return next();
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers && req.headers.authorization;
  const token = (req.cookies && req.cookies.token) || (authHeader ? (authHeader.split(' ')[1] || null) : null) || req.query.token || null;
  if (!token) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    req.user = user;
    return next();
  } catch (e) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.user.role !== 'admin') return res.status(403).json({ ok: false, message: 'Forbidden' });
  return next();
}

module.exports = { authOptional, requireAuth, requireAdmin };
