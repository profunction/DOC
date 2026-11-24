// 数据库与加密工具。健康资料以 AES-256-GCM 加密后落盘（符合 PDPA 对敏感资料的要求）。
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'anxin.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- 加密 ----------
function loadKey() {
  const hex = process.env.DATA_KEY;
  if (hex && /^[0-9a-f]{64}$/i.test(hex)) return Buffer.from(hex, 'hex');
  // 开发环境：自动生成并保存一把钥匙（生产环境必须用环境变量 DATA_KEY）
  const keyFile = path.join(DATA_DIR, '.data_key');
  if (fs.existsSync(keyFile)) return Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'hex');
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyFile, key.toString('hex'), { mode: 0o600 });
  return key;
}
const KEY = loadKey();

export function encrypt(obj) {
  if (obj === undefined || obj === null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const plain = Buffer.from(JSON.stringify(obj), 'utf8');
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(b64) {
  if (!b64) return null;
  try {
    const buf = Buffer.from(b64, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

// ---------- 结构 ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'zh',
  client_id INTEGER,                      -- elder 账号对应的客人
  region TEXT,                            -- caregiver 负责地区
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (                 -- 老人（客人）
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gender TEXT,
  birth_year INTEGER,
  address TEXT,
  region TEXT,
  lat REAL, lng REAL,
  plan TEXT NOT NULL DEFAULT 'standard',             -- basic / standard / full / subsidised
  monthly_fee INTEGER NOT NULL DEFAULT 450,
  emergency_contact TEXT,                              -- 第二紧急联络人
  preferred_hospital TEXT,
  consent_at TEXT,                                     -- 个人资料保护法书面同意时间
  health_enc TEXT,                                     -- 加密后的健康档案 JSON
  watch_id TEXT,                                       -- 智能手表编号
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS family_links (
  user_id INTEGER NOT NULL REFERENCES users(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  relation TEXT,
  PRIMARY KEY (user_id, client_id)
);

CREATE TABLE IF NOT EXISTS partners (                -- 合作伙伴：诊所、护士、看护、司机、用品店、救护车、辅导员
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  license_no TEXT,
  license_body TEXT,                                   -- MMC / 护士局 / 辅导员局 ...
  region TEXT,
  duty_hours TEXT,
  price_note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  photo_url TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS tasks (                   -- 预约 / 派单（探访、陪诊、买药、接送、钟点工、物理治疗）
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',          -- requested / assigned / in_progress / done / cancelled
  assignee_user_id INTEGER REFERENCES users(id),
  partner_id INTEGER REFERENCES partners(id),
  notes TEXT,
  fee INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (                 -- 探访 / 看诊报告
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  task_id INTEGER REFERENCES tasks(id),
  reporter_id INTEGER REFERENCES users(id),
  kind TEXT NOT NULL DEFAULT 'visit',                -- visit / consult
  mood TEXT,
  bp TEXT, glucose TEXT, temp TEXT,
  meds TEXT,
  diet_sleep TEXT,
  home_safety TEXT,
  requests TEXT,
  follow_up TEXT,
  photo_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (                  -- 紧急事件
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  source TEXT NOT NULL,                                -- app / watch / family / hotline
  type TEXT NOT NULL,                                  -- sos / fall / heart / geofence / fever / other
  lat REAL, lng REAL,
  severity TEXT,                                       -- mild / severe / false
  status TEXT NOT NULL DEFAULT 'new',                  -- new / acknowledged / dispatched / resolved
  handled_by INTEGER REFERENCES users(id),
  description TEXT,
  steps TEXT NOT NULL DEFAULT '[]',                    -- JSON: [{at, by, action}]
  outcome TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (                -- 家庭群组
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  sender_id INTEGER REFERENCES users(id),
  kind TEXT NOT NULL DEFAULT 'user',                   -- user / system
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  period TEXT NOT NULL,                                -- 2026-11
  item TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'due',                  -- due / paid
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS aid_applications (        -- 政府与慈善援助申请进度
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  scheme TEXT NOT NULL,
  agency TEXT,
  status TEXT NOT NULL DEFAULT 'preparing',            -- preparing / submitted / approved / rejected
  docs TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (               -- 谁看过健康资料（PDPA）
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  target TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// 后加的字段（旧数据库自动补上）
for (const sql of [
  `ALTER TABLE clients ADD COLUMN verified INTEGER NOT NULL DEFAULT 1`,   // 0 = 顾客自助注册、协调员尚未确认
  `ALTER TABLE clients ADD COLUMN source TEXT`,
]) { try { db.exec(sql); } catch { /* 已存在 */ } }

// 旧版 users 表有 role 的 CHECK 约束（不含 admin），重建一次
try {
  const sql = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get()?.sql || '';
  if (/CHECK \(role IN/.test(sql)) {
    db.exec(`PRAGMA foreign_keys = OFF; BEGIN;
      CREATE TABLE users_new (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL,
        lang TEXT NOT NULL DEFAULT 'zh', client_id INTEGER, region TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      INSERT INTO users_new SELECT id, phone, password_hash, name, role, lang, client_id, region, active, created_at FROM users;
      DROP TABLE users; ALTER TABLE users_new RENAME TO users; COMMIT; PRAGMA foreign_keys = ON;`);
  }
} catch (e) { console.error('users 表迁移失败', e.message); }

export function audit(userId, action, target) {
  db.prepare('INSERT INTO audit_log (user_id, action, target) VALUES (?,?,?)').run(userId ?? null, action, target ?? null);
}

export function nowIso() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
