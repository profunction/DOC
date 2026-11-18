// 开源项目接入：ntfy（自托管推送）与 Traccar（GPS 手表事件）。
import { db, nowIso } from './db.js';
import { broadcastClient } from './events.js';

// ---------- ntfy：协调员手机装开源 ntfy App，订阅 NTFY_TOPIC 即可收到警报，App 关着也能收 ----------
const NTFY_URL = (process.env.NTFY_URL || '').replace(/\/$/, '');     // 例如 https://ntfy.sh 或自托管 https://ntfy.example.com
const NTFY_TOPIC = process.env.NTFY_TOPIC || '';                        // 例如 anxin-alerts-xxxx（当成密码，越长越好）
const NTFY_TOKEN = process.env.NTFY_TOKEN || '';                        // 自托管开了鉴权时填

export async function pushNtfy({ title, message, priority = 'high', tags = ['rotating_light'], click }) {
  if (!NTFY_URL || !NTFY_TOPIC) return false;
  try {
    const headers = { Title: title, Priority: priority, Tags: tags.join(',') };
    if (click) headers.Click = click;
    if (NTFY_TOKEN) headers.Authorization = `Bearer ${NTFY_TOKEN}`;
    const r = await fetch(`${NTFY_URL}/${NTFY_TOPIC}`, { method: 'POST', headers, body: message });
    return r.ok;
  } catch (e) {
    console.error('ntfy 推送失败', e.message);
    return false;
  }
}

// ---------- Traccar：在 Traccar 的 Event forwarding 里填 http://本服务/api/integrations/traccar?key=TRACCAR_KEY ----------
// 文档：Traccar 支持把事件以 JSON 转发到任意 URL（event.forward.url）。手表的 SOS / 跌倒 / 离开围栏都会进来。
const TRACCAR_KEY = process.env.TRACCAR_KEY || '';
const TYPE_MAP = { sos: 'sos', alarm: 'sos', fallDown: 'fall', geofenceExit: 'geofence', lowBattery: 'other', powerOff: 'other' };

export function traccarHandler(req, res) {
  if (!TRACCAR_KEY || req.query.key !== TRACCAR_KEY) return res.status(401).json({ error: 'bad_key' });
  const b = req.body || {};
  const ev = b.event || {}; const pos = b.position || {}; const dev = b.device || {};
  const alarm = ev.attributes?.alarm || pos.attributes?.alarm;
  const evType = ev.type === 'alarm' ? (alarm === 'fallDown' ? 'fallDown' : 'alarm') : ev.type;
  const type = TYPE_MAP[evType];
  if (!type) return res.json({ ignored: ev.type });
  const watchId = dev.uniqueId || dev.name;
  const client = db.prepare('SELECT * FROM clients WHERE watch_id = ? AND active = 1').get(String(watchId || ''));
  if (!client) return res.status(404).json({ error: 'unknown_watch', watchId });
  const desc = `手表 ${watchId}：${ev.type}${alarm ? ' / ' + alarm : ''}`;
  const r = db.prepare(`INSERT INTO alerts (client_id, source, type, lat, lng, description, steps) VALUES (?, 'watch', ?, ?, ?, ?, ?)`)
    .run(client.id, type, pos.latitude ?? null, pos.longitude ?? null, desc, JSON.stringify([{ at: nowIso(), by: 'Traccar', action: 'created' }]));
  const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(r.lastInsertRowid);
  broadcastClient(client.id, 'alert', { ...alert, client_name: client.name });
  db.prepare(`INSERT INTO messages (client_id, sender_id, kind, text) VALUES (?, NULL, 'system', ?)`).run(client.id, `⌚ ${client.name} 的手表发出警报（${desc}）。协调中心已收到。`);
  broadcastClient(client.id, 'message', { client_id: client.id });
  pushNtfy({ title: `⌚ ${client.name} 手表警报`, message: `${desc}\n${client.address || ''}`, tags: ['watch', 'rotating_light'] });
  res.json({ ok: true, alert_id: alert.id });
}

export function integrationStatus() {
  return { ntfy: Boolean(NTFY_URL && NTFY_TOPIC), traccar: Boolean(TRACCAR_KEY) };
}
