import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT, LANGS, type Lang } from '../i18n';
import { useStore } from '../store';
import { api, ApiError } from '../api';

export function LangSelect({ light }: { light?: boolean }) {
  const { lang, setLang } = useT();
  return (
    <select value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label="language" style={light ? undefined : { padding: '.3rem', borderRadius: 8 }}>
      {LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
    </select>
  );
}

export function Shell({ title, tabs, tab, onTab, children, right }: { title: string; tabs: { id: string; label: string; icon: string }[]; tab: string; onTab: (id: string) => void; children: ReactNode; right?: ReactNode }) {
  const { t } = useT();
  const { logout, user } = useStore();
  return (
    <div className="shell">
      <header className="topbar">
        <span className="title">{title}</span>
        <span className="small" style={{ opacity: .85 }}>{user?.name}</span>
        {right}
        <LangSelect light />
        <button className="btn" onClick={logout}>{t('logout')}</button>
      </header>
      <main className="main">
        <div className="tabs" role="tablist">
          {tabs.map(x => <button key={x.id} className={tab === x.id ? 'active' : ''} onClick={() => onTab(x.id)}>{x.icon} {x.label}</button>)}
        </div>
        {children}
      </main>
      <nav className="bottom-nav">
        {tabs.slice(0, 5).map(x => <button key={x.id} className={tab === x.id ? 'active' : ''} onClick={() => onTab(x.id)}><span className="ic">{x.icon}</span>{x.label}</button>)}
      </nav>
    </div>
  );
}

export function useErr() {
  const { t } = useT();
  const [err, setErr] = useState('');
  const show = (e: any) => {
    if (e instanceof ApiError) setErr(e.code === 'network' ? t('networkError') : e.code === 'bad_credentials' ? t('badCredentials') : e.code === 'forbidden' ? t('forbidden') : `${e.status} ${e.code}`);
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
