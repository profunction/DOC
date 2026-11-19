// 三语支持：中文 zh、英文 en、马来文 ms。
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'zh' | 'en' | 'ms';
const KEY = 'anxin.lang';

const zh = {
  appName: '安心照顾', tagline: '新山老人照顾协调服务',
  // 通用
  login: '登录', logout: '退出', phone: '手机号', password: '密码', serverUrl: '服务器地址', save: '保存', cancel: '取消', submit: '提交', back: '返回', close: '关闭',
  loading: '载入中…', none: '暂无', today: '今天', upcoming: '接下来', all: '全部', status: '状态', time: '时间', type: '类型', notes: '备注', actions: '操作', name: '姓名', address: '地址', region: '地区', call: '打电话', whatsapp: 'WhatsApp', refresh: '刷新', add: '新增', edit: '编辑', search: '搜索', confirm: '确认', yes: '是', no: '否', language: '语言', retry: '重试',
  networkError: '连不上服务器，请检查网络或服务器地址。', serverRequired: '请先填写服务器地址（你部署后端的网址），再登录。', notConfigured: '这个版本的 App 还没有绑定服务器，请联系管理员取得正式版。', notApi: '这个地址不是安心照顾的后端，请检查服务器地址。', serverTest: '测试连接', serverOk: '连接成功', serverHint: '后端由你的团队部署；同一 Wi-Fi 测试可填电脑的 IP，如 192.168.1.10:8787。', badCredentials: '手机号或密码不对。', forbidden: '没有权限。',
  demoAccounts: '演示账号（密码都是 123456）', roleElder: '长者', roleFamily: '子女', roleCoordinator: '协调员', roleCaregiver: '照顾人',
  hotline: '协调中心热线',
  // 长者端
  elderHello: '您好', sos: '紧急求助', sosHint: '按住 2 秒', findSomeone: '我要找人', todayPlan: '看今天的安排', sosSending: '正在通知协调员…', sosSent: '已通知！协调员会在三分钟内回电。', sosSentHint: '请把手机放在身边，保持电话畅通。', sosFailed: '发送失败，请直接打电话。', callCenter: '打给协调中心', cancelSos: '我没事，取消', noPlanToday: '今天没有安排。有事随时按「我要找人」。', withWho: '负责人', familyGroup: '家庭群组',
  // 家属端
  overview: '总览', profile: '健康档案', reports: '探访报告', alerts: '紧急事件', bookings: '预约服务', group: '家庭群组', payments: '付费记录', team: '照顾团队', selectClient: '选择长者',
  lastReport: '最近一次探访', lastAlert: '最近一次事件', openAlert: '处理中的事件', dueAmount: '待付金额', newBooking: '预约服务', bookingType: '服务类型', bookingTime: '希望时间', bookingNotes: '说明', bookingCreated: '已送出预约，协调员会尽快安排。', myBookings: '预约记录', cancelBooking: '取消',
  conditions: '长期病史', meds: '长期服用的药', allergies: '过敏', doctor: '常看的医生 / 医院', mobility: '行动能力', langDiet: '语言 / 饮食禁忌', healthNotes: '特别注意事项', emergencyContact: '第二紧急联络人', preferredHospital: '指定医院', plan: '配套', monthlyFee: '月费', consent: '资料保护同意', watch: '智能手表', familyMembers: '家属成员',
  photos: '拍照 / 选图', mood: '精神状态', bp: '血压', glucose: '血糖', temp: '体温', medsTaken: '吃药情况', dietSleep: '饮食与睡眠', homeSafety: '家中安全', requests: '老人提出的需要', followUp: '需要跟进', reporter: '探访人',
  alertSource: '来源', severity: '轻重', steps: '处理过程', outcome: '结果', sendMessage: '发送', typeMessage: '输入讯息…', system: '系统',
  period: '月份', item: '项目', amount: '金额', paid: '已付', due: '待付', license: '执照号', dutyHours: '出动时间', licenseBody: '注册机构',
  // 协调员端
  dashboard: '总览', clients: '客人', dispatch: '派单', partners: '合作伙伴', users: '账号', aid: '援助申请', enquiries: '网站咨询', audit: '资料访问记录',
  liveAlerts: '实时警报', clientsCount: '客人数', openAlerts: '处理中警报', todayTasks: '今天任务', unassigned: '待安排', monthlyRevenue: '月费合计', dueTotal: '待收款', newEnquiries: '本周新咨询',
  acknowledge: '已回电 / 接手', dispatchNurse: '派护士 / 医生上门', dispatchCaregiver: '派照顾人上门', callAmbulance: '叫救护车（999 / 私人）', resolve: '结案', markFalse: '误报', addStep: '记录处理步骤', stepPlaceholder: '例如：回电，老人说发烧 38 度', outcomePlaceholder: '结果，例如：医生上门，开药，已通知女儿', simulateWatch: '模拟手表警报', severityMild: '轻症', severitySevere: '重症', severityFalse: '误报',
  assignTo: '安排给', assign: '安排', markDone: '完成', start: '开始', newTask: '新建任务', client: '客人', fee: '费用（令吉）', partner: '合作伙伴', newReport: '填写探访报告', reportKind: '报告类型', visit: '探访', consult: '看诊',
  newClient: '新增客人', editClient: '编辑档案', linkFamily: '关联家属', familyPhone: '家属手机号', relation: '关系', newPartner: '新增伙伴', newUser: '新增账号', role: '角色', clientForElder: '对应客人（长者账号）', created: '已创建',
  scheme: '援助计划', agency: '机构', docs: '需要文件', newAid: '新增申请',
  gender: '性别', birthYear: '出生年份', lat: '纬度', lng: '经度', active: '启用', inactive: '停用',
  // 照顾人端
  myTasks: '我的任务', taskDone: '完成并填报告', clientInfo: '客人资料', navigate: '导航',
  // 类型
  t_visit: '定期探访', t_meds: '代买药 / 提醒吃药', t_escort: '陪诊 / 接送', t_physio: '物理治疗', t_supplies: '用品租借与安装', t_hourly: '钟点工 / 看护', t_shopping: '代买用品', t_respite: '短期托管', t_other: '其他',
  a_sos: '紧急求助', a_fall: '跌倒', a_heart: '心跳异常', a_geofence: '走出安全范围', a_fever: '发烧 / 不舒服', a_other: '其他',
  s_requested: '待安排', s_assigned: '已安排', s_in_progress: '进行中', s_done: '已完成', s_cancelled: '已取消',
  as_new: '新警报', as_acknowledged: '已接手', as_dispatched: '已派人', as_resolved: '已结案',
  p_clinic: '诊所医生', p_nurse: '上门护士', p_caregiver: '看护 / 钟点工', p_physio: '物理治疗师', p_driver: '接送司机', p_ambulance: '救护车', p_supplies: '医疗用品店', p_counsellor: '辅导员', p_nursing_home: '养老院 / 托管',
  plan_basic: '基本安心', plan_standard: '标准照顾', plan_full: '全面照顾', plan_subsidised: '补贴配套',
  aid_preparing: '准备中', aid_submitted: '已提交', aid_approved: '已批准', aid_rejected: '未批准',
  // 网站
  nav_services: '服务内容', nav_how: '紧急流程', nav_pricing: '收费', nav_partners: '合作伙伴', nav_faq: '常见问题', nav_app: '下载 App', nav_login: '登录系统',
  heroTitle: '您在新加坡上班，我们在新山照顾您的父母。', heroSub: '一个号码、一个 App：紧急时第一时间有人处理，日常有人探访、提醒吃药、陪诊，所有情况即时汇报给您。',
  ctaWhatsapp: 'WhatsApp 咨询', ctaTry: '查看演示', notMedical: '我们提供的是照顾协调服务，不是医疗服务。所有看诊和护理由持牌医生与护士进行。',
  pain1: '父母生病谁带去看医生？', pain2: '出院后谁照顾？', pain3: '出事了谁第一时间知道？', painTitle: '每天往返新加坡上班的您，最担心的是：',
  svcTitle: '我们做什么', svcEmergency: '24 小时紧急协调', svcEmergencyD: '老人按一下手表或 App，协调员三分钟内回电，轻症一小时内安排医生或护士上门，重症马上叫救护车并派人陪同。', svcVisit: '定期上门探访', svcVisitD: '每周一到两次上门，量血压血糖、检查药盒、看家中安全，探访报告即时发到您的 App。', svcEscort: '陪诊与接送', svcEscortD: '有耐心的司机加照顾人，接送去医院或诊所，看诊结果当天汇报。', svcMeds: '提醒吃药、代买药与用品', svcMedsD: '按时提醒，代买药与日用品，护理床、轮椅、扶手租借与安装。', svcWatch: '智能手表监测', svcWatchD: 'SOS 按钮、跌倒感应、定位、心跳提醒，数据只存在我们自己的服务器。', svcFund: '关怀基金', svcFundD: '每位付费客人月费的一成，补贴低收入与独居长者，并协助申请政府援助。',
  howTitle: '紧急处理流程（例：老人发烧，家里没人）', how1: '老人或子女按紧急按钮，或 WhatsApp 热线', how2: '协调员马上回电了解情况，判断轻重', how3: '轻症：安排合作的上门医生或护士，一小时内到', how4: '重症：叫救护车，同时通知子女，派人陪老人去医院', how5: '全程在家庭群组更新，让您在新加坡也安心',
  pricingTitle: '收费方案', perMonth: '令吉 / 月', pricingNote: '另外按次收费：陪诊每次 80 到 120 令吉、紧急出动每次 150 令吉、用品租借按市价加一成。前五位客人半价。',
  plan_basic_d: '紧急热线 24 小时 · 每月一次探访 · 健康档案', plan_standard_d: '紧急热线 · 每周一次探访 · 陪诊一次 · 提醒吃药', plan_full_d: '紧急热线 · 每周两次探访 · 陪诊不限 · 代买药与用品 · 钟点工协调',
  partnersTitle: '诚邀合作：诊所、护士、辅导员、看护与司机', partnersD: '我们只做协调，不做医疗决定。您得到稳定的长者病人、事先整理好的病史和用药资料、准时付款。医生诊金由医生自收，我们不抽成。', partnersCta: '联络我们谈合作',
  faqTitle: '常见问题', faq1q: '你们是医生或护士吗？', faq1a: '不是。我们是老人的管家、家庭的协调人。看诊和护理由有执照的医生、护士进行，我们负责把资源连接起来、第一时间处理、并向您汇报。', faq2q: '父母的健康资料安全吗？', faq2a: '健康资料加密后只存在我们自己的服务器，遵守马来西亚个人资料保护法（PDPA），只用于看诊安排，不外传。', faq3q: '付不起怎么办？', faq3a: '有补贴配套，并由关怀基金补助低收入和独居长者。我们也会协助申请福利局与州政府的长者援助。', faq4q: '服务范围？', faq4a: '新山市区、士古来、古来、巴西古当、依斯干达公主城。',
  appTitle: '下载安心照顾 App', appD: '长者端只有三个大按钮：紧急求助、我要找人、看今天的安排。子女端随时看档案、报告、定位与群组。Android 优先，iOS 稍后。', downloadApk: '下载 Android APK', openWeb: '用浏览器打开', contactTitle: '留下联络方式，我们回电给您', yourName: '您的称呼', yourPhone: '手机号（新加坡或马来西亚）', yourCity: '父母所在地区', yourMessage: '想了解什么', sent: '已收到，我们会尽快联络您。',
  footer: '© 安心照顾 · 新山老人照顾协调服务 · 本服务为协调服务，非医疗机构。', legal: '资料保护与免责声明',
};

const en: typeof zh = {
  appName: 'AnXin Care', tagline: 'JB Elder Care Coordination',
  login: 'Log in', logout: 'Log out', phone: 'Phone', password: 'Password', serverUrl: 'Server URL', save: 'Save', cancel: 'Cancel', submit: 'Submit', back: 'Back', close: 'Close',
  loading: 'Loading…', none: 'Nothing yet', today: 'Today', upcoming: 'Upcoming', all: 'All', status: 'Status', time: 'Time', type: 'Type', notes: 'Notes', actions: 'Actions', name: 'Name', address: 'Address', region: 'Area', call: 'Call', whatsapp: 'WhatsApp', refresh: 'Refresh', add: 'Add', edit: 'Edit', search: 'Search', confirm: 'Confirm', yes: 'Yes', no: 'No', language: 'Language', retry: 'Retry',
  networkError: 'Cannot reach the server. Check your network or server URL.', serverRequired: 'Enter the server URL (where your backend is deployed) before logging in.', notConfigured: 'This build is not linked to a server yet. Please contact your administrator for the official version.', notApi: 'That address is not an AnXin Care backend. Check the server URL.', serverTest: 'Test', serverOk: 'Connected', serverHint: 'The backend is hosted by your team; on the same Wi-Fi you can use your computer’s IP, e.g. 192.168.1.10:8787.', badCredentials: 'Wrong phone or password.', forbidden: 'Not allowed.',
  demoAccounts: 'Demo accounts (password 123456)', roleElder: 'Elder', roleFamily: 'Family', roleCoordinator: 'Coordinator', roleCaregiver: 'Caregiver',
  hotline: 'Coordination hotline',
  elderHello: 'Hello', sos: 'EMERGENCY', sosHint: 'Hold 2 seconds', findSomeone: 'I need someone', todayPlan: "Today's plan", sosSending: 'Notifying the coordinator…', sosSent: 'Sent! The coordinator will call you within 3 minutes.', sosSentHint: 'Keep your phone nearby.', sosFailed: 'Failed to send. Please call directly.', callCenter: 'Call the centre', cancelSos: "I'm fine, cancel", noPlanToday: 'Nothing planned today. Press "I need someone" anytime.', withWho: 'By', familyGroup: 'Family group',
  overview: 'Overview', profile: 'Health profile', reports: 'Visit reports', alerts: 'Emergencies', bookings: 'Book services', group: 'Family group', payments: 'Payments', team: 'Care team', selectClient: 'Select elder',
  lastReport: 'Last visit', lastAlert: 'Last incident', openAlert: 'Incident in progress', dueAmount: 'Amount due', newBooking: 'Book a service', bookingType: 'Service', bookingTime: 'Preferred time', bookingNotes: 'Details', bookingCreated: 'Request sent. The coordinator will arrange it.', myBookings: 'Bookings', cancelBooking: 'Cancel',
  conditions: 'Conditions', meds: 'Regular medication', allergies: 'Allergies', doctor: 'Usual doctor / hospital', mobility: 'Mobility', langDiet: 'Language / diet', healthNotes: 'Special notes', emergencyContact: 'Second emergency contact', preferredHospital: 'Preferred hospital', plan: 'Plan', monthlyFee: 'Monthly fee', consent: 'PDPA consent', watch: 'Smart watch', familyMembers: 'Family members',
  photos: 'Photos', mood: 'Mood', bp: 'Blood pressure', glucose: 'Glucose', temp: 'Temperature', medsTaken: 'Medication', dietSleep: 'Diet & sleep', homeSafety: 'Home safety', requests: 'Requests', followUp: 'Follow up', reporter: 'Visited by',
  alertSource: 'Source', severity: 'Severity', steps: 'Handling log', outcome: 'Outcome', sendMessage: 'Send', typeMessage: 'Type a message…', system: 'System',
  period: 'Month', item: 'Item', amount: 'Amount', paid: 'Paid', due: 'Due', license: 'License no.', dutyHours: 'Duty hours', licenseBody: 'Registered with',
  dashboard: 'Dashboard', clients: 'Clients', dispatch: 'Dispatch', partners: 'Partners', users: 'Accounts', aid: 'Aid applications', enquiries: 'Web enquiries', audit: 'Access log',
  liveAlerts: 'Live alerts', clientsCount: 'Clients', openAlerts: 'Open alerts', todayTasks: "Today's tasks", unassigned: 'Unassigned', monthlyRevenue: 'Monthly fees', dueTotal: 'Outstanding', newEnquiries: 'New enquiries (7d)',
  acknowledge: 'Called back / take over', dispatchNurse: 'Send nurse / doctor', dispatchCaregiver: 'Send caregiver', callAmbulance: 'Call ambulance (999 / private)', resolve: 'Resolve', markFalse: 'False alarm', addStep: 'Log a step', stepPlaceholder: 'e.g. Called back, elder has fever 38°C', outcomePlaceholder: 'Outcome, e.g. doctor visited, meds given, daughter informed', simulateWatch: 'Simulate watch alert', severityMild: 'Mild', severitySevere: 'Severe', severityFalse: 'False alarm',
  assignTo: 'Assign to', assign: 'Assign', markDone: 'Done', start: 'Start', newTask: 'New task', client: 'Client', fee: 'Fee (RM)', partner: 'Partner', newReport: 'Visit report', reportKind: 'Kind', visit: 'Visit', consult: 'Consultation',
  newClient: 'New client', editClient: 'Edit profile', linkFamily: 'Link family member', familyPhone: 'Family phone', relation: 'Relation', newPartner: 'New partner', newUser: 'New account', role: 'Role', clientForElder: 'Client (for elder account)', created: 'Created',
  scheme: 'Scheme', agency: 'Agency', docs: 'Documents', newAid: 'New application',
  gender: 'Gender', birthYear: 'Birth year', lat: 'Latitude', lng: 'Longitude', active: 'Active', inactive: 'Inactive',
  myTasks: 'My tasks', taskDone: 'Complete with report', clientInfo: 'Client info', navigate: 'Navigate',
  t_visit: 'Regular visit', t_meds: 'Buy meds / reminder', t_escort: 'Escort / transport', t_physio: 'Physiotherapy', t_supplies: 'Equipment rental & install', t_hourly: 'Hourly helper / caregiver', t_shopping: 'Shopping', t_respite: 'Respite care', t_other: 'Other',
  a_sos: 'SOS', a_fall: 'Fall', a_heart: 'Abnormal heart rate', a_geofence: 'Left safe zone', a_fever: 'Fever / unwell', a_other: 'Other',
  s_requested: 'Requested', s_assigned: 'Assigned', s_in_progress: 'In progress', s_done: 'Done', s_cancelled: 'Cancelled',
  as_new: 'New', as_acknowledged: 'Acknowledged', as_dispatched: 'Dispatched', as_resolved: 'Resolved',
  p_clinic: 'Clinic doctor', p_nurse: 'Home nurse', p_caregiver: 'Caregiver / hourly helper', p_physio: 'Physiotherapist', p_driver: 'Driver', p_ambulance: 'Ambulance', p_supplies: 'Medical supplies', p_counsellor: 'Counsellor', p_nursing_home: 'Nursing home / respite',
  plan_basic: 'Basic', plan_standard: 'Standard', plan_full: 'Full care', plan_subsidised: 'Subsidised',
  aid_preparing: 'Preparing', aid_submitted: 'Submitted', aid_approved: 'Approved', aid_rejected: 'Rejected',
  nav_services: 'Services', nav_how: 'Emergency flow', nav_pricing: 'Pricing', nav_partners: 'Partners', nav_faq: 'FAQ', nav_app: 'Get the app', nav_login: 'Log in',
  heroTitle: 'You work in Singapore. We look after your parents in Johor Bahru.', heroSub: 'One number, one app: someone acts the moment something happens, regular visits, medication reminders and clinic escorts, with every update sent to you instantly.',
  ctaWhatsapp: 'Chat on WhatsApp', ctaTry: 'See the demo', notMedical: 'We provide care coordination, not medical services. All consultations and nursing are done by licensed doctors and nurses.',
  pain1: 'Who takes Mum to the doctor when she is sick?', pain2: 'Who looks after Dad after discharge?', pain3: 'Who finds out first when something happens?', painTitle: 'If you commute to Singapore every day, you worry about:',
  svcTitle: 'What we do', svcEmergency: '24-hour emergency coordination', svcEmergencyD: 'One press on the watch or app: the coordinator calls back within 3 minutes, arranges a doctor or nurse within the hour for mild cases, or an ambulance and an escort for severe ones.', svcVisit: 'Regular home visits', svcVisitD: 'One or two visits a week: blood pressure, glucose, pill box, home safety. The report reaches your app right away.', svcEscort: 'Clinic escorts & transport', svcEscortD: 'A patient driver plus a caregiver take your parent to the hospital or clinic and report the outcome the same day.', svcMeds: 'Medication reminders, meds & supplies', svcMedsD: 'On-time reminders, medicine and grocery runs, hospital bed, wheelchair and grab-bar rental and installation.', svcWatch: 'Smart watch monitoring', svcWatchD: 'SOS button, fall detection, location and heart-rate alerts. Data lives only on our own server.', svcFund: 'Care fund', svcFundD: '10% of every paying client’s fee subsidises low-income and solitary elders, and we help them apply for government aid.',
  howTitle: 'Emergency flow (e.g. fever, nobody home)', how1: 'Elder or family presses the emergency button or messages the hotline', how2: 'Coordinator calls back immediately and assesses severity', how3: 'Mild: partner doctor or nurse at the door within an hour', how4: 'Severe: ambulance called, family notified, someone escorts to hospital', how5: 'Every step is posted in the family group so you stay calm in Singapore',
  pricingTitle: 'Pricing', perMonth: 'RM / month', pricingNote: 'Per-use fees: escort RM80–120, emergency callout RM150, equipment rental at market price plus 10%. First five clients at half price.',
  plan_basic_d: '24h hotline · 1 visit a month · health profile', plan_standard_d: 'Hotline · weekly visit · 1 escort · medication reminders', plan_full_d: 'Hotline · 2 visits a week · unlimited escorts · meds & supplies · helper coordination',
  partnersTitle: 'Partner with us: clinics, nurses, counsellors, caregivers, drivers', partnersD: 'We only coordinate and never make medical decisions. You get steady elderly patients, prepared histories and medication lists, and on-time payment. Doctors keep their full consultation fee.', partnersCta: 'Talk to us',
  faqTitle: 'FAQ', faq1q: 'Are you doctors or nurses?', faq1a: 'No. We are the elder’s steward and the family’s coordinator. Licensed doctors and nurses treat; we connect, act first and report to you.', faq2q: 'Is my parents’ health data safe?', faq2a: 'Health data is encrypted and kept only on our own server, in line with Malaysia’s PDPA, used solely to arrange care.', faq3q: 'What if we cannot afford it?', faq3a: 'There is a subsidised plan funded by our care fund, and we help apply for JKM and Johor state elder aid.', faq4q: 'Coverage area?', faq4a: 'JB city, Skudai, Kulai, Pasir Gudang, Iskandar Puteri.',
  appTitle: 'Get the AnXin Care app', appD: 'The elder screen has only three big buttons: Emergency, I need someone, Today’s plan. Family members see the profile, reports, location and group chat anytime. Android first, iOS later.', downloadApk: 'Download Android APK', openWeb: 'Open in browser', contactTitle: 'Leave your number and we will call you', yourName: 'Your name', yourPhone: 'Phone (SG or MY)', yourCity: 'Where your parents live', yourMessage: 'What would you like to know', sent: 'Received. We will contact you soon.',
  footer: '© AnXin Care · JB Elder Care Coordination · A coordination service, not a medical provider.', legal: 'Privacy & disclaimer',
};

const ms: typeof zh = {
  appName: 'AnXin Care', tagline: 'Penyelarasan Penjagaan Warga Emas JB',
  login: 'Log masuk', logout: 'Log keluar', phone: 'Telefon', password: 'Kata laluan', serverUrl: 'URL pelayan', save: 'Simpan', cancel: 'Batal', submit: 'Hantar', back: 'Kembali', close: 'Tutup',
  loading: 'Memuatkan…', none: 'Tiada lagi', today: 'Hari ini', upcoming: 'Akan datang', all: 'Semua', status: 'Status', time: 'Masa', type: 'Jenis', notes: 'Catatan', actions: 'Tindakan', name: 'Nama', address: 'Alamat', region: 'Kawasan', call: 'Telefon', whatsapp: 'WhatsApp', refresh: 'Muat semula', add: 'Tambah', edit: 'Sunting', search: 'Cari', confirm: 'Sahkan', yes: 'Ya', no: 'Tidak', language: 'Bahasa', retry: 'Cuba lagi',
  networkError: 'Tidak dapat sambung ke pelayan. Semak rangkaian atau URL pelayan.', serverRequired: 'Masukkan URL pelayan (tempat backend anda) sebelum log masuk.', notConfigured: 'Versi aplikasi ini belum dipautkan ke pelayan. Sila hubungi pentadbir untuk versi rasmi.', notApi: 'Alamat itu bukan backend AnXin Care. Semak URL pelayan.', serverTest: 'Uji', serverOk: 'Berjaya disambung', serverHint: 'Backend dihoskan oleh pasukan anda; dalam Wi-Fi yang sama boleh guna IP komputer, cth 192.168.1.10:8787.', badCredentials: 'Telefon atau kata laluan salah.', forbidden: 'Tidak dibenarkan.',
  demoAccounts: 'Akaun demo (kata laluan 123456)', roleElder: 'Warga emas', roleFamily: 'Keluarga', roleCoordinator: 'Penyelaras', roleCaregiver: 'Penjaga',
  hotline: 'Talian penyelarasan',
  elderHello: 'Selamat sejahtera', sos: 'KECEMASAN', sosHint: 'Tekan 2 saat', findSomeone: 'Saya perlukan orang', todayPlan: 'Jadual hari ini', sosSending: 'Memaklumkan penyelaras…', sosSent: 'Dihantar! Penyelaras akan telefon dalam 3 minit.', sosSentHint: 'Simpan telefon berdekatan.', sosFailed: 'Gagal dihantar. Sila telefon terus.', callCenter: 'Telefon pusat', cancelSos: 'Saya OK, batal', noPlanToday: 'Tiada jadual hari ini. Tekan "Saya perlukan orang" bila-bila masa.', withWho: 'Oleh', familyGroup: 'Kumpulan keluarga',
  overview: 'Ringkasan', profile: 'Profil kesihatan', reports: 'Laporan lawatan', alerts: 'Kecemasan', bookings: 'Tempah servis', group: 'Kumpulan keluarga', payments: 'Bayaran', team: 'Pasukan penjagaan', selectClient: 'Pilih warga emas',
  lastReport: 'Lawatan terakhir', lastAlert: 'Insiden terakhir', openAlert: 'Insiden sedang diuruskan', dueAmount: 'Jumlah belum bayar', newBooking: 'Tempah servis', bookingType: 'Servis', bookingTime: 'Masa pilihan', bookingNotes: 'Butiran', bookingCreated: 'Permintaan dihantar. Penyelaras akan aturkan.', myBookings: 'Tempahan', cancelBooking: 'Batal',
  conditions: 'Penyakit', meds: 'Ubat tetap', allergies: 'Alahan', doctor: 'Doktor / hospital biasa', mobility: 'Mobiliti', langDiet: 'Bahasa / pantang makanan', healthNotes: 'Catatan khas', emergencyContact: 'Hubungan kecemasan kedua', preferredHospital: 'Hospital pilihan', plan: 'Pelan', monthlyFee: 'Yuran bulanan', consent: 'Persetujuan PDPA', watch: 'Jam pintar', familyMembers: 'Ahli keluarga',
  photos: 'Gambar', mood: 'Keadaan', bp: 'Tekanan darah', glucose: 'Gula', temp: 'Suhu', medsTaken: 'Ubat', dietSleep: 'Makan & tidur', homeSafety: 'Keselamatan rumah', requests: 'Permintaan', followUp: 'Susulan', reporter: 'Dilawati oleh',
  alertSource: 'Sumber', severity: 'Tahap', steps: 'Log tindakan', outcome: 'Hasil', sendMessage: 'Hantar', typeMessage: 'Taip mesej…', system: 'Sistem',
  period: 'Bulan', item: 'Perkara', amount: 'Jumlah', paid: 'Dibayar', due: 'Belum bayar', license: 'No. lesen', dutyHours: 'Waktu bertugas', licenseBody: 'Berdaftar dengan',
  dashboard: 'Papan pemuka', clients: 'Pelanggan', dispatch: 'Agihan tugas', partners: 'Rakan kongsi', users: 'Akaun', aid: 'Permohonan bantuan', enquiries: 'Pertanyaan web', audit: 'Log akses',
  liveAlerts: 'Amaran langsung', clientsCount: 'Pelanggan', openAlerts: 'Amaran terbuka', todayTasks: 'Tugas hari ini', unassigned: 'Belum diagih', monthlyRevenue: 'Yuran bulanan', dueTotal: 'Tertunggak', newEnquiries: 'Pertanyaan baru (7 hari)',
  acknowledge: 'Sudah telefon / ambil alih', dispatchNurse: 'Hantar jururawat / doktor', dispatchCaregiver: 'Hantar penjaga', callAmbulance: 'Panggil ambulans (999 / swasta)', resolve: 'Selesai', markFalse: 'Amaran palsu', addStep: 'Catat langkah', stepPlaceholder: 'cth: Telefon balik, demam 38°C', outcomePlaceholder: 'Hasil, cth: doktor datang, ubat diberi, anak dimaklumkan', simulateWatch: 'Simulasi amaran jam', severityMild: 'Ringan', severitySevere: 'Teruk', severityFalse: 'Palsu',
  assignTo: 'Agih kepada', assign: 'Agih', markDone: 'Selesai', start: 'Mula', newTask: 'Tugas baru', client: 'Pelanggan', fee: 'Yuran (RM)', partner: 'Rakan kongsi', newReport: 'Laporan lawatan', reportKind: 'Jenis', visit: 'Lawatan', consult: 'Rawatan',
  newClient: 'Pelanggan baru', editClient: 'Sunting profil', linkFamily: 'Pautkan ahli keluarga', familyPhone: 'Telefon keluarga', relation: 'Hubungan', newPartner: 'Rakan kongsi baru', newUser: 'Akaun baru', role: 'Peranan', clientForElder: 'Pelanggan (akaun warga emas)', created: 'Dicipta',
  scheme: 'Skim', agency: 'Agensi', docs: 'Dokumen', newAid: 'Permohonan baru',
  gender: 'Jantina', birthYear: 'Tahun lahir', lat: 'Latitud', lng: 'Longitud', active: 'Aktif', inactive: 'Tidak aktif',
  myTasks: 'Tugas saya', taskDone: 'Selesai dengan laporan', clientInfo: 'Maklumat pelanggan', navigate: 'Navigasi',
  t_visit: 'Lawatan berkala', t_meds: 'Beli ubat / peringatan', t_escort: 'Iring / pengangkutan', t_physio: 'Fisioterapi', t_supplies: 'Sewa & pasang peralatan', t_hourly: 'Pembantu / penjaga mengikut jam', t_shopping: 'Beli barang', t_respite: 'Jagaan sementara', t_other: 'Lain-lain',
  a_sos: 'SOS', a_fall: 'Jatuh', a_heart: 'Degupan jantung luar biasa', a_geofence: 'Keluar zon selamat', a_fever: 'Demam / tidak sihat', a_other: 'Lain-lain',
  s_requested: 'Diminta', s_assigned: 'Diagih', s_in_progress: 'Sedang berjalan', s_done: 'Selesai', s_cancelled: 'Dibatalkan',
  as_new: 'Baru', as_acknowledged: 'Diambil alih', as_dispatched: 'Dihantar', as_resolved: 'Selesai',
  p_clinic: 'Doktor klinik', p_nurse: 'Jururawat rumah', p_caregiver: 'Penjaga / pembantu jam', p_physio: 'Ahli fisioterapi', p_driver: 'Pemandu', p_ambulance: 'Ambulans', p_supplies: 'Kedai alat perubatan', p_counsellor: 'Kaunselor', p_nursing_home: 'Rumah jagaan / sementara',
  plan_basic: 'Asas', plan_standard: 'Standard', plan_full: 'Penuh', plan_subsidised: 'Bersubsidi',
  aid_preparing: 'Sedang disediakan', aid_submitted: 'Dihantar', aid_approved: 'Diluluskan', aid_rejected: 'Ditolak',
  nav_services: 'Servis', nav_how: 'Aliran kecemasan', nav_pricing: 'Harga', nav_partners: 'Rakan kongsi', nav_faq: 'Soalan lazim', nav_app: 'Dapatkan aplikasi', nav_login: 'Log masuk',
  heroTitle: 'Anda bekerja di Singapura. Kami jaga ibu bapa anda di Johor Bahru.', heroSub: 'Satu nombor, satu aplikasi: ada orang bertindak serta-merta bila berlaku apa-apa, lawatan berkala, peringatan ubat dan iringan ke klinik, dengan setiap kemas kini terus kepada anda.',
  ctaWhatsapp: 'Sembang di WhatsApp', ctaTry: 'Lihat demo', notMedical: 'Kami menyediakan penyelarasan penjagaan, bukan perkhidmatan perubatan. Semua rawatan dan kejururawatan dilakukan oleh doktor dan jururawat berlesen.',
  pain1: 'Siapa bawa Mak ke doktor bila sakit?', pain2: 'Siapa jaga Ayah selepas keluar hospital?', pain3: 'Siapa tahu dulu bila berlaku sesuatu?', painTitle: 'Jika anda berulang-alik ke Singapura setiap hari, anda risau:',
  svcTitle: 'Apa yang kami buat', svcEmergency: 'Penyelarasan kecemasan 24 jam', svcEmergencyD: 'Satu tekanan pada jam atau aplikasi: penyelaras telefon balik dalam 3 minit, aturkan doktor atau jururawat dalam sejam untuk kes ringan, atau ambulans dan pengiring untuk kes teruk.', svcVisit: 'Lawatan rumah berkala', svcVisitD: 'Satu atau dua lawatan seminggu: tekanan darah, gula, kotak ubat, keselamatan rumah. Laporan terus ke aplikasi anda.', svcEscort: 'Iringan klinik & pengangkutan', svcEscortD: 'Pemandu yang sabar bersama penjaga membawa ibu bapa anda ke hospital atau klinik dan melaporkan hasil pada hari yang sama.', svcMeds: 'Peringatan ubat, beli ubat & barang', svcMedsD: 'Peringatan tepat masa, beli ubat dan barang keperluan, sewa dan pasang katil hospital, kerusi roda, palang pegangan.', svcWatch: 'Pemantauan jam pintar', svcWatchD: 'Butang SOS, pengesan jatuh, lokasi dan amaran degupan jantung. Data hanya disimpan di pelayan kami sendiri.', svcFund: 'Dana prihatin', svcFundD: '10% daripada yuran setiap pelanggan mensubsidi warga emas berpendapatan rendah dan bersendirian, dan kami bantu mohon bantuan kerajaan.',
  howTitle: 'Aliran kecemasan (cth: demam, tiada orang di rumah)', how1: 'Warga emas atau keluarga tekan butang kecemasan atau mesej talian', how2: 'Penyelaras telefon balik serta-merta dan nilai tahap', how3: 'Ringan: doktor atau jururawat rakan kongsi tiba dalam sejam', how4: 'Teruk: ambulans dipanggil, keluarga dimaklumkan, ada yang mengiring ke hospital', how5: 'Setiap langkah dikongsi dalam kumpulan keluarga supaya anda tenang di Singapura',
  pricingTitle: 'Harga', perMonth: 'RM / bulan', pricingNote: 'Yuran setiap kali: iringan RM80–120, panggilan kecemasan RM150, sewa peralatan harga pasaran tambah 10%. Lima pelanggan pertama separuh harga.',
  plan_basic_d: 'Talian 24 jam · 1 lawatan sebulan · profil kesihatan', plan_standard_d: 'Talian · lawatan mingguan · 1 iringan · peringatan ubat', plan_full_d: 'Talian · 2 lawatan seminggu · iringan tanpa had · ubat & barang · penyelarasan pembantu',
  partnersTitle: 'Jadi rakan kongsi: klinik, jururawat, kaunselor, penjaga, pemandu', partnersD: 'Kami hanya menyelaras dan tidak membuat keputusan perubatan. Anda dapat pesakit warga emas yang stabil, sejarah dan senarai ubat yang disediakan, dan bayaran tepat masa. Doktor simpan yuran rundingan sepenuhnya.', partnersCta: 'Hubungi kami',
  faqTitle: 'Soalan lazim', faq1q: 'Adakah anda doktor atau jururawat?', faq1a: 'Tidak. Kami pengurus warga emas dan penyelaras keluarga. Doktor dan jururawat berlesen merawat; kami menghubungkan, bertindak dahulu dan melapor kepada anda.', faq2q: 'Adakah data kesihatan ibu bapa saya selamat?', faq2a: 'Data kesihatan disulitkan dan hanya disimpan di pelayan kami sendiri, mengikut PDPA Malaysia, digunakan semata-mata untuk mengatur penjagaan.', faq3q: 'Bagaimana jika kami tidak mampu?', faq3a: 'Ada pelan bersubsidi melalui dana prihatin kami, dan kami bantu mohon bantuan warga emas JKM dan kerajaan negeri Johor.', faq4q: 'Kawasan liputan?', faq4a: 'Bandar JB, Skudai, Kulai, Pasir Gudang, Iskandar Puteri.',
  appTitle: 'Dapatkan aplikasi AnXin Care', appD: 'Skrin warga emas hanya ada tiga butang besar: Kecemasan, Saya perlukan orang, Jadual hari ini. Ahli keluarga lihat profil, laporan, lokasi dan sembang kumpulan bila-bila masa. Android dahulu, iOS kemudian.', downloadApk: 'Muat turun APK Android', openWeb: 'Buka dalam pelayar', contactTitle: 'Tinggalkan nombor anda dan kami akan telefon', yourName: 'Nama anda', yourPhone: 'Telefon (SG atau MY)', yourCity: 'Kawasan ibu bapa tinggal', yourMessage: 'Apa yang ingin anda tahu', sent: 'Diterima. Kami akan hubungi anda tidak lama lagi.',
  footer: '© AnXin Care · Penyelarasan Penjagaan Warga Emas JB · Perkhidmatan penyelarasan, bukan penyedia perubatan.', legal: 'Privasi & penafian',
};

export const dicts: Record<Lang, typeof zh> = { zh, en, ms };
export type Key = keyof typeof zh;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key | string) => string }>({ lang: 'zh', setLang: () => {}, t: (k) => String(k) });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem(KEY) as Lang) || 'zh');
  const value = useMemo(() => ({
    lang,
    setLang: (l: Lang) => { localStorage.setItem(KEY, l); setLangState(l); document.documentElement.lang = l; },
    t: (k: Key | string) => (dicts[lang] as any)[k] ?? (zh as any)[k] ?? String(k),
  }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useT = () => useContext(Ctx);
export const LANGS: { id: Lang; label: string }[] = [{ id: 'zh', label: '中文' }, { id: 'en', label: 'EN' }, { id: 'ms', label: 'BM' }];
