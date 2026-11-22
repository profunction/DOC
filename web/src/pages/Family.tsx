// 子女端：档案、报告、警报、预约、群组、付费、团队。
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { homeOutline, chatbubblesOutline, documentTextOutline, calendarOutline, alertCircleOutline, medkitOutline, cardOutline, peopleOutline, watchOutline } from 'ionicons/icons';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton } from '@ionic/react';
import { checkmarkCircle, ellipseOutline, timeOutline, refreshOutline, logOutOutline } from 'ionicons/icons';
import { ElderPhoneSetup } from '../components/ElderPhoneSetup';
import { WatchPanel } from '../components/WatchPanel';
import { MapView } from '../components/MapView';
import { useT } from '../i18n';
import { useStore } from '../store';
import { api, fmtTime, photoUrl, niceTime } from '../api';
import { IonIcon } from '@ionic/react';
import { callOutline, logoWhatsapp, locationOutline, happyOutline, waterOutline, thermometerOutline, pulseOutline, imagesOutline } from 'ionicons/icons';
import { MeMenu, Shell, useLoad, Badge, Field, Empty, TASK_TYPES, telLink, waLink, mapsLink, localDT, useErr, Btn } from '../components/ui';

export default function Family() {
  const { t } = useT();
  const { clientIds, hotline } = useStore();
  const [tab, setTab] = useState('overview');
  const [cid, setCid] = useState<number>(clientIds[0]);
  useEffect(() => { if (!cid && clientIds[0]) setCid(clientIds[0]); }, [clientIds]);
  const { data: clients } = useLoad<any[]>('/clients');
  const tabs = [
    { id: 'overview', label: t('overview'), icon: homeOutline }, { id: 'group', label: t('group'), icon: chatbubblesOutline }, { id: 'reports', label: t('reports'), icon: documentTextOutline },
    { id: 'bookings', label: t('bookings'), icon: calendarOutline }, { id: 'location', label: t('location'), icon: watchOutline }, { id: 'alerts', label: t('alerts'), icon: alertCircleOutline }, { id: 'profile', label: t('profile'), icon: medkitOutline },
    { id: 'payments', label: t('payments'), icon: cardOutline }, { id: 'team', label: t('team'), icon: peopleOutline },
  ];
  const right = clients && clients.length > 1 ? (
    <select className="lang-select light" value={cid} onChange={e => setCid(Number(e.target.value))}>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
  ) : null;
  if (!cid) return <Pending />;
  return (
    <Shell title={t('appName')} tabs={tabs} tab={tab} onTab={setTab} right={right}>
      {tab === 'overview' && <Overview cid={cid} hotline={hotline} go={setTab} />}
      {tab === 'group' && <Chat cid={cid} />}
      {tab === 'reports' && <Reports cid={cid} />}
      {tab === 'bookings' && <Bookings cid={cid} />}
      {tab === 'location' && <WatchPanel clientId={cid} />}
      {tab === 'alerts' && <Alerts cid={cid} />}
      {tab === 'profile' && <Profile cid={cid} />}
      {tab === 'payments' && <Payments cid={cid} />}
      {tab === 'team' && <Team />}
    </Shell>
  );
}

function Overview({ cid, hotline, go }: { cid: number; hotline: string; go: (t: string) => void }) {
  const { t } = useT();
  const { data: s } = useLoad<any>(`/clients/${cid}/summary`, [], ['alert', 'task', 'report', 'message']);
  if (!s) return <p className="muted">{t('loading')}</p>;
  const c = s.client;
  return (
    <div>
      {c.verified === 0 && <div className="unverified-banner"><b>{t('unverifiedTitle')}</b><p>{t('unverifiedText')}</p>
        <div className="row"><Btn v="ok sm" href={waLink(hotline)} target="_blank" rel="noreferrer"><IonIcon slot="start" icon={logoWhatsapp} />{t('contactNow')}</Btn><Btn v="ghost sm" onClick={() => go('profile')}>{t('editParent')}</Btn></div></div>}
      {s.openAlerts?.length > 0 && <div className="alert-banner" onClick={() => go('alerts')}>🚨 {t('openAlert')}：{t('a_' + s.openAlerts[0].type)} · {t('as_' + s.openAlerts[0].status)} · {niceTime(s.openAlerts[0].created_at)}</div>}
      <div className="card">
        <div className="row between"><h3>{c.name}</h3><Badge>{t('plan_' + c.plan)}</Badge></div>
        <p className="small muted">{c.address}</p>
        <div className="row">
          <Btn v="sm" href={telLink(hotline)}><IonIcon slot="start" icon={callOutline} />{t('hotline')}</Btn>
          <Btn v="sm ok" href={waLink(hotline)} target="_blank" rel="noreferrer"><IonIcon slot="start" icon={logoWhatsapp} />{t('whatsapp')}</Btn>
          <Btn v="sm ghost" href={mapsLink(c.address, c.lat, c.lng)} target="_blank" rel="noreferrer"><IonIcon slot="start" icon={locationOutline} />{t('address')}</Btn>
        </div>
      </div>
      <div className="grid" style={{ marginTop: '.85rem' }}>
        <div className="card"><h3><IonIcon icon={calendarOutline} /> {t('today')}</h3>
          {!s.todayTasks.length && <Empty text={t('noPlanToday')} />}
          <div className="list">{s.todayTasks.map((x: any) => <div key={x.id} className="row between"><span>{fmtTime(x.scheduled_at).slice(11)} {x.title}<div className="small muted">{x.assignee_name || x.partner_name || ''}</div></span><Badge kind={x.status}>{t('s_' + x.status)}</Badge></div>)}</div>
          {s.upcoming.length > 0 && <><h3 style={{ marginTop: '.8rem' }}>{t('upcoming')}</h3><div className="list">{s.upcoming.map((x: any) => <div key={x.id} className="small">{niceTime(x.scheduled_at)} · {x.title}</div>)}</div></>}
        </div>
        <div className="card"><h3><IonIcon icon={documentTextOutline} /> {t('lastReport')}</h3>
          {s.lastReport ? <ReportCard r={s.lastReport} compact /> : <Empty />}
          <Btn v="sm ghost" onClick={() => go('reports')}>{t('reports')} →</Btn>
        </div>
        <div className="card"><h3><IonIcon icon={alertCircleOutline} /> {t('lastAlert')}</h3>
          {s.lastAlert ? <div><Badge kind={s.lastAlert.status}>{t('as_' + s.lastAlert.status)}</Badge> {t('a_' + s.lastAlert.type)} · {niceTime(s.lastAlert.created_at)}<p className="small muted" style={{ marginTop: '.4rem' }}>{s.lastAlert.outcome}</p></div> : <Empty />}
        </div>
        <div className="card stat"><div className="n">RM {s.dueAmount}</div><div className="l">{t('dueAmount')}</div><Btn v="sm ghost" onClick={() => go('payments')}>{t('payments')} →</Btn></div>
      </div>
    </div>
  );
}

export function ReportCard({ r, compact }: { r: any; compact?: boolean }) {
  const { t } = useT();
  return (
    <div>
      <div className="row between"><b>{r.kind === 'consult' ? t('consult') : t('visit')} · {niceTime(r.created_at)}</b><span className="small muted">{r.reporter_name}</span></div>
      <div className="row small vitals" style={{ marginTop: '.3rem' }}>
        <span><IonIcon icon={happyOutline} /> {r.mood || '-'}</span><span><IonIcon icon={pulseOutline} /> {t('bp')} {r.bp || '-'}</span><span><IonIcon icon={waterOutline} /> {t('glucose')} {r.glucose || '-'}</span><span><IonIcon icon={thermometerOutline} /> {r.temp || '-'}</span>
      </div>
      {r.photos?.length > 0 && <div className="photo-row view">{r.photos.map((u: string) => <a key={u} className="thumb" href={photoUrl(u)} target="_blank" rel="noreferrer"><img src={photoUrl(u)} alt="" /></a>)}</div>}
      {!compact && <div className="small stack" style={{ marginTop: '.4rem' }}>
        <div><b>{t('medsTaken')}：</b>{r.meds || '-'}</div><div><b>{t('dietSleep')}：</b>{r.diet_sleep || '-'}</div><div><b>{t('homeSafety')}：</b>{r.home_safety || '-'}</div><div><b>{t('requests')}：</b>{r.requests || '-'}</div>
      </div>}
      {r.follow_up && <div className="small" style={{ marginTop: '.3rem', color: 'var(--warn)' }}><b>{t('followUp')}：</b>{r.follow_up}</div>}
    </div>
  );
}

function Reports({ cid }: { cid: number }) {
  const { t } = useT();
  const { data } = useLoad<any[]>(`/reports?client_id=${cid}`, [], ['report']);
  if (!data) return <p className="muted">{t('loading')}</p>;
  if (!data.length) return <Empty />;
  return <div>{data.map(r => <div className="card" key={r.id}><ReportCard r={r} /></div>)}</div>;
}

export function AlertCard({ a, children }: { a: any; children?: any }) {
  const { t } = useT();
  return (
    <div className="card">
      <div className="row between"><b>{t('a_' + a.type)} · {a.client_name || ''}</b><Badge kind={a.status}>{t('as_' + a.status)}</Badge></div>
      <div className="small muted">{niceTime(a.created_at)} · {t('alertSource')}: {a.source} {a.severity && <>· <Badge kind={a.severity}>{t('severity' + a.severity[0].toUpperCase() + a.severity.slice(1))}</Badge></>}</div>
      {a.lat && a.status !== 'resolved' && <MapView alertAt={{ lat: a.lat, lng: a.lng, accuracy: a.accuracy, label: `${t('a_' + a.type)} ${niceTime(a.created_at)}` }} height={180} zoom={16} />}
      {a.lat && <a className="small" href={mapsLink(null, a.lat, a.lng)} target="_blank" rel="noreferrer">📍 {t('openMap')} · {a.lat.toFixed(5)}, {a.lng.toFixed(5)}{a.accuracy ? ` · ±${Math.round(a.accuracy)} m` : ''}</a>}
      {a.description && <p className="small" style={{ marginTop: '.3rem' }}>{a.description}</p>}
      <ul className="timeline" style={{ marginTop: '.6rem' }}>{(a.steps || []).map((s: any, i: number) => <li key={i}><span className="muted">{fmtTime(s.at).slice(5)}</span> {s.by}：{s.action === 'created' ? t('a_' + a.type) : s.action}</li>)}</ul>
      {a.outcome && <div className="success small">{t('outcome')}：{a.outcome}</div>}
      {children}
    </div>
  );
}

function Alerts({ cid }: { cid: number }) {
  const { t } = useT();
  const { data, reload } = useLoad<any[]>(`/alerts?client_id=${cid}`, [], ['alert']);
  const [busy, setBusy] = useState(false);
  const { Err, show } = useErr();
  async function raise() {
    if (!confirm(t('confirm') + '?')) return;
    setBusy(true);
    try { await api('/alerts', { body: { client_id: cid, type: 'other', source: 'family', description: 'Family raised from app' } }); reload(); } catch (e) { show(e); } finally { setBusy(false); }
  }
  return (
    <div>
      {Err}
      <div className="card row between"><span>{t('alerts')}</span><Btn v="danger sm" disabled={busy} onClick={raise}><IonIcon slot="start" icon={alertCircleOutline} />{t('sos')}</Btn></div>
      {!data?.length && <Empty />}
      {data?.map(a => <AlertCard key={a.id} a={a} />)}
    </div>
  );
}

function Bookings({ cid }: { cid: number }) {
  const { t } = useT();
  const { data, reload } = useLoad<any[]>(`/tasks?client_id=${cid}`, [], ['task']);
  const [type, setType] = useState('escort');
  const [when, setWhen] = useState(localDT(1, 9));
  const [notes, setNotes] = useState('');
  const [ok, setOk] = useState(false);
  const { Err, show } = useErr();
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await api('/tasks', { body: { client_id: cid, type, title: t('t_' + type), scheduled_at: when.replace('T', ' '), notes } }); setOk(true); setNotes(''); reload(); setTimeout(() => setOk(false), 4000); } catch (err) { show(err); }
  }
  async function cancelT(id: number) { if (confirm(t('cancelBooking') + '?')) { await api(`/tasks/${id}`, { method: 'PATCH', body: { status: 'cancelled' } }); reload(); } }
  return (
    <div>
      <div className="card"><h3>{t('newBooking')}</h3>{Err}{ok && <div className="success">{t('bookingCreated')}</div>}
        <form onSubmit={submit} className="form-grid">
          <Field label={t('bookingType')}><select value={type} onChange={e => setType(e.target.value)}>{TASK_TYPES.map(x => <option key={x} value={x}>{t('t_' + x)}</option>)}</select></Field>
          <Field label={t('bookingTime')}><input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} required /></Field>
          <Field label={t('bookingNotes')}><input value={notes} onChange={e => setNotes(e.target.value)} /></Field>
          <div className="field"><label>&nbsp;</label><Btn v="">{t('submit')}</Btn></div>
        </form>
      </div>
      <div className="card"><h3>{t('myBookings')}</h3>
        {!data?.length && <Empty />}
        <div className="list">{data?.map(x => <div key={x.id} className="row between"><span><b>{x.title}</b><div className="small muted">{niceTime(x.scheduled_at)} · {x.assignee_name || x.partner_name || ''} {x.fee ? `· RM${x.fee}` : ''}</div></span>
          <span className="row"><Badge kind={x.status}>{t('s_' + x.status)}</Badge>{['requested', 'assigned'].includes(x.status) && <Btn v="ghost sm" onClick={() => cancelT(x.id)}>{t('cancelBooking')}</Btn>}</span></div>)}</div>
      </div>
    </div>
  );
}

export function Chat({ cid }: { cid: number }) {
  const { t } = useT();
  const { user, onEvent } = useStore();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const load = () => api(`/messages?client_id=${cid}`).then(m => { setMsgs(m); setTimeout(() => box.current?.scrollTo(0, 1e9), 50); });
  useEffect(() => { load(); }, [cid]);
  useEffect(() => onEvent((ev, d) => { if (ev === 'message' && d?.client_id === cid) load(); }), [cid]);
  async function send(e: FormEvent) { e.preventDefault(); if (!text.trim()) return; await api('/messages', { body: { client_id: cid, text } }); setText(''); load(); }
  return (
    <div className="chat">
      <div className="msgs" ref={box}>
        {msgs.map(m => <div key={m.id} className={`msg ${m.kind === 'system' ? 'system' : m.sender_id === user?.id ? 'mine' : ''}`}><div className="who">{m.kind === 'system' ? t('system') : m.sender_name} · {niceTime(m.created_at)}</div>{m.text}</div>)}
      </div>
      <form onSubmit={send}><input value={text} onChange={e => setText(e.target.value)} placeholder={t('typeMessage')} /><Btn v="">{t('sendMessage')}</Btn></form>
    </div>
  );
}

function Profile({ cid }: { cid: number }) {
  const { t } = useT();
  const { data: c, reload } = useLoad<any>(`/clients/${cid}`);
  const [edit, setEdit] = useState(false);
  if (!c) return <p className="muted">{t('loading')}</p>;
  if (edit) return <ParentEdit c={c} onDone={() => { setEdit(false); reload(); }} />;
  const h = c.health || {};
  const rows: [string, any][] = [[t('conditions'), h.conditions], [t('meds'), h.meds], [t('allergies'), h.allergies], [t('doctor'), h.doctor], [t('mobility'), h.mobility], [t('langDiet'), [h.language, h.diet].filter(Boolean).join(' / ')], [t('healthNotes'), h.notes], [t('emergencyContact'), c.emergency_contact], [t('preferredHospital'), c.preferred_hospital], [t('watch'), c.watch_id], [t('plan'), `${t('plan_' + c.plan)} · RM${c.monthly_fee}/${t('perMonth').split(' ')[0] === 'RM' ? 'month' : '月'}`], [t('consent'), c.consent_at ? `✅ ${niceTime(c.consent_at)}` : '—']];
  return (
    <div>
      <div className="card"><div className="row between"><h3>{c.name} · {c.gender || ''} · {c.birth_year || ''}</h3>{c.verified === 0 && <Btn v="ghost sm" onClick={() => setEdit(true)}>{t('editParent')}</Btn>}</div><p className="small muted">{c.address}</p>
        <table className="tbl"><tbody>{rows.map(([k, v]) => <tr key={k}><th style={{ width: '38%' }}>{k}</th><td>{v || '-'}</td></tr>)}</tbody></table>
      </div>
      <ElderPhoneSetup clientId={cid} />
      <div className="card"><h3><IonIcon icon={peopleOutline} /> {t('familyMembers')}</h3><div className="list">{c.family?.map((f: any) => <div key={f.id} className="row between"><span>{f.name} <span className="muted small">{f.relation}</span></span><a className="small" href={telLink(f.phone)}>{f.phone}</a></div>)}</div></div>
    </div>
  );
}

function Payments({ cid }: { cid: number }) {
  const { t } = useT();
  const { data } = useLoad<any[]>(`/payments?client_id=${cid}`);
  if (!data) return <p className="muted">{t('loading')}</p>;
  const due = data.filter(p => p.status === 'due').reduce((s, p) => s + p.amount, 0);
  return (
    <div className="card"><div className="row between"><h3>{t('payments')}</h3><Badge kind={due ? 'due' : 'paid'}>{t('due')} RM {due}</Badge></div>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>{t('period')}</th><th>{t('item')}</th><th>{t('amount')}</th><th>{t('status')}</th></tr></thead>
        <tbody>{data.map(p => <tr key={p.id}><td>{p.period}</td><td>{p.item}</td><td>RM {p.amount}</td><td><Badge kind={p.status}>{t(p.status)}</Badge> {p.paid_at && <span className="small muted">{fmtTime(p.paid_at).slice(0, 10)}</span>}</td></tr>)}</tbody></table></div>
    </div>
  );
}

export function Team({ showPrice }: { showPrice?: boolean }) {
  const { t } = useT();
  const { data } = useLoad<any[]>('/partners');
  if (!data) return <p className="muted">{t('loading')}</p>;
  const groups = data.reduce((m: Record<string, any[]>, p) => { (m[p.type] ||= []).push(p); return m; }, {});
  return (
    <div>{Object.entries(groups).map(([type, list]) => (
      <div className="card" key={type}><h3>{t('p_' + type)}</h3>
        <div className="list">{list.map(p => <div key={p.id}>
          <div className="row between"><b>{p.name}</b><Badge kind={p.status}>{t(p.status)}</Badge></div>
          <div className="small muted">{p.contact_name} · {p.region} · {t('dutyHours')}: {p.duty_hours}</div>
          {p.license_no && p.license_no !== '-' && <div className="small"><IonIcon icon={imagesOutline} style={{ display: 'none' }} />🪪 {t('license')}: <b>{p.license_no}</b> · {p.license_body}</div>}
          {showPrice && p.price_note && <div className="small" style={{ color: 'var(--brand)' }}>💰 {p.price_note}</div>}
          {p.phone && <div className="row small" style={{ marginTop: '.2rem' }}><a href={telLink(p.phone)}><IonIcon icon={callOutline} /> {p.phone}</a></div>}
        </div>)}</div>
      </div>))}</div>
  );
}

/** 自己注册、但协调员还没关联到长者时显示 */
function Pending() {
  const { t } = useT();
  const { user, hotline, refreshMe } = useStore();
  const [busy, setBusy] = useState(false);
  useEffect(() => { const id = setInterval(() => { refreshMe(); }, 30000); return () => clearInterval(id); }, [refreshMe]);
  const msg = t('pendingWa').replace('{name}', user?.name || '').replace('{phone}', user?.phone || '');
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{t('appName')}</IonTitle>
        <IonButtons slot="end"><MeMenu /></IonButtons>
      </IonToolbar></IonHeader>
      <IonContent className="ion-padding">
        <div className="main" style={{ maxWidth: 560 }}>
          <div className="card pending-card">
            <div className="pending-ic"><IonIcon icon={timeOutline} /></div>
            <h2>{t('pendingTitle')}</h2>
            <p className="muted">{t('pendingIntro')}</p>
            <ul className="pending-steps">
              <li className="done"><IonIcon icon={checkmarkCircle} /> {t('stepCreated')} · {user?.name} · {user?.phone}</li>
              <li><IonIcon icon={ellipseOutline} /> {t('stepVerify')}</li>
              <li><IonIcon icon={ellipseOutline} /> {t('stepOpen')}</li>
            </ul>
            <div className="stack">
              <Btn v="ok block" href={waLink(hotline, msg)} target="_blank" rel="noreferrer"><IonIcon slot="start" icon={logoWhatsapp} />{t('contactNow')} · WhatsApp</Btn>
              <Btn v="block secondary" href={telLink(hotline)}><IonIcon slot="start" icon={callOutline} />{t('call')} +{hotline}</Btn>
              <Btn v="ghost block" disabled={busy} onClick={async () => { setBusy(true); await refreshMe(); setBusy(false); }}><IonIcon slot="start" icon={refreshOutline} />{t('checkAgain')}</Btn>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

/** 协调员确认前，子女可以修改自己建的父母档案 */
function ParentEdit({ c, onDone }: { c: any; onDone: () => void }) {
  const { t } = useT();
  const h = c.health || {};
  const [f, setF] = useState<any>({ name: c.name || '', gender: c.gender || '', birth_year: c.birth_year || '', address: c.address || '', region: c.region || '', emergency_contact: c.emergency_contact || '', preferred_hospital: c.preferred_hospital || '', conditions: h.conditions || '', meds: h.meds || '', allergies: h.allergies || '', mobility: h.mobility || '', language: h.language || '', notes: h.notes || '' });
  const { Err, show } = useErr();
  const S = (k: string) => ({ value: f[k], onChange: (e: any) => setF({ ...f, [k]: e.target.value }) });
  async function save(e: FormEvent) {
    e.preventDefault();
    const { conditions, meds, allergies, mobility, language, notes, ...basic } = f;
    try { await api(`/clients/${c.id}`, { method: 'PATCH', body: { ...basic, birth_year: Number(basic.birth_year) || null, health: { conditions, meds, allergies, mobility, language, notes } } }); onDone(); } catch (err) { show(err); }
  }
  return (
    <div className="card"><h3>{t('editParent')}</h3>{Err}
      <form onSubmit={save}><div className="form-grid">
        <Field label={t('name')}><input {...S('name')} required /></Field>
        <Field label={t('gender')}><select {...S('gender')}><option value="">—</option><option>女</option><option>男</option></select></Field>
        <Field label={t('birthYear')}><input inputMode="numeric" {...S('birth_year')} /></Field>
        <Field label={t('region')}><input {...S('region')} /></Field>
        <Field label={t('address')}><input {...S('address')} /></Field>
        <Field label={t('emergencyContact')}><input {...S('emergency_contact')} /></Field>
        <Field label={t('preferredHospital')}><input {...S('preferred_hospital')} /></Field>
        <Field label={t('conditions')}><input {...S('conditions')} /></Field>
        <Field label={t('meds')}><input {...S('meds')} /></Field>
        <Field label={t('allergies')}><input {...S('allergies')} /></Field>
        <Field label={t('mobility')}><input {...S('mobility')} /></Field>
        <Field label={t('language')}><input {...S('language')} /></Field>
        <Field label={t('healthNotes')}><input {...S('notes')} /></Field>
      </div><div className="row"><Btn v="">{t('save')}</Btn><Btn v="ghost" onClick={onDone}>{t('cancel')}</Btn></div></form>
    </div>
  );
}
