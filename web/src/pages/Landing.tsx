// 宣传网站首页（三语）。
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useT, LANGS } from '../i18n';
import { api } from '../api';

const HOTLINE = (import.meta.env.VITE_HOTLINE as string | undefined) || '60123456789';
const APK_URL = (import.meta.env.VITE_APK_URL as string | undefined) || '/downloads/anxin-care.apk';

export default function Landing() {
  const { t, lang, setLang } = useT();
  const [f, setF] = useState({ name: '', phone: '', city: '', message: '' });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('');
    try { await api('/public/enquiry', { body: { ...f, lang }, auth: false }); setSent(true); } catch { setErr(t('networkError')); }
  }
  const wa = `https://wa.me/${HOTLINE}?text=${encodeURIComponent(lang === 'zh' ? '你好，我想了解新山老人照顾协调服务。' : lang === 'ms' ? 'Hai, saya ingin tahu tentang perkhidmatan penjagaan warga emas JB.' : 'Hi, I would like to know about the JB elder care service.')}`;
  const plans = [
    { id: 'basic', price: '150–200' }, { id: 'standard', price: '400–500', hot: true }, { id: 'full', price: '800–1,000' },
  ];
  const svcs = [['🚨', 'svcEmergency'], ['🏠', 'svcVisit'], ['🚗', 'svcEscort'], ['💊', 'svcMeds'], ['⌚', 'svcWatch'], ['💚', 'svcFund']];
  return (
    <div className="site">
      <div className="nav"><div className="nav-in">
        <Link to="/" className="brand"><img src="/icon.svg" alt="" />{t('appName')}</Link>
        <div className="links">
          <a href="#services" className="hide-m">{t('nav_services')}</a><a href="#how" className="hide-m">{t('nav_how')}</a><a href="#pricing" className="hide-m">{t('nav_pricing')}</a><a href="#partners" className="hide-m">{t('nav_partners')}</a><a href="#faq" className="hide-m">{t('nav_faq')}</a><a href="#app" className="hide-m">{t('nav_app')}</a>
          <select value={lang} onChange={e => setLang(e.target.value as any)} style={{ padding: '.3rem', borderRadius: 8, border: '1px solid var(--line)' }}>{LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
          <Link to="/app" className="btn sm">{t('nav_login')}</Link>
        </div>
      </div></div>

      <section className="hero">
        <div>
          <h1>{t('heroTitle')}</h1>
          <p>{t('heroSub')}</p>
          <div className="cta"><a className="btn" href={wa} target="_blank" rel="noreferrer">💬 {t('ctaWhatsapp')}</a><Link className="btn secondary" to="/app/login">{t('ctaTry')}</Link></div>
          <div className="notice">⚕️ {t('notMedical')}</div>
        </div>
        <div className="phone-mock"><div className="scr"><div className="hd">{t('elderHello')}，陈阿婆</div><div className="bs"><div style={{ background: '#d9480f', fontSize: '1.8rem' }}>🆘 {t('sos')}</div><div style={{ background: 'var(--brand)' }}>📞 {t('findSomeone')}</div><div style={{ background: '#1864ab' }}>📅 {t('todayPlan')}</div></div></div></div>
      </section>

      <section>
        <h2 className="sec">{t('painTitle')}</h2>
        <div className="pains">{['pain1', 'pain2', 'pain3'].map(k => <div className="card" key={k}>{t(k)}</div>)}</div>
      </section>

      <section id="services" className="svc">
        <h2 className="sec">{t('svcTitle')}</h2>
        <div className="grid">{svcs.map(([ic, k]) => <div className="card" key={k}><h3><span className="ic">{ic}</span>{t(k)}</h3><p className="small muted">{t(k + 'D')}</p></div>)}</div>
      </section>

      <section id="how">
        <h2 className="sec">{t('howTitle')}</h2>
        <div className="steps">{[1, 2, 3, 4, 5].map(i => <div className="card" key={i}><div>{t('how' + i)}</div></div>)}</div>
      </section>

      <section id="pricing">
        <h2 className="sec">{t('pricingTitle')}</h2>
        <div className="plans">{plans.map(p => <div className={`card ${p.hot ? 'hot' : ''}`} key={p.id}><h3>{t('plan_' + p.id)}</h3><div className="price">RM {p.price} <small>{t('perMonth')}</small></div><p className="small muted">{t(`plan_${p.id}_d`)}</p><a className="btn block" href={wa} target="_blank" rel="noreferrer">{t('ctaWhatsapp')}</a></div>)}</div>
        <p className="small muted" style={{ marginTop: '1rem' }}>{t('pricingNote')}</p>
      </section>

      <section id="partners" className="band" style={{ maxWidth: 'none' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 className="sec">{t('partnersTitle')}</h2>
          <p style={{ maxWidth: 760 }}>{t('partnersD')}</p>
          <a className="btn" href={`https://wa.me/${HOTLINE}?text=${encodeURIComponent('Hi, I am a clinic/nurse and would like to partner.')}`} target="_blank" rel="noreferrer">🤝 {t('partnersCta')}</a>
        </div>
      </section>

      <section id="faq" className="faq">
        <h2 className="sec">{t('faqTitle')}</h2>
        {[1, 2, 3, 4].map(i => <details key={i}><summary>{t(`faq${i}q`)}</summary><p className="muted" style={{ marginTop: '.5rem' }}>{t(`faq${i}a`)}</p></details>)}
      </section>

      <section id="app">
        <h2 className="sec">{t('appTitle')}</h2>
        <p className="muted" style={{ maxWidth: 760 }}>{t('appD')}</p>
        <div className="row"><a className="btn" href={APK_URL}>🤖 {t('downloadApk')}</a><Link className="btn secondary" to="/app/login">🌐 {t('openWeb')}</Link></div>
        <div className="demo-grid" style={{ marginTop: '1.2rem' }}>
          {[['roleElder', '0100000011'], ['roleFamily', '0100000012'], ['roleCoordinator', '0100000001'], ['roleCaregiver', '0100000002']].map(([r, p]) => <div className="card small" key={p}><b>{t(r)}</b><br /><code>{p}</code> / <code>123456</code></div>)}
        </div>
        <p className="small muted" style={{ marginTop: '.6rem' }}>{t('demoAccounts')}</p>
      </section>

      <section id="contact">
        <h2 className="sec">{t('contactTitle')}</h2>
        {sent ? <div className="success">{t('sent')}</div> : (
          <form onSubmit={submit} className="card" style={{ maxWidth: 560 }}>
            {err && <div className="error">{err}</div>}
            <div className="field"><label>{t('yourName')}</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required /></div>
            <div className="field"><label>{t('yourPhone')}</label><input inputMode="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} required /></div>
            <div className="field"><label>{t('yourCity')}</label><input value={f.city} onChange={e => setF({ ...f, city: e.target.value })} /></div>
            <div className="field"><label>{t('yourMessage')}</label><textarea value={f.message} onChange={e => setF({ ...f, message: e.target.value })} /></div>
            <button className="btn">{t('submit')}</button>
          </form>
        )}
      </section>

      <footer>{t('footer')} · <Link to="/legal">{t('legal')}</Link> · <a href={`tel:+${HOTLINE}`}>+{HOTLINE}</a></footer>
    </div>
  );
}
