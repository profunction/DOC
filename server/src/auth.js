import jwt from 'jsonwebtoken';
import { db } from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';

export function sign(user) {
  // 长者手机设定好后永远不用再登录；其他人 60 天，每次打开 App（/api/me）自动续期
  return jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, { expiresIn: user.role === 'elder' ? '3650d' : '60d' });
}

export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'unauthorized' });
  const user = db.prepare('SELECT id, phone, name, role, lang, client_id, region, active FROM users WHERE id = ?').get(payload.uid);
  if (!user || !user.active) return res.status(401).json({ error: 'unauthorized' });
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

/** 该用户可以看到哪些客人 */
export function clientIdsFor(user) {
  if (user.role === 'coordinator') return db.prepare('SELECT id FROM clients WHERE active = 1').all().map(r => r.id);
  if (user.role === 'elder') return user.client_id ? [user.client_id] : [];
  if (user.role === 'family') return db.prepare('SELECT client_id FROM family_links WHERE user_id = ?').all(user.id).map(r => r.client_id);
  if (user.role === 'caregiver') {
    return db.prepare(`SELECT DISTINCT client_id FROM tasks WHERE assignee_user_id = ? AND status IN ('assigned','in_progress')`).all(user.id).map(r => r.client_id);
  }
  return [];
}

export function canSeeClient(user, clientId) {
  return clientIdsFor(user).includes(Number(clientId));
}
