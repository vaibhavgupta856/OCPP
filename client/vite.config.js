import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildId =
  (process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || '').slice(0, 7) ||
  `local-${Date.now().toString(36).slice(-6)}`;

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD__: JSON.stringify(buildId),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/socket.io': {
        target: 'http://localhost:8787',
        ws: true,
      },
    },
  },
});
