// 照顾人：有今天的任务时，每 30 秒把位置传给服务器（子女和协调员的地图上看到 🚗）
import { Geolocation } from '@capacitor/geolocation';
import { api, isNative } from './api';

let timer: number | null = null;
let watchId: string | null = null;
let lastSent = 0;

async function send(lat: number, lng: number, accuracy?: number) {
  if (Date.now() - lastSent < 25000) return;
  lastSent = Date.now();
  try { await api('/me/location', { body: { lat, lng, accuracy } }); } catch { /* ignore */ }
}
export async function startLiveLocation() {
  if (timer || watchId) return;
  if (isNative) {
    try {
      const p = await Geolocation.requestPermissions(); if (p.location === 'denied') return;
      watchId = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 15000 }, pos => { if (pos) send(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy); });
    } catch { /* ignore */ }
  } else if (navigator.geolocation) {
    const tick = () => navigator.geolocation.getCurrentPosition(p => send(p.coords.latitude, p.coords.longitude, p.coords.accuracy), () => {}, { enableHighAccuracy: true, timeout: 15000 });
    tick(); timer = window.setInterval(tick, 30000);
  }
}
export function stopLiveLocation() {
  if (timer) { clearInterval(timer); timer = null; }
  if (watchId) { Geolocation.clearWatch({ id: watchId }).catch(() => {}); watchId = null; }
}
