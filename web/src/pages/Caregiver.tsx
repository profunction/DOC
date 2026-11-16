// 照顾人端：我的任务、开始 / 完成、填探访报告、客人资料。
import { useState } from 'react';
import { useT } from '../i18n';
import { useStore } from '../store';
import { api, fmtTime, today } from '../api';
import { Shell, useLoad, Badge, Empty, telLink, waLink, mapsLink, useErr } from '../components/ui';
import { ReportForm } from './Coordinator';
import { Chat } from './Family';

export default function Caregiver() {
  const { t } = useT();
  const { hotline } = useStore();
  const [tab, setTab] = useState('tasks');
  const tabs = [{ id: 'tasks', label: t('myTasks'), icon: '📋' }, { id: 'history', label: t('s_done'), icon: '✅' }];
  return (
    <Shell title={`${t('appName')} · ${t('roleCaregiver')}`} tabs={tabs} tab={tab} onTab={setTab}
      right={<a className="btn" href={telLink(hotline)}>📞</a>}>
      {tab === 'tasks' && <Tasks />}
      {tab === 'history' && <History />}
    </Shell>
  );
}

function Tasks() {
  const { t } = useT();
  const { data, reload } = useLoad<any[]>('/tasks?mine=1', [], ['task']);
  const [reportFor, setReportFor] = useState<any>(null);
  const [chatFor, setChatFor] = useState<number | null>(null);
  const [info, setInfo] = useState<any>(null);
  const { Err, show } = useErr();
  const open = (data || []).filter(x => ['assigned', 'in_progress'].includes(x.status)).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const todays = open.filter(x => x.scheduled_at.slice(0, 10) <= today());
  const later = open.filter(x => x.scheduled_at.slice(0, 10) > today());
  async function start(id: number) { try { await api(`/tasks/${id}`, { method: 'PATCH', body: { status: 'in_progress' } }); reload(); } catch (e) { show(e); } }
  async function showInfo(cid: number) { try { setInfo(await api(`/clients/${cid}`)); } catch (e) { show(e); } }
  if (reportFor) return <div><button className="btn ghost sm" onClick={() => setReportFor(null)}>← {t('back')}</button><p className="muted small" style={{ margin: '.5rem 0' }}>{reportFor.client_name} · {reportFor.title}</p><ReportForm cid={reportFor.client_id} taskId={reportFor.id} onSaved={() => { setReportFor(null); reload(); }} /></div>;
  if (chatFor) return <div><button className="btn ghost sm" onClick={() => setChatFor(null)}>← {t('back')}</button><Chat cid={chatFor} /></div>;
  if (info) {
    const h = info.health || {};
    return <div><button className="btn ghost sm" onClick={() => setInfo(null)}>← {t('back')}</button>
      <div className="card" style={{ marginTop: '.5rem' }}><h3>{info.name}</h3><p className="small muted">{info.address}</p>
        <table className="tbl"><tbody>{[['conditions', h.conditions], ['meds', h.meds], ['allergies', h.allergies], ['mobility', h.mobility], ['langDiet', [h.language, h.diet].filter(Boolean).join(' / ')], ['healthNotes', h.notes], ['emergencyContact', info.emergency_contact], ['preferredHospital', info.preferred_hospital]].map(([k, v]) => <tr key={k as string}><th style={{ width: '35%' }}>{t(k as string)}</th><td>{v || '-'}</td></tr>)}</tbody></table>
        <div className="row small"><span>{t('familyMembers')}:</span>{info.family?.map((f: any) => <a key={f.id} href={telLink(f.phone)}>📞 {f.name}</a>)}</div></div></div>;
  }
  const Item = ({ x }: { x: any }) => (
    <div className="card">
      <div className="row between"><b>{fmtTime(x.scheduled_at)} · {x.title}</b><Badge kind={x.status}>{t('s_' + x.status)}</Badge></div>
      <div>{x.client_name} <span className="small muted">· {x.address}</span></div>
      {x.notes && <div className="small muted">📌 {x.notes}</div>}
      <div className="row" style={{ marginTop: '.5rem' }}>
        <a className="btn sm ghost" href={mapsLink(x.address)} target="_blank" rel="noreferrer">🗺 {t('navigate')}</a>
        <button className="btn sm ghost" onClick={() => showInfo(x.client_id)}>🩺 {t('clientInfo')}</button>
        <button className="btn sm ghost" onClick={() => setChatFor(x.client_id)}>💬 {t('group')}</button>
        {x.status === 'assigned' && <button className="btn sm" onClick={() => start(x.id)}>▶ {t('start')}</button>}
        <button className="btn sm ok" onClick={() => setReportFor(x)}>📝 {t('taskDone')}</button>
      </div>
    </div>
  );
  return (
    <div>
      {Err}
      <h3>{t('today')}</h3>{!todays.length && <Empty />}{todays.map(x => <Item key={x.id} x={x} />)}
      <h3 style={{ marginTop: '1rem' }}>{t('upcoming')}</h3>{!later.length && <Empty />}{later.map(x => <Item key={x.id} x={x} />)}
    </div>
  );
}

function History() {
  const { t } = useT();
  const { data } = useLoad<any[]>('/tasks?mine=1&status=done');
  return <div>{!data?.length && <Empty />}{data?.map(x => <div className="card" key={x.id}><div className="row between"><b>{x.title} · {x.client_name}</b><span className="small muted">{fmtTime(x.scheduled_at)}</span></div></div>)}</div>;
}
