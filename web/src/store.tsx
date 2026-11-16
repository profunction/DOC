// 登录状态 + 实时事件。
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, setToken, getToken, subscribeEvents, type Handler } from './api';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './api';

export type Role = 'elder' | 'family' | 'coordinator' | 'caregiver';
export interface User { id: number; phone: string; name: string; role: Role; lang: string; client_id: number | null; region: string | null; }

interface Store {
  user: User | null; clientIds: number[]; hotline: string; ready: boolean;
  login: (phone: string, password: string) => Promise<User>;
  logout: () => void;
  onEvent: (h: Handler) => () => void;
  lastEvent: { event: string; data: any; n: number } | null;
  eventSeq: Record<string, number>;
}
const Ctx = createContext<Store>(null as any);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [clientIds, setClientIds] = useState<number[]>([]);
  const [hotline, setHotline] = useState('60123456789');
  const [ready, setReady] = useState(false);
  const [lastEvent, setLastEvent] = useState<Store['lastEvent']>(null);
  const [eventSeq, setEventSeq] = useState<Record<string, number>>({});
  const handlers = useRef(new Set<Handler>());
  const counter = useRef(0);

  const loadMe = useCallback(async () => {
    if (!getToken()) { setUser(null); setReady(true); return; }
    try {
      const me = await api('/me');
      setUser(me.user); setClientIds(me.client_ids); setHotline(me.hotline);
    } catch { setUser(null); }
    setReady(true);
  }, []);
  useEffect(() => { loadMe(); }, [loadMe]);

  useEffect(() => {
    if (!user) return;
    if (isNative) LocalNotifications.requestPermissions().catch(() => {});
    const off = subscribeEvents((event, data) => {
      counter.current += 1;
      setLastEvent({ event, data, n: counter.current });
      setEventSeq(seq => ({ ...seq, [event]: (seq[event] || 0) + 1 }));
      handlers.current.forEach(h => h(event, data));
      if (event === 'alert' && data.status === 'new' && (user.role === 'coordinator' || user.role === 'family')) {
        notify(`🚨 ${data.client_name || ''} 紧急求助`, '协调中心请马上处理 / Emergency alert');
      } else if (event === 'report' && user.role === 'family') {
        notify('📝 新探访报告 / New visit report', '点开查看详情');
      }
    });
    return off;
  }, [user]);

  const value = useMemo<Store>(() => ({
    user, clientIds, hotline, ready, lastEvent, eventSeq,
    login: async (phone, password) => {
      const r = await api('/auth/login', { body: { phone, password }, auth: false });
      setToken(r.token);
      await loadMe();
      return r.user;
    },
    logout: () => { setToken(''); setUser(null); setClientIds([]); },
    onEvent: (h) => { handlers.current.add(h); return () => handlers.current.delete(h); },
  }), [user, clientIds, hotline, ready, lastEvent, eventSeq, loadMe]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useStore = () => useContext(Ctx);

async function notify(title: string, body: string) {
  try {
    if (isNative) {
      await LocalNotifications.schedule({ notifications: [{ id: Date.now() % 100000, title, body, schedule: { at: new Date(Date.now() + 200) } }] });
    } else if ('Notification' in window) {
      if (Notification.permission === 'default') await Notification.requestPermission();
      if (Notification.permission === 'granted') new Notification(title, { body });
    }
  } catch { /* ignore */ }
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ }
}
