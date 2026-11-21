import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IonContent, IonPage } from '@ionic/react';
import { useT } from '../i18n';
import { useStore } from '../store';
import { getApiBase, setApiBase, isNative, pingServer, ApiError, api } from '../api';
import { LangSelect, useErr, Btn } from '../components/ui';

const DEMO = [
  { role: 'roleElder', phone: '0100000011' }, { role: 'roleFamily', phone: '0100000012' },
  { role: 'roleCoordinator', phone: '0100000001' }, { role: 'roleCaregiver', phone: '0100000002' },
];

export default function Login({ initialMode }: { initialMode?: 'login' | 'register' | 'activate' }) {
  const { t, lang } = useT();
  const { login, setSession } = useStore();
  const nav = useNavigate();
  const params = useParams();
  const [mode, setMode] = useState<'login' | 'register' | 'activate'>(initialMode || (params.code ? 'activate' : 'login'));
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState(getApiBase());
  // 正式版把服务器地址写死（VITE_API_BASE），顾客看不到地址栏；开发者连点 logo 7 下才显示
  const BUILT_IN = Boolean(import.meta.env.VITE_API_BASE);
  const [showServer, setShowServer] = useState(false);
  const [taps, setTaps] = useState(0);
  const notConfigured = isNative && !getApiBase();
  function tapLogo() { const n = taps + 1; setTaps(n); if (n >= 7) { setShowServer(true); setTaps(0); } }
  const [busy, setBusy] = useState(false);
  const [ping, setPing] = useState('');
  // 只有服务器处于演示模式（SEED_DEMO 不是 0）才显示演示账号
  const [demo, setDemo] = useState(false);
  useEffect(() => { if (getApiBase() || !isNative) api<{ demo?: boolean }>('/public/info', { auth: false }).then(r => setDemo(Boolean(r.demo))).catch(() => {}); }, []);
  const { Err, show, setErr } = useErr();

  async function testServer() {
    setErr(''); setPing(''); setBusy(true);
    try { const hot = await pingServer(server); setApiBase(server); setPing(`${t('serverOk')} · ${t('hotline')} +${hot}`); } catch (err) { show(err); } finally { setBusy(false); }
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (showServer) setApiBase(server);
      if (isNative && !getApiBase()) throw new ApiError(0, showServer ? 'no_server' : 'not_configured');
      await login(phone.trim(), password);
      nav('/app', { replace: true });
    } catch (err) { show(err); } finally { setBusy(false); }
  }

  // ---- 自己注册（子女 / 家属账号）----
  const [rg, setRg] = useState({ name: '', phone: '', password: '', password2: '', relation: '女儿', parent_name: '', parent_birth_year: '', city: '', address: '', conditions: '', message: '', agree: false });
  async function register(e: FormEvent) {
    e.preventDefault(); setErr('');
    if (rg.password !== rg.password2) { setErr(t('passwordMismatch')); return; }
    if (!rg.agree) { setErr(t('mustAgree')); return; }
    setBusy(true);
    try {
      if (isNative && !getApiBase()) throw new ApiError(0, 'not_configured');
      const { password2, ...body } = rg;
      const r = await api('/public/register', { body: { ...body, lang }, auth: false });
      await setSession(r.token);
      nav('/app', { replace: true });
    } catch (err) { show(err); } finally { setBusy(false); }
  }
  // ---- 启用账号 ----
  const [code, setCode] = useState(String(params.code || ''));
  const [inv, setInv] = useState<{ name: string; phone: string; role: string } | null>(null);
  const [pw1, setPw1] = useState(''); const [pw2, setPw2] = useState('');
  async function checkCode(e?: FormEvent) {
    e?.preventDefault(); setErr(''); setBusy(true);
    try { setInv(await api(`/public/invite/${encodeURIComponent(code.trim())}`, { auth: false })); } catch (err) { show(err); } finally { setBusy(false); }
  }
  useEffect(() => { if (params.code) checkCode(); }, [params.code]);
  async function activate(e: FormEvent) {
    e.preventDefault(); setErr('');
    if (pw1 !== pw2) { setErr(t('passwordMismatch')); return; }
    setBusy(true);
    try {
      const r = await api(`/public/invite/${encodeURIComponent(code.trim())}`, { body: { password: pw1 }, auth: false });
      await setSession(r.token);
      nav('/app', { replace: true });
    } catch (err) { show(err); } finally { setBusy(false); }
  }
  const go = (m: 'login' | 'register' | 'activate') => { setErr(''); setMode(m); };

  return (
    <IonPage><IonContent><div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card login-card" style={{ width: '100%', maxWidth: 420 }}>
        <div className="row between" style={{ marginBottom: '.8rem' }}>
          <div className="row" onClick={tapLogo} style={{ cursor: 'default' }}><img src="/icon.svg" alt="" width={36} height={36} /><div><b>{t('appName')}</b><div className="small muted">{t('tagline')}</div></div></div>
          <LangSelect />
        </div>
        {mode === 'register' && <>
          <h2>{t('registerTitle')}</h2>
          <p className="small muted">{t('registerIntro')}</p>
          {Err}
          <form onSubmit={register}>
            <div className="form-sec">{t('aboutYou')}</div>
            <div className="field"><label>{t('yourName')}</label><input value={rg.name} onChange={e => setRg({ ...rg, name: e.target.value })} required maxLength={80} autoComplete="name" /></div>
            <div className="field"><label>{t('yourPhone')}</label><input inputMode="tel" value={rg.phone} onChange={e => setRg({ ...rg, phone: e.target.value })} required maxLength={20} autoComplete="tel" placeholder="0123456789" /></div>
            <div className="field"><label>{t('newPassword')}</label><input type="password" autoComplete="new-password" minLength={6} value={rg.password} onChange={e => setRg({ ...rg, password: e.target.value })} required /></div>
            <div className="field"><label>{t('confirmPassword')}</label><input type="password" autoComplete="new-password" minLength={6} value={rg.password2} onChange={e => setRg({ ...rg, password2: e.target.value })} required /></div>
            <div className="form-sec">{t('aboutParent')}</div>
            <div className="field"><label>{t('iAmTheir')}</label><select value={rg.relation} onChange={e => setRg({ ...rg, relation: e.target.value })}><option value="女儿">{t('relDaughter')}</option><option value="儿子">{t('relSon')}</option><option value="家属">{t('relOther')}</option></select></div>
            <div className="field"><label>{t('parentName')}</label><input value={rg.parent_name} onChange={e => setRg({ ...rg, parent_name: e.target.value })} required maxLength={80} placeholder="陈阿婆 / Puan Aminah" /></div>
            <div className="field"><label>{t('parentBirthYear')}</label><input inputMode="numeric" value={rg.parent_birth_year} onChange={e => setRg({ ...rg, parent_birth_year: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })} placeholder="1948" /></div>
            <div className="field"><label>{t('parentArea')}</label><input value={rg.city} onChange={e => setRg({ ...rg, city: e.target.value })} placeholder="新山市区 / 士古来 / 古来 …" maxLength={80} /></div>
            <div className="field"><label>{t('parentAddress')}</label><input value={rg.address} onChange={e => setRg({ ...rg, address: e.target.value })} maxLength={200} /></div>
            <div className="field"><label>{t('parentConditions')}</label><input value={rg.conditions} onChange={e => setRg({ ...rg, conditions: e.target.value })} maxLength={500} /></div>
            <div className="field"><label>{t('yourMessage')}</label><textarea value={rg.message} onChange={e => setRg({ ...rg, message: e.target.value })} maxLength={1000} /></div>
            <label className="row small" style={{ marginBottom: '.8rem', flexWrap: 'nowrap', alignItems: 'flex-start' }}><input type="checkbox" checked={rg.agree} onChange={e => setRg({ ...rg, agree: e.target.checked })} style={{ marginTop: '.2rem' }} /><span>{t('agreeTerms')} <a href="/legal" target="_blank" rel="noreferrer">{t('terms')}</a></span></label>
            <Btn v="block" disabled={busy}>{busy ? t('loading') : t('register')}</Btn>
          </form>
          <p className="login-links"><a onClick={() => go('login')}>← {t('backToLogin')}</a></p>
        </>}

        {mode === 'activate' && <>
          <h2>{t('activateTitle')}</h2>
          {Err}
          {!inv ? <>
            <p className="small muted">{t('activateIntro')}</p>
            <form onSubmit={checkCode}>
              <div className="field"><label>{t('inviteCode')}</label><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABCD-EFGH-JK" autoCapitalize="characters" required style={{ letterSpacing: '.15em', fontWeight: 700 }} /></div>
              <Btn v="block" disabled={busy}>{busy ? t('loading') : t('checkCode')}</Btn>
            </form></> : <>
            <div className="success">{t('activateFor')}：<b>{inv.name}</b> · {inv.phone}</div>
            <form onSubmit={activate}>
              <div className="field"><label>{t('newPassword')}</label><input type="password" autoComplete="new-password" minLength={6} value={pw1} onChange={e => setPw1(e.target.value)} required /></div>
              <div className="field"><label>{t('confirmPassword')}</label><input type="password" autoComplete="new-password" minLength={6} value={pw2} onChange={e => setPw2(e.target.value)} required /></div>
              <Btn v="block" disabled={busy}>{busy ? t('loading') : t('activate')}</Btn>
            </form></>}
          <p className="login-links"><a onClick={() => { go('login'); setInv(null); }}>← {t('backToLogin')}</a></p>
        </>}

        {mode === 'login' && <>
        <h2>{t('login')}</h2>
        {notConfigured && !showServer && <div className="error">{t('notConfigured')}</div>}
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
        <div className="login-actions">
          <Btn v="secondary block" onClick={() => go('register')}>{t('register')}</Btn>
          <Btn v="ghost block" onClick={() => go('activate')}>{t('haveCode')}</Btn>
        </div>
        {!isNative && <p className="small muted" style={{ marginTop: '.8rem' }}><Link to="/">← {t('tagline')}</Link></p>}
        {showServer && <p className="small muted">{BUILT_IN ? `${t('serverUrl')}: ${import.meta.env.VITE_API_BASE}` : ''}</p>}
        {demo && <details style={{ marginTop: '.6rem' }}>
          <summary className="small muted">{t('demoAccounts')}</summary>
          <div className="stack" style={{ marginTop: '.5rem' }}>
            {DEMO.map(d => <Btn key={d.phone} type="button" v="ghost sm block" onClick={() => { setPhone(d.phone); setPassword('123456'); }}>{t(d.role)} · {d.phone}</Btn>)}
          </div>
        </details>}
        </>}
      </div>
    </div></IonContent></IonPage>
  );
}
