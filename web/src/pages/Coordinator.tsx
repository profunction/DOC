// 协调员端：实时警报、客人、派单、报告、伙伴、付费与援助、账号。
import { useEffect, useState, type FormEvent } from 'react';
import { useT } from '../i18n';
import { useStore } from '../store';
import { api, fmtTime } from '../api';
import { Shell, useLoad, Badge, Field, Empty, TASK_TYPES, ALERT_TYPES, PARTNER_TYPES, PLANS, telLink, waLink, mapsLink, localDT, useErr } from '../components/ui';
import { AlertCard, ReportCard, Chat, Team } from './Family';

export default function Coordinator() {
  const { t } = useT();
  const [tab, setTab] = useState('dashboard');
  const tabs = [
    { id: 'dashboard', label: t('dashboard'), icon: '📊' }, { id: 'alerts', label: t('alerts'), icon: '🚨' }, { id: 'dispatch', label: t('dispatch'), icon: '🗂' },
    { id: 'clients', label: t('clients'), icon: '👵' }, { id: 'reports', label: t('reports'), icon: '📝' }, { id: 'partners', label: t('partners'), icon: '🤝' },
    { id: 'money', label: t('payments'), icon: '💳' }, { id: 'aid', label: t('aid'), icon: '🏛' }, { id: 'users', label: t('users'), icon: '👤' }, { id: 'enquiries', label: t('enquiries'), icon: '📥' },
  ];
  return (
    <Shell title={`${t('appName')} · ${t('roleCoordinator')}`} tabs={tabs} tab={tab} onTab={setTab}>
      {tab === 'dashboard' && <Dashboard go={setTab} />}
      {tab === 'alerts' && <Alerts />}
      {tab === 'dispatch' && <Dispatch />}
      {tab === 'clients' && <Clients />}
      {tab === 'reports' && <Reports />}
      {tab === 'partners' && <Partners />}
      {tab === 'money' && <Money />}
      {tab === 'aid' && <Aid />}
      {tab === 'users' && <Users />}
      {tab === 'enquiries' && <Enquiries />}
    </Shell>
  );
}

function Dashboard({ go }: { go: (t: string) => void }) {
  const { t } = useT();
  const { data: d } = useLoad<any>('/dashboard', [], ['alert', 'task', 'report']);
  const { data: open } = useLoad<any[]>('/alerts?status=open', [], ['alert']);
  if (!d) return <p className="muted">{t('loading')}</p>;
  const stats = [['clientsCount', d.clients], ['openAlerts', d.openAlerts, 'alert'], ['todayTasks', d.todayTasks], ['unassigned', d.unassigned], ['monthlyRevenue', `RM ${d.monthlyRevenue}`], ['dueTotal', `RM ${d.dueTotal}`], ['newEnquiries', d.newEnquiries]];
  return (
    <div>
      {open?.map(a => <div key={a.id} className="alert-banner" onClick={() => go('alerts')}>🚨 {a.client_name} · {t('a_' + a.type)} · {t('as_' + a.status)} · {fmtTime(a.created_at).slice(11)}</div>)}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
        {stats.map(([k, v, cls]) => <div key={k as string} className={`card stat ${cls || ''}`}><div className="n">{v as any}</div><div className="l">{t(k as string)}</div></div>)}
      </div>
    </div>
  );
}

function Alerts() {
  const { t } = useT();
  const [filter, setFilter] = useState('open');
  const { data, reload } = useLoad<any[]>(`/alerts${filter === 'open' ? '?status=open' : ''}`, [filter], ['alert']);
  const { data: clients } = useLoad<any[]>('/clients');
  const [sim, setSim] = useState({ client_id: 0, type: 'fall' });
  const { Err, show } = useErr();
  useEffect(() => { if (clients?.length && !sim.client_id) setSim(s => ({ ...s, client_id: clients[0].id })); }, [clients]);
  async function simulate() {
    try { const c = clients?.find(x => x.id === sim.client_id); await api('/alerts', { body: { client_id: sim.client_id, type: sim.type, source: 'watch', lat: c?.lat, lng: c?.lng, description: 'Watch alert (simulated)' } }); reload(); } catch (e) { show(e); }
  }
  return (
    <div>
      {Err}
      <div className="card row between">
        <div className="row"><button className={`btn sm ${filter === 'open' ? '' : 'ghost'}`} onClick={() => setFilter('open')}>{t('openAlerts')}</button><button className={`btn sm ${filter === 'all' ? '' : 'ghost'}`} onClick={() => setFilter('all')}>{t('all')}</button></div>
        <div className="row small">
          <select value={sim.client_id} onChange={e => setSim({ ...sim, client_id: Number(e.target.value) })}>{clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={sim.type} onChange={e => setSim({ ...sim, type: e.target.value })}>{ALERT_TYPES.map(x => <option key={x} value={x}>{t('a_' + x)}</option>)}</select>
          <button className="btn sm ghost" onClick={simulate}>⌚ {t('simulateWatch')}</button>
        </div>
      </div>
      {!data?.length && <Empty />}
      {data?.map(a => <AlertCard key={a.id} a={a}><AlertActions a={a} onDone={reload} /></AlertCard>)}
    </div>
  );
}

function AlertActions({ a, onDone }: { a: any; onDone: () => void }) {
  const { t } = useT();
  const [step, setStep] = useState('');
  const [outcome, setOutcome] = useState('');
  const { Err, show } = useErr();
  const act = async (body: any) => { try { await api(`/alerts/${a.id}`, { method: 'PATCH', body }); setStep(''); onDone(); } catch (e) { show(e); } };
  if (a.status === 'resolved') return null;
  return (
    <div style={{ marginTop: '.6rem' }}>
      {Err}
      <div className="row small" style={{ marginBottom: '.5rem' }}>
        <a className="btn sm" href={telLink(a.phone || '')} onClick={e => { if (!a.phone) e.preventDefault(); }}>📞 {t('call')} {a.client_name}</a>
        <a className="btn sm ghost" href={mapsLink(a.address, a.lat, a.lng)} target="_blank" rel="noreferrer">📍 {t('navigate')}</a>
        {a.preferred_hospital && <span className="badge gray">🏥 {a.preferred_hospital}</span>}
      </div>
      <div className="row" style={{ marginBottom: '.5rem' }}>
        {a.status === 'new' && <button className="btn sm" onClick={() => act({ status: 'acknowledged', action: t('acknowledge') })}>☎️ {t('acknowledge')}</button>}
        <button className="btn sm ghost" onClick={() => act({ status: 'dispatched', severity: 'mild', action: t('dispatchNurse') })}>👩‍⚕️ {t('dispatchNurse')}</button>
        <button className="btn sm ghost" onClick={() => act({ status: 'dispatched', severity: 'mild', action: t('dispatchCaregiver') })}>🚗 {t('dispatchCaregiver')}</button>
        <button className="btn sm danger" onClick={() => act({ status: 'dispatched', severity: 'severe', action: t('callAmbulance') })}>🚑 {t('callAmbulance')}</button>
        <button className="btn sm ghost" onClick={() => act({ status: 'resolved', severity: 'false', action: t('markFalse'), outcome: t('markFalse') })}>{t('markFalse')}</button>
      </div>
      <form className="row" onSubmit={e => { e.preventDefault(); if (step) act({ action: step }); }}>
        <input style={{ flex: 1, minWidth: 200, padding: '.5rem', border: '1px solid var(--line)', borderRadius: 8 }} value={step} onChange={e => setStep(e.target.value)} placeholder={t('stepPlaceholder')} />
        <button className="btn sm ghost">{t('addStep')}</button>
      </form>
      <form className="row" style={{ marginTop: '.4rem' }} onSubmit={e => { e.preventDefault(); act({ status: 'resolved', outcome, action: t('resolve') }); }}>
        <input style={{ flex: 1, minWidth: 200, padding: '.5rem', border: '1px solid var(--line)', borderRadius: 8 }} value={outcome} onChange={e => setOutcome(e.target.value)} placeholder={t('outcomePlaceholder')} required />
        <button className="btn sm ok">✅ {t('resolve')}</button>
      </form>
    </div>
  );
}

function Dispatch() {
  const { t } = useT();
  const [filter, setFilter] = useState('requested');
  const { data, reload } = useLoad<any[]>(`/tasks${filter === 'all' ? '' : `?status=${filter}`}`, [filter], ['task']);
  const { data: cgs } = useLoad<any[]>('/users?role=caregiver');
  const { data: partners } = useLoad<any[]>('/partners');
  const { data: clients } = useLoad<any[]>('/clients');
  const [form, setForm] = useState<any>({ client_id: 0, type: 'visit', scheduled_at: localDT(1, 10), notes: '', fee: 0, assignee_user_id: '', partner_id: '' });
  const [show, setShow] = useState(false);
  const { Err, show: showErr } = useErr();
  useEffect(() => { if (clients?.length && !form.client_id) setForm((f: any) => ({ ...f, client_id: clients[0].id })); }, [clients]);
  async function create(e: FormEvent) {
    e.preventDefault();
    try { await api('/tasks', { body: { ...form, title: t('t_' + form.type), scheduled_at: form.scheduled_at.replace('T', ' '), assignee_user_id: form.assignee_user_id || null, partner_id: form.partner_id || null } }); setShow(false); reload(); } catch (err) { showErr(err); }
  }
  const patch = async (id: number, body: any) => { try { await api(`/tasks/${id}`, { method: 'PATCH', body }); reload(); } catch (e) { showErr(e); } };
  return (
    <div>
      {Err}
      <div className="card row between">
        <div className="row">{['requested', 'assigned', 'in_progress', 'done', 'all'].map(s => <button key={s} className={`btn sm ${filter === s ? '' : 'ghost'}`} onClick={() => setFilter(s)}>{s === 'all' ? t('all') : t('s_' + s)}</button>)}</div>
        <button className="btn sm" onClick={() => setShow(s => !s)}>＋ {t('newTask')}</button>
      </div>
      {show && <div className="card"><form onSubmit={create} className="form-grid">
        <Field label={t('client')}><select value={form.client_id} onChange={e => setForm({ ...form, client_id: Number(e.target.value) })}>{clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label={t('type')}><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{TASK_TYPES.map(x => <option key={x} value={x}>{t('t_' + x)}</option>)}</select></Field>
        <Field label={t('time')}><input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} /></Field>
        <Field label={t('assignTo')}><select value={form.assignee_user_id} onChange={e => setForm({ ...form, assignee_user_id: e.target.value ? Number(e.target.value) : '' })}><option value="">—</option>{cgs?.map(u => <option key={u.id} value={u.id}>{u.name} ({u.region})</option>)}</select></Field>
        <Field label={t('partner')}><select value={form.partner_id} onChange={e => setForm({ ...form, partner_id: e.target.value ? Number(e.target.value) : '' })}><option value="">—</option>{partners?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label={t('fee')}><input type="number" value={form.fee} onChange={e => setForm({ ...form, fee: Number(e.target.value) })} /></Field>
        <Field label={t('notes')}><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="field"><label>&nbsp;</label><button className="btn">{t('save')}</button></div>
      </form></div>}
      {!data?.length && <Empty />}
      {data?.map(x => (
        <div className="card" key={x.id}>
          <div className="row between"><b>{x.title} · {x.client_name}</b><Badge kind={x.status}>{t('s_' + x.status)}</Badge></div>
          <div className="small muted">{fmtTime(x.scheduled_at)} · {x.client_region} · {x.notes} {x.fee ? `· RM${x.fee}` : ''}</div>
          <div className="row small" style={{ marginTop: '.4rem' }}>
            <span>{t('assignTo')}:</span>
            <select value={x.assignee_user_id || ''} onChange={e => patch(x.id, { assignee_user_id: Number(e.target.value) || null })}><option value="">—</option>{cgs?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <select value={x.partner_id || ''} onChange={e => patch(x.id, { partner_id: Number(e.target.value) || null })}><option value="">{t('partner')} —</option>{partners?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            {x.status !== 'done' && x.status !== 'cancelled' && <button className="btn sm ok" onClick={() => patch(x.id, { status: 'done' })}>{t('markDone')}</button>}
            {x.status !== 'cancelled' && x.status !== 'done' && <button className="btn sm ghost" onClick={() => patch(x.id, { status: 'cancelled' })}>{t('cancel')}</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

const HEALTH_KEYS = ['conditions', 'meds', 'allergies', 'doctor', 'mobility', 'language', 'diet', 'notes'];
function Clients() {
  const { t } = useT();
  const { data, reload } = useLoad<any[]>('/clients');
  const [sel, setSel] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  if (sel) return <ClientDetail id={sel} back={() => { setSel(null); reload(); }} />;
  return (
    <div>
      <div className="card row between"><span>{t('clients')} · {data?.length ?? 0}</span><button className="btn sm" onClick={() => setShowNew(s => !s)}>＋ {t('newClient')}</button></div>
      {showNew && <ClientForm onSaved={() => { setShowNew(false); reload(); }} />}
      <div className="grid">{data?.map(c => (
        <div className="card" key={c.id} onClick={() => setSel(c.id)} style={{ cursor: 'pointer' }}>
          <div className="row between"><b>{c.name}</b><Badge>{t('plan_' + c.plan)}</Badge></div>
          <div className="small muted">{c.region} · {c.birth_year} · ⌚ {c.watch_id || '-'}</div>
          <div className="small">{c.address}</div>
        </div>))}</div>
    </div>
  );
}

function ClientForm({ c, onSaved }: { c?: any; onSaved: () => void }) {
  const { t } = useT();
  const [f, setF] = useState<any>({ name: '', gender: '女', birth_year: 1950, address: '', region: '新山市区', lat: '', lng: '', plan: 'standard', monthly_fee: 450, emergency_contact: '', preferred_hospital: '', watch_id: '', notes: '', consent: false, ...(c || {}), health: { ...(c?.health || {}) } });
  const { Err, show } = useErr();
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      const body = { ...f, lat: f.lat ? Number(f.lat) : null, lng: f.lng ? Number(f.lng) : null };
      if (c) await api(`/clients/${c.id}`, { method: 'PATCH', body }); else await api('/clients', { body });
      onSaved();
    } catch (err) { show(err); }
  }
  const S = (k: string) => ({ value: f[k] ?? '', onChange: (e: any) => setF({ ...f, [k]: e.target.value }) });
  const H = (k: string) => ({ value: f.health[k] ?? '', onChange: (e: any) => setF({ ...f, health: { ...f.health, [k]: e.target.value } }) });
  return (
    <div className="card"><h3>{c ? t('editClient') : t('newClient')}</h3>{Err}
      <form onSubmit={save}>
        <div className="form-grid">
          <Field label={t('name')}><input {...S('name')} required /></Field>
          <Field label={t('gender')}><select {...S('gender')}><option>女</option><option>男</option></select></Field>
          <Field label={t('birthYear')}><input type="number" {...S('birth_year')} /></Field>
          <Field label={t('region')}><input {...S('region')} /></Field>
          <Field label={t('address')}><input {...S('address')} /></Field>
          <Field label={t('lat')}><input {...S('lat')} /></Field><Field label={t('lng')}><input {...S('lng')} /></Field>
          <Field label={t('plan')}><select {...S('plan')}>{PLANS.map(p => <option key={p} value={p}>{t('plan_' + p)}</option>)}</select></Field>
          <Field label={t('monthlyFee')}><input type="number" {...S('monthly_fee')} /></Field>
          <Field label={t('emergencyContact')}><input {...S('emergency_contact')} /></Field>
          <Field label={t('preferredHospital')}><input {...S('preferred_hospital')} /></Field>
          <Field label={t('watch')}><input {...S('watch_id')} /></Field>
        </div>
        <h3 className="small muted">{t('profile')}（🔒 AES-256）</h3>
        <div className="form-grid">
          {HEALTH_KEYS.map(k => <Field key={k} label={t({ conditions: 'conditions', meds: 'meds', allergies: 'allergies', doctor: 'doctor', mobility: 'mobility', language: 'language', diet: 'langDiet', notes: 'healthNotes' }[k] as string)}><input {...H(k)} /></Field>)}
        </div>
        <Field label={t('notes')}><textarea {...S('notes')} /></Field>
        <label className="row small"><input type="checkbox" checked={!!f.consent || !!c?.consent_at} onChange={e => setF({ ...f, consent: e.target.checked })} /> {t('consent')} (PDPA)</label>
        <div className="row" style={{ marginTop: '.8rem' }}><button className="btn">{t('save')}</button></div>
      </form>
    </div>
  );
}

function ClientDetail({ id, back }: { id: number; back: () => void }) {
  const { t } = useT();
  const { data: c, reload } = useLoad<any>(`/clients/${id}`);
  const { data: s } = useLoad<any>(`/clients/${id}/summary`, [], ['alert', 'task', 'report']);
  const [edit, setEdit] = useState(false);
  const [famPhone, setFamPhone] = useState(''); const [rel, setRel] = useState('');
  const [sub, setSub] = useState<'info' | 'chat' | 'report'>('info');
  const { Err, show } = useErr();
  if (!c) return <p className="muted">{t('loading')}</p>;
  async function link(e: FormEvent) { e.preventDefault(); try { await api(`/clients/${id}/family`, { body: { phone: famPhone, relation: rel } }); setFamPhone(''); reload(); } catch (err) { show(err); } }
  const h = c.health || {};
  return (
    <div>
      <div className="row between" style={{ marginBottom: '.7rem' }}><button className="btn ghost sm" onClick={back}>← {t('back')}</button>
        <div className="row"><button className={`btn sm ${sub === 'info' ? '' : 'ghost'}`} onClick={() => setSub('info')}>{t('profile')}</button><button className={`btn sm ${sub === 'chat' ? '' : 'ghost'}`} onClick={() => setSub('chat')}>{t('group')}</button><button className={`btn sm ${sub === 'report' ? '' : 'ghost'}`} onClick={() => setSub('report')}>{t('newReport')}</button></div></div>
      {Err}
      {sub === 'chat' && <Chat cid={id} />}
      {sub === 'report' && <ReportForm cid={id} onSaved={() => setSub('info')} />}
      {sub === 'info' && (edit ? <ClientForm c={c} onSaved={() => { setEdit(false); reload(); }} /> : (
        <>
          <div className="card">
            <div className="row between"><h3>{c.name} · {c.gender} · {c.birth_year}</h3><div className="row"><Badge>{t('plan_' + c.plan)} RM{c.monthly_fee}</Badge><button className="btn sm ghost" onClick={() => setEdit(true)}>✏️ {t('edit')}</button></div></div>
            <p className="small muted">{c.address} · <a href={mapsLink(c.address, c.lat, c.lng)} target="_blank" rel="noreferrer">📍</a> · ⌚ {c.watch_id || '-'} · {t('consent')}: {c.consent_at ? '✅' : '❌'}</p>
            <table className="tbl"><tbody>
              {[['conditions', h.conditions], ['meds', h.meds], ['allergies', h.allergies], ['doctor', h.doctor], ['mobility', h.mobility], ['langDiet', [h.language, h.diet].filter(Boolean).join(' / ')], ['healthNotes', h.notes], ['emergencyContact', c.emergency_contact], ['preferredHospital', c.preferred_hospital], ['notes', c.notes]].map(([k, v]) => <tr key={k as string}><th style={{ width: '32%' }}>{t(k as string)}</th><td>{v || '-'}</td></tr>)}
            </tbody></table>
          </div>
          <div className="card"><h3>{t('familyMembers')}</h3>
            <div className="list">{c.family?.map((f: any) => <div key={f.id} className="row between"><span>{f.name} <span className="muted small">{f.relation}</span></span><span className="row small"><a href={telLink(f.phone)}>📞 {f.phone}</a><a href={waLink(f.phone)} target="_blank" rel="noreferrer">💬</a></span></div>)}</div>
            <form onSubmit={link} className="row" style={{ marginTop: '.6rem' }}><input placeholder={t('familyPhone')} value={famPhone} onChange={e => setFamPhone(e.target.value)} style={{ padding: '.5rem', border: '1px solid var(--line)', borderRadius: 8 }} required /><input placeholder={t('relation')} value={rel} onChange={e => setRel(e.target.value)} style={{ padding: '.5rem', border: '1px solid var(--line)', borderRadius: 8, width: 100 }} /><button className="btn sm">{t('linkFamily')}</button></form>
          </div>
          {s && <div className="grid">
            <div className="card"><h3>📅 {t('today')} / {t('upcoming')}</h3><div className="list">{[...s.todayTasks, ...s.upcoming].map((x: any) => <div key={x.id} className="row between small"><span>{fmtTime(x.scheduled_at)} {x.title} · {x.assignee_name || ''}</span><Badge kind={x.status}>{t('s_' + x.status)}</Badge></div>)}{!s.todayTasks.length && !s.upcoming.length && <Empty />}</div></div>
            <div className="card"><h3>📝 {t('lastReport')}</h3>{s.lastReport ? <ReportCard r={s.lastReport} /> : <Empty />}</div>
          </div>}
        </>
      ))}
    </div>
  );
}

export function ReportForm({ cid, taskId, onSaved }: { cid: number; taskId?: number; onSaved: () => void }) {
  const { t } = useT();
  const [f, setF] = useState<any>({ kind: 'visit', mood: '', bp: '', glucose: '', temp: '', meds: '', diet_sleep: '', home_safety: '', requests: '', follow_up: '' });
  const { Err, show } = useErr();
  const S = (k: string) => ({ value: f[k], onChange: (e: any) => setF({ ...f, [k]: e.target.value }) });
  async function save(e: FormEvent) { e.preventDefault(); try { await api('/reports', { body: { ...f, client_id: cid, task_id: taskId } }); onSaved(); } catch (err) { show(err); } }
  return (
    <div className="card"><h3>{t('newReport')}</h3>{Err}
      <form onSubmit={save}><div className="form-grid">
        <Field label={t('reportKind')}><select {...S('kind')}><option value="visit">{t('visit')}</option><option value="consult">{t('consult')}</option></select></Field>
        <Field label={t('mood')}><input {...S('mood')} /></Field><Field label={t('bp')}><input {...S('bp')} placeholder="130/80" /></Field>
        <Field label={t('glucose')}><input {...S('glucose')} /></Field><Field label={t('temp')}><input {...S('temp')} /></Field>
        <Field label={t('medsTaken')}><input {...S('meds')} /></Field><Field label={t('dietSleep')}><input {...S('diet_sleep')} /></Field>
        <Field label={t('homeSafety')}><input {...S('home_safety')} /></Field><Field label={t('requests')}><input {...S('requests')} /></Field>
        <Field label={t('followUp')}><input {...S('follow_up')} /></Field>
      </div><button className="btn">{t('submit')}</button></form>
    </div>
  );
}

function Reports() {
  const { t } = useT();
  const { data } = useLoad<any[]>('/reports', [], ['report']);
  const { data: clients } = useLoad<any[]>('/clients');
  const [cid, setCid] = useState(0); const [show, setShow] = useState(false);
  useEffect(() => { if (clients?.length && !cid) setCid(clients[0].id); }, [clients]);
  return (
    <div>
      <div className="card row between"><span>{t('reports')}</span><div className="row"><select value={cid} onChange={e => setCid(Number(e.target.value))}>{clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn sm" onClick={() => setShow(s => !s)}>＋ {t('newReport')}</button></div></div>
      {show && cid > 0 && <ReportForm cid={cid} onSaved={() => setShow(false)} />}
      {data?.map(r => <div className="card" key={r.id}><div className="small muted">{r.client_name}</div><ReportCard r={r} /></div>)}
    </div>
  );
}

function Partners() {
  const { t } = useT();
  const [show, setShow] = useState(false);
  const [f, setF] = useState<any>({ type: 'clinic', name: '', contact_name: '', phone: '', license_no: '', license_body: '', region: '', duty_hours: '', price_note: '', notes: '' });
  const [tick, setTick] = useState(0);
  const { Err, show: showErr } = useErr();
  const S = (k: string) => ({ value: f[k], onChange: (e: any) => setF({ ...f, [k]: e.target.value }) });
  async function save(e: FormEvent) { e.preventDefault(); try { await api('/partners', { body: f }); setShow(false); setTick(x => x + 1); } catch (err) { showErr(err); } }
  return (
    <div>
      {Err}
      <div className="card row between"><span>{t('partners')}</span><button className="btn sm" onClick={() => setShow(s => !s)}>＋ {t('newPartner')}</button></div>
      {show && <div className="card"><form onSubmit={save}><div className="form-grid">
        <Field label={t('type')}><select {...S('type')}>{PARTNER_TYPES.map(x => <option key={x} value={x}>{t('p_' + x)}</option>)}</select></Field>
        <Field label={t('name')}><input {...S('name')} required /></Field><Field label="联络人 / Contact"><input {...S('contact_name')} /></Field>
        <Field label={t('phone')}><input {...S('phone')} /></Field><Field label={t('license')}><input {...S('license_no')} /></Field><Field label={t('licenseBody')}><input {...S('license_body')} placeholder="MMC / 护士局 / 辅导员局" /></Field>
        <Field label={t('region')}><input {...S('region')} /></Field><Field label={t('dutyHours')}><input {...S('duty_hours')} /></Field><Field label="价钱 / Price"><input {...S('price_note')} /></Field><Field label={t('notes')}><input {...S('notes')} /></Field>
      </div><button className="btn">{t('save')}</button></form></div>}
      <div key={tick}><Team showPrice /></div>
    </div>
  );
}

function Money() {
  const { t } = useT();
  const { data, reload } = useLoad<any[]>('/payments');
  const { data: clients } = useLoad<any[]>('/clients');
  const [f, setF] = useState<any>({ client_id: 0, period: new Date().toISOString().slice(0, 7), item: '', amount: 0 });
  useEffect(() => { if (clients?.length && !f.client_id) setF((x: any) => ({ ...x, client_id: clients[0].id })); }, [clients]);
  async function add(e: FormEvent) { e.preventDefault(); await api('/payments', { body: f }); setF({ ...f, item: '', amount: 0 }); reload(); }
  async function toggle(p: any) { await api(`/payments/${p.id}`, { method: 'PATCH', body: { status: p.status === 'paid' ? 'due' : 'paid' } }); reload(); }
  return (
    <div>
      <div className="card"><h3>＋ {t('add')}</h3><form onSubmit={add} className="form-grid">
        <Field label={t('client')}><select value={f.client_id} onChange={e => setF({ ...f, client_id: Number(e.target.value) })}>{clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label={t('period')}><input type="month" value={f.period} onChange={e => setF({ ...f, period: e.target.value })} /></Field>
        <Field label={t('item')}><input value={f.item} onChange={e => setF({ ...f, item: e.target.value })} required /></Field>
        <Field label={t('amount')}><input type="number" value={f.amount} onChange={e => setF({ ...f, amount: Number(e.target.value) })} /></Field>
        <div className="field"><label>&nbsp;</label><button className="btn">{t('save')}</button></div></form></div>
      <div className="card tbl-wrap"><table className="tbl"><thead><tr><th>{t('client')}</th><th>{t('period')}</th><th>{t('item')}</th><th>{t('amount')}</th><th>{t('status')}</th></tr></thead>
        <tbody>{data?.map(p => <tr key={p.id}><td>{p.client_name}</td><td>{p.period}</td><td>{p.item}</td><td>RM {p.amount}</td><td><button className={`btn sm ${p.status === 'paid' ? 'ok' : 'ghost'}`} onClick={() => toggle(p)}>{t(p.status)}</button></td></tr>)}</tbody></table></div>
    </div>
  );
}

const SCHEMES = ['Bantuan Warga Emas (BWE) – JKM', 'Bantuan Warga Emas Johor – 州政府', 'Rumah Seri Kenangan – JKM', '华人社团 / 庙宇慈善基金', '佛教慈济 / 善导会', 'PAWE 长者活动中心登记', '其他'];
function Aid() {
  const { t } = useT();
  const { data, reload } = useLoad<any[]>('/aid');
  const { data: clients } = useLoad<any[]>('/clients');
  const [f, setF] = useState<any>({ client_id: 0, scheme: SCHEMES[0], agency: 'JKM', docs: 'IC、收入证明、水电单', notes: '' });
  useEffect(() => { if (clients?.length && !f.client_id) setF((x: any) => ({ ...x, client_id: clients[0].id })); }, [clients]);
  async function add(e: FormEvent) { e.preventDefault(); await api('/aid', { body: f }); reload(); }
  async function setStatus(id: number, status: string) { await api(`/aid/${id}`, { method: 'PATCH', body: { status } }); reload(); }
  return (
    <div>
      <div className="card"><h3>＋ {t('newAid')}</h3><form onSubmit={add} className="form-grid">
        <Field label={t('client')}><select value={f.client_id} onChange={e => setF({ ...f, client_id: Number(e.target.value) })}>{clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label={t('scheme')}><select value={f.scheme} onChange={e => setF({ ...f, scheme: e.target.value })}>{SCHEMES.map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label={t('agency')}><input value={f.agency} onChange={e => setF({ ...f, agency: e.target.value })} /></Field>
        <Field label={t('docs')}><input value={f.docs} onChange={e => setF({ ...f, docs: e.target.value })} /></Field>
        <Field label={t('notes')}><input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="field"><label>&nbsp;</label><button className="btn">{t('save')}</button></div></form></div>
      {data?.map(a => <div className="card" key={a.id}><div className="row between"><b>{a.client_name} · {a.scheme}</b><Badge kind={a.status}>{t('aid_' + a.status)}</Badge></div>
        <div className="small muted">{a.agency} · {t('docs')}: {a.docs} · {a.notes}</div>
        <div className="row small" style={{ marginTop: '.4rem' }}>{['preparing', 'submitted', 'approved', 'rejected'].map(s => <button key={s} className={`btn sm ${a.status === s ? '' : 'ghost'}`} onClick={() => setStatus(a.id, s)}>{t('aid_' + s)}</button>)}</div></div>)}
    </div>
  );
}

function Users() {
  const { t } = useT();
  const { data, reload } = useLoad<any[]>('/users');
  const { data: clients } = useLoad<any[]>('/clients');
  const [f, setF] = useState<any>({ phone: '', name: '', role: 'family', password: '123456', client_id: '', relation: '', region: '' });
  const [ok, setOk] = useState('');
  const { Err, show } = useErr();
  async function add(e: FormEvent) { e.preventDefault(); try { await api('/users', { body: { ...f, client_id: f.client_id ? Number(f.client_id) : null } }); setOk(`${t('created')}: ${f.name}`); setF({ ...f, phone: '', name: '' }); reload(); } catch (err) { show(err); } }
  return (
    <div>
      <div className="card"><h3>＋ {t('newUser')}</h3>{Err}{ok && <div className="success">{ok}</div>}<form onSubmit={add} className="form-grid">
        <Field label={t('role')}><select value={f.role} onChange={e => setF({ ...f, role: e.target.value })}><option value="elder">{t('roleElder')}</option><option value="family">{t('roleFamily')}</option><option value="caregiver">{t('roleCaregiver')}</option><option value="coordinator">{t('roleCoordinator')}</option></select></Field>
        <Field label={t('name')}><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label={t('phone')}><input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} required /></Field>
        <Field label={t('password')}><input value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required /></Field>
        {(f.role === 'elder' || f.role === 'family') && <Field label={t('clientForElder')}><select value={f.client_id} onChange={e => setF({ ...f, client_id: e.target.value })}><option value="">—</option>{clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
        {f.role === 'family' && <Field label={t('relation')}><input value={f.relation} onChange={e => setF({ ...f, relation: e.target.value })} /></Field>}
        {f.role === 'caregiver' && <Field label={t('region')}><input value={f.region} onChange={e => setF({ ...f, region: e.target.value })} /></Field>}
        <div className="field"><label>&nbsp;</label><button className="btn">{t('save')}</button></div></form></div>
      <div className="card tbl-wrap"><table className="tbl"><thead><tr><th>{t('role')}</th><th>{t('name')}</th><th>{t('phone')}</th><th>{t('region')}</th></tr></thead>
        <tbody>{data?.map(u => <tr key={u.id}><td><Badge>{t('role' + u.role[0].toUpperCase() + u.role.slice(1))}</Badge></td><td>{u.name}</td><td>{u.phone}</td><td>{u.region || (u.client_id ? `#${u.client_id}` : '')}</td></tr>)}</tbody></table></div>
    </div>
  );
}

function Enquiries() {
  const { t } = useT();
  const { data } = useLoad<any[]>('/enquiries');
  const { data: audit } = useLoad<any[]>('/audit');
  return (
    <div>
      <div className="card"><h3>{t('enquiries')}</h3>{!data?.length && <Empty />}<div className="list">{data?.map(e => <div key={e.id}><div className="row between"><b>{e.name} · <a href={waLink(e.phone)} target="_blank" rel="noreferrer">{e.phone}</a></b><span className="small muted">{fmtTime(e.created_at)}</span></div><div className="small">{e.city} · {e.message}</div></div>)}</div></div>
      <div className="card"><h3>{t('audit')}</h3><div className="tbl-wrap"><table className="tbl"><tbody>{audit?.slice(0, 50).map(a => <tr key={a.id}><td className="small muted">{fmtTime(a.at)}</td><td>{a.user_name}</td><td>{a.action}</td><td>{a.target}</td></tr>)}</tbody></table></div></div>
    </div>
  );
}
