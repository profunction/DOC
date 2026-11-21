import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { IonApp } from '@ionic/react';
import { useStore } from './store';
import { isNative } from './api';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Elder from './pages/Elder';
import Family from './pages/Family';
import Coordinator from './pages/Coordinator';
import Caregiver from './pages/Caregiver';
import Legal from './pages/Legal';

const ROLE_HOME = { elder: '/app/elder', family: '/app/family', coordinator: '/app/coord', caregiver: '/app/caregiver' } as const;

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
  if (user.role !== role) return <Navigate to="/app" replace />;
  return children;
}

function AppShell() {
  return (
    <IonApp>
      <Routes>
        <Route index element={<AppHome />} />
        <Route path="login" element={<Login />} />
        <Route path="apply" element={<Login initialMode="apply" />} />
        <Route path="activate" element={<Login initialMode="activate" />} />
        <Route path="activate/:code" element={<Login />} />
        <Route path="elder" element={<Guard role="elder"><Elder /></Guard>} />
        <Route path="family" element={<Guard role="family"><Family /></Guard>} />
        <Route path="coord" element={<Guard role="coordinator"><Coordinator /></Guard>} />
        <Route path="caregiver" element={<Guard role="caregiver"><Caregiver /></Guard>} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </IonApp>
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
