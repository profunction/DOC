// 演示数据：第一次启动且数据库为空时自动写入。生产环境请设 SEED_DEMO=0。
import bcrypt from 'bcryptjs';
import { db, encrypt } from './db.js';

export const DEMO_ACCOUNTS = [
  { phone: '0100000001', password: '123456', role: 'coordinator', name: '总协调员 阿明' },
  { phone: '0100000002', password: '123456', role: 'caregiver', name: '照顾人 小芳', region: '新山市区' },
  { phone: '0100000003', password: '123456', role: 'caregiver', name: '照顾人 阿强', region: '士古来' },
  { phone: '0100000011', password: '123456', role: 'elder', name: '陈阿婆', client: 1 },
  { phone: '0100000012', password: '123456', role: 'family', name: '陈小美（女儿，新加坡）', client: 1, relation: '女儿' },
  { phone: '0100000013', password: '123456', role: 'family', name: '陈大伟（儿子，新加坡）', client: 1, relation: '儿子' },
  { phone: '0100000021', password: '123456', role: 'elder', name: '林伯伯', client: 2 },
  { phone: '0100000022', password: '123456', role: 'family', name: '林志豪（儿子，新加坡）', client: 2, relation: '儿子' },
  { phone: '0100000031', password: '123456', role: 'elder', name: 'Puan Aminah', client: 3 },
  { phone: '0100000032', password: '123456', role: 'family', name: 'Siti（anak perempuan）', client: 3, relation: '女儿' },
];

/** 用环境变量建立第一个协调员账号（部署时在 Render / .env 设 ADMIN_PHONE 与 ADMIN_PASSWORD），已存在则略过 */
export function ensureAdmin() {
  const phone = String(process.env.ADMIN_PHONE || '').trim(); const pw = String(process.env.ADMIN_PASSWORD || '');
  if (!phone || !pw) return;
  const existing = db.prepare('SELECT id, password_hash, role FROM users WHERE phone = ?').get(phone);
  if (existing) {
    // 在 Render 改了 ADMIN_PASSWORD → 重启后同步到账号（忘记密码时的恢复方法）
    if (!bcrypt.compareSync(pw, existing.password_hash)) { db.prepare('UPDATE users SET password_hash = ?, active = 1 WHERE id = ?').run(bcrypt.hashSync(pw, 10), existing.id); console.log(`已更新协调员 ${phone} 的密码`); }
    return;
  }
  db.prepare('INSERT INTO users (phone, password_hash, name, role, lang) VALUES (?,?,?,?,?)').run(phone, bcrypt.hashSync(pw, 10), process.env.ADMIN_NAME || '总协调员', 'coordinator', 'zh');
  console.log(`已建立协调员账号 ${phone}`);
}

export function seedIfEmpty() {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return;
  console.log('写入演示数据…');
  const d = (days, h = 9, m = 0) => {
    const t = new Date(); t.setDate(t.getDate() + days); t.setHours(h, m, 0, 0);
    return t.toISOString().slice(0, 16).replace('T', ' ');
  };

  const insClient = db.prepare(`INSERT INTO clients (id, name, gender, birth_year, address, region, lat, lng, plan, monthly_fee, emergency_contact, preferred_hospital, consent_at, health_enc, watch_id, notes)
    VALUES (@id,@name,@gender,@birth_year,@address,@region,@lat,@lng,@plan,@monthly_fee,@emergency_contact,@preferred_hospital,datetime('now'),@health_enc,@watch_id,@notes)`);
  insClient.run({ id: 1, name: '陈阿婆', gender: '女', birth_year: 1946, address: 'Taman Pelangi, Jalan Kuning 12, 80400 Johor Bahru', region: '新山市区', lat: 1.4855, lng: 103.7670, plan: 'full', monthly_fee: 900,
    emergency_contact: '邻居 黄太太 012-3334444', preferred_hospital: 'KPJ Johor Specialist', watch_id: 'WT-0001',
    health_enc: encrypt({ conditions: '高血压、二型糖尿病', meds: 'Amlodipine 5mg 早一粒；Metformin 500mg 早晚各一粒', allergies: '青霉素', doctor: 'Klinik Dr Tan, Taman Pelangi', mobility: '需扶（助行器）', language: '潮州话、华语', diet: '少糖少盐', notes: '晚上容易忘记吃药，需提醒' }), notes: '女儿在新加坡 CBD 上班，白天较难接电话，紧急时先 WhatsApp。' });
  insClient.run({ id: 2, name: '林伯伯', gender: '男', birth_year: 1950, address: 'Taman Universiti, Jalan Kebudayaan 5, 81300 Skudai', region: '士古来', lat: 1.5395, lng: 103.6300, plan: 'standard', monthly_fee: 450,
    emergency_contact: '弟弟 林国强 016-7778888', preferred_hospital: 'Hospital Sultanah Aminah（政府）', watch_id: 'WT-0002',
    health_enc: encrypt({ conditions: '心脏病（装过支架）、轻度退化性关节炎', meds: 'Aspirin 100mg 早一粒；Atorvastatin 20mg 晚一粒', allergies: '无', doctor: 'Hospital Sultanah Aminah 心脏科', mobility: '自理', language: '福建话、华语、马来语', diet: '低脂', notes: '每周三固定去政府诊所复诊' }), notes: '' });
  insClient.run({ id: 3, name: 'Puan Aminah', gender: '女', birth_year: 1944, address: 'Kampung Melayu Majidee, 81100 Johor Bahru', region: '新山市区', lat: 1.5090, lng: 103.7860, plan: 'subsidised', monthly_fee: 100,
    emergency_contact: 'Jiran En. Rosli 019-2223333', preferred_hospital: 'Hospital Sultanah Aminah（政府）', watch_id: 'WT-0003',
    health_enc: encrypt({ conditions: 'Darah tinggi, asma', meds: 'Losartan 50mg pagi; inhaler Ventolin bila perlu', allergies: 'Tiada', doctor: 'Klinik Kesihatan Majidee', mobility: 'Berdikari, kadang-kadang pening', language: 'Bahasa Melayu', diet: 'Kurang garam', notes: 'Tinggal seorang, anak bekerja shift di Singapura' }), notes: '补贴配套（关怀基金）。已帮她申请 JKM Bantuan Warga Emas。' });

  const insUser = db.prepare('INSERT INTO users (phone, password_hash, name, role, lang, client_id, region) VALUES (?,?,?,?,?,?,?)');
  const insLink = db.prepare('INSERT INTO family_links (user_id, client_id, relation) VALUES (?,?,?)');
  const ids = {};
  for (const a of DEMO_ACCOUNTS) {
    const lang = a.name.startsWith('Puan') || a.name.startsWith('Siti') ? 'ms' : 'zh';
    const r = insUser.run(a.phone, bcrypt.hashSync(a.password, 10), a.name, a.role, lang, a.role === 'elder' ? a.client : null, a.region || null);
    ids[a.phone] = Number(r.lastInsertRowid);
    if (a.role === 'family') insLink.run(r.lastInsertRowid, a.client, a.relation);
  }
  const coord = ids['0100000001'], cg1 = ids['0100000002'], cg2 = ids['0100000003'];

  const insPartner = db.prepare(`INSERT INTO partners (type, name, contact_name, phone, license_no, license_body, region, duty_hours, price_note, status) VALUES (?,?,?,?,?,?,?,?,?, 'active')`);
  [
    ['clinic', 'Klinik Dr Tan（Taman Pelangi）', 'Dr Tan Wei Ming', '07-3311222', 'MMC 45678', 'MMC', '新山市区', '周一至周六 8:00-21:00，上门需预约', '上门诊金 RM150 起（医生自收）；协调费 RM30-50 另收'],
    ['clinic', 'Klinik Mediviron Skudai', 'Dr Lim', '07-5566777', 'MMC 51234', 'MMC', '士古来', '每日 8:00-22:00', '上门诊金 RM180 起'],
    ['nurse', '注册护士 Nurse Kavitha', 'Kavitha', '012-4445555', 'LJM 112233', '马来西亚护士局', '新山市区', '周一至周五 9:00-18:00，紧急可晚上', '每次上门 RM120（护士 RM90-100，协调 RM20-30）'],
    ['nurse', '注册护士 Nurse Siti Hajar', 'Siti Hajar', '013-6667777', 'LJM 118877', '马来西亚护士局', '士古来', '轮班制，提前一天约', '每次上门 RM120'],
    ['caregiver', '看护中介 Caring Hands JB', 'Ms Wong', '07-2233444', '-', '-', '全新山', '钟点 / 全天', '钟点 RM25/小时，分成一成'],
    ['physio', 'Rehab Plus 物理治疗中心', 'Mr Faiz', '07-3344555', 'MAHPC 9987', '联合健康专业人员理事会', '新山市区', '周一至周六', '上门 RM150/次'],
    ['driver', 'Grab 司机 阿Kim（有耐心）', 'Kim', '017-8889999', '-', '-', '全新山', '7:00-20:00', '固定陪诊接送 RM60-100/趟'],
    ['ambulance', 'First Ambulance JB（私人）', '值班员', '07-2222999', '-', '-', '全新山', '24 小时', '市区 RM250 起'],
    ['supplies', 'MediCare 医疗用品店', 'Mr Lee', '07-3355777', '-', '-', '新山市区', '每日 9:00-19:00', '护理床租 RM150/月，轮椅 RM60/月；市价加一成'],
    ['counsellor', '注册辅导员 Ms Chong', 'Chong Li Ling', '012-9990000', 'KB 05566', '马来西亚辅导员局', '全新山（可视讯）', '需预约', '每次 RM130（辅导员 RM100-110）'],
    ['nursing_home', '乐龄之家 短期托管', '张经理', '07-2266888', 'JKM 注册', 'JKM', '新山市区', '-', '短期托管 RM120/天'],
  ].forEach(p => insPartner.run(...p));

  const insTask = db.prepare(`INSERT INTO tasks (client_id, type, title, scheduled_at, status, assignee_user_id, partner_id, notes, fee, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  insTask.run(1, 'visit', '每周探访', d(0, 10, 0), 'assigned', cg1, null, '量血压、检查药盒', 0, coord);
  insTask.run(1, 'meds', '代买药（Metformin）', d(0, 15, 0), 'assigned', cg1, null, 'Klinik Dr Tan 取药', 0, coord);
  insTask.run(1, 'escort', '陪诊：KPJ 复诊', d(3, 8, 30), 'assigned', cg1, 7, '司机阿Kim 8:00 接', 100, coord);
  insTask.run(1, 'visit', '每周探访', d(-7, 10, 0), 'done', cg1, null, '', 0, coord);
  insTask.run(1, 'physio', '上门物理治疗', d(5, 14, 0), 'requested', null, 6, '女儿预约', 150, ids['0100000012']);
  insTask.run(2, 'escort', '陪诊：政府诊所复诊', d(1, 7, 30), 'assigned', cg2, 7, '带 IC 和复诊卡', 80, coord);
  insTask.run(2, 'visit', '每周探访', d(0, 16, 0), 'assigned', cg2, null, '', 0, coord);
  insTask.run(2, 'supplies', '安装浴室扶手', d(4, 11, 0), 'requested', null, 9, '儿子要求', 0, ids['0100000022']);
  insTask.run(3, 'visit', 'Lawatan mingguan', d(0, 11, 30), 'assigned', cg1, null, 'Semak inhaler', 0, coord);
  insTask.run(3, 'visit', 'Lawatan mingguan', d(-6, 11, 30), 'done', cg1, null, '', 0, coord);

  const insReport = db.prepare(`INSERT INTO reports (client_id, task_id, reporter_id, kind, mood, bp, glucose, temp, meds, diet_sleep, home_safety, requests, follow_up, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  insReport.run(1, 4, cg1, 'visit', '良好，有说有笑', '138/85', '7.2', '36.6', '药盒按时吃，周三晚忘了一次', '胃口好，晚上睡 6 小时', '浴室地板湿滑，建议加防滑垫', '想要一个大字体的电话', '下次带防滑垫样品；提醒女儿买大字电话', d(-7, 11, 10));
  insReport.run(1, null, cg1, 'visit', '普通，有点累', '145/90', '8.1', '36.8', '按时', '少吃，说没胃口', '正常', '-', '血压偏高，已通知女儿，建议下周看医生', d(-14, 10, 40));
  insReport.run(2, null, cg2, 'consult', '良好', '128/80', '-', '36.5', '医生维持原药', '正常', '正常', '-', '三个月后复诊', d(-10, 9, 30));
  insReport.run(3, 10, cg1, 'visit', 'Ceria', '142/88', '-', '36.7', 'Ubat diambil', 'Makan sikit, tidur baik', 'OK', 'Nak lampu malam', 'Semak harga lampu sensor', d(-6, 12, 20));

  const insAlert = db.prepare(`INSERT INTO alerts (client_id, source, type, lat, lng, severity, status, handled_by, description, steps, outcome, created_at, resolved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  insAlert.run(1, 'watch', 'fall', 1.4855, 103.7670, 'mild', 'resolved', coord, '手表跌倒感应触发', JSON.stringify([
    { at: d(-3, 20, 12), by: '手表', action: 'created' },
    { at: d(-3, 20, 14), by: '总协调员 阿明', action: '回电，阿婆接听，说在浴室滑了一下，没受伤' },
    { at: d(-3, 20, 20), by: '总协调员 阿明', action: '派小芳上门确认，通知女儿' },
    { at: d(-3, 20, 55), by: '总协调员 阿明', action: '小芳到场，无外伤，血压正常' },
  ]), '无受伤，建议安装浴室扶手与防滑垫', d(-3, 20, 12), d(-3, 21, 0));
  insAlert.run(2, 'watch', 'heart', 1.5395, 103.6300, 'false', 'resolved', coord, '心跳 118 持续 10 分钟', JSON.stringify([
    { at: d(-9, 7, 5), by: '手表', action: 'created' }, { at: d(-9, 7, 7), by: '总协调员 阿明', action: '回电确认，伯伯刚晨运回来，误报' },
  ]), '误报（运动后）', d(-9, 7, 5), d(-9, 7, 10));

  const insMsg = db.prepare(`INSERT INTO messages (client_id, sender_id, kind, text, created_at) VALUES (?,?,?,?,?)`);
  insMsg.run(1, null, 'system', '👋 欢迎加入陈阿婆的家庭群组。协调中心、照顾人和家属都在这里。', d(-30, 9, 0));
  insMsg.run(1, ids['0100000012'], 'user', '阿明，妈妈最近晚上老忘记吃药，可以多提醒吗？', d(-8, 21, 0));
  insMsg.run(1, coord, 'user', '可以，我让小芳每晚八点打电话提醒，并在药盒上贴大字标签。', d(-8, 21, 5));
  insMsg.run(1, null, 'system', '📝 照顾人 小芳 提交了探访报告：精神良好，血压 138/85，吃药按时。需跟进：下次带防滑垫样品', d(-7, 11, 10));
  insMsg.run(1, null, 'system', '🚨 陈阿婆 发出跌倒警报（来源：watch）。协调中心已收到，会在三分钟内回电。', d(-3, 20, 12));
  insMsg.run(1, null, 'system', '✅ 事件已处理完毕：无受伤，建议安装浴室扶手与防滑垫', d(-3, 21, 0));
  insMsg.run(1, ids['0100000013'], 'user', '谢谢大家，吓死我了。扶手我来出钱，请帮忙安排。', d(-3, 21, 5));
  insMsg.run(2, null, 'system', '👋 欢迎加入林伯伯的家庭群组。', d(-25, 9, 0));
  insMsg.run(3, null, 'system', '👋 Selamat datang ke kumpulan keluarga Puan Aminah.', d(-20, 9, 0));

  const insPay = db.prepare('INSERT INTO payments (client_id, period, item, amount, status, paid_at) VALUES (?,?,?,?,?,?)');
  const ym = (off) => { const t = new Date(); t.setMonth(t.getMonth() + off); return t.toISOString().slice(0, 7); };
  insPay.run(1, ym(-1), '全面照顾配套', 900, 'paid', d(-28)); insPay.run(1, ym(-1), '陪诊 ×1', 100, 'paid', d(-28));
  insPay.run(1, ym(0), '全面照顾配套', 900, 'due', null); insPay.run(1, ym(0), '智能手表租用', 40, 'due', null);
  insPay.run(2, ym(-1), '标准照顾配套', 450, 'paid', d(-26)); insPay.run(2, ym(0), '标准照顾配套', 450, 'due', null); insPay.run(2, ym(0), '陪诊 ×1', 80, 'due', null);
  insPay.run(3, ym(0), '补贴配套（关怀基金）', 100, 'paid', d(-2));

  const insAid = db.prepare('INSERT INTO aid_applications (client_id, scheme, agency, status, docs, notes) VALUES (?,?,?,?,?,?)');
  insAid.run(3, 'Bantuan Warga Emas (BWE)', 'JKM 福利局', 'submitted', 'IC、收入证明、水电单', '已于 eBantuan 提交，等待家访评估');
  insAid.run(3, 'Bantuan Warga Emas Johor', '柔佛州政府', 'preparing', 'IC、JKM 申请回执', '等 JKM 结果后再交');
  insAid.run(2, '医药费补助', '华人社团福利组', 'approved', 'IC、医院收据', '每月 RM200，为期六个月');
}

if (import.meta.url === `file://${process.argv[1]}`) { seedIfEmpty(); console.log('done'); }
