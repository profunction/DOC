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
  proc = spawn(process.execPath, ['src/index.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: tmp, JWT_SECRET: 'test', WEB_DIR: '/nonexistent', TRACCAR_KEY: 'test-traccar' }, stdio: 'ignore' });
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
