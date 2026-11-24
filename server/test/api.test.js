// 后端冒烟测试：node --test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = 18787;
const B = `http://localhost:${PORT}/api`;
let proc; let tmp;
const j = async (p, opts = {}, tok) => {
  const r = await fetch(B + p, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const login = async (phone) => (await j('/auth/login', { body: { phone, password: '123456' } })).data.token;

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'anxin-test-'));
  proc = spawn(process.execPath, ['src/index.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: tmp, JWT_SECRET: 'test', WEB_DIR: '/nonexistent', TRACCAR_KEY: 'test-traccar', NODE_ENV: 'test' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(B + '/public/info'); return; } catch { await new Promise(r => setTimeout(r, 200)); } }
  throw new Error('server did not start');
});
after(() => { proc?.kill(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('login works and rejects bad password', async () => {
  assert.equal((await j('/auth/login', { body: { phone: '0100000001', password: 'wrong' } })).status, 401);
  assert.ok(await login('0100000001'));
});

test('family can only see linked client; internal prices hidden', async () => {
  const fam = await login('0100000012');
  assert.equal((await j('/clients/1', {}, fam)).status, 200);
  assert.equal((await j('/clients/2', {}, fam)).status, 403);
  const partners = (await j('/partners', {}, fam)).data;
  assert.ok(partners.length > 0);
  assert.equal(partners[0].price_note, undefined);
});

test('health profile is encrypted at rest and decrypted for authorised users', async () => {
  const coord = await login('0100000001');
  const c = (await j('/clients/1', {}, coord)).data;
  assert.match(c.health.conditions, /高血压/);
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(path.join(tmp, 'anxin.db'), { readonly: true });
  const row = db.prepare('SELECT health_enc FROM clients WHERE id = 1').get();
  db.close();
  assert.ok(!row.health_enc.includes('高血压'));
  assert.ok((await j('/audit', {}, coord)).data.some(a => a.action === 'view_health'));
});

test('elder SOS -> coordinator handles -> resolved, with system messages', async () => {
  const elder = await login('0100000011'); const coord = await login('0100000001'); const fam = await login('0100000012');
  const a = (await j('/alerts', { body: { type: 'sos', lat: 1.48, lng: 103.76 } }, elder)).data;
  assert.equal(a.status, 'new'); assert.equal(a.client_id, 1);
  const open = (await j('/alerts?status=open', {}, coord)).data;
  assert.ok(open.some(x => x.id === a.id));
  assert.equal((await j(`/alerts/${a.id}`, { method: 'PATCH', body: { status: 'acknowledged', action: '回电' } }, fam)).status, 403);
  const done = (await j(`/alerts/${a.id}`, { method: 'PATCH', body: { status: 'resolved', outcome: 'ok', action: '结案' } }, coord)).data;
  assert.equal(done.status, 'resolved'); assert.equal(done.steps.length, 2);
  const msgs = (await j('/messages?client_id=1', {}, fam)).data;
  assert.ok(msgs.some(m => m.kind === 'system' && m.text.includes('紧急求助')));
  assert.ok(msgs.some(m => m.kind === 'system' && m.text.includes('处理完毕')));
});

test('family booking -> coordinator assigns -> caregiver reports -> task done', async () => {
  const fam = await login('0100000012'); const coord = await login('0100000001'); const cg = await login('0100000002');
  const t = (await j('/tasks', { body: { client_id: 1, type: 'escort', title: '陪诊', scheduled_at: '2030-01-01 09:00' } }, fam)).data;
  assert.equal(t.status, 'requested');
  const cgs = (await j('/users?role=caregiver', {}, coord)).data;
  const assigned = (await j(`/tasks/${t.id}`, { method: 'PATCH', body: { assignee_user_id: cgs[0].id } }, coord)).data;
  assert.equal(assigned.status, 'assigned');
  const mine = (await j('/tasks?mine=1', {}, cg)).data;
  assert.ok(mine.some(x => x.id === t.id));
  const r = (await j('/reports', { body: { client_id: 1, task_id: t.id, bp: '130/80', mood: 'ok' } }, cg)).data;
  assert.ok(r.id);
  const after = (await j('/tasks?client_id=1', {}, fam)).data.find(x => x.id === t.id);
  assert.equal(after.status, 'done');
});

test('public enquiry is stored for the coordinator', async () => {
  assert.equal((await j('/public/enquiry', { body: { name: 'T', phone: '0123' } })).status, 200);
  const coord = await login('0100000001');
  assert.ok((await j('/enquiries', {}, coord)).data.some(e => e.phone === '0123'));
});

test('Traccar watch event creates a watch alert for the matching client', async () => {
  const bad = await fetch(B + '/integrations/traccar?key=wrong', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(bad.status, 401);
  const r = await fetch(B + '/integrations/traccar?key=test-traccar', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: { type: 'alarm', attributes: { alarm: 'fallDown' } }, device: { uniqueId: 'WT-0002', name: 'Watch 2' }, position: { latitude: 1.53, longitude: 103.63 } }) });
  assert.equal(r.status, 200);
  const coord = await login('0100000001');
  const open = (await j('/alerts?status=open', {}, coord)).data;
  const a = open.find(x => x.source === 'watch' && x.type === 'fall' && x.client_id === 2);
  assert.ok(a, 'watch alert for client 2');
  assert.equal(a.lat, 1.53);
});

test('caregiver uploads a report photo; family can view it, strangers cannot', async () => {
  const cg = await login('0100000002'); const fam = await login('0100000012'); const other = await login('0100000022');
  const r = (await j('/reports', { body: { client_id: 1, kind: 'visit', mood: 'ok' } }, cg)).data;
  // 1x1 JPEG
  const jpg = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const up = await j(`/reports/${r.id}/photos`, { body: { data: `data:image/jpeg;base64,${jpg}` } }, cg);
  assert.equal(up.status, 200); assert.ok(up.data.url);
  const list = (await j('/reports?client_id=1', {}, fam)).data.find(x => x.id === r.id);
  assert.equal(list.photos.length, 1); assert.equal(list.photo_count, 1);
  const ok = await fetch(B.replace(/\/api$/, '') + up.data.url, { headers: { authorization: `Bearer ${fam}` } });
  assert.equal(ok.status, 200); assert.match(ok.headers.get('content-type'), /image/);
  const no = await fetch(B.replace(/\/api$/, '') + up.data.url, { headers: { authorization: `Bearer ${other}` } });
  assert.equal(no.status, 404);
});

test('coordinator invites a family member, who sets a password and logs in', async () => {
  const coord = await login('0100000001');
  const created = (await j('/users', { body: { phone: '0177770001', name: '新家属', role: 'family', client_id: 1, relation: '女儿' } }, coord)).data;
  assert.ok(created.invite && created.invite.length === 10, 'invite code returned');
  // 没有密码时无法登录
  assert.equal((await j('/auth/login', { body: { phone: '0177770001', password: '' } })).status, 401);
  const info = (await j(`/public/invite/${created.invite.toLowerCase()}`)).data;
  assert.equal(info.name, '新家属'); assert.match(info.phone, /\*\*\*\*/);
  assert.equal((await j(`/public/invite/${created.invite}`, { body: { password: '123' } })).status, 400);
  const act = (await j(`/public/invite/${created.invite}`, { body: { password: 'secret88' } })).data;
  assert.ok(act.token); assert.equal(act.user.role, 'family');
  // 启用码只能用一次
  assert.equal((await j(`/public/invite/${created.invite}`)).status, 404);
  const tok = await (async () => (await j('/auth/login', { body: { phone: '0177770001', password: 'secret88' } })).data.token)();
  assert.ok(tok);
  assert.equal((await j('/clients/1', {}, tok)).status, 200);   // 已关联到陈阿婆
  // 改密码
  assert.equal((await j('/me/password', { body: { old_password: 'wrong', new_password: 'newpass99' } }, tok)).status, 400);
  assert.equal((await j('/me/password', { body: { old_password: 'secret88', new_password: 'newpass99' } }, tok)).status, 200);
  assert.ok((await j('/auth/login', { body: { phone: '0177770001', password: 'newpass99' } })).data.token);
  // 重发启用链接会作废旧码
  const r1 = (await j(`/users/${created.id}/invite`, { method: 'POST', body: {} }, coord)).data.invite;
  const r2 = (await j(`/users/${created.id}/invite`, { method: 'POST', body: {} }, coord)).data.invite;
  assert.equal((await j(`/public/invite/${r1}`)).status, 404);
  assert.equal((await j(`/public/invite/${r2}`)).status, 200);
});

test('app service application is stored with its source', async () => {
  assert.equal((await j('/public/enquiry', { body: { name: 'App 申请', phone: '0188880000', city: '士古来', source: 'app' } })).status, 200);
  const coord = await login('0100000001');
  const e = (await j('/enquiries', {}, coord)).data.find(x => x.phone === '0188880000');
  assert.equal(e.source, 'app'); assert.equal(e.status, 'new');
});

test('self registration: immediate access to the parent profile they created, nothing else; coordinator confirms', async () => {
  assert.equal((await j('/public/register', { body: { name: 'X', phone: '0199990009', password: 'secret88', agree: true } })).data.error, 'parent_required');
  assert.equal((await j('/public/register', { body: { name: 'X', phone: '0199990009', password: 'secret88', parent_name: 'P' } })).data.error, 'must_agree');
  const r = (await j('/public/register', { body: { name: '自助注册者', phone: '0199990001', password: 'secret88', agree: true, parent_name: '张伯伯', relation: '儿子', parent_birth_year: 1946, city: '古来', address: 'Kulai Jaya', conditions: '高血压' } })).data;
  assert.ok(r.token); assert.equal(r.user.role, 'family');
  const me = (await j('/me', {}, r.token)).data;
  assert.equal(me.client_ids.length, 1);
  const cid = me.client_ids[0];
  const c = (await j(`/clients/${cid}`, {}, r.token)).data;
  assert.equal(c.name, '张伯伯'); assert.equal(c.verified, 0); assert.equal(c.health.conditions, '高血压'); assert.ok(c.consent_at);
  assert.equal((await j('/clients/1', {}, r.token)).status, 403);                       // 看不到别人的父母
  assert.equal((await j('/tasks', { body: { client_id: cid, type: 'visit', scheduled_at: '2030-01-01 10:00' } }, r.token)).status, 200);  // 马上可以预约
  assert.equal((await j(`/clients/${cid}`, { method: 'PATCH', body: { address: 'Taman Kulai', plan: 'full', verified: 1 } }, r.token)).status, 200);
  const c2 = (await j(`/clients/${cid}`, {}, r.token)).data;
  assert.equal(c2.address, 'Taman Kulai'); assert.equal(c2.plan, 'standard'); assert.equal(c2.verified, 0);   // 子女不能改配套、不能自己确认
  const coord = await login('0100000001');
  assert.ok((await j('/dashboard', {}, coord)).data.unverified >= 1);
  const e = (await j('/enquiries', {}, coord)).data.find(x => x.phone === '0199990001');
  assert.equal(e.client_id, cid); assert.equal(e.client_name, '张伯伯');
  assert.equal((await j(`/clients/${cid}`, { method: 'PATCH', body: { verified: 1 } }, coord)).status, 200);
  assert.equal((await j(`/clients/${cid}`, { method: 'PATCH', body: { address: 'x' } }, r.token)).status, 403);   // 确认后子女不能再改
  assert.equal((await j('/enquiries', {}, coord)).data.find(x => x.phone === '0199990001').status, 'done');
  assert.ok((await j(`/messages?client_id=${cid}`, {}, r.token)).data.some(m => m.text.includes('正式开通')));
  assert.equal((await j('/public/register', { body: { name: '重复', phone: '0199990001', password: 'secret88', agree: true, parent_name: 'P' } })).data.error, 'phone_exists');
});

test('elder phone setup by family: QR invite activates without password and stays logged in', async () => {
  const fam = await login('0100000022');   // 林志豪，林伯伯（客人 2）的儿子
  assert.equal((await j('/clients/1/elder-device', { method: 'POST', body: {} }, fam)).status, 403);   // 不能为别人的父母设置
  const r = (await j('/clients/2/elder-device', { method: 'POST', body: {} }, fam)).data;
  assert.ok(r.invite);
  const info = (await j(`/public/invite/${r.invite}`)).data;
  assert.equal(info.role, 'elder');
  const act = (await j(`/public/invite/${r.invite}`, { body: { device: true } })).data;
  assert.ok(act.token); assert.equal(act.user.role, 'elder');
  const me = (await j('/me', {}, act.token)).data;
  assert.deepEqual(me.client_ids, [2]); assert.ok(me.token, 'token renewed on /me');
  // 非长者的启用码不能免密码
  const coord = await login('0100000001');
  const fu = (await j('/users', { body: { phone: '0177770099', name: '某家属', role: 'family', client_id: 1 } }, coord)).data;
  assert.equal((await j(`/public/invite/${fu.invite}`, { body: { device: true } })).status, 400);
});

test('coordinator settings: hotline from the app, backups', async () => {
  const coord = await login('0100000001'); const fam = await login('0100000012');
  assert.equal((await j('/settings', {}, fam)).status, 403);
  assert.equal((await j('/settings', { method: 'PUT', body: { hotline: '60166412393', ntfy_topic: 'anxin-test-xyz' } }, coord)).status, 200);
  assert.equal((await j('/public/info')).data.hotline, '60166412393');
  const s = (await j('/settings', {}, coord)).data;
  assert.equal(s.ntfy_topic, 'anxin-test-xyz');
  const b = (await j('/backups', { method: 'POST', body: {} }, coord)).data;
  assert.match(b.file, /^anxin-.*\.db$/);
  const dl = await fetch(B + `/backups/${b.file}`, { headers: { authorization: `Bearer ${coord}` } });
  assert.equal(dl.status, 200);
  assert.ok((await dl.arrayBuffer()).byteLength > 10000);
  assert.equal((await j('/backups/..%2Fanxin.db', {}, coord)).status, 400);
  await j('/settings', { method: 'PUT', body: { hotline: '', ntfy_topic: '' } }, coord);
});

test('watch: positions, safe zone, low battery, heart rate, SOS alarm, offline check, family view', async () => {
  const coord = await login('0100000001'); const fam = await login('0100000012');
  // 设安全范围：家的位置 300 米
  const w = (await j('/clients/1/watch', { method: 'PATCH', body: { safe_lat: 1.4855, safe_lng: 103.767, safe_radius: 300, hr_min: 45, hr_max: 120 } }, fam)).data;
  assert.equal(w.safe_radius, 300);
  const T = (body) => fetch(B + '/integrations/traccar/position?key=test-traccar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  // 在家
  let r = await T({ device: { uniqueId: 'WT-0001' }, position: { latitude: 1.4856, longitude: 103.7671, fixTime: '2026-11-21T01:00:00Z', attributes: { batteryLevel: 80, heartRate: 70 } } });
  assert.equal(r.status, 'inside'); assert.deepEqual(r.alerts, []);
  // 走出 1 公里
  r = await T({ device: { uniqueId: 'WT-0001' }, position: { latitude: 1.4945, longitude: 103.767, attributes: { batteryLevel: 15, heartRate: 135 } } });
  assert.equal(r.status, 'outside'); assert.equal(r.alerts.length, 3);   // 围栏 + 低电 + 心跳
  const open = (await j('/alerts?status=open&client_id=1', {}, coord)).data;
  assert.ok(open.some(a => a.type === 'geofence') && open.some(a => a.type === 'battery') && open.some(a => a.type === 'heart'));
  // 同样的情况不重复报
  r = await T({ device: { uniqueId: 'WT-0001' }, position: { latitude: 1.4946, longitude: 103.767, attributes: { batteryLevel: 14, heartRate: 136 } } });
  assert.deepEqual(r.alerts, []);
  // 手表 SOS（事件转发）
  const ev = await fetch(B + '/integrations/traccar?key=test-traccar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: { type: 'alarm', attributes: { alarm: 'sos' } }, device: { uniqueId: 'WT-0001' }, position: { latitude: 1.4946, longitude: 103.767, attributes: {} } }) }).then(x => x.json());
  assert.equal(ev.alerts.length, 1);
  assert.ok((await j('/alerts?status=open&client_id=1', {}, coord)).data.some(a => a.type === 'sos' && a.source === 'watch'));
  // 子女看到位置、电量、轨迹
  const fw = (await j('/clients/1/watch', {}, fam)).data;
  assert.equal(fw.watch_battery, 14); assert.equal(fw.watch_status, 'outside'); assert.equal(fw.last.lat, 1.4946); assert.equal(fw.offline, false);
  assert.ok((await j('/clients/1/watch/trail', {}, fam)).data.length >= 3);
  assert.equal((await j('/clients/2/watch', {}, fam)).status, 403);
  // 未知手表被忽略
  assert.equal((await T({ device: { uniqueId: 'NOPE' }, position: { latitude: 1, longitude: 1 } })).ignored, 'unknown_watch');
  // 离线检查：把最后信号改成 7 小时前
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(path.join(tmp, 'anxin.db')); db.prepare(`UPDATE clients SET watch_last_seen = datetime('now', '-7 hours') WHERE id = 2`).run(); db.close();
  assert.ok((await j('/watch/check-offline', { method: 'POST', body: {} }, coord)).data.checked >= 1);
  assert.ok((await j('/alerts?status=open&client_id=2', {}, coord)).data.some(a => a.type === 'offline'));
  // 协调员总览与模拟
  assert.ok((await j('/watch/overview', {}, coord)).data.length >= 2);
  const sim = (await j('/clients/3/watch/simulate', { body: { alarm: 'fallDown' } }, coord)).data;
  assert.equal(sim.alerts.length, 1);
  assert.ok((await j('/alerts?status=open&client_id=3', {}, coord)).data.some(a => a.type === 'fall'));
});

test('push tokens: saved per user; FCM silently off without a service account', async () => {
  const fam = await login('0100000012');
  const r = (await j('/push/token', { body: { token: 'fcm-token-abcdefghijklmnopqrstuvwxyz', platform: 'android' } }, fam)).data;
  assert.equal(r.ok, true); assert.equal(r.fcm, false);
  assert.equal((await j('/push/token', { method: 'DELETE', body: { token: 'fcm-token-abcdefghijklmnopqrstuvwxyz' } }, fam)).status, 200);
});

test('geocode: needs login, short query rejected, network failure returns empty object', async () => {
  assert.equal((await j('/geocode?q=Taman%20Pelangi')).status, 401);
  const coord = await login('0100000001');
  assert.equal((await j('/geocode?q=ab', {}, coord)).status, 400);
  const r = await j('/geocode?q=Taman%20Pelangi%20Johor%20Bahru', {}, coord);
  assert.equal(r.status, 200); assert.equal(typeof r.data, 'object');
});

test('caregiver live location: shared only while on a task, visible to that family, with accuracy', async () => {
  const cg = await login('0100000003');   // 阿强，只有林伯伯（客人 2）的任务
  const fam2 = await login('0100000022'); const fam1 = await login('0100000012');
  const r = (await j('/me/location', { body: { lat: 1.54, lng: 103.63, accuracy: 12 } }, cg)).data;
  assert.equal(r.shared, true); assert.deepEqual(r.clients, [2]);
  const loc = (await j('/clients/2/caregiver-location', {}, fam2)).data;
  assert.equal(loc.lat, 1.54); assert.equal(loc.accuracy, 12); assert.match(loc.name, /阿强/);
  assert.equal((await j('/clients/1/caregiver-location', {}, fam1)).data, null);
  assert.equal((await j('/me/location', { body: { lat: 'x' } }, cg)).status, 400);
  assert.equal((await j('/me/location', { body: { lat: 1, lng: 1 } }, fam1)).status, 403);
  // 长者 SOS 带精度
  const elder = await login('0100000011');
  const a = (await j('/alerts', { body: { type: 'sos', lat: 1.4855, lng: 103.767, accuracy: 8 } }, elder)).data;
  assert.equal(a.accuracy, 8);
  assert.equal((await j('/public/info')).data.maps, 'osm');
});

test('clear demo data keeps only the coordinator; demo flag turns off; restore rejects bad file', async () => {
  const coord = await login('0100000001');
  assert.equal((await j('/settings/clear-data', { body: { confirm: 'no' } }, coord)).status, 400);
  assert.equal((await j('/backups/restore', { body: { data: 'data:application/octet-stream;base64,aGVsbG8=' } }, coord)).status, 400);
  assert.equal((await j('/settings/clear-data', { body: { confirm: 'DELETE' } }, coord)).status, 200);
  assert.deepEqual((await j('/clients', {}, coord)).data, []);
  assert.equal((await j('/users', {}, coord)).data.length, 1);
  assert.equal((await j('/public/info')).data.demo, false);
  assert.ok((await j('/dashboard', {}, coord)).status === 200);
});

test('roles: admin has everything, coordinator cannot touch settings, data, accounts of staff', async () => {
  const admin = await login('0100000001');
  assert.equal((await j('/me', {}, admin)).data.user.role, 'admin');
  // 上一个测试清空了演示数据，这里由管理员重新开一个值班协调员
  assert.ok((await j('/users', { body: { phone: '0100000004', name: '值班协调员', role: 'coordinator', password: '123456' } }, admin)).data.id);
  const co = await login('0100000004');
  assert.equal((await j('/dashboard', {}, co)).status, 200);                       // 协调员能看总览
  assert.equal((await j('/alerts?status=open', {}, co)).status, 200);
  assert.equal((await j('/settings', {}, co)).status, 200);                         // 能看设置
  assert.equal((await j('/settings', { method: 'PUT', body: { hotline: '1' } }, co)).status, 403);   // 不能改
  assert.equal((await j('/settings/clear-data', { body: { confirm: 'DELETE' } }, co)).status, 403);
  assert.equal((await j('/backups', { method: 'POST', body: {} }, co)).status, 403);
  assert.equal((await j('/users', { body: { phone: '0199990077', name: 'x', role: 'coordinator' } }, co)).status, 403);
  assert.equal((await j('/users', { body: { phone: '0199990078', name: 'y', role: 'caregiver' } }, co)).status, 200);   // 可开照顾人
  const cu = (await j('/users', { body: { phone: '0199990079', name: 'z', role: 'coordinator' } }, admin)).data; assert.ok(cu.id);
  assert.equal((await j(`/users/${cu.id}`, { method: 'PATCH', body: { active: 0 } }, co)).status, 403);
  assert.equal((await j(`/users/${cu.id}`, { method: 'PATCH', body: { active: 0 } }, admin)).status, 200);
});
