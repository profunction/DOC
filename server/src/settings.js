// 系统设置（存在数据库，协调员在 App 里改；没设时退回环境变量）
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';

db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);

const ENV = {
  hotline: () => process.env.HOTLINE_PHONE || '60123456789',
  ntfy_url: () => process.env.NTFY_URL || 'https://ntfy.sh',
  ntfy_topic: () => process.env.NTFY_TOPIC || '',
  ntfy_token: () => process.env.NTFY_TOKEN || '',
};
export const SETTING_KEYS = Object.keys(ENV);

export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (row && row.value !== null && row.value !== '') return row.value;
  return ENV[key] ? ENV[key]() : '';
}
export function setSetting(key, value) {
  if (!SETTING_KEYS.includes(key)) return;
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(key, value == null ? '' : String(value));
}
export function getHotline() { return getSetting('hotline').replace(/[^0-9]/g, '') || '60123456789'; }

// ---------- 每日自动备份：DATA_DIR/backups，保留 7 份 ----------
const DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data');
export const BACKUP_DIR = path.join(DATA_DIR, 'backups');

export async function backupNow() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `anxin-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)}.db`);
  await db.backup(file);
  const all = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db')).sort();
  for (const old of all.slice(0, Math.max(0, all.length - 7))) fs.rmSync(path.join(BACKUP_DIR, old), { force: true });
  return file;
}
export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db')).sort().reverse()
    .map(f => ({ file: f, size: fs.statSync(path.join(BACKUP_DIR, f)).size }));
}
export function scheduleBackups() {
  const run = () => backupNow().then(f => console.log('已备份', path.basename(f))).catch(e => console.error('备份失败', e.message));
  setTimeout(run, 60 * 1000).unref();
  setInterval(run, 24 * 60 * 60 * 1000).unref();
}
