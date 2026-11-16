import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'my.anxincare.app',
  appName: '安心照顾',
  webDir: 'dist',
  android: { allowMixedContent: true },
  server: { androidScheme: 'https', cleartext: true },
  plugins: {
    LocalNotifications: { iconColor: '#d9480f' },
  },
};

export default config;
