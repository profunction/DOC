// 子女 / 照顾人 / 协调员 App 关着也能收到推送：Firebase Cloud Messaging HTTP v1。
// 需要：Firebase 项目的服务账号 JSON（环境变量 FCM_SERVICE_ACCOUNT，整段 JSON）。没有时静默不发。
import crypto from 'node:crypto';
import { db } from './db.js';
import { audienceForClient } from './events.js';

db.exec(`CREATE TABLE IF NOT EXISTS push_tokens (
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), platform TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);

let sa = null;
try { sa = process.env.FCM_SERVICE_ACCOUNT ? JSON.parse(process.env.FCM_SERVICE_ACCOUNT) : null; } catch { console.error('FCM_SERVICE_ACCOUNT 不是合法 JSON'); }
export const fcmConfigured = () => Boolean(sa?.client_email && sa?.private_key && sa?.project_id);

export function saveToken(userId, token, platform) {
  if (!token || token.length < 20) return;
  db.prepare(`INSERT INTO push_tokens (token, user_id, platform, updated_at) VALUES (?,?,?, datetime('now'))
    ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform, updated_at = excluded.updated_at`).run(token, userId, platform || 'android');
}
export function removeToken(token) { db.prepare('DELETE FROM push_tokens WHERE token = ?').run(token); }

let cached = { token: '', exp: 0 };
async function accessToken() {
  if (cached.exp > Date.now() + 60e3) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${sig}` });
  const j = await r.json();
  if (!j.access_token) throw new Error('FCM token: ' + JSON.stringify(j).slice(0, 200));
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

/** 发给一批用户（每个用户可能有多台手机） */
export async function pushFcmToUsers(userIds, { title, body, data = {} }) {
  if (!fcmConfigured() || !userIds.length) return 0;
  const rows = db.prepare(`SELECT token FROM push_tokens WHERE user_id IN (${userIds.map(() => '?').join(',')})`).all(...userIds);
  if (!rows.length) return 0;
  let sent = 0;
  try {
    const at = await accessToken();
    for (const { token } of rows) {
      const msg = { message: { token, notification: { title, body }, data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
        android: { priority: 'high', notification: { channel_id: data.type === 'alert' ? 'alerts' : 'general', sound: 'default' } } } };
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, { method: 'POST', headers: { authorization: `Bearer ${at}`, 'content-type': 'application/json' }, body: JSON.stringify(msg) });
      if (r.ok) sent++;
      else { const e = await r.json().catch(() => ({})); if (e?.error?.details?.some(d => d.errorCode === 'UNREGISTERED') || r.status === 404) removeToken(token); }
    }
  } catch (e) { console.error('FCM 发送失败', e.message); }
  return sent;
}
/** 发给与某位客人有关的所有人（协调员、家属、长者、照顾人），可排除触发者本人 */
export function pushFcmToClientAudience(clientId, payload, exceptUserId = null) {
  const ids = audienceForClient(clientId).filter(id => id !== exceptUserId);
  return pushFcmToUsers(ids, payload);
}
