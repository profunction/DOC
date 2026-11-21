import { useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { watchOutline, batteryHalfOutline, batteryDeadOutline, locationOutline, heartOutline, mapOutline, shieldCheckmarkOutline, warningOutline } from 'ionicons/icons';
import { useT } from '../i18n';
import { api, niceTime } from '../api';
import { Btn, Badge, Field, useErr, useLoad, mapsLink } from './ui';
import { useStore } from '../store';
import { MapView } from './MapView';

/** 子女 / 协调员共用：父母位置、电量、安全范围、心跳范围 */
export function WatchPanel({ clientId, canSimulate }: { clientId: number; canSimulate?: boolean }) {
  const { t } = useT();
  const { user } = useStore();
  const { data: w, reload } = useLoad<any>(`/clients/${clientId}/watch`, [], ['watch', 'alert']);
  const { data: trail } = useLoad<any[]>(`/clients/${clientId}/watch/trail?hours=24`, [], ['watch']);
  const [f, setF] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [picking, setPicking] = useState(false);
  const { Err, show } = useErr();
  useEffect(() => { if (w) setF({ safe_radius: w.safe_radius || 300, hr_min: w.hr_min, hr_max: w.hr_max, watch_id: w.watch_id || '' }); }, [w]);
  if (!w || !f) return <p className="muted">{t('loading')}</p>;
  const save = async (extra: any = {}) => { try { await api(`/clients/${clientId}/watch`, { method: 'PATCH', body: { ...f, ...extra } }); setMsg(t('watchSaved')); setTimeout(() => setMsg(''), 1500); reload(); } catch (e) { show(e); } };
  const sim = async (body: any) => { try { await api(`/clients/${clientId}/watch/simulate`, { body }); reload(); } catch (e) { show(e); } };
  const last = w.last;
  const statusBadge = w.watch_status === 'inside' ? <Badge kind="ok"><IonIcon icon={shieldCheckmarkOutline} /> {t('inSafeZone')}</Badge> : w.watch_status === 'outside' ? <Badge kind="danger"><IonIcon icon={warningOutline} /> {t('outSafeZone')}</Badge> : <Badge kind="gray">{t('zoneUnknown')}</Badge>;
  const home = { lat: w.safe_lat ?? w.lat, lng: w.safe_lng ?? w.lng };
  return (
    <div>
      {Err}{msg && <div className="success">{msg}</div>}
      {!w.watch_id && !canSimulate && <div className="card"><h3><IonIcon icon={watchOutline} /> {t('watch')}</h3><p className="muted">{t('watchNone')}</p>
        <MapView home={home.lat != null ? { lat: home.lat, lng: home.lng! } : null} radius={w.safe_lat != null ? w.safe_radius : 0} onPick={picking ? (p) => { setPicking(false); save({ safe_lat: p.lat, safe_lng: p.lng }); } : undefined} className={picking ? 'picking' : ''} height={220} /></div>}
      {(w.watch_id || canSimulate) && <div className="card">
        <div className="row between"><h3><IonIcon icon={watchOutline} /> {t('location')}</h3>{statusBadge}</div>
        {w.offline && w.watch_last_seen && <div className="error">{t('offlineWarn').replace('{h}', String(w.offline_hours))}</div>}
        <div className="watch-stats">
          <div><IonIcon icon={(w.watch_battery ?? 100) <= w.low_battery ? batteryDeadOutline : batteryHalfOutline} /><b>{w.watch_battery ?? '-'}%</b><span>{t('battery')}</span></div>
          <div><IonIcon icon={heartOutline} /><b>{last?.heart_rate || '-'}</b><span>bpm</span></div>
          <div><IonIcon icon={locationOutline} /><b>{w.watch_last_seen ? niceTime(w.watch_last_seen) : '-'}</b><span>{t('lastSeen')}</span></div>
        </div>
        {last?.lat && <div className="row" style={{ marginTop: '.6rem' }}>
          <Btn v="sm" href={mapsLink(null, last.lat, last.lng)} target="_blank" rel="noreferrer"><IonIcon slot="start" icon={mapOutline} />{t('openMap')}</Btn>
          {trail && trail.length > 1 && <span className="small muted">{t('trail24')}：{trail.length} 点</span>}
        </div>}
        <MapView last={last?.lat ? { lat: last.lat, lng: last.lng, label: `${t('lastSeen')} ${niceTime(w.watch_last_seen)}` } : null}
          home={home.lat != null ? { lat: home.lat, lng: home.lng! } : null} radius={w.safe_lat != null ? w.safe_radius : 0}
          trail={(trail || []).slice().reverse().map(p => ({ lat: p.lat, lng: p.lng }))} onPick={picking ? (p) => { setPicking(false); save({ safe_lat: p.lat, safe_lng: p.lng }); } : undefined} className={picking ? 'picking' : ''} />
        {picking && <p className="small" style={{ color: 'var(--brand)', marginTop: '.4rem' }}>{t('tapMapToSetHome')}</p>}
      </div>}
      <div className="card"><h3><IonIcon icon={shieldCheckmarkOutline} /> {t('safeZone')}</h3>
        <p className="small muted">{t('safeZoneHelp')}</p>
        <div className="row small" style={{ marginBottom: '.5rem' }}>
          <Btn v="ghost sm" onClick={() => save({ safe_lat: w.lat, safe_lng: w.lng })} disabled={w.lat == null}>{t('useHomeAddress')}</Btn>
          <Btn v="ghost sm" onClick={() => save({ safe_lat: last?.lat, safe_lng: last?.lng })} disabled={!last?.lat}>{t('useLastPosition')}</Btn>
          <Btn v={`sm ${picking ? '' : 'ghost'}`} onClick={() => setPicking(p => !p)}>{picking ? t('cancel') : t('pickOnMap')}</Btn>
          {w.safe_lat != null && <a className="small" href={mapsLink(null, w.safe_lat, w.safe_lng)} target="_blank" rel="noreferrer">📍 {w.safe_lat.toFixed(4)}, {w.safe_lng.toFixed(4)}</a>}
        </div>
        <div className="form-grid">
          <Field label={t('radius')}><select value={f.safe_radius} onChange={e => setF({ ...f, safe_radius: Number(e.target.value) })}>{[0, 100, 200, 300, 500, 1000, 2000].map(r => <option key={r} value={r}>{r === 0 ? '—' : `${r} m`}</option>)}</select></Field>
          <Field label={`${t('heartRange')} · ${t('hrLow')}`}><input type="number" value={f.hr_min} onChange={e => setF({ ...f, hr_min: Number(e.target.value) })} /></Field>
          <Field label={`${t('heartRange')} · ${t('hrHigh')}`}><input type="number" value={f.hr_max} onChange={e => setF({ ...f, hr_max: Number(e.target.value) })} /></Field>
          {user?.role === 'coordinator' && <Field label={t('watchId')}><input value={f.watch_id} onChange={e => setF({ ...f, watch_id: e.target.value })} placeholder="86xxxxxxxxxxxxx" /></Field>}
        </div>
        <Btn v="" onClick={() => save()}>{t('save')}</Btn>
      </div>
      {canSimulate && <div className="card"><h3>{t('simulate')}</h3><div className="row">
        <Btn v="ghost sm" onClick={() => sim({ lat: home.lat ?? 1.4855, lng: home.lng ?? 103.767, battery: 80, heart_rate: 72 })}>{t('simHome')}</Btn>
        <Btn v="ghost sm" onClick={() => sim({ lat: (home.lat ?? 1.4855) + 0.01, lng: home.lng ?? 103.767, battery: 78, heart_rate: 75 })}>{t('simAway')}</Btn>
        <Btn v="danger sm" onClick={() => sim({ alarm: 'sos' })}>{t('simSos')}</Btn>
        <Btn v="danger sm" onClick={() => sim({ alarm: 'fallDown' })}>{t('simFall')}</Btn>
        <Btn v="ghost sm" onClick={() => sim({ battery: 10 })}>{t('simLowBatt')}</Btn>
      </div></div>}
    </div>
  );
}

