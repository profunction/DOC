import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IonContent, IonPage } from '@ionic/react';
import { useT } from '../i18n';
import { useStore } from '../store';
import { getApiBase, setApiBase, isNative, pingServer, ApiError } from '../api';
import { LangSelect, useErr, Btn } from '../components/ui';

const DEMO = [
  { role: 'roleElder', phone: '0100000011' }, { role: 'roleFamily', phone: '0100000012' },
  { role: 'roleCoordinator', phone: '0100000001' }, { role: 'roleCaregiver', phone: '0100000002' },
];

export default function Login() {
  const { t } = useT();
  const { login } = useStore();
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState(getApiBase());
  const [showServer, setShowServer] = useState(isNative && !getApiBase());
  const [busy, setBusy] = useState(false);
  const [ping, setPing] = useState('');
  const { Err, show, setErr } = useErr();

  async function testServer() {
    setErr(''); setPing(''); setBusy(true);
    try { const hot = await pingServer(server); setApiBase(server); setPing(`${t('serverOk')} · ${t('hotline')} +${hot}`); } catch (err) { show(err); } finally { setBusy(false); }
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (showServer) setApiBase(server);
      if (isNative && !getApiBase()) { setShowServer(true); throw new ApiError(0, 'no_server'); }
      await login(phone.trim(), password);
      nav('/app', { replace: true });
    } catch (err) { show(err); } finally { setBusy(false); }
  }

  return (
    <IonPage><IonContent><div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card login-card" style={{ width: '100%', maxWidth: 420 }}>
        <div className="row between" style={{ marginBottom: '.8rem' }}>
          <div className="row"><img src="/icon.svg" alt="" width={36} height={36} /><div><b>{t('appName')}</b><div className="small muted">{t('tagline')}</div></div></div>
          <LangSelect />
        </div>
        <h2>{t('login')}</h2>
        {Err}
        <form onSubmit={submit}>
          <div className="field"><label>{t('phone')}</label><input inputMode="tel" autoComplete="username" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0123456789" required /></div>
          <div className="field"><label>{t('password')}</label><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          {showServer && <div className="field"><label>{t('serverUrl')}</label>
            <div className="row" style={{ flexWrap: 'nowrap' }}><input inputMode="url" value={server} onChange={e => setServer(e.target.value)} placeholder="https://care.example.com 或 192.168.1.10:8787" style={{ flex: 1 }} /><Btn v="sm ghost" onClick={testServer} disabled={busy}>{t('serverTest')}</Btn></div>
            {ping && <div className="success small" style={{ marginTop: '.4rem' }}>{ping}</div>}
            <p className="small muted" style={{ marginTop: '.3rem' }}>{t('serverHint')}</p></div>}
          <Btn v="block" disabled={busy}>{busy ? t('loading') : t('login')}</Btn>
        </form>
        <p className="small muted" style={{ marginTop: '.8rem' }}>
          <Btn v="ghost sm" type="button" onClick={() => setShowServer(s => !s)}>{t('serverUrl')}</Btn>
          {!isNative && <>&nbsp;·&nbsp;<Link to="/">← {t('tagline')}</Link></>}
        </p>
        <details style={{ marginTop: '.6rem' }}>
          <summary className="small muted">{t('demoAccounts')}</summary>
          <div className="stack" style={{ marginTop: '.5rem' }}>
            {DEMO.map(d => <Btn key={d.phone} type="button" v="ghost sm block" onClick={() => { setPhone(d.phone); setPassword('123456'); }}>{t(d.role)} · {d.phone}</Btn>)}
          </div>
        </details>
      </div>
    </div></IonContent></IonPage>
  );
}
