// 照顾人端：我的任务、开始 / 完成、填探访报告、客人资料。
import { useState } from 'react';
import { listOutline, checkmarkDoneOutline, callOutline, navigateOutline, medkitOutline, chatbubblesOutline, playOutline, documentTextOutline, pinOutline } from 'ionicons/icons';
import { IonIcon } from '@ionic/react';
import { useT } from '../i18n';
import { useStore } from '../store';
import { api, fmtTime, today, niceTime } from '../api';
import { Shell, useLoad, Badge, Empty, telLink, waLink, mapsLink, useErr, Btn } from '../components/ui';
import { ReportForm } from './Coordinator';
import { Chat } from './Family';

export default function Caregiver() {
  const { t } = useT();
  const { hotline } = useStore();
  const [tab, setTab] = useState('tasks');
  const tabs = [{ id: 'tasks', label: t('myTasks'), icon: listOutline }, { id: 'history', label: t('s_done'), icon: checkmarkDoneOutline }];
  return (
    <Shell title={`${t('appName')} · ${t('roleCaregiver')}`} tabs={tabs} tab={tab} onTab={setTab}
      right={<Btn v="" href={telLink(hotline)}><IonIcon slot="icon-only" icon={callOutline} /></Btn>}>
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
  if (reportFor) return <div><Btn v="ghost sm" onClick={() => setReportFor(null)}>← {t('back')}</Btn><p className="muted small" style={{ margin: '.5rem 0' }}>{reportFor.client_name} · {reportFor.title}</p><ReportForm cid={reportFor.client_id} taskId={reportFor.id} onSaved={() => { setReportFor(null); reload(); }} /></div>;
  if (chatFor) return <div><Btn v="ghost sm" onClick={() => setChatFor(null)}>← {t('back')}</Btn><Chat cid={chatFor} /></div>;
  if (info) {
    const h = info.health || {};
    return <div><Btn v="ghost sm" onClick={() => setInfo(null)}>← {t('back')}</Btn>
      <div className="card" style={{ marginTop: '.5rem' }}><h3>{info.name}</h3><p className="small muted">{info.address}</p>
        <table className="tbl"><tbody>{[['conditions', h.conditions], ['meds', h.meds], ['allergies', h.allergies], ['mobility', h.mobility], ['langDiet', [h.language, h.diet].filter(Boolean).join(' / ')], ['healthNotes', h.notes], ['emergencyContact', info.emergency_contact], ['preferredHospital', info.preferred_hospital]].map(([k, v]) => <tr key={k as string}><th style={{ width: '35%' }}>{t(k as string)}</th><td>{v || '-'}</td></tr>)}</tbody></table>
        <div className="row small"><span>{t('familyMembers')}:</span>{info.family?.map((f: any) => <a key={f.id} href={telLink(f.phone)}>📞 {f.name}</a>)}</div></div></div>;
  }
  const Item = ({ x }: { x: any }) => (
    <div className="card">
      <div className="row between"><b>{niceTime(x.scheduled_at)} · {x.title}</b><Badge kind={x.status}>{t('s_' + x.status)}</Badge></div>
      <div>{x.client_name} <span className="small muted">· {x.address}</span></div>
      {x.notes && <div className="small muted"><IonIcon icon={pinOutline} /> {x.notes}</div>}
      <div className="row" style={{ marginTop: '.5rem' }}>
        <Btn v="sm ghost" href={mapsLink(x.address)} target="_blank" rel="noreferrer"><IonIcon slot="start" icon={navigateOutline} />{t('navigate')}</Btn>
        <Btn v="sm ghost" onClick={() => showInfo(x.client_id)}><IonIcon slot="start" icon={medkitOutline} />{t('clientInfo')}</Btn>
        <Btn v="sm ghost" onClick={() => setChatFor(x.client_id)}><IonIcon slot="start" icon={chatbubblesOutline} />{t('group')}</Btn>
        {x.status === 'assigned' && <Btn v="sm" onClick={() => start(x.id)}><IonIcon slot="start" icon={playOutline} />{t('start')}</Btn>}
        <Btn v="sm ok" onClick={() => setReportFor(x)}><IonIcon slot="start" icon={documentTextOutline} />{t('taskDone')}</Btn>
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
  return <div>{!data?.length && <Empty />}{data?.map(x => <div className="card" key={x.id}><div className="row between"><b>{x.title} · {x.client_name}</b><span className="small muted">{niceTime(x.scheduled_at)}</span></div></div>)}</div>;
}
