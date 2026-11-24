import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { IonApp, IonIcon } from '@ionic/react';
import { useState } from 'react';
import { fingerPrintOutline } from 'ionicons/icons';
import { bio } from './native';
import { startPush } from './push';
import { useT } from './i18n';
import { useStore } from './store';
import { isNative } from './api';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Elder from './pages/Elder';
import Family from './pages/Family';
import Coordinator from './pages/Coordinator';
import Caregiver from './pages/Caregiver';
import Legal from './pages/Legal';

const ROLE_HOME = { elder: '/app/elder', family: '/app/family', coordinator: '/app/coord', admin: '/app/coord', caregiver: '/app/caregiver' } as const;

function AppHome() {
  const { user, ready } = useStore();
  if (!ready) return <p style={{ padding: '2rem', textAlign: 'center' }}>…</p>;
  if (!user) return <Navigate to="/app/login" replace />;
  return <Navigate to={ROLE_HOME[user.role]} replace />;
}

function Guard({ role, children }: { role: string; children: JSX.Element }) {
  const { user, ready } = useStore();
  if (!ready) return <p style={{ padding: '2rem', textAlign: 'center' }}>…</p>;
  if (!user) return <Navigate to="/app/login" replace />;
  if (user.role !== role && !(role === 'coordinator' && user.role === 'admin')) return <Navigate to="/app" replace />;
  return children;
}

/** 开了指纹 / 面容解锁的人：打开 App 或离开超过 5 分钟后回来，要先验证（长者手机不锁） */
function BioGate({ children }: { children: JSX.Element }) {
  const { user, logout } = useStore();
  const { t } = useT();
  const need = () => Boolean(user && user.role !== 'elder' && bio.enabled());
  const [locked, setLocked] = useState(need());
  const tryUnlock = async () => { if (await bio.verify(t('bioReason'), t('bioTitle'))) setLocked(false); };
  useEffect(() => { setLocked(need()); }, [user?.id]);
  useEffect(() => { if (locked) tryUnlock(); }, [locked]);
  useEffect(() => {
    if (!isNative) return;
    let hiddenAt = 0;
    const h = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000 && need()) setLocked(true);
    });
    return () => { h.then(x => x.remove()); };
  }, [user?.id]);
  if (!locked) return children;
  return (
    <div className="bio-lock">
      <img src="/icon.svg" alt="" width={64} height={64} />
      <h2>{t('bioLocked')}</h2>
      <button className="bio-btn" onClick={tryUnlock}><IonIcon icon={fingerPrintOutline} /></button>
      <p className="muted">{t('bioUnlock')}</p>
      <a onClick={() => { bio.setEnabled(false); logout(); setLocked(false); }}>{t('usePassword')}</a>
    </div>
  );
}

function AppShell() {
  const { user } = useStore();
  const nav = useNavigate();
  useEffect(() => { if (user) startPush(p => nav(p)); }, [user?.id]);
  return (
    <IonApp><BioGate><>
      <Routes>
        <Route index element={<AppHome />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Login initialMode="register" />} />
        <Route path="apply" element={<Login initialMode="register" />} />
        <Route path="activate" element={<Login initialMode="activate" />} />
        <Route path="activate/:code" element={<Login />} />
        <Route path="elder" element={<Guard role="elder"><Elder /></Guard>} />
        <Route path="family" element={<Guard role="family"><Family /></Guard>} />
        <Route path="coord" element={<Guard role="coordinator"><Coordinator /></Guard>} />
        <Route path="caregiver" element={<Guard role="caregiver"><Caregiver /></Guard>} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </></BioGate></IonApp>
  );
}

export default function App() {
  const loc = useLocation();
  const nav = useNavigate();
  // 从 WhatsApp 点启用链接时，Android 会把链接交给 App
  useEffect(() => {
    if (!isNative) return;
    const h = CapApp.addListener('appUrlOpen', ({ url }) => { try { const u = new URL(url); if (u.pathname.startsWith('/app/')) nav(u.pathname, { replace: true }); } catch { /* ignore */ } });
    return () => { h.then(x => x.remove()); };
  }, [nav]);
  // 手机 App 里不显示宣传网站，直接进入应用
  if (isNative && (loc.pathname === '/' || loc.pathname === '')) return <Navigate to="/app" replace />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/legal" element={<Legal />} />
      <Route path="/app/*" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
