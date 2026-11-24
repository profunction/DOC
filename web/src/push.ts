// Firebase 推送（App 关着也能收到）。没有 google-services.json 时 register() 会失败，这里静默跳过。
import { PushNotifications } from '@capacitor/push-notifications';
import { api, isNative } from './api';

declare const __PUSH_ENABLED__: boolean;
let started = false;
export async function startPush(navigate: (path: string) => void) {
  // 没有 google-services.json 时绝不调用插件：FirebaseMessaging 未初始化会让 App 直接闪退
  if (!isNative || started || !__PUSH_ENABLED__) return;
  started = true;
  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;
    await PushNotifications.createChannel({ id: 'alerts', name: '紧急警报 / Emergency', importance: 5, sound: 'default', vibration: true, visibility: 1 }).catch(() => {});
    await PushNotifications.createChannel({ id: 'general', name: '一般通知 / General', importance: 3 }).catch(() => {});
    PushNotifications.addListener('registration', t => { api('/push/token', { body: { token: t.value, platform: 'android' } }).catch(() => {}); });
    PushNotifications.addListener('registrationError', () => { /* 没有 Firebase 配置时会到这里，忽略 */ });
    PushNotifications.addListener('pushNotificationActionPerformed', a => {
      const d = a.notification.data || {};
      if (d.type === 'alert') navigate('/app'); else if (d.type === 'report') navigate('/app');
    });
    await PushNotifications.register();
  } catch { /* Firebase 未配置 */ }
}
