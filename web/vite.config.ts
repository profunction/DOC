import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';

// 只有 android/app/google-services.json 存在（Firebase 已配置）才启用推送插件，否则原生层会崩溃
const PUSH_ENABLED = fs.existsSync(new URL('./android/app/google-services.json', import.meta.url));

export default defineConfig({
  plugins: [react()],
  define: { __PUSH_ENABLED__: JSON.stringify(PUSH_ENABLED) },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: { outDir: 'dist', sourcemap: false },
});
