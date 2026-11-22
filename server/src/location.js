// 定位精度 + 照顾人实时位置（上门途中共享给子女与协调员）
import { db, nowIso } from './db.js';
import { broadcastClient } from './events.js';

for (const sql of [
  `ALTER TABLE alerts ADD COLUMN accuracy REAL`,
  `ALTER TABLE watch_positions ADD COLUMN accuracy REAL`,
  `CREATE TABLE IF NOT EXISTS caregiver_positions (
     user_id INTEGER PRIMARY KEY REFERENCES users(id), lat REAL NOT NULL, lng REAL NOT NULL, accuracy REAL, task_id INTEGER, at TEXT NOT NULL DEFAULT (datetime('now')))`,
]) { try { db.exec(sql); } catch { /* 已存在 */ } }

/** 照顾人上报位置：只在有进行中 / 已安排（今天）的任务时接受，并广播给相关客人的家属与协调员 */
export function updateCaregiverPosition(user, lat, lng, accuracy) {
  const today = new Date().toISOString().slice(0, 10);
  const tasks = db.prepare(`SELECT id, client_id, status FROM tasks WHERE assignee_user_id = ? AND (status = 'in_progress' OR (status = 'assigned' AND substr(scheduled_at,1,10) = ?))`).all(user.id, today);
  if (!tasks.length) return { shared: false };
  const active = tasks.find(t => t.status === 'in_progress') || tasks[0];
  db.prepare(`INSERT INTO caregiver_positions (user_id, lat, lng, accuracy, task_id, at) VALUES (?,?,?,?,?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, accuracy = excluded.accuracy, task_id = excluded.task_id, at = excluded.at`).run(user.id, lat, lng, accuracy ?? null, active.id);
  const payload = { user_id: user.id, name: user.name, lat, lng, accuracy: accuracy ?? null, at: nowIso() };
  for (const cid of new Set(tasks.map(t => t.client_id))) broadcastClient(cid, 'caregiver', { client_id: cid, ...payload });
  return { shared: true, clients: [...new Set(tasks.map(t => t.client_id))] };
}

/** 某位客人现在能看到的照顾人位置（今天有任务且 20 分钟内有更新） */
export function caregiverForClient(clientId) {
  const today = new Date().toISOString().slice(0, 10);
  return db.prepare(`SELECT p.user_id, u.name, u.phone, p.lat, p.lng, p.accuracy, p.at, t.title AS task_title, t.status AS task_status
    FROM caregiver_positions p JOIN users u ON u.id = p.user_id JOIN tasks t ON t.id = p.task_id
    WHERE t.client_id = ? AND t.status IN ('assigned','in_progress') AND substr(t.scheduled_at,1,10) <= ? AND p.at > datetime('now', '-20 minutes')
    ORDER BY p.at DESC LIMIT 1`).get(clientId, today) || null;
}
