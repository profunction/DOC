// 协调员端：实时警报、客人、派单、报告、伙伴、付费与援助、账号。
import { useEffect, useState, type FormEvent } from 'react';
import { statsChartOutline, alertCircleOutline, gitBranchOutline, peopleCircleOutline, documentTextOutline, peopleOutline, cardOutline, businessOutline, personAddOutline, mailOpenOutline } from 'ionicons/icons';
import { useT } from '../i18n';
import { useStore } from '../store';
import { api, fmtTime, compressImage, getApiBase, niceTime } from '../api';
import { IonIcon } from '@ionic/react';
import { cameraOutline, calendarOutline, addOutline, watchOutline, logoWhatsapp, copyOutline, refreshOutline, settingsOutline, notificationsOutline, cloudDownloadOutline, callOutline, personAddOutline as personAddIcon, chevronForward } from 'ionicons/icons';
import { ElderPhoneSetup } from '../components/ElderPhoneSetup';
import { WatchPanel } from '../components/WatchPanel';
import { MapView } from '../components/MapView';
import { Shell, useLoad, Badge, Field, Empty, TASK_TYPES, ALERT_TYPES, PARTNER_TYPES, PLANS, telLink, waLink, mapsLink, localDT, useErr, Btn } from '../components/ui';
import { AlertCard, ReportCard, Chat, Team } from './Family';

export default function Coordinator() {
  const { t } = useT();
  const [tab, setTab] = useState('dashboard');
  const tabs = [
    { id: 'dashboard', label: t('dashboard'), icon: statsChartOutline }, { id: 'alerts', label: t('alerts'), icon: alertCircleOutline }, { id: 'dispatch', label: t('dispatch'), icon: gitBranchOutline },
    { id: 'clients', label: t('clients'), icon: peopleCircleOutline }, { id: 'reports', label: t('reports'), icon: documentTextOutline }, { id: 'partners', label: t('partners'), icon: peopleOutline },
    { id: 'money', label: t('payments'), icon: cardOutline }, { id: 'aid', label: t('aid'), icon: businessOutline }, { id: 'users', label: t('users'), icon: personAddOutline }, { id: 'enquiries', label: t('enquiries'), icon: mailOpenOutline }, { id: 'watch', label: t('watchTab'), icon: watchOutline }, { id: 'settings', label: t('settings'), icon: settingsOutline },
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
      {tab === 'settings' && <SettingsPage />}
      {tab === 'watch' && <WatchOverview />}
    </Shell>
  );
}

function Dashboard({ go }: { go: (t: string) => void }) {
  const { t } = useT();
  const { data: d } = useLoad<any>('/dashboard', [], ['alert', 'task', 'report', 'message']);
  const { data: open } = useLoad<any[]>('/alerts?status=open', [], ['alert']);
  const { data: clients, reload: reloadClients } = useLoad<any[]>('/clients', [], ['message']);
  const { data: requested } = useLoad<any[]>('/tasks?status=requested', [], ['task']);
  const { data: tasks } = useLoad<any[]>(`/tasks?from=${new Date().toISOString().slice(0, 10)}`, [], ['task']);
  if (!d) return <p className="muted">{t('loading')}</p>;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todays = (tasks || []).filter(x => x.scheduled_at.slice(0, 10) === todayStr && x.status !== 'cancelled').sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const unverified = (clients || []).filter(c => c.verified === 0);
  const nothing = !open?.length && !unverified.length && !requested?.length;
  const stats = [['clientsCount', d.clients], ['todayTasks', d.todayTasks], ['monthlyRevenue', `RM ${d.monthlyRevenue}`], ['dueTotal', `RM ${d.dueTotal}`]];
  return (
    <div>
      {open?.map(a => <div key={a.id} className="alert-banner" onClick={() => go('alerts')}>🚨 {a.client_name} · {t('a_' + a.type)} · {t('as_' + a.status)} · {niceTime(a.created_at)}</div>)}
      <div className="card"><h3>{t('todoTitle')}</h3>
        {nothing && <p className="muted">{t('noTodo')}</p>}
        <div className="list">
          {unverified.map(c => <div key={'u' + c.id} className="todo-row"><Badge kind="new">{t('unverifiedBadge')}</Badge><span className="grow"><b>{c.name}</b><div className="small muted">{c.emergency_contact}</div></span>
            <Btn v="ok sm" onClick={async () => { await api(`/clients/${c.id}`, { method: 'PATCH', body: { verified: 1 } }); reloadClients(); }}>{t('confirmService')}</Btn></div>)}
          {(requested || []).map(x => <div key={'r' + x.id} className="todo-row"><Badge kind="requested">{t('s_requested')}</Badge><span className="grow"><b>{x.title} · {x.client_name}</b><div className="small muted">{niceTime(x.scheduled_at)}</div></span>
            <Btn v="sm" onClick={() => go('dispatch')}>{t('assign')}<IonIcon slot="end" icon={chevronForward} /></Btn></div>)}
        </div>
      </div>
      <div className="card"><h3><IonIcon icon={calendarOutline} /> {t('todayTasks')}</h3>
        {!todays.length && <p className="muted">{t('none')}</p>}
        <div className="list">{todays.map(x => <div key={x.id} className="todo-row"><span className="time">{niceTime(x.scheduled_at).split(' ').pop()}</span><span className="grow"><b>{x.title}</b> · {x.client_name}<div className="small muted">{x.assignee_name || x.partner_name || t('s_requested')}</div></span><Badge kind={x.status}>{t('s_' + x.status)}</Badge></div>)}</div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
        {stats.map(([k, v]) => <div key={k as string} className="card stat"><div className="n">{v as any}</div><div className="l">{t(k as string)}</div></div>)}
      </div>
    </div>
  );
}

function WatchOverview() {
  const { t } = useT();
  const { data, reload } = useLoad<any[]>('/watch/overview', [], ['watch', 'alert']);
  const { data: clients } = useLoad<any[]>('/clients');
  const [sel, setSel] = useState<number | null>(null);
  if (sel) return <div><Btn v="ghost sm" onClick={() => { setSel(null); reload(); }}>← {t('back')}</Btn><h3 style={{ margin: '.6rem 0' }}>{clients?.find(c => c.id === sel)?.name}</h3><WatchPanel clientId={sel} canSimulate /></div>;
  return (
    <div>
      <div className="card row between"><span>{t('watchTab')} · {data?.length ?? 0}</span><div className="row"><select onChange={e => e.target.value && setSel(Number(e.target.value))} defaultValue=""><option value="">{t('client')} —</option>{clients?.map(c => <option key={c.id} value={c.id}>{c.name}{c.watch_id ? ' ⌚' : ''}</option>)}</select>
        <Btn v="ghost sm" onClick={async () => { await api('/watch/check-offline', { body: {} }); reload(); }}>{t('checkOfflineNow')}</Btn></div></div>
      <div className="card tbl-wrap"><table className="tbl"><thead><tr><th>{t('client')}</th><th>{t('watchId')}</th><th>{t('lastSeen')}</th><th>{t('battery')}</th><th>{t('status')}</th></tr></thead>
        <tbody>{data?.map(w => <tr key={w.id} style={{ cursor: 'pointer' }} onClick={() => setSel(w.id)}>
          <td><b>{w.name}</b></td><td className="small">{w.watch_id}</td><td className="small">{w.watch_last_seen ? niceTime(w.watch_last_seen) : '-'}{w.offline && w.watch_last_seen && <Badge kind="danger">offline</Badge>}</td>
          <td>{w.watch_battery != null ? <Badge kind={w.watch_battery <= w.low_battery ? 'danger' : 'ok'}>{w.watch_battery}%</Badge> : '-'}</td>
          <td>{w.watch_status === 'inside' ? <Badge kind="ok">{t('inSafeZone')}</Badge> : w.watch_status === 'outside' ? <Badge kind="danger">{t('outSafeZone')}</Badge> : <Badge kind="gray">{t('zoneUnknown')}</Badge>}</td>
        </tr>)}</tbody></table>{!data?.length && <Empty text={t('watchNone')} />}</div>
    </div>
  );
}

function SettingsPage() {
  const { t } = useT();
  const { data, reload } = useLoad<any>('/settings');
  const { data: dash } = useLoad<any>('/dashboard');
  const [f, setF] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const { Err, show } = useErr();
  useEffect(() => { if (data) setF({ hotline: data.hotline, ntfy_url: data.ntfy_url, ntfy_topic: data.ntfy_topic }); }, [data]);
  if (!data || !f) return <p className="muted">{t('loading')}</p>;
  const save = async () => { try { await api('/settings', { method: 'PUT', body: f }); setMsg(t('save') + ' ✓'); reload(); setTimeout(() => setMsg(''), 2000); } catch (e) { show(e); } };
  const gen = () => setF({ ...f, ntfy_topic: 'anxin-' + Array.from(crypto.getRandomValues(new Uint8Array(9))).map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('') });
  const test = async () => { await save(); try { const r = await api('/settings/test-push', { body: {} }); setMsg(r.ok ? t('pushOk') : t('pushFail')); } catch (e) { show(e); } };
  const base = getApiBase() || window.location.origin;
  return (
    <div>
      {Err}{msg && <div className="success">{msg}</div>}
      <div className="card"><h3><IonIcon icon={callOutline} /> {t('hotline')}</h3>
        <Field label={t('hotlineSetting')}><input inputMode="tel" value={f.hotline} onChange={e => setF({ ...f, hotline: e.target.value })} placeholder="60123456789" /></Field>
        <Btn v="" onClick={save}>{t('save')}</Btn></div>
      <div className="card"><h3><IonIcon icon={notificationsOutline} /> {t('ntfyTitle')}</h3>
        <p className="small muted">{t('ntfyHelp')}</p>
        <div className="form-grid">
          <Field label={t('ntfyServer')}><input value={f.ntfy_url} onChange={e => setF({ ...f, ntfy_url: e.target.value })} /></Field>
          <Field label={t('ntfyTopic')}><div className="row" style={{ flexWrap: 'nowrap' }}><input value={f.ntfy_topic} onChange={e => setF({ ...f, ntfy_topic: e.target.value })} style={{ flex: 1 }} /><Btn v="ghost sm" onClick={gen}>{t('genTopic')}</Btn></div></Field>
        </div>
        <div className="row"><Btn v="" onClick={save}>{t('save')}</Btn><Btn v="ghost" onClick={test} disabled={!f.ntfy_topic}>{t('testPush')}</Btn>
          {f.ntfy_topic && <a className="small" href={`${f.ntfy_url.replace(/\/$/, '')}/${f.ntfy_topic}`} target="_blank" rel="noreferrer">{f.ntfy_url.replace(/^https?:\/\//, '')}/{f.ntfy_topic}</a>}</div>
      </div>
      <div className="card"><h3>📱 Firebase</h3><p className="small muted">{dash?.integrations?.fcm ? '✅ ' + t('pushReady') : '⚠️ ' + t('pushNotConfigured')}</p></div>
      <div className="card"><h3><IonIcon icon={cloudDownloadOutline} /> {t('backupTitle')}</h3>
        <p className="small muted">{t('backupHelp')}</p>
        <Btn v="ghost sm" onClick={async () => { await api('/backups', { body: {} }); reload(); }}>{t('backupNow')}</Btn>
        <div className="list" style={{ marginTop: '.5rem' }}>{(data.backups || []).map((b: any) => <div key={b.file} className="row between small"><span>{b.file} · {(b.size / 1024).toFixed(0)} KB</span>
          <a href={`${base}/api/backups/${b.file}?token=${encodeURIComponent(localStorage.getItem('anxin.token') || '')}`} download>{t('download')}</a></div>)}</div>
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
        <div className="row"><Btn v={`sm ${filter === 'open' ? '' : 'ghost'}`} onClick={() => setFilter('open')}>{t('openAlerts')}</Btn><Btn v={`sm ${filter === 'all' ? '' : 'ghost'}`} onClick={() => setFilter('all')}>{t('all')}</Btn></div>
        <div className="row small">
          <select value={sim.client_id} onChange={e => setSim({ ...sim, client_id: Number(e.target.value) })}>{clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={sim.type} onChange={e => setSim({ ...sim, type: e.target.value })}>{ALERT_TYPES.map(x => <option key={x} value={x}>{t('a_' + x)}</option>)}</select>
          <Btn v="sm ghost" onClick={simulate}><IonIcon slot="start" icon={watchOutline} />{t('simulateWatch')}</Btn>
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
        <Btn v="sm" href={telLink(a.phone || '')} onClick={e => { if (!a.phone) e.preventDefault(); }}>📞 {t('call')} {a.client_name}</Btn>
        <Btn v="sm ghost" href={mapsLink(a.address, a.lat, a.lng)} target="_blank" rel="noreferrer">📍 {t('navigate')}</Btn>
        {a.preferred_hospital && <span className="badge gray">🏥 {a.preferred_hospital}</span>}
      </div>
      <div className="row" style={{ marginBottom: '.5rem' }}>
        {a.status === 'new' && <Btn v="sm" onClick={() => act({ status: 'acknowledged', action: t('acknowledge') })}>☎️ {t('acknowledge')}</Btn>}
        <Btn v="sm ghost" onClick={() => act({ status: 'dispatched', severity: 'mild', action: t('dispatchNurse') })}>👩‍⚕️ {t('dispatchNurse')}</Btn>
        <Btn v="sm ghost" onClick={() => act({ status: 'dispatched', severity: 'mild', action: t('dispatchCaregiver') })}>🚗 {t('dispatchCaregiver')}</Btn>
        <Btn v="sm danger" onClick={() => act({ status: 'dispatched', severity: 'severe', action: t('callAmbulance') })}>🚑 {t('callAmbulance')}</Btn>
        <Btn v="sm ghost" onClick={() => act({ status: 'resolved', severity: 'false', action: t('markFalse'), outcome: t('markFalse') })}>{t('markFalse')}</Btn>
      </div>
      <form className="row" onSubmit={e => { e.preventDefault(); if (step) act({ action: step }); }}>
        <input style={{ flex: 1, minWidth: 200, padding: '.5rem', border: '1px solid var(--line)', borderRadius: 8 }} value={step} onChange={e => setStep(e.target.value)} placeholder={t('stepPlaceholder')} />
        <Btn v="sm ghost">{t('addStep')}</Btn>
      </form>
      <form className="row" style={{ marginTop: '.4rem' }} onSubmit={e => { e.preventDefault(); act({ status: 'resolved', outcome, action: t('resolve') }); }}>
        <input style={{ flex: 1, minWidth: 200, padding: '.5rem', border: '1px solid var(--line)', borderRadius: 8 }} value={outcome} onChange={e => setOutcome(e.target.value)} placeholder={t('outcomePlaceholder')} required />
        <Btn v="sm ok">✅ {t('resolve')}</Btn>
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
        <div className="row">{['requested', 'assigned', 'in_progress', 'done', 'all'].map(s => <Btn key={s} v={`sm ${filter === s ? '' : 'ghost'}`} onClick={() => setFilter(s)}>{s === 'all' ? t('all') : t('s_' + s)}</Btn>)}</div>
        <Btn v="sm" onClick={() => setShow(s => !s)}><IonIcon slot="start" icon={addOutline} />{t('newTask')}</Btn>
      </div>
      {show && <div className="card"><form onSubmit={create} className="form-grid">
        <Field label={t('client')}><select value={form.client_id} onChange={e => setForm({ ...form, client_id: Number(e.target.value) })}>{clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label={t('type')}><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{TASK_TYPES.map(x => <option key={x} value={x}>{t('t_' + x)}</option>)}</select></Field>
        <Field label={t('time')}><input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} /></Field>
        <Field label={t('assignTo')}><select value={form.assignee_user_id} onChange={e => setForm({ ...form, assignee_user_id: e.target.value ? Number(e.target.value) : '' })}><option value="">—</option>{cgs?.map(u => <option key={u.id} value={u.id}>{u.name} ({u.region})</option>)}</select></Field>
        <Field label={t('partner')}><select value={form.partner_id} onChange={e => setForm({ ...form, partner_id: e.target.value ? Number(e.target.value) : '' })}><option value="">—</option>{partners?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label={t('fee')}><input type="number" value={form.fee} onChange={e => setForm({ ...form, fee: Number(e.target.value) })} /></Field>
        <Field label={t('notes')}><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="field"><label>&nbsp;</label><Btn v="">{t('save')}</Btn></div>
      </form></div>}
      {!data?.length && <Empty />}
      {data?.map(x => (
        <div className="card" key={x.id}>
          <div className="row between"><b>{x.title} · {x.client_name}</b><Badge kind={x.status}>{t('s_' + x.status)}</Badge></div>
          <div className="small muted">{niceTime(x.scheduled_at)} · {x.client_region} · {x.notes} {x.fee ? `· RM${x.fee}` : ''}</div>
          <div className="row small" style={{ marginTop: '.4rem' }}>
            <span>{t('assignTo')}:</span>
            <select value={x.assignee_user_id || ''} onChange={e => patch(x.id, { assignee_user_id: Number(e.target.value) || null })}><option value="">—</option>{cgs?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <select value={x.partner_id || ''} onChange={e => patch(x.id, { partner_id: Number(e.target.value) || null })}><option value="">{t('partner')} —</option>{partners?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            {x.status !== 'done' && x.status !== 'cancelled' && <Btn v="sm ok" onClick={() => patch(x.id, { status: 'done' })}>{t('markDone')}</Btn>}
            {x.status !== 'cancelled' && x.status !== 'done' && <Btn v="sm ghost" onClick={() => patch(x.id, { status: 'cancelled' })}>{t('cancel')}</Btn>}
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
      <div className="card row between"><span>{t('clients')} · {data?.length ?? 0}</span><Btn v="sm" onClick={() => setShowNew(s => !s)}><IonIcon slot="start" icon={addOutline} />{t('newClient')}</Btn></div>
      {showNew && <ClientForm onSaved={() => { setShowNew(false); reload(); }} />}
      <div className="grid">{data?.map(c => (
        <div className="card" key={c.id} onClick={() => setSel(c.id)} style={{ cursor: 'pointer' }}>
          <div className="row between"><b>{c.name}</b><span className="row">{c.verified === 0 && <Badge kind="new">{t('unverifiedBadge')}</Badge>}<Badge>{t('plan_' + c.plan)}</Badge></span></div>
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
  const [geo, setGeo] = useState(false);
  async function geocode() {
    if (!f.address) return; setGeo(true);
    try { const r = await api(`/geocode?q=${encodeURIComponent(f.address + (f.region ? ', ' + f.region : '') + ', Johor, Malaysia')}`); if (r.lat) setF({ ...f, lat: r.lat, lng: r.lng }); else show(new Error(t('geocodeNone'))); } catch (err) { show(err); } finally { setGeo(false); }
  }
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
          <div className="field"><label>&nbsp;</label><Btn v="ghost sm" onClick={geocode} disabled={geo}>{geo ? t('loading') : t('locateAddress')}</Btn></div>
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
        {f.lat && f.lng && <MapView center={{ lat: Number(f.lat), lng: Number(f.lng) }} home={{ lat: Number(f.lat), lng: Number(f.lng) }} onPick={p => setF({ ...f, lat: p.lat, lng: p.lng })} height={220} />}
        <Field label={t('notes')}><textarea {...S('notes')} /></Field>
        <label className="row small"><input type="checkbox" checked={!!f.consent || !!c?.consent_at} onChange={e => setF({ ...f, consent: e.target.checked })} /> {t('consent')} (PDPA)</label>
        <div className="row" style={{ marginTop: '.8rem' }}><Btn v="">{t('save')}</Btn></div>
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
      <div className="row between" style={{ marginBottom: '.7rem' }}><Btn v="ghost sm" onClick={back}>← {t('back')}</Btn>
        <div className="row"><Btn v={`sm ${sub === 'info' ? '' : 'ghost'}`} onClick={() => setSub('info')}>{t('profile')}</Btn><Btn v={`sm ${sub === 'chat' ? '' : 'ghost'}`} onClick={() => setSub('chat')}>{t('group')}</Btn><Btn v={`sm ${sub === 'report' ? '' : 'ghost'}`} onClick={() => setSub('report')}>{t('newReport')}</Btn></div></div>
      {Err}
      {sub === 'chat' && <Chat cid={id} />}
      {sub === 'report' && <ReportForm cid={id} onSaved={() => setSub('info')} />}
      {sub === 'info' && (edit ? <ClientForm c={c} onSaved={() => { setEdit(false); reload(); }} /> : (
        <>
          <div className="card">
            {c.verified === 0 && <div className="unverified-banner"><b>{t('unverifiedTitle')}</b><p>{c.emergency_contact}</p>
              <Btn v="ok sm" onClick={async () => { await api(`/clients/${id}`, { method: 'PATCH', body: { verified: 1 } }); reload(); }}>{t('confirmService')}</Btn></div>}
            <div className="row between"><h3>{c.name} · {c.gender || ''} · {c.birth_year || ''}</h3><div className="row"><Badge>{t('plan_' + c.plan)} RM{c.monthly_fee}</Badge><Btn v="sm ghost" onClick={() => setEdit(true)}>✏️ {t('edit')}</Btn></div></div>
            <p className="small muted">{c.address} · <a href={mapsLink(c.address, c.lat, c.lng)} target="_blank" rel="noreferrer">📍</a> · ⌚ {c.watch_id || '-'} · {t('consent')}: {c.consent_at ? '✅' : '❌'}</p>
            <table className="tbl"><tbody>
              {[['conditions', h.conditions], ['meds', h.meds], ['allergies', h.allergies], ['doctor', h.doctor], ['mobility', h.mobility], ['langDiet', [h.language, h.diet].filter(Boolean).join(' / ')], ['healthNotes', h.notes], ['emergencyContact', c.emergency_contact], ['preferredHospital', c.preferred_hospital], ['notes', c.notes]].map(([k, v]) => <tr key={k as string}><th style={{ width: '32%' }}>{t(k as string)}</th><td>{v || '-'}</td></tr>)}
            </tbody></table>
          </div>
          <ElderPhoneSetup clientId={id} />
          <div className="card"><h3><IonIcon icon={peopleOutline} /> {t('familyMembers')}</h3>
            <div className="list">{c.family?.map((f: any) => <div key={f.id} className="row between"><span>{f.name} <span className="muted small">{f.relation}</span></span><span className="row small"><a href={telLink(f.phone)}>📞 {f.phone}</a><a href={waLink(f.phone)} target="_blank" rel="noreferrer">💬</a></span></div>)}</div>
            <form onSubmit={link} className="row" style={{ marginTop: '.6rem' }}><input placeholder={t('familyPhone')} value={famPhone} onChange={e => setFamPhone(e.target.value)} style={{ padding: '.5rem', border: '1px solid var(--line)', borderRadius: 8 }} required /><input placeholder={t('relation')} value={rel} onChange={e => setRel(e.target.value)} style={{ padding: '.5rem', border: '1px solid var(--line)', borderRadius: 8, width: 100 }} /><Btn v="sm">{t('linkFamily')}</Btn></form>
          </div>
          {s && <div className="grid">
            <div className="card"><h3><IonIcon icon={calendarOutline} /> {t('today')} / {t('upcoming')}</h3><div className="list">{[...s.todayTasks, ...s.upcoming].map((x: any) => <div key={x.id} className="row between small"><span>{niceTime(x.scheduled_at)} {x.title} · {x.assignee_name || ''}</span><Badge kind={x.status}>{t('s_' + x.status)}</Badge></div>)}{!s.todayTasks.length && !s.upcoming.length && <Empty />}</div></div>
            <div className="card"><h3><IonIcon icon={documentTextOutline} /> {t('lastReport')}</h3>{s.lastReport ? <ReportCard r={s.lastReport} /> : <Empty />}</div>
          </div>}
        </>
      ))}
    </div>
  );
}

/** 点选按钮：点一下填入，也可以在下面的输入框补充 */
function Chips({ value, options, onPick }: { value: string; options: string[]; onPick: (v: string) => void }) {
  return <div className="chips">{options.map(o => <button type="button" key={o} className={value === o ? 'on' : ''} onClick={() => onPick(value === o ? '' : o)}>{o}</button>)}</div>;
}

export function ReportForm({ cid, taskId, onSaved }: { cid: number; taskId?: number; onSaved: () => void }) {
  const { t } = useT();
  const [f, setF] = useState<any>({ kind: 'visit', mood: '', bp: '', glucose: '', temp: '', meds: '', diet_sleep: '', home_safety: '', requests: '', follow_up: '' });
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { Err, show } = useErr();
  const S = (k: string) => ({ value: f[k], onChange: (e: any) => setF({ ...f, [k]: e.target.value }) });
  async function pick(e: any) {
    const files: File[] = Array.from(e.target.files || []);
    try { const out = await Promise.all(files.slice(0, 6).map(x => compressImage(x))); setPhotos(p => [...p, ...out].slice(0, 6)); } catch (err) { show(err); }
    e.target.value = '';
  }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api('/reports', { body: { ...f, client_id: cid, task_id: taskId } });
      for (const data of photos) await api(`/reports/${r.id}/photos`, { body: { data } });
      onSaved();
    } catch (err) { show(err); } finally { setBusy(false); }
  }
  return (
    <div className="card"><h3><IonIcon icon={documentTextOutline} /> {t('newReport')}</h3>{Err}
      <form onSubmit={save}>
        <div className="photo-row">
          {photos.map((p, i) => <span key={i} className="thumb"><img src={p} alt="" /><button type="button" onClick={() => setPhotos(ps => ps.filter((_, j) => j !== i))}>×</button></span>)}
          <label className="thumb add"><IonIcon icon={cameraOutline} /><span>{t('photos')}</span><input type="file" accept="image/*" capture="environment" multiple onChange={pick} hidden /></label>
        </div>
        <div className="form-grid">
        <Field label={t('reportKind')}><select {...S('kind')}><option value="visit">{t('visit')}</option><option value="consult">{t('consult')}</option></select></Field>
        <Field label={t('mood')}><Chips value={f.mood} options={[t('moodGood'), t('moodOk'), t('moodBad'), t('moodWatch')]} onPick={v => setF({ ...f, mood: v })} /><input {...S('mood')} /></Field><Field label={t('bp')}><input inputMode="numeric" {...S('bp')} placeholder="130/80" /></Field>
        <Field label={t('glucose')}><input {...S('glucose')} /></Field><Field label={t('temp')}><input {...S('temp')} /></Field>
        <Field label={t('medsTaken')}><Chips value={f.meds} options={[t('medsOnTime'), t('medsMissed'), t('medsNone'), t('medsNA')]} onPick={v => setF({ ...f, meds: v })} /><input {...S('meds')} /></Field>
        <Field label={t('dietSleep')}><Chips value={f.diet_sleep} options={[t('dietOk'), t('dietLess'), t('dietPoor')]} onPick={v => setF({ ...f, diet_sleep: v })} /><input {...S('diet_sleep')} /></Field>
        <Field label={t('homeSafety')}><Chips value={f.home_safety} options={[t('safeOk'), t('safeRisk')]} onPick={v => setF({ ...f, home_safety: v })} /><input {...S('home_safety')} /></Field><Field label={t('requests')}><input {...S('requests')} /></Field>
        <Field label={t('followUp')}><input {...S('follow_up')} /></Field>
      </div><Btn v="">{t('submit')}</Btn></form>
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
      <div className="card row between"><span>{t('reports')}</span><div className="row"><select value={cid} onChange={e => setCid(Number(e.target.value))}>{clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Btn v="sm" onClick={() => setShow(s => !s)}><IonIcon slot="start" icon={addOutline} />{t('newReport')}</Btn></div></div>
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
      <div className="card row between"><span>{t('partners')}</span><Btn v="sm" onClick={() => setShow(s => !s)}><IonIcon slot="start" icon={addOutline} />{t('newPartner')}</Btn></div>
      {show && <div className="card"><form onSubmit={save}><div className="form-grid">
        <Field label={t('type')}><select {...S('type')}>{PARTNER_TYPES.map(x => <option key={x} value={x}>{t('p_' + x)}</option>)}</select></Field>
        <Field label={t('name')}><input {...S('name')} required /></Field><Field label="联络人 / Contact"><input {...S('contact_name')} /></Field>
        <Field label={t('phone')}><input {...S('phone')} /></Field><Field label={t('license')}><input {...S('license_no')} /></Field><Field label={t('licenseBody')}><input {...S('license_body')} placeholder="MMC / 护士局 / 辅导员局" /></Field>
        <Field label={t('region')}><input {...S('region')} /></Field><Field label={t('dutyHours')}><input {...S('duty_hours')} /></Field><Field label="价钱 / Price"><input {...S('price_note')} /></Field><Field label={t('notes')}><input {...S('notes')} /></Field>
      </div><Btn v="">{t('save')}</Btn></form></div>}
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
        <div className="field"><label>&nbsp;</label><Btn v="">{t('save')}</Btn></div></form></div>
      <div className="card tbl-wrap"><table className="tbl"><thead><tr><th>{t('client')}</th><th>{t('period')}</th><th>{t('item')}</th><th>{t('amount')}</th><th>{t('status')}</th></tr></thead>
        <tbody>{data?.map(p => <tr key={p.id}><td>{p.client_name}</td><td>{p.period}</td><td>{p.item}</td><td>RM {p.amount}</td><td><Btn v={`sm ${p.status === 'paid' ? 'ok' : 'ghost'}`} onClick={() => toggle(p)}>{t(p.status)}</Btn></td></tr>)}</tbody></table></div>
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
        <div className="field"><label>&nbsp;</label><Btn v="">{t('save')}</Btn></div></form></div>
      {data?.map(a => <div className="card" key={a.id}><div className="row between"><b>{a.client_name} · {a.scheme}</b><Badge kind={a.status}>{t('aid_' + a.status)}</Badge></div>
        <div className="small muted">{a.agency} · {t('docs')}: {a.docs} · {a.notes}</div>
        <div className="row small" style={{ marginTop: '.4rem' }}>{['preparing', 'submitted', 'approved', 'rejected'].map(s => <Btn key={s} v={`sm ${a.status === s ? '' : 'ghost'}`} onClick={() => setStatus(a.id, s)}>{t('aid_' + s)}</Btn>)}</div></div>)}
    </div>
  );
}

/** 启用链接：协调员把它 WhatsApp 给顾客，顾客自己设密码 */
function inviteLink(code: string) {
  const base = getApiBase() || window.location.origin;
  return `${base}/app/activate/${code}`;
}
function InviteBox({ name, phone, code, onClose }: { name: string; phone: string; code: string; onClose: () => void }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const link = inviteLink(code);
  const apk = `${getApiBase() || window.location.origin}/downloads/anxin-care.apk`;
  const msg = t('inviteMsg').replace('{name}', name).replace('{link}', link).replace('{phone}', phone).replace('{apk}', apk);
  const pretty = code.replace(/(.{4})(.{4})(.{2})/, '$1-$2-$3');
  async function copy() { try { await navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }
  return (
    <div className="invite-box">
      <div className="row between"><b>{t('inviteReady')}：{name} · {phone}</b><Btn v="ghost sm" onClick={onClose}>{t('close')}</Btn></div>
      <div className="code">{pretty}</div>
      <div className="link">{link}</div>
      <div className="row">
        <Btn v="ok sm" href={waLink(phone, msg)} target="_blank" rel="noreferrer"><IonIcon slot="start" icon={logoWhatsapp} />{t('sendWhatsapp')}</Btn>
        <Btn v="ghost sm" onClick={copy}><IonIcon slot="start" icon={copyOutline} />{copied ? t('copied') : t('copyLink')}</Btn>
      </div>
      <p className="small muted" style={{ marginTop: '.5rem', marginBottom: 0 }}>{t('inviteHint')}</p>
    </div>
  );
}

function Users() {
  const { t } = useT();
  const { user: me } = useStore();
  const { data, reload } = useLoad<any[]>('/users');
  const { data: clients } = useLoad<any[]>('/clients');
  const [f, setF] = useState<any>({ phone: '', name: '', role: 'family', password: '', client_id: '', relation: '', region: '' });
  const [invite, setInvite] = useState<{ name: string; phone: string; code: string } | null>(null);
  const { Err, show } = useErr();
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api('/users', { body: { ...f, password: f.password || undefined, client_id: f.client_id ? Number(f.client_id) : null } });
      if (r.invite) setInvite({ name: f.name, phone: f.phone, code: r.invite });
      setF({ ...f, phone: '', name: '', password: '', relation: '' }); reload();
    } catch (err) { show(err); }
  }
  async function resend(u: any) { try { const r = await api(`/users/${u.id}/invite`, { method: 'POST', body: {} }); setInvite({ name: u.name, phone: u.phone, code: r.invite }); window.scrollTo?.(0, 0); } catch (err) { show(err); } }
  async function toggle(u: any) { try { await api(`/users/${u.id}`, { method: 'PATCH', body: { active: u.active ? 0 : 1 } }); reload(); } catch (err) { show(err); } }
  return (
    <div>
      {invite && <InviteBox {...invite} onClose={() => setInvite(null)} />}
      <div className="card"><h3><IonIcon icon={addOutline} /> {t('newUser')}</h3>{Err}<form onSubmit={add} className="form-grid">
        <Field label={t('role')}><select value={f.role} onChange={e => setF({ ...f, role: e.target.value })}><option value="family">{t('roleFamily')}</option><option value="elder">{t('roleElder')}</option><option value="caregiver">{t('roleCaregiver')}</option><option value="coordinator">{t('roleCoordinator')}</option></select></Field>
        <Field label={t('name')}><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label={t('phone')}><input inputMode="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} required /></Field>
        {(f.role === 'elder' || f.role === 'family') && <Field label={t('clientForElder')}><select value={f.client_id} onChange={e => setF({ ...f, client_id: e.target.value })} required><option value="">—</option>{clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
        {f.role === 'family' && <Field label={t('relation')}><input value={f.relation} onChange={e => setF({ ...f, relation: e.target.value })} /></Field>}
        {f.role === 'caregiver' && <Field label={t('region')}><input value={f.region} onChange={e => setF({ ...f, region: e.target.value })} /></Field>}
        <Field label={t('passwordOptional')}><input value={f.password} onChange={e => setF({ ...f, password: e.target.value })} minLength={6} /></Field>
        <div className="field"><label>&nbsp;</label><Btn v="">{t('save')}</Btn></div></form></div>
      <div className="card tbl-wrap"><table className="tbl"><thead><tr><th>{t('role')}</th><th>{t('name')}</th><th>{t('phone')}</th><th>{t('region')}</th><th>{t('actions')}</th></tr></thead>
        <tbody>{data?.map(u => <tr key={u.id} style={u.active ? undefined : { opacity: .5 }}>
          <td><Badge>{t('role' + u.role[0].toUpperCase() + u.role.slice(1))}</Badge></td><td>{u.name}</td><td>{u.phone}</td><td>{u.region || (u.client_id ? clients?.find(c => c.id === u.client_id)?.name || `#${u.client_id}` : '')}</td>
          <td><div className="row">{u.active ? <Btn v="ghost sm" onClick={() => resend(u)}><IonIcon slot="start" icon={refreshOutline} />{t('resendInvite')}</Btn> : null}
            {u.id !== me?.id && <Btn v="ghost sm" onClick={() => toggle(u)}>{u.active ? t('disableUser') : t('enableUser')}</Btn>}</div></td>
        </tr>)}</tbody></table></div>
    </div>
  );
}

function LinkRegistered({ e, clients, onDone }: { e: any; clients: any[]; onDone: () => void }) {
  const { t } = useT();
  const [cid, setCid] = useState(''); const [rel, setRel] = useState('');
  const { Err, show } = useErr();
  async function link() { if (!cid) return; try { await api(`/clients/${cid}/family`, { body: { user_id: e.user_id, relation: rel } }); onDone(); } catch (err) { show(err); } }
  return (
    <div style={{ marginTop: '.4rem' }}>{Err}
      <div className="row small">
        <select value={cid} onChange={x => setCid(x.target.value)}><option value="">{t('client')} —</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input placeholder={t('relation')} value={rel} onChange={x => setRel(x.target.value)} style={{ padding: '.4rem', border: '1px solid var(--line)', borderRadius: 8, width: 110 }} />
        <Btn v="sm" onClick={link} disabled={!cid}>{t('linkToClient')}</Btn>
      </div>
    </div>
  );
}

function Enquiries() {
  const { t } = useT();
  const { data, reload } = useLoad<any[]>('/enquiries');
  const { data: clients } = useLoad<any[]>('/clients');
  const { data: audit } = useLoad<any[]>('/audit');
  return (
    <div>
      <div className="card"><h3>{t('enquiries')}</h3>{!data?.length && <Empty />}<div className="list">{data?.map(e => <div key={e.id} style={e.status === 'done' ? { opacity: .55 } : undefined}>
        <div className="row between"><b>{e.name} · <a href={waLink(e.phone)} target="_blank" rel="noreferrer">{e.phone}</a></b><span className="row small muted"><Badge kind={e.status === 'done' ? 'done' : 'new'}>{e.status === 'done' ? t('handled') : t('pendingBadge')}</Badge><Badge kind={e.source === 'register' ? '' : 'gray'}>{e.source === 'register' ? t('registeredBadge') : e.source === 'app' ? 'App' : 'Web'}</Badge>{niceTime(e.created_at)}</span></div>
        <div className="small">{e.city} · {e.message}</div>
        {e.status !== 'done' && e.user_id && e.client_id && <div className="row small" style={{ marginTop: '.4rem' }}><Badge kind="new">{t('unverifiedBadge')}</Badge><span>{t('registeredParent')}：<b>{e.client_name}</b></span>
          <Btn v="ok sm" onClick={async () => { await api(`/clients/${e.client_id}`, { method: 'PATCH', body: { verified: 1 } }); reload(); }}>{t('confirmService')}</Btn></div>}
        {e.status !== 'done' && e.user_id && !e.client_id && <LinkRegistered e={e} clients={clients || []} onDone={reload} />}
        {e.status !== 'done' && !e.user_id && <Btn v="ghost sm" onClick={async () => { await api(`/enquiries/${e.id}`, { method: 'PATCH', body: { status: 'done' } }); reload(); }}>{t('markHandled')}</Btn>}
      </div>)}</div></div>
      <div className="card"><h3>{t('audit')}</h3><div className="tbl-wrap"><table className="tbl"><tbody>{audit?.slice(0, 50).map(a => <tr key={a.id}><td className="small muted">{niceTime(a.at)}</td><td>{a.user_name}</td><td>{a.action}</td><td>{a.target}</td></tr>)}</tbody></table></div></div>
    </div>
  );
}
