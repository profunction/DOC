import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { api } from './routes.js';
import { seedIfEmpty, ensureAdmin } from './seed.js';
import { scheduleBackups } from './settings.js';
import { scheduleOfflineCheck } from './watch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const WEB_DIR = process.env.WEB_DIR || path.join(__dirname, '..', '..', 'web', 'dist');
const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.join(__dirname, '..', '..', 'downloads');

if (process.env.SEED_DEMO !== '0') seedIfEmpty();
ensureAdmin();
if (process.env.NODE_ENV !== 'test') { scheduleBackups(); scheduleOfflineCheck(); }

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);   // Render / Caddy 在前面，用 X-Forwarded-For 取真实 IP
app.use(cors());
app.use(express.json({ limit: '6mb' }));
app.use('/api', api);
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'server_error' }); });

// Android App Links：让启用链接直接打开已安装的 App（指纹来自正式签名证书）
const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE || 'my.anxincare.app';
const ANDROID_CERT_SHA256 = (process.env.ANDROID_CERT_SHA256 || '2E:96:AD:8A:21:59:AE:C1:13:2E:50:05:14:B4:2D:76:01:11:7C:2B:26:5F:23:0A:E9:88:08:19:6A:77:6F:71').split(',').map(x => x.trim()).filter(Boolean);
app.get('/.well-known/assetlinks.json', (req, res) => res.json([{
  relation: ['delegate_permission/common.handle_all_urls'],
  target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: ANDROID_CERT_SHA256 },
}]));

// APK 等下载文件单独提供（不放进 web/public，否则会被打进 App 自己）
if (fs.existsSync(DOWNLOADS_DIR)) app.use('/downloads', express.static(DOWNLOADS_DIR, { maxAge: '5m' }));

// 生产环境：同一个进程同时提供网站 + Web 应用（web/dist）
if (fs.existsSync(WEB_DIR)) {
  app.use(express.static(WEB_DIR, { index: 'index.html', maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(WEB_DIR, 'index.html')));
}

app.listen(PORT, () => console.log(`安心照顾 API 已启动：http://localhost:${PORT}  (web: ${fs.existsSync(WEB_DIR) ? WEB_DIR : '未构建'})`));
