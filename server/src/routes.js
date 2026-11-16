import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, encrypt, decrypt, audit, nowIso } from './db.js';
import { sign, requireAuth, requireRole, clientIdsFor, canSeeClient } from './auth.js';
import { subscribe, broadcastClient } from './events.js';

export const api = Router();
const pub = Router();

db.exec(`CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, city TEXT, message TEXT, lang TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')))`);

const HOTLINE = process.env.HOTLINE_PHONE || '60123456789';

function safeUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}
function clientOut(row, withHealth) {
  if (!row) return null;
  const { health_enc, ...rest } = row;
  return withHealth ? { ...rest, health: decrypt(health_enc) || {} } : rest;
}
function systemMessage(clientId, text) {
  const r = db.prepare(`INSERT INTO messages (client_id, sender_id, kind, text) VALUES (?, NULL, 'system', ?)`).run(clientId, text);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(r.lastInsertRowid);
  broadcastClient(clientId, 'message', msg);
  return msg;
}
function guardClient(req, res) {
  const id = Number(req.params.id ?? req.body?.client_id ?? req.query.client_id);
  if (!id || !canSeeClient(req.user, id)) { res.status(403).json({ error: 'forbidden' }); return null; }
  return id;
}

// ---------- 公开 ----------
pub.get('/info', (req, res) => {
  res.json({
    hotline: HOTLINE,
    whatsapp: `https://wa.me/${HOTLINE}`,
    plans: [
      { id: 'basic', fee: [150, 200] },
      { id: 'standard', fee: [400, 500] },
      { id: 'full', fee: [800, 1000] },
    ],
  });
});
pub.post('/enquiry', (req, res) => {
  const { name, phone, city, message, lang } = req.body || {};
  if (!phone || !name) return res.status(400).json({ error: 'name_phone_required' });
  db.prepare('INSERT INTO enquiries (name, phone, city, message, lang) VALUES (?,?,?,?,?)').run(name, phone, city || null, message || null, lang || 'zh');
  res.json({ ok: true });
});
api.post('/auth/login', (req, res) => {
  const { phone, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE phone = ? AND active = 1').get(String(phone || '').trim());
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash)) return res.status(401).json({ error: 'bad_credentials' });
  audit(u.id, 'login');
  res.json({ token: sign(u), user: safeUser(u) });
});
api.use('/public', pub);

// ---------- 需要登录 ----------
api.use(requireAuth);

api.get('/me', (req, res) => {
  const clients = clientIdsFor(req.user);
  res.json({ user: req.user, client_ids: clients, hotline: HOTLINE });
});
api.patch('/me', (req, res) => {
  const { lang, name } = req.body || {};
  if (lang) db.prepare('UPDATE users SET lang = ? WHERE id = ?').run(lang, req.user.id);
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  res.json({ ok: true });
});
api.get('/events', (req, res) => subscribe(req.user, res));

// ---------- 客人 ----------
api.get('/clients', (req, res) => {
  const ids = clientIdsFor(req.user);
  if (!ids.length) return res.json([]);
  const rows = db.prepare(`SELECT * FROM clients WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY name`).all(...ids);
  res.json(rows.map(r => clientOut(r, false)));
});
api.get('/clients/:id', (req, res) => {
  const id = guardClient(req, res); if (!id) return;
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  audit(req.user.id, 'view_health', `client:${id}`);
  const family = db.prepare(`SELECT u.id, u.name, u.phone, f.relation FROM family_links f JOIN users u ON u.id = f.user_id WHERE f.client_id = ?`).all(id);
  res.json({ ...clientOut(row, true), family });
});
api.post('/clients', requireRole('coordinator'), (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'name_required' });
  const r = db.prepare(`INSERT INTO clients (name, gender, birth_year, address, region, lat, lng, plan, monthly_fee, emergency_contact, preferred_hospital, consent_at, health_enc, watch_id, notes)
    VALUES (@name,@gender,@birth_year,@address,@region,@lat,@lng,@plan,@monthly_fee,@emergency_contact,@preferred_hospital,@consent_at,@health_enc,@watch_id,@notes)`).run({
    name: b.name, gender: b.gender || null, birth_year: b.birth_year || null, address: b.address || null, region: b.region || null,
    lat: b.lat || null, lng: b.lng || null, plan: b.plan || 'standard', monthly_fee: b.monthly_fee || 450,
    emergency_contact: b.emergency_contact || null, preferred_hospital: b.preferred_hospital || null,
    consent_at: b.consent ? nowIso() : null, health_enc: encrypt(b.health || {}), watch_id: b.watch_id || null, notes: b.notes || null,
  });
  res.json({ id: r.lastInsertRowid });
});
api.patch('/clients/:id', requireRole('coordinator'), (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};
  const cols = ['name','gender','birth_year','address','region','lat','lng','plan','monthly_fee','emergency_contact','preferred_hospital','watch_id','notes','active'];
  for (const c of cols) if (b[c] !== undefined) db.prepare(`UPDATE clients SET ${c} = ? WHERE id = ?`).run(b[c], id);
  if (b.health !== undefined) {
    const merged = { ...(decrypt(cur.health_enc) || {}), ...b.health };
    db.prepare('UPDATE clients SET health_enc = ? WHERE id = ?').run(encrypt(merged), id);
    audit(req.user.id, 'edit_health', `client:${id}`);
  }
  if (b.consent === true && !cur.consent_at) db.prepare('UPDATE clients SET consent_at = ? WHERE id = ?').run(nowIso(), id);
  res.json({ ok: true });
});
/** 老人首页 / 子女首页用：今天的安排、最近报告、未关闭警报 */
api.get('/clients/:id/summary', (req, res) => {
  const id = guardClient(req, res); if (!id) return;
  const client = clientOut(db.prepare('SELECT * FROM clients WHERE id = ?').get(id), false);
  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = db.prepare(`SELECT t.*, u.name AS assignee_name, p.name AS partner_name FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_user_id LEFT JOIN partners p ON p.id = t.partner_id
      WHERE t.client_id = ? AND substr(t.scheduled_at,1,10) = ? AND t.status != 'cancelled' ORDER BY t.scheduled_at`).all(id, today);
  const upcoming = db.prepare(`SELECT t.*, u.name AS assignee_name, p.name AS partner_name FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_user_id LEFT JOIN partners p ON p.id = t.partner_id
      WHERE t.client_id = ? AND substr(t.scheduled_at,1,10) > ? AND t.status != 'cancelled' ORDER BY t.scheduled_at LIMIT 5`).all(id, today);
  const lastReport = db.prepare(`SELECT r.*, u.name AS reporter_name FROM reports r LEFT JOIN users u ON u.id = r.reporter_id WHERE r.client_id = ? ORDER BY r.created_at DESC LIMIT 1`).get(id);
  const openAlerts = db.prepare(`SELECT * FROM alerts WHERE client_id = ? AND status != 'resolved' ORDER BY created_at DESC`).all(id);
  const lastAlert = db.prepare(`SELECT * FROM alerts WHERE client_id = ? ORDER BY created_at DESC LIMIT 1`).get(id);
  const dueAmount = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE client_id = ? AND status = 'due'`).get(id).s;
  res.json({ client, todayTasks, upcoming, lastReport, openAlerts, lastAlert, dueAmount });
});

// ---------- 警报 ----------
api.post('/alerts', (req, res) => {
  const b = req.body || {};
  const clientId = Number(b.client_id || req.user.client_id);
  if (!clientId || !canSeeClient(req.user, clientId)) return res.status(403).json({ error: 'forbidden' });
  const type = b.type || 'sos';
  const source = b.source || (req.user.role === 'elder' ? 'app' : req.user.role === 'family' ? 'family' : 'hotline');
  const r = db.prepare(`INSERT INTO alerts (client_id, source, type, lat, lng, description, steps) VALUES (?,?,?,?,?,?,?)`)
    .run(clientId, source, type, b.lat ?? null, b.lng ?? null, b.description || null,
      JSON.stringify([{ at: nowIso(), by: req.user.name, action: 'created' }]));
  const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(r.lastInsertRowid);
  const client = db.prepare('SELECT name FROM clients WHERE id = ?').get(clientId);
  broadcastClient(clientId, 'alert', { ...alert, client_name: client?.name });
  systemMessage(clientId, `🚨 ${client?.name} 发出${labelType(type)}（来源：${source}）。协调中心已收到，会在三分钟内回电。`);
  res.json(alert);
});
function labelType(t) {
  return { sos: '紧急求助', fall: '跌倒警报', heart: '心跳异常警报', geofence: '走出安全范围警报', fever: '发烧求助', other: '求助' }[t] || '求助';
}
api.get('/alerts', (req, res) => {
  const ids = clientIdsFor(req.user);
  if (!ids.length) return res.json([]);
  const where = [`a.client_id IN (${ids.map(() => '?').join(',')})`];
  const params = [...ids];
  if (req.query.status === 'open') where.push(`a.status != 'resolved'`);
  else if (req.query.status) { where.push('a.status = ?'); params.push(req.query.status); }
  if (req.query.client_id) { where.push('a.client_id = ?'); params.push(Number(req.query.client_id)); }
  const rows = db.prepare(`SELECT a.*, c.name AS client_name, c.address, c.preferred_hospital, u.name AS handler_name FROM alerts a
      JOIN clients c ON c.id = a.client_id LEFT JOIN users u ON u.id = a.handled_by
      WHERE ${where.join(' AND ')} ORDER BY a.created_at DESC LIMIT 200`).all(...params);
  res.json(rows.map(r => ({ ...r, steps: JSON.parse(r.steps || '[]') })));
});
api.patch('/alerts/:id', requireRole('coordinator', 'caregiver'), (req, res) => {
  const a = db.prepare('SELECT * FROM alerts WHERE id = ?').get(Number(req.params.id));
  if (!a) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};
  const steps = JSON.parse(a.steps || '[]');
  if (b.action) steps.push({ at: nowIso(), by: req.user.name, action: b.action });
  const status = b.status || a.status;
  db.prepare(`UPDATE alerts SET status = ?, severity = COALESCE(?, severity), handled_by = ?, outcome = COALESCE(?, outcome), steps = ?,
      resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') ELSE resolved_at END WHERE id = ?`)
    .run(status, b.severity || null, req.user.id, b.outcome || null, JSON.stringify(steps), status, a.id);
  const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(a.id);
  broadcastClient(a.client_id, 'alert', { ...updated, steps });
  if (b.action) systemMessage(a.client_id, `📋 ${req.user.name}：${b.action}`);
  if (status === 'resolved') systemMessage(a.client_id, `✅ 事件已处理完毕${b.outcome ? '：' + b.outcome : ''}`);
  res.json({ ...updated, steps });
});

// ---------- 任务 / 预约 ----------
api.get('/tasks', (req, res) => {
  const ids = clientIdsFor(req.user);
  const where = []; const params = [];
  if (req.user.role === 'caregiver' || req.query.mine) { where.push('t.assignee_user_id = ?'); params.push(req.user.id); }
  else { if (!ids.length) return res.json([]); where.push(`t.client_id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
  if (req.query.client_id) { where.push('t.client_id = ?'); params.push(Number(req.query.client_id)); }
  if (req.query.status) { where.push('t.status = ?'); params.push(req.query.status); }
  if (req.query.from) { where.push('t.scheduled_at >= ?'); params.push(req.query.from); }
  const rows = db.prepare(`SELECT t.*, c.name AS client_name, c.address, c.region AS client_region, u.name AS assignee_name, p.name AS partner_name FROM tasks t
      JOIN clients c ON c.id = t.client_id LEFT JOIN users u ON u.id = t.assignee_user_id LEFT JOIN partners p ON p.id = t.partner_id
      WHERE ${where.join(' AND ')} ORDER BY t.scheduled_at DESC LIMIT 300`).all(...params);
  res.json(rows);
});
api.post('/tasks', requireRole('family', 'coordinator', 'elder'), (req, res) => {
  const b = req.body || {};
  const clientId = Number(b.client_id || req.user.client_id);
  if (!clientId || !canSeeClient(req.user, clientId)) return res.status(403).json({ error: 'forbidden' });
  if (!b.type || !b.scheduled_at) return res.status(400).json({ error: 'type_time_required' });
  const status = req.user.role === 'coordinator' && b.assignee_user_id ? 'assigned' : 'requested';
  const r = db.prepare(`INSERT INTO tasks (client_id, type, title, scheduled_at, status, assignee_user_id, partner_id, notes, fee, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(clientId, b.type, b.title || b.type, b.scheduled_at, status,
    b.assignee_user_id || null, b.partner_id || null, b.notes || null, b.fee || 0, req.user.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(r.lastInsertRowid);
  broadcastClient(clientId, 'task', task);
  systemMessage(clientId, `📅 ${req.user.name} 预约了「${task.title}」，时间 ${task.scheduled_at}。`);
  res.json(task);
});
api.patch('/tasks/:id', requireRole('coordinator', 'caregiver', 'family'), (req, res) => {
  const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.id));
  if (!t) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};
  if (req.user.role === 'caregiver') {
    if (t.assignee_user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    if (b.status) db.prepare(`UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(b.status, t.id);
  } else if (req.user.role === 'family') {
    if (!canSeeClient(req.user, t.client_id)) return res.status(403).json({ error: 'forbidden' });
    if (b.status === 'cancelled') db.prepare(`UPDATE tasks SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(t.id);
  } else {
    for (const c of ['type','title','scheduled_at','status','assignee_user_id','partner_id','notes','fee'])
      if (b[c] !== undefined) db.prepare(`UPDATE tasks SET ${c} = ?, updated_at = datetime('now') WHERE id = ?`).run(b[c], t.id);
    if (b.assignee_user_id && !b.status && t.status === 'requested') db.prepare(`UPDATE tasks SET status = 'assigned' WHERE id = ?`).run(t.id);
  }
  const task = db.prepare(`SELECT t.*, u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_user_id WHERE t.id = ?`).get(t.id);
  broadcastClient(t.client_id, 'task', task);
  if (b.assignee_user_id && task.assignee_name) systemMessage(t.client_id, `👤 「${task.title}」已安排 ${task.assignee_name} 负责。`);
  if (b.status === 'done') systemMessage(t.client_id, `✔️ 「${task.title}」已完成。`);
  res.json(task);
});

// ---------- 报告 ----------
api.get('/reports', (req, res) => {
  const ids = clientIdsFor(req.user);
  if (!ids.length) return res.json([]);
  const params = [...ids]; const where = [`r.client_id IN (${ids.map(() => '?').join(',')})`];
  if (req.query.client_id) { where.push('r.client_id = ?'); params.push(Number(req.query.client_id)); }
  const rows = db.prepare(`SELECT r.*, c.name AS client_name, u.name AS reporter_name FROM reports r JOIN clients c ON c.id = r.client_id
      LEFT JOIN users u ON u.id = r.reporter_id WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC LIMIT 200`).all(...params);
  res.json(rows);
});
api.post('/reports', requireRole('caregiver', 'coordinator'), (req, res) => {
  const b = req.body || {};
  const clientId = Number(b.client_id);
  if (!clientId || !canSeeClient(req.user, clientId)) return res.status(403).json({ error: 'forbidden' });
  const r = db.prepare(`INSERT INTO reports (client_id, task_id, reporter_id, kind, mood, bp, glucose, temp, meds, diet_sleep, home_safety, requests, follow_up)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(clientId, b.task_id || null, req.user.id, b.kind || 'visit', b.mood || null, b.bp || null,
    b.glucose || null, b.temp || null, b.meds || null, b.diet_sleep || null, b.home_safety || null, b.requests || null, b.follow_up || null);
  if (b.task_id) db.prepare(`UPDATE tasks SET status = 'done', updated_at = datetime('now') WHERE id = ?`).run(b.task_id);
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(r.lastInsertRowid);
  broadcastClient(clientId, 'report', report);
  systemMessage(clientId, `📝 ${req.user.name} 提交了${b.kind === 'consult' ? '看诊' : '探访'}报告：精神${b.mood || '-'}，血压 ${b.bp || '-'}，吃药 ${b.meds || '-'}。${b.follow_up ? '需跟进：' + b.follow_up : ''}`);
  res.json(report);
});

// ---------- 家庭群组 ----------
api.get('/messages', (req, res) => {
  const id = guardClient(req, res); if (!id) return;
  const after = Number(req.query.after || 0);
  const rows = db.prepare(`SELECT m.*, u.name AS sender_name, u.role AS sender_role FROM messages m LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.client_id = ? AND m.id > ? ORDER BY m.id DESC LIMIT 100`).all(id, after).reverse();
  res.json(rows);
});
api.post('/messages', (req, res) => {
  const clientId = Number(req.body?.client_id || req.user.client_id);
  if (!clientId || !canSeeClient(req.user, clientId)) return res.status(403).json({ error: 'forbidden' });
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  const r = db.prepare(`INSERT INTO messages (client_id, sender_id, kind, text) VALUES (?,?, 'user', ?)`).run(clientId, req.user.id, text);
  const msg = db.prepare(`SELECT m.*, u.name AS sender_name, u.role AS sender_role FROM messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.id = ?`).get(r.lastInsertRowid);
  broadcastClient(clientId, 'message', msg);
  res.json(msg);
});

// ---------- 合作伙伴 ----------
api.get('/partners', (req, res) => {
  const rows = db.prepare(`SELECT * FROM partners ${req.user.role === 'coordinator' ? '' : "WHERE status = 'active'"} ORDER BY type, name`).all();
  if (req.user.role === 'coordinator') return res.json(rows);
  res.json(rows.map(({ notes, price_note, ...r }) => r));  // 家属看不到内部价钱与备注
});
api.post('/partners', requireRole('coordinator'), (req, res) => {
  const b = req.body || {};
  if (!b.type || !b.name) return res.status(400).json({ error: 'type_name_required' });
  const r = db.prepare(`INSERT INTO partners (type, name, contact_name, phone, license_no, license_body, region, duty_hours, price_note, status, photo_url, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(b.type, b.name, b.contact_name || null, b.phone || null, b.license_no || null, b.license_body || null,
    b.region || null, b.duty_hours || null, b.price_note || null, b.status || 'active', b.photo_url || null, b.notes || null);
  res.json({ id: r.lastInsertRowid });
});
api.patch('/partners/:id', requireRole('coordinator'), (req, res) => {
  const id = Number(req.params.id); const b = req.body || {};
  for (const c of ['type','name','contact_name','phone','license_no','license_body','region','duty_hours','price_note','status','photo_url','notes'])
    if (b[c] !== undefined) db.prepare(`UPDATE partners SET ${c} = ? WHERE id = ?`).run(b[c], id);
  res.json({ ok: true });
});

// ---------- 付费 ----------
api.get('/payments', (req, res) => {
  const ids = clientIdsFor(req.user);
  if (!ids.length) return res.json([]);
  const params = [...ids]; const where = [`p.client_id IN (${ids.map(() => '?').join(',')})`];
  if (req.query.client_id) { where.push('p.client_id = ?'); params.push(Number(req.query.client_id)); }
  res.json(db.prepare(`SELECT p.*, c.name AS client_name FROM payments p JOIN clients c ON c.id = p.client_id WHERE ${where.join(' AND ')} ORDER BY p.period DESC, p.id DESC`).all(...params));
});
api.post('/payments', requireRole('coordinator'), (req, res) => {
  const b = req.body || {};
  if (!b.client_id || !b.period || !b.item || b.amount == null) return res.status(400).json({ error: 'missing' });
  const r = db.prepare('INSERT INTO payments (client_id, period, item, amount, status) VALUES (?,?,?,?,?)').run(b.client_id, b.period, b.item, b.amount, b.status || 'due');
  res.json({ id: r.lastInsertRowid });
});
api.patch('/payments/:id', requireRole('coordinator'), (req, res) => {
  const paid = req.body?.status === 'paid';
  db.prepare(`UPDATE payments SET status = ?, paid_at = ? WHERE id = ?`).run(paid ? 'paid' : 'due', paid ? nowIso() : null, Number(req.params.id));
  res.json({ ok: true });
});

// ---------- 援助申请 ----------
api.get('/aid', (req, res) => {
  const ids = clientIdsFor(req.user);
  if (!ids.length) return res.json([]);
  const params = [...ids]; const where = [`a.client_id IN (${ids.map(() => '?').join(',')})`];
  if (req.query.client_id) { where.push('a.client_id = ?'); params.push(Number(req.query.client_id)); }
  res.json(db.prepare(`SELECT a.*, c.name AS client_name FROM aid_applications a JOIN clients c ON c.id = a.client_id WHERE ${where.join(' AND ')} ORDER BY a.updated_at DESC`).all(...params));
});
api.post('/aid', requireRole('coordinator'), (req, res) => {
  const b = req.body || {};
  if (!b.client_id || !b.scheme) return res.status(400).json({ error: 'missing' });
  const r = db.prepare('INSERT INTO aid_applications (client_id, scheme, agency, status, docs, notes) VALUES (?,?,?,?,?,?)').run(b.client_id, b.scheme, b.agency || null, b.status || 'preparing', b.docs || null, b.notes || null);
  res.json({ id: r.lastInsertRowid });
});
api.patch('/aid/:id', requireRole('coordinator'), (req, res) => {
  const b = req.body || {};
  for (const c of ['scheme','agency','status','docs','notes']) if (b[c] !== undefined) db.prepare(`UPDATE aid_applications SET ${c} = ?, updated_at = datetime('now') WHERE id = ?`).run(b[c], Number(req.params.id));
  res.json({ ok: true });
});

// ---------- 用户管理（协调员） ----------
api.get('/users', requireRole('coordinator'), (req, res) => {
  const rows = req.query.role
    ? db.prepare('SELECT id, phone, name, role, lang, client_id, region, active FROM users WHERE role = ? ORDER BY name').all(req.query.role)
    : db.prepare('SELECT id, phone, name, role, lang, client_id, region, active FROM users ORDER BY role, name').all();
  res.json(rows);
});
api.post('/users', requireRole('coordinator'), (req, res) => {
  const b = req.body || {};
  if (!b.phone || !b.name || !b.role || !b.password) return res.status(400).json({ error: 'missing' });
  try {
    const r = db.prepare('INSERT INTO users (phone, password_hash, name, role, lang, client_id, region) VALUES (?,?,?,?,?,?,?)')
      .run(String(b.phone).trim(), bcrypt.hashSync(String(b.password), 10), b.name, b.role, b.lang || 'zh', b.client_id || null, b.region || null);
    if (b.role === 'family' && b.client_id) db.prepare('INSERT OR IGNORE INTO family_links (user_id, client_id, relation) VALUES (?,?,?)').run(r.lastInsertRowid, b.client_id, b.relation || null);
    res.json({ id: r.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: /UNIQUE/.test(String(e)) ? 'phone_exists' : 'db_error' });
  }
});
api.post('/clients/:id/family', requireRole('coordinator'), (req, res) => {
  const u = db.prepare(`SELECT id FROM users WHERE phone = ? AND role = 'family'`).get(String(req.body?.phone || '').trim());
  if (!u) return res.status(404).json({ error: 'user_not_found' });
  db.prepare('INSERT OR IGNORE INTO family_links (user_id, client_id, relation) VALUES (?,?,?)').run(u.id, Number(req.params.id), req.body?.relation || null);
  res.json({ ok: true });
});
api.get('/enquiries', requireRole('coordinator'), (req, res) => res.json(db.prepare('SELECT * FROM enquiries ORDER BY id DESC LIMIT 200').all()));
api.get('/audit', requireRole('coordinator'), (req, res) => res.json(db.prepare(`SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 200`).all()));

// ---------- 协调员总览 ----------
api.get('/dashboard', requireRole('coordinator'), (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  res.json({
    clients: db.prepare('SELECT COUNT(*) AS n FROM clients WHERE active = 1').get().n,
    openAlerts: db.prepare(`SELECT COUNT(*) AS n FROM alerts WHERE status != 'resolved'`).get().n,
    todayTasks: db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE substr(scheduled_at,1,10) = ? AND status != 'cancelled'`).get(today).n,
    unassigned: db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE status = 'requested'`).get().n,
    monthlyRevenue: db.prepare(`SELECT COALESCE(SUM(monthly_fee),0) AS s FROM clients WHERE active = 1`).get().s,
    dueTotal: db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE status = 'due'`).get().s,
    newEnquiries: db.prepare(`SELECT COUNT(*) AS n FROM enquiries WHERE created_at >= datetime('now','-7 days')`).get().n,
  });
});
