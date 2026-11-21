// 原生能力：长者模式（设为桌面 / 屏幕常亮）、指纹或面容解锁
import { registerPlugin } from '@capacitor/core';
import { BiometricAuth, AndroidBiometryStrength } from '@aparajita/capacitor-biometric-auth';
import { isNative } from './api';

interface ElderModePlugin {
  status(): Promise<{ isHome: boolean; keepAwake: boolean }>;
  setHomeApp(o: { on: boolean }): Promise<void>;
  setKeepAwake(o: { on: boolean }): Promise<void>;
}
export const ElderMode = registerPlugin<ElderModePlugin>('ElderMode');

const BIO_KEY = 'anxin.bio';
const BIO_ASKED = 'anxin.bioAsked';
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };

export const bio = {
  enabled: () => isNative && ls.get(BIO_KEY) === '1',
  setEnabled: (on: boolean) => ls.set(BIO_KEY, on ? '1' : '0'),
  asked: () => ls.get(BIO_ASKED) === '1',
  markAsked: () => ls.set(BIO_ASKED, '1'),
  /** 手机能否用指纹 / 面容 / 锁屏密码来解锁 */
  async available(): Promise<boolean> {
    if (!isNative) return false;
    try { const r = await BiometricAuth.checkBiometry(); return r.isAvailable || r.deviceIsSecure; } catch { return false; }
  },
  /** 弹出系统的指纹 / 面容；手机不支持时退回手机的锁屏密码或图案 */
  async verify(reason: string, title: string): Promise<boolean> {
    try {
      await BiometricAuth.authenticate({ reason, androidTitle: title, allowDeviceCredential: true, androidBiometryStrength: AndroidBiometryStrength.weak, androidConfirmationRequired: false });
      return true;
    } catch { return false; }
  },
};
