import { useEffect, useRef, useState, type ReactNode, type CSSProperties, type MouseEvent } from 'react';
import { IonActionSheet, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonLabel, IonPage, IonSegment, IonSegmentButton, IonTabBar, IonTabButton, IonTitle, IonToggle, IonToolbar } from '@ionic/react';
import { logOutOutline, keyOutline, personCircleOutline, ellipsisHorizontal, fingerPrintOutline, languageOutline } from 'ionicons/icons';
import { bio } from '../native';
import { isNative } from '../api';
import { IonModal } from '@ionic/react';
import { useT, LANGS, type Lang } from '../i18n';
import { useStore } from '../store';
import { api, ApiError } from '../api';

export function LangSelect({ light }: { light?: boolean }) {
  const { lang, setLang } = useT();
  return (
    <select className={`lang-select ${light ? 'light' : ''}`} value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label="language">
      {LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
    </select>
  );
}

export interface Tab { id: string; label: string; icon: string }

/** 应用外壳：顶栏只放标题和「我的」；电脑用顶部分段标签，手机用底部标签栏（超过 5 个时第 5 个是「更多」） */
export function Shell({ title, tabs, tab, onTab, children, right }: { title: string; tabs: Tab[]; tab: string; onTab: (id: string) => void; children: ReactNode; right?: ReactNode }) {
  const { t } = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  const main = tabs.length > 5 ? tabs.slice(0, 4) : tabs;
  const rest = tabs.length > 5 ? tabs.slice(4) : [];
  const inRest = rest.some(x => x.id === tab);
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">{right}<MeMenu /></IonButtons>
        </IonToolbar>
        <IonToolbar className="sub desktop-only" color="primary">
          <IonSegment scrollable value={tab} onIonChange={e => e.detail.value && onTab(String(e.detail.value))}>
            {tabs.map(x => <IonSegmentButton key={x.id} value={x.id}><IonIcon icon={x.icon} /><IonLabel>{x.label}</IonLabel></IonSegmentButton>)}
          </IonSegment>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <h2 className="page-title mobile-only">{tabs.find(x => x.id === tab)?.label}</h2>
        {children}
      </IonContent>
      <IonFooter className="mobile-only">
        <IonTabBar selectedTab={inRest ? '__more' : tab}>
          {main.map(x => <IonTabButton key={x.id} tab={x.id} selected={tab === x.id} onClick={() => onTab(x.id)}><IonIcon icon={x.icon} /><IonLabel>{x.label}</IonLabel></IonTabButton>)}
          {rest.length > 0 && <IonTabButton tab="__more" selected={inRest} onClick={() => setMoreOpen(true)}><IonIcon icon={ellipsisHorizontal} /><IonLabel>{inRest ? tabs.find(x => x.id === tab)?.label : t('more')}</IonLabel></IonTabButton>}
        </IonTabBar>
      </IonFooter>
      <IonActionSheet isOpen={moreOpen} onDidDismiss={() => setMoreOpen(false)} header={t('more')}
        buttons={[...rest.map(x => ({ text: x.label, icon: x.icon, handler: () => onTab(x.id) })), { text: t('cancel'), role: 'cancel' as const }]} />
    </IonPage>
  );
}

/** 「我的」：语言、修改密码、指纹 / 面容解锁、退出，全部收在一个按钮里 */
export function MeMenu() {
  const { t, lang, setLang } = useT();
  const { user, logout } = useStore();
  const [open, setOpen] = useState(false);
  const [bioOn, setBioOn] = useState(bio.enabled());
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => { if (open) bio.available().then(setBioOk); }, [open]);
  async function toggleBio(on: boolean) {
    if (on && !(await bio.verify(t('bioReason'), t('bioTitle')))) { setBioOn(false); return; }
    bio.setEnabled(on); setBioOn(on);
  }
  return (
    <>
      <IonButton onClick={() => setOpen(true)} title={t('me')}><IonIcon slot="icon-only" icon={personCircleOutline} /></IonButton>
      <IonModal isOpen={open} onDidDismiss={() => setOpen(false)} initialBreakpoint={0.6} breakpoints={[0, 0.6, 0.9]}>
        <div className="ion-padding me-menu">
          <div className="me-head"><IonIcon icon={personCircleOutline} /><div><b>{user?.name}</b><div className="small muted">{user?.phone}</div></div></div>
          <div className="me-row"><IonIcon icon={languageOutline} /><span>{t('language')}</span>
            <div className="row">{LANGS.map(l => <Btn key={l.id} v={`sm ${lang === l.id ? '' : 'ghost'}`} onClick={() => setLang(l.id)}>{l.label}</Btn>)}</div></div>
          {isNative && bioOk && <div className="me-row"><IonIcon icon={fingerPrintOutline} /><span>{t('bioUnlock')}</span><IonToggle checked={bioOn} onIonChange={e => toggleBio(e.detail.checked)} /></div>}
          <div className="me-row"><IonIcon icon={keyOutline} /><span>{t('changePassword')}</span><ChangePasswordButton light={false} /></div>
          <Btn v="danger block" onClick={() => { setOpen(false); bio.setEnabled(false); logout(); }}><IonIcon slot="start" icon={logOutOutline} />{t('logout')}</Btn>
        </div>
      </IonModal>
    </>
  );
}

/** 按钮：v 里写旧的修饰词（sm / ghost / secondary / danger / ok / block），映射到 IonButton */
export function Btn({ v = '', children, type, onClick, href, target, rel, disabled, style, className, title }: {
  v?: string; children?: ReactNode; type?: 'button' | 'submit' | 'reset'; onClick?: (e: MouseEvent<HTMLIonButtonElement>) => void; href?: string; target?: string; rel?: string; disabled?: boolean; style?: CSSProperties; className?: string; title?: string;
}) {
  const t = v.split(' ').filter(Boolean);
  const fill = t.includes('ghost') || t.includes('secondary') ? 'outline' : 'solid';
  const color = t.includes('danger') ? 'danger' : t.includes('ok') ? 'success' : t.includes('ghost') ? 'medium' : 'primary';
  return (
    <IonButton type={type ?? (onClick || href ? 'button' : 'submit')} fill={fill} color={color} size={t.includes('sm') ? 'small' : 'default'} expand={t.includes('block') ? 'block' : undefined}
      onClick={onClick} href={href} target={target} rel={rel} disabled={disabled} style={style} className={className} title={title}>{children}</IonButton>
  );
}

export function useErr() {
  const { t } = useT();
  const [err, setErr] = useState('');
  const show = (e: any) => {
    if (e instanceof ApiError) setErr(e.code === 'network' ? t('networkError') : e.code === 'no_server' ? t('serverRequired') : e.code === 'not_configured' ? t('notConfigured') : e.code === 'not_api' ? t('notApi') : e.code === 'bad_credentials' ? t('badCredentials') : e.code === 'invite_invalid' ? t('inviteInvalid') : e.code === 'password_too_short' ? t('passwordTooShort') : e.code === 'too_many_attempts' ? t('tooMany') : e.code === 'bad_old_password' ? t('badOldPassword') : e.code === 'phone_exists' ? t('phoneExists') : e.code === 'bad_phone' ? t('badPhone') : e.code === 'parent_required' ? t('parentRequired') : e.code === 'must_agree' ? t('mustAgree') : e.code === 'forbidden' ? t('forbidden') : `${e.status} ${e.code}`);
    else setErr(String(e?.message || e));
  };
  return { err, setErr, show, Err: err ? <div className="error">{err}</div> : null };
}

/** 简单资料载入 hook，支持依赖和实时刷新 */
export function useLoad<T>(path: string | null, deps: any[] = [], refreshOn?: string[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const { eventSeq } = useStore();
  const [tick, setTick] = useState(0);
  const seqKey = (refreshOn || []).map(e => eventSeq[e] || 0).join(',');
  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    api<T>(path).then(d => { if (alive) { setData(d); setError(null); } }).catch(e => alive && setError(e)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [path, tick, ...deps]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setTick(x => x + 1);
  }, [seqKey]);
  return { data, loading, error, reload: () => setTick(x => x + 1), setData };
}

export function Badge({ kind, children }: { kind?: string; children: ReactNode }) {
  const map: Record<string, string> = { new: 'danger', acknowledged: 'warn', dispatched: 'warn', resolved: 'ok', requested: 'warn', assigned: '', in_progress: 'warn', done: 'ok', cancelled: 'gray', due: 'warn', paid: 'ok', preparing: 'gray', submitted: 'warn', approved: 'ok', rejected: 'danger', active: 'ok', inactive: 'gray', mild: 'warn', severe: 'danger', false: 'gray' };
  const cls = map[kind || ''] ?? (['ok', 'warn', 'danger', 'gray'].includes(kind || '') ? kind : '');
  return <span className={`badge ${cls || ''}`}>{children}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

export function Empty({ text }: { text?: string }) { const { t } = useT(); return <p className="muted">{text || t('none')}</p>; }

export const TASK_TYPES = ['visit', 'meds', 'escort', 'physio', 'supplies', 'hourly', 'shopping', 'respite', 'other'];
export const ALERT_TYPES = ['sos', 'fall', 'heart', 'geofence', 'fever', 'other'];
export const PARTNER_TYPES = ['clinic', 'nurse', 'caregiver', 'physio', 'driver', 'ambulance', 'supplies', 'counsellor', 'nursing_home'];
export const PLANS = ['basic', 'standard', 'full', 'subsidised'];

export function waLink(phone: string, text?: string) {
  const p = phone.replace(/[^0-9]/g, '').replace(/^0/, '60');
  return `https://wa.me/${p}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
export function telLink(phone: string) { return `tel:${phone.replace(/[^0-9+]/g, '')}`; }
export function mapsLink(addr?: string | null, lat?: number | null, lng?: number | null) {
  if (lat && lng) return `https://www.google.com/maps?q=${lat},${lng}`;
  return `https://www.google.com/maps/search/${encodeURIComponent(addr || '')}`;
}
export function localDT(offsetDays = 0, h = 10) {
  const d = new Date(); d.setDate(d.getDate() + offsetDays); d.setHours(h, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 顶栏的"修改密码" */
export function ChangePasswordButton({ light = true }: { light?: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [oldPw, setOld] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [ok, setOk] = useState(false); const [busy, setBusy] = useState(false);
  const { Err, show, setErr } = useErr();
  async function save(e: any) {
    e.preventDefault(); setErr(''); setOk(false);
    if (pw !== pw2) { setErr(t('passwordMismatch')); return; }
    setBusy(true);
    try { await api('/me/password', { body: { old_password: oldPw, new_password: pw } }); setOk(true); setOld(''); setPw(''); setPw2(''); } catch (err) { show(err); } finally { setBusy(false); }
  }
  return (
    <>
      <IonButton onClick={() => { setOpen(true); setOk(false); setErr(''); }} title={t('changePassword')} color={light ? undefined : 'medium'} fill={light ? undefined : 'outline'} size={light ? undefined : 'small'}>
        <IonIcon slot={light ? 'icon-only' : 'start'} icon={keyOutline} />{light ? null : t('changePassword')}
      </IonButton>
      <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
        <div className="ion-padding" style={{ maxWidth: 460, margin: '0 auto', width: '100%' }}>
          <h2 style={{ marginTop: '1rem' }}>{t('changePassword')}</h2>
          {Err}{ok && <div className="success">{t('passwordChanged')}</div>}
          <form onSubmit={save}>
            <div className="field"><label>{t('oldPassword')}</label><input type="password" autoComplete="current-password" value={oldPw} onChange={e => setOld(e.target.value)} required /></div>
            <div className="field"><label>{t('newPassword')}</label><input type="password" autoComplete="new-password" minLength={6} value={pw} onChange={e => setPw(e.target.value)} required /></div>
            <div className="field"><label>{t('confirmPassword')}</label><input type="password" autoComplete="new-password" minLength={6} value={pw2} onChange={e => setPw2(e.target.value)} required /></div>
            <div className="row"><Btn v="" disabled={busy}>{t('save')}</Btn><Btn v="ghost" onClick={() => setOpen(false)}>{t('close')}</Btn></div>
          </form>
        </div>
      </IonModal>
    </>
  );
}
