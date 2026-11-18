// 长者端：三个大按钮。紧急求助 → 定位 + 通知协调员与子女。
import { useEffect, useRef, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { callOutline, calendarOutline, logoWhatsapp, warningOutline } from 'ionicons/icons';
import { useT, LANGS } from '../i18n';
import { useStore } from '../store';
import { api, fmtTime, isNative } from '../api';
import { telLink, waLink, Btn } from '../components/ui';

type Sheet = null | 'sos' | 'find' | 'plan';

async function getPosition(): Promise<{ lat?: number; lng?: number }> {
  try {
    if (isNative) {
      const p = await Geolocation.requestPermissions().catch(() => null);
      if (!p || p.location === 'denied') return {};
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }
    return await new Promise(res => {
      if (!navigator.geolocation) return res({});
      navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res({}), { enableHighAccuracy: true, timeout: 8000 });
    });
  } catch { return {}; }
}

export default function Elder() {
  const { t, lang, setLang } = useT();
  const { user, hotline, logout, onEvent } = useStore();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [sosState, setSosState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [alertId, setAlertId] = useState<number | null>(null);
  const [alertStatus, setAlertStatus] = useState<string>('new');
  const [summary, setSummary] = useState<any>(null);
  const [hold, setHold] = useState(0);
  const holdTimer = useRef<number | null>(null);

  const load = () => user?.client_id && api(`/clients/${user.client_id}/summary`).then(setSummary).catch(() => {});
  useEffect(() => { load(); }, [user?.client_id]);
  useEffect(() => onEvent((ev, d) => {
    if (ev === 'alert' && d?.id === alertId) setAlertStatus(d.status);
    if (ev === 'alert' || ev === 'task') load();
  }), [alertId, user?.client_id]);

  async function sendSos() {
    setSheet('sos'); setSosState('sending');
    const pos = await getPosition();
    try {
      const a = await api('/alerts', { body: { type: 'sos', source: 'app', ...pos } });
      setAlertId(a.id); setAlertStatus('new'); setSosState('sent');
      try { navigator.vibrate?.([300, 100, 300]); } catch { /* ignore */ }
    } catch { setSosState('failed'); }
  }
  async function cancelSos() {
    if (alertId) { try { await api(`/messages`, { body: { text: `${user?.name}：我没事，取消求助。` } }); } catch { /* ignore */ } }
    setSheet(null); setSosState('idle');
  }

  // 按住两秒触发，避免误触
  function startHold() {
    if (holdTimer.current) return;
    const t0 = Date.now();
    holdTimer.current = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - t0) / 2000) * 100);
      setHold(p);
      if (p >= 100) { stopHold(); sendSos(); }
    }, 50);
  }
  function stopHold() { if (holdTimer.current) { clearInterval(holdTimer.current); holdTimer.current = null; } setHold(0); }

  const statusText: Record<string, string> = { new: t('sosSent'), acknowledged: `☎️ ${t('as_acknowledged')}`, dispatched: `🚗 ${t('as_dispatched')}`, resolved: `✅ ${t('as_resolved')}` };

  return (
    <IonPage><IonContent fullscreen><div className="elder">
      <div className="lang-row">
        {LANGS.map(l => <Btn key={l.id} v={`sm ${lang === l.id ? '' : 'ghost'}`} onClick={() => setLang(l.id)}>{l.label}</Btn>)}
        <Btn v="sm ghost" onClick={logout}>{t('logout')}</Btn>
      </div>
      <div className="hello">{t('elderHello')}，{summary?.client?.name || user?.name}</div>
      {summary?.openAlerts?.length > 0 && sheet !== 'sos' && (
        <div style={{ padding: '0 1.2rem' }}><div className="alert-banner">🚨 {t('openAlert')} · {statusText[summary.openAlerts[0].status]}</div></div>
      )}
      <div className="big-btns">
        <button className={`big sos ${hold > 0 ? 'holding' : ''}`}
          onPointerDown={startHold} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onContextMenu={e => e.preventDefault()}>
          <span className="big-ic"><IonIcon icon={warningOutline} /></span>{t('sos')}
          {hold > 0 ? <div className="progress"><div style={{ width: `${hold}%` }} /></div> : <span className="sub">{t('sosHint')}</span>}
        </button>
        <button className="big find" onClick={() => setSheet('find')}><IonIcon icon={callOutline} /> {t('findSomeone')}</button>
        <button className="big plan" onClick={() => { load(); setSheet('plan'); }}><IonIcon icon={calendarOutline} /> {t('todayPlan')}</button>
      </div>

      {sheet === 'sos' && (
        <div className="sheet">
          {sosState === 'sending' && <h2>⏳ {t('sosSending')}</h2>}
          {sosState === 'sent' && <><h2>{alertStatus === 'new' ? '✅ ' : ''}{statusText[alertStatus]}</h2><p>{t('sosSentHint')}</p></>}
          {sosState === 'failed' && <h2 style={{ color: 'var(--danger)' }}>⚠️ {t('sosFailed')}</h2>}
          <div className="stack" style={{ marginTop: '1rem' }}>
            <Btn v="block danger" href={telLink(hotline)}>📞 {t('callCenter')}</Btn>
            <Btn v="block ghost" onClick={cancelSos}>{t('cancelSos')}</Btn>
          </div>
        </div>
      )}
      {sheet === 'find' && (
        <div className="sheet">
          <h2>📞 {t('findSomeone')}</h2>
          <div className="stack">
            <Btn v="block" href={telLink(hotline)}>📞 {t('callCenter')}</Btn>
            <Btn v="block ok" href={waLink(hotline, `${user?.name}：我要找人`)} target="_blank" rel="noreferrer"><IonIcon slot="start" icon={logoWhatsapp} />{t('whatsapp')}</Btn>
            {summary?.client?.emergency_contact && <div className="plan-item"><b>{t('emergencyContact')}</b>{summary.client.emergency_contact}</div>}
            <Btn v="block ghost" onClick={() => setSheet(null)}>{t('close')}</Btn>
          </div>
        </div>
      )}
      {sheet === 'plan' && (
        <div className="sheet">
          <h2>📅 {t('todayPlan')}</h2>
          {!summary?.todayTasks?.length && <p>{t('noPlanToday')}</p>}
          {summary?.todayTasks?.map((x: any) => (
            <div className="plan-item" key={x.id}><b>{fmtTime(x.scheduled_at).slice(11)} · {x.title}</b>{t('withWho')}：{x.assignee_name || x.partner_name || t('roleCoordinator')} {x.status === 'done' ? '✅' : ''}</div>
          ))}
          {summary?.upcoming?.length > 0 && <><h3 style={{ marginTop: '1rem' }}>{t('upcoming')}</h3>
            {summary.upcoming.map((x: any) => <div className="plan-item" key={x.id}><b>{fmtTime(x.scheduled_at)}</b>{x.title}</div>)}</>}
          <Btn v="block ghost" style={{ marginTop: '1rem' }} onClick={() => setSheet(null)}>{t('close')}</Btn>
        </div>
      )}
    </div></IonContent></IonPage>
  );
}
