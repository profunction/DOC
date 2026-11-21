// 智能手表：接收 Traccar 转发的位置与事件，自己做安全范围、低电量、离线、心率判断，产生警报。
import { db, nowIso, audit } from './db.js';
import { broadcastClient } from './events.js';
import { pushNtfy } from './integrations.js';
import { pushFcmToClientAudience } from './fcm.js';

db.exec(`
CREATE TABLE IF NOT EXISTS watch_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  watch_id TEXT NOT NULL,
  lat REAL, lng REAL, speed REAL, battery INTEGER, heart_rate INTEGER, steps INTEGER,
  fix_time TEXT, received_at TEXT NOT NULL DEFAULT (datetime('now')),
  raw TEXT);
CREATE INDEX IF NOT EXISTS idx_watch_pos_client ON watch_positions(client_id, id DESC);
`);
for (const sql of [
  `ALTER TABLE clients ADD COLUMN safe_lat REAL`, `ALTER TABLE clients ADD COLUMN safe_lng REAL`,
  `ALTER TABLE clients ADD COLUMN safe_radius INTEGER NOT NULL DEFAULT 300`,     // 米，0 = 不启用
  `ALTER TABLE clients ADD COLUMN watch_last_seen TEXT`, `ALTER TABLE clients ADD COLUMN watch_battery INTEGER`,
  `ALTER TABLE clients ADD COLUMN watch_status TEXT`,                              // inside / outside / unknown
  `ALTER TABLE clients ADD COLUMN hr_min INTEGER NOT NULL DEFAULT 45`, `ALTER TABLE clients ADD COLUMN hr_max INTEGER NOT NULL DEFAULT 120`,
]) { try { db.exec(sql); } catch { /* 已存在 */ } }

const OFFLINE_HOURS = Number(process.env.WATCH_OFFLINE_HOURS || 6);
const LOW_BATTERY = Number(process.env.WATCH_LOW_BATTERY || 20);

export function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000, toR = (d) => d * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLng = toR(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function clientByWatch(watchId) {
  return db.prepare('SELECT * FROM clients WHERE watch_id = ? AND active = 1').get(String(watchId || ''));
}

/** 最近 N 小时内同类警报还没结案就不重复产生 */
function hasOpenAlert(clientId, type, hours = 2) {
  return Boolean(db.prepare(`SELECT id FROM alerts WHERE client_id = ? AND type = ? AND status != 'resolved' AND created_at > datetime('now', ?)`).get(clientId, type, `-${hours} hours`));
}

export function raiseWatchAlert(client, type, description, pos = {}, by = 'Traccar') {
  if (hasOpenAlert(client.id, type)) return null;
  const r = db.prepare(`INSERT INTO alerts (client_id, source, type, lat, lng, description, steps) VALUES (?, 'watch', ?, ?, ?, ?, ?)`)
    .run(client.id, type, pos.lat ?? null, pos.lng ?? null, description, JSON.stringify([{ at: nowIso(), by, action: 'created' }]));
  const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(r.lastInsertRowid);
  broadcastClient(client.id, 'alert', { ...alert, client_name: client.name });
  db.prepare(`INSERT INTO messages (client_id, sender_id, kind, text) VALUES (?, NULL, 'system', ?)`).run(client.id, `⌚ ${client.name}：${description}。协调中心已收到。`);
  broadcastClient(client.id, 'message', { client_id: client.id });
  const title = `⌚ ${client.name} ${description.split('（')[0]}`;
  pushNtfy({ title, message: `${description}\n${client.address || ''}${pos.lat ? `\nhttps://www.google.com/maps?q=${pos.lat},${pos.lng}` : ''}`, tags: ['watch', 'rotating_light'] });
  pushFcmToClientAudience(client.id, { title, body: description, data: { type: 'alert', alert_id: String(alert.id), client_id: String(client.id) } });
  return alert;
}

const LABEL = { sos: '手表 SOS 求助', fall: '手表侦测到跌倒', geofence: '走出安全范围', heart: '心跳异常', battery: '手表电量低', offline: '手表长时间没有信号', remove: '手表被摘下', other: '手表警报' };

/** Traccar 位置转发（forward.type=json）：{ position, device } */
export function handlePosition(body) {
  const pos = body.position || {}; const dev = body.device || {};
  const watchId = dev.uniqueId || dev.name || pos.deviceId;
  const client = clientByWatch(watchId);
  if (!client) return { ignored: 'unknown_watch', watchId };
  const a = pos.attributes || {};
  const battery = a.batteryLevel ?? a.battery ?? null;
  const hr = a.heartRate ?? a.heartrate ?? null;
  const rec = {
    lat: pos.latitude ?? null, lng: pos.longitude ?? null, speed: pos.speed ?? null,
    battery: battery == null ? null : Math.round(Number(battery)), heart_rate: hr == null ? null : Math.round(Number(hr)), steps: a.steps ?? null,
    fix_time: pos.fixTime || pos.deviceTime || null,
  };
  db.prepare(`INSERT INTO watch_positions (client_id, watch_id, lat, lng, speed, battery, heart_rate, steps, fix_time, raw) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(client.id, String(watchId), rec.lat, rec.lng, rec.speed, rec.battery, rec.heart_rate, rec.steps, rec.fix_time, JSON.stringify(body).slice(0, 4000));
  // 保留最近 2000 条
  db.prepare(`DELETE FROM watch_positions WHERE client_id = ? AND id < (SELECT id FROM watch_positions WHERE client_id = ? ORDER BY id DESC LIMIT 1 OFFSET 2000)`).run(client.id, client.id);

  let status = client.watch_status || 'unknown';
  const alerts = [];
  if (rec.lat != null && rec.lng != null && client.safe_lat != null && client.safe_lng != null && client.safe_radius > 0) {
    const d = distanceM(rec.lat, rec.lng, client.safe_lat, client.safe_lng);
    status = d > client.safe_radius ? 'outside' : 'inside';
    if (status === 'outside' && client.watch_status !== 'outside') alerts.push(raiseWatchAlert(client, 'geofence', `${LABEL.geofence}（距离家约 ${Math.round(d)} 米）`, rec));
  }
  if (rec.battery != null && rec.battery <= LOW_BATTERY && (client.watch_battery == null || client.watch_battery > LOW_BATTERY)) alerts.push(raiseWatchAlert(client, 'battery', `${LABEL.battery}（${rec.battery}%）`, rec));
  if (rec.heart_rate != null && rec.heart_rate > 0 && (rec.heart_rate < client.hr_min || rec.heart_rate > client.hr_max)) alerts.push(raiseWatchAlert(client, 'heart', `${LABEL.heart}（${rec.heart_rate} 次/分）`, rec));
  if (a.alarm) alerts.push(...handleAlarm(client, a.alarm, rec));

  // 注意：不覆盖 clients.lat/lng，那是家的坐标（导航、安全范围用）；手表位置只存在 watch_positions
  db.prepare(`UPDATE clients SET watch_last_seen = datetime('now'), watch_battery = COALESCE(?, watch_battery), watch_status = ? WHERE id = ?`)
    .run(rec.battery, status, client.id);
  broadcastClient(client.id, 'watch', { client_id: client.id, ...rec, status, at: nowIso() });
  return { ok: true, client_id: client.id, status, alerts: alerts.filter(Boolean).map(x => x.id) };
}

function handleAlarm(client, alarm, pos) {
  const map = { sos: 'sos', fallDown: 'fall', fall: 'fall', lowBattery: 'battery', removing: 'remove', tampering: 'remove', geofenceExit: 'geofence' };
  const type = map[alarm];
  if (!type) return [];
  return [raiseWatchAlert(client, type, `${LABEL[type]}（${alarm}）`, pos)];
}

/** Traccar 事件转发（event.forward.url）：{ event, position, device } */
export function handleEvent(body) {
  const ev = body.event || {}; const pos = body.position || {}; const dev = body.device || {};
  const client = clientByWatch(dev.uniqueId || dev.name);
  if (!client) return { ignored: 'unknown_watch' };
  const p = { lat: pos.latitude ?? null, lng: pos.longitude ?? null };
  const alarm = ev.attributes?.alarm || pos.attributes?.alarm;
  let out = [];
  if (ev.type === 'alarm' && alarm) out = handleAlarm(client, alarm, p);
  else if (ev.type === 'geofenceExit') out = [raiseWatchAlert(client, 'geofence', `${LABEL.geofence}（Traccar 围栏）`, p)];
  else if (ev.type === 'deviceOffline') out = [raiseWatchAlert(client, 'offline', LABEL.offline, p)];
  else if (ev.type === 'deviceOnline') { db.prepare(`UPDATE clients SET watch_last_seen = datetime('now') WHERE id = ?`).run(client.id); return { ok: true, online: true }; }
  else return { ignored: ev.type };
  if (body.position) handlePosition({ position: body.position, device: dev });
  return { ok: true, alerts: out.filter(Boolean).map(x => x.id) };
}

/** 每 15 分钟检查：有手表但超过 N 小时没信号 → 离线警报 */
export function checkOffline() {
  const rows = db.prepare(`SELECT * FROM clients WHERE active = 1 AND watch_id IS NOT NULL AND watch_id != '' AND watch_last_seen IS NOT NULL AND watch_last_seen < datetime('now', ?)`).all(`-${OFFLINE_HOURS} hours`);
  for (const c of rows) raiseWatchAlert(c, 'offline', `${LABEL.offline}（超过 ${OFFLINE_HOURS} 小时）`, {}, '系统');
  return rows.length;
}
export function scheduleOfflineCheck() {
  setInterval(() => { try { checkOffline(); } catch (e) { console.error('offline check', e.message); } }, 15 * 60 * 1000).unref();
}

export function watchSummary(clientId) {
  const c = db.prepare('SELECT id, name, watch_id, watch_last_seen, watch_battery, watch_status, safe_lat, safe_lng, safe_radius, hr_min, hr_max, lat, lng FROM clients WHERE id = ?').get(clientId);
  if (!c) return null;
  const last = db.prepare('SELECT lat, lng, speed, battery, heart_rate, steps, fix_time, received_at FROM watch_positions WHERE client_id = ? ORDER BY id DESC LIMIT 1').get(clientId) || null;
  const offline = c.watch_last_seen ? (Date.now() - new Date(c.watch_last_seen.replace(' ', 'T') + 'Z').getTime()) > OFFLINE_HOURS * 3600e3 : true;
  return { ...c, last, offline, offline_hours: OFFLINE_HOURS, low_battery: LOW_BATTERY };
}
export function watchTrail(clientId, hours = 24) {
  return db.prepare(`SELECT lat, lng, battery, heart_rate, fix_time, received_at FROM watch_positions WHERE client_id = ? AND received_at > datetime('now', ?) AND lat IS NOT NULL ORDER BY id DESC LIMIT 500`).all(clientId, `-${hours} hours`);
}
export { audit };
