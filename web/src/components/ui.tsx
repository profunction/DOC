import { useEffect, useRef, useState, type ReactNode, type CSSProperties, type MouseEvent } from 'react';
import { IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonLabel, IonPage, IonSegment, IonSegmentButton, IonTabBar, IonTabButton, IonTitle, IonToolbar } from '@ionic/react';
import { logOutOutline } from 'ionicons/icons';
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

/** 应用外壳：Ionic 顶栏 + 分段标签 + 手机底部标签栏 */
export function Shell({ title, tabs, tab, onTab, children, right }: { title: string; tabs: Tab[]; tab: string; onTab: (id: string) => void; children: ReactNode; right?: ReactNode }) {
  const { logout, user } = useStore();
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <span className="topbar-user">{user?.name}</span>
            {right}
            <LangSelect light />
            <IonButton onClick={logout} title="logout"><IonIcon slot="icon-only" icon={logOutOutline} /></IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar className="sub" color="primary">
          <IonSegment scrollable value={tab} onIonChange={e => e.detail.value && onTab(String(e.detail.value))}>
            {tabs.map(x => <IonSegmentButton key={x.id} value={x.id}><IonIcon icon={x.icon} /><IonLabel>{x.label}</IonLabel></IonSegmentButton>)}
          </IonSegment>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">{children}</IonContent>
      <IonFooter>
        <IonTabBar selectedTab={tab}>
          {tabs.slice(0, 5).map(x => <IonTabButton key={x.id} tab={x.id} selected={tab === x.id} onClick={() => onTab(x.id)}><IonIcon icon={x.icon} /><IonLabel>{x.label}</IonLabel></IonTabButton>)}
        </IonTabBar>
      </IonFooter>
    </IonPage>
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
    if (e instanceof ApiError) setErr(e.code === 'network' ? t('networkError') : e.code === 'no_server' ? t('serverRequired') : e.code === 'not_api' ? t('notApi') : e.code === 'bad_credentials' ? t('badCredentials') : e.code === 'forbidden' ? t('forbidden') : `${e.status} ${e.code}`);
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
  return <span className={`badge ${map[kind || ''] || ''}`}>{children}</span>;
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
