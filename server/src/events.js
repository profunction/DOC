// Server-Sent Events：协调员、子女、照顾人实时收到警报、报告、群组讯息。
import { db } from './db.js';

const subscribers = new Map(); // userId -> Set<res>

export function subscribe(user, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: hello\ndata: ${JSON.stringify({ uid: user.id })}\n\n`);
  if (!subscribers.has(user.id)) subscribers.set(user.id, new Set());
  subscribers.get(user.id).add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  res.on('close', () => {
    clearInterval(ping);
    subscribers.get(user.id)?.delete(res);
  });
}

function sendTo(userId, event, data) {
  const set = subscribers.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) res.write(payload);
}

/** 与某位客人有关的所有人：协调员 + 家属 + 该客人的老人账号 + 正在服务的照顾人 */
export function audienceForClient(clientId) {
  const ids = new Set();
  db.prepare(`SELECT id FROM users WHERE role IN ('coordinator','admin') AND active = 1`).all().forEach(r => ids.add(r.id));
  db.prepare('SELECT user_id FROM family_links WHERE client_id = ?').all(clientId).forEach(r => ids.add(r.user_id));
  db.prepare(`SELECT id FROM users WHERE role = 'elder' AND client_id = ?`).all(clientId).forEach(r => ids.add(r.id));
  db.prepare(`SELECT DISTINCT assignee_user_id AS id FROM tasks WHERE client_id = ? AND assignee_user_id IS NOT NULL AND status IN ('assigned','in_progress')`).all(clientId).forEach(r => ids.add(r.id));
  return [...ids];
}

export function broadcastClient(clientId, event, data) {
  for (const uid of audienceForClient(clientId)) sendTo(uid, event, data);
}

export function broadcastUser(userId, event, data) {
  sendTo(userId, event, data);
}
