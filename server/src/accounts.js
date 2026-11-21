// 账号启用流程：协调员开账号不设密码 → 系统生成一次性启用码（48 小时） → 顾客自己设密码并登录。
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, audit } from './db.js';

db.exec(`CREATE TABLE IF NOT EXISTS invites (
  code_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')))`);

const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // 去掉容易看错的 I L O 0 1
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const normalizeCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function unusablePasswordHash() {
  return bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
}

/** 生成新的启用码；同一用户之前未用的启用码全部作废 */
export function createInvite(userId, byUserId) {
  db.prepare(`UPDATE invites SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL`).run(userId);
  const bytes = crypto.randomBytes(10);
  const code = [...bytes].map(b => ALPH[b % ALPH.length]).join('');
  db.prepare(`INSERT INTO invites (code_hash, user_id, expires_at, created_by) VALUES (?, ?, datetime('now', '+2 days'), ?)`).run(sha(code), userId, byUserId ?? null);
  audit(byUserId, 'create_invite', `user:${userId}`);
  return code;
}

export function findInvite(code) {
  const c = normalizeCode(code);
  if (c.length < 8) return null;
  return db.prepare(`SELECT i.code_hash, i.user_id, i.expires_at, u.name, u.phone, u.role FROM invites i JOIN users u ON u.id = i.user_id
    WHERE i.code_hash = ? AND i.used_at IS NULL AND i.expires_at > datetime('now') AND u.active = 1`).get(sha(c));
}

export function useInvite(code, password) {
  const inv = findInvite(code);
  if (!inv) return null;
  // password 为 null 表示长者设备启用：不设密码，用长期 token 保持登录
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password ? bcrypt.hashSync(password, 10) : unusablePasswordHash(), inv.user_id);
  db.prepare(`UPDATE invites SET used_at = datetime('now') WHERE code_hash = ?`).run(inv.code_hash);
  audit(inv.user_id, 'activate_account', `user:${inv.user_id}`);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(inv.user_id);
}

export function maskPhone(p) {
  const s = String(p || '');
  return s.length > 6 ? `${s.slice(0, 3)}****${s.slice(-3)}` : s;
}

/** 简单的暴力破解防护：每个 IP 每 10 分钟最多 limit 次（Render 在代理后面，index.js 已设 trust proxy） */
const buckets = new Map();
const WINDOW = 10 * 60 * 1000;
function bucket(id) {
  const now = Date.now();
  const b = buckets.get(id) || { n: 0, reset: now + WINDOW };
  if (now > b.reset) { b.n = 0; b.reset = now + WINDOW; }
  buckets.set(id, b);
  return b;
}
/** 中间件：每次请求都计数 */
export function rateLimit(key, limit = 20) {
  return (req, res, next) => {
    const b = bucket(`${key}:${req.ip}`);
    b.n += 1;
    if (b.n > limit) return res.status(429).json({ error: 'too_many_attempts' });
    next();
  };
}
/** 只计失败次数（用于登录） */
export const failures = {
  blocked: (key, req, limit) => bucket(`${key}:${req.ip}`).n >= limit,
  hit: (key, req) => { bucket(`${key}:${req.ip}`).n += 1; },
  clear: (key, req) => buckets.delete(`${key}:${req.ip}`),
};
