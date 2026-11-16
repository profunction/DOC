import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './store';
import { isNative } from './api';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Elder from './pages/Elder';
import Family from './pages/Family';
import Coordinator from './pages/Coordinator';
import Caregiver from './pages/Caregiver';
import Legal from './pages/Legal';

function AppHome() {
  const { user, ready } = useStore();
  if (!ready) return <p style={{ padding: '2rem', textAlign: 'center' }}>…</p>;
  if (!user) return <Navigate to="/app/login" replace />;
  const map = { elder: '/app/elder', family: '/app/family', coordinator: '/app/coord', caregiver: '/app/caregiver' } as const;
  return <Navigate to={map[user.role]} replace />;
}

function Guard({ role, children }: { role: string; children: JSX.Element }) {
  const { user, ready } = useStore();
  if (!ready) return <p style={{ padding: '2rem', textAlign: 'center' }}>…</p>;
  if (!user) return <Navigate to="/app/login" replace />;
  if (user.role !== role) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  const loc = useLocation();
  // 手机 App 里不显示宣传网站，直接进入应用
  if (isNative && (loc.pathname === '/' || loc.pathname === '')) return <Navigate to="/app" replace />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/legal" element={<Legal />} />
      <Route path="/app" element={<AppHome />} />
      <Route path="/app/login" element={<Login />} />
      <Route path="/app/elder" element={<Guard role="elder"><Elder /></Guard>} />
      <Route path="/app/family" element={<Guard role="family"><Family /></Guard>} />
      <Route path="/app/coord" element={<Guard role="coordinator"><Coordinator /></Guard>} />
      <Route path="/app/caregiver" element={<Guard role="caregiver"><Caregiver /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
