// 探访报告照片：客户端压缩成 JPEG 后以 base64 上传，存到 DATA_DIR/uploads，只有能看到该客人的人才能读取。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import { db } from './db.js';
import { canSeeClient } from './auth.js';
import { broadcastClient } from './events.js';

const DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data');
const UP_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UP_DIR, { recursive: true });

db.exec(`CREATE TABLE IF NOT EXISTS report_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES reports(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  file TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')))`);

export const uploads = Router();

// POST /api/reports/:id/photos  { data: "data:image/jpeg;base64,..." }
uploads.post('/reports/:id/photos', (req, res) => {
  if (!['caregiver', 'coordinator'].includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(Number(req.params.id));
  if (!report || !canSeeClient(req.user, report.client_id)) return res.status(404).json({ error: 'not_found' });
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.data || ''));
  if (!m) return res.status(400).json({ error: 'bad_image' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3 * 1024 * 1024) return res.status(413).json({ error: 'too_large' });
  const file = `${report.id}-${crypto.randomBytes(6).toString('hex')}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  fs.writeFileSync(path.join(UP_DIR, file), buf);
  const r = db.prepare('INSERT INTO report_photos (report_id, client_id, file) VALUES (?,?,?)').run(report.id, report.client_id, file);
  db.prepare('UPDATE reports SET photo_count = photo_count + 1 WHERE id = ?').run(report.id);
  broadcastClient(report.client_id, 'report', { id: report.id, client_id: report.client_id, photo: true });
  res.json({ id: r.lastInsertRowid, url: `/api/photos/${file}` });
});

uploads.get('/reports/:id/photos', (req, res) => {
  const report = db.prepare('SELECT client_id FROM reports WHERE id = ?').get(Number(req.params.id));
  if (!report || !canSeeClient(req.user, report.client_id)) return res.status(404).json({ error: 'not_found' });
  res.json(db.prepare('SELECT id, file, created_at FROM report_photos WHERE report_id = ? ORDER BY id').all(report.client_id ? Number(req.params.id) : 0).map(p => ({ ...p, url: `/api/photos/${p.file}` })));
});

uploads.get('/photos/:file', (req, res) => {
  const file = path.basename(req.params.file);
  const row = db.prepare('SELECT client_id FROM report_photos WHERE file = ?').get(file);
  if (!row || !canSeeClient(req.user, row.client_id)) return res.status(404).json({ error: 'not_found' });
  res.set('Cache-Control', 'private, max-age=3600');
  res.sendFile(path.join(UP_DIR, file));
});
