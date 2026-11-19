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
export function setApiBase(url: string) {
  if (url) localStorage.setItem(KEY_BASE, url.trim()); else localStorage.removeItem(KEY_BASE);
}
export function needsServerUrl() { return isNative && !getApiBase(); }
export { isNative };

export function getToken() { return localStorage.getItem(KEY_TOKEN) || ''; }
export function setToken(t: string) { if (t) localStorage.setItem(KEY_TOKEN, t); else localStorage.removeItem(KEY_TOKEN); }

export class ApiError extends Error { status: number; code: string; constructor(status: number, code: string) { super(code); this.status = status; this.code = code; } }

export async function api<T = any>(path: string, opts: { method?: string; body?: any; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const tok = getToken();
  if (opts.auth !== false && tok) headers.authorization = `Bearer ${tok}`;
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}/api${path}`, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  } catch {
    throw new ApiError(0, 'network');
  }
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
    for (const ev of ['alert', 'task', 'report', 'message']) {
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
