import { useState } from 'react';
import QRCode from 'qrcode';
import { IonIcon } from '@ionic/react';
import { phonePortraitOutline } from 'ionicons/icons';
import { useT } from '../i18n';
import { api, getApiBase } from '../api';
import { Btn, useErr } from './ui';

/** 子女或协调员为长者的手机生成启用码：长者手机扫二维码，免密码、永远保持登录 */
export function ElderPhoneSetup({ clientId }: { clientId: number }) {
  const { t } = useT();
  const [code, setCode] = useState('');
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const { Err, show } = useErr();
  async function make() {
    setBusy(true);
    try {
      const r = await api(`/clients/${clientId}/elder-device`, { body: {} });
      const link = `${getApiBase() || window.location.origin}/app/activate/${r.invite}`;
      setCode(r.invite); setQr(await QRCode.toDataURL(link, { width: 260, margin: 1, color: { dark: '#0b5e55' } }));
    } catch (e) { show(e); } finally { setBusy(false); }
  }
  return (
    <div className="card elder-setup"><h3><IonIcon icon={phonePortraitOutline} /> {t('elderSetupTitle')}</h3>
      {Err}
      <p className="small muted">{t('elderSetupIntro')}</p>
      {qr ? <div className="qr-wrap"><img src={qr} alt="QR" width={220} height={220} /><div className="code">{code.replace(/(.{4})(.{4})(.{2})/, '$1-$2-$3')}</div><p className="small muted">{t('inviteHint')}</p></div>
        : <Btn v="" onClick={make} disabled={busy}>{busy ? t('loading') : t('elderSetupBtn')}</Btn>}
    </div>
  );
}
