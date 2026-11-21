// 真实地图：Leaflet（BSD）+ OpenStreetMap 图块（免费，无需钥匙）。
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Capacitor / Vite 打包后 Leaflet 找不到默认图标，直接用内联 SVG
const pin = (color: string, emoji = '') => L.divIcon({ className: 'pin', html: `<div class="pin-dot" style="background:${color}"><span>${emoji}</span></div>`, iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -26] });

export interface MapPoint { lat: number; lng: number }
export function MapView({ center, zoom = 15, last, home, radius = 0, trail = [], alertAt, onPick, height = 260, className = '' }: {
  center?: MapPoint | null; zoom?: number; last?: MapPoint & { label?: string } | null; home?: MapPoint | null; radius?: number;
  trail?: MapPoint[]; alertAt?: MapPoint & { label?: string } | null; onPick?: (p: MapPoint) => void; height?: number; className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const c = center || last || home || alertAt || { lat: 1.4927, lng: 103.7414 };   // 默认新山
    m.setView([c.lat, c.lng], zoom);
    setTimeout(() => m.invalidateSize(), 200);
    return () => { m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current; if (!m) return;
    m.off('click');
    if (onPick) m.on('click', e => onPick({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }));
  }, [onPick]);

  useEffect(() => {
    const m = map.current, g = layer.current; if (!m || !g) return;
    g.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    if (home) { L.marker([home.lat, home.lng], { icon: pin('#0b5e55', '🏠') }).addTo(g); bounds.push([home.lat, home.lng]); if (radius > 0) L.circle([home.lat, home.lng], { radius, color: '#0b5e55', weight: 2, dashArray: '6 4', fillOpacity: .08 }).addTo(g); }
    if (trail.length > 1) L.polyline(trail.map(p => [p.lat, p.lng] as L.LatLngExpression), { color: '#1864ab', weight: 3, opacity: .8 }).addTo(g);
    if (last) { L.marker([last.lat, last.lng], { icon: pin('#d9480f', '⌚') }).addTo(g).bindPopup(last.label || ''); bounds.push([last.lat, last.lng]); }
    if (alertAt) { L.marker([alertAt.lat, alertAt.lng], { icon: pin('#d9480f', '🚨') }).addTo(g).bindPopup(alertAt.label || ''); bounds.push([alertAt.lat, alertAt.lng]); }
    if (bounds.length > 1) m.fitBounds(L.latLngBounds(bounds as L.LatLngTuple[]).pad(0.3), { maxZoom: 17 });
    else if (bounds.length === 1) m.setView(bounds[0], Math.max(m.getZoom(), 15));
    setTimeout(() => m.invalidateSize(), 100);
  }, [home?.lat, home?.lng, radius, last?.lat, last?.lng, alertAt?.lat, alertAt?.lng, trail.length]);

  // 外层负责样式切换；内层 class 固定，避免 React 覆盖 Leaflet 自己加的 class
  return <div className={`map-wrap ${className}`}><div ref={el} className="map" style={{ height }} /></div>;
}
