# 安心照顾 · 新山老人照顾协调服务（网站 + Android App）

根据《新山老人照顾协调服务 创业计划书》第十五节、十七节、二十至二十二节的需求实现：
一个后端、一个网站、一个 Android App（三种用户：长者、子女、照顾协调员；另加照顾人端）。

```
DOC/
├── server/   Node.js + Express + SQLite 后端 API（JWT 登录、AES-256 加密健康档案、SSE 实时推送）
├── web/      React + Vite：宣传网站（/）+ 三端 Web 应用（/app）+ Capacitor Android 工程（web/android）
├── docs/     需求对照、部署与上架说明
├── Dockerfile / docker-compose.yml   一键部署（网站 + App 后端同一容器）
└── .github/workflows/android.yml     每次 push 自动打 APK；打 tag v* 自动发 Release
```

## 功能一览（对应计划书第一版"只做五个功能"）

| 计划书要求 | 实现 |
|---|---|
| 1. 紧急按钮：老人按下，协调员和子女同时收到通知和定位 | 长者端超大 🆘 按钮（按住 2 秒防误触）→ 取 GPS → 协调员与子女页面实时弹出警报、推送本地通知、家庭群组自动发系统消息 |
| 2. 健康档案：病史、用药、医生、过敏，照顾人随时能看 | 协调员录入，子女 / 照顾人可看；AES-256-GCM 加密落盘；每次查看写入访问记录（PDPA） |
| 3. 探访与看诊报告：照顾人填写，子女即时收到 | 照顾人端"完成并填报告"表单（精神、血压、血糖、体温、吃药、饮食睡眠、家中安全、需求、跟进）+ 拍照上传（客户端压缩、服务器端按权限提供）→ 子女端实时刷新并显示缩略图 + 群组系统消息 |
| 4. 家庭群组：子女、协调员、照顾人在同一个对话里 | 每位长者一个群组，实时聊天，所有事件自动留痕 |
| 5. 服务预约：子女可以预约陪诊、探访、买药 | 子女端预约 → 协调员派单给照顾人 / 合作伙伴 → 照顾人端执行 |

另外实现的（计划书第十七、二十、二十一、二十二节）：

- **手表警报处理流程**：协调员可接入 / 模拟手表警报（跌倒、心跳、走出安全范围），按"三分钟回电 → 判断轻重 → 派护士 / 照顾人 / 救护车 → 结案"记录每一步。
- **合作伙伴名单**：诊所、护士、辅导员、看护、司机、救护车、用品店，含执照号与注册机构（MMC / 护士局 / 辅导员局），子女端可见"照顾团队"（内部价钱不显示）。
- **付费记录、援助申请进度**（JKM Bantuan Warga Emas 等）、**网站咨询收件箱**、**资料访问记录**。
- **三语**：中文 / English / Bahasa Melayu，网站与 App 均可切换。
- **长者端只有三个大按钮**：紧急求助、我要找人（打热线 / WhatsApp）、看今天的安排。

## 用到的开源项目（直接接进来的）

| 用途 | 项目 | 许可 | 在哪里 |
|---|---|---|---|
| App 界面组件（顶栏、分段标签、底部标签栏、按钮、卡片） | [Ionic Framework](https://ionicframework.com) | MIT | `web/src/components/ui.tsx`、`web/src/theme.css` |
| App 图标 | [Ionicons](https://ionic.io/ionicons) | MIT | 各页面 tabs |
| 网站图标 | [Lucide](https://lucide.dev) | ISC | `web/src/pages/Landing.tsx` |
| 网站插画 | [unDraw](https://undraw.co) | unDraw 许可（可商用） | `web/public/illustrations/` |
| 中文字体 | Noto Sans SC（Google Fonts） | OFL | `web/index.html` |
| 手表 GPS / SOS / 跌倒事件 | [Traccar](https://www.traccar.org) | Apache-2.0 | `server/src/integrations.js`、`docker-compose.stack.yml`、`deploy/traccar.xml` |
| App 关着也能收到的推送 | [ntfy](https://ntfy.sh) | Apache-2.0 | `server/src/integrations.js`、`docker-compose.stack.yml` |
| 安卓壳 | [Capacitor](https://capacitorjs.com) | MIT | `web/android/` |

一键把 Traccar 和 ntfy 一起跑起来：

```bash
docker compose -f docker-compose.yml -f docker-compose.stack.yml up -d --build
```

- Traccar 后台在 8082 端口（默认 admin / admin，马上改），把手表的服务器地址指到这台机器对应品牌的端口，在客人档案"智能手表"栏填手表的 IMEI；手表一按 SOS，协调员页面就会弹警报。
- ntfy 在 8090 端口；协调员手机装开源 ntfy App，订阅 `.env` 里的 `NTFY_TOPIC`，所有警报都会推到手机，App 关着也能收。
- 第一阶段若不想自己开发，也可以只用 Chatwoot（WhatsApp 热线）+ Baserow（表格）+ KoboCollect（上门表单）+ Traccar + ntfy，见 `docs/开源组合.md`。

## 本地运行

```bash
cd server && npm install && npm start        # API: http://localhost:8787
```

```bash
cd web && npm install && npm run dev          # 开发网站: http://localhost:5173（/api 自动代理到 8787）
```

生产方式（一个进程同时提供网站 + App + API）：

```bash
cd web && npm run build && cd ../server && npm start   # 打开 http://localhost:8787
```

演示账号（密码都是 `123456`，首次启动自动写入；生产环境设 `SEED_DEMO=0`）：

| 角色 | 手机号 |
|---|---|
| 协调员 | 0100000001 |
| 照顾人 | 0100000002 / 0100000003 |
| 长者 陈阿婆 | 0100000011 |
| 子女 陈小美 | 0100000012 |
| 长者 林伯伯 / 子女 | 0100000021 / 0100000022 |
| 长者 Puan Aminah / 子女 | 0100000031 / 0100000032 |

## 打 Android APK

```bash
cd web && npm run android:apk        # 调试版 app-debug.apk
```

```bash
cd web && npm run android:release    # 正式签名版，复制到 downloads/anxin-care.apk
```

正式版需要签名文件：把 `release.keystore` 和 `keystore.properties`（四行：storeFile、storePassword、keyAlias、keyPassword）放在 `web/android/`，两者都已被 .gitignore 排除。
**签名文件要妥善保管并备份**，以后每次更新 App 都必须用同一把钥匙，否则用户要卸载重装。

需要 JDK 21 与 Android SDK（platform 35、build-tools 35.0.0），在 `web/android/local.properties` 写 `sdk.dir=/你的/android-sdk`。
产物在 `web/android/app/build/outputs/apk/debug/app-debug.apk`。

手机 App 的后端地址必须在打包时写死：`VITE_API_BASE=https://你的域名 npm run android:release`。没写死的包登录页会显示"App 还没有绑定服务器"；开发者连点登录页 logo 七下可临时填地址调试。顾客永远不需要填任何地址。

也可以不装任何东西：把代码推到 GitHub，Actions 会自动打 APK 并放在 Artifacts；打 tag `v1.0.0` 会自动生成 Release。
在仓库 Settings → Variables 设 `API_BASE`、`HOTLINE`、`APK_URL`；要签名正式版再加 Secrets `ANDROID_KEYSTORE_B64` 等（见工作流文件）。

## 部署网站 + 后端

手机 App 必须连到一个后端。最快的三种方法（同一 Wi-Fi 用电脑、Render 免费托管、自己的 VPS）见 `docs/部署.md`。

```bash
cp server/.env.example .env   # 填 JWT_SECRET、DATA_KEY（openssl rand -hex 32）、HOTLINE_PHONE
docker compose up -d --build  # http://服务器:8787，前面加 Caddy / Nginx 做 HTTPS
```

打好的 APK 放在仓库根目录 `downloads/anxin-care.apk`，后端会以 `/downloads/` 提供，网站"下载 App"按钮直接指向它（也可设 `VITE_APK_URL` 指向别处）。

## 测试

```bash
cd server && npm test     # 后端：权限隔离、加密、SOS 流程、派单流程
```

前端用 Playwright 做了四个角色的全流程走查（见 `docs/需求对照.md` 截图清单）。

## 安全与合规要点

- 健康资料加密存储（AES-256-GCM），钥匙来自环境变量 `DATA_KEY`，不在代码库里。
- 每次查看 / 修改健康档案写入 `audit_log`。
- 家属只能看到自己关联的长者；合作伙伴的内部价钱只有协调员可见。
- 全站文案强调"协调服务，非医疗服务"，手表数据标注"非医疗级"（见 `/legal`）。
- 生产环境必须上 HTTPS（Capacitor 配置已允许自定义服务器地址）。

## 还没做 / 下一步

- App 内推送目前是前台实时连接 + 本地通知；App 关闭时的推送已通过 ntfy 解决（协调员装 ntfy App）。若要在本 App 内收到，需再接 Firebase Cloud Messaging。
- 手表接入已通过 Traccar 完成（`POST /api/integrations/traccar`）；跌倒感应能否被解析取决于手表型号，拿到样品后用 Traccar 实测。
- iOS 版：`npx cap add ios`，需要 Mac 与 Apple 开发者账号。
- 在线付款（FPX / 信用卡）。
