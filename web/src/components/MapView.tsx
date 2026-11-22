// 真实地图。有 Google Maps 钥匙（服务器 /public/info 下发）→ Google 地图；没有 → Leaflet + OpenStreetMap。
// 两种模式画同样的东西：家 + 安全范围圆圈、手表最后位置 + 误差圈、轨迹、警报位置、照顾人位置。
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api';

export interface MapPoint { lat: number; lng: number; accuracy?: number | null; label?: string }
export interface MapProps {
  center?: MapPoint | null; zoom?: number; last?: MapPoint | null; home?: MapPoint | null; radius?: number;
  trail?: MapPoint[]; alertAt?: MapPoint | null; caregiver?: MapPoint | null; onPick?: (p: { lat: number; lng: number }) => void; height?: number; className?: string;
}

let keyPromise: Promise<string> | null = null;
function googleKey(): Promise<string> {
  if (!keyPromise) keyPromise = api<{ google_maps_key?: string }>('/public/info', { auth: false }).then(r => r.google_maps_key || '').catch(() => '');
  return keyPromise;
}
let gLoader: Promise<any> | null = null;
function loadGoogle(key: string): Promise<any> {
  if ((window as any).google?.maps) return Promise.resolve((window as any).google.maps);
  if (!gLoader) gLoader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&language=zh-CN&region=MY&loading=async`;
    s.async = true; s.onload = () => resolve((window as any).google.maps); s.onerror = () => reject(new Error('google maps failed'));
    document.head.appendChild(s);
  });
  return gLoader;
}

export function MapView(props: MapProps) {
  const [mode, setMode] = useState<'osm' | 'google' | null>(null);
  useEffect(() => { let on = true; googleKey().then(k => on && setMode(k ? 'google' : 'osm')); return () => { on = false; }; }, []);
  if (mode === 'google') return <GoogleMap {...props} />;
  if (mode === 'osm') return <LeafletMap {...props} />;
  return <div className={`map-wrap ${props.className || ''}`}><div className="map" style={{ height: props.height || 260 }} /></div>;
}

const pin = (color: string, emoji = '') => L.divIcon({ className: 'pin', html: `<div class="pin-dot" style="background:${color}"><span>${emoji}</span></div>`, iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -26] });

function LeafletMap({ center, zoom = 15, last, home, radius = 0, trail = [], alertAt, caregiver, onPick, height = 260, className = '' }: MapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    layer.current = L.layerGroup().addTo(m); map.current = m;
    const c = center || last || home || alertAt || { lat: 1.4927, lng: 103.7414 };
    m.setView([c.lat, c.lng], zoom); setTimeout(() => m.invalidateSize(), 200);
    return () => { m.remove(); map.current = null; };
  }, []);
  useEffect(() => { const m = map.current; if (!m) return; m.off('click'); if (onPick) m.on('click', e => onPick({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) })); }, [onPick]);
  useEffect(() => {
    const m = map.current, g = layer.current; if (!m || !g) return;
    g.clearLayers(); const b: L.LatLngTuple[] = [];
    const acc = (p: MapPoint, color: string) => { if (p.accuracy && p.accuracy > 5) L.circle([p.lat, p.lng], { radius: p.accuracy, color, weight: 1, fillOpacity: .12 }).addTo(g); };
    if (home) { L.marker([home.lat, home.lng], { icon: pin('#0b5e55', '🏠') }).addTo(g); b.push([home.lat, home.lng]); if (radius > 0) L.circle([home.lat, home.lng], { radius, color: '#0b5e55', weight: 2, dashArray: '6 4', fillOpacity: .08 }).addTo(g); }
    if (trail.length > 1) L.polyline(trail.map(p => [p.lat, p.lng] as L.LatLngTuple), { color: '#1864ab', weight: 3, opacity: .8 }).addTo(g);
    if (last) { acc(last, '#d9480f'); L.marker([last.lat, last.lng], { icon: pin('#d9480f', '⌚') }).addTo(g).bindPopup(last.label || ''); b.push([last.lat, last.lng]); }
    if (alertAt) { acc(alertAt, '#d9480f'); L.marker([alertAt.lat, alertAt.lng], { icon: pin('#d9480f', '🚨') }).addTo(g).bindPopup(alertAt.label || ''); b.push([alertAt.lat, alertAt.lng]); }
    if (caregiver) { acc(caregiver, '#1864ab'); L.marker([caregiver.lat, caregiver.lng], { icon: pin('#1864ab', '🚗') }).addTo(g).bindPopup(caregiver.label || ''); b.push([caregiver.lat, caregiver.lng]); }
    if (b.length > 1) m.fitBounds(L.latLngBounds(b).pad(0.3), { maxZoom: 17 }); else if (b.length === 1) m.setView(b[0], Math.max(m.getZoom(), 15));
    setTimeout(() => m.invalidateSize(), 100);
  }, [home?.lat, home?.lng, radius, last?.lat, last?.lng, alertAt?.lat, alertAt?.lng, caregiver?.lat, caregiver?.lng, trail.length]);
  return <div className={`map-wrap ${className}`}><div ref={el} className="map" style={{ height }} /></div>;
}

function GoogleMap({ center, zoom = 15, last, home, radius = 0, trail = [], alertAt, caregiver, onPick, height = 260, className = '' }: MapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const objs = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let on = true;
    googleKey().then(loadGoogle).then(gm => {
      if (!on || !el.current || map.current) return;
      const c = center || last || home || alertAt || { lat: 1.4927, lng: 103.7414 };
      map.current = new gm.Map(el.current, { center: c, zoom, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false });
      setReady(true);
    }).catch(() => {});
    return () => { on = false; };
  }, []);
  useEffect(() => { const m = map.current; if (!m) return; (window as any).google.maps.event.clearListeners(m, 'click'); if (onPick) m.addListener('click', (e: any) => onPick({ lat: +e.latLng.lat().toFixed(6), lng: +e.latLng.lng().toFixed(6) })); }, [onPick, ready]);
  useEffect(() => {
    const m = map.current; if (!m || !ready) return;
    const gm = (window as any).google.maps;
    objs.current.forEach(o => o.setMap(null)); objs.current = [];
    const bounds = new gm.LatLngBounds(); let n = 0;
    const mk = (p: MapPoint, color: string, emoji: string) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42"><path d="M17 41C17 41 3 24 3 15a14 14 0 0 1 28 0c0 9-14 26-14 26z" fill="${color}" stroke="#fff" stroke-width="2"/><text x="17" y="20" font-size="14" text-anchor="middle">${emoji}</text></svg>`;
      objs.current.push(new gm.Marker({ map: m, position: p, title: p.label || '', icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), scaledSize: new gm.Size(34, 42), anchor: new gm.Point(17, 41) } }));
      if (p.accuracy && p.accuracy > 5) objs.current.push(new gm.Circle({ map: m, center: p, radius: p.accuracy, strokeColor: color, strokeWeight: 1, fillColor: color, fillOpacity: .12 }));
      bounds.extend(p); n++;
    };
    if (home) { mk(home, '#0b5e55', '🏠'); if (radius > 0) objs.current.push(new gm.Circle({ map: m, center: home, radius, strokeColor: '#0b5e55', strokeWeight: 2, fillColor: '#0b5e55', fillOpacity: .08 })); }
    if (trail.length > 1) objs.current.push(new gm.Polyline({ map: m, path: trail, strokeColor: '#1864ab', strokeWeight: 3, strokeOpacity: .8 }));
    if (last) mk(last, '#d9480f', '⌚'); if (alertAt) mk(alertAt, '#d9480f', '🚨'); if (caregiver) mk(caregiver, '#1864ab', '🚗');
    if (n > 1) m.fitBounds(bounds, 40); else if (n === 1) { m.setCenter(bounds.getCenter()); m.setZoom(Math.max(m.getZoom(), 15)); }
  }, [ready, home?.lat, home?.lng, radius, last?.lat, last?.lng, alertAt?.lat, alertAt?.lng, caregiver?.lat, caregiver?.lng, trail.length]);
  return <div className={`map-wrap ${className}`}><div ref={el} className="map" style={{ height }} /></div>;
}
