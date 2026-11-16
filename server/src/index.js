import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { api } from './routes.js';
import { seedIfEmpty } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const WEB_DIR = process.env.WEB_DIR || path.join(__dirname, '..', '..', 'web', 'dist');

if (process.env.SEED_DEMO !== '0') seedIfEmpty();

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', api);
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'server_error' }); });

// 生产环境：同一个进程同时提供网站 + Web 应用（web/dist）
if (fs.existsSync(WEB_DIR)) {
  app.use(express.static(WEB_DIR, { index: 'index.html', maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(WEB_DIR, 'index.html')));
}

app.listen(PORT, () => console.log(`安心照顾 API 已启动：http://localhost:${PORT}  (web: ${fs.existsSync(WEB_DIR) ? WEB_DIR : '未构建'})`));
