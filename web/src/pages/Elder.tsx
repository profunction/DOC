// 长者端：三个大按钮。紧急求助 → 定位 + 通知协调员与子女。
import { useEffect, useRef, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { callOutline, calendarOutline, logoWhatsapp, warningOutline } from 'ionicons/icons';
import { App as CapApp } from '@capacitor/app';
import { ElderMode } from '../native';
import { useT, LANGS } from '../i18n';
import { useStore } from '../store';
import { api, fmtTime, isNative, niceTime } from '../api';
import { telLink, waLink, Btn } from '../components/ui';

type Sheet = null | 'sos' | 'find' | 'plan' | 'setup';

async function getPosition(): Promise<{ lat?: number; lng?: number; accuracy?: number }> {
  try {
    if (isNative) {
      const p = await Geolocation.requestPermissions().catch(() => null);
      if (!p || p.location === 'denied') return {};
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy || 0) };
    }
    return await new Promise(res => {
      if (!navigator.geolocation) return res({});
      navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy || 0) }), () => res({}), { enableHighAccuracy: true, timeout: 8000 });
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
  const [lastPos, setLastPos] = useState<{ lat?: number; lng?: number; accuracy?: number }>({});
  const [summary, setSummary] = useState<any>(null);
  const [hold, setHold] = useState(0);
  const holdTimer = useRef<number | null>(null);

  const load = () => user?.client_id && api(`/clients/${user.client_id}/summary`).then(setSummary).catch(() => {});
  useEffect(() => { load(); }, [user?.client_id]);
  // ---- 家人用的隐藏设置：按住问候语 3 秒；第一次在长者手机启用后自动打开 ----
  const [mode, setMode] = useState<{ isHome: boolean; keepAwake: boolean }>({ isHome: false, keepAwake: false });
  const setupTimer = useRef<number | null>(null);
  const refreshMode = () => { if (isNative) ElderMode.status().then(setMode).catch(() => {}); };
  function startSetupHold() { if (!setupTimer.current) setupTimer.current = window.setTimeout(() => { setupTimer.current = null; refreshMode(); setSheet('setup'); }, 3000); }
  function stopSetupHold() { if (setupTimer.current) { clearTimeout(setupTimer.current); setupTimer.current = null; } }
  useEffect(() => {
    let first = false; try { first = localStorage.getItem('anxin.elderSetup') === '1'; localStorage.removeItem('anxin.elderSetup'); } catch { /* ignore */ }
    if (first) { refreshMode(); setSheet('setup'); }
    if (!isNative) return;
    // 返回键：只关闭弹出的画面，不会退出 App
    const h = CapApp.addListener('backButton', () => setSheet(null));
    const r = CapApp.addListener('resume', refreshMode);
    return () => { h.then(x => x.remove()); r.then(x => x.remove()); };
  }, []);

  useEffect(() => onEvent((ev, d) => {
    if (ev === 'alert' && d?.id === alertId) setAlertStatus(d.status);
    if (ev === 'alert' || ev === 'task') load();
  }), [alertId, user?.client_id]);

  async function sendSos() {
    setSheet('sos'); setSosState('sending');
    const pos = await getPosition(); setLastPos(pos);
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
      </div>
      <div className="hello" onPointerDown={startSetupHold} onPointerUp={stopSetupHold} onPointerLeave={stopSetupHold} onContextMenu={e => e.preventDefault()}>{t('elderHello')}，{summary?.client?.name || user?.name}</div>
      {summary?.openAlerts?.length > 0 && sheet !== 'sos' && (
        <div style={{ padding: '0 1.2rem' }}><div className="alert-banner">🚨 {t('openAlert')} · {statusText[summary.openAlerts[0].status]}</div></div>
      )}
      <div className="big-btns">
        <div className="sos-wrap">
          <span className="sos-ring r1" /><span className="sos-ring r2" />
          <button className={`big sos ${hold > 0 ? 'holding' : ''}`} style={{ '--p': `${hold}%` } as any}
            onPointerDown={startHold} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onContextMenu={e => e.preventDefault()}>
            <span className="sos-inner">
              <IonIcon icon={warningOutline} />
              <span className="sos-label">{t('sos')}</span>
              <span className="sub">{hold > 0 ? `${Math.ceil((100 - hold) / 50)}…` : t('sosHint')}</span>
            </span>
          </button>
        </div>
        <button className="big find" onClick={() => setSheet('find')}><span className="ic"><IonIcon icon={callOutline} /></span><span className="txt">{t('findSomeone')}<small>{t('callCenter')} · WhatsApp</small></span><span className="chev">›</span></button>
        <button className="big plan" onClick={() => { load(); setSheet('plan'); }}><span className="ic"><IonIcon icon={calendarOutline} /></span><span className="txt">{t('todayPlan')}<small>{summary?.todayTasks?.length ? `${t('today')} · ${summary.todayTasks.length}` : t('noPlanToday').split('。')[0]}</small></span><span className="chev">›</span></button>
      </div>

      {sheet === 'sos' && (
        <div className="sheet">
          {sosState === 'sending' && <h2>⏳ {t('sosSending')}</h2>}
          {sosState === 'sent' && <><h2>{alertStatus === 'new' ? '✅ ' : ''}{statusText[alertStatus]}</h2><p>{t('sosSentHint')}</p></>}
          {sosState === 'failed' && <><h2 style={{ color: 'var(--danger)' }}>⚠️ {t('sosFailed')}</h2><p>{t('sosOfflineHint')}</p></>}
          <div className="stack" style={{ marginTop: '1rem' }}>
            <Btn v="block danger" href={telLink(hotline)}>📞 {t('callCenter')}</Btn>
            {sosState === 'failed' && <Btn v="block" href={`sms:+${hotline}?body=${encodeURIComponent(`SOS ${user?.name}${lastPos.lat ? ` https://www.google.com/maps?q=${lastPos.lat},${lastPos.lng}` : ''}`)}`}>💬 {t('smsFallback')}</Btn>}
            {sosState === 'failed' && <Btn v="block ghost" onClick={sendSos}>{t('retry')}</Btn>}
            <Btn v="block ghost" onClick={cancelSos}>{t('cancelSos')}</Btn>
          </div>
        </div>
      )}
      {sheet === 'setup' && (
        <div className="sheet">
          <h2>{t('elderModeTitle')}</h2>
          {isNative ? <div className="stack">
            {mode.isHome && <div className="success">{t('isHomeYes')}</div>}
            <Btn v={`block ${mode.isHome ? 'ghost' : ''}`} onClick={async () => { await ElderMode.setHomeApp({ on: !mode.isHome }); }}>{mode.isHome ? t('unsetHome') : t('setAsHome')}</Btn>
            {!mode.isHome && <p className="small muted">{t('homeHint')}</p>}
            <Btn v="block ghost" onClick={async () => { await ElderMode.setKeepAwake({ on: !mode.keepAwake }); refreshMode(); }}>{mode.keepAwake ? t('keepAwakeOff') : t('keepAwake')}</Btn>
          </div> : <p className="muted">Android App</p>}
          <div className="stack" style={{ marginTop: '1rem' }}>
            <Btn v="block ghost" onClick={() => setSheet(null)}>{t('close')}</Btn>
            <Btn v="block danger" onClick={() => { if (window.confirm(t('logout') + '?')) logout(); }}>{t('logout')}</Btn>
          </div>
          <p className="small muted" style={{ marginTop: '.8rem' }}>{t('holdToOpen')}</p>
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
            {summary.upcoming.map((x: any) => <div className="plan-item" key={x.id}><b>{niceTime(x.scheduled_at)}</b>{x.title}</div>)}</>}
          <Btn v="block ghost" style={{ marginTop: '1rem' }} onClick={() => setSheet(null)}>{t('close')}</Btn>
        </div>
      )}
    </div></IonContent></IonPage>
  );
}
