// 与后端沟通的封装：API 地址、JWT、SSE 实时事件。
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();
const KEY_BASE = 'anxin.apiBase';
const KEY_TOKEN = 'anxin.token';

export function getApiBase(): string {
  const saved = localStorage.getItem(KEY_BASE);
  if (saved) return saved.replace(/\/$/, '');
  if (isNative) return (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || '';
  return (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || '';
}
export function normalizeBase(url: string) {
  let u = url.trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = (/^(localhost|\d+\.\d+\.\d+\.\d+)(:\d+)?$/.test(u) ? 'http://' : 'https://') + u;
  return u;
}
export function setApiBase(url: string) {
  const u = normalizeBase(url);
  if (u) localStorage.setItem(KEY_BASE, u); else localStorage.removeItem(KEY_BASE);
}
/** 测试服务器是否可用：返回热线号码表示成功 */
export async function pingServer(base: string): Promise<string> {
  const u = normalizeBase(base);
  if (!u) throw new ApiError(0, 'no_server');
  let res: Response;
  try { res = await fetch(`${u}/api/public/info`, { headers: { accept: 'application/json' } }); } catch { throw new ApiError(0, 'network'); }
  if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) throw new ApiError(res.status, 'not_api');
  return (await res.json()).hotline;
}
export function needsServerUrl() { return isNative && !getApiBase(); }
export { isNative };

export function getToken() { return localStorage.getItem(KEY_TOKEN) || ''; }
export function setToken(t: string) { if (t) localStorage.setItem(KEY_TOKEN, t); else localStorage.removeItem(KEY_TOKEN); }

export class ApiError extends Error { status: number; code: string; constructor(status: number, code: string) { super(code); this.status = status; this.code = code; } }

export async function api<T = any>(path: string, opts: { method?: string; body?: any; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  const tok = getToken();
  if (opts.auth !== false && tok) headers.authorization = `Bearer ${tok}`;
  if (isNative && !getApiBase()) throw new ApiError(0, 'no_server');
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}/api${path}`, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (!(res.headers.get('content-type') || '').includes('application/json')) throw new ApiError(res.status, 'not_api');
  if (!res.ok) {
    let code = 'error';
    try { code = (await res.json()).error || code; } catch { /* ignore */ }
    if (res.status === 401) setToken('');
    throw new ApiError(res.status, code);
  }
  return res.json();
}

export type Handler = (event: string, data: any) => void;
/** 订阅实时事件（alert / task / report / message）。回传取消函数。 */
export function subscribeEvents(handler: Handler): () => void {
  const tok = getToken();
  if (!tok) return () => {};
  let es: EventSource | null = null;
  let closed = false;
  let retry = 2000;
  const open = () => {
    if (closed) return;
    es = new EventSource(`${getApiBase()}/api/events?token=${encodeURIComponent(tok)}`);
    for (const ev of ['alert', 'task', 'report', 'message', 'linked']) {
      es.addEventListener(ev, (e: MessageEvent) => { try { handler(ev, JSON.parse(e.data)); } catch { /* ignore */ } });
    }
    es.onopen = () => { retry = 2000; };
    es.onerror = () => { es?.close(); if (!closed) setTimeout(open, retry); retry = Math.min(retry * 2, 30000); };
  };
  open();
  return () => { closed = true; es?.close(); };
}

export function fmtTime(s?: string | null) {
  if (!s) return '-';
  return s.replace('T', ' ').slice(0, 16);
}
export function today() { return new Date().toISOString().slice(0, 10); }

/** 受保护的图片地址：<img> 无法带 Authorization，改用 token 查询参数 */
export function photoUrl(u: string) { return `${getApiBase()}${u}?token=${encodeURIComponent(getToken())}`; }

/** 把用户选的图片压到 1280px 以内的 JPEG data URL，减少流量 */
export function compressImage(file: File, max = 1280, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad_image')); };
    img.src = url;
  });
}

/** 友好时间：今天 14:00 / 明天 09:30 / 11月24日 周一 14:00（三语） */
export function niceTime(v?: string | null) {
  if (!v) return '-';
  const d = new Date(v.replace(' ', 'T'));
  if (isNaN(d.getTime())) return fmtTime(v);
  let lang = 'zh'; try { lang = localStorage.getItem('anxin.lang') || 'zh'; } catch { /* ignore */ }
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - day0.getTime()) / 86400000);
  const rel = { zh: ['昨天', '今天', '明天'], en: ['Yesterday', 'Today', 'Tomorrow'], ms: ['Semalam', 'Hari ini', 'Esok'] }[lang as 'zh'] || ['昨天', '今天', '明天'];
  if (diff >= -1 && diff <= 1) return `${rel[diff + 1]} ${hm}`;
  const wk = { zh: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ms: ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'] }[lang as 'zh'] || [];
  const md = lang === 'zh' ? `${d.getMonth() + 1}月${d.getDate()}日` : `${d.getDate()}/${d.getMonth() + 1}`;
  const yr = d.getFullYear() !== new Date().getFullYear() ? (lang === 'zh' ? `${d.getFullYear()}年` : `/${d.getFullYear()}`) : '';
  return lang === 'zh' ? `${yr}${md} ${wk[d.getDay()]} ${hm}` : `${wk[d.getDay()]} ${md}${yr} ${hm}`;
}
